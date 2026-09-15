import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const chrome = readFileSync('components/site/v3/V3Chrome.tsx', 'utf8')
const search = readFileSync('components/site/v3/V3ChromeSearch.client.tsx', 'utf8')

describe('V3Chrome catalog Search', () => {
  it('mounts MorphingSearch via V3ChromeSearch (catalog install, not house invent)', () => {
    expect(chrome).toContain("import { V3ChromeSearch } from './V3ChromeSearch.client'")
    expect(chrome).toContain('<V3ChromeSearch />')
    expect(search).toContain("from '@/components/motion/morphing-search'")
    expect(search).toContain('MorphingSearch')
    expect(search).toContain('useSearchSuggest')
  })
})
