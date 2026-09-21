import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const dir = readFileSync(resolve('app/cities/_v3/CitiesDirectory.tsx'), 'utf8')
const page = readFileSync(resolve('app/cities/page.tsx'), 'utf8')
const fold = readFileSync(resolve('app/cities/_v3/cities-fold.css'), 'utf8')
const compare = readFileSync(resolve('components/site/v3/V3MosCompare.client.tsx'), 'utf8')

describe('SITE-161 cities directory fold', () => {
  it('opens the index on photographed city doors with live counts', () => {
    expect(page).toMatch(/<CitiesDirectory/)
    expect(page).toMatch(/id="city-directory"/)
    expect(page).toMatch(/href: `\/cities\/\$\{city\.slug\}`/)
    expect(dir).toMatch(/InfiniteMasonry/)
    expect(dir).toMatch(/V3Number/)
    expect(dir).toMatch(/city\.countLabel/)
    expect(dir).toMatch(/for sale/)
  })

  it('puts named cities above Atlas at 375 and the combobox above the MOS scale', () => {
    expect(fold).toMatch(/\.cities-fold__directory \{\s*order: 1;/s)
    expect(fold).toMatch(/\.cities-fold__drawing \{\s*order: 3;/s)
    expect(compare.indexOf('data-taste="city-combo"')).toBeLessThan(
      compare.indexOf('v3-mos-compare__field'),
    )
    expect(compare).toMatch(/ComboboxInput/)
    expect(compare).toMatch(/Search a city/)
  })
})
