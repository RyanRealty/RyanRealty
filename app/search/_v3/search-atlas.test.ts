import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..', '..')

describe('search-atlas route catalog', () => {
  it('re-exports the named catalog sources', () => {
    const src = readFileSync(join(ROOT, 'app/search/_v3/search-catalog.ts'), 'utf8')
    expect(src).toContain('@/components/motion/morphing-search')
    expect(src).toContain('@/components/motion/range-slider')
    expect(src).toContain('@/components/ui/command')
    expect(src).toContain('@/components/ui/checkbox')
    expect(src).toContain('@/components/ui/empty')
    expect(src).toContain('@/components/ui/input')
    expect(src).toContain('@/components/ui/pagination')
  })

  it('prints a visible comparison label', () => {
    const src = readFileSync(join(ROOT, 'app/search/_v3/SearchCompareMark.tsx'), 'utf8')
    expect(src).toContain('srch-ppsf__label')
    expect(src).toContain('bandReadout')
  })
})
