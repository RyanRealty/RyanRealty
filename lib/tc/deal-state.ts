/**
 * Envelope state machine — the legally load-bearing lifecycle, made explicit.
 *
 * Today the envelope FSM lives implicitly inside `seal-envelope.ts` (advanceOrSeal),
 * and the only guard against a double-seal is a read-then-write status check with
 * no lock (the C2 race in the TC architecture review). This module codifies the
 * transitions so illegal moves (e.g. completed -> partially_signed, or sealing a
 * voided envelope) are impossible to express, and provides ONE atomic primitive —
 * `claimTransition` — that closes the race: a compare-and-swap `UPDATE ... WHERE
 * status IN (from)` returns true for exactly one concurrent caller.
 *
 * Status vocabulary is owned by lib/tc/signing.ts (EnvelopeStatus / the
 * tc_envelopes.status CHECK). A future `sealing` claim state (Phase 2 of the
 * review) is added there + in the DB CHECK together; this table updates with it.
 */
import type { EnvelopeStatus } from './signing'
import { ENVELOPE_STATUSES } from './signing'

/** Allowed envelope transitions. Terminal states (completed, voided) have none. */
const ENVELOPE_TRANSITIONS: Record<EnvelopeStatus, readonly EnvelopeStatus[]> = {
  draft: ['sent', 'voided'],
  sent: ['partially_signed', 'completed', 'voided'],
  partially_signed: ['partially_signed', 'completed', 'voided'],
  completed: [], // terminal — a sealed, executed envelope never moves again
  voided: [], // terminal
}

export function canTransition(from: EnvelopeStatus, to: EnvelopeStatus): boolean {
  return ENVELOPE_TRANSITIONS[from]?.includes(to) ?? false
}

export class IllegalEnvelopeTransitionError extends Error {
  constructor(
    readonly from: EnvelopeStatus,
    readonly to: EnvelopeStatus,
  ) {
    super(`Illegal envelope transition: ${from} -> ${to}`)
    this.name = 'IllegalEnvelopeTransitionError'
  }
}

export function assertEnvelopeTransition(from: EnvelopeStatus, to: EnvelopeStatus): void {
  if (!canTransition(from, to)) throw new IllegalEnvelopeTransitionError(from, to)
}

/** Is `s` a terminal envelope status (no further transitions)? */
export function isTerminalEnvelopeStatus(s: EnvelopeStatus): boolean {
  return (ENVELOPE_TRANSITIONS[s]?.length ?? 0) === 0
}

/** A minimal slice of the Supabase client — just enough to run the CAS update. */
export interface CasClient {
  from: (table: string) => {
    update: (patch: Record<string, unknown>) => {
      eq: (col: string, val: string) => {
        in: (col: string, vals: readonly string[]) => {
          select: (cols: string) => Promise<{ data: unknown[] | null; error: { message: string } | null }>
        }
      }
    }
  }
}

/**
 * Atomically claim an envelope status transition (compare-and-swap).
 *
 * `UPDATE tc_envelopes SET status = to WHERE id = id AND status IN (from)`.
 * Postgres applies the row lock during the UPDATE, so of N concurrent callers
 * exactly ONE moves the row out of a `from` state — that caller gets `true`, the
 * losers get `false` (zero rows). This is the single primitive that closes the
 * double-seal race (C2): only one final signer can claim sent/partially_signed
 * -> the seal. Validates the transition shape first so a caller can't request an
 * illegal move.
 *
 * Returns true iff THIS caller won the transition.
 */
export async function claimTransition(
  supabase: CasClient,
  envelopeId: string,
  from: readonly EnvelopeStatus[],
  to: EnvelopeStatus,
): Promise<boolean> {
  for (const f of from) assertEnvelopeTransition(f, to)
  const { data, error } = await supabase
    .from('tc_envelopes')
    .update({ status: to })
    .eq('id', envelopeId)
    .in('status', from)
    .select('id')
  if (error) throw new Error(`claimTransition failed: ${error.message}`)
  return (data?.length ?? 0) === 1
}

/** Re-export for callers that want the canonical status list. */
export { ENVELOPE_STATUSES }
