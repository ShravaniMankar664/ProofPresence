/**
 * Web server + JSON API for ProofPresence.
 *
 * Reuses the same wallet/providers as the CLI and exposes the contract over
 * HTTP: create events, check in, issue certificates, and inspect the on-chain
 * ledger. Serves the React frontend (built from `web/`) at `/` plus a JSON API
 * under `/api/*`.
 *
 * Demo-mode note: the on-chain contract derives each attendee's pseudonymous
 * identity from that attendee's own secret. Because the demo runs through one
 * server wallet, every check-in is executed with a freshly-generated identity
 * secret, so each check-in is a distinct pseudonymous attendee. This keeps the
 * privacy guarantees intact while letting the dashboards and AI insights work
 * with real on-chain data.
 *
 * Run with: npm run server
 */
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';
import { Buffer } from 'node:buffer';

import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { resolveNetwork, getOrCreateWallet, getDeployment } from './network';
import { createWallet, persistWalletState, unshieldedToken } from './wallet';
import {
  compiledProofPresence,
  PRIVATE_STATE_ID,
  contractModule,
  createPrivateState,
  generateIdentitySecret,
  ledgerFromState,
  pureCircuits,
} from './contract';
import { createProviders } from './providers';
import { loadLocalData, saveLocalData } from './local-data';
import type { CheckinRecord, LocalData } from './local-data';

// @ts-expect-error Required for wallet sync
globalThis.WebSocket = WebSocket;

const { network, config: networkConfig } = resolveNetwork();
const WALLET = getOrCreateWallet(network);
const SEED = WALLET.seed;

const PORT = Number(process.env.PORT ?? 8080);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIST = path.resolve(__dirname, '..', 'web', 'dist');

function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

function fromHex(hex: string): Uint8Array {
  const cleaned = hex.trim().toLowerCase();
  if (!/^(?:[0-9a-f]{2})+$/.test(cleaned)) {
    throw new Error(`invalid hex: "${hex}"`);
  }
  return Buffer.from(cleaned, 'hex');
}

// ─── Local (off-chain) data ───────────────────────────────────────────────────

let localData: LocalData = loadLocalData();

/**
 * One-time backfill: older versions stored issued certificates without the
 * attendee link (so the organizer dashboard showed every attendee as
 * uncertified). Recompute each attendee's certificate id from its stored
 * identity secret and match it against the recorded certificate ids, then
 * persist the attendee links.
 */
function migrateLegacyCertAttendees(data: LocalData): void {
  const byCertHex = new Map<string, number>();
  data.issuedCerts.forEach((c, i) => {
    if (!c.attendeeId) byCertHex.set(c.certificateId, i);
  });
  if (byCertHex.size === 0) return;

  let contract: any;
  try {
    contract = Object.create(contractModule.Contract.prototype);
    if (typeof contract._certificateId_0 !== 'function') return;
  } catch {
    return;
  }

  let changed = false;
  for (const checkin of data.checkins) {
    const idx = byCertHex.get(toHex(contract._certificateId_0(fromHex(checkin.eventId), pureCircuits().computeAttendeeIdentity(fromHex(checkin.eventId), fromHex(checkin.secret)))));
    if (idx !== undefined) {
      data.issuedCerts[idx].attendeeId = checkin.attendeeId;
      byCertHex.delete(data.issuedCerts[idx].certificateId);
      changed = true;
    }
  }
  if (changed) saveLocalData(data);
}
function persistLocal() {
  saveLocalData(localData);
}

// ─── Ledger serialization ─────────────────────────────────────────────────────

