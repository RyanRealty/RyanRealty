import { describe, expect, it } from 'vitest'
import {
  buildHouseMeRows,
  housemeSourceLine,
  housemeTitle,
  type HouseMeReportFacts,
} from '@/components/site/listing-detail/HouseMeReport'
import type { ListingPricingReadRow } from '@/lib/data/pricing/reads'
import {
  HOUSEME_LABEL_COMPS,
  HOUSEME_LABEL_DOM,
  HOUSEME_LABEL_INVESTMENT,
  HOUSEME_LABEL_PPSF,
  HOUSEME_LABEL_READ,
  HOUSEME_LABEL_READ_REFUSE,
  HOUSEME_LABEL_TRUE_COST,
  HOUSEME_TITLE_FACTS,
  PUBLIC_READ_TITLE,
  PUBLIC_READ_TITLE_REFUSE,
  housemeRefuseCopy,
} from '@/lib/pricing/public-read-copy'

const BANNED = /\bAI\b|0-10|0–10|5-year|5 year|appreciation|stunning|[\u2010-\u2015\u2212;]/i

function listedRead(over: Partial<ListingPricingReadRow> = {}): ListingPricingReadRow {
  return {
    listingKey: 'k1',
    kind: 'listed-over-under',
    refuseReason: null,
    listPrice: 725_000,
    compsClose: 700_000,
    deltaPct: (700_000 - 725_000) / 725_000,
    rangeLow: 637_000,
    rangeHigh: 763_000,
    n: 5,
    factsReady: true,
    newConstruction: false,
    subdivision: 'Awbrey Glen',
    sameSubdivisionTight: true,
    computedAt: '2026-08-14T00:00:00.000Z',
    contractVersion: 'public-v1-2026-08-14',
    ...over,
  }
}

function emptyFacts(over: Partial<HouseMeReportFacts> = {}): HouseMeReportFacts {
  return {
    read: null,
    listPrice: null,
    sqft: null,
    dom: null,
    placeMedianDays: null,
    placeName: null,
    hoaMonthly: null,
    associationFee: null,
    associationFeeFrequency: null,
    taxAnnualAmount: null,
    monthlyRent: null,
    ...over,
  }
}

function allCopy(facts: HouseMeReportFacts): string {
  const rows = buildHouseMeRows(facts)
  return [housemeTitle(facts.read, rows), housemeSourceLine(rows), ...rows.flatMap((r) => [r.label, r.value, r.detail ?? ''])].join(' ')
}

