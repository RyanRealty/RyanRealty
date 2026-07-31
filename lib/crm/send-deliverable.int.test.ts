/**
 * REAL-DB proof that the deliverable-send chokepoint's at-most-once store is
 * the live A5 ledger (`public.crm_idempotency_keys`), not a unit-test fiction.
 *
 * The unit test (`send-deliverable.test.ts`) pins the POLICY against an
 * in-memory ledger. This one runs the SAME policy against the real table, with
 * the real `withSendIdempotency`, and proves the three properties a broker's
 * money depends on:
 *
 *   1. A row actually lands under scope 'deliverable' with the namespaced key.
 *   2. A double-tap (same key) dispatches ONCE — the second call replays.
 *   3. A FAILED send RELEASES the key, so a deliberate retry re-sends instead of
 *      silently reporting a success that never left.
 *
 * Nothing is emailed: the dispatch is a counter. Auth is stubbed (vitest has no
 * request cookies); `personExists` is the REAL live read against crm_people, so
 * the not_found refusal is proven against production data.
 *
 * Skips without DB creds. Self-cleaning: every key it writes is deleted.
 */
import { afterAll, describe, expect, it } from 'vitest'
import { config } from 'dotenv'
import { INT_MARKER, intId } from '@/test/int-scope'

config({ path: '.env.local' })

const HAVE_DB = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL)
const run = HAVE_DB ? describe : describe.skip

const STAMP = intId('deliverable')
const KEY_PREFIX = `deliverable:%${INT_MARKER}%`

run('deliverable chokepoint — live A5 ledger (crm_idempotency_keys)', () => {
  let sb: import('@supabase/supabase-js').SupabaseClient

  afterAll(async () => {
    if (!sb) return
    await sb.from('crm_idempotency_keys').delete().like('key', KEY_PREFIX)
  })

  it('claims under scope "deliverable", dispatches once on a double-tap, and releases on failure', async () => {
    const { createServiceClient } = await import('@/lib/supabase/service')
    const { withSendIdempotency } = await import('@/lib/crm/idempotency')
    const { runSendDeliverable, deliverableIdempotencyKey, DELIVERABLE_IDEMPOTENCY_SCOPE } = await import(
      './send-deliverable'
    )
    const { DELIVERABLE_KINDS } = await import('./send-deliverable')
    sb = createServiceClient()

    // A real contact id, read live — the chokepoint's existence guard is a real
    // query, not a stub.
    const { data: realPerson } = await sb
      .from('crm_people')
      .select('id')
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle()
    const realPersonId = Number(realPerson?.id)
    expect(Number.isFinite(realPersonId) && realPersonId > 0).toBe(true)

    let dispatched = 0
    let failNext = false
    const makeDeps = () => {
      const dispatch = {} as Parameters<typeof runSendDeliverable>[1]['dispatch']
      for (const k of DELIVERABLE_KINDS) {
        dispatch[k] = async () => {
          dispatched += 1
          return failNext ? { ok: false, error: 'Email send failed: probe' } : { ok: true }
        }
      }
      return {
        requireAccess: async () => ({ ok: true as const, access: { probe: true } }),
        requireScope: async () => ({ ok: true as const }),
        personExists: async (personId: number) => {
          const { data } = await sb.from('crm_people').select('id').eq('id', personId).maybeSingle()
          return Boolean(data)
        },
        withIdempotency: withSendIdempotency,
        dispatch,
      }
    }

    // ── 1. a contact that does not exist never reaches a send rail ──────────
    const ghost = await runSendDeliverable(
      { personId: 2147483000, kind: 'cma', ref: 'x', idempotencyKey: `${STAMP}-ghost` },
      makeDeps(),
    )
    expect(ghost).toMatchObject({ ok: false, errorKind: 'not_found' })
    expect(dispatched).toBe(0)

    // ── 2. a real send claims the live ledger and dispatches exactly once ───
    const key = `${STAMP}-a`
    const input = { personId: realPersonId, kind: 'cma' as const, ref: 'probe-slug', idempotencyKey: key }
    const first = await runSendDeliverable(input, makeDeps())
    expect(first.ok).toBe(true)
    expect(dispatched).toBe(1)

    const ledgerKey = deliverableIdempotencyKey('cma', realPersonId, key)
    const { data: row } = await sb
      .from('crm_idempotency_keys')
      .select('key,scope,result')
      .eq('key', ledgerKey)
      .maybeSingle()
    expect(row?.scope).toBe(DELIVERABLE_IDEMPOTENCY_SCOPE)
    expect((row?.result as { ok?: boolean } | null)?.ok).toBe(true)

    // ── 3. the double-tap replays the stored result, no second send ─────────
    const replay = await runSendDeliverable(input, makeDeps())
    expect(replay.ok).toBe(true)
    expect(dispatched).toBe(1)

    // ── 4. a FAILED send releases the key so a real retry re-sends ──────────
    const failKey = `${STAMP}-b`
    const failInput = { ...input, idempotencyKey: failKey }
    failNext = true
    const failed = await runSendDeliverable(failInput, makeDeps())
    expect(failed.ok).toBe(false)
    expect(dispatched).toBe(2)
    const { data: released } = await sb
      .from('crm_idempotency_keys')
      .select('key')
      .eq('key', deliverableIdempotencyKey('cma', realPersonId, failKey))
      .maybeSingle()
    expect(released).toBeNull()

    failNext = false
    const retried = await runSendDeliverable(failInput, makeDeps())
    expect(retried.ok).toBe(true)
    expect(dispatched).toBe(3)
  }, 60_000)
})