function serializeLedger(ledger: any): any {
  const events: any[] = [];
  if (ledger.events && !ledger.events.isEmpty()) {
    for (const [id, event] of ledger.events) {
      let attendance = '0';
      try {
        attendance = ledger.attendance.lookup(id).size().toString();
      } catch {
        // attendance entry not yet visible to this state snapshot
      }
      events.push({
        id: toHex(id),
        name: event.name,
        date: event.date.toString(),
        threshold: event.threshold.toString(),
        organizer: toHex(event.organizer),
        attendance,
      });
    }
  }
  const certificates: string[] = [];
  if (ledger.certificates && !ledger.certificates.isEmpty()) {
    for (const cert of ledger.certificates) certificates.push(toHex(cert));
  }
  return {
    sequence: ledger.sequence?.toString() ?? '0',
    events,
    certificates,
  };
}

// ─── Serialized transaction execution ─────────────────────────────────────────

let txQueue: Promise<unknown> = Promise.resolve();

function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const run = txQueue.then(fn);
  txQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function callTxWithRetry(
  call: () => Promise<any>,
  maxRetries = 6,
  delayMs = 5000,
): Promise<any> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await call();
    } catch (err: any) {
      lastErr = err;
      const msg = `${err?.message ?? err} ${err?.cause?.message ?? ''}`;
      const transient =
        msg.includes('Not enough Dust') ||
        msg.includes('Insufficient Funds') ||
        msg.includes('could not balance dust');
      if (!transient || attempt === maxRetries) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function sendError(res: ServerResponse, status: number, message: string): void {
  sendJson(res, status, { ok: false, error: message });
}

function readJson(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: Buffer) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error('request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error('invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

/** Read a JSON body, responding 400 (instead of a 500) on parse errors. */
async function readJsonBody(req: IncomingMessage, res: ServerResponse): Promise<any | null> {
  try {
    return await readJson(req);
  } catch {
    sendError(res, 400, 'invalid request body');
    return null;
  }
}

// ─── Static frontend serving ──────────────────────────────────────────────────

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
  '.webmanifest': 'application/manifest+json',
};

const FALLBACK_HTML = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>ProofPresence</title>
<style>
  body { background: #0a0e17; color: #e6e8ee; font-family: system-ui, sans-serif; display: grid; place-items: center; min-height: 100vh; margin: 0; }
  .card { max-width: 560px; background: #131824; border: 1px solid #262b36; border-radius: 14px; padding: 32px; }
  h1 { font-size: 20px; margin-top: 0; }
  pre { background: #0f1115; padding: 12px; border-radius: 8px; overflow: auto; font-size: 13px; }
</style></head>
<body><div class="card">
<h1>⚡ ProofPresence frontend not built</h1>
<p>Run <code>npm run build:web</code> to build the React UI, then refresh this page.</p>
</div></body></html>`;

function serveStatic(res: ServerResponse, filePath: string): void {
  let resolved = filePath;
  if (!path.extname(resolved)) resolved = path.join(resolved, 'index.html');
  const absolute = path.resolve(WEB_DIST, `.${resolved}`);
  if (!(absolute === WEB_DIST || absolute.startsWith(WEB_DIST + path.sep))) return sendError(res, 403, 'forbidden');
  fs.readFile(absolute, (err, data) => {
    if (err) {
      // SPA fallback — unknown client-side routes render via React Router.
      if (!path.extname(filePath)) return serveIndex(res);
      return sendError(res, 404, 'not found');
    }
    const mime = MIME_TYPES[path.extname(absolute).toLowerCase()] ?? 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': mime,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': path.extname(absolute) === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    });
    res.end(data);
  });
}

function serveIndex(res: ServerResponse): void {
  fs.readFile(path.join(WEB_DIST, 'index.html'), (err, data) => {
    if (err) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(FALLBACK_HTML);
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

// ─── Insights ─────────────────────────────────────────────────────────────────

interface Insights {
  attendance: number;
  attendanceRate: number;
  peakCheckinHour: number | null;
  peakCheckinWindow: string | null;
  checkinHistogram: { hour: number; count: number }[];
  onTimeRate: number;
  certCompletion: number;
  engagementScore: number;
  labels: Record<string, string>;
}

function computeInsights(eventIdHex: string, attendance: number, threshold: number, nowMs: number): Insights {
  const meta = localData.events[eventIdHex];
  const capacity = meta?.capacity ?? 0;
  const eventStartMs = meta?.createdAt ?? nowMs;

  const checkins = localData.checkins.filter((c) => c.eventId === eventIdHex);
  const issued = localData.issuedCerts.filter((c) => c.eventId === eventIdHex).length;

  const attendanceRate =
    capacity > 0
      ? Math.max(0, Math.min(100, Math.round((attendance / capacity) * 100)))
      : threshold > 0
        ? Math.max(0, Math.min(100, Math.round((attendance / threshold) * 100)))
        : attendance > 0
          ? 100
          : 0;

  const byHour = new Map<number, number>();
  for (const c of checkins) {
    const hour = new Date(c.at).getHours();
    byHour.set(hour, (byHour.get(hour) ?? 0) + 1);
  }
  const checkinHistogram = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: byHour.get(hour) ?? 0,
  }));
  let peakHour: number | null = null;
  let peakCount = 0;
  for (const [hour, count] of byHour) {
    if (count > peakCount) {
      peakCount = count;
      peakHour = hour;
    }
  }
  const peakCheckinWindow =
    peakHour === null
      ? null
      : `${String(peakHour).padStart(2, '0')}:00 – ${String(peakHour + 1).padStart(2, '0')}:00`;

  const onTime = checkins.filter((c) => c.at - eventStartMs <= 3_600_000).length;
  const onTimeRate = checkins.length > 0 ? Math.round((onTime / checkins.length) * 100) : 0;

  const certCompletion = attendance > 0 ? Math.max(0, Math.min(100, Math.round((issued / attendance) * 100))) : 0;

  const engagementScore = Math.round(attendanceRate * 0.4 + onTimeRate * 0.3 + certCompletion * 0.3);

  return {
    attendance,
    attendanceRate,
    peakCheckinHour: peakHour,
    peakCheckinWindow,
    checkinHistogram,
    onTimeRate,
    certCompletion,
    engagementScore,
    labels: {
      attendanceRate: capacity > 0 ? 'of expected attendance' : 'vs. certification threshold',
      peakCheckinWindow: peakCheckinWindow ?? 'no check-ins yet',
      onTimeRate: 'checked in within 60 min of event start',
      certCompletion: 'certificates issued per attendee',
      engagementScore: 'weighted blend of attendance, on-time and certificate completion',
    },
  };
}

function toInsights(event: any, attendance: number, threshold: number, nowMs: number): Insights {
  return computeInsights(event.id, attendance, threshold, nowMs);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

let walletCtx: any;
let providers: any;
let deployed: any;
let contractAddress: string;
let walletAddress: string;

async function getBalances(): Promise<{ tNight: string; dust: string }> {
  const state = await walletCtx.wallet.waitForSyncedState();
  return {
    tNight: (state.unshielded.balances[unshieldedToken().raw] ?? 0n).toString(),
    dust: state.dust.balance(new Date()).toString(),
  };
}

async function readLedger(): Promise<any> {
  const contractState = await providers.publicDataProvider.queryContractState(contractAddress);
  if (!contractState) return null;
  return ledgerFromState(contractState.data);
}

async function ledgerEventById(eventIdHex: string): Promise<any | null> {
  const ledger = await readLedger();
  if (!ledger) return null;
  const eventId = fromHex(eventIdHex);
  if (!ledger.events.member(eventId)) return null;
  const event = ledger.events.lookup(eventId);
  let attendance = 0;
  try {
    attendance = Number(ledger.attendance.lookup(eventId).size().toString());
  } catch {
    // ignore
  }
  return {
    id: eventIdHex,
    name: event.name,
    date: event.date.toString(),
    threshold: event.threshold.toString(),
    organizer: toHex(event.organizer),
    attendance,
    certificateOnChain: Number(ledger.certificates.size().toString()),
  };
}

function attendeesForEvent(eventIdHex: string): any[] {
  const issued = new Map(
    localData.issuedCerts.filter((c) => c.eventId === eventIdHex).map((c) => [c.attendeeId, true]),
  );
  const list = localData.checkins
    .filter((c) => c.eventId === eventIdHex)
    .map((c) => ({
      attendeeId: c.attendeeId,
      checkedInAt: c.at,
      hasCertificate: issued.has(c.attendeeId),
    }));
  return list;
}

// Connect a fresh deployed-contract handle bound to a specific attendee secret.
// This is how the demo performs a check-in "as" a brand-new attendee, and how
// it later issues that attendee's certificate.
function connectAs(privateStateId: string, initialPrivateState?: unknown): Promise<any> {
  const options: any = {
    contractAddress,
    compiledContract: compiledProofPresence as any,
    privateStateId,
  };
  if (initialPrivateState !== undefined) options.initialPrivateState = initialPrivateState;
  return findDeployedContract(providers, options);
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let url: URL;
  try {
    url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  } catch {
    return sendError(res, 400, 'malformed URL');
  }
  const pathname = url.pathname;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (req.method === 'GET' && pathname === '/api/status') {
    const [balance] = await Promise.all([getBalances()]);
    sendJson(res, 200, {
      ok: true,
      network,
      contractAddress,
      walletAddress,
      balance,
      serverTime: Date.now(),
    });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/wallet') {
    const [balance] = await Promise.all([getBalances()]);
    sendJson(res, 200, {
      ok: true,
      walletAddress,
      balance,
      role: 'organizer',
      connected: true,
    });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/ledger') {
    const ledger = await readLedger();
    if (!ledger) return sendError(res, 404, 'no contract state found');
    sendJson(res, 200, { ok: true, ...serializeLedger(ledger) });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/events') {
    const ledger = await readLedger();
    if (!ledger) return sendError(res, 404, 'no contract state found');
    const serialized = serializeLedger(ledger);
    const now = Date.now();
    const events = serialized.events.map((ev: any) => {
      const attendance = Number(ev.attendance);
      const threshold = Number(ev.threshold);
      const insights = toInsights(ev, attendance, threshold, now);
      const meta = localData.events[ev.id];
      return {
        ...ev,
        capacity: meta?.capacity ?? 0,
        createdAt: meta?.createdAt ?? null,
        attendeeCount: localData.checkins.filter((c) => c.eventId === ev.id).length,
        certificateCount: localData.issuedCerts.filter((c) => c.eventId === ev.id).length,
        insights,
      };
    });
    sendJson(res, 200, { ok: true, sequence: serialized.sequence, events, certificates: serialized.certificates });
    return;
  }

  const eventDetailMatch = pathname.match(/^\/api\/events\/([0-9a-f]+)$/i);
  if (req.method === 'GET' && eventDetailMatch) {
    const eventIdHex = eventDetailMatch[1].toLowerCase();
    const ev = await ledgerEventById(eventIdHex);
    if (!ev) return sendError(res, 404, 'event not found');
    const meta = localData.events[eventIdHex];
    const insights = computeInsights(eventIdHex, ev.attendance, Number(ev.threshold), Date.now());
    sendJson(res, 200, {
      ok: true,
      event: {
        ...ev,
        capacity: meta?.capacity ?? 0,
        createdAt: meta?.createdAt ?? null,
        attendees: attendeesForEvent(eventIdHex),
        certificateCount: localData.issuedCerts.filter((c) => c.eventId === eventIdHex).length,
        insights,
      },
    });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/insights') {
    const eventIdHex = String(url.searchParams.get('eventId') ?? '').toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(eventIdHex)) return sendError(res, 400, 'eventId must be a 64-char hex string');
    const ev = await ledgerEventById(eventIdHex);
    if (!ev) return sendError(res, 404, 'event not found');
    sendJson(res, 200, { ok: true, insights: computeInsights(eventIdHex, ev.attendance, Number(ev.threshold), Date.now()) });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/verify') {
    const certIdHex = String(url.searchParams.get('certificateId') ?? '').toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(certIdHex)) return sendError(res, 400, 'certificateId must be a 64-char hex string');
    const ledger = await readLedger();
    if (!ledger) return sendError(res, 404, 'no contract state found');
    const valid = ledger.certificates.member(fromHex(certIdHex));
    sendJson(res, 200, {
      ok: true,
      valid,
      certificateId: certIdHex,
      network,
      contractAddress,
    });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/events') {
    const body = await readJsonBody(req, res);
    if (!body) return;
    const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : null;
    if (!name) return sendError(res, 400, 'name is required');
    const rawThreshold = String(body.threshold ?? '').trim();
    if (!/^\d+$/.test(rawThreshold) || BigInt(rawThreshold) < 1n) {
      return sendError(res, 400, 'threshold must be a positive integer');
    }
    const threshold = BigInt(rawThreshold);
    const rawCapacity = String(body.capacity ?? '0').trim() || '0';
    if (!/^\d+$/.test(rawCapacity)) {
      return sendError(res, 400, 'capacity must be a non-negative integer');
    }
    const capacity = Number(rawCapacity);
    const eventId = randomBytes(32);
    const date = BigInt(Math.floor(Date.now() / 1000)) + 3600n;
    await serialized(() =>
      callTxWithRetry(() => deployed.callTx.createEvent(eventId, name, date, threshold)),
    );
    localData.events[toHex(eventId)] = { capacity, createdAt: Date.now() };
    persistLocal();
    sendJson(res, 200, { ok: true, eventId: toHex(eventId), name, threshold: threshold.toString(), capacity });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/checkin') {
    const body = await readJsonBody(req, res);
    if (!body) return;
    let eventId: Uint8Array;
    try {
      eventId = fromHex(String(body.eventId ?? ''));
    } catch {
      return sendError(res, 400, 'eventId must be hex');
    }
    const eventIdHex = toHex(eventId);
    const ledger = await readLedger();
    if (!ledger?.events?.member?.(eventId)) return sendError(res, 404, 'event not found');

    // Demo-mode: check in as a brand-new pseudonymous attendee.
    const secret = generateIdentitySecret();
    const attendeeId = toHex(pureCircuits().computeAttendeeIdentity(eventId, secret));
    const privateStateId = `attendee-${attendeeId}`;
    const attendeeDeployed = await connectAs(privateStateId, createPrivateState(secret));
    await serialized(() =>
      callTxWithRetry(() => attendeeDeployed.callTx.checkIn(eventId)),
    );

    const record: CheckinRecord = {
      eventId: eventIdHex,
      at: Date.now(),
      attendeeId,
      secret: toHex(secret),
    };
    localData.checkins.push(record);
    persistLocal();

    sendJson(res, 200, {
      ok: true,
      attendeeId,
      eventId: eventIdHex,
      message: 'Checked in with a fresh pseudonymous identity',
    });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/certificate') {
    const body = await readJsonBody(req, res);
    if (!body) return;
    let eventId: Uint8Array;
    try {
      eventId = fromHex(String(body.eventId ?? ''));
    } catch {
      return sendError(res, 400, 'eventId must be hex');
    }
    const eventIdHex = toHex(eventId);

    const ledgerEvent = await ledgerEventById(eventIdHex);
    if (!ledgerEvent) return sendError(res, 404, 'event not found');
    if (ledgerEvent.attendance < ledgerEvent.threshold) {
      return sendError(res, 400, `attendance threshold not met (${ledgerEvent.attendance}/${ledgerEvent.threshold})`);
    }

    const targetAttendees = localData.checkins.filter(
      (c) => c.eventId === eventIdHex && (body.attendeeId ? c.attendeeId === body.attendeeId : true),
    );
    if (targetAttendees.length === 0) {
      return sendError(res, 404, 'no attendees found for this event');
    }

    const issued: { attendeeId: string; certificateId: string }[] = [];
    const skipped: { attendeeId: string; reason: string }[] = [];
    for (const attendee of targetAttendees) {
      try {
        const asAttendee = await connectAs(`attendee-${attendee.attendeeId}`);
        const result: any = await serialized(() =>
          callTxWithRetry(() => asAttendee.callTx.issueCertificate(eventId)),
        );
        const certificateId = toHex(result?.private?.result ?? new Uint8Array(0));
        if (certificateId.length !== 64) {
          skipped.push({ attendeeId: attendee.attendeeId, reason: 'rejected by contract' });
          continue;
        }
        localData.issuedCerts.push({
          eventId: eventIdHex,
          attendeeId: attendee.attendeeId,
          certificateId,
          at: Date.now(),
        });
        issued.push({ attendeeId: attendee.attendeeId, certificateId });
      } catch (err: any) {
        const msg = `${err?.message ?? err}`;
        const reason = msg.includes('threshold not met')
          ? 'attendance threshold not met'
          : msg.includes('already issued')
            ? 'certificate already issued'
            : 'transaction rejected';
        skipped.push({ attendeeId: attendee.attendeeId, reason });
      }
    }
    persistLocal();

    sendJson(res, 200, { ok: true, issued, skipped });
    return;
  }

  // Static frontend
  if (req.method === 'GET') {
    let decoded: string;
    try {
      decoded = decodeURIComponent(pathname);
    } catch {
      return sendError(res, 400, 'malformed URL encoding');
    }
    // Unknown /api/* routes must return JSON 404, not the SPA shell.
    if (decoded.startsWith('/api/')) return sendError(res, 404, `not found: GET ${pathname}`);
    serveStatic(res, decoded);
    return;
  }

  sendError(res, 404, `not found: ${req.method} ${pathname}`);
}

async function main() {
  const deployment = getDeployment(network);
  if (!deployment) {
    console.error(`No deploy on file for network ${network}. Run \`npm run setup\` first.`);
    process.exit(1);
  }
  contractAddress = deployment.address;

  console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
  console.log(`║            ProofPresence — Web Server                        ║`);
  console.log(`╚══════════════════════════════════════════════════════════════╝\n`);
  console.log(`  Network:   ${network}`);
  console.log(`  Contract:  ${contractAddress}`);
  console.log(`\n  Connecting wallet...`);

  walletCtx = await createWallet({ network, networkConfig, seed: SEED });
  await walletCtx.wallet.waitForSyncedState();
  await persistWalletState(network, walletCtx);
  walletAddress = walletCtx.unshieldedKeystore.getBech32Address().toString();

  providers = await createProviders(walletCtx, networkConfig);
  deployed = await findDeployedContract(providers, {
    contractAddress,
    compiledContract: compiledProofPresence as any,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: createPrivateState(generateIdentitySecret()),
  });

  localData = loadLocalData();
  migrateLegacyCertAttendees(localData);
  console.log(`  Local data: ${Object.keys(localData.events).length} event(s), ${localData.checkins.length} check-in(s), ${localData.issuedCerts.length} certificate(s)`);

  const server = createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      if (!res.headersSent) {
        sendError(res, 500, err instanceof Error ? err.message : String(err));
      } else {
        res.end();
      }
    });
  });

  server.listen(PORT, () => {
    console.log(`  ✅ Wallet connected: ${walletAddress}`);
    console.log(`\n  Web UI:  http://127.0.0.1:${PORT}`);
    console.log(`  API:     http://127.0.0.1:${PORT}/api/status\n`);
    console.log('  Press Ctrl+C to stop.\n');
  });

  process.on('SIGINT', async () => {
    console.log('\n  Shutting down...');
    server.close();
    await walletCtx.wallet.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});
