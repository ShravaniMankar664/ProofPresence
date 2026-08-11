import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Event = { name: string;
                      date: bigint;
                      threshold: bigint;
                      organizer: Uint8Array
                    };

export type Witnesses<PS> = {
  identitySecret(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
}

export type ImpureCircuits<PS> = {
  createEvent(context: __compactRuntime.CircuitContext<PS>,
              eventId_0: Uint8Array,
              name_0: string,
              date_0: bigint,
              threshold_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  checkIn(context: __compactRuntime.CircuitContext<PS>, eventId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  issueCertificate(context: __compactRuntime.CircuitContext<PS>,
                   eventId_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
}

export type ProvableCircuits<PS> = {
  createEvent(context: __compactRuntime.CircuitContext<PS>,
              eventId_0: Uint8Array,
              name_0: string,
              date_0: bigint,
              threshold_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  checkIn(context: __compactRuntime.CircuitContext<PS>, eventId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  issueCertificate(context: __compactRuntime.CircuitContext<PS>,
                   eventId_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
}

export type PureCircuits = {
  computeAttendeeIdentity(eventId_0: Uint8Array, secret_0: Uint8Array): Uint8Array;
}

export type Circuits<PS> = {
  computeAttendeeIdentity(context: __compactRuntime.CircuitContext<PS>,
                          eventId_0: Uint8Array,
                          secret_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  createEvent(context: __compactRuntime.CircuitContext<PS>,
              eventId_0: Uint8Array,
              name_0: string,
              date_0: bigint,
              threshold_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  checkIn(context: __compactRuntime.CircuitContext<PS>, eventId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  issueCertificate(context: __compactRuntime.CircuitContext<PS>,
                   eventId_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
}

export type Ledger = {
  events: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Event;
    [Symbol.iterator](): Iterator<[Uint8Array, Event]>
  };
  attendance: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): {
      isEmpty(): boolean;
      size(): bigint;
      member(elem_0: Uint8Array): boolean;
      [Symbol.iterator](): Iterator<Uint8Array>
    }
  };
  certificates: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  readonly sequence: bigint;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
