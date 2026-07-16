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
