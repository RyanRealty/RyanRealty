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

import { v3Text, V3Ledger, type V3LedgerFigureRow } from '@/components/site/v3'
import { formatPrice } from '@/lib/format/money'
import type { SubdivisionSalesYear } from '@/lib/data/subdivisions/getSubdivisionSalesHistory'
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

  const { openable, outsideClosed, outsideYears } = splitByExplorerRange(history)

  const rows: V3LedgerFigureRow[] = []
  for (const year of openable.slice(0, MAX_YEAR_ROWS)) {
    rows.push({
      href: historyYearHref(year.year, cityName),
      when: v3Text(String(year.year)),
      what: v3Text(
        year.closedCount === 1
          ? '1 closed sale'
          : `${year.closedCount.toLocaleString('en-US')} closed sales`,
      ),
      // A year with no published median is not a year whose median is zero, so
      // the value column says which of the two it is.
      value: v3Text(
        year.medianClosePrice != null ? formatPrice(year.medianClosePrice) : 'no published median',
      ),
      id: String(year.year),
    })
  }

  // The totals cover EVERY year the RPC returned, including the years with no row.
  const totalClosed = history.reduce((sum, row) => sum + row.closedCount, 0)
  const firstYear = history[history.length - 1]?.year ?? null
  const sinceBit = firstYear != null ? ` since ${firstYear}` : ''
  const homesBit =
    totalClosed === 1
      ? '1 single-family home has closed'
      : `${totalClosed.toLocaleString('en-US')} single-family homes have closed`
  const totalsSentence = `${homesBit} in ${displayName}${sinceBit}.`

  // The years with no row, named with their count. The explorer's range is the
  // reason, and it is read from the same constants the door is built from.
  const outsideBit =
    outsideClosed === 1 ? '1 closing' : `${outsideClosed.toLocaleString('en-US')} closings`
  const outsideYearBit = outsideYears === 1 ? 'one year' : `${outsideYears} years`
  const rangeBit = `The explorer runs from ${HISTORY_MIN_YEAR} to ${HISTORY_MAX_YEAR}`

  const [first, ...rest] = rows

  if (!first) {
    // Every closed year this plat has sits outside the range the explorer opens,
    // so the Ledger has no row it can make a door. The figures still reach the
    // reader through the note, and the empty state states the reason.
    return (
      <V3Ledger
        id="sales-history"
        eyebrow={v3Text(`${displayName} · Sales history`)}
        heading={v3Text(`Closed sales in ${displayName}`)}
        note={v3Text(`${totalsSentence} They fall in ${outsideYearBit} of closings.`)}
        rows={[]}
        emptyMessage={v3Text(
          `${rangeBit}, and every closing recorded in ${displayName} is outside those years, so no ` +
            `row here has a year to open.`,
        )}
        source={v3Text(salesHistoryTrace(displayName))}
        action={{ label: v3Text('Closed sales explorer'), href: HISTORY_PATH, variant: 'ghost' }}
      />
    )
  }

  const note =
    outsideClosed > 0
      ? `${totalsSentence} Each row opens the Central Oregon closed-sales explorer at that year, ` +
        `which covers a wider area than this plat. ${rangeBit}, so the ${outsideBit} recorded here ` +
        `outside those years are in the total above and have no row.`
      : `${totalsSentence} Each row opens the Central Oregon closed-sales explorer at that year, ` +
        `which covers a wider area than this plat.`

  return (
    <V3Ledger
      id="sales-history"
      eyebrow={v3Text(`${displayName} · Sales history`)}
      heading={v3Text(`Closed sales in ${displayName}`)}
      note={v3Text(note)}
      rows={[first, ...rest]}
      source={v3Text(salesHistoryTrace(displayName))}
      action={{ label: v3Text('Closed sales explorer'), href: HISTORY_PATH, variant: 'ghost' }}
    />
  )
}
