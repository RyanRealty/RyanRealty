/**
 * SubdivisionSalesHistory — the closed-sales depth section on /subdivisions/[slug]
 * (W2.5), rebuilt on the v3 barrel as PATTERN 3, LEDGER
 * (design_system/public/PUBLIC_UI.md section 3). One row per calendar year, every
 * row a door.
 *
 * SOURCE (one read, one trace, one population): getSubdivisionSalesHistory ->
 * the get_subdivision_sales_history RPC, a server-side GROUP BY year over closed
 * single-family sales for this plat slug. It fails soft to [] before the
 * migration is applied, which is why this component renders NOTHING rather than
 * an empty Ledger saying no sales exist. An empty result here is the absence of
 * an answer, not the answer zero (CLAUDE.md section 0).
 *
 * D9: the yearly series is a chart, not a seventh figure. When the plat-stats
 * Instrument already holds that chart, this file is Ledger only. When that
 * Instrument is absent, the series mounts here as Instrument.chart, then the
 * year rows. Flattening the years into a single figure is the defect D9 names.
 *
 * ODS rule 5-4 A.4: aggregates only. Year, count, median. Never an individual
 * sold address or price, which is VOW-only data. Rule 7-3: the section carries
 * the ODS trace, which lives in _v3/subdivision-traces.ts with the page's other
 * three so no two populations can drift onto one sentence.
 *
 * THE DOOR, AND THE YEARS IT DOES NOT OPEN. A closed year has no page of its own,
 * so each row opens the Central Oregon closed-sales explorer at that year (and at
 * this plat's city when the page knows it). The explorer clamps its `year`
 * parameter to a fixed range, so a row for a year outside that range would open a
 * different year's aggregates while claiming to open its own. Those years are
 * split out in _v3/history-door.ts and stated as a count in the note instead:
 * every figure the RPC returned is still on the page, and no link on it lands on
 * a year other than the one its row names. The note says which years have rows
 * and why, because a row whose figures are plat-level and whose destination is
 * city-level must not let a reader assume otherwise.
 *
 * The per-plat market_stats_cache figures the KB version printed in a strip
 * above this table now render as the page's market Instrument, with their own
 * trace and their own stamp. They were a different population from these yearly
 * aggregates and shared this section's source line.
 */

import {
  v3Text,
  V3Ledger,
  type V3LedgerFigureRow,
} from '@/components/site/v3'
import { publishSubdivisionClosedPrice } from '@/lib/market/publish-subdivision-closed-price'
import type { SubdivisionSalesYear } from '@/lib/data/subdivisions/getSubdivisionSalesHistory'
import { subdivisionFaceClosedTotalsSentence } from './_v3/subdivision-face'
import { MAX_YEAR_ROWS, salesHistoryTrace } from './_v3/subdivision-traces'
import {
  HISTORY_MAX_YEAR,
  HISTORY_MIN_YEAR,
  HISTORY_PATH,
  historyYearHref,
  splitByExplorerRange,
} from './_v3/history-door'

interface Props {
  displayName: string
  history: SubdivisionSalesYear[]
  /** The plat's city, when the page resolved one. Narrows the year door. */
  cityName: string
}

export function SubdivisionSalesHistory({ displayName, history, cityName }: Props) {
  if (history.length === 0) return null

  // COUNTS ONLY, STRUCTURALLY. Every year's median goes through the registry
  // publisher, which withholds at plat grain: 515 of 680 Bend plats never reach
  // ten detached sales in 36 months, and this series is an MLS SubdivisionName
  // join rather than place_membership, so a median of it is not a fact. The
  // publisher is CALLED rather than assumed, so the day the registry lets a plat
  // publish a price this is where it arrives instead of a line someone has to
  // remember to change.
  const priceMayPublish = history.some(
    (row) => publishSubdivisionClosedPrice(row.medianClosePrice) != null,
  )

  const { openable, outsideClosed, outsideYears } = splitByExplorerRange(history)

  const rows: V3LedgerFigureRow[] = []
  for (const year of openable.slice(0, MAX_YEAR_ROWS)) {
    rows.push({
      href: historyYearHref(year.year, cityName),
      when: v3Text(String(year.year)),
      what: v3Text('Single-family closings'),
      value: v3Text(year.closedCount.toLocaleString('en-US')),
      id: String(year.year),
    })
  }

  // The totals cover EVERY year the RPC returned, including the years with no row.
  const totalClosed = history.reduce((sum, row) => sum + row.closedCount, 0)
  const firstYear = history[history.length - 1]?.year ?? null
  const totalsSentence = subdivisionFaceClosedTotalsSentence({
    closedCount: totalClosed,
    placeName: displayName,
    sinceYear: firstYear,
  })

  // The years with no row, named with their count. The explorer's range is the
  // reason, and it is read from the same constants the door is built from.
  const outsideBit =
    outsideClosed === 1 ? '1 closing' : `${outsideClosed.toLocaleString('en-US')} closings`
  const outsideYearBit = outsideYears === 1 ? 'one year' : `${outsideYears} years`
  const rangeBit = `The explorer runs from ${HISTORY_MIN_YEAR} to ${HISTORY_MAX_YEAR}`

  const [first, ...rest] = rows
  const explorerAction = {
    label: v3Text('Closed sales explorer'),
    href: HISTORY_PATH,
    variant: 'ghost' as const,
  }

  const note =
    outsideClosed > 0
      ? `${totalsSentence} Each row opens the Central Oregon closed-sales explorer at that year, ` +
        `which covers a wider area than this neighborhood. ${rangeBit}, so the ${outsideBit} recorded here ` +
        `outside those years are in the total above and have no row.`
      : `${totalsSentence} Each row opens the Central Oregon closed-sales explorer at that year, ` +
        `which covers a wider area than this neighborhood.`

  const ledger = !first ? (
    <V3Ledger
      id="sales-history"
      eyebrow={v3Text(`${displayName} · Sales history`)}
      heading={v3Text(`Closed single-family sales, ${displayName}.`)}
      note={v3Text(`${totalsSentence} They fall in ${outsideYearBit} of closings.`)}
      rows={[]}
      emptyMessage={v3Text(
        `${rangeBit}, and every closing recorded in ${displayName} is outside those years, so no ` +
          `row here has a year to open.`,
      )}
      source={v3Text(salesHistoryTrace(displayName, priceMayPublish))}
      action={explorerAction}
    />
  ) : (
    <V3Ledger
      id="sales-history"
      eyebrow={v3Text(`${displayName} · Sales history`)}
      heading={v3Text(`Closed single-family sales, ${displayName}.`)}
      note={v3Text(note)}
      rows={[first, ...rest]}
      source={v3Text(salesHistoryTrace(displayName, priceMayPublish))}
      action={explorerAction}
    />
  )

  return ledger
}
