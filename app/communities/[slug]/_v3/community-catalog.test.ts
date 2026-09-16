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

  it('the house finder imports the installed combobox and V3PlaceIndex mounts it', () => {
    const finder = readFileSync(new URL('../../../../components/site/v3/V3PlaceFinder.client.tsx', import.meta.url), 'utf8')
    expect(finder).toMatch(/from ['"]@\/components\/motion\/combobox['"]/)
    expect(finder).toContain('ComboboxTrigger')
    expect(finder).toContain('ComboboxList')
    const index = readFileSync(new URL('../../../../components/site/v3/V3PlaceIndex.tsx', import.meta.url), 'utf8')
    expect(index).toContain('<V3PlaceFinder')
  })
})
