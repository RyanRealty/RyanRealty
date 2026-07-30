import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * ADVERSARIAL audit of the two-tier unsubscribe shipped in deed9e4b
 * (lib/data/leads/listingAlerts.ts deactivateListingAlertByToken), driven by
 * an in-memory stand-in for the supabase service client so the real DAL logic
 * runs unmodified.
 *
 * Contract under test:
 *   - PRIMARY token (unsubscribe_token column) deactivates the WHOLE alert.
 *   - HOUSEHOLD token (an entry in recipients jsonb) removes ONLY that
 *     recipient; the alert stays active for everyone else.
 */

type AlertRow = {
  id: string
  unsubscribe_token: string
  is_active: boolean
  recipients: Array<{ email: string; unsubscribe_token?: string | null }> | null
  updated_at?: string
}

const db: { rows: AlertRow[]; containsShouldError: boolean } = { rows: [], containsShouldError: false }

function makeBuilder(table: string) {
  const state: {
    patch: Record<string, unknown> | null
    eqs: Array<[string, unknown]>
    containsToken: string | null
    limit: number | null
  } = { patch: null, eqs: [], containsToken: null, limit: null }

  const run = () => {
    if (table !== 'listing_alerts') return { data: [], error: null }
    if (state.containsToken !== null && db.containsShouldError) {
      return { data: null, error: { message: 'column "recipients" does not exist' } }
    }
    let matched = db.rows.filter((r) =>
      state.eqs.every(([col, val]) => (r as unknown as Record<string, unknown>)[col] === val),
    )
    if (state.containsToken !== null) {
      const token = state.containsToken
      matched = matched.filter((r) => (r.recipients ?? []).some((e) => e?.unsubscribe_token === token))
    }
    if (state.limit != null) matched = matched.slice(0, state.limit)
    if (state.patch) for (const row of matched) Object.assign(row, state.patch)
    return {
      data: matched.map((r) => ({ id: r.id, recipients: r.recipients })),
      error: null,
    }
  }

  const builder: Record<string | symbol, unknown> = {}
  builder.update = (patch: Record<string, unknown>) => { state.patch = patch; return proxy }
  builder.select = () => proxy
  builder.eq = (col: string, val: unknown) => { state.eqs.push([col, val]); return proxy }
  builder.contains = (_col: string, json: string) => {
    const parsed = JSON.parse(json) as Array<{ unsubscribe_token?: string }>
    state.containsToken = parsed[0]?.unsubscribe_token ?? null
    return proxy
  }
  builder.limit = (n: number) => { state.limit = n; return proxy }

  const proxy: unknown = new Proxy(builder, {
    get(t, p) {
      if (p === 'then') return (res: (v: unknown) => void) => res(run())
      return t[p]
    },
  })
  return proxy
}

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: (table: string) => makeBuilder(table) }),
}))

import { deactivateListingAlertByToken } from '@/lib/data/leads/listingAlerts'

function seed(): void {
  db.containsShouldError = false
  db.rows = [
    {
      id: 'alert-1',
      unsubscribe_token: 'tok-primary',
      is_active: true,
      recipients: [
        { email: 'jim@example.com', unsubscribe_token: 'tok-jim' },
        { email: 'lisa@example.com', unsubscribe_token: 'tok-lisa' },
      ],
    },
    {
      id: 'alert-2',
      unsubscribe_token: 'tok-other',
      is_active: true,
      recipients: null,
    },
  ]
}

beforeEach(seed)

describe('H4 unsubscribe token tiers', () => {
  it('the PRIMARY token deactivates that alert only, leaving recipients intact', async () => {
    const res = await deactivateListingAlertByToken('tok-primary')
    expect(res).toEqual({ ok: true, matched: true })
    expect(db.rows[0].is_active).toBe(false)
    expect(db.rows[0].recipients).toHaveLength(2)
    expect(db.rows[1].is_active).toBe(true)
  })

  it('a HOUSEHOLD token removes only that recipient and never deactivates the alert', async () => {
    const res = await deactivateListingAlertByToken('tok-jim')
    expect(res).toEqual({ ok: true, matched: true })
    expect(db.rows[0].is_active).toBe(true)
    expect(db.rows[0].recipients).toEqual([{ email: 'lisa@example.com', unsubscribe_token: 'tok-lisa' }])
  })

  it('the primary token STILL works after a household recipient opts out', async () => {
    await deactivateListingAlertByToken('tok-jim')
    const res = await deactivateListingAlertByToken('tok-primary')
    expect(res.matched).toBe(true)
    expect(db.rows[0].is_active).toBe(false)
  })

  it('removing the last household recipient nulls the array, not the alert', async () => {
    await deactivateListingAlertByToken('tok-jim')
    await deactivateListingAlertByToken('tok-lisa')
    expect(db.rows[0].recipients).toBe(null)
    expect(db.rows[0].is_active).toBe(true)
  })

  it('an unknown token is a clean no-op (no alert deactivated)', async () => {
    const res = await deactivateListingAlertByToken('tok-nope')
    expect(res).toEqual({ ok: true, matched: false })
    expect(db.rows.every((r) => r.is_active)).toBe(true)
  })

  it('an empty/whitespace token never deactivates anything', async () => {
    for (const t of ['', '   ', null as unknown as string, undefined as unknown as string]) {
      const res = await deactivateListingAlertByToken(t)
      expect(res.matched).toBe(false)
    }
    expect(db.rows.every((r) => r.is_active)).toBe(true)
  })

  it('FAIL-SOFT GAP: a recipients-column read error reports matched=false, so a real household opt-out is silently dropped', async () => {
    db.containsShouldError = true
    const res = await deactivateListingAlertByToken('tok-jim')
    // The engine keeps emailing Jim, and the page shows a benign
    // "already unsubscribed" style outcome instead of an error.
    expect(res).toEqual({ ok: true, matched: false })
    expect(db.rows[0].recipients).toHaveLength(2)
  })
})
