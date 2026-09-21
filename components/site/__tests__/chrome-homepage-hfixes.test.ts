import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const CHROME = readFileSync(resolve('components/site/v3/V3Chrome.tsx'), 'utf8')
const CHROME_CSS = readFileSync(resolve('components/site/v3/V3Chrome.css'), 'utf8')
const SEARCH = readFileSync(resolve('components/site/v3/V3ChromeSearch.client.tsx'), 'utf8')
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
    // reversed that call on 2026-09-21: "There's a 'Work with us' button
    // that needs to be removed. We're going to use the dog for that."
    // V3DogFloater (SITE-153) took over the job, and its own gate already
    // dropped the matching requirement so the two cannot fight. Flipped
    // rather than deleted, so the trigger cannot quietly come back.
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

  it('keeps the guides strip above the rails and Work with us in the header', () => {
    const guidesAt = PAGE.indexOf('id="guides"')
    const railsAt = PAGE.indexOf('<HomeHomesRails')
    expect(guidesAt).toBeGreaterThan(-1)
    expect(railsAt).toBeGreaterThan(guidesAt)
    expect(PAGE).toContain('V3Answers')
    expect(PAGE).toContain('layout="strip"')
    expect(PAGE.slice(guidesAt, railsAt)).not.toMatch(/Work with us/)
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

  it('clips the 375 chrome bar so Menu stays on the canvas', () => {
    expect(CHROME_CSS).toMatch(
      /@media \(max-width: 39\.99rem\) \{[\s\S]*?\.v3\.v3-chrome \{[\s\S]*?overflow-x: clip/,
    )
    expect(CHROME_CSS).toMatch(
      /@media \(max-width: 39\.99rem\) \{[\s\S]*?\.v3-chrome__bar \{[\s\S]*?padding: 0 var\(--v3-space-sm\)/,
    )
    expect(CHROME_CSS).toMatch(
      /@media \(max-width: 39\.99rem\) \{[\s\S]*?\.v3-chrome__menu-btn \{[\s\S]*?overflow: hidden/,
    )
    expect(CHROME_CSS).toMatch(/\.v3-chrome__menu-btn,[\s\S]*?position: relative/)
  })

  it('clips the header at every width, not only mobile (SITE-155)', () => {
    // A start-aligned mega panel (Homes/Places/Market) is positioned off its
    // own .v3-chrome__group, not clamped to the viewport, so between roughly
    // 860-1200px its CLOSED, visibility:hidden box still sits past the right
    // edge of the screen and widens document.documentElement.scrollWidth —
    // measured live: /cities/bend at 1024px, .v3-chrome__panel--mega
    // right=1155px against a 1024px viewport (+131px). Clipping at the
    // header's own box (unconditional, not just the <640px rule that already
    // existed) removes it at every width without touching the OPEN panel's
    // own edge-shift correction in V3Chrome.tsx (--v3-chrome-mega-shift).
    const baseRule = CHROME_CSS.slice(
      CHROME_CSS.indexOf('.v3.v3-chrome {'),
      CHROME_CSS.indexOf('\n}', CHROME_CSS.indexOf('.v3.v3-chrome {')),
    )
    expect(baseRule).toContain('overflow-x: clip')
    // The mobile-only rule from the 375 fix above must still stand — this is
    // additive, not a replacement.
    expect(CHROME_CSS).toMatch(
      /@media \(max-width: 39\.99rem\) \{[\s\S]*?\.v3\.v3-chrome \{[\s\S]*?overflow-x: clip/,
    )
  })

  it('keeps the search icon-only through the whole 1280-class bar, not just below the nav breakpoint (SITE-155)', () => {
    // Even fully compressed to the CSS "1280-class" pill width (8.5rem), the
    // actions row (search + Sign in/account + phone) still ran the phone
    // control 20px past the viewport at 1024px — measured live:
    // .v3-chrome__phone right=1044px against a 1024px viewport. An icon
    // trigger (~44px, the tap floor) clears it with room to spare. The JS
    // breakpoint must match the CSS "1280-class" range (56.25rem-84.99rem)
    // so the two never drift apart again.
    expect(SEARCH).toContain("window.matchMedia('(max-width: 84.99rem)')")
    expect(CHROME_CSS).toMatch(
      /1280-class bars[\s\S]*?@media \(min-width: 56\.25rem\) and \(max-width: 84\.99rem\)/,
    )
  })
})
