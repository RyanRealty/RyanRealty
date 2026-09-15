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
  buildRegionPlaceMos,
  composeRegionLiveTrace,
  insightFaceForRead,
  insightIsScrubbing,
  insightReadAtIndex,
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
    expect(page).toContain('See homes for sale')
    expect(page).toContain('Ask about Central Oregon')
    expect(page).toContain('Central Oregon housing market: a ${verdict.label}')
    const cards = readFileSync(resolve(__dirname, '../../../../components/motion/insight-cards.tsx'), 'utf8')
    expect(cards).not.toMatch(/from ['"]@\/components\/motion\/insight-pager['"]/)
    expect(cards).toContain('insight-cards__pager')
    expect(cards).toContain('insight-cards__card')
    expect(cards.indexOf('insight-cards__claim')).toBeLessThan(cards.indexOf('<div className="insight-cards__card">'))
    expect(cards.indexOf('<div className="insight-cards__card">')).toBeLessThan(cards.indexOf('insight-cards__pill'))
    expect(cards).toContain('insight-chart-stage')
    expect(cards).toContain('insight-cards__snapshot')
    expect(cards).toContain('insight-cards__series')
    expect(cards).toContain('insight-cards__series-head')
    expect(cards).toContain('insight-cards__trend')
    expect(cards).toContain("trend = 'Trend snapshot'")
    expect(cards).toContain('tip?:')
    expect(cards).toContain('id={id}')
    expect(cards).toContain('className={cn(\'insight-cards\'')
    expect(cards).not.toContain('insight-cards__kinds')
    expect(cards).not.toContain('kinds?:')
    expect(cards).toContain('data-insight-next')
    expect(cards).toContain('data-insight-scrub')
    expect(cards).toContain('fill?:')
    expect(cards).toContain('insight-chart-stage--fill')
    expect(cards).not.toContain('fill ? undefined')
    expect(cards).not.toContain("index === nextKind && 'v3-chart__hover'")
    const cardsCss = readFileSync(resolve(__dirname, '../../../../components/motion/insight-cards.css'), 'utf8')
    expect(cardsCss).toContain('.insight-chart-stage .v3-chart__scrub')
    expect(cardsCss).toContain('.insight-chart-stage .v3-chart__y')
    expect(cardsCss).toContain('.insight-chart-stage .v3-chart__x')
    expect(cardsCss).toContain('.insight-chart-stage .v3-chart__tip')
    expect(cardsCss).toContain('display: none')
    expect(cardsCss).not.toContain('v3-chart__scrub-input')
    expect(cardsCss).toContain('.insight-cards__pager-btn {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 1.5rem;\n  height: 1.5rem;')
    expect(cardsCss).toContain('.insight-cards__snap')
    expect(cardsCss).toContain('.insight-chart-tip')
    expect(cardsCss).toContain('.insight-chart-stage .v3-chart__mark')
    const chart = readFileSync(resolve(__dirname, '../../../../components/site/v3/V3Chart.tsx'), 'utf8')
    expect(chart).toContain('{!stage && (marks || emphasisIndex != null)')
    const swap = readFileSync(resolve(__dirname, '../../../../components/motion/digit-swap.tsx'), 'utf8')
    expect(swap).toContain('export function DigitSwap')
    expect(swap).toContain('data-slot="digit-swap-glyph"')
    expect(swap).toContain('w-[1ch]')
    expect(swap).toContain('tracking-[0.08em]')
    expect(swap).toContain('gap-[0.08em]')
    expect(swap).not.toContain('digit-swap-replay')
    expect(swap).not.toMatch(/>Animate</)
    expect(swap).not.toContain('DigitSwapReplay')
    expect(swap).not.toMatch(/alternate\?:/)
    const swapCss = readFileSync(resolve(__dirname, '../../../../components/motion/digit-swap.css'), 'utf8')
    expect(swapCss).not.toContain('box-shadow')
    expect(swapCss).not.toContain('1.125rem')
    const mosCss = readFileSync(resolve(__dirname, '../../../../components/site/v3/V3MosBars.css'), 'utf8')
    expect(mosCss).toContain(":has([data-slot='digit-swap'])")
    expect(mosCss).toContain('.v3-mos__animate')
    expect(mosCss).toContain('border: var(--v3-rule-hairline)')
    expect(mosCss).not.toContain('text-decoration: underline')
    const mos = readFileSync(resolve(__dirname, '../../../../components/site/v3/V3MosBars.tsx'), 'utf8')
    expect(mos).toMatch(/>\s*Animate\s*</)
    expect(mos).toContain('duration={1.2}')
    expect(mos).toContain("previewRevealed ? 'revealed' : 'masked'")
    expect(mos).toContain("previewRevealed ? 'up' : 'down'")
    expect(mos).toContain('suffixLength={suffixLength}')
    expect(mos).toContain("previewRevealed ? live : masked")
    expect(mos).toContain("'•'")
    expect(mos).toContain('open={replay}')
    expect(mos).toContain('const previewRevealed = revealed')
    expect(mos).not.toContain('revealed && !open')
    expect(mos).toContain('const show = useCallback(() => {\n    setOpen(true)\n  }, [])')
    expect(mos).not.toContain('Supply ratio:')
    expect(mos).toMatch(/className="v3-mos__barrow"[\s\S]*onMouseEnter=\{show\}/)
    expect(mos).toContain('setRevealed')
    const tasteCatalog = readFileSync(
      resolve(__dirname, '../../../../design_system/public/taste-catalog.json'),
      'utf8',
    )
    expect(tasteCatalog).toContain(
      'year-open=#market-insights [data-insight-next]@#market-insights!click',
    )
    expect(tasteCatalog).toContain(
      'source-open=#central-oregon-mos .v3-mos__animate@#central-oregon-mos!click',
    )
    const regionCss = readFileSync(resolve(__dirname, 'region-market.css'), 'utf8')
    expect(regionCss).not.toMatch(/\.region-insights \.insight-cards__card \{[\s\S]*border:/)
    expect(regionCss).toContain('#market-insights {\n  min-height: calc(100vh - 6rem);')
    expect(regionCss).toContain('#market .v3-instrument__action { order: 3; }')
    expect(regionCss).toContain('.region-fold-doors')
    expect(regionCss).toContain("data-insight-kind='compare'")
    expect(regionCss).toContain('insight-chart-stage--fill')
    const client = readFileSync(resolve(__dirname, 'RegionInsightCards.client.tsx'), 'utf8')
    expect(client).toContain('id="market-insights"')
    expect(client).toContain('title="Insights"')
    expect(client).toContain('snapshot="Snapshot"')
    expect(client).toContain('trend="Trend snapshot"')
    expect(client).toContain('claim={face.claim}')
    expect(client).toContain('figureSub={face.figureSub}')
    expect(client).toContain('DigitSwap')
    expect(client).toContain('AnomalyToggle')
    expect(client).toContain('stage={stage}')
    expect(client).toContain('fill')
    expect(client).toContain('hover={false}')
    expect(client).toContain('yearPages={false} hover={false} stage')
    expect(client).toContain('InsightChartTip')
    expect(client).toContain('pointCount={pointCount}')
    expect(client).toContain('onScrub')
    expect(client).not.toContain('kinds=')
    expect(client).not.toContain('restingRead="last"')
    expect(client).not.toContain('V3_ROOT_CLASS')
    expect(client).not.toContain('DigitSwapReplay')
    expect(client).not.toMatch(/>\s*Animate\s*</)
    expect(client).toContain('year-open clicks Next')
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
    expect(pages[0]?.figureLabel).toBe('2024')
    expect(pages[0]?.secondFigure).toContain('664')
    expect(pages[0]?.secondLabel).toBe('2026')
    expect(pages[0]?.figureSub).toBe('Aug')
    expect(pages[0]?.secondSub).toBe('Aug')
    expect(pages[0]?.chart?.series).toHaveLength(2)
    expect(pages[1]?.figure).toBe('120')
    expect(pages[1]?.chart).toBeTruthy()
    expect(pages[1]?.chart?.stage).toBe(true)
    expect(pages[1]?.chart?.restingRead).toBeUndefined()
    expect(pages[1]?.segments?.map((row) => row.key)).toEqual(['closings', 'sale'])
    expect(pages[1]?.segments?.map((row) => row.label)).toEqual(['Closings', 'Sale'])
    expect(pages[1]?.segments?.some((row) => /\d{4}/.test(row.label))).toBe(false)
    expect(pages[1]?.segments?.every((row) => row.chart)).toBe(true)
    expect(pages[1]?.segments?.[1]?.chart?.hover).toBe(false)
    expect(pages[1]?.segments?.[1]?.chart?.stage).toBe(true)
    expect(pages[1]?.segments?.[1]?.chart?.restingRead).toBeUndefined()
    expect(pages[2]?.figure).toContain('655')
    expect(pages[2]?.segments?.map((row) => row.key)).toEqual(['sale', 'pending'])
    expect(pages[0]?.pill).not.toMatch(/scrub/i)
    expect(pages[0]?.chart?.yearPages).toBe(false)
    expect(pages[0]?.chart?.keysToggle).toBe(false)
    expect(pages[0]?.chart?.hover).toBe(false)
    expect(pages[0]?.chart?.stage).toBe(true)
    expect(pages[0]?.chart?.restingRead).toBeUndefined()
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
    expect(hovered.figureSub).toBe('Apr')
    expect(hovered.secondSub).toBe('Apr')
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
    const scrubbed = insightReadAtIndex(pages[0]?.chart, 0)
    expect(scrubbed?.tick).toBe('Jan')
    expect(scrubbed?.readings.map((row) => row.label)).toEqual(['$610K', '$650K'])
    const anomalyScrub = insightFaceForRead(pages[1]!, {
      tick: 'Jan',
      readings: [{ name: '2026', label: '90' }],
    })
    expect(anomalyScrub.claim).toContain('Jan')
    expect(anomalyScrub.claim).toContain('90')
    expect(anomalyScrub.claim).not.toContain('120')
    const anomalySale = insightFaceForRead(
      pages[1]!,
      { tick: 'Jan', readings: [{ name: '2026', label: '$650K' }] },
      pages[1]?.segments?.[1],
    )
    expect(anomalySale.claim).toContain('Jan')
    expect(anomalySale.claim).toContain('$650K')
    expect(anomalySale.claim).not.toContain('closed $650K')
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

  it('opens a quoteable source line, not a methodology dump', () => {
    const mos = buildRegionPlaceMos(HUD, '3.8', 'Sep 15, 2026')
    expect(mos?.source).toContain('Oregon Data Share MLS')
    expect(mos?.source).toContain('655')
    expect(mos?.source).toContain('172')
    expect(mos?.source).not.toContain(MOS_METHODOLOGY_CLAUSE)
    expect(mos?.tooltip.source).toBe('Oregon Data Share · single-family · as of Sep 15, 2026')
    expect(mos?.tooltip.source).not.toContain(MOS_METHODOLOGY_CLAUSE)
  })
})
