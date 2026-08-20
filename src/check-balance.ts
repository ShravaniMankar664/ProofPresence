/**
 * Check Preprod wallet balance.
 */

import { WebSocket } from 'ws';
import { firstValueFrom } from 'rxjs';
import { filter } from 'rxjs/operators';

import {
  resolveNetwork,
  getOrCreateWallet,
  formatWalletBackupNotice,
} from './network';

import {
  createWallet,
  persistWalletState,
  unshieldedToken,
} from './wallet';

// @ts-expect-error Required by the Midnight wallet SDK
globalThis.WebSocket = WebSocket;

const { network, config: networkConfig } = resolveNetwork();

const WALLET = getOrCreateWallet(network);
const SEED = WALLET.seed;

const notice = formatWalletBackupNotice(WALLET, network);

if (notice) {
  console.log(notice);
}

async function main() {
  console.log('');
  console.log('============================================================');
  console.log('                 Wallet Balance Checker');
  console.log('============================================================');
  console.log('');

  let walletCtx:
    Awaited<ReturnType<typeof createWallet>> | undefined;

  let progressTimer: ReturnType<typeof setInterval> | undefined;

  try {
    console.log('Building wallet...');

    walletCtx = await createWallet({
      network,
      networkConfig,
      seed: SEED,
      restore: false,
    });

    console.log('Wallet created.');

    const address =
      walletCtx.unshieldedKeystore.getBech32Address().toString();

    console.log('');
    console.log('Address:');
    console.log(address);

    console.log('');
    console.log('Network:');
    console.log(networkConfig.networkId);

    console.log('');
    console.log('Waiting for Preprod unshielded wallet sync...');
    console.log('This can take a few minutes.');
    console.log('');

    const syncStart = Date.now();

    progressTimer = setInterval(async () => {
      try {
        const facadeState = await firstValueFrom(
          walletCtx!.wallet.state(),
        );

        const progress = facadeState.unshielded.progress;

        const elapsed = Math.round(
          (Date.now() - syncStart) / 1000,
        );

        process.stdout.write(
          `\r  ${elapsed}s | connected=${progress.isConnected} | ` +
          `applied=${progress.appliedId} | ` +
          `highest=${progress.highestTransactionId}   `,
        );
      } catch {
        // Ignore temporary progress-read errors.
      }
    }, 5000);

    const state = await firstValueFrom(
      walletCtx.wallet.state().pipe(
        filter(
          (s) =>
            s.unshielded.progress.isConnected &&
            s.unshielded.progress.appliedId >= 566002n,
        ),
      ),
    );

    if (progressTimer) {
      clearInterval(progressTimer);
      progressTimer = undefined;
    }

    process.stdout.write('\n');

    const token = unshieldedToken().raw;

    const tNightBalance =
      state.unshielded.balances[token] ?? 0n;

    console.log('');
    console.log('============================================================');
    console.log('                       SYNC COMPLETE');
    console.log('============================================================');

    console.log('');
    console.log('Wallet address:');
    console.log(address);

    console.log('');
    console.log('Unshielded progress:');

    console.log(
      JSON.stringify(
        state.unshielded.progress,
        (_, value) =>
          typeof value === 'bigint'
            ? value.toString()
            : value,
        2,
      ),
    );

    console.log('');
    console.log('tNight balance:');
    console.log(tNightBalance.toString());

    console.log('');
    console.log('tNight balance in tNight units:');
    console.log(
      Number(tNightBalance) / 1_000_000_000,
    );

    if (tNightBalance > 0n) {
      console.log('');
      console.log('SUCCESS: Wallet is funded.');
    } else {
      console.log('');
      console.log('WARNING: Wallet balance is 0.');
    }

    console.log('');
    console.log('Saving wallet state...');

    await persistWalletState(
      network,
      walletCtx,
    );

    console.log('Wallet state saved.');
  } catch (error) {
    console.error('');
    console.error('ERROR:');

    console.error(
      error instanceof Error
        ? error.message
        : error,
    );

    process.exitCode = 1;
  } finally {
    if (progressTimer) {
      clearInterval(progressTimer);
    }

    if (walletCtx) {
      console.log('');
      console.log('Stopping wallet...');

      try {
        await walletCtx.wallet.stop();
      } catch (stopError) {
        console.error(
          'Wallet stop warning:',
          stopError instanceof Error
            ? stopError.message
            : stopError,
        );
      }
    }

    console.log('DONE.');
  }
}

main();
