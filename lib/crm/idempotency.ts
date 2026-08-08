import 'server-only'
import { createHash } from 'node:crypto'
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
 * sending again.
 *
 * NOTE (group sends): the CRM SMS path wraps the WHOLE group/broadcast send under one
 * key (`sms:${personId}:${key}`) and reports ok when at least one recipient succeeds.
 * Per-recipient idempotency (so a partial-failure retry re-drives only the failed
 * members, instead of re-texting everyone) is NOT yet implemented — tracked for the
 * messaging rebuild (spec 02). Until then, a broker retrying a partially-failed group
 * text re-sends to all members; the composer's disabled-button guard makes an
 * accidental retry unlikely, but it is not idempotent per-recipient.
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
 *
 * FAIL-OPEN on ledger errors. The idempotency table is a BACKSTOP (the composer's
 * disabled Send button is the primary double-send guard). If the ledger is briefly
 * unavailable — a transient Supabase error, a statement timeout, a pooler blip — we
 * run the send anyway. Returning a fabricated `{ok:true}` on a DB error would tell
 * the broker "sent" while nothing left (a silent no-send) — far worse than the tiny
 * double-send window the ledger was only ever hedging. Only a CONFIRMED concurrent
 * claim (a row that actually exists with result IS NULL, or a PK unique-violation
 * race) returns `onInFlight`.
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
  if (existing.error) return run() // ledger unreadable → fail open, send.
  if (existing.data && existing.data.result != null) {
    return existing.data.result as T
  }
  if (existing.data) {
    // Row exists with a NULL result → a sibling is genuinely mid-send.
    return args.onInFlight
  }

  const claim = await sb
    .from('crm_idempotency_keys')
    .insert({ key: args.key, scope: args.scope, result: null })
  if (claim.error) {
    // Only a PK unique-violation means a sibling won the claim race. Any OTHER
    // insert error is a ledger failure → fail open and send (never a fake success).
    if (claim.error.code !== '23505') return run()
    const reread = await sb
      .from('crm_idempotency_keys')
      .select('result')
      .eq('key', args.key)
      .maybeSingle()
    if (reread.error) return run() // can't confirm the sibling → fail open.
    if (reread.data && reread.data.result != null) return reread.data.result as T
    return args.onInFlight // sibling confirmed in flight (row exists, NULL result).
  }

  // We own the key — run exactly once.
  let result: T
  try {
    result = await run()
  } catch (e) {
    await sb.from('crm_idempotency_keys').delete().eq('key', args.key)
    throw e
  }
  if (result.ok) {
    await sb.from('crm_idempotency_keys').update({ result: result as never }).eq('key', args.key)
  } else {
    // Failed send — release the key so the broker's retry actually re-sends.
    await sb.from('crm_idempotency_keys').delete().eq('key', args.key)
  }
  return result
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

/**
 * A deterministic idempotency key derived from the send ITSELF, for callers that
 * did not receive one from the client.
 *
 * Why this exists: SmsComposer renders its `idempotencyKey` field blank on SSR
 * and first paint — a value there would be a hydration mismatch — and fills it
 * in an effect after mount. A submit landing before hydration therefore carried
 * '', and the send action's `if (!idempotencyKey)` branch skipped the ledger
 * entirely and reached the provider unguarded. Server-action forms post without
 * JS, so that window is reachable, and on this path a duplicate is a second real
 * text to a client (and, with 2+ recipients, a second carrier GROUP thread).
 *
 * `bucketMs` decides what "the same send" means, and the default is DELIBERATELY
 * SHORT. Without a client token you cannot distinguish "one intent submitted
 * twice" from "two intentional identical sends", so every heuristic trades one
 * error for the other — and the two errors are not symmetric here. On a ledger
 * hit withSendIdempotency REPLAYS the stored result, so a false collapse
 * silently swallows a real message the broker believes was sent; a false miss
 * merely delivers a visible duplicate. The short window keeps the failure on the
 * visible side.
 *
 * TWO LIMITS, both accepted and neither hidden:
 *   1. BOUNDARY STRADDLE. Buckets are wall-clock, so two submits a moment apart
 *      can land either side of an edge and produce different keys. A sub-second
 *      double-tap therefore still sends twice roughly (gap / bucketMs) of the
 *      time. Pinned by test rather than left as a surprise.
 *   2. It only fires when the client sent no key at all. The composer's own
 *      per-attempt key remains the primary defence and has neither limit.
 *
 * Content-addressed, so two genuinely different messages never collide
 * regardless of timing — that half is exact, and the tests pin each field.
 */
export function deriveFallbackSendKey(parts: Array<string | number>, bucketMs = 10_000): string {
  const bucket = Math.floor(Date.now() / bucketMs)
  const digest = createHash('sha256')
    .update([...parts, bucket].join('\u0000'))
    .digest('hex')
    .slice(0, 32)
  return `auto:${digest}`
}
