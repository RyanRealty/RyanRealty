import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { flattenSuggestions, EMPTY_SUGGESTIONS } from '../SearchSuggest'
import { suggestToMorphItem } from '../suggest-morph'

function readSrc(rel: string): string {
  return readFileSync(resolve(rel), 'utf8')
}

describe('SITE-121 rematch craft', () => {
  it('city suggestions label the kind, not an inventory count', () => {
    const items = flattenSuggestions({
      ...EMPTY_SUGGESTIONS,
      cities: [{ city: 'Bend', count: 412 }],
    })
    expect(items[0]).toMatchObject({ kind: 'city', label: 'Bend', sublabel: 'City' })
    expect(items[0]?.sublabel).not.toMatch(/\d/)
  })

  it('morph items carry a Command group and an icon', () => {
    const item = suggestToMorphItem({
      href: '/homes-for-sale/bend',
      label: 'Bend',
      sublabel: 'City',
      kind: 'city',
    })
    expect(item.group).toBe('Cities')
    expect(item.icon).toBeTruthy()
  })

  it('filter sheet uses InputGroup unit prefixes and designed checkbox rows', () => {
    const sheet = readSrc('components/search/AllFiltersSheet.tsx')
    expect(sheet).toMatch(/from '@\/components\/ui\/input-group'/)
    expect(sheet).toContain('UnitNumberInput')
    expect(sheet).toContain('InputGroupAddon')
    expect(sheet).toContain("'/sqft'")
    expect(sheet).toContain('sm:grid-cols-2')
    expect(sheet).toContain('min-h-11')
    expect(sheet).toContain('rounded-lg border border-border bg-card')
  })

  it('375 chip rail has arrows and a fade, and the map shows a listing peek', () => {
    expect(readSrc('components/search/SearchFilters.tsx')).toContain('<ChipRail')
    expect(readSrc('components/search/ChipRail.tsx')).toContain('Show more filters')
    expect(readSrc('components/search/search-ledger.css')).toContain('srch-chip-rail__arrow')
    expect(readSrc('components/search/MapSearchView.tsx')).toContain('<MapListingPeek')
    expect(readSrc('components/search/MapListingPeek.tsx')).toContain('data-srch-map-peek')
  })

  it('phone header morph stays typeable and catalog-imported', () => {
    const morph = readSrc('components/motion/morphing-search.tsx')
    expect(morph).toContain('autoFocus')
    expect(morph).toContain('iconOnlyPanelLayout')
    expect(morph).toContain('overlayClassName')
    expect(morph).toMatch(/from ['"]@\/components\/ui\/command['"]/)
    expect(readSrc('components/site/v3/V3ChromeSearch.client.tsx')).toContain('overlayClassName="z-[150]"')
  })
})
