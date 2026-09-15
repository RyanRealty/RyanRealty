import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { morphCatalogItems, morphHomesFromListings } from './search-places'

function readSrc(rel: string): string {
  return readFileSync(resolve(rel), 'utf8')
}

describe('SITE-110 search catalog install', () => {
  it('route page and _v3 import the installed catalog files', () => {
    const page = readSrc('app/search/page.tsx')
    const catalog = readSrc('app/search/_v3/search-catalog.ts')
    const command = readSrc('app/search/_v3/SearchCommand.client.tsx')
    const price = readSrc('app/search/_v3/SearchPriceRail.client.tsx')
    const morph = readSrc('app/search/_v3/SearchMorph.client.tsx')
    const sheet = readSrc('app/search/_v3/SearchFiltersSheet.client.tsx')
    const atlas = readSrc('app/search/_v3/SearchAtlas.client.tsx')
    expect(page).toContain("from '@/components/motion/morphing-search'")
    expect(page).toContain('morphHomes={jsonLdListings}')
    expect(page).toContain("from '@/components/motion/range-slider'")
    expect(page).toContain("from '@/components/ui/command'")
    expect(page).toContain("from '@/components/ui/empty'")
    expect(page).toContain('SearchAtlasPane')
    expect(page).toContain('atlasMap')
    expect(catalog).toContain("from '@/components/motion/morphing-search'")
    expect(catalog).toContain("from '@/components/motion/range-slider'")
    expect(catalog).toContain("from '@/components/ui/command'")
    expect(catalog).toContain("from '@/components/ui/empty'")
    expect(catalog).toContain('V3Sheet')
    expect(catalog).toContain('V3Atlas')
    expect(command).toContain("from '@/components/ui/command'")
    expect(command).toContain('CommandShortcut')
    expect(command).toContain('No command matches that.')
    expect(price).toContain("from '@/components/motion/range-slider'")
    expect(price).toContain("from '@/components/site/v3/V3Range.logic'")
    expect(price).toContain('snapToStops')
    expect(price).toContain('aria-label="Minimum ask"')
    expect(price).toContain('aria-label="Maximum ask"')
    expect(price.match(/<RangeSlider/g)?.length).toBe(2)
    expect(morph).toContain("from '@/components/motion/morphing-search'")
    expect(morph).toContain('<MorphingSearch')
    expect(morph).not.toMatch(/\biconOnly\b/)
    expect(morph).not.toContain('w-full max-w-full')
    expect(morph).not.toMatch(/from ['"]@\/components\/site\/v3['"]/)
    expect(morph).not.toContain('<V3MorphSearch')
    expect(sheet).toContain('V3Sheet')
    expect(sheet).toContain('surface="drawer"')
    expect(sheet).toContain('showProgress={false}')
    expect(sheet).toContain("from '@/components/motion/range-slider'")
    expect(sheet).toContain('<RangeSlider')
    expect(sheet).toContain('aria-label="Minimum ask"')
    expect(sheet).toContain('aria-label="Maximum ask"')
    expect(sheet.match(/<RangeSlider/g)?.length).toBe(2)
    expect(sheet).toContain("from '@/components/ui/checkbox'")
    expect(sheet).toContain('<Checkbox')
    expect(sheet).not.toContain("kind: 'facts'")
    expect(sheet).toContain("kind: 'select'")
    expect(sheet).not.toContain('How many bedrooms')
    expect(sheet).not.toContain('STEP 1')
    expect(atlas).toContain('<V3Atlas')
    expect(atlas).toContain('quiet')
    expect(atlas).toContain('markScale="ask"')
    expect(readSrc('components/search/MapSearchView.tsx')).toContain("from '@/components/ui/empty'")
    expect(readSrc('components/search/MapSearchView.tsx')).toContain('<Empty')
    expect(readSrc('components/motion/morphing-search.tsx')).toContain('bg-transparent')
    expect(readSrc('components/motion/morphing-search.tsx')).not.toContain('bg-foreground/40')
  })

  it('search dock does not control MorphingSearch open — the catalog owns the morph', () => {
    const filters = readSrc('components/search/SearchFilters.tsx')
    expect(filters).toContain('SearchMorph')
    expect(filters).not.toContain('V3MorphSearch')
    expect(filters).toContain('morphCatalogItems')
    expect(filters).toContain('morphHomesFromListings')
    expect(filters).not.toMatch(/open=\{morphOpen\}/)
    expect(filters).toContain('onOpenChange')
    expect(filters).toContain('placeholder="Search"')
    expect(filters).not.toContain('Find a home')
    expect(filters).not.toContain('Address, city, or community')
    expect(filters).not.toContain('<V3Range')
    expect(filters).toContain('SearchPriceRail')
    expect(filters).toContain('morphOpen ? null')
    expect(filters).toContain('data-search-morph-open')
    expect(filters).toContain('catalog portal only')
    expect(filters).toContain('SearchCommand')
    expect(filters).toContain('SearchFiltersSheet')
    expect(filters).not.toContain('AllFiltersSheet')
    expect(filters).toMatch(/srch-chip-rail hidden min-w-0 flex-1 flex-nowrap/)
    expect(filters).not.toMatch(/srch-chip-rail hidden min-w-0 flex-1 flex-nowrap[^>]*(?:sm:flex)/)
  })

  it('catalog sources keep the official demo markers', () => {
    const morph = readSrc('components/motion/morphing-search.tsx')
    const range = readSrc('components/motion/range-slider.tsx')
    expect(morph).toContain('aria-haspopup="dialog"')
    expect(morph).toContain('layoutId')
    expect(morph).toContain('backdrop-blur-xl')
    expect(morph).toContain('data-v3-morph="dialog"')
    expect(morph).toContain('data-v3-morph="panel"')
    expect(morph).toContain('clipPath')
    expect(range).toContain('bg-primary')
    expect(range).toContain('showTicks')
    const houseCss = readSrc('components/site/v3/V3MorphSearch.css')
    expect(houseCss).not.toContain('backdrop-filter: none')
    expect(houseCss).not.toContain("[data-v3-morph='panel']")
  })

  it('empty-open listing rows are results with ask, not a Places city list', () => {
    const items = morphHomesFromListings([
      {
        ListNumber: '220123456',
        StreetNumber: '19669',
        StreetName: 'Harvard',
        StreetSuffix: 'Place',
        City: 'Bend',
        PostalCode: '97702',
        ListPrice: 775000,
        BedroomsTotal: 4,
      },
      { ListNumber: null, ListingKey: 'x', StreetNumber: null, StreetName: null },
    ])
    expect(items).toHaveLength(1)
    expect(items[0]?.title).toBe('$775,000')
    expect(items[0]?.description).toContain('4 bd')
    expect(items[0]?.description).toContain('Bend')
    expect(items[0]?.description).toContain('19669 Harvard Place')
    expect(items[0]?.id).toMatch(/^\/homes-for-sale\//)
    expect(items.map((item) => item.title)).not.toContain('Bend')
    expect(items.map((item) => item.title)).not.toContain('19669 Harvard Place')
  })

  it('catalog place seeds stay available as a fallback', () => {
    const catalog = morphCatalogItems()
    expect(catalog[0]?.title).toBe('Bend')
    expect(catalog[0]?.icon).toBeTruthy()
  })
})
