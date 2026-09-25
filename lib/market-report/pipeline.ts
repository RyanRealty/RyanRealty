/**
 * The monthly market report pipeline: the steps the crons and the scripts share.
 *
 *   refreshReportWindow   bring the report store current for a window of months:
 *                         Market Truth sale facts (pruned and refreshed), on-market
 *                         episodes, per-listing report attributes, the compact
 *                         copies, then every period in the window recomputed.
 *   publishEdition        build one edition from the stored series, hold it when
 *                         the Spark reconciliation gate (CLAUDE.md §0) fails,
 *                         otherwise render the PDF, store it and publish.
 *
 * The daily cron (app/api/cron/market-report-refresh) runs the closings
 * reconciliation repair and then refreshReportWindow over the trailing 13
 * months. The monthly cron (app/api/cron/market-report-publish) runs
 * publishEdition for the month that just ended.
 */
import {
  computeMarketReportPeriod,
  pruneMarketFactSale,
  refreshMarketFactSale,
  refreshMarketFactSpans,
  refreshMarketReportFactsSince,
  refreshMarketReportGeo,
  refreshMarketReportListingSince,
  upsertMarketReportListings,
  REPORT_DEFINITION_ID,
  type ReportPeriodKind,
} from '@/lib/data/market-report/compute'
import { getReportBands, getReportSeries, type ReportBandRow, type ReportSeriesRow } from '@/lib/data/market-report/series'
import { getEditionForWrite, upsertEdition, uploadEditionPdf } from '@/lib/data/market-report/editions'
import { buildEdition, editionFetchWindow, editionSlug, editionTitle } from './build-edition'
import { zonedDateKey } from '@/lib/format/date'
import { addMonths, lastDayOf } from './format'
import { MONTHLY_CITIES, geoKey } from './geos'
import {
  checkLine,
  crossCheckCitations,
  liveReconcileSources,
  reconcileEdition,
  reconciliationSummary,
  type EditionReconciliation,
  type ReconcileSources,
} from './reconcile'
import { renderEditionPdf } from './pdf/render'

const KINDS: ReportPeriodKind[] = ['month', 'trailing3', 'trailing12', 'quarter']

/** The last calendar month that has fully ended, as YYYY-MM, in Pacific time. */
export function lastCompleteMonth(now = new Date()): string {
  const today = zonedDateKey(now)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error('[lastCompleteMonth] could not read the Pacific calendar day')
  return addMonths(today.slice(0, 7), -1)
}

/** Month keys from `from` to `to`, inclusive. */
export function monthRange(from: string, to: string): string[] {
  const out: string[] = []
  for (let k = from; k <= to; k = addMonths(k, 1)) out.push(k)
  return out
}

export type RefreshWindowResult = {
  pruned: number
  spansRebuilt: number
  listingsAttributed: number
  salesRebuilt: number
  spanRowsRebuilt: number
  completeThrough: string | null
  periods: number
  periodErrors: string[]
}

/**
 * Bring the report store current for [fromMonth, toMonth].
 *
 * `spanSince` is the MLS-modified date on-market episodes are rebuilt from (a
 * few days back on a daily run). A drift repair rewrites rows without moving
 * their MLS timestamp, so their keys come in `repairedKeys` and are rebuilt by
 * key.
 */
export async function refreshReportWindow(opts: {
  fromMonth: string
  toMonth: string
  spanSince: string
  attributesSince: string
  repairedKeys?: string[]
  log?: (line: string) => void
}): Promise<RefreshWindowResult> {
  const log = opts.log ?? (() => {})
  const windowStart = `${opts.fromMonth}-01`

  const pruned = await pruneMarketFactSale(windowStart)
  log(`pruned ${pruned} sale facts whose listing is no longer closed`)
  await refreshMarketFactSale(windowStart)
  log(`sale facts refreshed from ${windowStart}`)
  const spansRebuilt = await refreshMarketFactSpans(opts.spanSince)
  log(`on-market episodes rebuilt for ${spansRebuilt} listings modified since ${opts.spanSince}`)
  // Repaired listings had their episodes and membership rebuilt by the repair
  // itself (lib/sync/closingsReconcile.ts); only their report attributes follow here.
  let listingsAttributed = await refreshMarketReportListingSince(opts.attributesSince)
  if (opts.repairedKeys && opts.repairedKeys.length > 0) {
    listingsAttributed += await upsertMarketReportListings(opts.repairedKeys)
  }
  await refreshMarketReportGeo()
  log(`report attributes refreshed for ${listingsAttributed} listings`)
  const facts = await refreshMarketReportFactsSince(windowStart)
  log(`compact copies rebuilt: ${facts.salesRebuilt} sales, ${facts.spansRebuilt} episodes; complete through ${facts.completeThrough}`)

  let periods = 0
  const periodErrors: string[] = []
  for (const month of monthRange(opts.fromMonth, opts.toMonth)) {
    const end = lastDayOf(month)
    const m = Number(month.slice(5, 7))
    for (const kind of KINDS) {
      if (kind === 'quarter' && m % 3 !== 0) continue
      const r = await computeMarketReportPeriod(kind, end, { definitionId: REPORT_DEFINITION_ID })
      periods += 1
      if (!r.ok) periodErrors.push(`${kind} ${end}: ${r.error ?? 'failed'}`)
    }
  }
  log(`recomputed ${periods} periods${periodErrors.length ? `, ${periodErrors.length} refused` : ''}`)

  return {
    pruned,
    spansRebuilt,
    listingsAttributed,
    salesRebuilt: facts.salesRebuilt,
    spanRowsRebuilt: facts.spansRebuilt,
    completeThrough: facts.completeThrough,
    periods,
    periodErrors,
  }
}

