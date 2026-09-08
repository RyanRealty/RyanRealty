/**
 * Chapter 2: priced right sells, priced high sits.
 * docs/plans/CMA_REIMAGINED_2026-09-07.md chapter 2.
 */
import { describe, expect, it } from 'vitest'
import {
  CHAPTER2_MIN_N,
  readAskOutcome,
  readAskRealization,
  readOfferTiming,
  renderAskOutcomeHtml,
  renderAskRealizationHtml,
  renderOfferTimingHtml,
  subjectRealizationBucket,
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
      'Half of the 188 homes that sold in Redmond had an offer inside 12 days. 95.0 percent had one inside 90 days. By day 180, 99.0 percent did. Yours went 187 days without one.',
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
    expect(html).toContain('Came off unsold · yours is in this group')
    // Each clause names what the price DID, not whether it was right: the
    // groups are defined by the cut, and the renderer does not get an opinion.
    expect(html).toContain(
      'Homes that sold without ever cutting their price took a median of 9 days. Homes that cut took 58 days, gave up a median 4.1 percent. Homes that came off unsold had been on the market a median 94 days.',
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

// ── 2b's centrepiece: what the first asking price realized ─────────────────
// Research item 4: every published "% of list by weeks" table traces to a
// secondary citation of NAR that no primary source confirms, so this one is
// ours, computed on Central Oregon rows with a count per row.

const realization = {
  city: 'Redmond',
  windowMonths: 12,
  buckets: [
    { weeks: '0-2', n: 260, medianPctOfOriginalAsk: 100, reason: null },
    { weeks: '3-4', n: 96, medianPctOfOriginalAsk: 97, reason: null },
    { weeks: '5-8', n: 112, medianPctOfOriginalAsk: 97.2, reason: null },
    { weeks: '9-16', n: 115, medianPctOfOriginalAsk: 95.3, reason: null },
    { weeks: '17+', n: 94, medianPctOfOriginalAsk: 92.1, reason: null },
  ],
}

describe('2b — what the first asking price realized', () => {
  it('prints every bucket with its own count and share', () => {
    const html = renderAskRealizationHtml({
      market: market({ originalAskRealization: realization }),
      subject,
    })
    expect(html).toContain('What the first asking price actually realized')
    expect(html).toContain('0 to 2')
    expect(html).toContain('17 or more')
    expect(html).toContain('100.0%')
    expect(html).toContain('92.1%')
    expect(html).toContain('260')
    // A table, and every row carries a mark. The evaluator read five rows of
    // bare figures as "a table wearing hairlines" and could not see that the
    // series steps back up; the dot column shows the shape, the figure stays
    // printed beside it, and the header names the scale the dots sit on.
    expect(html).toContain('table class="kv realization"')
    expect(html).toContain('91% to 100%')
    expect(html.match(/class="rz-svg"/g) ?? []).toHaveLength(5)
    expect(html).toContain(
      'The fall is not steady: the 5 to 8 week row closed at 97.2 percent, above the 97.0 percent of the row before it.',
    )
  })

  it('marks the row the seller\'s own days land in, without claiming they got an offer', () => {
    const html = renderAskRealizationHtml({
      market: market({ originalAskRealization: realization }),
      subject,
    })
    expect(html).toContain('<tr class="is-mine">')
    expect(html).toContain('your home ran 187 days and never got one')
    expect(html).toContain('Your listing ran 187 days, which is the last row, and it never reached an offer at all.')
  })

  it('reads the first row against the last, both with their counts', () => {
    const html = renderAskRealizationHtml({
      market: market({ originalAskRealization: realization }),
      subject,
    })
    expect(html).toContain(
      'Homes that had an offer inside 2 weeks closed at a median 100.0 percent of the price they first asked, over 260 sales.',
    )
    expect(html).toContain('Homes that took 17 weeks or more closed at 92.1 percent, over 94.')
  })

  it('places the seller in the bucket their days fall in', () => {
    expect(subjectRealizationBucket(realization.buckets, 10)).toBe('0-2')
    expect(subjectRealizationBucket(realization.buckets, 25)).toBe('3-4')
    expect(subjectRealizationBucket(realization.buckets, 60)).toBe('9-16')
    expect(subjectRealizationBucket(realization.buckets, 187)).toBe('17+')
    expect(subjectRealizationBucket(realization.buckets, null)).toBeNull()
  })

  it('refuses a table with fewer than three priced buckets', () => {
    expect(
      readAskRealization(
        market({
          originalAskRealization: {
            ...realization,
            buckets: realization.buckets.slice(0, 2),
          },
        }),
      ),
    ).toBeNull()
    expect(readAskRealization(market({}))).toBeNull()
    expect(readAskRealization(null)).toBeNull()
  })

  it('states the build\'s reason when the table was withheld', () => {
    const html = renderAskRealizationHtml({
      market: market({
        originalAskRealization: {
          ...realization,
          buckets: [],
          reason: 'Too few sales in Sisters carried both a days figure and a price pair.',
        },
      }),
      subject,
    })
    expect(html).toContain('Too few sales in Sisters')
  })
})

describe('the three bars carry what each group realized', () => {
  it('prints the share of the first ask beside its own count', () => {
    const html = renderAskOutcomeHtml({
      market: market({
        askOutcome: {
          ...askOutcome,
          groups: [
            { ...askOutcome.groups[0], medianSoldToOriginalAskPct: 100, soldToOriginalAskN: 214 },
            { ...askOutcome.groups[1], medianSoldToOriginalAskPct: 94.3, soldToOriginalAskN: 95 },
            { ...askOutcome.groups[2], medianSoldToOriginalAskPct: null, soldToOriginalAskN: 0 },
          ],
        },
      }),
      subject,
    })
    expect(html).toContain('sold at 100.0% of the first ask, 214 sales')
    expect(html).toContain('sold at 94.3% of the first ask, 95 sales')
    // The group that never sold has no close to divide, so it carries none.
    // Two groups × the wide layout and the phone layout. Counted over what a
    // reader SEES: the interactive layer repeats each row's reading in a
    // data-read and an aria-label, and neither is ink.
    const visible = html.replace(/\s(?:data-read|aria-label|title)="[^"]*"/g, '')
    expect((visible.match(/of the first ask/g) ?? []).length).toBe(4)
  })
})
