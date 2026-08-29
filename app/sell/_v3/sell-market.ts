/**
 * /sell market block. One sentence, one chart, a few live figures.
 * Extra product types live on /housing-market. A withheld figure is absent.
 */
import {
  leftoverMarketFigures,
  placeMedianChart,
} from '@/app/cities/[slug]/_v3/city-sections'
import { v3Text, type V3InstrumentFigure } from '@/components/site/v3'
import { leftoverHudKpis, type LeftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import { MOS_METHODOLOGY_CLAUSE, MOS_THRESHOLD_CLAUSE } from '@/lib/market/classify'
import type { PublicPaceRow } from '@/lib/data/market-truth/public-pace'
import type { SellBendMarket } from '@/lib/data/market-truth/getSellBendMarket'
import type { KbYearSeries } from '@/lib/kb/year-series'
import { BEND_MARKET_TRACE_SCOPE } from './sell-constants'

const SELL_FIGURE_LABELS = new Set([
  'median list price',
  'detached homes for sale',
  'months of supply',
  'median to pending · 90 days',
  'sale to original list · 12 months',
])

export function sellBendHud(
  bend: SellBendMarket | null,
  pace: PublicPaceRow,
): LeftoverHudKpis {
  return leftoverHudKpis({
    grain: 'city',
    headlines: bend
      ? {
          activeCount: bend.activeCount,
          monthsOfSupply: bend.monthsOfSupply,
          medianListPrice: bend.medianListPrice,
        }
      : null,
    inventory: bend
      ? {
          activeCount: bend.activeCount,
          medianListPrice: bend.medianListPrice,
        }
      : null,
    pace,
  })
}

export function sellBendFigures(hud: LeftoverHudKpis): V3InstrumentFigure[] {
  return leftoverMarketFigures(hud, {
    browse: '/housing-market/bend',
    monthsOfSupply: '/months-of-supply',
  }).filter((figure) => SELL_FIGURE_LABELS.has(String(figure.label)))
}

export function sellBendChart(years: readonly KbYearSeries[]) {
  return placeMedianChart(years, 'Median close by month, single-family, Bend')
}

export function sellBendSentence(
  mosLabel: string | null,
  verdictLabel: string | null,
): string | null {
  if (!mosLabel || !verdictLabel) return null
  return `Bend has ${mosLabel} months of supply, which is a ${verdictLabel}.`
}

export function sellBendTrace(hasMos: boolean): string {
  return hasMos
    ? `${BEND_MARKET_TRACE_SCOPE} ${MOS_METHODOLOGY_CLAUSE} ${MOS_THRESHOLD_CLAUSE}`
    : BEND_MARKET_TRACE_SCOPE
}

export function sellBendHeadline(hasVerdict: boolean) {
  return v3Text(hasVerdict ? 'How tight Bend is' : 'The Bend market')
}
