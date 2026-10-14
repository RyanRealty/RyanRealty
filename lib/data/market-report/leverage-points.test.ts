/**
 * getSaleLeveragePoints: the buyer-ad map points must count exactly what the
 * mr-v1 series counts (price_cut_n, concession_with_n, closed_n), page past
 * PostgREST's 1,000-row cap, and never carry a listing key or address out.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Answer = { data: unknown; error: { message: string } | null }
type Call = { table: string; ops: [string, unknown[]][] }

let calls: Call[] = []
let saleRows: Record<string, unknown>[] = []
let factRows: Record<string, unknown>[] = []
let failTable: string | null = null

/** A chainable PostgREST stand-in that records every builder call and answers per table. */
function builder(table: string) {
  const call: Call = { table, ops: [] }
  calls.push(call)
  const answer = (): Answer => {
    if (failTable === table) return { data: null, error: { message: 'canceling statement due to statement timeout' } }
    if (table === 'market_report_state') {
      return { data: { complete_through: '2026-10-12', facts_refreshed_at: '2026-10-13T11:19:18Z' }, error: null }
    }
    if (table === 'market_report_sale') {
      const range = call.ops.find(([op]) => op === 'range')?.[1] as [number, number]
      return { data: saleRows.slice(range[0], range[1] + 1), error: null }
    }
    if (table === 'market_fact_sale') {
      const keys = (call.ops.find(([op]) => op === 'in')?.[1][1] ?? []) as string[]
      return { data: factRows.filter((r) => keys.includes(String(r.listing_key))), error: null }
    }
    return { data: null, error: { message: `unexpected table ${table}` } }
  }
  const q: Record<string, unknown> = {}
  for (const op of ['select', 'gte', 'lte', 'contains', 'eq', 'in', 'order', 'range', 'maybeSingle']) {
    q[op] = (...args: unknown[]) => {
      call.ops.push([op, args])
      return q
    }
  }
  q.then = (resolve: (a: Answer) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(answer()).then(resolve, reject)
  return q
}

vi.mock('@/lib/data/client', () => ({ createServiceClient: () => ({ from: (t: string) => builder(t) }) }))
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))

const mod = await import('./leverage-points')
const { getSaleLeveragePoints, isPriceCut, isSellerCredit, reportSegmentsOf, usableCoordinates } = mod

const BEND_Q3 = { geoType: 'city', geoSlug: 'bend', segment: 'detached', from: '2026-07-01', to: '2026-09-30' } as const

function sale(key: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    listing_key: key,
    close_date: '2026-08-14',
    list_price: 700_000,
    original_list_price: 700_000,
    sale_to_orig_list: 0.98,
    exclusion_reasons: [],
    concessions_yn: 'No',
    concession_amount: null,
    base_segment: 'detached',
    lot_acres: 0.2,
    ...over,
  }
}

function row(over: Record<string, unknown> = {}) {
  return {
    listing_key: 'k',
    close_date: '2026-08-14',
    list_price: 700_000,
    original_list_price: 725_000,
    sale_to_orig_list: 0.95,
    exclusion_reasons: [] as string[],
    concessions_yn: 'Yes' as string | null,
    concession_amount: 10_000 as number | null,
    base_segment: 'detached',
    lot_acres: 0.2 as number | null,
    ...over,
  }
}

beforeEach(() => {
  calls = []
  saleRows = []
  factRows = []
  failTable = null
})

