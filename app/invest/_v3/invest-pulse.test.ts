import { describe, expect, it } from 'vitest'
import type { PublicSegmentRow } from '@/lib/data/market-truth/public-segments'
import {
  composeInvestPulse,
  investClaim,
  investCounts,
  investTrace,
  INVEST_PULSE_ID,
} from './invest-pulse'

function row(segment: string, activeCount: number | null): PublicSegmentRow {
  return {
    segment,
    activeCount,
    medianList: null,
    monthsOfSupply: null,
    verdict: null,
    pendingCount: null,
    closedCount: null,
    sampleN: activeCount,
    daysToContract: null,
    saleToOriginal: null,
    yoyMedian: null,
    priceCutShare: null,
  } as PublicSegmentRow
}

/** The 2026-09-09 region read, printed in the module header. */
const LIVE = [
  row('multifamily_2_4', 46),
  row('commercial_sale', 61),
  row('land', 605),
  row('farm', 41),
  row('business', 8),
]

describe('investCounts', () => {
  it('returns only the income segments, largest first', () => {
    expect(investCounts(LIVE)).toEqual([
      { segment: 'land', count: 605 },
      { segment: 'commercial_sale', count: 61 },
      { segment: 'multifamily_2_4', count: 46 },
      { segment: 'farm', count: 41 },
      { segment: 'business', count: 8 },
    ])
  })

  it('drops a withheld count rather than printing it as a zero', () => {
    const counts = investCounts([row('land', null), row('farm', 41)])
    expect(counts).toEqual([{ segment: 'farm', count: 41 }])
  })

  it('drops a zero — nothing for sale is a fact about the read', () => {
    expect(investCounts([row('business', 0)])).toEqual([])
  })

  it('ignores a segment that is not an income segment', () => {
    expect(investCounts([row('condo', 109), row('farm', 41)])).toEqual([
      { segment: 'farm', count: 41 },
    ])
  })
})

describe('investClaim', () => {
  it('publishes the authored headline while land holds more than half', () => {
    expect(investClaim(investCounts(LIVE))).toBe(
      'Most investment property for sale in Central Oregon is land, not buildings.',
    )
  })

  it('falls back when land is the largest but not a majority', () => {
    const counts = investCounts([row('land', 100), row('commercial_sale', 90), row('farm', 60)])
    expect(investClaim(counts)).toBe('250 income properties are for sale across Central Oregon right now.')
  })

  it('falls back when land is not the largest population', () => {
    const counts = investCounts([row('land', 10), row('commercial_sale', 90)])
    expect(investClaim(counts)).toBe('100 income properties are for sale across Central Oregon right now.')
  })

  it('is null on an empty read', () => {
    expect(investClaim([])).toBeNull()
  })
})

describe('investTrace', () => {
  it('prints every count, the denominator, and the headline arithmetic', () => {
    const trace = investTrace(investCounts(LIVE), 4)
    expect(trace).toContain('land 605')
    expect(trace).toContain('business 8')
    expect(trace).toContain('761 listings in all')
    expect(trace).toContain('605 ÷ 761 = 79.5%')
    expect(trace).toContain('central-oregon')
  })

  it('says which populations the band did not draw', () => {
    const trace = investTrace(investCounts(LIVE), 4)
    expect(trace).toContain('753 of 761')
  })

  it('says nothing about undrawn populations when every one is drawn', () => {
    const trace = investTrace(investCounts([row('land', 605), row('farm', 41)]), 4)
    expect(trace).not.toContain('the rest keep their own door')
  })
})

describe('composeInvestPulse', () => {
  const built = composeInvestPulse({ rows: LIVE, stamp: 'Sep 9, 2026, 12:04 PM' })

  it('opens the page: the claim is the H1', () => {
    expect(built?.headingLevel).toBe(1)
    expect(built?.id).toBe(INVEST_PULSE_ID)
    expect(String(built?.claim)).toBe(
      'Most investment property for sale in Central Oregon is land, not buildings.',
    )
  })

  it('draws the four largest populations, largest first', () => {
    expect(built?.readings.map((r) => r.key)).toEqual([
      'land',
      'commercial_sale',
      'multifamily_2_4',
      'farm',
    ])
  })

  it('formats each figure and shares it against the WHOLE set, not the largest', () => {
    const land = built?.readings[0]
    expect(land?.figure).toBe('605')
    expect(land?.label).toBe('lots')
    expect(land?.share).toBeCloseTo(605 / 761, 6)
    expect(land?.share).toBeLessThan(1)
  })

  it('gives every reading a definition and a door', () => {
    for (const reading of built?.readings ?? []) {
      expect(reading.definition.length).toBeGreaterThan(40)
      expect(reading.href).toBeTruthy()
      expect(reading.hrefLabel).toBeTruthy()
    }
  })

  it('stamps the moment of the read', () => {
    expect(built?.note).toBe('Read Sep 9, 2026, 12:04 PM')
  })

  it('publishes nothing when the read came back empty', () => {
    expect(composeInvestPulse({ rows: [], stamp: 'Sep 9, 2026, 12:04 PM' })).toBeNull()
  })

  it('publishes nothing without a read stamp', () => {
    expect(composeInvestPulse({ rows: LIVE, stamp: '   ' })).toBeNull()
  })
})
