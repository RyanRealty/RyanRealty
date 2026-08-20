import { describe, it, expect } from 'vitest'
import { medianListPriceOfTiles } from '../tile-medians'

/** Place fields for a tile nowhere near a registered fractional-interest property. */
const AT = { subdivisionName: 'Awbrey Butte', city: 'Bend', listNumber: '220000000' }

describe('medianListPriceOfTiles', () => {
  it('returns null for an empty set — never 0', () => {
    expect(medianListPriceOfTiles([])).toBeNull()
  })

  it('returns null when no tile carries a usable price', () => {
    expect(medianListPriceOfTiles([{ ...AT, listPrice: null, propertySubType: null }, { ...AT, listPrice: 0, propertySubType: null }, { ...AT, listPrice: -5, propertySubType: null }])).toBeNull()
    expect(medianListPriceOfTiles([{ ...AT, listPrice: 'not a number', propertySubType: null }])).toBeNull()
  })

  it('publishes the single price for a one-home inventory (a census, not a sample)', () => {
    expect(medianListPriceOfTiles([{ ...AT, listPrice: 1299000, propertySubType: null }])).toBe(1299000)
  })

  it('takes the middle value for an odd count, regardless of input order', () => {
    expect(medianListPriceOfTiles([{ ...AT, listPrice: 900000, propertySubType: null }, { ...AT, listPrice: 500000, propertySubType: null }, { ...AT, listPrice: 700000, propertySubType: null }])).toBe(700000)
  })

  it('averages and rounds the two middle values for an even count', () => {
    expect(
      medianListPriceOfTiles([
        { ...AT, listPrice: 500000, propertySubType: null },
        { ...AT, listPrice: 700001, propertySubType: null },
        { ...AT, listPrice: 900000, propertySubType: null },
        { ...AT, listPrice: 1100000, propertySubType: null },
      ]),
    ).toBe(800001)
  })

  it('ignores unpriced tiles rather than counting them as 0', () => {
    // A 0 would drag the median down; the honest answer is the median of the
    // homes that actually carry a price.
    expect(
      medianListPriceOfTiles([{ ...AT, listPrice: null, propertySubType: null }, { ...AT, listPrice: 800000, propertySubType: null }, { ...AT, listPrice: 1000000, propertySubType: null }]),
    ).toBe(900000)
  })

  it('drops a fractional interest — a share price is not a priced home', () => {
    // Eagle Crest published a $547,000 median list against a whole-home
    // $629,450 with 16 of 72 Active rows fractional (live, 2026-08-19).
    expect(
      medianListPriceOfTiles([
        { ...AT, listPrice: 1, propertySubType: 'Tenancy in Common' },
        { ...AT, listPrice: 215000, propertySubType: 'Timeshare' },
        { ...AT, listPrice: 800000, propertySubType: 'Single Family Residence' },
        { ...AT, listPrice: 1000000, propertySubType: 'Condominium' },
      ]),
    ).toBe(900000)
  })

  it('returns null when every tile is a fractional interest', () => {
    // StoneTH in Sunriver: all 16 Active rows are shares, so the honest median
    // list is no median at all.
    expect(
      medianListPriceOfTiles([
        { ...AT, listPrice: 84000, propertySubType: 'Tenancy in Common' },
        { ...AT, listPrice: 105000, propertySubType: 'Tenancy in Common' },
      ]),
    ).toBeNull()
  })

  it('drops the Lake Creek Lodge shares the sub type alone kept — the Camp Sherman case', () => {
    // The exact live pool: listing_tile_mv, city Camp Sherman, property_type A,
    // Active or Active Under Contract, 2026-08-19. 16 rows. The sub-type filter
    // dropped 1 (the Tenancy in Common row) and published $249,000. All 10 Lake
    // Creek Lodge rows are shares, leaving 6 whole homes and a $922,475 median.
    const lakeCreek = (listPrice: number, listNumber: string, propertySubType: string) => ({
      listPrice,
      listNumber,
      propertySubType,
      subdivisionName: 'Lake Creek Lodge',
      city: 'Camp Sherman',
    })
    const wholeHome = (listPrice: number, listNumber: string, subdivisionName: string) => ({
      listPrice,
      listNumber,
      subdivisionName,
      propertySubType: 'Single Family Residence',
      city: 'Camp Sherman',
    })
    expect(
      medianListPriceOfTiles([
        lakeCreek(157900, '220218115', 'Condominium'),
        lakeCreek(157900, '220218114', 'Condominium'),
        lakeCreek(159900, '220222478', 'Condominium'),
        lakeCreek(159900, '220222476', 'Condominium'),
        lakeCreek(159900, '220222477', 'Condominium'),
        lakeCreek(205000, '220215583', 'Condominium'),
        lakeCreek(210000, '220203447', 'Condominium'),
        lakeCreek(249000, '220218395', 'Condominium'),
        lakeCreek(249000, '220220877', 'Tenancy in Common'),
        lakeCreek(269000, '220170948', 'Condominium'),
        wholeHome(799000, '220227306', 'Camp Sherman'),
        wholeHome(895000, '220219001', 'Metolius Meadows'),
        { listPrice: 899950, listNumber: '220199852', propertySubType: null, subdivisionName: 'Metolius Meadows', city: 'Camp Sherman' },
        wholeHome(945000, '220223610', 'Metolius Meadows'),
        wholeHome(975000, '220226982', 'Metolius Meadows'),
        wholeHome(1025000, '220224139', 'Metolius Meadows'),
      ]),
    ).toBe(922475)
  })

  it('keeps a co-op share, whose price buys one whole unit', () => {
    expect(
      medianListPriceOfTiles([{ ...AT, listPrice: 329000, propertySubType: 'Stock Cooperative' }]),
    ).toBe(329000)
  })

  it('accepts numeric strings (Currency columns arrive as strings from PostgREST)', () => {
    expect(medianListPriceOfTiles([{ ...AT, listPrice: '1200000', propertySubType: null }, { ...AT, listPrice: '800000', propertySubType: null }])).toBe(1000000)
  })
})
