import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { LeftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import { MOS_METHODOLOGY_CLAUSE } from '@/lib/market/classify'
import { REGION_CITIES_SOURCE, REGION_FOLD_LABEL, REGION_MARKET_FOLD_LABEL } from './region-constants'
import { marketReportHereBody } from '@/lib/market/report-doors'
import { v3Text } from '@/components/site/v3'
import {
  REGION_JARGON_RE,
  buildRegionInsightPages,
  buildRegionInstruments,
  buildRegionMosChart,
  composeRegionLiveTrace,
  insightFaceForRead,
  insightIsScrubbing,
  monthlyPaceFromMos,
} from './region-figures'

const HUD: LeftoverHudKpis = {
  active: 655,
  pending: 293,
  closed30: 180,
  new30: 210,
  medianList: 939900,
  saleToList: 97.4,
  daysToPending: 24,
  monthsSupply: 3.8,
  sold12mo: 1740,
}

describe('SITE-88 visitor-facing region traces', () => {
  it('does not print leftover membership, sample-gated, or MarketPulse', () => {
    const { live, pace } = buildRegionInstruments(HUD, '3.8')
    const extra = composeRegionLiveTrace(live.trace, true)
    for (const text of [
      live.trace,
      pace.trace,
      extra,
      REGION_CITIES_SOURCE,
      REGION_FOLD_LABEL,
      REGION_MARKET_FOLD_LABEL,
    ]) {
      expect(text, text).not.toMatch(REGION_JARGON_RE)
    }
  })

  it('uses a one-line visitor citation when the MOS drawing publishes', () => {
    const { live } = buildRegionInstruments(HUD, '3.8')
    expect(live.trace).toBe(
      'Active single-family houses across Central Oregon from Oregon Data Share MLS.',
    )
    expect(live.trace).not.toContain(MOS_METHODOLOGY_CLAUSE)
  })

  it('keeps MOS methodology on the Instrument when the drawing cannot publish', () => {
    const { live } = buildRegionInstruments({ ...HUD, monthsSupply: null }, null)
    expect(live.trace).toContain('Oregon Data Share')
  })

  it('describes extra figures in buyer language, not pipeline vocabulary', () => {
    const { live } = buildRegionInstruments(HUD, '3.8')
    const extra = composeRegionLiveTrace(live.trace, true)
    expect(extra).toContain('enough listings exist to publish them')
    expect(extra).toContain('buyers and sellers ask about')
    expect(composeRegionLiveTrace(live.trace, false)).toBe(live.trace)
  })

  it('the region here-copy does not say city pulse', () => {
    expect(marketReportHereBody('region')).not.toMatch(REGION_JARGON_RE)
  })

  it('the fold label names what is behind it and never a count', () => {
    for (const label of [REGION_FOLD_LABEL, REGION_MARKET_FOLD_LABEL]) {
      expect(label).not.toMatch(/\d/)
      expect(label.length).toBeGreaterThan(20)
      expect(label.toLowerCase()).not.toContain('all ')
      expect(label.toLowerCase()).not.toContain('figures')
    }
  })

  it('the route _v3 set imports the catalog specifiers Tip Ready requires', () => {
    const catalog = readFileSync(resolve(__dirname, 'region-catalog.ts'), 'utf8')
    const page = readFileSync(resolve(__dirname, '../page.tsx'), 'utf8')
    expect(catalog).toContain("from '@/components/motion/insight-cards'")
    expect(catalog).toContain("from '@/components/motion/digit-swap'")
    expect(catalog).toContain('DigitSwap')
    expect(catalog).not.toContain('DigitSwapReplay')
    expect(page).toContain('replay')
    const cards = readFileSync(resolve(__dirname, '../../../../components/motion/insight-cards.tsx'), 'utf8')
    expect(cards).not.toMatch(/from ['"]@\/components\/motion\/insight-pager['"]/)
    expect(cards).toContain('insight-cards__pager')
    expect(cards).toContain('insight-cards__card')
    expect(cards).toContain('id={id} className="insight-cards__card"')
    expect(cards).toContain('insight-cards__kinds')
    expect(cards).toContain('data-insight-next')
    expect(cards).not.toContain("index === nextKind && 'v3-chart__hover'")
    expect(cards.indexOf('insight-cards__figures')).toBeLessThan(
      cards.indexOf('insight-cards__kinds'),
    )
    const swap = readFileSync(resolve(__dirname, '../../../../components/motion/digit-swap.tsx'), 'utf8')
    expect(swap).toContain('export function DigitSwap')
    expect(swap).toContain('data-slot="digit-swap-glyph"')
    expect(swap).not.toContain('digit-swap-replay')
    expect(swap).not.toMatch(/>Animate</)
    expect(swap).not.toContain('DigitSwapReplay')
    expect(swap).not.toMatch(/alternate\?:/)
    const client = readFileSync(resolve(__dirname, 'RegionInsightCards.client.tsx'), 'utf8')
    expect(client).toContain('id="market-insights"')
    expect(client).toContain('title="Insights"')
    expect(client).toContain('Compare')
    expect(client).toContain('Anomaly')
    expect(client).toContain('Allocation')
    expect(client).toContain('DigitSwap')
    expect(client).not.toContain('hover={false}')
    expect(client).not.toContain('DigitSwapReplay')
    expect(client).not.toMatch(/\bAnimate\b/)
  })

  it('insight pages are distinct jobs, not a year switcher of one series', () => {
    const overlay = {
      caption: v3Text('Median sale price by month, recent years'),
      series: [
        {
          name: v3Text('2024'),
          points: [
            { value: 610000, tick: v3Text('Jan'), label: v3Text('$610K'), at: 1 },
            { value: 602000, tick: v3Text('Aug'), label: v3Text('$602K'), at: 8 },
          ],
        },
        {
          name: v3Text('2026'),
          points: [
            { value: 650000, tick: v3Text('Jan'), label: v3Text('$650K'), at: 1 },
            { value: 664000, tick: v3Text('Aug'), label: v3Text('$664K'), at: 8 },
          ],
        },
      ],
    }
    const monthly = [
      { periodStart: '2024-01-01', medianSalePrice: 610000, soldCount: 100 },
      { periodStart: '2024-08-01', medianSalePrice: 602000, soldCount: 110 },
      { periodStart: '2026-01-01', medianSalePrice: 650000, soldCount: 90 },
      { periodStart: '2026-08-01', medianSalePrice: 664000, soldCount: 120 },
    ]
    const pages = buildRegionInsightPages(overlay, HUD, monthly)
    expect(pages.map((page) => page.key)).toEqual([
      'compare-2026-2024',
      'anomaly-closed-2026',
      'mix',
    ])
    expect(pages.map((page) => page.kind)).toEqual(['compare', 'anomaly', 'allocation'])
    expect(pages[0]?.claim).toContain('2026')
    expect(pages[0]?.claim).toContain('2024')
    expect(pages[0]?.claim).toContain('$664K')
    expect(pages[0]?.figure).toContain('602')
    expect(pages[0]?.secondFigure).toContain('664')
    expect(pages[0]?.chart?.series).toHaveLength(2)
    expect(pages[1]?.figure).toBe('120')
    expect(pages[1]?.chart).toBeTruthy()
    expect(pages[1]?.chart?.hover).not.toBe(false)
    expect(pages[1]?.chart?.restingRead).toBe('last')
    expect(pages[1]?.segments?.map((row) => row.key)).toEqual(['2026', '2024'])
    expect(pages[1]?.segments?.every((row) => row.chart)).toBe(true)
    expect(pages[2]?.figure).toContain('655')
    expect(pages[2]?.segments?.map((row) => row.key)).toEqual(['sale', 'pending'])
    expect(pages[0]?.pill).not.toMatch(/scrub/i)
    expect(pages[0]?.chart?.yearPages).toBe(false)
    expect(pages[0]?.chart?.keysToggle).toBe(false)
    expect(pages[0]?.chart?.hover).not.toBe(false)
    expect(pages[0]?.chart?.restingRead).toBe('last')
    expect(pages.some((page) => /YEAR/.test(page.claim))).toBe(false)
    expect(pages[0]).not.toHaveProperty('alternate')
    const hovered = insightFaceForRead(pages[0]!, {
      tick: 'Apr',
      readings: [
        { name: '2024', label: '$610K' },
        { name: '2026', label: '$650K', emphasis: true },
      ],
    })
    expect(hovered.figure).toBe('$610K')
    expect(hovered.secondFigure).toBe('$650K')
    expect(hovered.claim).toContain('Apr')
    expect(hovered.claim).toContain('$650K')
    expect(
      insightIsScrubbing(pages[0]!, {
        tick: 'Aug',
        readings: [
          { name: '2024', label: '$602K' },
          { name: '2026', label: '$664K', emphasis: true },
        ],
      }),
    ).toBe(false)
    expect(
      insightIsScrubbing(pages[0]!, {
        tick: 'Apr',
        readings: [
          { name: '2024', label: '$610K' },
          { name: '2026', label: '$650K', emphasis: true },
        ],
      }),
    ).toBe(true)
  })
})

describe('SITE-88 months of supply is two bars, not a 4.9 tile', () => {
  it('rearranges active / MOS into a counted integer monthly pace', () => {
    expect(monthlyPaceFromMos(655, 3.8)).toBe(172)
    expect(monthlyPaceFromMos(1550, 4.81)).toBe(322)
    expect(monthlyPaceFromMos(null, 3.8)).toBeNull()
    expect(monthlyPaceFromMos(655, 0)).toBeNull()
  })

  it('draws homes for sale vs a month of sales', () => {
    const chart = buildRegionMosChart(HUD, '3.8')
    expect(chart?.kind).toBe('range')
    expect(chart?.id).toBe('central-oregon-mos')
    expect(chart?.rows).toHaveLength(2)
    expect(String(chart?.rows?.[0]?.tick).toLowerCase()).toContain('homes for sale')
    expect(String(chart?.rows?.[1]?.tick).toLowerCase()).toContain('month of sales')
    expect(String(chart?.claim)).toContain('3.8')
    expect(String(chart?.claim)).not.toMatch(/\d+\.\d+\s+sales/)
  })

  it('omits the MOS tile and does not reprint the two bars as jumbo figures', () => {
    const { live } = buildRegionInstruments(HUD, '3.8')
    const labels = live.figures.map((figure) => String(figure.label).toLowerCase())
    expect(labels).not.toContain('homes for sale vs a month of sales')
    expect(labels).not.toContain('a month of sales')
    expect(labels.some((label) => label.includes('homes for sale'))).toBe(false)
    expect(labels.some((label) => label.includes('median list'))).toBe(true)
    expect(labels.some((label) => label.includes('under contract'))).toBe(true)
    for (const figure of live.figures) {
      expect(figure.sentence, String(figure.label)).toBeTruthy()
      expect(String(figure.sentence)).not.toMatch(/\d/)
      expect(figure.count, String(figure.label)).toEqual(expect.any(Number))
    }
  })

  it('keeps the inventory door when the MOS drawing cannot publish', () => {
    const { live } = buildRegionInstruments({ ...HUD, monthsSupply: null }, null)
    const labels = live.figures.map((figure) => String(figure.label).toLowerCase())
    expect(labels.some((label) => label.includes('homes for sale'))).toBe(true)
    expect(labels).not.toContain('a month of sales')
  })

  it('misses omit — never a zero bar', () => {
    expect(buildRegionMosChart({ ...HUD, active: null }, '3.8')).toBeUndefined()
    expect(buildRegionMosChart(HUD, null)).toBeUndefined()
  })
})
