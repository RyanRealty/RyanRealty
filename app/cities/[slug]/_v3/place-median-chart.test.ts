/**
 * The place-family median overlay, and the two defects SITE-02b fixed in it.
 *
 * Both were verified in a real browser on /cities/bend before this file existed
 * (2026-09-08), and both were properties of the CALLER, not of one page:
 * app/cities/[slug]/page.tsx, app/cities/[slug]/[neighborhoodSlug]/page.tsx and
 * app/communities/[slug]/page.tsx all mount this same chart.
 *
 *  1. FIVE YEAR-SERIES, THREE OF THEM ENDING AT THE SAME x. Every complete year
 *     ends in December, so their direct end-labels landed on one x and printed
 *     on top of each other — measured: two overlapping label pairs. TASTE.md and
 *     the dataviz skill both cap categorical series at three ("past that, fold
 *     or facet"), so this folds to three.
 *  2. A DECLINE IN THE INK OF A RISE. The chart's own claim read "down 5.7% from
 *     Aug 2025" while the emphasized year drew in full navy, because the
 *     emphasis path had no other ink. `--rr-exception` is the design system's
 *     one second hue and a drawdown is exactly what it is for.
 */
import { describe, expect, it } from 'vitest'
import { PLACE_MEDIAN_CHART_YEARS, placeMedianChart } from './city-sections'
import type { KbYearSeries } from '@/lib/kb/year-series'

/** A full calendar year of medians, so every series is plottable. */
function year(y: number, base: number): KbYearSeries {
  return {
    year: y,
    points: Array.from({ length: 12 }, (_, i) => ({ m: i + 1, value: base + i * 1_000 })),
  }
}

const CAPTION = 'Median sale price by month in Bend'

describe('placeMedianChart folds to the categorical cap', () => {
  it('draws three year-series at most, whatever the caller hands it', () => {
    expect(PLACE_MEDIAN_CHART_YEARS).toBe(3)
    const chart = placeMedianChart(
      [year(2022, 600_000), year(2023, 640_000), year(2024, 680_000), year(2025, 720_000), year(2026, 700_000)],
      CAPTION,
    )
    expect(chart?.series?.map((s) => s.name)).toEqual(['2024', '2025', '2026'])
  })

  it('still draws what it has when the record holds fewer years', () => {
    const chart = placeMedianChart([year(2025, 700_000), year(2026, 720_000)], CAPTION)
    expect(chart?.series?.map((s) => s.name)).toEqual(['2025', '2026'])
  })

  it('mounts nothing rather than an empty frame', () => {
    expect(placeMedianChart([], CAPTION)).toBeUndefined()
    // A year with one plottable month is not a line.
    expect(placeMedianChart([{ year: 2026, points: [{ m: 1, value: 700_000 }] }], CAPTION)).toBeUndefined()
  })
})

describe('placeMedianChart gives a real decline the exception ink', () => {
  it('marks the emphasized year as an exception when it fell year over year', () => {
    // 2026 sits below 2025 at the same month, which is what the claim compares.
    const falling = placeMedianChart([year(2024, 700_000), year(2025, 800_000), year(2026, 750_000)], CAPTION)
    expect(falling?.claim).toContain('down')
    expect(falling?.emphasisTone).toBe('exception')
    expect(falling?.emphasize).toBe('last')
  })

  it('leaves a rise in navy — the second hue is not decoration', () => {
    const rising = placeMedianChart([year(2024, 600_000), year(2025, 650_000), year(2026, 700_000)], CAPTION)
    expect(rising?.claim).toContain('up')
    expect(rising?.emphasisTone).toBeUndefined()
  })
})
