import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const VOICE = readFileSync(resolve('components/site/v3/FindMeVoice.client.tsx'), 'utf8')
const CHROME = readFileSync(resolve('components/site/v3/V3Chrome.tsx'), 'utf8')
const CHROME_CSS = readFileSync(resolve('components/site/v3/V3Chrome.css'), 'utf8')
const PROOF = readFileSync(resolve('components/site/v3/V3Proof.client.tsx'), 'utf8')
const CHART_CSS = readFileSync(resolve('components/site/v3/V3Chart.css'), 'utf8')
const CHART = readFileSync(resolve('components/site/v3/V3Chart.tsx'), 'utf8')
const FACES_CSS = readFileSync(resolve('app/about/_v3/about-faces.css'), 'utf8')
const PAGE = readFileSync(resolve('app/page.tsx'), 'utf8')

describe('chrome homepage H-fixes', () => {
  it('does not mount FindMeVoice in chrome (Matt/Cos 2026-09-06)', () => {
    expect(CHROME).not.toContain('<FindMeVoice')
    expect(CHROME).toContain('v3-chrome__signin')
    expect(CHROME).toContain('PRIMARY_BAR_KEYS')
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
})