describe('definitions (compute_market_report_period, mr-v1)', () => {
  it('price cut: original ask above the final ask, both positive, sale-to-original set, not an auction', () => {
    expect(isPriceCut(row())).toBe(true)
    expect(isPriceCut(row({ original_list_price: 700_000 }))).toBe(false)
    expect(isPriceCut(row({ original_list_price: 690_000 }))).toBe(false)
    expect(isPriceCut(row({ sale_to_orig_list: null }))).toBe(false)
    expect(isPriceCut(row({ list_price: 0 }))).toBe(false)
    expect(isPriceCut(row({ original_list_price: null }))).toBe(false)
    expect(isPriceCut(row({ exclusion_reasons: ['auction_list'] }))).toBe(false)
    expect(isPriceCut(row({ exclusion_reasons: ['retroactive_entry'] }))).toBe(true)
    expect(isPriceCut(row({ close_date: '2001-12-31' }))).toBe(false)
  })

  it('credit: concessions reported Yes with an amount above zero', () => {
    expect(isSellerCredit(row())).toBe(true)
    expect(isSellerCredit(row({ concessions_yn: 'No' }))).toBe(false)
    expect(isSellerCredit(row({ concessions_yn: null }))).toBe(false)
    expect(isSellerCredit(row({ concession_amount: 0 }))).toBe(false)
    expect(isSellerCredit(row({ concession_amount: null }))).toBe(false)
    expect(isSellerCredit(row({ close_date: '2012-12-31' }))).toBe(false)
  })

  it('segments: detached is sfr + acreage split at one acre, null lot as zero', () => {
    expect(reportSegmentsOf('detached', 0.99)).toEqual(['sfr', 'detached'])
    expect(reportSegmentsOf('detached', 1)).toEqual(['acreage', 'detached'])
    expect(reportSegmentsOf('detached', null)).toEqual(['sfr', 'detached'])
    expect(reportSegmentsOf('condo', 0)).toEqual(['condo_townhome'])
    expect(reportSegmentsOf('townhome', 5)).toEqual(['condo_townhome'])
  })

  it('coordinates: finite, in range, and not a zero placeholder', () => {
    expect(usableCoordinates(44.05, -121.31)).toBe(true)
    expect(usableCoordinates(null, -121.31)).toBe(false)
    expect(usableCoordinates(44.05, 0)).toBe(false)
    expect(usableCoordinates(0, 0)).toBe(false)
    expect(usableCoordinates(Number.NaN, -121.31)).toBe(false)
    expect(usableCoordinates(95, -121.31)).toBe(false)
  })
})

