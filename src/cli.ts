/**
 * Interactive CLI for ProofPresence.
 *
 * Connect to the deployed contract and:
 *   1. Create an event
 *   2. Check in to an event
 *   3. Issue a certificate for an event (requires threshold attendance)
 *   4. View the on-chain ledger state
 *   5. Check wallet balance
 */
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { randomBytes } from 'node:crypto';
import { WebSocket } from 'ws';
import { Buffer } from 'buffer';

import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { resolveNetwork, getOrCreateWallet, formatWalletBackupNotice, getDeployment } from './network';
import { createWallet, persistWalletState, unshieldedToken } from './wallet';
import {
  compiledProofPresence,
  PRIVATE_STATE_ID,
  createPrivateState,
  generateIdentitySecret,
  ledgerFromState,
} from './contract';
import { createProviders } from './providers';

// @ts-expect-error Required for wallet sync
globalThis.WebSocket = WebSocket;

const { network, config: networkConfig } = resolveNetwork();
const WALLET = getOrCreateWallet(network);
const SEED = WALLET.seed;
{
  const notice = formatWalletBackupNotice(WALLET, network);
  if (notice) console.log(notice);
}

function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

function shortHex(bytes: Uint8Array): string {
  return `${toHex(bytes).slice(0, 16)}…`;
}

