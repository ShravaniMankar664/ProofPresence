/**
 * Local (off-chain) data store for ProofPresence.
 *
 * The Midnight ledger records events, attendance sets and certificates — but
 * the demo needs a few extra pieces of metadata to power the dashboard and AI
 * insights without modifying the contract:
 *
 *   - event capacity / expected attendance (used for attendance-rate)
 *   - check-in timestamps (used for peak check-in time + on-time rate)
 *   - attendee identity secrets (demo-mode simulation: each check-in is
 *     performed with a fresh pseudonymous identity, so we must remember its
 *     secret to later claim a certificate as that attendee)
 *   - certificates issued per event (used for certificate-completion %)
 *
 * All of this stays on the server's disk (`<cwd>/.server-data.json`). None of
 * it is stored on-chain, and none of it reveals the attendee's real identity —
 * only pseudonymous hashes.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

export const LOCAL_DATA_FILE = '.server-data.json';

export interface EventMeta {
  /** Expected / registered attendance. Used to compute attendance rate. */
  capacity: number;
  /** When the organizer created the event (ms epoch). */
  createdAt: number;
}

export interface CheckinRecord {
  /** Hex event id. */
  eventId: string;
  /** When the check-in tx was confirmed (ms epoch). */
  at: number;
  /** Pseudonymous attendee identity (hex) disclosed for this check-in. */
  attendeeId: string;
  /** Identity secret used for this check-in (demo-mode simulation only). */
  secret: string;
}

export interface IssuedCert {
  /** Hex event id. */
  eventId: string;
  /** Pseudonymous attendee identity (hex) the certificate belongs to. */
  attendeeId: string;
  /** On-chain certificate id (hex). */
  certificateId: string;
  /** When the certificate was issued (ms epoch). */
  at: number;
}

export interface LocalData {
  version: 1;
  events: Record<string, EventMeta>;
  checkins: CheckinRecord[];
  issuedCerts: IssuedCert[];
}

export function emptyLocalData(): LocalData {
  return { version: 1, events: {}, checkins: [], issuedCerts: [] };
}

export function localDataPath(cwd?: string): string {
  return path.join(cwd ?? process.cwd(), LOCAL_DATA_FILE);
}

export function loadLocalData(cwd?: string): LocalData {
  const file = localDataPath(cwd);
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<LocalData>;
    return {
      version: 1,
      events: raw.events ?? {},
      checkins: raw.checkins ?? [],
      issuedCerts: raw.issuedCerts ?? [],
    };
  } catch {
    return emptyLocalData();
  }
}

export function saveLocalData(data: LocalData, cwd?: string): void {
  const file = localDataPath(cwd);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
