import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * getCmaSendFloorBySlug reads the three ways a CMA belongs to an expired
 * listing (the caller's prospect, an expired row by cma_id, an expired row by
 * the CMA's MLS listing key) and fails closed with `unreadable` on a read error.
 */

type Row = Record<string, unknown> | null
const db = vi.hoisted(() => ({
  cma: null as Record<string, unknown> | null,
  cmaError: null as { message: string } | null,
  byCmaId: [] as Array<Record<string, unknown>>,
  byListingKey: [] as Array<Record<string, unknown>>,
  expiredError: null as { message: string } | null,
  listingKeyReads: 0,
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from(table: string) {
      const filters: Record<string, unknown> = {}
      const q = {
        select: () => q,
        eq(col: string, val: unknown) {
          filters[col] = val
          return q
        },
        maybeSingle: async () => ({ data: db.cma as Row, error: db.cmaError }),
        limit: async () => {
          if (table !== 'expired_listings') return { data: [], error: null }
          if (db.expiredError) return { data: null, error: db.expiredError }
          if ('listing_key' in filters) {
            db.listingKeyReads++
            return { data: db.byListingKey, error: null }
          }
          return { data: db.byCmaId, error: null }
        },
      }
      return q
    },
  }),
}))

import { getCmaSendFloorBySlug } from './send-floor'

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key')
  db.cma = {
    id: 'c1',
    request_source: 'expired-listing-cron',
    doc_type: 'cma',
    recommended_list: 618_000,
    build_summary: null,
    subject_listing_key: 'LK1',
  }
  db.cmaError = null
  db.byCmaId = [{ list_price: 849_000, original_list_price: 899_000 }]
  db.byListingKey = []
  db.expiredError = null
  db.listingKeyReads = 0
})

describe('getCmaSendFloorBySlug', () => {
  it('holds an expired CMA under the line, reading the expired row by cma_id', async () => {
    const r = await getCmaSendFloorBySlug('cma-3759-45th-redmond-97756')
    expect(r.held).toBe(true)
    expect(r.reason).toContain('$849,000')
    expect(r.unreadable).toBeUndefined()
  })

  it('lets an expired CMA at or above the line through', async () => {
    db.cma = { ...db.cma, recommended_list: 800_000 }
    expect((await getCmaSendFloorBySlug('x')).held).toBe(false)
  })

  it('finds a broker-built version for an expired address by its MLS listing key', async () => {
    db.cma = { ...db.cma, request_source: 'contact-card' }
    db.byCmaId = []
    db.byListingKey = [{ list_price: 849_000 }]
    const r = await getCmaSendFloorBySlug('cma-3759-45th--v2')
    expect(db.listingKeyReads).toBe(1)
    expect(r.held).toBe(true)
  })

  it('does not treat a valuation the owner asked for as cold outreach by listing key alone', async () => {
    db.cma = { ...db.cma, request_source: 'seller-home-value' }
    db.byCmaId = []
    db.byListingKey = [{ list_price: 849_000 }]
    const r = await getCmaSendFloorBySlug('cma-asked')
    expect(db.listingKeyReads).toBe(0)
    expect(r.held).toBe(false)
  })

  it("uses the caller's prospect: an expired intro holds any version at that owner's list price", async () => {
    db.cma = { ...db.cma, request_source: 'seller-home-value', recommended_list: 700_000 }
    db.byCmaId = []
    const r = await getCmaSendFloorBySlug('cma-any', { prospectKind: 'expired', lastListPrice: 1_000_000 })
    expect(r.held).toBe(true)
    expect(r.reason).toContain('$1,000,000')
  })

  it('never holds a CMA with no expired link and no expired origin', async () => {
    db.cma = { ...db.cma, request_source: 'seller-home-value', subject_listing_key: null }
    db.byCmaId = []
    expect((await getCmaSendFloorBySlug('cma-valuation')).held).toBe(false)
  })

  it('fails closed and says so when a read errors', async () => {
    db.cmaError = { message: 'timeout' }
    const r = await getCmaSendFloorBySlug('x')
    expect(r).toMatchObject({ held: true, unreadable: true })
    db.cmaError = null
    db.expiredError = { message: 'timeout' }
    expect(await getCmaSendFloorBySlug('x')).toMatchObject({ held: true, unreadable: true })
  })
})
