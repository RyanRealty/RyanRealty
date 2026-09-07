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

  it('letter: stack on screen / matrix on print (C1/C4); immersive /view: matrix on screen', () => {
    const css = readFileSync(join(process.cwd(), 'lib/cma/render-css-sections.ts'), 'utf8')
    const immersive = readFileSync(join(process.cwd(), 'lib/cma/immersive-css.ts'), 'utf8')
    // Letter Open report: stack on screen — no wide multi-column table at 375.
    expect(css).toMatch(/\.comp-stack \{[^}]*display:\s*block/)
    expect(css).toMatch(/\.comp-matrix-wrap \{[^}]*display:\s*none/)
    // Immersive /view override: side-by-side sold matrix required on screen (pricing beat).
    expect(immersive).toMatch(/\.comp-matrix-wrap\{display:block/)
    expect(immersive).toMatch(/\.comp-stack\{display:none/)
    // Print PDF keeps the side-by-side matrix on both paths.
    expect(css).toMatch(/@media print \{[\s\S]*\.comp-stack \{[^}]*display:\s*none/)
    expect(css).toMatch(/@media print \{[\s\S]*\.comp-matrix-wrap \{[^}]*display:\s*block/)
    expect(immersive).toMatch(/@media print\{\.comp-stack\{display:none!important\}/)
  })

  it('contains comps on 375 via stack, not a document-widening scroll (C4)', () => {
    const css = readFileSync(join(process.cwd(), 'lib/cma/render-css-sections.ts'), 'utf8')
    expect(css).toContain('.comp-stack')
    expect(css).toMatch(/\.comp-stack-card/)
    expect(css).toMatch(/\.comp-matrix-wrap \{[^}]*display:\s*none/)
    expect(css).not.toMatch(/@media screen and \(min-width: 701px\)[\s\S]*min-width:\s*44rem/)
  })

  it('stacks the signature at phone width so the 260px name plate cannot push past 375', () => {
    const css = readFileSync(join(process.cwd(), 'lib/cma/render-css.ts'), 'utf8')
    // Base rule must not hard-lock 260px — that alone is 16+200+36+260=512 on a
    // 360 viewport when the phone stack loses the cascade (prod re-walk).
    expect(css).toMatch(
      /\.signature-page \.sig-name\s*\{[^}]*width:\s*min\(260px,\s*100%\)/,
    )
    expect(css).toMatch(
      /\.signature-page\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*200px\)\s+minmax\(0,\s*1fr\)/,
    )
    expect(css).toMatch(
      /@media screen and \(max-width: 700px\)[\s\S]*?\.signature-page\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/,
    )
    expect(css).toMatch(
      /@media screen and \(max-width: 700px\)[\s\S]*?\.signature-page \.sig-name\s*\{[^}]*width:\s*auto/,
    )
  })

  it('ends the stylesheet with a phone safety appendix that restacks signature and caps price', () => {
    const src = readFileSync(join(process.cwd(), 'lib/cma/render-css.ts'), 'utf8')
    expect(src).toContain('phone-safety: last wins')
    expect(src).toMatch(
      /cmaSectionStyles\(\)[\s\S]*phone-safety: last wins[\s\S]*\.page-cover \.value-block \.vb-price/,
    )
    expect(src).toMatch(
      /phone-safety: last wins[\s\S]*\.signature-page\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/,
    )
  })
})
