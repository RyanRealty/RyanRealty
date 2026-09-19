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

  it('mounts Work with us in the header at every width (CTA lock 2026-09-19)', () => {
    expect(CHROME).toContain('<V3WorkWithUs surface="chrome" placement="chrome"')
    expect(CHROME_CSS).toMatch(/\.v3\.v3-chrome \.v3-chrome__work \{[\s\S]*?display: inline-flex/)
    expect(CHROME_CSS).not.toMatch(/\.v3-chrome__work[^{]*\{[^}]*display:\s*none/)
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
    expect(ANSWERS_CSS).not.toMatch(
      /\.v3\.v3-answers\.v3-answers--strip \.v3-answers__grid \{[\s\S]*?grid-template-columns: minmax\(0, 22rem\)/,
    )
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
})
