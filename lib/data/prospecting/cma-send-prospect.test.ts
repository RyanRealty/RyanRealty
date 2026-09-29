import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * resolveProspectForCmaSend: which owner's row does a CMA send belong to.
 * The build's cma_id link first, then the MLS subject_listing_key for a second
 * CMA on the same house, and a THROW (never a quiet null) when a read fails,
 * because the send rail refuses on "could not tell".
 */

type Call = { table: string; select: string; filters: Record<string, unknown> }
type Reply = { data: unknown; error: { message: string } | null }

const h = vi.hoisted(() => ({
  calls: [] as Array<{ table: string; select: string; filters: Record<string, unknown> }>,
  reply: null as null | ((c: { table: string; select: string; filters: Record<string, unknown> }) => { data: unknown; error: { message: string } | null }),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from(table: string) {
      const call: Call = { table, select: '', filters: {} }
      const q = {
        select(cols: string) {
          call.select = cols
          return q
        },
        eq(col: string, val: unknown) {
          call.filters[col] = val
          return q
        },
        limit() {
          return q
        },
        maybeSingle() {
          h.calls.push(call)
          return Promise.resolve(h.reply!(call))
        },
      }
      return q
    },
  }),
}))

import { resolveProspectForCmaSend } from '@/lib/data/prospecting/cma-send-prospect'

const CMA = { id: 'cma-uuid-1', subject_listing_key: 'LK-2026-0001' }
const ok = (data: unknown): Reply => ({ data, error: null })
const fail = (message: string): Reply => ({ data: null, error: { message } })

/** A scripted database: the CMA row, and which prospect lookups find a row. */
function db(opts: {
  cma?: unknown
  expiredByCmaId?: string | null
  fsboByCmaId?: string | null
  expiredByKey?: string | null
  failOn?: string
}) {
  h.reply = (c) => {
    if (opts.failOn === c.table + ':' + Object.keys(c.filters).join(',')) return fail('connection reset')
    if (c.table === 'cmas') return ok(opts.cma === undefined ? CMA : opts.cma)
    if (c.table === 'expired_listings' && 'cma_id' in c.filters) {
      return ok(opts.expiredByCmaId ? { listing_key: opts.expiredByCmaId } : null)
    }
    if (c.table === 'fsbo_listings' && 'cma_id' in c.filters) {
      return ok(opts.fsboByCmaId ? { fsbo_url: opts.fsboByCmaId } : null)
    }
    if (c.table === 'expired_listings' && 'listing_key' in c.filters) {
      return ok(opts.expiredByKey ? { listing_key: opts.expiredByKey } : null)
    }
    throw new Error(`unscripted read: ${c.table} ${JSON.stringify(c.filters)}`)
  }
}

beforeEach(() => {
  h.calls.length = 0
  h.reply = null
})

describe('resolveProspectForCmaSend', () => {
  it('finds the expired owner by the build cma_id link, and stops there', async () => {
    db({ expiredByCmaId: 'LK-2026-0001' })
    await expect(resolveProspectForCmaSend('cma-1-main')).resolves.toEqual({
      kind: 'expired',
      id: 'LK-2026-0001',
      via: 'cma_id',
    })
    expect(h.calls.map((c) => c.table)).toEqual(['cmas', 'expired_listings'])
    expect(h.calls[0]!.filters).toEqual({ slug: 'cma-1-main' })
    expect(h.calls[1]!.filters).toEqual({ cma_id: 'cma-uuid-1' })
  })

  it('finds an FSBO owner by the cma_id link when no expired row is linked', async () => {
    db({ fsboByCmaId: 'https://fsbo.example.com/listing/7' })
    await expect(resolveProspectForCmaSend('cma-7-oak')).resolves.toEqual({
      kind: 'fsbo',
      id: 'https://fsbo.example.com/listing/7',
      via: 'cma_id',
    })
    expect(h.calls.map((c) => c.table)).toEqual(['cmas', 'expired_listings', 'fsbo_listings'])
  })

  it('resolves an orphan second CMA through subject_listing_key to the same expired owner', async () => {
    // Not the row the prospect points at (no cma_id link), same house by MLS key.
    db({ expiredByKey: 'LK-2026-0001' })
    await expect(resolveProspectForCmaSend('cma-1-main--v2')).resolves.toEqual({
      kind: 'expired',
      id: 'LK-2026-0001',
      via: 'listing_key',
    })
    const last = h.calls[h.calls.length - 1]!
    expect(last.table).toBe('expired_listings')
    expect(last.filters).toEqual({ listing_key: 'LK-2026-0001' })
  })

  it('prefers the cma_id link and does not run the listing-key lookup when the link hits', async () => {
    db({ expiredByCmaId: 'LK-LINKED', expiredByKey: 'LK-OTHER' })
    const got = await resolveProspectForCmaSend('cma-1-main')
    expect(got).toMatchObject({ id: 'LK-LINKED', via: 'cma_id' })
    expect(h.calls.some((c) => 'listing_key' in c.filters)).toBe(false)
  })

  it('returns null when nothing links and the MLS key matches no expired row', async () => {
    db({})
    await expect(resolveProspectForCmaSend('cma-1-main')).resolves.toBeNull()
    expect(h.calls.map((c) => c.table)).toEqual(['cmas', 'expired_listings', 'fsbo_listings', 'expired_listings'])
  })

  it.each([null, '', '   '])('does not run the listing-key lookup when subject_listing_key is %j', async (key) => {
    db({ cma: { id: 'cma-uuid-1', subject_listing_key: key } })
    await expect(resolveProspectForCmaSend('cma-1-main')).resolves.toBeNull()
    expect(h.calls.some((c) => 'listing_key' in c.filters)).toBe(false)
  })

  it('returns null, and reads nothing else, when the CMA row does not exist', async () => {
    db({ cma: null })
    await expect(resolveProspectForCmaSend('cma-nope')).resolves.toBeNull()
    expect(h.calls.map((c) => c.table)).toEqual(['cmas'])
  })

  it.each([
    ['cmas:slug', /cmas read failed: connection reset/],
    ['expired_listings:cma_id', /expired_listings cma_id read failed: connection reset/],
    ['fsbo_listings:cma_id', /fsbo_listings cma_id read failed: connection reset/],
    ['expired_listings:listing_key', /expired_listings listing_key read failed: connection reset/],
  ])('throws, not null, when the %s read fails', async (failOn, message) => {
    db({ failOn })
    await expect(resolveProspectForCmaSend('cma-1-main')).rejects.toThrow(message)
  })
})
