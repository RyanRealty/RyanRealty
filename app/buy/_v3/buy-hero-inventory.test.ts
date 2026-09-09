import { describe, expect, it } from 'vitest'
import type { MarketPulseSnapshot } from '@/lib/data/market/getMarketPulseSnapshot'
import { buyHeroInventory } from './buy-hero-inventory'

/**
 * The /buy hero strip's §0 rules, as tests. The figures are live, so what can
 * be pinned is the TURN: which values publish, which are withheld, what grain
 * they publish at, and where each door goes.
 */
const ROW: MarketPulseSnapshot = {
  geo_slug: 'central-oregon',
  geo_label: 'Central Oregon',
  active_count: 1563,
  median_list_price: 749900,
  months_of_supply: 4.9,
  market_health_label: null,
  sold_count_30d: 313,
  sold_count_90d: 1092,
  new_count_7d: 0,
  median_active_dom: 76,
  median_days_to_pending: 29,
  price_reduction_share: null,
  methodology_version: 'v3-2026-05-07',
  updated_at: '2026-09-09T14:48:16.111436+00:00',
}

describe('buyHeroInventory · what publishes', () => {
  it('turns one region row into the three figures, in reading order', () => {
    const strip = buyHeroInventory(ROW)
    expect(strip?.figures.map((f) => [f.value, f.label])).toEqual([
      ['1,563', 'houses for sale right now'],
      ['$749,900', 'half the houses ask more'],
      ['29', 'days to an offer, last 90 days'],
    ])
  })

  it('publishes the median at EXACT dollars, the grain its door lands on', () => {
    // formatPrice would round 749,900 to $750,000 and the region deep dive it
    // links to prints $749,900. One figure, one grain.
    expect(buyHeroInventory(ROW)?.figures[1]?.value).toBe('$749,900')
  })

  it('sends every figure to a surface that publishes that same figure', () => {
    const [count, median, pace] = buyHeroInventory(ROW)!.figures
    expect(count?.href).toBe('/homes-for-sale?view=list')
    expect(median?.href).toBe('/housing-market/central-oregon#market')
    expect(pace?.href).toBe('/housing-market/central-oregon#pace')
  })

  it('carries the trace and the as-of stamp off the same row', () => {
    const strip = buyHeroInventory(ROW)
    expect(strip?.source).toContain('Oregon Data Share')
    expect(strip?.source).toContain('Central Oregon')
    expect(strip?.updatedAt).toBe(ROW.updated_at)
  })

  it('keeps the trace to one short line — the first draft was a wall of type', () => {
    expect(buyHeroInventory(ROW)!.source.length).toBeLessThanOrEqual(90)
  })
})

describe('buyHeroInventory · what is withheld (§0)', () => {
  it('ships no strip at all when the read missed', () => {
    expect(buyHeroInventory(null)).toBeUndefined()
    expect(buyHeroInventory(undefined)).toBeUndefined()
  })

  it('withholds a figure whose value is null rather than printing a zero', () => {
    const strip = buyHeroInventory({ ...ROW, median_list_price: null })
    expect(strip?.figures.map((f) => f.label)).toEqual([
      'houses for sale right now',
      'days to an offer, last 90 days',
    ])
  })

  it('treats a stored zero as unknown, never as a published $0 or 0 days', () => {
    // Both zeros drop, the count is the only survivor, and one figure is not a
    // strip — so the hero shows no numbers rather than "$0 / median asking
    // price" under a live-MLS trace.
    expect(buyHeroInventory({ ...ROW, median_list_price: 0, median_days_to_pending: 0 })).toBeUndefined()
    expect(
      buyHeroInventory({ ...ROW, median_list_price: 0 })?.figures.map((f) => f.value),
    ).toEqual(['1,563', '29'])
  })

  it('ships nothing when fewer than two figures survive', () => {
    expect(
      buyHeroInventory({ ...ROW, active_count: null, median_list_price: null }),
    ).toBeUndefined()
  })

  it('publishes a half-day median at its published grain, never integer-rounded', () => {
    expect(buyHeroInventory({ ...ROW, median_days_to_pending: 29.5 })?.figures[2]?.value).toBe(
      '29.5',
    )
  })
})
