/**
 * Chapter 1's graphic: THEIR listing as a timeline against the value range.
 * docs/plans/CMA_REIMAGINED_2026-09-07.md chapter 1.
 */
import { describe, expect, it } from 'vitest'
import {
  listingTimelinePhoneSvg,
  listingTimelineSvg,
  type ListingTimelineInput,
} from '@/lib/cma/market-charts'
import {
  listingTimelineReading,
  resolveListingTimeline,
  type ExpiredAuditData,
  type ExpiredFinalCycle,
} from '@/lib/cma/expired-audit'
import type { CmaSubject } from '@/lib/cma/types'

const subject = {
  streetAddress: '2465 7th',
  city: 'Redmond',
  standardStatus: 'Withdrawn',
  lastListPrice: 460000,
  lastListDate: '2026-02-26T23:27:57+00:00',
  listingHistoryLine:
    'Listed Feb 26, 2026 at $475,000, cut to $460,000, came off withdrawn · 187 days on market.',
} as unknown as CmaSubject

/**
 * A final cycle as the build writes it. The fixture fills the trace fields the
 * contract requires so the test exercises the real shape, and takes the
 * drawing facts per case.
 */
const cycle = (
  c: Partial<ExpiredFinalCycle> & Pick<ExpiredFinalCycle, 'listDate' | 'initialAsk'>,
): ExpiredFinalCycle => ({
  cuts: [],
  cutsDated: (c.cuts ?? []).some((cut) => Boolean(cut.date)),
  finalAsk: (c.cuts ?? []).at(-1)?.ask ?? c.initialAsk,
  offMarketDate: null,
  status: null,
  days: null,
  source: {
    table: 'listings + price_history + listing_history',
    filter: "ListingKey='TEST'",
    fetchedAt: '2026-09-07T00:00:00.000Z',
    query: 'select 1',
  },
  ...c,
})

const audit = (finalCycle: ExpiredAuditData['finalCycle']): ExpiredAuditData =>
  ({ findings: [], services: [], netSheet: {}, feeLine: '', finalCycle }) as unknown as ExpiredAuditData

const RANGE = { rangeLow: 380000, rangeHigh: 398000, rangeLabel: 'where homes like yours sold' }

/** Every <text> box must sit inside the frame — nothing clipped on a phone. */
function textOutsideViewBox(svg: string): string[] {
  const vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg)
  if (!vb) return ['no viewBox']
  const W = Number(vb[1])
  const H = Number(vb[2])
  const bad: string[] = []
  for (const m of svg.matchAll(
    /<text[^>]*\bx="([-\d.]+)"[^>]*\by="([-\d.]+)"[^>]*?(?:text-anchor="(start|middle|end)")?[^>]*>([\s\S]*?)<\/text>/g,
  )) {
    const x = Number(m[1])
    const y = Number(m[2])
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    if (x < 0 || x > W || y < 0 || y > H) bad.push(`${m[4]} at ${x},${y}`)
  }
  return bad
}

/** The drawing with its attributes stripped — what a reader actually sees. */
function visibleText(svg: string): string {
  return svg.replace(/\s(?:data-read|aria-label|title)="[^"]*"/g, '')
}

describe('resolveListingTimeline', () => {
  it('prefers the build contract and steps down at every cut', () => {
    const t = resolveListingTimeline({
      subject,
      expiredAudit: audit(
        cycle({
          listDate: '2026-02-26',
          initialAsk: 475000,
          cuts: [{ date: '2026-05-14', ask: 460000 }],
          offMarketDate: '2026-09-01',
          status: 'Withdrawn',
          days: 187,
        }),
      ),
      ...RANGE,
      domDays: 187,
    })
    expect(t).not.toBeNull()
    expect(t!.steps).toEqual([
      { date: '2026-02-26', ask: 475000 },
      { date: '2026-05-14', ask: 460000 },
    ])
    expect(t!.days).toBe(187)
    expect(t!.offMarketDate).toBe('2026-09-01')
  })

  it('degrades to one flat line from the row when the contract is absent', () => {
    // Rows built before R2's contract landed carry no finalCycle. The blueprint
    // already draws a flat line for a period with no cut, so the degraded
    // drawing states less and never something false: it does NOT read the
    // $475,000 opening ask out of the prose history line.
    const t = resolveListingTimeline({ subject, expiredAudit: audit(null), ...RANGE, domDays: 187 })
    expect(t).not.toBeNull()
    expect(t!.steps).toHaveLength(1)
    expect(t!.steps[0]!.ask).toBe(460000)
    expect(t!.offMarketDate).toBe('2026-09-01')
    expect(t!.days).toBe(187)
  })

  it('draws one flat line at the opening ask when no cut carries a date', () => {
    // `cutsDated: false` means the record holds two different asks and no dated
    // event between them. §0: a date from convention is a fabrication, so the
    // step is not drawn — the line stays flat at the ask it opened on.
    const t = resolveListingTimeline({
      subject,
      expiredAudit: audit(
        cycle({
          listDate: '2026-02-26',
          initialAsk: 475000,
          cuts: [{ date: null, ask: 460000 }],
          cutsDated: false,
          finalAsk: 460000,
          offMarketDate: '2026-09-01',
          status: 'Withdrawn',
          days: 187,
        }),
      ),
      ...RANGE,
      domDays: 187,
    })
    expect(t!.steps).toEqual([{ date: '2026-02-26', ask: 475000 }])
  })

  it('returns null when the row carries neither a list date nor an ask', () => {
    expect(
      resolveListingTimeline({
        subject: { ...subject, lastListDate: null, lastListPrice: null } as CmaSubject,
        expiredAudit: audit(null),
        ...RANGE,
        domDays: null,
      }),
    ).toBeNull()
  })
})

