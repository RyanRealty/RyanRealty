import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const catalog = readFileSync('app/search/_v3/search-catalog.ts', 'utf8')
const page = readFileSync('app/search/page.tsx', 'utf8')

describe('SITE-121 search route catalog imports', () => {
  it('route _v3 imports morphing-search, range-slider, and command', () => {
    expect(catalog).toMatch(/from '@\/components\/motion\/morphing-search'/)
    expect(catalog).toMatch(/from '@\/components\/motion\/range-slider'/)
    expect(catalog).toMatch(/from '@\/components\/ui\/command'/)
  })

  it('the search page imports the route catalog module', () => {
    expect(page).toContain("from './_v3/search-catalog'")
    expect(page).toContain('SEARCH_CATALOG_READY')
  })

  it('filter-bar morph opens on tap, not only after suggestions land', () => {
    const filters = readFileSync('components/search/SearchFilters.tsx', 'utf8')
    const morph = readFileSync('components/site/v3/V3MorphSearch.tsx', 'utf8')
    expect(filters).toContain('open={locationOpen}')
    expect(filters).not.toContain('open={morphOpen}')
    expect(morph).toContain('overlayClassName')
  })
})
