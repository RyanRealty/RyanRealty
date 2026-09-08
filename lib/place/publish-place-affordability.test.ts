import { describe, it, expect } from 'vitest'
import { publishPlaceAffordability } from './publish-place-affordability'
import type { PublicMixRow } from '@/lib/data/market-truth/public-mix'
import type { LiveMortgageRate } from '@/lib/data/market/getLiveMortgageRate'
import type { IsoDate, IsoTimestamp } from '@/lib/data/types/shared'

/**
 * Every figure below was read live from Supabase on 2026-09-08:
 *   market_metric city/bend median_list_active detached = 947000 (n 664)
 *   market_metric city/bend cash_share detached 12mo    = 0.277858176555716 (n 2073)
 *   market_metric city/bend financing_mix detached 12mo = conventional .6324, cash .2779
 *   market_history_weekly national/us mortgage_rate_30yr = 6.71, week 2026-09-07,
 *     source freddie:pmms30
 */
const bendMix: PublicMixRow = {
  financing: [
    { key: 'conventional', share: 0.63241678726483357, floor: false },
    { key: 'cash', share: 0.27785817655571635, floor: false },
  ],
  features: [],
  bedrooms: [],
}

const liveRate: LiveMortgageRate = {
  ratePct: 6.71,
  rateFraction: 0.0671,
  weekStart: '2026-09-07' as IsoDate,
  source: 'freddie:pmms30',
  capturedAt: '2026-09-07T13:00:44.086+00:00' as IsoTimestamp,
}

const bend = {
  placeName: 'Bend',
  placeSlug: 'bend',
  grain: 'city' as const,
  medianListPrice: 947_000,
  activeCount: 664,
  computedAt: '2026-09-08T18:24:07.857Z',
  browseHref: '/homes-for-sale/bend',
  rate: liveRate,
  fallbackRatePct: 7,
  mix: bendMix,
  cashShare: 0.277858176555716,
}

describe('publishPlaceAffordability · the calculator opens on this market', () => {
  it('opens at the place`s own published median, rounded the way the ceiling rounds', () => {
    const props = publishPlaceAffordability(bend)!
    expect(props.openingPrice).toBe(947_000)
    expect(props.medianListPrice).toBe(947_000)
  })

  it('carries the median`s count and read date into the trace', () => {
    const props = publishPlaceAffordability(bend)!
    expect(props.medianSource).toContain('$947,000')
    expect(props.medianSource).toContain('664 homes for sale')
    expect(props.medianSource).toContain('median_list_active')
  })

  it('says so plainly when the place publishes no median, and opens anyway', () => {
    const props = publishPlaceAffordability({ ...bend, medianListPrice: null, activeCount: null })!
    expect(props.medianListPrice).toBeNull()
    expect(props.medianSource).toContain('publishes no median')
    expect(props.openingPrice).toBeGreaterThan(0)
  })

  it('gives the slider a domain that contains the opening number', () => {
    for (const median of [350_000, 599_999, 947_000, 1_375_000, 4_200_000]) {
      const props = publishPlaceAffordability({ ...bend, medianListPrice: median })!
      expect(props.priceMin).toBeLessThanOrEqual(props.openingPrice)
      expect(props.priceMax).toBeGreaterThan(props.openingPrice)
      expect(props.priceStep).toBeGreaterThan(0)
    }
  })
})

describe('publishPlaceAffordability · the rate is measured or it is an assumption', () => {
  it('publishes the measured rate with its week and its source name', () => {
    const props = publishPlaceAffordability(bend)!
    expect(props.rate).toEqual({
      pct: 6.71,
      weekLabel: expect.stringContaining('2026'),
      sourceName: 'Freddie Mac 30-year fixed',
    })
  })

  it('publishes NO rate when the series is dark, leaving the fallback as the visitor`s own', () => {
    const props = publishPlaceAffordability({ ...bend, rate: null })!
    expect(props.rate).toBeNull()
    expect(props.fallbackRatePct).toBe(7)
  })

  it('never claims Freddie for a source string it did not recognise', () => {
    const props = publishPlaceAffordability({
      ...bend,
      rate: { ...liveRate, source: 'market_history_weekly' },
    })!
    expect(props.rate!.sourceName).not.toContain('Freddie')
    expect(props.rate!.sourceName).toContain('market_history_weekly')
  })
})

describe('publishPlaceAffordability · the mix is a fact, not a down payment', () => {
  it('names each slice in plain words and keeps its published share', () => {
    const props = publishPlaceAffordability(bend)!
    expect(props.mix.map((m) => m.name)).toEqual(['Conventional loan', 'Cash'])
    expect(props.mix.map((m) => m.label)).toEqual(['63.2%', '27.8%'])
  })

  it('states in the trace that the shares do not add to 100 and are about other buyers', () => {
    const props = publishPlaceAffordability(bend)!
    expect(props.mixSource).toContain('do not add to 100%')
    expect(props.mixSource).toContain('not a suggestion about your down payment')
  })

  it('opens FINANCED where most sales carried a loan, whatever the cash share is', () => {
    expect(publishPlaceAffordability(bend)!.openingMode).toBe('financed')
    // Awbrey Butte detached cash_share 12mo, read 2026-09-08.
    expect(publishPlaceAffordability({ ...bend, cashShare: 0.391666666666667 })!.openingMode).toBe(
      'financed',
    )
  })

  it('opens on cash only where cash was the majority of closed sales', () => {
    expect(publishPlaceAffordability({ ...bend, cashShare: 0.62 })!.openingMode).toBe('cash')
  })

  it('marks a floored share as a floor rather than as an exact figure', () => {
    const props = publishPlaceAffordability({
      ...bend,
      mix: { ...bendMix, financing: [{ key: 'cash', share: 0.3, floor: true }, { key: 'va', share: 0.1, floor: true }] },
    })!
    expect(props.mix[0]!.label).toBe('at least 30.0%')
  })
})

describe('publishPlaceAffordability · it refuses rather than half-answers', () => {
  it('returns null without a place name or a browse path to end on', () => {
    expect(publishPlaceAffordability({ ...bend, placeName: '  ' })).toBeNull()
    expect(publishPlaceAffordability({ ...bend, browseHref: '' })).toBeNull()
  })

  it('returns null when there is no rate to start from at all', () => {
    expect(publishPlaceAffordability({ ...bend, rate: null, fallbackRatePct: 0 })).toBeNull()
  })

  it('never puts a cash share where a down payment goes', () => {
    const props = publishPlaceAffordability(bend)!
    const words = `${props.mixSource} ${props.medianSource}`.toLowerCase()
    expect(words).not.toMatch(/put .*% down/)
    expect(props.cashShare).toBe(0.277858176555716)
  })
})
