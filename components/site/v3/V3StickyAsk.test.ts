import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The component's decision logic lives in lib/sticky-ask.ts and is unit-tested
 * there. What is left here is the set of invariants that live in the MARKUP and
 * the STYLESHEET — the ones a gate does not read and a refactor silently loses.
 * Same shape as FindMeVoice.test.ts beside it.
 */
const SRC = readFileSync(resolve('components/site/v3/V3StickyAsk.client.tsx'), 'utf8')
const CSS = readFileSync(resolve('components/site/v3/V3StickyAsk.css'), 'utf8')
const BARREL = readFileSync(resolve('components/site/v3/index.ts'), 'utf8')
const LISTING_CSS = readFileSync(
  resolve('components/site/listing-detail/listing-detail.css'),
  'utf8',
)

describe('V3StickyAsk · the barrel contract', () => {
  it('is exported from the barrel, so no page hand-rolls a second one', () => {
    expect(BARREL).toContain("export { V3StickyAsk")
    expect(BARREL).toContain("from './V3StickyAsk.client'")
  })

  it('opens the token scope on its own outermost element', () => {
    expect(SRC).toContain('V3_ROOT_CLASS')
    expect(SRC).toContain("import './tokens.css'")
  })

  it('formats nothing itself — the verdict arrives finished (barrel rule, G68)', () => {
    expect(SRC).not.toMatch(/toFixed\s*\(/)
    // The one rounding in the file is a pixel height, not a figure.
    for (const line of SRC.split('\n').filter((l) => l.includes('Math.round'))) {
      expect(line).toContain('height')
    }
    expect(SRC).not.toContain('marketVerdict')
    expect(SRC).not.toContain('formatMonthsOfSupply')
    expect(SRC).toContain("from '@/lib/sticky-ask'")
  })

  it('never invents a verdict tail when there is no verdict', () => {
    // The tail block is conditional on the prop, not on a fallback string.
    expect(SRC).toContain('{verdict ? (')
    expect(SRC).not.toMatch(/verdict\s*\?\?\s*['"]/)
  })
})

describe('V3StickyAsk · attribution', () => {
  it('stamps the source before it navigates, in a click handler', () => {
    expect(SRC).toContain("markAskSource('sticky')")
    expect(SRC).toContain("from '@/lib/ask-source'")
  })

  it('records the click through the shared tracker with a fixed surface', () => {
    expect(SRC).toContain("trackEvent('click_cta', { cta: 'sticky_ask'")
    expect(SRC).toContain("from '@/lib/tracking'")
  })

  it('reads storage only inside effects and handlers, never in render', () => {
    // Every sessionStorage touch in this file sits inside a useEffect or a
    // useCallback handler; the render body must stay pure (G37 / React #418).
    const renderBody = SRC.slice(SRC.lastIndexOf('return ('))
    expect(renderBody).not.toContain('sessionStorage')
  })
})

describe('V3StickyAsk · the bottom edge', () => {
  it('publishes its measured height so nothing else can sit under it', () => {
    expect(SRC).toContain('--rr-sticky-bottom')
    expect(SRC).toContain('getBoundingClientRect')
    expect(CSS).toContain('--rr-sticky-bottom')
  })

  it('removes the property when it is not shown', () => {
    expect(SRC).toContain("removeProperty('--rr-sticky-bottom')")
  })

  it('shares the listing bar geometry: same height token, same safe area, same layer', () => {
    expect(CSS).toContain('var(--v3-sticky-bar-h)')
    expect(CSS).toContain('env(safe-area-inset-bottom, 0px)')
    expect(CSS).toContain('z-index: 80')
    expect(LISTING_CSS).toContain('z-index: 80')
  })

  it('docks above a cookie bar, exactly as the listing bar does', () => {
    expect(CSS).toContain("body:has([data-cookie-notice='bar'])")
    expect(CSS).toContain('var(--v3-cookie-bar-h, 5.5rem)')
  })
})

describe('V3StickyAsk · craft', () => {
  it('keeps a 44px floor on both targets', () => {
    expect(CSS).toContain('width: var(--v3-tap)')
    expect(CSS).toMatch(/min-height:\s*var\(--v3-sticky-bar-h\)/)
  })

  it('draws no raw brand value, no radius of its own, no elevation shadow', () => {
    expect(CSS).not.toMatch(/#(102742|faf8f4)/i)
    expect(CSS).not.toMatch(/rgba?\(\s*16\s*,\s*39\s*,\s*66/)
    expect(CSS).not.toMatch(/box-shadow/)
    expect(CSS).not.toMatch(/border-radius/)
  })

  it('respects reduced motion by arriving complete', () => {
    expect(CSS).toContain('@media (prefers-reduced-motion: reduce)')
    expect(SRC).toContain("window.matchMedia('(prefers-reduced-motion: reduce)')")
  })

  it('entrance stays on the ladder (300ms enter, transform + opacity only)', () => {
    expect(CSS).toContain('var(--v3-dur-enter)')
    expect(CSS).not.toMatch(/transition:[^;]*\b(width|height|top|left|margin)\b/)
  })

  it('focus is the warm-stone ring, never navy on navy', () => {
    expect(CSS).toContain('var(--v3-focus-ring)')
  })

  it('hides from the tab order while it is not shown', () => {
    expect(CSS).toContain('visibility: hidden')
  })

  it('names both controls for a screen reader', () => {
    expect(SRC).toContain('aria-label={[label, tail, trace]')
    expect(SRC).toContain('aria-label={`Hide the')
  })
})
