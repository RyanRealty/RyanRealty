import { describe, expect, it } from 'vitest'
import { estimateBadgeGutter } from '@/components/motion/insight-cards'

/**
 * Regression lock for the 2026-09-23 phone overflow on the subdivision (and
 * city/neighborhood/zip/region) insight chart: AnomalyCard passed Liveline's
 * value badge NO right-hand gutter (`padding.right: 0`), so the badge — a
 * real absolute-positioned DOM pill, not canvas-clipped — always sat outside
 * the chart's own box, inflating `document.documentElement.scrollWidth`
 * past the viewport at phone widths.
 *
 * Liveline's own badge math (dist/index.js): `PAD_X = 10`, `tailLen = 5`,
 * `badgeLeft = w - pad.right + 8 - PAD_X - tailLen`, badge width
 * `tailLen + textW + PAD_X*2`. The badge's right edge is therefore
 * `w - pad.right + 8 + PAD_X + textW` (`tailLen` cancels). Solving
 * `rightEdge <= w` for `pad.right` gives `pad.right >= 8 + PAD_X + textW =
 * 18 + textW`. The measured advance width of the badge's label font on
 * this stack's own Chromium fallback (a true monospace) is 6.6226px per
 * character, every character.
 */
const LIVELINE_PAD_X = 10
const LIVELINE_TAIL_LEN = 5
const LIVELINE_EDGE_GAP = 8
const MEASURED_CHAR_PX = 6.6226

/** The exact minimum gutter Liveline's own layout needs for a label this long. */
function requiredGutter(labelLength: number): number {
  return LIVELINE_EDGE_GAP + LIVELINE_PAD_X + labelLength * MEASURED_CHAR_PX
}

describe('estimateBadgeGutter', () => {
  it('always reserves at least as much room as Liveline\'s own badge math needs', () => {
    // Up to 18 characters — "$123,456,789,012" territory, far past any real
    // formatter this card ships (platInsightCount / insightCount /
    // formatPriceCompact top out well under 12). Beyond that the MAX cap
    // below intentionally wins over exactness; see the next test.
    for (let length = 0; length <= 18; length += 1) {
      const estimate = estimateBadgeGutter(['8'.repeat(length)])
      expect(estimate).toBeGreaterThanOrEqual(requiredGutter(length))
    }
  })

  it('is monotonic in the longest label', () => {
    expect(estimateBadgeGutter(['1'])).toBeLessThanOrEqual(estimateBadgeGutter(['12']))
    expect(estimateBadgeGutter(['12'])).toBeLessThanOrEqual(estimateBadgeGutter(['123']))
    expect(estimateBadgeGutter(['$123,456'])).toBeLessThanOrEqual(estimateBadgeGutter(['$1,234,567']))
  })

  it('is driven by the LONGEST label, not the first or last', () => {
    expect(estimateBadgeGutter(['1', '$1,234,567', '2'])).toBe(estimateBadgeGutter(['$1,234,567']))
  })

  it('floors short labels to a usable minimum (never collapses to ~0, the pre-fix value)', () => {
    expect(estimateBadgeGutter([''])).toBeGreaterThanOrEqual(32)
    expect(estimateBadgeGutter(['1'])).toBeGreaterThanOrEqual(32)
  })

  it('caps a pathological label so one freak value cannot swallow the whole chart', () => {
    expect(estimateBadgeGutter(['8'.repeat(200)])).toBe(140)
  })

  it('handles the real formatters this card ships (counts and compact money)', () => {
    const counts = ['86', '423', '1,240', '12,483'] // platInsightCount-style
    const money = ['$650K', '$1.2M', '$999K'] // formatPriceCompact-style
    const gutter = estimateBadgeGutter([...counts, ...money])
    expect(gutter).toBeGreaterThanOrEqual(requiredGutter(6)) // '12,483' is 6 chars
    expect(gutter).toBeLessThan(70) // stays well clear of the 140 cap
  })

  it('matches the exact keystone-terrace repro: a short count never overflows a 350px stage', () => {
    // /subdivisions/keystone-terrace, 390px viewport: chart stage width w=350,
    // resting badge value "1" (platInsightCount of the newest charted year).
    // Live-measured pre-fix: badge DIV at x363–395 (32px), a real overflow
    // past a 390px viewport — this is that exact case, made to pass.
    const label = '1'
    const gutter = estimateBadgeGutter([label])
    const w = 350
    const badgeLeft = w - gutter + LIVELINE_EDGE_GAP - LIVELINE_PAD_X - LIVELINE_TAIL_LEN
    const textW = label.length * MEASURED_CHAR_PX
    const badgeWidth = LIVELINE_TAIL_LEN + textW + LIVELINE_PAD_X * 2
    expect(badgeLeft + badgeWidth).toBeLessThanOrEqual(w)
  })
})
