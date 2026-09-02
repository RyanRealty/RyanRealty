import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The sweep branch. A county that publishes no edit date cannot be asked what
 * changed, so this job's only useful act is to notice when its whole-layer
 * sweep has gone stale — and to be loud about it, because a parcel layer that
 * quietly stops updating still draws lines, just wrong ones.
 */

const ORIGINAL = { ...process.env }

function ledgerFetch(rows: unknown[]) {
  return vi.fn(async (input: unknown) => {
    const url = String(input)
    if (url.includes('taxlot_refreshes')) {
      return new Response(JSON.stringify(rows), { status: 200 })
    }
    throw new Error(`unexpected fetch: ${url}`)
  })
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString()
}

describe('refreshTaxlots on a county with no edit stamp', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
  })
  afterEach(() => {
    process.env = { ...ORIGINAL }
    vi.unstubAllGlobals()
  })

  it('reports a recent sweep as ok and never calls the county', async () => {
    const fetchMock = ledgerFetch([{ ran_at: daysAgo(3) }])
    vi.stubGlobal('fetch', fetchMock)
    const { refreshTaxlots } = await import('./refresh')

    const r = await refreshTaxlots('klamath')
    expect(r.ok).toBe(true)
    expect(r.mode).toBe('sweep')
    expect(r.sweptDaysAgo).toBe(3)
    expect(r.written).toBe(0)
    // Exactly one call, to our own ledger. No ArcGIS request at all.
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]![0])).toContain('taxlot_refreshes')
  })

  it('FAILS once the sweep is past its limit, and names the command that fixes it', async () => {
    vi.stubGlobal('fetch', ledgerFetch([{ ran_at: daysAgo(75) }]))
    const { refreshTaxlots } = await import('./refresh')

    const r = await refreshTaxlots('klamath')
    expect(r.ok).toBe(false)
    expect(r.sweptDaysAgo).toBe(75)
    expect(r.note).toContain('75 days ago')
    expect(r.note).toContain('import-taxlots.mjs --county klamath --write')
  })

  it('FAILS when a county has never been swept at all', async () => {
    vi.stubGlobal('fetch', ledgerFetch([]))
    const { refreshTaxlots } = await import('./refresh')

    const r = await refreshTaxlots('josephine')
    expect(r.ok).toBe(false)
    expect(r.sweptDaysAgo).toBeNull()
    expect(r.note).toContain('never been swept')
  })

  it('says what Jackson actually covers, because it is not the county', async () => {
    vi.stubGlobal('fetch', ledgerFetch([{ ran_at: daysAgo(1) }]))
    const { refreshTaxlots } = await import('./refresh')

    const r = await refreshTaxlots('jackson')
    expect(r.ok).toBe(true)
    expect(r.note).toContain('City of Medford only')
  })

  it('only counts a CLEAN full sweep — a partial run is not a sweep', async () => {
    const fetchMock = ledgerFetch([{ ran_at: daysAgo(2) }])
    vi.stubGlobal('fetch', fetchMock)
    const { refreshTaxlots } = await import('./refresh')
    await refreshTaxlots('klamath')

    const url = String(fetchMock.mock.calls[0]![0])
    expect(url).toContain('mode=eq.full')
    expect(url).toContain('ok=is.true')
    expect(url).toContain('order=ran_at.desc')
  })
})

describe('the county register', () => {
  beforeEach(() => vi.resetModules())

  it('gives every county a coverage statement, so no source implies more than it holds', async () => {
    const { TAXLOT_COUNTIES } = await import('./refresh')
    for (const [key, c] of Object.entries(TAXLOT_COUNTIES)) {
      expect(c.coverage, key).toBeTruthy()
      expect(c.county, key).toBeTruthy()
      expect(c.source, key).toBeTruthy()
    }
  })

  it('gives every county exactly one way of staying current: a delta or a sweep', async () => {
    const { TAXLOT_COUNTIES } = await import('./refresh')
    for (const [key, c] of Object.entries(TAXLOT_COUNTIES)) {
      expect(Boolean(c.delta) !== Boolean(c.sweep), `${key} declares both or neither`).toBe(true)
    }
  })

  it('can credit a source for every county it loads, so no drawn line is unattributed', async () => {
    const { TAXLOT_COUNTIES } = await import('./refresh')
    const { taxlotSourceFor } = await import('@/lib/data/geo/getTaxlots')
    for (const c of Object.values(TAXLOT_COUNTIES)) {
      expect(taxlotSourceFor(c.county), c.county).not.toBe('the county assessor')
    }
  })

  it('credits Jackson lot lines to Medford, which is who actually published them', async () => {
    const { taxlotSourceFor } = await import('@/lib/data/geo/getTaxlots')
    expect(taxlotSourceFor('jackson')).toBe('City of Medford GIS')
    expect(taxlotSourceFor('Jackson')).toBe('City of Medford GIS')
  })

  it('names no authority at all for a county we do not load, rather than guessing one', async () => {
    const { taxlotSourceFor } = await import('@/lib/data/geo/getTaxlots')
    expect(taxlotSourceFor('crook')).toBe('the county assessor')
    expect(taxlotSourceFor(null)).toBe('the county assessor')
    expect(taxlotSourceFor('  ')).toBe('the county assessor')
  })

  it('keeps Deschutes on its delta — it is the one county that stamps its edits', async () => {
    const { TAXLOT_COUNTIES } = await import('./refresh')
    expect(TAXLOT_COUNTIES.deschutes!.delta?.dateField).toContain('AUTODATE')
    expect(TAXLOT_COUNTIES.deschutes!.sweep).toBeUndefined()
  })
})
