/**
 * The price-path primitive. Delta 1 of docs/plans/CMA_REIMAGINED_2026-09-07.md.
 *
 * The rule under test everywhere below: the line draws what the record holds
 * and nothing else. A change with no date never lands on a day.
 */
import { describe, expect, it } from 'vitest'
import {
  PRICE_PATH_PHONE,
  cutCountOf,
  finalAskOf,
  priceHistoryEndLabel,
  priceHistoryLineHtml,
  priceHistoryLineSvg,
  priceHistoryReading,
  pricePathFromFinalCycle,
  pricePathFromListing,
  pricePathFromSale,
  type PricePath,
} from '@/lib/cma/price-path'

const CYCLE = {
  listDate: '2026-02-26',
  initialAsk: 475000,
  cuts: [{ date: '2026-07-28', ask: 460000 }],
  cutsDated: true,
  finalAsk: 460000,
  offMarketDate: '2026-09-01',
  status: 'Withdrawn',
  days: 187,
}

/** Only what is DRAWN: the aria-label states the same figures for a reader. */
function drawnText(svg: string): string {
  return [...svg.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)].map((m) => m[1]).join(' ')
}

/** Every <text> box inside the frame — nothing clipped, at either layout. */
function textOutsideViewBox(svg: string): string[] {
  const vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg)
  if (!vb) return ['no viewBox']
  const W = Number(vb[1])
  const H = Number(vb[2])
  const bad: string[] = []
  for (const m of svg.matchAll(/<text[^>]*\bx="([-\d.]+)"[^>]*\by="([-\d.]+)"[^>]*>([\s\S]*?)<\/text>/g)) {
    const x = Number(m[1])
    const y = Number(m[2])
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    if (x < 0 || x > W || y < 0 || y > H) bad.push(`${m[3]} at ${x},${y}`)
  }
  return bad
}

describe('pricePathFromFinalCycle', () => {
  it('carries every dated cut through as a step', () => {
    const p = pricePathFromFinalCycle(CYCLE, '2465 7th')!
    expect(p.startPrice).toBe(475000)
    expect(p.cuts).toEqual([{ date: '2026-07-28', price: 460000 }])
    expect(p.undatedCutTo).toBeNull()
    expect(p.endDate).toBe('2026-09-01')
    expect(p.outcome).toBe('off-market')
    expect(finalAskOf(p)).toBe(460000)
    expect(cutCountOf(p)).toBe(1)
  })

  it('never places an undated cut on a day', () => {
    const p = pricePathFromFinalCycle(
      { ...CYCLE, cuts: [{ date: null, ask: 460000 }], cutsDated: false },
      '2465 7th',
    )!
    expect(p.cuts).toEqual([])
    expect(p.undatedCutTo).toBe(460000)
    expect(finalAskOf(p)).toBe(460000)
    // Drawn dashed at the end of the period, not stepped mid-line.
    const svg = priceHistoryLineSvg(p)
    expect(svg).toContain('stroke-dasharray="3 3"')
    expect(svg).not.toContain('class="pp-cut"')
  })

  it('runs to list date plus the days it ran when no off-market date is on file', () => {
    const p = pricePathFromFinalCycle({ ...CYCLE, offMarketDate: null }, '2465 7th')!
    expect(p.endDate).toBe('2026-09-01')
  })

  it('returns null with no list date or no ask', () => {
    expect(pricePathFromFinalCycle({ ...CYCLE, listDate: null }, 'x')).toBeNull()
    expect(pricePathFromFinalCycle({ ...CYCLE, initialAsk: null, finalAsk: null }, 'x')).toBeNull()
    expect(pricePathFromFinalCycle(null, 'x')).toBeNull()
  })
})

describe('pricePathFromSale', () => {
  const SALE = {
    address: '730 Quince',
    listPrice: 465000,
    closePrice: 457000,
    closeDate: '2026-07-06',
    domTotal: 25,
    daysToOffer: 1,
  }

  it('runs from the close date back by the days it ran, and lands on the close', () => {
    const p = pricePathFromSale(SALE)!
    expect(p.startDate).toBe('2026-06-11')
    expect(p.startPrice).toBe(465000)
    expect(p.closePrice).toBe(457000)
    expect(p.outcome).toBe('sold')
    // The label names the period the line draws — 25 days from Jun 11 to
    // Jul 6 — never the 1 day to an offer, which is its own row in the grid.
    expect(priceHistoryEndLabel(p)).toBe('sold $457K · 25 days')
  })

  it('draws the close as a SOLID drop — a close date is a recorded date', () => {
    const svg = priceHistoryLineSvg(pricePathFromSale(SALE)!)
    expect(svg).not.toContain('stroke-dasharray')
    expect(svg).toContain('$465K')
    expect(svg).toContain('sold $457K')
  })

  it('draws a sale that closed ABOVE its ask without inventing a cut', () => {
    const p = pricePathFromSale({ ...SALE, listPrice: 400000, closePrice: 410000 })!
    expect(p.cuts).toEqual([])
    expect(p.undatedCutTo).toBeNull()
    expect(priceHistoryEndLabel(p)).toContain('$410K')
  })

  it('returns null without a close', () => {
    expect(pricePathFromSale({ ...SALE, closeDate: null })).toBeNull()
    expect(pricePathFromSale({ ...SALE, closePrice: null })).toBeNull()
  })
})