describe('getSaleLeveragePoints', () => {
  it('reads the report population with the series filters', async () => {
    saleRows = [sale('a')]
    factRows = [{ listing_key: 'a', latitude: 44.05, longitude: -121.31 }]
    await getSaleLeveragePoints(BEND_Q3)
    const saleCall = calls.find((c) => c.table === 'market_report_sale')!
    expect(saleCall.ops).toEqual(
      expect.arrayContaining([
        ['gte', ['close_date', '2026-07-01']],
        ['lte', ['close_date', '2026-09-30']],
        ['contains', ['geos', ['city:bend']]],
        ['eq', ['base_segment', 'detached']],
        ['order', ['listing_key']],
      ]),
    )
    const selected = String(saleCall.ops.find(([op]) => op === 'select')![1][0])
    expect(selected).not.toContain('*')
    expect(selected).not.toMatch(/address|street|name|remarks/i)
    const factSelect = String(calls.find((c) => c.table === 'market_fact_sale')!.ops.find(([op]) => op === 'select')![1][0])
    expect(factSelect).toBe('listing_key, latitude, longitude')
  })

  it('pages past 1,000 rows until a short page, and looks coordinates up in chunks', async () => {
    saleRows = Array.from({ length: 2345 }, (_, i) => sale(`k${String(i).padStart(5, '0')}`))
    factRows = saleRows.map((r) => ({ listing_key: r.listing_key, latitude: 44.05, longitude: -121.31 }))
    const out = await getSaleLeveragePoints(BEND_Q3)
    const ranges = calls.filter((c) => c.table === 'market_report_sale').map((c) => c.ops.find(([op]) => op === 'range')![1])
    expect(ranges).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ])
    expect(out.counts.closed).toBe(2345)
    expect(out.points).toHaveLength(2345)
    const chunks = calls.filter((c) => c.table === 'market_fact_sale').map((c) => (c.ops.find(([op]) => op === 'in')![1][1] as string[]).length)
    expect(Math.max(...chunks)).toBeLessThanOrEqual(150)
    expect(chunks.reduce((a, b) => a + b, 0)).toBe(2345)
  })

  it('counts every closing, flags each point, and leaves unmapped sales off the map but in the counts', async () => {
    saleRows = [
      sale('a', { original_list_price: 750_000, close_date: '2026-07-03' }), // cut only
      sale('b', { concessions_yn: 'Yes', concession_amount: 8_000, close_date: '2026-08-20' }), // credit only
      sale('c', { original_list_price: 760_000, concessions_yn: 'Yes', concession_amount: 5_000, close_date: '2026-09-02' }), // both
      sale('d', { close_date: '2026-07-15' }), // neither
      sale('e', { original_list_price: 740_000, concessions_yn: 'Yes', concession_amount: 3_000, close_date: '2026-08-01' }), // both, no coordinates
      sale('f', { concessions_yn: 'Yes', concession_amount: 0 }), // Yes with no amount: not a credit
      sale('g', { lot_acres: 2.5, original_list_price: 900_000, list_price: 850_000 }), // acreage still counts in detached
    ]
    factRows = [
      { listing_key: 'a', latitude: 44.06, longitude: -121.3 },
      { listing_key: 'b', latitude: 44.04, longitude: -121.32 },
      { listing_key: 'c', latitude: 44.07, longitude: -121.28 },
      { listing_key: 'd', latitude: 44.1, longitude: -121.35 },
      { listing_key: 'e', latitude: null, longitude: null },
      { listing_key: 'f', latitude: 44.02, longitude: -121.33 },
      { listing_key: 'g', latitude: 44.0, longitude: -121.25 },
    ]
    const out = await getSaleLeveragePoints(BEND_Q3)
    expect(out.counts).toEqual({ closed: 7, priceCut: 4, credit: 3, both: 2, missingCoords: 1 })
    expect(out.points).toHaveLength(6)
    expect(out.points.length + out.counts.missingCoords).toBe(out.counts.closed)
    expect(out.unmapped).toEqual([{ priceCut: true, credit: true, closeMonth: '2026-08' }])
    // Close-date order; the first is the 2026-07-03 cut.
    expect(out.points[0]).toEqual({ lat: 44.06, lng: -121.3, priceCut: true, credit: false, closeMonth: '2026-07' })
    expect(out.points.filter((p) => p.priceCut && p.credit)).toHaveLength(1)
    expect(out.completeThrough).toBe('2026-10-12')
    expect(out.source).toContain('market_report_sale')
    expect(out.source).toContain('geos contains city:bend')
    expect(out.source).toContain('close_date 2026-07-01..2026-09-30')
    expect(out.source).toContain('n=7 (cut 4, credit 3, both 2, unmapped 1)')
    expect(out.source).toMatch(/fetched_at \d{4}-\d{2}-\d{2}T/)
  })

  it('sfr and acreage split the detached rows by lot size; condo_townhome reads condo and townhome', async () => {
    saleRows = [sale('a', { lot_acres: 0.3 }), sale('b', { lot_acres: 1.0 }), sale('c', { lot_acres: null })]
    factRows = saleRows.map((r) => ({ listing_key: r.listing_key, latitude: 44.05, longitude: -121.31 }))
    expect((await getSaleLeveragePoints({ ...BEND_Q3, segment: 'sfr' })).counts.closed).toBe(2)
    expect((await getSaleLeveragePoints({ ...BEND_Q3, segment: 'acreage' })).counts.closed).toBe(1)
    calls = []
    saleRows = []
    await getSaleLeveragePoints({ ...BEND_Q3, segment: 'condo_townhome' })
    const ops = calls.find((c) => c.table === 'market_report_sale')!.ops
    expect(ops).toContainEqual(['in', ['base_segment', ['condo', 'townhome']]])
  })

  it('returns no listing key, address or name in the output', async () => {
    saleRows = [
      sale('20260519000545412967000000', { original_list_price: 750_000, StreetName: 'Leaked', UnparsedAddress: '1 Leaked St' }),
      sale('20260601000000000000000001', { concessions_yn: 'Yes', concession_amount: 4_000 }),
    ]
    factRows = [{ listing_key: '20260519000545412967000000', latitude: 44.05, longitude: -121.31 }]
    const out = await getSaleLeveragePoints(BEND_Q3)
    for (const p of out.points) expect(Object.keys(p).sort()).toEqual(['closeMonth', 'credit', 'lat', 'lng', 'priceCut'])
    for (const u of out.unmapped) expect(Object.keys(u).sort()).toEqual(['closeMonth', 'credit', 'priceCut'])
    const text = JSON.stringify(out)
    expect(text).not.toContain('20260519000545412967000000')
    expect(text).not.toContain('20260601000000000000000001')
    expect(text).not.toMatch(/Leaked/)
  })

  it('throws on a failed read instead of returning an empty map', async () => {
    saleRows = [sale('a')]
    failTable = 'market_report_sale'
    await expect(getSaleLeveragePoints(BEND_Q3)).rejects.toThrow(/read failed twice/)
    failTable = 'market_fact_sale'
    await expect(getSaleLeveragePoints(BEND_Q3)).rejects.toThrow(/read failed twice/)
  })

  it('refuses a malformed request before reading anything', async () => {
    await expect(getSaleLeveragePoints({ ...BEND_Q3, from: '2026-7-1' })).rejects.toThrow(/YYYY-MM-DD/)
    await expect(getSaleLeveragePoints({ ...BEND_Q3, from: '2026-10-01' })).rejects.toThrow(/after/)
    await expect(getSaleLeveragePoints({ ...BEND_Q3, geoSlug: 'bend,redmond' })).rejects.toThrow(/geoSlug/)
    // @ts-expect-error an unknown segment
    await expect(getSaleLeveragePoints({ ...BEND_Q3, segment: 'land' })).rejects.toThrow(/segment/)
    expect(calls).toHaveLength(0)
  })
})
