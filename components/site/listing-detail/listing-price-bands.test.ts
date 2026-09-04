import { describe, expect, it } from 'vitest'
import {
  buildListingPriceBandChart,
  buildSmartPriceBandData,
  closedPricesForLeftoverGrain,
  listingPriceBandClaim,
} from './listing-price-bands'

describe('closedPricesForLeftoverGrain', () => {
  const rows = [
    {
      status: 'Closed',
      closePrice: 700_000,
      city: 'Sunriver',
      subdivisionName: 'Meadow Village',
      propertyType: 'A',
      propertySubType: 'Single Family Residence',
    },
    {
      status: 'Closed',
      closePrice: 400_000,
      city: 'Bend',
      subdivisionName: 'Tetherow',
      propertyType: 'A',
      propertySubType: 'Single Family Residence',
    },
    {
      status: 'Active',
      closePrice: null,
      city: 'Sunriver',
      subdivisionName: 'Meadow Village',
      propertyType: 'A',
      propertySubType: 'Single Family Residence',
    },
    {
      status: 'Closed',
      closePrice: 250_000,
      city: 'Sunriver',
      subdivisionName: 'Meadow Village',
      propertyType: 'R',
      propertySubType: 'Condominium',
    },
  ]

  it('keeps leftover-grain detached closes and drops unlike rows', () => {
    expect(closedPricesForLeftoverGrain(rows, { geoType: 'city', geoSlug: 'sunriver' })).toEqual([
      700_000,
    ])
    expect(
      closedPricesForLeftoverGrain(rows, { geoType: 'neighborhood', geoSlug: 'tetherow' }),
    ).toEqual([400_000])
  })
})

describe('buildSmartPriceBandData', () => {
  it('omits when there are no closes', () => {
    expect(buildSmartPriceBandData([])).toBeNull()
    expect(buildSmartPriceBandData([{ price: null }, { price: 0 }])).toBeNull()
  })

  it('drops empty tails and does not invent a band', () => {
    const bands = buildSmartPriceBandData([
      { price: 710_000 },
      { price: 740_000 },
      { price: 1_200_000 },
    ])
    expect(bands?.map((b) => b.name)).toEqual(['$700–800K', '$1–1.25M'])
    expect(bands?.every((b) => b.count > 0)).toBe(true)
    expect(bands?.some((b) => b.name.startsWith('under'))).toBe(false)
    expect(bands?.some((b) => b.name.endsWith('+'))).toBe(false)
  })

  it('splits a busy band where sales cluster', () => {
    const low = Array.from({ length: 12 }, () => ({ price: 710_000 }))
    const high = Array.from({ length: 12 }, () => ({ price: 790_000 }))
    const bands = buildSmartPriceBandData([...low, ...high])
    expect(bands?.map((b) => b.name)).toEqual(['$700–750K', '$750–800K'])
    expect(bands?.map((b) => b.count)).toEqual([12, 12])
  })
})

describe('listingPriceBandClaim', () => {
  it('is a claim about where those sales closed', () => {
    const bands = buildSmartPriceBandData([
      { price: 710_000 },
      { price: 720_000 },
      { price: 1_200_000 },
    ])
    expect(bands).not.toBeNull()
    expect(listingPriceBandClaim('Sunriver', bands!)).toBe(
      '2 of 3 Sunriver sales closed in $700–800K',
    )
  })
})

describe('buildListingPriceBandChart', () => {
  it('omits when the grain has no closed rows', () => {
    expect(buildListingPriceBandChart({ grainName: 'Sunriver', closed: [] })).toBeNull()
  })

  it('is a bars chart whose caption is the claim', () => {
    const chart = buildListingPriceBandChart({
      grainName: 'Sunriver',
      closed: [{ price: 710_000 }, { price: 720_000 }, { price: 1_200_000 }],
    })
    expect(chart?.kind).toBe('bars')
    expect(chart?.caption).toBe('2 of 3 Sunriver sales closed in $700–800K')
    expect(chart?.series?.[0]?.points.map((p) => p.value)).toEqual([2, 1])
  })
})
