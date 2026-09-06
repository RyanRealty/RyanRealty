import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('adjustment grid stays inside the print box', () => {
  it('uses a fixed six-column table and short headers', () => {
    const css = readFileSync(join(process.cwd(), 'lib/cma/render-css.ts'), 'utf8')
    const pricingPage = readFileSync(join(process.cwd(), 'lib/cma/render-pricing-page.ts'), 'utf8')
    expect(css).toMatch(/table\.comps \{[\s\S]*table-layout: fixed/)
    expect(pricingPage).toContain('renderCompMatrixHtml')
    expect(pricingPage).not.toContain('<th class="v">Time</th>')
    expect(pricingPage).not.toContain('Market conditions (time)')
  })

  it('gives the comps matrix a screen min-width so 375 scrolls instead of concatenating figures', () => {
    const css = readFileSync(join(process.cwd(), 'lib/cma/render-css-sections.ts'), 'utf8')
    const immersive = readFileSync(join(process.cwd(), 'lib/cma/immersive-css.ts'), 'utf8')
    expect(css).toMatch(/@media screen[\s\S]*table\.comp-matrix \{[^}]*min-width:\s*44rem/)
    expect(immersive).toMatch(/table\.comp-matrix\{[^}]*min-width:44rem/)
  })
})
