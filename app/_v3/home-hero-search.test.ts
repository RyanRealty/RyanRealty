import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { filterHomeFieldByCity } from './home-field-items'
import { preferPlaceHero } from './home-constants'

const PAGE = readFileSync(resolve('app/page.tsx'), 'utf8')
const SEARCH = readFileSync(resolve('app/_v3/HomeHeroSearch.client.tsx'), 'utf8')

describe('homepage hero search uses the public search stack', () => {
  it('mounts HomeHeroSearch on the Stage', () => {
    expect(PAGE).toMatch(/<HomeHeroSearch/)
    expect(PAGE).toMatch(/<V3Stage/)
    expect(PAGE).toMatch(/See homes/)
  })

  it('reuses SearchSuggest and searchHrefForQuery', () => {
    expect(SEARCH).toContain("from '@/components/search/SearchSuggest'")
    expect(SEARCH).toContain('<SearchSuggestPanel')
    expect(SEARCH).toContain("from '@/lib/parse-search-query'")
    expect(SEARCH).toContain('searchHrefForQuery')
    expect(SEARCH).toContain('City, community, or address')
  })
})

describe('preferPlaceHero', () => {
  it('uses the live url when present and the fallback when not', () => {
    expect(preferPlaceHero(' https://cdn.example/hero.jpg ', '/images/kb/bend.jpg')).toBe(
      'https://cdn.example/hero.jpg',
    )
    expect(preferPlaceHero(null, '/images/kb/bend.jpg')).toBe('/images/kb/bend.jpg')
    expect(preferPlaceHero('   ', '/images/kb/bend.jpg')).toBe('/images/kb/bend.jpg')
  })
})

describe('filterHomeFieldByCity', () => {
  it('returns the full set when no town is selected', () => {
    const items = [
      { id: '1', href: '/a', priceLabel: '$1', title: 'A', city: 'Bend' },
      { id: '2', href: '/b', priceLabel: '$2', title: 'B', city: 'Redmond' },
    ]
    expect(filterHomeFieldByCity(items, null)).toHaveLength(2)
  })
})