describe('buildHouseMeRows', () => {
  it('emits over/under and comps n from the stamp only', () => {
    const rows = buildHouseMeRows(emptyFacts({ read: listedRead(), listPrice: 725_000 }))
    const read = rows.find((r) => r.id === 'read')
    const comps = rows.find((r) => r.id === 'comps')
    expect(read?.source).toBe('listing_pricing_reads')
    expect(read?.label).toBe(HOUSEME_LABEL_READ)
    expect(read?.value).toBe('3% under the ask')
    expect(read?.detail).toBe('$637,000 to $763,000')
    expect(comps?.source).toBe('listing_pricing_reads')
    expect(comps?.label).toBe(HOUSEME_LABEL_COMPS)
    expect(comps?.value).toBe('5 closed sales')
    expect(rows.some((r) => r.id === 'investment')).toBe(false)
  })

  it('refuses with stamp copy and still names comps n', () => {
    const read = listedRead({
      kind: 'refuse',
      refuseReason: 'thin-set',
      compsClose: null,
      deltaPct: null,
      rangeLow: null,
      rangeHigh: null,
      n: 2,
    })
    const rows = buildHouseMeRows(emptyFacts({ read }))
    expect(rows.find((r) => r.id === 'read')?.value).toBe(housemeRefuseCopy('thin-set'))
    expect(rows.find((r) => r.id === 'read')?.label).toBe(HOUSEME_LABEL_READ_REFUSE)
    expect(rows.find((r) => r.id === 'comps')?.value).toBe('2 closed sales')
    expect(housemeTitle(read, rows)).toBe(PUBLIC_READ_TITLE_REFUSE)
  })

  it('shows facts-not-ready and no-gla instead of inventing a score', () => {
    expect(housemeRefuseCopy('facts-not-ready')).toMatch(/not ready/)
    expect(housemeRefuseCopy('no-gla')).toMatch(/No living area/)
    const ready = listedRead({
      kind: 'refuse',
      refuseReason: 'facts-not-ready',
      rangeLow: null,
      rangeHigh: null,
      n: 0,
    })
    const rows = buildHouseMeRows(emptyFacts({ read: ready }))
    expect(rows.find((r) => r.id === 'read')?.value).toBe(housemeRefuseCopy('facts-not-ready'))
    expect(allCopy(emptyFacts({ read: ready }))).not.toMatch(BANNED)
  })

  it('omits the read row when the stamp ask does not match the live ask', () => {
    const rows = buildHouseMeRows(emptyFacts({ read: listedRead(), listPrice: 800_000 }))
    expect(rows.find((r) => r.id === 'read')).toBeUndefined()
    expect(rows.find((r) => r.id === 'comps')?.value).toBe('5 closed sales')
  })

  it('computes $/sqft only from live price and sqft', () => {
    const withBoth = buildHouseMeRows(emptyFacts({ listPrice: 500_000, sqft: 2_000 }))
    expect(withBoth.find((r) => r.id === 'ppsf')?.value).toBe('$250 per sq ft')
    expect(withBoth.find((r) => r.id === 'ppsf')?.source).toBe('listing')
    expect(withBoth.find((r) => r.id === 'ppsf')?.label).toBe(HOUSEME_LABEL_PPSF)
    expect(buildHouseMeRows(emptyFacts({ listPrice: 500_000, sqft: null })).find((r) => r.id === 'ppsf')).toBeUndefined()
    expect(buildHouseMeRows(emptyFacts({ listPrice: null, sqft: 2_000 })).find((r) => r.id === 'ppsf')).toBeUndefined()
  })

  it('omits DOM unless listing days and place median both exist', () => {
    expect(buildHouseMeRows(emptyFacts({ dom: 12, placeMedianDays: null })).find((r) => r.id === 'dom')).toBeUndefined()
    expect(buildHouseMeRows(emptyFacts({ dom: null, placeMedianDays: 38 })).find((r) => r.id === 'dom')).toBeUndefined()
    const both = buildHouseMeRows(emptyFacts({ dom: 12, placeMedianDays: 38, placeName: 'Bend' }))
    expect(both.find((r) => r.id === 'dom')?.source).toBe('listing+pulse')
    expect(both.find((r) => r.id === 'dom')?.label).toBe(HOUSEME_LABEL_DOM)
    expect(both.find((r) => r.id === 'dom')?.value).toBe('12 days on market. Bend median to pending is 38 days.')
  })

  it('omits True cost when HOA and tax are absent', () => {
    expect(buildHouseMeRows(emptyFacts()).find((r) => r.id === 'true-cost')).toBeUndefined()
    const taxOnly = buildHouseMeRows(emptyFacts({ taxAnnualAmount: 4089 }))
    expect(taxOnly.find((r) => r.id === 'true-cost')?.value).toBe('Tax $4,089 per year.')
    expect(taxOnly.find((r) => r.id === 'true-cost')?.label).toBe(HOUSEME_LABEL_TRUE_COST)
    const hoaOnly = buildHouseMeRows(emptyFacts({ hoaMonthly: 180 }))
    expect(hoaOnly.find((r) => r.id === 'true-cost')?.value).toBe('HOA $180 per month.')
    const both = buildHouseMeRows(emptyFacts({ hoaMonthly: 180, taxAnnualAmount: 4089 }))
    expect(both.find((r) => r.id === 'true-cost')?.value).toBe('HOA $180 per month. Tax $4,089 per year.')
  })

  it('omits the investment row unless a rental figure is passed in', () => {
    expect(buildHouseMeRows(emptyFacts()).find((r) => r.id === 'investment')).toBeUndefined()
    const rent = buildHouseMeRows(emptyFacts({ monthlyRent: 2_400 }))
    expect(rent.find((r) => r.id === 'investment')?.label).toBe(HOUSEME_LABEL_INVESTMENT)
    expect(rent.find((r) => r.id === 'investment')?.value).toBe('$2,400 per month')
    expect(rent.find((r) => r.id === 'investment')?.source).toBe('listing')
  })

  it('returns no rows when the stamp and listing facts are empty', () => {
    expect(buildHouseMeRows(emptyFacts())).toEqual([])
    expect(housemeTitle(null, [])).toBe(HOUSEME_TITLE_FACTS)
  })

  it('never invents a score, a 5-year percent, or AI copy', () => {
    const facts = emptyFacts({
      read: listedRead(),
      listPrice: 725_000,
      sqft: 2_100,
      dom: 12,
      placeMedianDays: 38,
      placeName: 'Bend',
      hoaMonthly: 180,
      taxAnnualAmount: 4089,
    })
    const text = allCopy(facts)
    expect(text).not.toMatch(BANNED)
    expect(text).toContain(PUBLIC_READ_TITLE)
    expect(housemeSourceLine(buildHouseMeRows(facts))).toBe(
      'Stamp from listing_pricing_reads. Listing fields from Spark. Place median from the live pulse.',
    )
  })
})
