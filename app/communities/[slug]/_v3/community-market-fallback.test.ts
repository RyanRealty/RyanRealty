import { describe, expect, it } from 'vitest'
import type { AtlasDot } from '@/components/site/v3'
import {
  ASKING_BANDS_MIN,
  askingBandsChart,
  askingPrices,
  marketFallbackNote,
  marketFallbackSource,
  recentClosesChart,
  recentHouseCloses,
} from './community-market-fallback'

const house = (listPrice: number) => ({ listPrice, propertyType: 'A', propertySubType: 'Single Family Residence' })
const condo = (listPrice: number) => ({ listPrice, propertyType: 'A', propertySubType: 'Condominium' })

describe('askingBandsChart (SITE-116 round 3, defect 4)', () => {
  it('keeps detached houses only and drops a missing ask', () => {
    expect(askingPrices([house(1_200_000), condo(400_000), house(0), house(2_500_000)])).toEqual([1_200_000, 2_500_000])
  })

  it('draws nothing below the floor rather than padding a distribution', () => {
    expect(askingBandsChart([house(1_000_000), house(2_000_000)], 'Tetherow')).toBeUndefined()
    expect(ASKING_BANDS_MIN).toBe(3)
  })

  it('counts the set into trimmed price bands and states the claim from the same prices', () => {
    const chart = askingBandsChart(
      [house(450_000), house(1_100_000), house(1_600_000), house(2_300_000), house(2_620_000), house(4_300_000)],
      'Tetherow',
    )!
    expect(chart.kind).toBe('bars')
    expect(chart.barLabels).toBe('all')
    const points = chart.series![0]!.points
    expect(points.map((p) => [String(p.tick), p.value])).toEqual([
      ['Under $500K', 1],
      ['$500K–$750K', 0],
      ['$750K–$1M', 0],
      ['$1M–$1.5M', 1],
      ['$1.5M–$2M', 1],
      ['$2M–$3M', 2],
      ['$3M–$5M', 1],
    ])
    // 6 prices: q1 = 2nd (1.1M), q3 = 5th (2.62M) by nearest rank.
    expect(String(chart.claim)).toBe(
      '6 houses for sale in Tetherow, asking $450K to $4.3M; the middle half asks $1.1M to $2.6M.',
    )
    expect(String(chart.caption)).toBe('What Tetherow houses are asking right now')
  })

  it('widens a one-band set to two columns so it still reads as a scale', () => {
    const chart = askingBandsChart([house(2_100_000), house(2_400_000), house(2_900_000)], 'Tetherow')!
    expect(chart.series![0]!.points.map((p) => String(p.tick))).toEqual(['$2M–$3M', '$3M–$5M'])
    expect(String(chart.claim)).toMatch(/^3 houses for sale in Tetherow, asking \$2\.1M to \$2\.9M/)
  })
})

const dot = (over: Partial<AtlasDot>): AtlasDot => ({
  k: 'k',
  lat: 44,
  lng: -121,
  p: 1_000_000,
  t: 'house',
  s: 'sold',
  age: null,
  soldAgo: 10,
  ...over,
})

describe('recentClosesChart', () => {
  it('keeps sold houses with a price, most recent first, and never a pending or a lot', () => {
    const closes = recentHouseCloses([
      dot({ k: 'a', soldAgo: 40, p: 2_000_000 }),
      dot({ k: 'b', soldAgo: 3, p: 1_500_000 }),
      dot({ k: 'c', s: 'active', soldAgo: null }),
      dot({ k: 'd', t: 'land', soldAgo: 5 }),
      dot({ k: 'e', soldAgo: 8, p: null }),
    ])
    expect(closes.map((c) => c.key)).toEqual(['b', 'a'])
  })

  it('draws one lollipop row per close with how long ago it closed, and claims the range it plots', () => {
    const chart = recentClosesChart(
      [dot({ k: 'a', soldAgo: 40, p: 2_000_000 }), dot({ k: 'b', soldAgo: 1, p: 1_500_000 }), dot({ k: 'c', soldAgo: 0, p: 985_000 })],
      'Tetherow',
      90,
    )!
    expect(chart.kind).toBe('range')
    expect(chart.rows!.map((r) => [String(r.tick), r.value, String(r.label)])).toEqual([
      ['Today', 985_000, '$985K'],
      ['Yesterday', 1_500_000, '$1.5M'],
      ['6 weeks ago', 2_000_000, '$2.0M'],
    ])
    expect(String(chart.claim)).toBe('3 houses closed inside the Tetherow boundary in the last 90 days, $985K to $2.0M.')
  })

  it('is undefined with nothing to draw', () => {
    expect(recentClosesChart([dot({ s: 'active', soldAgo: null })], 'Tetherow', 90)).toBeUndefined()
  })
})

describe('note and source', () => {
  it('says what is drawn instead of the median, and nothing when nothing is', () => {
    expect(marketFallbackNote('Tetherow', true, true)).toMatch(/draws what is for sale and what has just closed instead\.$/)
    expect(marketFallbackNote('Tetherow', true, false)).toMatch(/draws what is for sale instead\.$/)
    expect(marketFallbackNote('Tetherow', false, false)).toBeUndefined()
  })

  it('names both populations and refuses the median line in the trace', () => {
    const src = marketFallbackSource({ placeName: 'Tetherow', askingCount: 6, closesCount: 3, windowDays: 90 })
    expect(src).toMatch(/6 detached houses active under Tetherow's MLS subdivision names/)
    expect(src).toMatch(/3 houses among the map's sold marks/)
    expect(src).toMatch(/No monthly median line is drawn/)
    expect(src).not.toMatch(/Bend/)
  })
})
