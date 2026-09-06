import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync(resolve('app/months-of-supply/page.tsx'), 'utf8')

describe('/months-of-supply first screen', () => {
  it('keeps the URL, prints the formula, and draws the two-bar instead of a 16-tile dump', () => {
    expect(SRC).toMatch(/path: '\/months-of-supply'/)
    expect(SRC).toMatch(/note=\{v3Text\(MOS_METHODOLOGY_CLAUSE\)\}/)
    expect(SRC).toMatch(/buildMosSupplyChart/)
    expect(SRC).toMatch(/chart=\{mosChart\}/)
    expect(SRC).toMatch(/foldAfter=\{2\}/)
    expect(SRC).toMatch(/label: v3Text\('homes for sale'\)/)
    expect(SRC).toMatch(/label: v3Text\('a month of sales'\)/)
    expect(SRC).not.toMatch(/label: v3Text\('months of supply in Central Oregon'\)/)
  })
})
