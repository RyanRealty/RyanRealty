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
  /**
   * Whether live inventory is published AT THIS GEO SCOPE at all.
   * `market_pulse_live` holds city and region rows only, so for a community the
   * answer is no — a different statement from "we tried and the figure was
   * missing", and the document must not conflate them. Every community export
   * shipped an undated "Active Listings: Not available / Months of Supply: Not
   * available" pair, which reads as a data outage on a branded PDF.
   */
  livePublishedAtScope?: boolean
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
  if (f.livePublishedAtScope === false) {
    return 'Live single-family inventory (published at city scope only)'
  }
  return f.liveAsOf
    ? `Live single-family inventory (as of ${f.liveAsOf})`
    : 'Live single-family inventory (refresh time unavailable)'
}

/**
 * Heading for the monthly-trend block, naming the months the rows ACTUALLY cover
 * (the same six the line below it lists). Says so plainly when there are none.
 */
export function trendWindowHeading(trend: ReportDocumentFacts['trend']): string {
  const months = trend.slice(-6).map((r) => r.month).filter(Boolean)
  if (months.length === 0) return 'Monthly closed sales (no monthly rows cached)'
  const first = months[0]
  const last = months[months.length - 1]
  return first === last
    ? `Monthly closed sales · ${first}`
    : `Monthly closed sales · ${first} to ${last}`
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
      rows:
        f.livePublishedAtScope === false
          ? // Say why the figures are absent instead of printing two blanks.
            // Pointing at the surface that DOES carry them is the honest move:
            // /communities/<slug> publishes an alias-aware active count.
            [['Active Listings', 'See the community page for current inventory']]
          : [
              ['Active Listings', num(f.activeCount)],
              ['Months of Supply', num(f.monthsOfSupply)],
            ],
    },
    {
      // The window is DERIVED from the rows, never asserted. `.slice(-6)` takes
      // the six most recent CACHED monthly rows, which are not necessarily the
      // six months just past — a geo whose monthly rows stop in 2024 would ship
      // 2024 figures under a heading claiming the last six months. Every other
      // block prints the bounds it actually measured; so does this one.
      heading: trendWindowHeading(f.trend),
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
