/**
 * Reader review 2026-10-09, 915 Saginaw "What happened": the "$925K" ask label
 * was drawn on top of "canceled after 138 days" (desktop (568,182) against the
 * end label at x 719 y 179; phone (292,152) against (359,149)), and on a phone
 * the two-line zone caption ("where homes like yours sold," / "adjusted for
 * date, size and seller concessions", y 107 and 120) ran through the "$995K"
 * step label (168,110) and the $995K line itself (y 119.3, x 160 to 284).
 *
 * Every label on the chart is now placed jointly (lib/charts/label-place.ts):
 * no two labels touch, and no label touches the asking-price line, a mark,
 * the axis, its dates or the gutter figures. These tests measure the drawing
 * the way a reader sees it: each line of text as a box at the widest either
 * face draws it (labelWidth), against every other box and every segment of
 * the line.
 */
import { describe, expect, it } from 'vitest'
import {
  endLabelLines,
  gutterEdgeLabels,
  labelWidth,
  listingTimelinePhoneSvg,
  listingTimelineSvg,
  type ListingTimelineInput,
} from '@/lib/cma/market-charts'

type Box = { text: string; group: number; x0: number; y0: number; x1: number; y1: number }

/** Every drawn line of text, as a box. Attributes are read, never ink. */
function textBoxes(svg: string): Box[] {
  const out: Box[] = []
  let group = 0
  for (const m of svg.matchAll(/<text([^>]*)>([\s\S]*?)<\/text>/g)) {
    group++
    const attrs = m[1]!
    const body = m[2]!
    const fs = Number(/font-size="([\d.]+)"/.exec(attrs)![1])
    const bold = /font-weight="600"/.test(attrs)
    const anchor = (/text-anchor="(start|middle|end)"/.exec(attrs)?.[1] ?? 'start') as 'start' | 'middle' | 'end'
    const lines: Array<{ x: number; y: number; text: string }> = []
    const spans = [...body.matchAll(/<tspan x="([-\d.]+)" y="([-\d.]+)">([^<]*)<\/tspan>/g)]
    if (spans.length > 0) {
      for (const s of spans) lines.push({ x: Number(s[1]), y: Number(s[2]), text: s[3]! })
    } else {
      lines.push({
        x: Number(/\bx="([-\d.]+)"/.exec(attrs)![1]),
        y: Number(/\by="([-\d.]+)"/.exec(attrs)![1]),
        text: body,
      })
    }
    for (const l of lines) {
      const w = labelWidth(l.text, fs, bold)
      const x0 = anchor === 'start' ? l.x : anchor === 'middle' ? l.x - w / 2 : l.x - w
      // The tallest a line's ink runs in either face: cap and ascender over
      // the baseline, descender under it.
      out.push({ text: l.text, group, x0, x1: x0 + w, y0: l.y - fs * 0.9, y1: l.y + fs * 0.25 })
    }
  }
  return out
}

/** The asking-price line, as its horizontal and vertical segments. */
function askSegments(svg: string): Array<{ x0: number; y0: number; x1: number; y1: number }> {
  const d = /<path d="([^"]+)" class="tl-ask"/.exec(svg)![1]!
  const pts = [...d.matchAll(/[ML]([-\d.]+),([-\d.]+)/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }))
  const segs: Array<{ x0: number; y0: number; x1: number; y1: number }> = []
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!
    const b = pts[i]!
    segs.push({ x0: Math.min(a.x, b.x) - 1.25, x1: Math.max(a.x, b.x) + 1.25, y0: Math.min(a.y, b.y) - 1.25, y1: Math.max(a.y, b.y) + 1.25 })
  }
  return segs
}

const touch = (a: { x0: number; y0: number; x1: number; y1: number }, b: typeof a) =>
  a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1

function collisions(svg: string): string[] {
  const boxes = textBoxes(svg)
  const bad: string[] = []
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (boxes[i]!.group === boxes[j]!.group) continue
      if (touch(boxes[i]!, boxes[j]!)) bad.push(`"${boxes[i]!.text}" on "${boxes[j]!.text}"`)
    }
    for (const s of askSegments(svg)) {
      if (touch(boxes[i]!, s)) {
        bad.push(`"${boxes[i]!.text}" on the line`)
        break
      }
    }
  }
  const vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg)!
  for (const b of boxes) {
    if (b.x0 < 0 || b.x1 > Number(vb[1]) || b.y0 < 0 || b.y1 > Number(vb[2])) bad.push(`"${b.text}" off the frame`)
  }
  return bad
}

function drawn(svg: string): string[] {
  return textBoxes(svg).map((b) => b.text)
}

/** 915 Saginaw's stored timeline (render_args, cma-915-saginaw, 2026-10-09). */
const SAGINAW: ListingTimelineInput = {
  listDate: '2026-05-13',
  offMarketDate: '2026-09-28',
  steps: [
    { date: '2026-05-13', ask: 1_050_000 },
    { date: '2026-06-30', ask: 995_000 },
    { date: '2026-08-27', ask: 925_000 },
  ],
  rangeLow: 987_577,
  rangeHigh: 1_113_820,
  rangeLabel: 'where homes like yours sold, adjusted for date, size and seller concessions',
  status: 'canceled',
  days: 138,
  caption: 'Your asking price against the range the sales support',
}

