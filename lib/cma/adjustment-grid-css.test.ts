import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('adjustment grid stays inside the print box', () => {
  it('uses a fixed six-column table and short headers', () => {
    const css = readFileSync(join(process.cwd(), 'lib/cma/render-css.ts'), 'utf8')
    const pricingPage = readFileSync(join(process.cwd(), 'lib/cma/render-pricing-page.ts'), 'utf8')
    expect(css).toMatch(/table\.comps \{[\s\S]*table-layout: fixed/)
    expect(pricingPage).toContain('<th class="v">Time</th>')
    expect(pricingPage).toContain('<th class="v">Size</th>')
    expect(pricingPage).not.toContain('Market conditions (time)')
  })
})
