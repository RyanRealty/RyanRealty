/**
 * Monthly market report: refresh the listing attributes and compute the series.
 *
 *   npx tsx --conditions=react-server scripts/market-report-compute.ts --listings
 *   npx tsx --conditions=react-server scripts/market-report-compute.ts --from 1997-01 --to 2026-08
 *   npx tsx --conditions=react-server scripts/market-report-compute.ts --from 2026-07 --to 2026-07 --kinds month
 *
 * Flags
 *   --listings              rebuild market_report_listing (batched) and the geography universe first
 *   --facts                 rebuild the compact sale and span copies (after --listings; before computing)
 *   --from YYYY-MM          first period end month (inclusive)
 *   --to YYYY-MM            last period end month (inclusive)
 *   --kinds a,b             month,trailing3,trailing12,quarter (default: all four; quarter only at quarter ends)
 *   --definition <id>       definition_id to write (default mr-v1); use a scratch id for calibration runs
 *   --acreage <n>           acreage threshold in acres (default 1)
 *   --refresh-window        incremental refresh for --from..--to (what the daily cron runs): prune and
 *                           refresh sale facts from --from, rebuild episodes for listings modified since
 *                           --span-since (default --from), refresh report attributes, rebuild the compact
 *                           copies for the window, recompute every period in it
 *   --span-since YYYY-MM-DD with --refresh-window
 *   --window-only           with --facts, compute only --from..--to on purpose (see below)
 *
 * --facts rebuilds every listing's copies, so a computation that goes with it
 * must start at or before the earliest period any edition reads that holds
 * data: the first edition's charts read back to 1993-01 (editionFetchWindow),
 * and the record starts in 1997 (RECORD_START), so 1997-01. The script refuses
 * a later --from without --window-only. On 2026-10-02 a recompute from 2006-01
 * had left the periods before it on older data, behind the 2006 to 2008
 * editions' charts, and 35 editions were republished.
 *
 * Every call is idempotent: a period is deleted and rewritten for its definition.
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()

import { refreshReportWindow } from '@/lib/market-report/pipeline'
import { editionFetchWindow } from '@/lib/market-report/build-edition'
import { FIRST_EDITION_MONTH } from '@/lib/market-report/edition-path-guard'
import {
  computeMarketReportPeriod,
  refreshMarketReportFacts,
  refreshMarketReportGeo,
  refreshMarketReportListingBatch,
  REPORT_DEFINITION_ID,
  type ReportPeriodKind,
} from '@/lib/data/market-report/compute'

const argv = process.argv.slice(2)
function flag(name: string): string | undefined {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : undefined
}
const has = (name: string) => argv.includes(`--${name}`)

function monthEnds(from: string, to: string): string[] {
  const m1 = /^(\d{4})-(\d{2})$/.exec(from)
  const m2 = /^(\d{4})-(\d{2})$/.exec(to)
  if (!m1 || !m2) throw new Error('--from and --to take YYYY-MM')
  let y = Number(m1[1])
  let m = Number(m1[2])
  const endKey = Number(m2[1]) * 12 + Number(m2[2])
  const out: string[] = []
  while (y * 12 + m <= endKey) {
    const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
    out.push(last)
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return out
}

async function refreshListings() {
  let after = ''
  let total = 0
  const t0 = Date.now()
  for (;;) {
    const r = await refreshMarketReportListingBatch(after, 8000)
    if (!r.ok) throw new Error('refresh batch returned not ok')
    total += r.upserted
    if (r.done) break
    after = r.lastKey
    process.stdout.write(`\r  listings: ${total} rows, last ${after.slice(0, 14)}…   `)
  }
  const geos = await refreshMarketReportGeo()
  console.log(`\n  listings done: ${total} rows, ${geos} geographies, ${((Date.now() - t0) / 1000).toFixed(0)}s`)
}

/**
 * The first month of the MLS record the report reads: on 2026-10-02
 * market_report_sale held two sales in 1996 (Aug 20 and Oct 30) and its next on
 * 1997-01-03. A period before it has nothing to compute.
 */
const RECORD_START = '1997-01'

async function main() {
  const earliest = [editionFetchWindow(FIRST_EDITION_MONTH).fromEnd.slice(0, 7), RECORD_START].sort().at(-1)!
  const computeFrom = flag('from')
  if (has('facts') && computeFrom && !has('refresh-window') && computeFrom > earliest && !has('window-only')) {
    throw new Error(
      `--facts rebuilds every listing's copies, so compute from ${earliest} or earlier: editions read every period from there on, ` +
        `and a period before --from would keep values from older data. Pass --window-only to compute just ${computeFrom}..${flag('to')} on purpose.`,
    )
  }
  if (has('listings')) {
    console.log('refreshing market_report_listing')
    await refreshListings()
  }
  if (has('facts')) {
    const t0 = Date.now()
    const f = await refreshMarketReportFacts()
    console.log(`facts rebuilt: ${f.sales} sales, ${f.spans} spans, complete through ${f.completeThrough} (${((Date.now() - t0) / 1000).toFixed(0)}s)`)
  }
  const from = flag('from')
  const to = flag('to')
  if (!from || !to) return
  if (has('refresh-window')) {
    const t0 = Date.now()
    const r = await refreshReportWindow({
      fromMonth: from,
      toMonth: to,
      spanSince: flag('span-since') ?? `${from}-01`,
      attributesSince: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      log: (line) => console.log(`  ${line} (${((Date.now() - t0) / 1000).toFixed(0)}s)`),
    })
    if (r.periodErrors.length > 0) console.log(`refused periods:\n  ${r.periodErrors.join('\n  ')}`)
    return
  }
  const kinds = (flag('kinds') ?? 'month,trailing3,trailing12,quarter').split(',') as ReportPeriodKind[]
  const definitionId = flag('definition') ?? REPORT_DEFINITION_ID
  const acreageMin = flag('acreage') ? Number(flag('acreage')) : 1
  const ends = monthEnds(from, to)
  console.log(`computing ${ends.length} month ends × [${kinds.join(', ')}] → ${definitionId} (acreage ≥ ${acreageMin})`)
  const t0 = Date.now()
  let calls = 0
  for (const end of ends) {
    const month = Number(end.slice(5, 7))
    for (const kind of kinds) {
      if (kind === 'quarter' && month % 3 !== 0) continue
      const r = await computeMarketReportPeriod(kind, end, { definitionId, acreageMin })
      calls += 1
      if (!r.ok) {
        console.log(`\n  ${kind} ${end}: ${r.error}${r.completeThrough ? ` (complete through ${r.completeThrough})` : ''}`)
        continue
      }
      process.stdout.write(`\r  ${kind.padEnd(10)} ${end}  rows ${r.rows}  bands ${r.bandRows ?? 0}  (${calls} calls, ${((Date.now() - t0) / 1000).toFixed(0)}s)   `)
    }
  }
  console.log(`\ndone: ${calls} periods in ${((Date.now() - t0) / 1000).toFixed(0)}s`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
