import { describe, expect, it } from 'vitest'
import { buildCommunityForSale, buildCommunityInsightBoard, buildCommunitySupply } from './community-insight'

const BASE = {
  placeName: 'Tetherow',
  cityName: 'Bend',
  marketHref: '/housing-market/bend',
  verdictProse: null,
  floor: null,
  cityVerdictLabel: null,
  months: [],
}

describe('community supply page', () => {
  it('a published figure wins: the verdict prose, no floor sentence', () => {
    const supply = buildCommunitySupply({
      ...BASE,
      placeName: 'Sunriver',
      verdictProse: 'A balanced market.',
      floor: { closedSixMonths: 23, minN: 30, asOf: 'Oct 1, 2026' },
    })
    expect(supply).toEqual({ kind: 'published', prose: 'A balanced market.' })
  })

  it('withheld under the floor: the count it rests on, the floor, and the parent city by name', () => {
    const supply = buildCommunitySupply({
      ...BASE,
      floor: { closedSixMonths: 23, minN: 30, asOf: 'Oct 1, 2026' },
      cityVerdictLabel: "seller's market",
    })
    expect(supply?.kind).toBe('floor')
    if (supply?.kind !== 'floor') return
    expect(supply.lead).toBe('23 houses sold in Tetherow in the last six months.')
    expect(supply.floorSentence).toBe("Calling it a buyer's or seller's market takes 30 sales, so we don't.")
    expect(supply.contextSentence).toBe("Bend as a whole is a seller's market.")
    expect(supply.closedLabel).toBe('23')
    expect(supply.tallySource).toMatch(/one mark per sale/)
    expect(supply.tallySource).toMatch(/as of Oct 1, 2026$/)
    // Never the withheld ratio and never a verdict for the community itself.
    const text = [supply.lead, supply.floorSentence, supply.contextSentence].join(' ')
    expect(text).not.toMatch(/\d+\.\d+ months/)
    expect(text).not.toMatch(/Tetherow (is|as a whole is) a/)
    expect(text).not.toMatch(/—/)
  })

  it('no parent read: the floor sentence stands alone', () => {
    const supply = buildCommunitySupply({ ...BASE, floor: { closedSixMonths: 1, minN: 30, asOf: null } })
    expect(supply?.kind === 'floor' && supply.lead).toBe('1 house sold in Tetherow in the last six months.')
    expect(supply?.kind === 'floor' && supply.contextSentence).toBeNull()
  })

  it('zero sales says so in words', () => {
    const supply = buildCommunitySupply({ ...BASE, placeName: 'Crosswater', floor: { closedSixMonths: 0, minN: 30, asOf: null } })
    expect(supply?.kind === 'floor' && supply.lead).toBe('No houses sold in Crosswater in the last six months.')
  })

  it('a count at or over the floor is not a withheld figure, so no floor page prints', () => {
    expect(buildCommunitySupply({ ...BASE, floor: { closedSixMonths: 30, minN: 30, asOf: null } })).toBeNull()
    expect(buildCommunitySupply({ ...BASE, floor: { closedSixMonths: 2.5, minN: 30, asOf: null } })).toBeNull()
  })

  it('nothing published and nothing withheld: no supply page', () => {
    expect(buildCommunitySupply(BASE)).toBeNull()
  })
})

describe('community closed-sales path', () => {
  const month = (m: number, median: number | null, sold: number | null) => ({
    periodStart: `2026-${String(m).padStart(2, '0')}-01`,
    medianSalePrice: median,
    soldCount: sold,
  })

  it('draws only months with both a median and a count, at most eight', () => {
    const months = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((m) => month(m, 1_000_000 + m * 10_000, m))
    months.push(month(10, null, 4))
    const board = buildCommunityInsightBoard({ ...BASE, months })
    expect(board.path?.points).toHaveLength(8)
    expect(board.path?.points[0]?.label).toBe('February 2026')
    expect(board.path?.source).toMatch(/inside the recorded Tetherow boundary/)
    expect(board.path?.hrefLabel).toBe('The Bend market report')
  })

  it('a thin series draws nothing rather than a zigzag', () => {
    const board = buildCommunityInsightBoard({ ...BASE, months: [month(8, 2_000_000, 2), month(9, 2_100_000, 3)] })
    expect(board.path).toBeNull()
  })
})

describe('community asking-price page', () => {
  const prices = [1_650_000, 1_995_000, 2_150_000, 2_400_000, 2_620_000, 2_700_000, 2_850_000, 3_100_000, 3_250_000, 3_400_000, 3_950_000, 4_200_000, 5_100_000]

  it('draws the houses for sale in round bands when they are exactly the set Market Truth counts', () => {
    const page = buildCommunityForSale({ placeName: 'Tetherow', askingPrices: prices, activeCount: 13, medianListPrice: 2_620_000, inventoryAsOf: 'Oct 1, 2026' })
    expect(page?.count).toBe(13)
    expect(page?.median).toBe('$2,620,000')
    expect(page?.bands.reduce((sum, band) => sum + band.count, 0)).toBe(13)
    expect(page?.bands.length).toBeGreaterThanOrEqual(2)
    expect(page?.note).toBe('Asking prices of all 13 houses for sale in Tetherow.')
    expect(page?.href).toBe('#homes')
  })

  it('omits the page when the map set and the counted set disagree, rather than footnoting two counts', () => {
    expect(buildCommunityForSale({ placeName: 'Sunriver', askingPrices: prices, activeCount: 15, medianListPrice: 1_000_000 })).toBeNull()
    expect(buildCommunityForSale({ placeName: 'Tetherow', askingPrices: prices, activeCount: null, medianListPrice: null })).toBeNull()
  })

  it('a withheld median keeps the bands and drops the median sentence', () => {
    const page = buildCommunityForSale({ placeName: 'Tetherow', askingPrices: prices, activeCount: 13, medianListPrice: null })
    expect(page?.median).toBeNull()
    expect(page?.bands.length).toBeGreaterThanOrEqual(2)
  })
})

describe('community supply page door', () => {
  it('a withheld figure offers the parent city by its report; a published one explains the count', () => {
    const floorBoard = buildCommunityInsightBoard({
      ...BASE,
      floor: { closedSixMonths: 23, minN: 30, asOf: null },
      cityVerdictLabel: "seller's market",
    })
    expect(floorBoard.supplyHref).toBe('/housing-market/bend')
    expect(floorBoard.supplyHrefLabel).toBe('The Bend market report')
    const published = buildCommunityInsightBoard({ ...BASE, placeName: 'Sunriver', verdictProse: 'A balanced market.' })
    expect(published.supplyHref).toBe('/months-of-supply')
  })
})
