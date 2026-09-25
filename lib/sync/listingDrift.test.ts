import { describe, it, expect } from 'vitest'
import { dateOnly, driftReasons, factsFromListingRow, factsFromSparkFields, type DriftFacts } from './listingDrift'

const base: DriftFacts = {
  status: 'Closed',
  closeDate: '2026-04-03',
  closePrice: 825000,
  listPrice: 850000,
  city: 'Redmond',
  subType: 'Single Family Residence',
  sqft: 2838,
}

describe('driftReasons', () => {
  it('no row on our side is drift', () => {
    expect(driftReasons(null, base)).toEqual(['missing'])
  })

  it('identical facts are not drift', () => {
    expect(driftReasons(base, { ...base })).toEqual([])
  })

  it('reports each fact the MLS says differently', () => {
    const ours = { ...base, status: 'Pending', closeDate: null, closePrice: null, city: 'redmond', subType: null, sqft: null }
    expect(driftReasons(ours, base)).toEqual(['status', 'close_date', 'close_price', 'sub_type', 'sqft'])
  })

  it('a city differing only by case is not drift', () => {
    expect(driftReasons({ ...base, city: 'REDMOND' }, base)).toEqual([])
  })

  it('a fact the MLS leaves blank never counts', () => {
    const mls: DriftFacts = { status: null, closeDate: null, closePrice: null, listPrice: null, city: null, subType: null, sqft: null }
    expect(driftReasons({ ...base, city: 'Bend' }, mls)).toEqual([])
  })

  it('prices compare to the dollar', () => {
    expect(driftReasons({ ...base, closePrice: 825000.4 }, base)).toEqual([])
    expect(driftReasons({ ...base, closePrice: 824000 }, base)).toEqual(['close_price'])
  })

  it('list price drift needs a list price on both sides', () => {
    expect(driftReasons({ ...base, listPrice: null }, base)).toEqual([])
    expect(driftReasons({ ...base, listPrice: 800000 }, base)).toEqual(['list_price'])
  })
})

describe('fact readers', () => {
  it('reads a DB row with a timestamptz close date as its calendar date', () => {
    const f = factsFromListingRow({
      StandardStatus: 'Closed',
      CloseDate: '2026-04-03T00:00:00+00:00',
      ClosePrice: '825000',
      City: ' Redmond ',
      property_sub_type: 'Single Family Residence',
      TotalLivingAreaSqFt: 2838,
    })
    expect(f).toEqual({ ...base, listPrice: null })
  })

  it('reads Spark fields with the mapper living-area precedence and ignores masks', () => {
    const f = factsFromSparkFields({
      StandardStatus: 'Closed',
      CloseDate: '2026-04-03',
      ClosePrice: 825000,
      City: 'Redmond',
      PropertySubType: 'Single Family Residence',
      BuildingAreaTotal: 2838,
      LivingArea: 2700,
      ListPrice: '****',
    })
    expect(f).toEqual({ ...base, listPrice: null })
  })

  it('takes the first living-area field present even when blank, as the mapper does', () => {
    // The mapper stores null here (toNum(pick(...)) picks the blank first field),
    // so the drift read must too, or the row drifts and is repaired every day.
    const blank = factsFromSparkFields({ TotalLivingAreaSqFt: '', BuildingAreaTotal: 2100 })
    expect(blank.sqft).toBeNull()
    const masked = factsFromSparkFields({ TotalLivingAreaSqFt: '*****', BuildingAreaTotal: 2100 })
    expect(masked.sqft).toBeNull()
    const absent = factsFromSparkFields({ BuildingAreaTotal: 2100 })
    expect(absent.sqft).toBe(2100)
  })

  it('dateOnly keeps the leading calendar date', () => {
    expect(dateOnly('2026-08-14T07:00:00Z')).toBe('2026-08-14')
    expect(dateOnly('not a date')).toBeNull()
    expect(dateOnly(null)).toBeNull()
  })
})
