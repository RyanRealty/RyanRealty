/**
 * DATA_GRAPHICS slots shared by city / neighborhood / community / plat.
 * One question per drawing. n < 6 closes omits the cost/pace chart.
 * MOS is a caption, never a giant tile above the chart.
 */
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import type { LeftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import type { V3ChartProps, V3InstrumentFigure, V3QuietItem } from '@/components/site/v3'

/** DATA_GRAPHICS: fewer than 6 closes in the window is not a typical. */
export const PLACE_CHART_MIN_CLOSES = 6

/** Quiet line when the cost/pace drawing cannot be honest. Locked copy. */
export const TOO_FEW_SALES_LINE = 'Too few recent sales here to chart.'

export function placeClosesHold(n: number | null | undefined): boolean {
  return typeof n === 'number' && Number.isFinite(n) && n >= PLACE_CHART_MIN_CLOSES
}

/**
 * 12-month leftover closed count, else the sum of monthly sold counts the
 * slope already plots. Unknown stays null — do not chart a typical we cannot n.
 */
export function leftoverClosedCount(
  hud: Pick<LeftoverHudKpis, 'sold12mo'>,
  months?: readonly { soldCount?: number | null }[],
): number | null {
  if (hud.sold12mo != null && Number.isFinite(hud.sold12mo) && hud.sold12mo > 0) {
    return hud.sold12mo
  }
  if (!months?.length) return null
  let sum = 0
  let any = false
  for (const month of months) {
    if (month.soldCount != null && Number.isFinite(month.soldCount) && month.soldCount > 0) {
      sum += month.soldCount
      any = true
    }
  }
  return any ? sum : null
}

/** Last complete calendar year of MLS plat-name closings. YTD is the fallback. */
export function platRecentClosedCount(
  history: readonly { year: number; closedCount: number }[],
  now = new Date(),
): number | null {
  const thisYear = now.getFullYear()
  const lastComplete = [...history]
    .filter((row) => row.year < thisYear && row.closedCount > 0)
    .sort((a, b) => b.year - a.year)[0]
  if (lastComplete) return lastComplete.closedCount
  const ytd = history.find((row) => row.year === thisYear && row.closedCount > 0)
  return ytd ? ytd.closedCount : null
}

export function placeCostChart(
  n: number | null | undefined,
  chart: V3ChartProps | undefined,
): V3ChartProps | undefined {
  return placeClosesHold(n) ? chart : undefined
}

export function tooFewSalesItems(): V3QuietItem[] {
  return [{ kind: 'prose', body: TOO_FEW_SALES_LINE }]
}

/** Verdict as a caption, not a five-number HUD. MOS digits stay in the sentence. */
export function cityVerdictCaption(input: {
  mos: number | null
  verdict: { kind: string; label: string } | null
}): string | null {
  if (input.mos == null || !Number.isFinite(input.mos) || input.mos <= 0) return null
  if (!input.verdict || input.verdict.kind === 'unknown') return null
  return `${formatMonthsOfSupply(input.mos)} months of homes on the market. A ${input.verdict.label}.`
}

export function withoutMosTile(figures: readonly V3InstrumentFigure[]): V3InstrumentFigure[] {
  return figures.filter((figure) => String(figure.label) !== 'months of supply')
}