async function readLedger(publicDataProvider: any, contractAddress: string): Promise<any> {
  const contractState = await publicDataProvider.queryContractState(contractAddress);
  if (!contractState) return null;
  return ledgerFromState(contractState.data);
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║            ProofPresence — CLI                              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const rl = createInterface({ input: stdin, output: stdout });

  const deployment = getDeployment(network);
  if (!deployment) {
    console.error(`No deploy on file for network ${network}. Run \`npm run setup -- --network ${network}\` first.`);
    process.exit(1);
  }
  console.log(`  Contract: ${deployment.address}`);
  console.log(`  Network:  ${network}\n`);

  try {
    const walletCtx = await createWallet({ network, networkConfig, seed: SEED });
    const restoredCount = Object.values(walletCtx.restored).filter(Boolean).length;
    if (restoredCount > 0) {
      console.log(`  Restored ${restoredCount}/3 child wallets from .midnight-wallet-state — sync will resume from saved point.`);
    }

    console.log('  Syncing with network...');
    const syncStart = Date.now();
    const syncInterval = setInterval(() => {
      const elapsed = Math.round((Date.now() - syncStart) / 1000);
      process.stdout.write(`\r  ⏳ Still syncing... (${elapsed}s elapsed)   `);
    }, 5000);
    const state = await walletCtx.wallet.waitForSyncedState();
    clearInterval(syncInterval);
    process.stdout.write('\r  ✓ Synced with network.                                      \n');

    await persistWalletState(network, walletCtx);
    const balance = state.unshielded.balances[unshieldedToken().raw] ?? 0n;
    console.log(`  Balance: ${balance.toLocaleString()} tNight\n`);

    const providers = await createProviders(walletCtx, networkConfig);

    // Reconnect with the same private state so repeated CLI runs keep the same
    // identity secret (and thus the same pseudonymous identity).
    const deployed: any = await findDeployedContract(providers, {
      contractAddress: deployment.address,
      compiledContract: compiledProofPresence as any,
      privateStateId: PRIVATE_STATE_ID,
      initialPrivateState: createPrivateState(generateIdentitySecret()),
    });
    console.log('  ✅ Connected!\n');

    let running = true;
    while (running) {
      console.log('─── Menu ───────────────────────────────────────────────────────');
      console.log('  1. Create an event');
      console.log('  2. Check in to an event');
      console.log('  3. Issue a certificate');
      console.log('  4. View ledger state');
      console.log('  5. Check wallet balance');
      console.log('  6. Exit\n');

      const choice = await rl.question('  Your choice: ');

      switch (choice.trim()) {
        case '1': {
          const name = await rl.question('  Event name: ');
          const thresholdRaw = await rl.question('  Attendance threshold: ');
          const threshold = BigInt(thresholdRaw.trim() || '1');
          const eventId = randomBytes(32);
          const date = BigInt(Math.floor(Date.now() / 1000)) + 3600n;
          console.log('\n  Submitting createEvent (this may take 30-60 seconds)...');
          try {
            await deployed.callTx.createEvent(eventId, name, date, threshold);
            console.log(`\n  ✅ Event created: "${name}"`);
            console.log(`  Event ID: ${toHex(eventId)}\n`);
          } catch (error) {
            console.error('\n  ❌ Failed:', error instanceof Error ? error.message : error);
          }
          break;
        }

        case '2': {
          const raw = await rl.question('  Event ID (hex): ');
          const eventId = Buffer.from(raw.trim(), 'hex');
          console.log('\n  Submitting checkIn (this may take 30-60 seconds)...');
          try {
            await deployed.callTx.checkIn(eventId);
            console.log('\n  ✅ Checked in!\n');
          } catch (error) {
            console.error('\n  ❌ Failed:', error instanceof Error ? error.message : error);
          }
          break;
        }

        case '3': {
          const raw = await rl.question('  Event ID (hex): ');
          const eventId = Buffer.from(raw.trim(), 'hex');
          console.log('\n  Submitting issueCertificate (this may take 30-60 seconds)...');
          try {
            await deployed.callTx.issueCertificate(eventId);
            console.log('\n  ✅ Certificate issued!\n');
          } catch (error) {
            console.error('\n  ❌ Failed:', error instanceof Error ? error.message : error);
          }
          break;
        }

        case '4': {
          console.log('\n  Reading ledger state from the indexer...');
          const ledger = await readLedger(providers.publicDataProvider, deployment.address);
          if (!ledger) {
            console.log('  ⚠ No contract state found.\n');
            break;
          }
          const sequence = ledger.sequence ?? 0n;
          console.log(`\n  Sequence: ${sequence}`);

          console.log('\n  Events:');
          if (ledger.events.isEmpty()) {
            console.log('    (none)');
          } else {
            for (const [id, event] of ledger.events) {
              let attendanceSize = '0';
              try {
                attendanceSize = ledger.attendance.lookup(id).size().toString();
              } catch {
                // attendance entry not yet visible to this state snapshot
              }
              console.log(`    • ${event.name}  (threshold ${event.threshold}, ${attendanceSize} attendee${attendanceSize === '1' ? '' : 's'})`);
              console.log(`        id:        ${toHex(id)}`);
              console.log(`        date:      ${new Date(Number(event.date) * 1000).toISOString()}`);
              console.log(`        organizer: ${shortHex(event.organizer)}`);
            }
          }

          console.log('\n  Certificates:');
          if (ledger.certificates.isEmpty()) {
            console.log('    (none)');
          } else {
            for (const cert of ledger.certificates) {
              console.log(`    • ${shortHex(cert)}`);
            }
          }
          console.log('');
          break;
        }

        case '5': {
          console.log('\n  Checking balance...');
          const currentState = await walletCtx.wallet.waitForSyncedState();
          const currentBalance = currentState.unshielded.balances[unshieldedToken().raw] ?? 0n;
          const dustBalance = currentState.dust.balance(new Date());
          console.log(`\n  tNight: ${currentBalance.toLocaleString()}`);
          console.log(`  DUST:   ${dustBalance.toLocaleString()}\n`);
          break;
        }

        case '6':
          running = false;
          console.log('\n  👋 Goodbye!\n');
          break;

        default:
          console.log('\n  ❌ Invalid choice. Please enter 1-6.\n');
      }
    }

    await persistWalletState(network, walletCtx);
    await walletCtx.wallet.stop();
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
  } finally {
    rl.close();
  }
}

main().catch(console.error);
