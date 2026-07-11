import { describe, it, expect } from 'vitest'
import { parseSearchQuery, describeParsedSearch, searchHrefForQuery } from './parse-search-query'

describe('parseSearchQuery — plain-language → structured filters', () => {
  it('beds + maxPrice + city + a structured shop flag (KEYWORD_TERMS retired)', () => {
    const r = parseSearchQuery('3 bed under $800k in Bend with a shop')
    expect(r.beds).toBe('3')
    expect(r.maxPrice).toBe('800000')
    expect(r.city).toBe('Bend')
    expect(r.shop).toBe('1')
    expect(r.keywords).toBeUndefined()
  })

  it('the spec example — hyphenated bedroom + mountain views', () => {
    const r = parseSearchQuery('3-bedroom with mountain views under $600k in Bend')
    expect(r.beds).toBe('3')
    expect(r.hasView).toBe('1')
    expect(r.maxPrice).toBe('600000')
    expect(r.city).toBe('Bend')
  })

  it('min price + baths + city', () => {
    const r = parseSearchQuery('4 bath over 1m in sunriver')
    expect(r.baths).toBe('4')
    expect(r.minPrice).toBe('1000000')
    expect(r.city).toBe('Sunriver')
  })

  it('bare city name', () => {
    expect(parseSearchQuery('redmond')).toEqual({ city: 'Redmond' })
  })

  it('free text with no structured terms falls back to keywords', () => {
    expect(parseSearchQuery('modern farmhouse')).toEqual({ keywords: 'modern farmhouse' })
  })

  it('pool + waterfront + golf flags', () => {
    const r = parseSearchQuery('home with a pool and golf in Redmond')
    expect(r.hasPool).toBe('1')
    expect(r.hasGolfCourse).toBe('1')
    expect(r.city).toBe('Redmond')
  })

  it('acreage + bare price (no k) treated as thousands', () => {
    const r = parseSearchQuery('5 acres under 900 in Tumalo')
    expect(r.lotAcresMin).toBe('5')
    expect(r.maxPrice).toBe('900000')
    expect(r.city).toBe('Tumalo')
  })

  it('empty query → no params', () => {
    expect(parseSearchQuery('  ')).toEqual({})
  })

  it('searchHrefForQuery builds a /homes-for-sale URL', () => {
    const href = searchHrefForQuery('3 bed in Bend')
    expect(href.startsWith('/homes-for-sale?')).toBe(true)
    expect(href).toContain('beds=3')
    expect(href).toContain('city=Bend')
  })
})

describe('parseSearchQuery — registry-driven grammar (contract 2026-07-11)', () => {
  it('spoken numbers + registry booleans: three bed under 800k with fireplace and shop', () => {
    const r = parseSearchQuery('three bed under 800k in bend with a fireplace and a shop')
    expect(r.beds).toBe('3')
    expect(r.maxPrice).toBe('800000')
    expect(r.city).toBe('Bend')
    expect(r.hasFireplace).toBe('1')
    expect(r.shop).toBe('1')
    expect(r.keywords).toBeUndefined()
  })

  it('spoken price words: under eight hundred k', () => {
    const r = parseSearchQuery('three bed under eight hundred k in bend')
    expect(r.beds).toBe('3')
    expect(r.maxPrice).toBe('800000')
    expect(r.city).toBe('Bend')
  })

  it('single level + rv parking + cascade views in redmond', () => {
    const r = parseSearchQuery('single level with rv parking and cascade views in redmond')
    expect(r.singleLevel).toBe('1')
    expect(r.rvParking).toBe('1')
    expect(r.viewTypes).toBe('Cascade Mountains')
    expect(r.hasView).toBe('1')
    expect(r.city).toBe('Redmond')
    expect(r.keywords).toBeUndefined()
  })

  it('condo with no hoa built after 2015', () => {
    const r = parseSearchQuery('condo with no hoa built after 2015')
    expect(r.propertySubType).toBe('Condominium')
    expect(r.noHoa).toBe('1')
    expect(r.yearBuiltMin).toBe('2015')
    expect(r.hoaMonthlyMax).toBeUndefined()
  })

  it('sold homes over 2000 square feet in sisters', () => {
    const r = parseSearchQuery('sold homes over 2000 square feet in sisters')
    expect(r.statusFilter).toBe('closed')
    expect(r.minSqFt).toBe('2000')
    expect(r.minPrice).toBeUndefined()
    expect(r.city).toBe('Sisters')
  })

  it('owner financing on well and septic 5 acres', () => {
    const r = parseSearchQuery('owner financing on well and septic 5 acres')
    expect(r.ownerWillCarry).toBe('1')
    expect(r.onWell).toBe('1')
    expect(r.onSeptic).toBe('1')
    expect(r.lotAcresMin).toBe('5')
  })

  it('price range: between 500k and 800k', () => {
    const r = parseSearchQuery('between 500k and 800k in bend')
    expect(r.minPrice).toBe('500000')
    expect(r.maxPrice).toBe('800000')
  })

  it('hoa under N is monthly HOA, not price', () => {
    const r = parseSearchQuery('hoa under 200 a month in bend')
    expect(r.hoaMonthlyMax).toBe('200')
    expect(r.maxPrice).toBeUndefined()
  })

  it('payment under N a month is monthly payment, not price', () => {
    const r = parseSearchQuery('payment under 3000 a month in redmond')
    expect(r.monthlyPaymentMax).toBe('3000')
    expect(r.maxPrice).toBeUndefined()
  })

  it('literal range phrases: new this week', () => {
    expect(parseSearchQuery('new this week in bend').daysOnMarket).toBe('7')
  })

  it('multi values merge as CSV of canonical DB strings', () => {
    const r = parseSearchQuery('hardwood floors and carpet with a gas fireplace')
    expect(r.flooring).toBe('Hardwood,Carpet')
    expect(r.fireplaceTypes).toBe('Gas')
  })

  it('pending → statusFilter pending', () => {
    expect(parseSearchQuery('pending in bend').statusFilter).toBe('pending')
  })

  it('remodeled and acreage stay keyword-able', () => {
    const r = parseSearchQuery('remodeled home on acreage in bend')
    expect(r.city).toBe('Bend')
    expect(r.keywords).toBe('remodeled acreage')
  })

  it('word boundary: carved detail does not set rvParking', () => {
    const r = parseSearchQuery('carved detail')
    expect(r.rvParking).toBeUndefined()
    expect(r).toEqual({ keywords: 'carved detail' })
  })

  it('word boundary: graduate does not set guest house or anything adu-ish', () => {
    const r = parseSearchQuery('graduate')
    expect(r.guestHouse).toBeUndefined()
    expect(r).toEqual({ keywords: 'graduate' })
  })
})

