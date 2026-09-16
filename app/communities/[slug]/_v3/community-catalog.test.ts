import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('community-catalog SITE-94', () => {
  it('imports the installed beui-number source', () => {
    const src = readFileSync(new URL('./community-catalog.ts', import.meta.url), 'utf8')
    expect(src).toMatch(/from ['"]@\/components\/motion\/number['"]/)
  })

  it('imports the installed beui scroll-animation source (SITE-116 round 2)', () => {
    const src = readFileSync(new URL('./community-catalog.ts', import.meta.url), 'utf8')
    expect(src).toMatch(/from ['"]@\/components\/motion\/scroll-reveal['"]/)
  })

  it('imports the installed beui combobox source (SITE-116 round 3)', () => {
    const src = readFileSync(new URL('./community-catalog.ts', import.meta.url), 'utf8')
    expect(src).toMatch(/from ['"]@\/components\/motion\/combobox['"]/)
  })

  it('imports the installed beautifului insight-cards source, and the census house primitive imports it too (SITE-116 round 4)', () => {
    const src = readFileSync(new URL('./community-catalog.ts', import.meta.url), 'utf8')
    expect(src).toMatch(/from ['"]@\/components\/motion\/insight-cards['"]/)
    const island = readFileSync(new URL('../../../../components/site/v3/V3CensusInsight.client.tsx', import.meta.url), 'utf8')
    expect(island).toMatch(/from ['"]@\/components\/motion\/insight-cards['"]/)
    expect(island).toContain('<InsightCards')
    expect(island).toContain('<AllocationCard')
    const census = readFileSync(new URL('../../../../components/site/v3/V3Census.tsx', import.meta.url), 'utf8')
    expect(census).toContain('<V3CensusInsight')
  })

  it('the finder opens on the whole place: a root row selected by default (SITE-116 round 4)', () => {
    const finder = readFileSync(new URL('../../../../components/site/v3/V3PlaceFinder.client.tsx', import.meta.url), 'utf8')
    expect(finder).toContain('root?: V3PlaceFinderItem | null')
    expect(finder).toContain('value={rootHref}')
    expect(finder).toContain('if (!href || href === rootHref) return')
  })

  it('one combobox house primitive: the finder composes V3TypeCombobox, which imports the installed source', () => {
    // The catalog names components/site/v3/V3TypeCombobox.client.tsx as
    // beui-combobox's house (SITE-92 r4). The finder must build on it, never
    // stand beside it as a second wrapper of the same catalog file.
    const finder = readFileSync(new URL('../../../../components/site/v3/V3PlaceFinder.client.tsx', import.meta.url), 'utf8')
    expect(finder).toMatch(/from ['"]\.\/V3TypeCombobox\.client['"]/)
    expect(finder).toContain('<V3TypeCombobox')
    expect(finder).not.toMatch(/from ['"]@\/components\/motion\/combobox['"]/)
    const house = readFileSync(new URL('../../../../components/site/v3/V3TypeCombobox.client.tsx', import.meta.url), 'utf8')
    expect(house).toMatch(/from ['"]@\/components\/motion\/combobox['"]/)
    expect(house).toContain('ComboboxTrigger')
    expect(house).toContain('ComboboxList')
    const index = readFileSync(new URL('../../../../components/site/v3/V3PlaceIndex.tsx', import.meta.url), 'utf8')
    expect(index).toContain('<V3PlaceFinder')
  })
})
