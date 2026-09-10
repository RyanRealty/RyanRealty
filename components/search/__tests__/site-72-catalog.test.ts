import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function readSrc(rel: string): string {
  return readFileSync(resolve(rel), 'utf8')
}

describe('SITE-72 catalog wiring', () => {
  it('search dock adapts morphing search, command list, and the price ticks', () => {
    const filters = readSrc('components/search/SearchFilters.tsx')
    expect(filters).toMatch(/V3MorphSearch/)
    expect(filters).toMatch(/srch-morph/)
    expect(filters).toMatch(/srch-command/)
    expect(filters).toMatch(/V3Range/)
    expect(readSrc('components/site/v3/V3MorphSearch.tsx')).toMatch(
      /from '@\/components\/motion\/morphing-search'/,
    )
    expect(readSrc('components/site/v3/V3Range.tsx')).toMatch(
      /from '@\/components\/motion\/range-slider'/,
    )
    expect(filters).toMatch(/srch-price-rail/)
    expect(filters).toMatch(/V3_PRICE_STOPS/)
    expect(filters).toMatch(/commitPrice/)
  })

  it('All-filters is the house sheet and price uses the same ticks', () => {
    const sheet = readSrc('components/search/AllFiltersSheet.tsx')
    expect(sheet).toMatch(/srch-sheet/)
    expect(sheet).toMatch(/def\.key === 'price'/)
    expect(sheet).toMatch(/V3Range/)
    expect(sheet).toMatch(/srch-command/)
  })

  it('split and map-only canvases paint the cream field, not a muted flash', () => {
    const split = readSrc('components/search/MapSearchView.tsx')
    const mapOnly = readSrc('components/search/HideAwareSearchMap.tsx')
    expect(split).toMatch(/srch-map-field/)
    expect(mapOnly).toMatch(/srch-map-field/)
  })

  
  it('URL writers read the live query at event time so bbox cannot drop a price commit', () => {
    const filters = readSrc('components/search/SearchFilters.tsx')
    const split = readSrc('components/search/MapSearchView.tsx')
    const mapOnly = readSrc('components/search/HideAwareSearchMap.tsx')
    expect(filters).toMatch(/readUrlSearchParams\(\)/)
    expect(split).toMatch(/readUrlSearchParams\(\)/)
    expect(mapOnly).toMatch(/readUrlSearchParams\(\)/)
  })

  it('the rail still opens on a claim sentence sourced from the visible set', () => {
    const view = readSrc('components/search/MapSearchView.tsx')
    expect(view).toMatch(/srch-claim/)
    expect(view).toMatch(/homes are drawn on this map/)
    expect(view).toMatch(/publishWholePropertyAmount/)
  })
})
