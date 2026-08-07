/**
 * End-to-end test for ProofPresence.
 *
 * Flow:
 *   1. reconnect to the deployed contract,
 *   2. create an event,
 *   3. check in,
 *   4. issue a certificate,
 *   5. verify on-chain ledger state (event registered, attendee identity in the
 *      attendance set, certificate recorded),
 *   6. verify the threshold guard rejects issuing a certificate when attendance
 *      is below the threshold.
 *
 * Exits 0 on success, 1 on failure. Used by `npm run test` / `npm run test:e2e`.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { WebSocket } from 'ws';

import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { resolveNetwork, getOrCreateWallet, formatWalletBackupNotice, getDeployment } from '../src/network';
import { createWallet, persistWalletState } from '../src/wallet';
import {
  compiledProofPresence,
  PRIVATE_STATE_ID,
  createPrivateState,
  generateIdentitySecret,
  pureCircuits,
  ledgerFromState,
} from '../src/contract';
import { createProviders } from '../src/providers';

// @ts-expect-error wallet sync requires WebSocket
globalThis.WebSocket = WebSocket;

// Unique private-state id so this test always derives identities from its own
// freshly-generated secret (independent of the deploy-time private state).
const E2E_PRIVATE_STATE_ID = `${PRIVATE_STATE_ID}-e2e`;

const { network, config: networkConfig } = resolveNetwork();
const WALLET = getOrCreateWallet(network);
const SEED = WALLET.seed;
{
  const notice = formatWalletBackupNotice(WALLET, network);
  if (notice) console.log(notice);
}

function fail(msg: string): never {
  console.error(`\n❌ e2e-check failed: ${msg}`);
  process.exit(1);
}

function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

async function callTxWithRetry(
  call: () => Promise<any>,
  label: string,
  maxRetries = 5,
  delayMs = 6000,
): Promise<any> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await call();
    } catch (err: any) {
      const msg = `${err?.message ?? err} ${err?.cause?.message ?? ''}`;
      const transient =
        msg.includes('Not enough Dust') || msg.includes('Insufficient Funds') || msg.includes('could not balance dust');
      if (!transient || attempt === maxRetries) {
        throw new Error(`${label} failed: ${msg}`);
      }
      console.log(`    ⏳ DUST still settling, retrying (${attempt}/${maxRetries})...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error('unreachable');
}

async function readLedger(publicDataProvider: any, contractAddress: string): Promise<any> {
  const contractState = await publicDataProvider.queryContractState(contractAddress);
  if (!contractState) fail(`queryContractState returned null for ${contractAddress}`);
  return ledgerFromState(contractState.data);
}

async function main() {
  const deployment = getDeployment(network);
  if (!deployment) {
    console.error(`\nNo deploy on file for network ${network}. Run \`npm run setup\` first.`);
    process.exit(1);
  }

  const zkConfigPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'contracts', 'managed', 'proofpresence');
  const contractPath = path.join(zkConfigPath, 'contract', 'index.js');
  if (!fs.existsSync(contractPath)) fail('Compiled contract missing — run `npm run compile`.');

  console.log(`\nProofPresence e2e-check on ${network}`);
  console.log(`  contract: ${deployment.address}\n`);

  console.log('─── Connecting wallet ──────────────────────────────────────────\n');
  const walletCtx = await createWallet({ network, networkConfig, seed: SEED });
  await walletCtx.wallet.waitForSyncedState();
  await persistWalletState(network, walletCtx);

  const providers = await createProviders(walletCtx, networkConfig);

  // Reconnect to the deployed contract with our own private state.
  const e2eSecret = generateIdentitySecret();
  const deployed: any = await findDeployedContract(providers, {
    contractAddress: deployment.address,
    compiledContract: compiledProofPresence as any,
    privateStateId: E2E_PRIVATE_STATE_ID,
    initialPrivateState: createPrivateState(e2eSecret),
  });

  const eventId = randomBytes(32);
  const eventName = `Hackathon Demo ${Date.now()}`;
  const threshold = 1n;
  const date = BigInt(Math.floor(Date.now() / 1000)) + 3600n;

  console.log('─── createEvent ───────────────────────────────────────────────\n');
  console.log(`  eventId:  ${toHex(eventId).slice(0, 32)}...`);
  console.log(`  name:     ${eventName}`);
  console.log(`  threshold: ${threshold}`);
  await callTxWithRetry(
    () => deployed.callTx.createEvent(eventId, eventName, date, threshold),
    'createEvent',
  );
  console.log('  ✅ Event created.\n');

  console.log('─── checkIn ───────────────────────────────────────────────────\n');
  await callTxWithRetry(() => deployed.callTx.checkIn(eventId), 'checkIn');
  console.log('  ✅ Checked in.\n');

  console.log('─── issueCertificate ──────────────────────────────────────────\n');
  const ledgerPreCert = await readLedger(providers.publicDataProvider, deployment.address);
  const certsBefore = ledgerPreCert.certificates.size();
  await callTxWithRetry(() => deployed.callTx.issueCertificate(eventId), 'issueCertificate');
  console.log('  ✅ Certificate issued.\n');

  console.log('─── Verifying on-chain state ──────────────────────────────────\n');
  const ledger = await readLedger(providers.publicDataProvider, deployment.address);

  if (!ledger.events.member(eventId)) fail('event not registered on-chain');
  console.log('  ✅ events.member(eventId) === true');

  const event = ledger.events.lookup(eventId);
  if (event.name !== eventName) fail(`event name mismatch: ${event.name}`);
  console.log(`  ✅ event name recorded: ${event.name}`);

  const identity = pureCircuits().computeAttendeeIdentity(eventId, e2eSecret);
  if (!ledger.attendance.lookup(eventId).member(identity)) fail('attendee identity not in attendance set');
  console.log('  ✅ attendance set contains attendee identity');

  const attendanceSize = ledger.attendance.lookup(eventId).size();
  console.log(`  ✅ attendance size === ${attendanceSize} (threshold ${threshold} met)`);

  const certsAfter = ledger.certificates.size();
  if (certsAfter !== certsBefore + 1n) fail(`certificates.size did not grow (${certsBefore} → ${certsAfter})`);
  console.log('  ✅ certificates set grew by exactly 1');

  console.log('\n─── Threshold guard (negative case) ───────────────────────────\n');
  const event2Id = randomBytes(32);
  const event2Name = `Guard Event ${Date.now()}`;
  await callTxWithRetry(
    () => deployed.callTx.createEvent(event2Id, event2Name, date, 5n),
    'createEvent(guard)',
  );
  await callTxWithRetry(() => deployed.callTx.checkIn(event2Id), 'checkIn(guard)');

  let guardRejected = false;
  try {
    await callTxWithRetry(() => deployed.callTx.issueCertificate(event2Id), 'issueCertificate(guard)');
  } catch (err: any) {
    guardRejected = /Attendance threshold not met/.test(`${err?.message ?? ''}`);
  }
  if (!guardRejected) fail('expected issueCertificate to be rejected (threshold not met)');
  console.log('  ✅ issueCertificate correctly rejected below threshold');

  await walletCtx.wallet.stop();
  console.log('\n✅ e2e-check passed\n');
  process.exit(0);
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
