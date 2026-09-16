import { describe, expect, it } from 'vitest'
import {
  bandShare,
  buildPlatPriceBands,
  buildSubdivisionInsightBoard,
  pickBandStep,
  PLAT_INSIGHT_YEARS,
} from './subdivision-insight'

const TRACE_INVENTORY = 'live MLS through Oregon Data Share, the list prices of the active listings.'
const TRACE_SOLD = 'live MLS through Oregon Data Share, closed sales grouped by year.'

function board(overrides: Partial<Parameters<typeof buildSubdivisionInsightBoard>[0]> = {}) {
  return buildSubdivisionInsightBoard({
    placeName: 'Ridge at Eagle Crest',
    askingPrices: [420_000, 560_000, 610_000, 880_000, 1_150_000, 1_320_000],
    activeCount: 6,
    medianListPrice: 745_000,
    browseHref: '/homes-for-sale/redmond/ridge-at-eagle-crest',
    closedYears: [
      { year: 2019, closedCount: 8 },
      { year: 2020, closedCount: 11 },
      { year: 2021, closedCount: 19 },
      { year: 2022, closedCount: 14 },
      { year: 2023, closedCount: 17 },
      { year: 2024, closedCount: 21 },
    ],
    inventorySource: TRACE_INVENTORY,
    soldSource: TRACE_SOLD,
    soldHref: '/how-we-get-our-numbers',
    soldHrefLabel: 'How we get our numbers',
    ...overrides,
  })
}

describe('pickBandStep', () => {
  it('takes the finest round step that lands the set in 2 to 5 groups', () => {
    // 100K shatters this set into six groups; 250K lands it in five.
    expect(pickBandStep([420_000, 560_000, 610_000, 880_000, 1_150_000, 1_320_000])).toBe(250_000)
  })

  it('escalates the step when the finest one shatters the set', () => {
    const wide = [300_000, 900_000, 1_800_000, 2_600_000, 3_400_000, 4_900_000]
    expect(pickBandStep(wide)).toBe(1_000_000)
  })

  it('has no step for an empty set', () => {
    expect(pickBandStep([])).toBeNull()
  })
})

describe('buildPlatPriceBands', () => {
  it('counts every priced home exactly once', () => {
    const prices = [420_000, 560_000, 610_000, 880_000, 1_150_000, 1_320_000]
    const bands = buildPlatPriceBands(prices)
    expect(bands.reduce((sum, b) => sum + b.count, 0)).toBe(prices.length)
  })

  it('names both edges of a band, ascending', () => {
    const bands = buildPlatPriceBands([420_000, 560_000, 610_000, 880_000, 1_150_000, 1_320_000])
    expect(bands.map((b) => b.label)).toEqual([
      '$250K–$500K',
      '$500K–$750K',
      '$750K–$1.0M',
      '$1.0M–$1.3M',
      '$1.3M–$1.5M',
    ])
  })

  it('reads the lowest band as its ceiling, because nobody asks zero dollars', () => {
    const bands = buildPlatPriceBands([120_000, 560_000, 610_000, 880_000, 1_150_000, 1_320_000])
    expect(bands[0].label).toBe('Under $250K')
  })

  it('prints a plural noun only when the band holds more than one home', () => {
    const bands = buildPlatPriceBands([420_000, 560_000, 610_000, 880_000, 1_150_000, 1_320_000])
    expect(bands[0].amount).toBe('1 home')
    expect(bands[1].amount).toBe('2 homes')
  })
})

describe('bandShare', () => {
  it('rounds to a whole percent', () => {
    expect(bandShare(4, 15)).toBe(27)
    expect(bandShare(3, 15)).toBe(20)
  })

  it('keeps a decimal rather than printing the zero a band is not', () => {
    expect(bandShare(1, 400)).toBe(0.3)
  })
})

describe('buildSubdivisionInsightBoard', () => {
  it('publishes the counted set and its middle asking price', () => {
    const b = board()
    expect(b.forSale?.priced).toBe(6)
    expect(b.forSale?.active).toBe(6)
    expect(b.forSale?.median).toBe('$745,000')
    expect(b.forSale?.medianValue).toBe(745_000)
    expect(b.forSale?.source).toBe(TRACE_INVENTORY)
  })

  it('names the homes whose price did not publish rather than dropping them', () => {
    const b = board({ activeCount: 9 })
    expect(b.forSale?.note).toContain('6 of 9 homes for sale')
  })

  it('withholds the asking-price page when no median published', () => {
    expect(board({ medianListPrice: null }).forSale).toBeNull()
  })

  it('withholds the asking-price page when the set makes one band', () => {
    expect(board({ askingPrices: [700_000, 701_000, 702_000] }).forSale).toBeNull()
  })

  it('draws the yearly closed counts oldest first with a running total', () => {
    const b = board()
    expect(b.sold?.years).toEqual([2019, 2020, 2021, 2022, 2023, 2024])
    expect(b.sold?.counts).toEqual([8, 11, 19, 14, 17, 21])
    expect(b.sold?.running).toEqual([8, 19, 38, 52, 69, 90])
    expect(b.sold?.total).toBe(90)
    expect(b.sold?.window).toBe('2019 to 2024')
  })

  it('shows the running total arithmetic in the trace', () => {
    expect(board().sold?.source).toContain('8 + 11 + 19 + 14 + 17 + 21 = 90')
  })

  it('states the quiet and the busy year so the line reads without a scrub', () => {
    const b = board()
    expect(b.sold?.range).toEqual({ low: '8', high: '21' })
  })

  it('never draws more years than the card frames', () => {
    const many = Array.from({ length: 14 }, (_, i) => ({ year: 2011 + i, closedCount: i + 1 }))
    const b = board({ closedYears: many })
    expect(b.sold?.years).toHaveLength(PLAT_INSIGHT_YEARS)
    expect(b.sold?.years[PLAT_INSIGHT_YEARS - 1]).toBe(2024)
  })

  it('withholds the sold page under three complete years', () => {
    const b = board({ closedYears: [{ year: 2023, closedCount: 4 }, { year: 2024, closedCount: 6 }] })
    expect(b.sold).toBeNull()
  })

  it('drops a year that closed nothing rather than charting a zero', () => {
    const b = board({
      closedYears: [
        { year: 2021, closedCount: 3 },
        { year: 2022, closedCount: 0 },
        { year: 2023, closedCount: 5 },
        { year: 2024, closedCount: 6 },
      ],
    })
    expect(b.sold?.years).toEqual([2021, 2023, 2024])
    expect(b.sold?.total).toBe(14)
  })
})