describe('describeParsedSearch — summary chips', () => {
  it('features + price + city read as chips with formatted currency', () => {
    const chips = describeParsedSearch(
      parseSearchQuery('three bed under 800k in bend with a fireplace and a shop'),
    )
    expect(chips).toContain('Fireplace')
    expect(chips).toContain('Shop / workshop')
    expect(chips).toContain('3+ beds')
    expect(chips).toContain('Under $800,000')
    expect(chips).toContain('Bend')
  })

  it('multi values become their own chips and hasView folds into the view type', () => {
    const chips = describeParsedSearch(
      parseSearchQuery('single level with cascade views in redmond'),
    )
    expect(chips).toContain('Single level')
    expect(chips).toContain('Cascade Mountains')
    expect(chips).not.toContain('Has a view')
  })

  it('status and range chips', () => {
    const chips = describeParsedSearch(parseSearchQuery('sold homes over 2000 square feet in sisters'))
    expect(chips).toContain('Sold')
    expect(chips).toContain('2,000+ sqft')
    expect(chips).toContain('Sisters')
  })
})

describe('spoken money multipliers (review 2026-07-11)', () => {
  it('parses "under 1.5 million" as $1,500,000', () => {
    const p = parseSearchQuery('homes under 1.5 million in bend')
    expect(p.maxPrice).toBe('1500000')
    expect(p.keywords).toBeUndefined()
  })
  it('parses "under a million"', () => {
    expect(parseSearchQuery('under a million').maxPrice).toBe('1000000')
  })
  it('parses "half a million"', () => {
    expect(parseSearchQuery('over half a million').minPrice).toBe('500000')
  })
  it('translates sold intent into the status param in hrefs', () => {
    expect(searchHrefForQuery('sold homes in bend')).toContain('status=Sold')
  })
})

describe('attack-hardening (2026-07-11)', () => {
  it('"between 1 and 2 million" is $1M..$2M, not $1,000', () => {
    const p = parseSearchQuery('between 1 and 2 million in bend')
    expect(p.minPrice).toBe('1000000')
    expect(p.maxPrice).toBe('2000000')
  })
  it('"over 2000 sqft under 3000 sqft" sets sqft bounds, not a price', () => {
    const p = parseSearchQuery('over 2000 sqft under 3000 sqft')
    expect(p.minSqFt).toBe('2000')
    expect(p.maxSqFt).toBe('3000')
    expect(p.maxPrice).toBeUndefined()
  })
  it('"55+ community" maps to seniorCommunity', () => {
    expect(parseSearchQuery('55+ community in redmond').seniorCommunity).toBe('1')
  })
  it('inverted price range drops the contradictory ceiling', () => {
    const p = parseSearchQuery('over 500k under 400k')
    expect(p.minPrice).toBe('500000')
    expect(p.maxPrice).toBeUndefined()
  })
  it('"near a c" does not force a Central Air cooling filter', () => {
    const p = parseSearchQuery('home near a c store in bend')
    expect(p.coolingTypes).toBeUndefined()
  })
})
