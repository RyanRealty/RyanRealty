import { describe, it, expect } from 'vitest'
import { parseSearchQuery, searchHrefForQuery } from './parse-search-query'

describe('parseSearchQuery — plain-language → structured filters', () => {
  it('beds + maxPrice + city + a keyword feature', () => {
    const r = parseSearchQuery('3 bed under $800k in Bend with a shop')
    expect(r.beds).toBe('3')
    expect(r.maxPrice).toBe('800000')
    expect(r.city).toBe('Bend')
    expect(r.keywords).toBe('shop')
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
