import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Primitive contract tests. Each test asserts that a specific design
 * directive is baked into the source code of its lowest reusable unit
 * (a primitive component). When the test passes, every consumer of
 * that primitive inherits the rule automatically.
 *
 * These tests give G25 (the design-directive registry gate) a real
 * gate to reference for component-contract directives that are not
 * naturally caught by ESLint or `lint-design-tokens.js`.
 */

function readSrc(rel: string): string {
  return readFileSync(resolve(rel), 'utf8')
}

describe('design directive contracts', () => {
  it('D74 — SiteHeader nav renders at 15px (text-[15px])', () => {
    const src = readSrc('components/site/SiteHeader.tsx')
    expect(src).toMatch(/text-\[15px\]/)
  })

  it('D74 — design-system mockup CSS sets nav font to 15px', () => {
    const css = readSrc('design_system/ryan-realty/ui_kits/_shared/site-mockup.css')
    expect(css).toMatch(/\.nav a \{[^}]*font-size:\s*15px/)
  })

  it("D76 — PropertyHistory `mode` prop defaults to 'all'", () => {
    const src = readSrc('components/site/listing-detail/PropertyHistory.tsx')
    expect(src).toMatch(/mode\s*=\s*['"]all['"]/)
  })

  it('D76 — PropertyHistory filters only when mode === meaningful-only', () => {
    const src = readSrc('components/site/listing-detail/PropertyHistory.tsx')
    expect(src).toMatch(/mode\s*===\s*['"]meaningful-only['"]/)
  })

  it('D75 — PhotoGalleryLightbox primitive exists with the four nav features', () => {
    const src = readSrc('components/site/PhotoGalleryLightbox.tsx')
    expect(src).toMatch(/thumbnail/i)
    expect(src).toMatch(/onTouchStart/)
    expect(src).toMatch(/ArrowRight/)
    expect(src).toMatch(/of\s+\{count\}/)
  })

  it('D77 — listing-detail page imports the three Showcase-parity components', () => {
    const src = readSrc('app/listing/[listingKey]/page.tsx')
    expect(src).toMatch(/import\s*\{\s*ClimateRiskBlock\s*\}/)
    expect(src).toMatch(/import\s*\{\s*VacationRentalPotential\s*\}/)
    expect(src).toMatch(/import\s*\{\s*TransparentCMASummary\s*\}/)
  })
})