describe('915 Saginaw: no label sits on another label or on the line', () => {
  it('desktop: the $925K ask and "canceled after 138 days" are both drawn, apart', () => {
    const svg = listingTimelineSvg(SAGINAW)
    expect(collisions(svg)).toEqual([])
    const text = drawn(svg)
    for (const want of ['$1.05M', '$995K', '$925K', '$1.11M', '$988K', 'May 13', 'Sep 28']) expect(text).toContain(want)
    expect(text.join(' ')).toContain('canceled')
    expect(text.join(' ')).toContain('after 138 days')
    expect(text.join(' ')).toContain('where homes like yours sold')
  })

  it('phone: the zone caption clears the $995K label and the $995K line', () => {
    const svg = listingTimelinePhoneSvg(SAGINAW)
    expect(collisions(svg)).toEqual([])
    const text = drawn(svg)
    for (const want of ['$1.05M', '$995K', '$925K', 'where homes like yours sold,', 'adjusted for date, size and seller concessions']) {
      expect(text).toContain(want)
    }
    expect(text.join(' ')).toContain('canceled after 138 days')
  })
})

describe('the placement holds on other shapes', () => {
  const shapes: Array<[string, ListingTimelineInput]> = [
    [
      'four cuts bunched at the end over a thin zone under the line (2745 Aldrich)',
      {
        listDate: '2026-03-13',
        offMarketDate: '2026-06-29',
        steps: [
          { date: '2026-03-13', ask: 520_000 },
          { date: '2026-06-04', ask: 515_000 },
          { date: '2026-06-14', ask: 505_000 },
          { date: '2026-06-23', ask: 495_000 },
        ],
        rangeLow: 474_000,
        rangeHigh: 479_000,
        rangeLabel: 'where homes like yours sold, adjusted for date, size and seller concessions',
        status: 'expired',
        days: 108,
        caption: 'c',
      },
    ],
    [
      'five asks, the last two days apart (19120 Gateway)',
      {
        listDate: '2025-10-08',
        offMarketDate: '2026-09-16',
        steps: [
          { date: '2025-10-08', ask: 1_480_000 },
          { date: '2025-11-06', ask: 1_400_000 },
          { date: '2026-03-01', ask: 1_380_000 },
          { date: '2026-06-28', ask: 1_360_000 },
          { date: '2026-07-24', ask: 1_350_000 },
        ],
        rangeLow: 1_180_000,
        rangeHigh: 1_290_000,
        rangeLabel: 'where homes like yours sold, adjusted for date and seller concessions',
        status: 'canceled',
        days: 343,
        caption: 'c',
      },
    ],
    [
      'an ask inside the zone, the caption on the ask (20506 Murphy)',
      {
        listDate: '2026-03-06',
        offMarketDate: '2026-09-01',
        steps: [
          { date: '2026-03-06', ask: 769_000 },
          { date: '2026-06-01', ask: 729_000 },
        ],
        rangeLow: 689_000,
        rangeHigh: 800_000,
        rangeLabel: 'where homes like yours sold, adjusted for date and size',
        status: 'withdrawn',
        days: 179,
        caption: 'c',
      },
    ],
  ]
  for (const [name, input] of shapes) {
    it(`${name}: wide and phone`, () => {
      for (const svg of [listingTimelineSvg(input), listingTimelinePhoneSvg(input)]) {
        expect(collisions(svg)).toEqual([])
        // Nothing the reading needs is left off: every ask, the end, the zone.
        const text = drawn(svg).join(' ')
        expect(text).toContain('where homes like yours sold')
        expect(text).toMatch(/after \d+ days/)
        expect(svg.match(/class="tl-mark"/g)?.length).toBe(input.steps.length)
      }
    })
  }
})

describe('the pieces', () => {
  it('breaks the end label where the longer line is shortest, never between a count and its unit', () => {
    expect(endLabelLines('canceled after 138 days', 12.5)).toEqual(['canceled', 'after 138 days'])
    for (const text of ['withdrawn after 25 days', 'on the market 52 days', 'came off after 106 days']) {
      const [a, b] = endLabelLines(text, 12)!
      expect(`${a} ${b}`).toBe(text)
      expect(a).not.toMatch(/\d$/)
    }
    expect(endLabelLines('expired', 12)).toBeNull()
  })

  it('parts two gutter figures a line apart, and prints one when both edges are one price', () => {
    const near = gutterEdgeLabels({ high: '$479K', low: '$474K', highY: 180.4, lowY: 195.4, fs: 12 })
    expect(near[1]!.y - near[0]!.y).toBeGreaterThanOrEqual(12 * 1.35 - 1e-9)
    expect((near[0]!.y + near[1]!.y) / 2).toBeCloseTo((180.4 + 195.4) / 2)
    const apart = gutterEdgeLabels({ high: '$1.11M', low: '$988K', highY: 62.6, lowY: 151.4, fs: 12 })
    expect(apart.map((e) => e.y)).toEqual([62.6, 151.4])
    expect(gutterEdgeLabels({ high: '$734K', low: '$734K', highY: 195.4, lowY: 195.4, fs: 12 })).toEqual([
      { text: '$734K', y: 195.4 },
    ])
  })

  it('keeps the drawing inside its viewBox, growing it only for a line under the dates', () => {
    const phone = listingTimelinePhoneSvg(SAGINAW)
    const h = Number(/viewBox="0 0 360 ([\d.]+)"/.exec(phone)![1])
    expect(h).toBeGreaterThanOrEqual(210)
    expect(listingTimelineSvg(SAGINAW)).toContain('viewBox="0 0 720 250"')
  })
})
