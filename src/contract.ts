/**
 * Compiled ProofPresence contract wiring.
 *
 * Loads the artifacts produced by `compact compile` and wires the single
 * contract witness (`identitySecret`) which feeds the ZK circuits that derive
 * pseudonymous attendee/organizer identities.
 */
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import type { WitnessContext } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';

/**
 * Private state stored only on the caller's machine. The identity secret is
 * used by the contract's `identitySecret` witness to derive pseudonymous
 * identities — it never leaves this machine and is never stored on-chain.
 */
export interface PrivateState {
  readonly identitySecret: Uint8Array;
}

export function createPrivateState(identitySecret: Uint8Array): PrivateState {
  return { identitySecret };
}

export function generateIdentitySecret(): Uint8Array {
  return randomBytes(32);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const CONTRACT_NAME = 'proofpresence';
export const PRIVATE_STATE_ID = 'proofPresencePrivateState';
export const ZK_CONFIG_PATH = path.resolve(__dirname, '..', 'contracts', 'managed', 'proofpresence');

const contractModule = await import(pathToFileURL(path.join(ZK_CONFIG_PATH, 'contract', 'index.js')).href);

/**
 * Witness implementations for the compiled contract. Each witness receives a
 * WitnessContext with the caller's private state and must return the updated
 * private state together with the witness value.
 */
export const witnesses = {
  identitySecret: ({
    privateState,
  }: WitnessContext<never, PrivateState>): [PrivateState, Uint8Array] => [
    privateState,
    privateState.identitySecret,
  ],
};

export const compiledProofPresence = (
  CompiledContract.make(CONTRACT_NAME, (contractModule as any).Contract) as any
).pipe(
  (CompiledContract.withWitnesses as any)(witnesses),
  (CompiledContract.withCompiledFileAssets as any)(ZK_CONFIG_PATH),
) as any;

/** Decode raw on-chain contract state into the typed ledger object. */
export function ledgerFromState(state: unknown): any {
  return (contractModule as any).ledger(state);
}

/** Access the contract's pure (proof-free) circuits, e.g. computeAttendeeIdentity. */
export function pureCircuits(): { computeAttendeeIdentity(eventId: Uint8Array, secret: Uint8Array): Uint8Array } {
  return (contractModule as any).pureCircuits;
}

export { contractModule };