/** Load the stored series and bands an edition (or a run of editions) reads. */
export async function loadEditionInputs(fromMonth: string, toMonth: string): Promise<{
  series: ReportSeriesRow[]
  bands: ReportBandRow[]
}> {
  const series = await getReportSeries({
    kinds: KINDS,
    fromEnd: editionFetchWindow(fromMonth).fromEnd,
    toEnd: lastDayOf(toMonth),
  })
  const bands = await getReportBands({
    fromEnd: lastDayOf(addMonths(fromMonth, -12)),
    toEnd: lastDayOf(toMonth),
    geoKeys: MONTHLY_CITIES.map(geoKey),
    segments: ['sfr'],
  })
  return { series, bands }
}

export type PublishOutcome = {
  month: string
  /** A dry run built, gated and rendered the edition and wrote nothing. */
  dryRun: boolean
  status: 'published' | 'held' | 'draft'
  holdReason: string | null
  reconciliation: EditionReconciliation | null
  pdfPath: string | null
  pages: number | null
  bytes: number | null
}

function pageCount(pdf: Buffer): number {
  return (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
}

/** How many failing checks a hold reason spells out before it counts the rest. */
const HOLD_REASON_CHECKS = 12

/**
 * Build, gate, render and store one edition.
 *
 * The Spark reconciliation gate runs first (lib/market-report/reconcile.ts):
 * every figure the edition prints that Spark can also produce, within 1%.
 * When any is over, the edition is stored as a draft with the reason and
 * nothing is published: §0 says the conflict goes to Matt, not into a PDF.
 * `status: 'draft'` stores a passing edition without publishing it. `dryRun`
 * builds, gates and renders but writes nothing (a deployment check that the
 * PDF renders in the function). A backfill passes one `sources` to every
 * edition so each month is pulled from Spark once.
 */
export async function publishEdition(opts: {
  month: string
  inputs?: { series: ReportSeriesRow[]; bands: ReportBandRow[] }
  status?: 'published' | 'draft'
  skipReconcile?: boolean
  sources?: ReconcileSources
  dryRun?: boolean
  log?: (line: string) => void
}): Promise<PublishOutcome> {
  const dryRun = opts.dryRun === true
  const log = opts.log ?? (() => {})
  const month = opts.month
  const inputs = opts.inputs ?? (await loadEditionInputs(month, month))
  const generatedAt = new Date().toISOString()
  const payload = buildEdition({
    editionMonth: month,
    series: inputs.series,
    bands: inputs.bands,
    generatedAt,
    definitionId: REPORT_DEFINITION_ID,
  })

  const reconciliation = opts.skipReconcile
    ? null
    : await reconcileEdition(payload, opts.sources ?? liveReconcileSources())
  const failing = reconciliation?.checks.filter((c) => !c.ok) ?? []
  if (reconciliation) {
    log(reconciliationSummary(reconciliation))
    for (const i of reconciliation.inconsistencies) log(`FAIL printed twice: ${i}`)
    for (const c of failing) log(checkLine(c))
  }
  const base = {
    editionMonth: month,
    slug: editionSlug(month),
    title: editionTitle(month),
    payload,
    // §0: the cross-check ships with the edition, beside the figure citations.
    citations: reconciliation ? [...payload.citations, ...crossCheckCitations(reconciliation)] : payload.citations,
    summary: payload.headline.join(' '),
    dataCompleteThrough: payload.dataCompleteThrough,
    definitionId: REPORT_DEFINITION_ID,
    generatedAt,
  }

  if (reconciliation && !reconciliation.ok) {
    const holdReason = [
      reconciliationSummary(reconciliation),
      ...reconciliation.inconsistencies.map((i) => `printed twice: ${i}`),
      ...failing.slice(0, HOLD_REASON_CHECKS).map(checkLine),
      ...(failing.length > HOLD_REASON_CHECKS ? [`and ${failing.length - HOLD_REASON_CHECKS} more`] : []),
    ].join(' | ')
    if (!dryRun) {
      const existing = await getEditionForWrite(month)
      // Never demote an edition already published: it keeps what it showed, and
      // the hold is reported instead.
      if (existing?.status !== 'published') {
        await upsertEdition({ ...base, status: 'draft', pdfPath: null, pdfBytes: null, pageCount: null, holdReason })
      }
    }
    return { month, dryRun, status: 'held', holdReason, reconciliation, pdfPath: null, pages: null, bytes: null }
  }

  const { pdf } = await renderEditionPdf(payload)
  const pages = pageCount(pdf)
  const status = opts.status ?? 'published'
  if (dryRun) {
    log(`${month}: ${pages} pages, ${(pdf.length / 1024).toFixed(0)} KB (dry run, nothing written)`)
    return { month, dryRun, status, holdReason: null, reconciliation, pdfPath: null, pages, bytes: pdf.length }
  }
  const pdfPath = await uploadEditionPdf(month, pdf)
  await upsertEdition({ ...base, status, pdfPath, pdfBytes: pdf.length, pageCount: pages, holdReason: null })
  log(`${month}: ${pages} pages, ${(pdf.length / 1024).toFixed(0)} KB → ${status}`)
  return { month, dryRun, status, holdReason: null, reconciliation, pdfPath, pages, bytes: pdf.length }
}
