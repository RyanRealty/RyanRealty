import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * The ONE at-most-once helper over crm_idempotency_keys (admin rebuild Foundation
 * §A5). Backs every mutation that must not double-fire: message sends, deliverable
 * sends, and People writes. Kills the RC2 double-send at the data layer — the
 * optimistic client (disabled button) is the first line; this is the backstop that
 * makes a genuine concurrent double-tap safe.
 *
 * Two-phase claim so a real race is safe:
 *   1. Atomically claim the key (INSERT). The winner runs `run`, then stores the
 *      result. A later call by the same key returns the stored result as a no-op.
 *   2. If the claim loses the INSERT race and no result is stored yet, the sibling
 *      call is still in flight → throw IdempotencyInFlightError rather than run a
 *      second time (the double-send we are preventing).
 *
 * Retry uses the SAME key, so a retried send returns the original result instead of
 * sending again. Group sends key per-recipient (`{messageId}:{address}`) so a
 * partial-failure retry only re-drives the recipients that actually failed.
 */

export class IdempotencyInFlightError extends Error {
  constructor(key: string) {
    super(`A mutation with key ${key} is already in progress.`)
    this.name = 'IdempotencyInFlightError'
  }
}

/**
 * Result-aware variant for SEND paths (SMS/email/deliverables) whose result is a
 * `{ ok: boolean }` union. Semantics tuned for messaging:
 *   - A duplicate submit of a SUCCESSFUL send returns the stored success (no
 *     re-send) — the RC2 double-send guard.
 *   - A FAILED send RELEASES the key, so a legitimate retry (same key) re-attempts
 *     rather than replaying the failure.
 *   - A duplicate that lands while the first is still in flight returns the
 *     `onInFlight` value (default a success-shaped no-op) so the caller never
 *     double-fires.
 */
export async function withSendIdempotency<T extends { ok: boolean }>(
  args: { key: string; scope: string; onInFlight: T },
  run: () => Promise<T>,
): Promise<T> {
  const sb = createServiceClient()

  const existing = await sb
    .from('crm_idempotency_keys')
    .select('result')
    .eq('key', args.key)
    .maybeSingle()
  if (existing.data && existing.data.result != null) {
    return existing.data.result as T
  }

  if (!existing.data) {
    const claim = await sb
      .from('crm_idempotency_keys')
      .insert({ key: args.key, scope: args.scope, result: null })
    if (!claim.error) {
      let result: T
      try {
        result = await run()
      } catch (e) {
        // Release so a retry can re-attempt, then surface the error.
        await sb.from('crm_idempotency_keys').delete().eq('key', args.key)
        throw e
      }
      if (result.ok) {
        await sb
          .from('crm_idempotency_keys')
          .update({ result: result as never })
          .eq('key', args.key)
      } else {
        // Failed send — release the key so the broker's retry actually re-sends.
        await sb.from('crm_idempotency_keys').delete().eq('key', args.key)
      }
      return result
    }
  }

  // Row exists with null result, or we lost the claim race → a sibling is mid-send.
  const reread = await sb
    .from('crm_idempotency_keys')
    .select('result')
    .eq('key', args.key)
    .maybeSingle()
  if (reread.data && reread.data.result != null) {
    return reread.data.result as T
  }
  return args.onInFlight
}

export async function withIdempotency<T>(
  args: { key: string; scope: string },
  run: () => Promise<T>,
): Promise<T> {
  const sb = createServiceClient()

  // Fast path: already completed.
  const existing = await sb
    .from('crm_idempotency_keys')
    .select('result')
    .eq('key', args.key)
    .maybeSingle()
  if (existing.data && existing.data.result != null) {
    return existing.data.result as T
  }

  if (!existing.data) {
    // Claim the key. On a lost race the unique PK violation lands us in the branch
    // below (someone else claimed it first).
    const claim = await sb
      .from('crm_idempotency_keys')
      .insert({ key: args.key, scope: args.scope, result: null })
    if (!claim.error) {
      // We own the key — run once, then record the result for future replays.
      const result = await run()
      await sb
        .from('crm_idempotency_keys')
        .update({ result: (result ?? null) as never })
        .eq('key', args.key)
      return result
    }
  }

  // Either the row existed with a null result, or our claim lost the race: a
  // sibling call is mid-flight. Re-read once in case it just finished.
  const reread = await sb
    .from('crm_idempotency_keys')
    .select('result')
    .eq('key', args.key)
    .maybeSingle()
  if (reread.data && reread.data.result != null) {
    return reread.data.result as T
  }
  throw new IdempotencyInFlightError(args.key)
}