describe('pricePathFromListing', () => {
  it('reads a competitor that has already cut, with the cut undated', () => {
    const p = pricePathFromListing({
      address: '645 7th',
      listPrice: 415000,
      originalListPrice: 435000,
      onMarketDate: '2026-07-10T17:58:26+00:00',
      daysOnMarket: 59,
      status: 'Active',
    })!
    expect(p.startPrice).toBe(435000)
    expect(p.undatedCutTo).toBe(415000)
    expect(p.outcome).toBe('for-sale')
    expect(cutCountOf(p)).toBe(1)
    expect(p.endDate).toBe('2026-09-07')
  })

  it('reads a peer that came off unsold', () => {
    const p = pricePathFromListing({
      address: '2527 5th',
      listPrice: 360000,
      originalListPrice: 360000,
      onMarketDate: '2025-12-15T18:45:28+00:00',
      daysOnMarket: 36,
      status: 'Canceled',
    })!
    expect(p.outcome).toBe('off-market')
    expect(p.undatedCutTo).toBeNull()
    expect(cutCountOf(p)).toBe(0)
    expect(priceHistoryEndLabel(p)).toBe('came off $360K · 36 days')
  })

  it('names a pending listing as under contract', () => {
    const p = pricePathFromListing({
      address: '592 Redwood',
      listPrice: 419000,
      originalListPrice: 444500,
      onMarketDate: '2026-07-17T16:13:02+00:00',
      daysOnMarket: 52,
      status: 'Pending',
    })!
    expect(p.outcome).toBe('under-contract')
    expect(priceHistoryEndLabel(p)).toContain('under contract')
  })
})

describe('the drawing', () => {
  const path: PricePath = pricePathFromFinalCycle(CYCLE, '2465 7th')!

  it('labels the opening ask and the outcome, and nothing on every point', () => {
    const svg = priceHistoryLineSvg(path)
    expect(svg).toContain('$475K')
    expect(svg).toContain('came off $460K · 187 days')
    // Opening ask, the one cut, the end. Never a number on every vertex.
    expect((drawnText(svg).match(/\$\d/g) ?? []).length).toBeLessThanOrEqual(3)
  })

  it('drops the per-cut labels once there are more than two cuts', () => {
    const many: PricePath = {
      ...path,
      cuts: [
        { date: '2026-04-01', price: 470000 },
        { date: '2026-05-01', price: 465000 },
        { date: '2026-06-01', price: 460000 },
      ],
    }
    const svg = priceHistoryLineSvg(many)
    expect((svg.match(/class="pp-cut"/g) ?? []).length).toBe(3)
    expect(drawnText(svg)).not.toContain('$470K')
  })

  it('fits both layouts with nothing outside the frame', () => {
    expect(textOutsideViewBox(priceHistoryLineSvg(path))).toEqual([])
    expect(textOutsideViewBox(priceHistoryLineSvg(path, PRICE_PATH_PHONE))).toEqual([])
  })

  it('ships both layouts so a phone never pans a chart', () => {
    const html = priceHistoryLineHtml(path, 'subject')
    expect(html).toContain('pp-wide')
    expect(html).toContain('pp-phone')
    expect(html).toContain('data-path="subject"')
  })

  it('reads the whole path aloud for a screen reader', () => {
    expect(priceHistoryReading(path)).toBe(
      '2465 7th: asked $475K on Feb 26, cut to $460K on Jul 28, came off Sep 1, 187 days.',
    )
  })

  it('says an undated change is undated rather than dating it', () => {
    const p = pricePathFromFinalCycle({ ...CYCLE, cuts: [{ date: null, ask: 460000 }], cutsDated: false }, '2465 7th')!
    expect(priceHistoryReading(p)).toContain('date not recorded')
  })

  it('draws nothing from a path with no usable dates', () => {
    expect(priceHistoryLineSvg({ ...path, startDate: 'nope', endDate: 'nope' })).toBe('')
    expect(priceHistoryLineHtml(null)).toBe('')
  })
})