describe('listingTimelineReading', () => {
  const base: ListingTimelineInput = {
    listDate: '2026-02-26',
    offMarketDate: '2026-09-01',
    steps: [{ date: '2026-02-26', ask: 475000 }, { date: '2026-05-14', ask: 460000 }],
    ...RANGE,
    status: 'withdrawn',
    days: 187,
    caption: 'c',
  }

  it('measures the final ask against the top of the range', () => {
    expect(listingTimelineReading({ timeline: base, city: 'Redmond', marketMedianDom: 21 })).toBe(
      'You were asking 15.6 percent above the top of the range homes like yours sold in. Your home sat 187 days. The median home in Redmond has an accepted offer in 21 days.',
    )
  })

  it('says so when the range sits ABOVE the ask', () => {
    const reading = listingTimelineReading({
      timeline: { ...base, steps: [{ date: '2026-02-26', ask: 340000 }] },
      city: 'Redmond',
      marketMedianDom: 21,
    })
    expect(reading).toContain('10.5 percent below the bottom of the range')
  })

  it('says so when the ask sat inside the range, and stops at what it can say', () => {
    const reading = listingTimelineReading({
      timeline: { ...base, steps: [{ date: '2026-02-26', ask: 390000 }] },
      city: 'Redmond',
      marketMedianDom: null,
    })
    expect(reading).toContain('You were asking inside the range homes like yours sold in')
    expect(reading).toContain('Your home sat 187 days without an offer.')
    expect(reading).toContain(
      'At a price inside the range, 187 days without an offer points at something other than the number. We would walk it with you before saying what.',
    )
    expect(reading).not.toContain('accepted offer in')
  })

  it('does not argue overpricing when the ask was near the range', () => {
    // The corrected engine's own case (tasteReview round three, §4.1): 3.8
    // percent above the top is not a story about the number.
    const reading = listingTimelineReading({
      timeline: { ...base, steps: [{ date: '2026-02-26', ask: 405000 }] },
      city: 'Redmond',
      marketMedianDom: 26,
    })
    expect(reading).toContain('percent above the top of the range homes like yours sold in')
    expect(reading).toContain('Half of the homes that sold in Redmond had an offer inside 26 days.')
    expect(reading).toContain('You were asking above what the sales support, and your home went 187 days without an offer. We would walk it with you before saying more.')
    expect(reading).not.toContain('points at something other than the number')
  })

  it('keeps the overpricing reading past ten percent, and adds no cause', () => {
    const reading = listingTimelineReading({ timeline: base, city: 'Redmond', marketMedianDom: 21 })
    expect(reading).toContain('15.6 percent above the top of the range')
    expect(reading).not.toContain('walk the house')
  })
})

describe('the timeline drawing', () => {
  const t: ListingTimelineInput = {
    listDate: '2026-02-26',
    offMarketDate: '2026-09-01',
    steps: [{ date: '2026-02-26', ask: 475000 }, { date: '2026-05-14', ask: 460000 }],
    ...RANGE,
    status: 'withdrawn',
    days: 187,
    caption: 'Your asking price against what homes like yours sold for',
  }

  it('draws the zone, names it, and steps the ask down across the width', () => {
    const svg = listingTimelineSvg(t)
    expect(svg).toContain('where homes like yours sold')
    expect(svg).toContain('$398K')
    expect(svg).toContain('$380K')
    expect(svg).toContain('$475K')
    expect(svg).toContain('$460K')
    expect(svg).toContain('came off withdrawn · 187 days')
    // A step path, not a diagonal: horizontal, vertical, horizontal.
    expect(svg).toMatch(/<path d="M[\d.]+,[\d.]+ L[\d.]+,[\d.]+ L[\d.]+,[\d.]+ L[\d.]+,[\d.]+"/)
    // Only the asks carry a number. Never a label on every point. Counted
    // over what a reader SEES: the interactive layer puts the same figure in
    // a data-read and an aria-label on each mark, and neither is ink.
    expect((visibleText(svg).match(/\$\d/g) ?? []).length).toBeLessThanOrEqual(4)
  })

  it('keeps the line clear of the zone when the ask sat above it', () => {
    const svg = listingTimelineSvg(t)
    const zoneTop = Number(/<rect[^>]*\by="([\d.]+)"/.exec(svg)![1])
    const lineY = Number(/<path d="M[\d.]+,([\d.]+)/.exec(svg)![1])
    // SVG y grows downward, so a line ABOVE the zone has the SMALLER y.
    expect(lineY).toBeLessThan(zoneTop)
  })

  it('fits a phone with nothing outside the viewBox', () => {
    const svg = listingTimelinePhoneSvg(t)
    expect(svg).toContain('viewBox="0 0 360')
    expect(textOutsideViewBox(svg)).toEqual([])
  })

  it('draws one flat line when the period never cut', () => {
    const svg = listingTimelineSvg({ ...t, steps: [{ date: '2026-02-26', ask: 460000 }] })
    expect(svg).toContain('$460K')
    expect(svg).not.toContain('$475K')
    expect(svg).toMatch(/<path d="M[\d.]+,([\d.]+) L[\d.]+,\1"/)
  })

  it('draws nothing without a range or an ask', () => {
    expect(listingTimelineSvg({ ...t, rangeLow: 0, rangeHigh: 0 })).toBe('')
    expect(listingTimelineSvg({ ...t, steps: [] })).toBe('')
  })
})
