/**
 * Chapter 2: priced right sells, priced high sits.
 * docs/plans/CMA_REIMAGINED_2026-09-07.md chapter 2.
 */
import { describe, expect, it } from 'vitest'
import {
  CHAPTER2_MIN_N,
  readAskOutcome,
  readOfferTiming,
  renderAskOutcomeHtml,
  renderOfferTimingHtml,
} from '@/lib/cma/market-area-chapters'
import { askOutcomeBarsPhoneSvg, offerTimingCurvePhoneSvg } from '@/lib/cma/market-charts'
import type { CmaMarketContext, CmaSubject } from '@/lib/cma/types'

const subject = {
  streetAddress: '2465 7th',
  city: 'Redmond',
  standardStatus: 'Withdrawn',
  lastListPrice: 460000,
  lastListDate: '2026-02-26',
  listingHistoryLine: 'Listed Feb 26, 2026 at $475,000, came off withdrawn · 187 days on market.',
} as unknown as CmaSubject

const offerTiming = {
  city: 'Redmond',
  windowMonths: 12,
  n: 188,
  points: [
    { days: 7, pct: 34 },
    { days: 14, pct: 55 },
    { days: 30, pct: 72 },
    { days: 60, pct: 90 },
    { days: 90, pct: 95 },
    { days: 180, pct: 99 },
  ],
  medianDays: 12,
}

const askOutcome = {
  city: 'Redmond',
  windowMonths: 12,
  groups: [
    { key: 'sold-no-cut', n: 214, medianDays: 9 },
    { key: 'sold-after-cut', n: 96, medianDays: 58, medianCutPct: 4.1 },
    { key: 'did-not-sell', n: 41, medianDays: 94 },
  ],
}

const market = (extra: Record<string, unknown>): CmaMarketContext =>
  ({ geoLabel: 'Redmond', medianDom: 21, ...extra }) as unknown as CmaMarketContext

/** Every <text> box must sit inside the frame — nothing clipped on a phone. */
function textOutsideViewBox(svg: string): string[] {
  const vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg)
  if (!vb) return ['no viewBox']
  const W = Number(vb[1])
  const H = Number(vb[2])
  const bad: string[] = []
  for (const m of svg.matchAll(/<text ([^>]*)>([\s\S]*?)<\/text>/g)) {
    const at = (k: string) => new RegExp(`${k}="([^"]*)"`).exec(m[1]!)?.[1]
    const x = Number(at('x') ?? 0)
    const y = Number(at('y') ?? 0)
    const size = Number(at('font-size') ?? 12)
    const anchor = at('text-anchor') ?? 'start'
    const text = m[2]!.replace(/<[^>]+>/g, ' ').trim()
    const w = text.length * size * 0.58
    const left = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x
    if (left < -0.5 || left + w > W + 0.5 || y < 0 || y > H) bad.push(`${text} at ${x},${y}`)
  }
  return bad
}

describe('reading the build contract off render_args.market', () => {
  it('takes a well-formed offerTiming block', () => {
    expect(readOfferTiming(market({ offerTiming }))).toMatchObject({ city: 'Redmond', medianDays: 12 })
  })

  it('refuses a thin sample rather than publishing it', () => {
    expect(readOfferTiming(market({ offerTiming: { ...offerTiming, n: CHAPTER2_MIN_N - 1 } }))).toBeNull()
    expect(
      readAskOutcome(
        market({
          askOutcome: {
            ...askOutcome,
            groups: [askOutcome.groups[0], { ...askOutcome.groups[2], n: 12 }],
          },
        }),
      ),
    ).toBeNull()
  })

  it('refuses a malformed or absent block rather than drawing a broken axis', () => {
    expect(readOfferTiming(market({}))).toBeNull()
    expect(readOfferTiming(market({ offerTiming: { city: 'Redmond', n: 188, points: [] } }))).toBeNull()
    expect(readOfferTiming(null)).toBeNull()
    expect(readAskOutcome(market({ askOutcome: { city: '', groups: [] } }))).toBeNull()
    expect(readAskOutcome(null)).toBeNull()
  })
})

describe('2a — when homes like yours get their offer', () => {
  it('draws the curve, marks their days, and reads it in one sentence', () => {
    const html = renderOfferTimingHtml({ market: market({ offerTiming }), subject })
    expect(html).toContain('When homes like yours get their offer')
    expect(html).toContain('yours, 187 days')
    expect(html).toContain('99.0% by day 180')
    // The shares the curve DRAWS, in the order it draws them — never a rounded
    // fraction fitted to a point ("nine in ten inside 60" over a 90.0 pct).
    expect(html).toContain(
      'Half of the homes that sold in Redmond had an offer inside 12 days. 95.0 percent had one inside 90 days. By day 180, 99.0 percent did. Yours went 187 days without one.',
    )
    // Every figure traces to a named source, at seller grain (CLAUDE.md §0).
    expect(html).toContain('188 closed sales. Single-family sales in Redmond over the last 12 months')
  })

  it('omits itself when the contract is absent', () => {
    expect(renderOfferTimingHtml({ market: market({}), subject })).toBe('')
  })

  it('states the build\'s own reason when the count was too small to publish', () => {
    // The blueprint: under the minimum the graphic is omitted "and the chapter
    // says the count was too small". lib/pricing writes that sentence at build
    // as a measured outcome; the renderer prints it as written.
    const html = renderOfferTimingHtml({
      market: market({
        offerTiming: {
          ...offerTiming,
          n: 14,
          points: null,
          medianDays: null,
          reason:
            '14 sales in Sisters in the last 12 months carried a days-to-offer value. That is under the 30 needed to publish a timing curve.',
        },
      }),
      subject,
    })
    expect(html).toContain('That is under the 30 needed to publish a timing curve.')
    expect(html).not.toContain('<svg')
  })

  it('fits a phone with nothing outside the viewBox', () => {
    const svg = offerTimingCurvePhoneSvg(offerTiming, 187)
    expect(svg).toContain('viewBox="0 0 360')
    expect(textOutsideViewBox(svg)).toEqual([])
  })
})

describe('2b — the first price decides the days', () => {
  it('draws three named bars, marks their group, and reads it in one sentence', () => {
    const html = renderAskOutcomeHtml({ market: market({ askOutcome }), subject })
    expect(html).toContain('The first price decides the days')
    expect(html).toContain('Sold without a price cut')
    expect(html).toContain('214 listings')
    expect(html).toContain('median cut 4.1%')
    expect(html).toContain('Came off unsold · your home')
    expect(html).toContain(
      'Homes that launched at the right price sold in a median of 9 days. Homes that had to cut took 58 and gave up a median 4.1 percent. Homes that never cut enough came off after a median 94 days.',
    )
  })

  it('does not mark a group on a home that has not failed', () => {
    const html = renderAskOutcomeHtml({
      market: market({ askOutcome }),
      subject: { ...subject, standardStatus: 'Active' } as CmaSubject,
    })
    expect(html).not.toContain('· your home')
  })

  it('omits itself when the contract is absent', () => {
    expect(renderAskOutcomeHtml({ market: market({}), subject })).toBe('')
  })

  it('fits a phone with nothing outside the viewBox', () => {
    const svg = askOutcomeBarsPhoneSvg(askOutcome as never, 'did-not-sell')
    expect(svg).toContain('viewBox="0 0 360')
    expect(textOutsideViewBox(svg)).toEqual([])
  })
})
