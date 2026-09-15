import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function readSrc(rel: string): string {
  return readFileSync(resolve(rel), 'utf8')
}

describe('SITE-110 search catalog install', () => {
  it('route page and _v3 import the installed catalog files', () => {
    const page = readSrc('app/search/page.tsx')
    const catalog = readSrc('app/search/_v3/search-catalog.ts')
    const command = readSrc('app/search/_v3/SearchCommand.client.tsx')
    const price = readSrc('app/search/_v3/SearchPriceRail.client.tsx')
    expect(page).toContain("from '@/components/motion/morphing-search'")
    expect(page).toContain("from '@/components/motion/range-slider'")
    expect(page).toContain("from '@/components/ui/command'")
    expect(catalog).toContain("from '@/components/motion/morphing-search'")
    expect(catalog).toContain("from '@/components/motion/range-slider'")
    expect(catalog).toContain("from '@/components/ui/command'")
    expect(command).toContain("from '@/components/ui/command'")
    expect(price).toContain("from '@/components/motion/range-slider'")
  })

  it('search dock does not control MorphingSearch open — the catalog owns the morph', () => {
    const filters = readSrc('components/search/SearchFilters.tsx')
    expect(filters).toContain('V3MorphSearch')
    expect(filters).toContain('SEARCH_PLACE_SEEDS')
    expect(filters).not.toMatch(/open=\{morphOpen\}/)
    expect(filters).toContain('SearchPriceRail')
    expect(filters).toContain('SearchCommand')
    expect(filters).toMatch(/srch-chip-rail hidden min-w-0 flex-1 flex-nowrap/)
    expect(filters).not.toMatch(/srch-chip-rail hidden min-w-0 flex-1 flex-nowrap[^>]*(?:sm:flex)/)
  })

  it('catalog sources keep the demo markers', () => {
    const morph = readSrc('components/motion/morphing-search.tsx')
    expect(morph).toContain('aria-haspopup="dialog"')
    expect(morph).toContain('layoutId')
    expect(morph).toContain('backdrop-blur-xl')
  })
})
