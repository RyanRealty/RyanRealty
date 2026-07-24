/**
 * report-document — the body of an exported market document. PURE.
 *
 * Pure on purpose: this is the part a gate and a unit test can EXECUTE with
 * fixture facts and assert against, rather than grep for. `/api/reports/export`
 * keeps the DAL reads and the geo resolution; everything about how figures are
 * grouped and labeled lives here, and both output formats (PDF and XLSX) render
 * from this one builder so the two cannot describe the same document
 * differently.
 *
 * §0 THE RULE THIS ENCODES: every figure states the window it was measured over.
 * A market document mixes three, and they are not interchangeable:
 *
 *   1. the caller's chosen CLOSED-SALE period (median sale price, sold count,
 *      DOM, $/sqft)
 *   2. the TRAILING 12 MONTHS (the 12-month sale count) — a different window,
 *      and for a 30-day request a twelve-times-longer one
 *   3. LIVE INVENTORY (active listings, months of supply) — not a window at
 *      all, a snapshot, whose only honest label is the moment it was refreshed
 *
 * These used to be emitted as one flat key/value list under a single period
 * header, so a Terrebonne export printed "Months of Supply: 21" directly beneath
 * a header reading "Last 30 days", with nothing saying the 21 was computed from
 * live inventory against a six-month sales base. /reports labels these blocks
 * separately on screen; the exported file is the artifact most likely to reach a
 * client detached from the page, so it has less excuse, not more.
 */
import type { ReportSection } from '@/lib/pdf/report-pdf'

/** §0: a figure the cache does not carry is reported as unavailable, never 0. */
export const NA = 'Not available'

/** Render a figure, or say it is unavailable. Never substitutes a zero. */
export function num(v: number | null | undefined): number | string {
  return v == null ? NA : v
}

/** One measured window: what it covers, and the dates it actually covers. */
export type ReportWindow = { label: string; start: string | null; end: string | null }

export type ReportDocumentFacts = {
  /** The caller's chosen closed-sale window. */
  period: ReportWindow
  medianSalePrice: number | null
  soldCount: number | null
  medianDom: number | null
  medianPricePerSqft: number | null
  /** The trailing-12-month window — a DIFFERENT window from `period`. */
  trailing12: ReportWindow
  sales12mo: number | null
  /** Live inventory. Not a window: a snapshot, with its own timestamp. */
  activeCount: number | null
  monthsOfSupply: number | null
  liveAsOf: string | null
  trend: Array<{ month: string; soldCount: number | null; medianSalePrice: number | null }>
}

/**
 * A window as text — the measured row's OWN bounds, never a recomputed guess.
 * Falls back to the bare label when the cache row carried no bounds, so the
 * document never invents dates it does not have.
 */
export function windowText(w: ReportWindow): string {
  return w.start && w.end ? `${w.label} (${w.start} to ${w.end})` : w.label
}

/**
 * The live-inventory heading. Says "live", and says when — a snapshot with no
 * timestamp is a figure with no window, which is the thing this module exists to
 * prevent, so the missing case is stated out loud rather than left blank.
 */
export function liveHeading(f: ReportDocumentFacts): string {
  return f.liveAsOf
    ? `Live single-family inventory (as of ${f.liveAsOf})`
    : 'Live single-family inventory (refresh time unavailable)'
}

/**
 * The document body: one labeled block per measured window. Every figure in the
 * document is inside exactly one block, and every block heading names the window
 * its figures were measured over.
 */
export function buildSections(
  f: ReportDocumentFacts,
  narrative: string | null,
): ReportSection[] {
  const trendLine = f.trend
    .slice(-6)
    .map((row) => `${row.month}: ${row.soldCount ?? 0} sold`)
    .join(' | ')

  return [
    {
      heading: `Closed sales · ${windowText(f.period)}`,
      rows: [
        ['Median Sale Price', num(f.medianSalePrice)],
        ['Sold Count', num(f.soldCount)],
        ['Median DOM', num(f.medianDom)],
        ['Median Price Per SqFt', num(f.medianPricePerSqft)],
      ],
    },
    {
      heading: `Closed sales · ${windowText(f.trailing12)}`,
      rows: [['12 Month Sales', num(f.sales12mo)]],
    },
    {
      heading: liveHeading(f),
      rows: [
        ['Active Listings', num(f.activeCount)],
        ['Months of Supply', num(f.monthsOfSupply)],
      ],
    },
    {
      heading: 'Monthly closed sales · last 6 months',
      rows: [['Recent Trend', trendLine || NA]],
    },
    {
      heading: 'Narrative',
      rows: [['Narrative', narrative ?? 'Narrative not available yet.']],
    },
  ]
}

/**
 * Filename stem. Carries the geo AND the chosen period's real bounds, so two
 * downloads for different windows never collide in a downloads folder.
 */
export function buildDocumentFilename(fileStem: string, period: ReportWindow): string {
  const window = period.start && period.end ? `${period.start}-to-${period.end}` : period.label
  return `market-report-${fileStem}-${window}`.toLowerCase().replace(/\s+/g, '-')
}
