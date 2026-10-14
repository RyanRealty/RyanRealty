/**
 * Reconcile the buyer-ad map points against the stored monthly report series.
 *
 *   npx tsx --conditions=react-server scripts/sale-leverage-reconcile.ts
 *   npx tsx --conditions=react-server scripts/sale-leverage-reconcile.ts --geo city:bend --segment detached --quarter 2026-09
 *   ... --list   also lists each drawn point outside the Bend box (month, rounded coordinate, flags)
 *
 * Calls getSaleLeveragePoints (lib/data/market-report/leverage-points.ts) for
 * the quarter and each of its months, reads the stored market_report_series
 * rows for the same geography, segment and periods (definition mr-v1, via
 * getReportSeries), and prints both sides:
 *
 *   closed    vs closed_n
 *   priceCut  vs price_cut_n
 *   credit    vs concession_with_n
 *
 * Then the sales the map cannot draw (no usable coordinates) and the drawn
 * points outside a rough Bend box. Exit 1 on any count mismatch. Read-only;
 * prints no listing key, address or name.
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()

import { REPORT_DEFINITION_ID } from '@/lib/data/market-report/compute'
import { getSaleLeveragePoints, type LeverageGeoType, type SaleLeveragePoints } from '@/lib/data/market-report/leverage-points'
import { getReportSeries, type ReportSegment, type ReportSeriesRow } from '@/lib/data/market-report/series'

const argv = process.argv.slice(2)
const flag = (n: string) => {
  const i = argv.indexOf(`--${n}`)
  return i >= 0 ? argv[i + 1] : undefined
}

/**
 * A rough box around the City of Bend and its edge (Deschutes River Woods to
 * the south, Tumalo Road to the north-west, the airport to the east). MLS city
 * text "Bend" reaches past it into the rural Bend postal area, so a point
 * outside is not wrong by itself; it is listed for the map's framing.
 */
const BEND_BOX = { south: 43.95, north: 44.15, west: -121.45, east: -121.2 }

function lastDay(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y!, m!, 0)).toISOString().slice(0, 10)
}

function monthsOfQuarter(quarterEnd: string): string[] {
  const [y, m] = quarterEnd.split('-').map(Number)
  return [m! - 2, m! - 1, m!].map((mm) => `${y}-${String(mm).padStart(2, '0')}`)
}

type Line = { label: string; ours: number; stored: number | null }

function compare(lines: Line[]): boolean {
  let ok = true
  for (const l of lines) {
    const match = l.stored != null && l.ours === l.stored
    if (!match) ok = false
    const delta = l.stored == null ? 'n/a' : String(l.ours - l.stored)
    console.log(`  ${l.label.padEnd(10)} ours ${String(l.ours).padStart(5)}   stored ${String(l.stored ?? 'none').padStart(5)}   delta ${delta}${match ? '' : '   MISMATCH'}`)
  }
  return ok
}

function linesFor(r: SaleLeveragePoints, row: ReportSeriesRow | undefined): Line[] {
  return [
    { label: 'closed', ours: r.counts.closed, stored: row?.closed_n ?? null },
    { label: 'priceCut', ours: r.counts.priceCut, stored: row?.price_cut_n ?? null },
    { label: 'credit', ours: r.counts.credit, stored: row?.concession_with_n ?? null },
  ]
}

async function main() {
  const geo = flag('geo') ?? 'city:bend'
  const segment = (flag('segment') ?? 'detached') as ReportSegment
  const quarter = flag('quarter') ?? '2026-09'
  const geoType = geo.split(':')[0] as LeverageGeoType
  const geoSlug = geo.slice(geo.indexOf(':') + 1)
  if (!/^\d{4}-(03|06|09|12)$/.test(quarter)) throw new Error('--quarter takes the YYYY-MM of a quarter-end month')

  const months = monthsOfQuarter(quarter)
  const qFrom = `${months[0]}-01`
  const qTo = lastDay(quarter)

  const stored = await getReportSeries({
    kinds: ['month', 'quarter'],
    fromEnd: lastDay(months[0]!),
    toEnd: qTo,
    geoKeys: [geo],
    segments: [segment],
  })
  const storedRow = (kind: 'month' | 'quarter', end: string) =>
    stored.find((s) => s.period_kind === kind && s.period_end === end)

  let ok = true
  const q = await getSaleLeveragePoints({ geoType, geoSlug, segment, from: qFrom, to: qTo })
  const qRow = storedRow('quarter', qTo)
  console.log(`\n${geo} ${segment} quarter ${qFrom}..${qTo} (definition ${REPORT_DEFINITION_ID})`)
  if (qRow) console.log(`  stored row: computed_at ${qRow.computed_at}, complete_through ${qRow.complete_through}`)
  ok = compare(linesFor(q, qRow)) && ok
  console.log(`  both       ours ${String(q.counts.both).padStart(5)}   (no stored column)`)
  console.log(`  source: ${q.source}`)

  for (const ym of months) {
    const r = await getSaleLeveragePoints({ geoType, geoSlug, segment, from: `${ym}-01`, to: lastDay(ym) })
    const row = storedRow('month', lastDay(ym))
    console.log(`\n${geo} ${segment} month ${ym}`)
    ok = compare(linesFor(r, row)) && ok
  }

  console.log(`\nMap points with coordinates: ${q.points.length} of ${q.counts.closed} closings`)
  console.log(
    `  drawn by flag: price cut ${q.points.filter((p) => p.priceCut).length}, credit ${q.points.filter((p) => p.credit).length}, both ${q.points.filter((p) => p.priceCut && p.credit).length}`,
  )
  console.log(`  missing coordinates (counted, not drawn): ${q.counts.missingCoords}`)
  for (const u of q.unmapped) console.log(`    ${u.closeMonth}  cut=${u.priceCut} credit=${u.credit}`)

  const side = (p: { lat: number; lng: number }) =>
    p.lat < BEND_BOX.south ? 'south' : p.lat > BEND_BOX.north ? 'north' : p.lng < BEND_BOX.west ? 'west' : p.lng > BEND_BOX.east ? 'east' : null
  const outside = q.points.filter((p) => side(p) != null)
  const bySide = new Map<string, number>()
  for (const p of outside) bySide.set(side(p)!, (bySide.get(side(p)!) ?? 0) + 1)
  console.log(
    `  outside the rough Bend box (lat ${BEND_BOX.south}..${BEND_BOX.north}, lng ${BEND_BOX.west}..${BEND_BOX.east}): ${outside.length}` +
      (outside.length ? ` (${[...bySide].map(([s, n]) => `${s} ${n}`).join(', ')})` : ''),
  )
  if (argv.includes('--list')) {
    for (const p of outside) {
      console.log(`    ${p.closeMonth}  ${p.lat.toFixed(3)}, ${p.lng.toFixed(3)}  ${side(p)}  cut=${p.priceCut} credit=${p.credit}`)
    }
  }

  console.log(ok ? '\nRECONCILED: every count equals the stored row.' : '\nNOT RECONCILED: see MISMATCH lines.')
  process.exit(ok ? 0 : 1)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
