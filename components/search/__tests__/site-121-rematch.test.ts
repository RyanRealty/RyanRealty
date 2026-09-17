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

  it('morph items carry a catalog title, description, and icon', () => {
    const item = suggestToMorphItem({
      href: '/homes-for-sale/bend',
      label: 'Bend',
      sublabel: 'City',
      kind: 'city',
    })
    expect(item.description).toMatch(/Cities · City/)
    expect(item.icon).toBeTruthy()
    expect(item).not.toHaveProperty('group')
  })

  it('filter sheet uses catalog Field checkbox rows', () => {
    const sheet = readSrc('components/search/AllFiltersSheet.tsx')
    expect(sheet).toMatch(/from '@\/components\/ui\/field'/)
    expect(sheet).toContain('FieldGroup')
    expect(sheet).toContain('data-slot="checkbox-group"')
    expect(sheet).toContain('orientation="horizontal"')
    expect(readSrc('components/ui/checkbox.tsx')).toContain('border-primary')
    expect(readSrc('components/ui/checkbox.tsx')).toContain('from "lucide-react"')
    expect(readSrc('components/ui/checkbox.tsx')).toContain('rounded-sm')
  })

  it('phone header morph stays typeable and catalog-imported', () => {
    const morph = readSrc('components/motion/morphing-search.tsx')
    expect(morph).toContain('autoFocus')
    expect(morph).toContain('iconOnlyPanelLayout')
    expect(morph).toContain('overlayClassName')
    expect(morph).toContain('aria-haspopup="dialog"')
    expect(morph).toContain('layoutId')
    expect(morph).toContain('backdrop-blur-xl')
    expect(morph).toContain('type="button"')
    expect(morph).not.toMatch(/from ['"]@\/components\/ui\/command['"]/)
    expect(readSrc('components/site/v3/V3ChromeSearch.client.tsx')).toContain('overlayClassName="z-[150]"')
    expect(readSrc('components/site/v3/V3ChromeSearch.client.tsx')).toMatch(/iconOnly/)
    expect(readSrc('components/site/v3/V3ChromeSearch.client.tsx')).not.toMatch(/matchMedia/)
    expect(readSrc('components/search/SearchFilters.tsx')).toMatch(/iconOnly/)
    expect(readSrc('components/site/v3/V3MorphSearch.css')).not.toMatch(/backdrop-filter:\s*none/)
    expect(readSrc('components/site/v3/V3Chrome.css')).toContain('rr-chrome-search-open')
  })
})
