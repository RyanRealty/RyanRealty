/**
 * V3Drawing's contract — the rules that make it a DRAWING and not a ledger.
 *
 * Site queue SITE-02b. These are read off the source rather than rendered,
 * which is what the barrel's other component tests do (V3StickyAsk.test.ts):
 * the interaction, the motion budget and the reduced-motion path were all
 * verified in a real browser before this file existed, and what a test can hold
 * afterwards is that the rules stay written where they were written.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { V3_DRAWING_DRAW_MS, V3_DRAWING_MIN_STRIP } from './V3Drawing.client'

const ROOT = process.cwd()
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')

const src = read('components/site/v3/V3Drawing.client.tsx')
const css = read('components/site/v3/V3Drawing.css')
const barrel = read('components/site/v3/index.ts')

describe('the drawing is one primitive with three draws', () => {
  it('is exported from the barrel, so every surface reaches the same one', () => {
    expect(barrel).toContain("export { V3Drawing, V3_DRAWING_MIN_STRIP, V3_DRAWING_DRAW_MS } from './V3Drawing.client'")
  })

  it('draws from lib/charts/plot.ts and imports no other chart kit', () => {
    expect(src).toContain("from '@/lib/charts/plot'")
    expect(src).not.toMatch(/from ['"](recharts|d3|chart\.js|victory|nivo)/)
  })

  it('carries the three draws the address answer needs', () => {
    expect(src).toContain("draw: 'pair' | 'strip' | 'rule'")
  })
})

describe('every drawn figure owes a claim and a source', () => {
  it('throws rather than drawing a number with no section-0 trace', () => {
    expect(src).toMatch(/figure\.source\.trim\(\)\.length === 0/)
    expect(src).toContain('has no source')
  })

  it('throws rather than drawing a figure with no claim or caption', () => {
    expect(src).toMatch(/figure\.claim\.trim\(\)\.length === 0/)
    expect(src).toContain('has no claim or no caption')
  })

  it('renders the trace on the figure, never pooled at the foot of the section', () => {
    expect(src).toContain('<V3SourceDisclosure className="v3-drawing__source" source={figure.source} />')
  })
})

describe('the small-n rule is the primitive’s, not the caller’s', () => {
  it('will not draw a distribution under six closes', () => {
    expect(V3_DRAWING_MIN_STRIP).toBe(6)
    expect(src).toMatch(/figure\.points\?\.length \?\? 0\) >= V3_DRAWING_MIN_STRIP/)
  })

  it('renders the quiet line instead, so the answer never drops a question', () => {
    expect(src).toContain('v3-drawing__quiet')
    expect(src).toContain('figure.emptyReason')
  })
})

describe('hover, tap and keyboard reach one reading', () => {
  it('binds all four events on every mark and on every bar', () => {
    for (const handler of ['onMouseEnter', 'onFocus', 'onMouseLeave', 'onBlur', 'onClick']) {
      expect((src.match(new RegExp(handler, 'g')) ?? []).length).toBeGreaterThanOrEqual(2)
    }
  })

  it('sets the reading on click rather than toggling it off after a hover', () => {
    expect(src).not.toMatch(/onClick=\{\(\) => toggle\(/)
    expect(src).toContain('onClick={() => show(key, text)}')
    expect(src).toContain('onClick={() => show(key, point.label)}')
  })

  it('announces the reading in a live region', () => {
    expect(src).toContain('aria-live="polite"')
  })

  it('gives every mark a hit box larger than the mark it covers', () => {
    // 24px over a 9px dot; the bar rows take the full 44px tap target.
    expect(css).toMatch(/\.v3-drawing__mark \{[\s\S]*?inline-size: 1\.5rem;/)
    expect(css).toMatch(/\.v3-drawing__barrow \{[\s\S]*?min-height: var\(--v3-tap\);/)
  })
})

describe('the draw-on is one entrance, and reduced motion is already drawn', () => {
  it('stays inside the entrance band and animates transform and opacity only', () => {
    expect(V3_DRAWING_DRAW_MS).toBeLessThanOrEqual(300)
    // No width/height/left/top transitions anywhere in the stylesheet.
    const transitions = css.match(/transition:[\s\S]*?;/g) ?? []
    expect(transitions.length).toBeGreaterThan(0)
    for (const rule of transitions) {
      expect(rule).not.toMatch(/\b(width|height|inline-size|block-size|inset-inline-start|left|top)\b/)
    }
  })

  it('never counts a number up', () => {
    expect(src).not.toMatch(/requestAnimationFrame|setInterval|countUp|useSpring/)
  })

  it('renders the final frame immediately when the reader asked for less motion', () => {
    expect(src).toContain("window.matchMedia('(prefers-reduced-motion: reduce)').matches")
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*transform: scaleX\(1\)/)
  })
})

describe('navy on cream, and the second hue means one thing', () => {
  it('reads every colour through the token file', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(css).toContain("@media (max-width: 30rem)")
  })

  it('spends --v3-exception only on a figure the caller declared an exception', () => {
    const uses = css.match(/var\(--v3-exception\)/g) ?? []
    expect(uses.length).toBeGreaterThan(0)
    for (const line of css.split('\n')) {
      if (!line.includes('var(--v3-exception)')) continue
      // Every exception rule is inside the is-exception block, which is the
      // only selector that reaches it.
      expect(css.slice(0, css.indexOf(line))).toContain('is-exception')
    }
  })
})
