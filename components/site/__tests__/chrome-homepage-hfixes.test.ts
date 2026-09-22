import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const CHROME = readFileSync(resolve('components/site/v3/V3Chrome.tsx'), 'utf8')
const CHROME_CSS = readFileSync(resolve('components/site/v3/V3Chrome.css'), 'utf8')
const PROOF = readFileSync(resolve('components/site/v3/V3Proof.client.tsx'), 'utf8')
const CHART_CSS = readFileSync(resolve('components/site/v3/V3Chart.css'), 'utf8')
const CHART = readFileSync(resolve('components/site/v3/V3Chart.tsx'), 'utf8')
const FACES_CSS = readFileSync(resolve('app/about/_v3/about-faces.css'), 'utf8')
const PAGE = readFileSync(resolve('app/page.tsx'), 'utf8')

describe('chrome homepage H-fixes', () => {
  it('chrome sign-in and primary bar are present (Matt/Cos 2026-09-06)', () => {
    expect(CHROME).toContain('v3-chrome__signin')
    expect(CHROME).toContain('PRIMARY_BAR_KEYS')
  })

  it('keeps Work with us OUT of the header (Matt 2026-09-21, SITE-155)', () => {
    // This test used to assert the opposite. The 2026-09-19 CTA lock put an
    // outline V3WorkWithUs trigger in the chrome at every width; Matt
    // reversed that on 2026-09-21: "There's a 'Work with us' button that
    // needs to be removed. We're going to use the dog for that."
    expect(CHROME).not.toContain('<V3WorkWithUs')
    expect(CHROME).not.toMatch(/from '\.\/V3PhoneDock\.client'/)
    const LAYOUT = readFileSync(resolve('app/layout.tsx'), 'utf8')
    expect(LAYOUT).not.toMatch(/V3PhoneDock/)
    expect(LAYOUT).toMatch(/<V3Chrome/)
  })

  it('hides Menu when primary nav is visible (H1)', () => {
    // Must beat the later base `.v3-chrome__menu-btn { display: inline-flex }` rule.
    expect(CHROME_CSS).toMatch(
      /@media \(min-width: 56\.25rem\) \{[\s\S]*?\.v3\.v3-chrome \.v3-chrome__menu-btn \{[\s\S]*?display: none/,
    )
    const hideAt = CHROME_CSS.indexOf('.v3.v3-chrome .v3-chrome__menu-btn')
    const baseAt = CHROME_CSS.indexOf('.v3-chrome__menu-btn,\n.v3-chrome__close')
    expect(hideAt).toBeGreaterThan(-1)
    expect(baseAt).toBeGreaterThan(-1)
    expect(hideAt).toBeGreaterThan(baseAt)
  })

  it('keeps phone at the 44px tap floor (H7)', () => {
    expect(CHROME_CSS).toMatch(/\.v3-chrome__phone \{[\s\S]*?flex: none/)
    expect(CHROME_CSS).toMatch(/\.v3-chrome__phone \{[\s\S]*?min-width: var\(--v3-tap\)/)
    expect(CHROME_CSS).toMatch(/\.v3-chrome__phone \{[\s\S]*?min-height: var\(--v3-tap\)/)
  })

  it('Proof picks exclude the featured pull quote (H11)', () => {
    expect(PROOF).toContain('.filter((q) => q.id !== compactReading?.id)')
  })

  it('YoY chart years use patterns and end labels, not color alone (H10)', () => {
    expect(CHART_CSS).toContain('stroke-dasharray: 12 3 2 3')
    expect(CHART).toContain('v3-chart__line-label')
  })

  it('broker roster photos use head-and-shoulders cover crop (H12)', () => {
    expect(FACES_CSS).toContain('object-fit: cover')
    expect(FACES_CSS).toContain('object-position: center 18%')
  })

  it('homepage has no explore map block (Redfin lock)', () => {
    expect(PAGE).not.toContain('home-explore-map__legend')
    expect(PAGE).not.toContain('HomeExploreMap')
    expect(PAGE).not.toContain('mapHeadline')
    expect(PAGE).not.toContain('Homes on the map')
  })

  it('keeps the guides strip below the rails and Work with us in the header', () => {
    const guidesAt = PAGE.indexOf('id="guides"')
    const railsAt = PAGE.indexOf('<HomeHomesRails')
    expect(guidesAt).toBeGreaterThan(-1)
    expect(guidesAt).toBeGreaterThan(railsAt)
    expect(PAGE).toContain('V3Answers')
    expect(PAGE).toContain('layout="strip"')
    expect(PAGE.slice(railsAt, guidesAt)).not.toMatch(/Work with us/)
  })

  it('densifies the homepage strip so Sell/Market sit beside Buy at 1440', () => {
    const ANSWERS_CSS = readFileSync(resolve('components/site/v3/V3Answers.css'), 'utf8')
    expect(ANSWERS_CSS).toMatch(
      /\.v3\.v3-answers\.v3-answers--strip \.v3-answers__strip-doors \{[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/,
    )
    expect(ANSWERS_CSS).toMatch(
      /\.v3\.v3-answers\.v3-answers--strip \.v3-answers__heading \{[\s\S]*?font-size: var\(--v3-size-body-lg\)/,
    )
    expect(ANSWERS_CSS).toMatch(
      /\.v3\.v3-answers\.v3-answers--strip \.v3-answers__door \{[\s\S]*?font-size: var\(--v3-size-body-sm\)/,
    )
    expect(ANSWERS_CSS).toMatch(
      /\.v3\.v3-answers\.v3-answers--strip \{[\s\S]*?padding: var\(--v3-space-2xs\) var\(--v3-gutter\)/,
    )
    expect(ANSWERS_CSS).not.toMatch(
      /\.v3\.v3-answers\.v3-answers--strip \.v3-answers__grid \{[\s\S]*?grid-template-columns: minmax\(0, 22rem\)/,
    )
  })

  it('pulls first house-rail photos onto the 1440 fold, not only the heading', () => {
    const RAILS = readFileSync(resolve('app/_v3/home-homes-rails.css'), 'utf8')
    expect(RAILS).toMatch(/\.home-rails \{\s*padding-top: 0;/)
    expect(RAILS).toMatch(
      /\.home-rails > \.home-rail:first-child \{\s*padding-top: var\(--v3-space-2xs\);/,
    )
    expect(RAILS).toMatch(
      /\.home-rails > \.home-rail:first-child \.home-rail__head \{\s*padding-bottom: var\(--v3-space-2xs\);/,
    )
    expect(RAILS).not.toMatch(/\.home-rails > \.home-rail:first-child \{\s*padding-top: var\(--v3-space-sm\);/)
  })

  it('fits the phone bar without clipping it (SITE-155)', () => {
    const baseRule = CHROME_CSS.slice(
      CHROME_CSS.indexOf('.v3.v3-chrome {'),
      CHROME_CSS.indexOf('\n}', CHROME_CSS.indexOf('.v3.v3-chrome {')),
    )
    expect(baseRule).not.toContain('overflow-x: clip')
    expect(CHROME_CSS).not.toMatch(/\.v3-chrome__account-name/)
    expect(CHROME).toContain('referrerPolicy="no-referrer"')
    expect(CHROME).not.toMatch(/v3-chrome__account-name/)
    expect(CHROME_CSS).toMatch(/\.v3-chrome__group:not\(\.is-open\) \{[\s\S]*?overflow: hidden/)
    expect(CHROME_CSS).toMatch(/\.v3-chrome__menu-btn,[\s\S]*?position: relative/)
  })

  it('keeps the search icon-only through the whole 1280-class bar (SITE-155)', () => {
    const SEARCH = readFileSync(resolve('components/site/v3/V3ChromeSearch.client.tsx'), 'utf8')
    expect(SEARCH).toContain("window.matchMedia('(max-width: 84.99rem)')")
    expect(CHROME_CSS).toMatch(
      /1280-class bars[\s\S]*?@media \(min-width: 56\.25rem\) and \(max-width: 84\.99rem\)/,
    )
  })

  it('uses a compact root loading shell so the document cannot shrink mid-load (SITE-155 / SITE-158)', () => {
    const LOADING = readFileSync(resolve('app/loading.tsx'), 'utf8')
    expect(LOADING).toContain('V3Loading')
    expect(LOADING).not.toMatch(/min-h-\[520px\]/)
    expect(LOADING).not.toMatch(/Just listed/)
  })
})
