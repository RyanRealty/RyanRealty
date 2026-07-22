/**
 * W4.1 merge contracts for the ONE search component (SearchSuggest).
 *
 * 1. Category coverage: every category the suggestions backend returns
 *    (SearchSuggestionsResult keys) is rendered by flattenSuggestions —
 *    addresses included (the "3480" class the old inline dropdown dropped).
 *    A category added to the backend without a flatten branch fails here.
 * 2. Structured fields: city / subdivision / zip picks carry the structured
 *    fields the filter bar needs to apply filters in place.
 * 3. Merge lock: both live consumers (SearchFilters + KbNav) import the shared
 *    engine — no re-forked inline dropdowns.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { flattenSuggestions, EMPTY_SUGGESTIONS, SUGGEST_GROUP_LABELS } from '../SearchSuggest'
import type { SearchSuggestionsResult } from '@/app/actions/listings'

const FULL_FIXTURE: SearchSuggestionsResult = {
  addresses: [{ label: '3480 NW Colver Cir, Bend, OR, 97703', href: '/listing/220100001' }],
  cities: [{ city: 'Bend', count: 412 }],
  subdivisions: [{ city: 'Bend', subdivisionName: 'Awbrey Butte', count: 12 }],
  neighborhoods: [
    {
      cityName: 'Bend',
      citySlug: 'bend',
      neighborhoodName: 'Mountain View',
      neighborhoodSlug: 'mountain-view',
      href: '/cities/bend/mountain-view',
    },
  ],
  zips: [{ postalCode: '97703', city: 'Bend', count: 88, href: '/homes-for-sale?postalCode=97703' }],
  brokers: [{ label: 'Matt Ryan', href: '/team/matt-ryan' }],
  reports: [{ label: 'Market report · Bend', href: '/reports/explore?city=Bend' }],
  pages: [{ label: 'Sell your home', href: '/sell', kind: 'page' }],
}

describe('flattenSuggestions category coverage', () => {
  it('renders one item for every backend category', () => {
    const items = flattenSuggestions(FULL_FIXTURE)
    const kinds = new Set(items.map((i) => i.kind))
    // Every key of SearchSuggestionsResult must map to a rendered kind.
    const backendCategories = Object.keys(FULL_FIXTURE) as Array<keyof SearchSuggestionsResult>
    expect(backendCategories).toHaveLength(8)
    expect(kinds).toEqual(
      new Set(['address', 'city', 'subdivision', 'neighborhood', 'zip', 'broker', 'report', 'page'])
    )
    expect(items).toHaveLength(8)
  })

  it('every rendered kind has a group label (panel header contract)', () => {
    for (const item of flattenSuggestions(FULL_FIXTURE)) {
      expect(SUGGEST_GROUP_LABELS[item.kind]).toBeTruthy()
    }
  })

  it('addresses flatten first — the "3480" class is visible at the top', () => {
    const items = flattenSuggestions(FULL_FIXTURE)
    expect(items[0]).toMatchObject({
      kind: 'address',
      label: '3480 NW Colver Cir, Bend, OR, 97703',
      href: '/listing/220100001',
    })
  })

  it('city / subdivision / zip picks carry structured fields for in-place filter apply', () => {
    const items = flattenSuggestions(FULL_FIXTURE)
    expect(items.find((i) => i.kind === 'city')).toMatchObject({ city: 'Bend' })
    expect(items.find((i) => i.kind === 'subdivision')).toMatchObject({
      city: 'Bend',
      subdivisionName: 'Awbrey Butte',
    })
    expect(items.find((i) => i.kind === 'zip')).toMatchObject({ postalCode: '97703' })
  })

  it('null and empty results flatten to []', () => {
    expect(flattenSuggestions(null)).toEqual([])
    expect(flattenSuggestions(EMPTY_SUGGESTIONS)).toEqual([])
  })

  it('caps each category so the dropdown stays scannable', () => {
    const many: SearchSuggestionsResult = {
      ...EMPTY_SUGGESTIONS,
      addresses: Array.from({ length: 30 }, (_, i) => ({
        label: `${1000 + i} NW Test St, Bend, OR`,
        href: `/listing/${i}`,
      })),
    }
    expect(flattenSuggestions(many).length).toBeLessThanOrEqual(10)
  })
})

describe('merge lock — one search component', () => {
  const root = join(__dirname, '..', '..', '..')

  it('SearchFilters renders the shared panel, not a re-forked inline dropdown', () => {
    const src = readFileSync(join(root, 'components/search/SearchFilters.tsx'), 'utf8')
    expect(src).toContain("from '@/components/search/SearchSuggest'")
    expect(src).toContain('<SearchSuggestPanel')
  })

  it('KbNav global header search renders the shared panel', () => {
    const src = readFileSync(join(root, 'components/site/kb/KbNav.client.tsx'), 'utf8')
    expect(src).toContain("from '@/components/search/SearchSuggest'")
    expect(src).toContain('<SearchSuggestPanel')
  })

  it('the orphaned SmartSearch component stays deleted', () => {
    expect(() => readFileSync(join(root, 'components/SmartSearch.tsx'))).toThrow()
  })
})
