/**
 * /api/reports/export — PDF / XLSX market report download.
 *
 * W8.1: reads market_stats_cache + market_pulse_live (the SAME rows the /reports
 * page and the KB city pages render), not the get_city_period_metrics RPC over raw
 * `listings`. One generation path means an exported PDF can no longer disagree
 * with the web page it was exported from.
 *
 * §0 on the period. The old contract accepted ARBITRARY ?periodStart/?periodEnd
 * and computed the window live. The cache holds fixed period_types only, so
 * honoring an arbitrary window is impossible — and snapping it silently while
 * still printing the caller's requested dates would label numbers with a window
 * they do not describe. So the window is now a period_type (?range=), and every
 * document is labeled with the cache row's OWN period_start/period_end. The
 * default (rolling_30d) preserves the old default's meaning ("about the last
 * month"). This endpoint has no in-app callers — it is reachable by direct URL
 * only — so no UI contract depended on the arbitrary-window form.
 *
 * The XLSX "Price Bands" sheet is gone: band histograms exist only in the retired
 * get_city_price_bands RPC, with no cache column, view, or DAL anywhere. A sheet
 * of fabricated bands would be worse than no sheet.
 */
import { NextResponse } from 'next/server'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit } from '@/lib/rate-limit'
import { getBrokerageSettings } from '@/app/actions/brokerage'
import { getCityMarketDetail } from '@/lib/data/market/getCityMarketDetail'
import { getMarketPulse } from '@/lib/data/market/getMarketPulse'
import { getPriceHistory } from '@/lib/data/market/getPriceHistory'
import { citySlugCandidates } from '@/lib/data/market/getCityReportSnapshot'
import { parseRangePeriod, RANGE_PERIOD_LABELS, type RangePeriod } from '@/lib/market/range-periods'
import { MARKET_REPORT_DEFAULT_CITIES } from '@/lib/data/geo/report-cities'
import { slugify } from '@/lib/slug'
import { ReportPdfDocument, type ReportPdfData } from '@/lib/pdf/report-pdf'

type ExportFormat = 'pdf' | 'xlsx'

/** §0: a figure the cache does not carry is reported as unavailable, never 0. */
const NA = 'Not available'
const num = (v: number | null | undefined): number | string => (v == null ? NA : v)

type ExportFacts = {
  geoLabel: string
  periodLabel: string
  periodStart: string | null
  periodEnd: string | null
  medianSalePrice: number | null
  soldCount: number | null
  medianDom: number | null
  medianPricePerSqft: number | null
  activeCount: number | null
  sales12mo: number | null
  monthsOfSupply: number | null
  trend: Array<{ month: string; soldCount: number | null; medianSalePrice: number | null }>
}

/**
 * Resolve one geo's cache rows. A subdivision reads geo_type='subdivision'
 * (market_pulse_live coverage there is sparse, so live fields stay null and
 * render as unavailable rather than borrowing the parent city's numbers).
 *
 * EVERY FIGURE IN A DOCUMENT COMES FROM ONE SLUG SPELLING — the same rule
 * getCityRangeRow documents. Mixing spellings field-by-field produced a workbook
 * whose Summary sheet (44 sales) contradicted its own Trend sheet (92) because
 * the two spellings measured different geographies. Candidates are tried in
 * order and the FIRST that answers supplies every figure.
 */
async function loadFacts(
  city: string,
  subdivision: string | null | undefined,
  period: RangePeriod,
): Promise<ExportFacts> {
  const isSub = !!subdivision?.trim()
  const geoType = isSub ? ('subdivision' as const) : ('city' as const)
  const candidates = isSub ? [slugify(subdivision!.trim())] : citySlugCandidates(city)
  const geoLabel = isSub ? `${subdivision!.trim()}, ${city}` : city

  let detail: Awaited<ReturnType<typeof getCityMarketDetail>> = null
  let twelve: Awaited<ReturnType<typeof getCityMarketDetail>> = null
  let pulse: Awaited<ReturnType<typeof getMarketPulse>> = null
  let history: Awaited<ReturnType<typeof getPriceHistory>> = []

  for (const geoSlug of candidates) {
    const [d, t, p, h] = await Promise.all([
      getCityMarketDetail({ geoType, geoSlug, periodType: period }),
      period === 'rolling_365d'
        ? Promise.resolve(null)
        : getCityMarketDetail({ geoType, geoSlug, periodType: 'rolling_365d' }),
      getMarketPulse({ geoType, geoSlug }),
      getPriceHistory(geoType, geoSlug, 'monthly', 12).catch(() => []),
    ])
    // This candidate answers — commit to it for EVERY figure and stop looking.
    if (d || p || t || h.length > 0) {
      detail = d
      twelve = t
      pulse = p
      history = h
      break
    }
  }

  const t12 = period === 'rolling_365d' ? detail : twelve

  return {
    geoLabel,
    periodLabel: RANGE_PERIOD_LABELS[period],
    periodStart: detail?.periodStart ? String(detail.periodStart).slice(0, 10) : null,
    periodEnd: detail?.periodEnd ? String(detail.periodEnd).slice(0, 10) : null,
    medianSalePrice: detail?.medianSalePrice ?? null,
    soldCount: detail?.soldCount ?? null,
    medianDom: detail?.medianDom ?? null,
    medianPricePerSqft: detail?.medianPricePerSqft ?? null,
    activeCount: pulse?.activeCount ?? null,
    sales12mo: t12?.soldCount ?? null,
    monthsOfSupply: pulse?.monthsOfSupply ?? null,
    trend: history.map((p) => ({
      month: String(p.periodStart).slice(0, 7),
      soldCount: p.soldCount ?? null,
      medianSalePrice: p.medianSalePrice ?? null,
    })),
  }
}

/** The window label printed on the document — the cache row's own bounds. */
function periodText(f: ExportFacts): string {
  return f.periodStart && f.periodEnd
    ? `${f.periodLabel} (${f.periodStart} to ${f.periodEnd})`
    : f.periodLabel
}

function getSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createClient(url, key)
}

async function getNarrative(city: string, subdivision?: string | null): Promise<string | null> {
  const supabase = getSupabaseServiceClient()
  if (!supabase) return null

  const geoType = subdivision?.trim() ? 'subdivision' : 'city'
  const geoName = subdivision?.trim() ? subdivision.trim() : city.trim()
  const { data } = await supabase
    .from('market_narratives')
    .select('narrative')
    .eq('geo_type', geoType)
    .eq('geo_name', geoName)
    .order('period_end', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data as { narrative?: string | null } | null)?.narrative?.trim() ?? null
}

function buildFilename(city: string, subdivision: string | null | undefined, f: ExportFacts) {
  const location = subdivision?.trim() ? `${city}-${subdivision}` : city
  const window = f.periodStart && f.periodEnd ? `${f.periodStart}-to-${f.periodEnd}` : f.periodLabel
  return `market-report-${location}-${window}`.toLowerCase().replace(/\s+/g, '-')
}

async function buildPdf(
  city: string,
  subdivision: string | null | undefined,
  period: RangePeriod,
): Promise<{ fileName: string; bytes: Uint8Array }> {
  const [brokerage, facts, narrative] = await Promise.all([
    getBrokerageSettings(),
    loadFacts(city, subdivision, period),
    getNarrative(city, subdivision),
  ])

  const trendLine = facts.trend
    .slice(-6)
    .map((row) => `${row.month}: ${row.soldCount ?? 0} sold`)
    .join(' | ')

  const pdfData: ReportPdfData = {
    title: `${facts.geoLabel} Market Report`,
    geoName: facts.geoLabel,
    period: periodText(facts),
    metrics: {
      'Median Sale Price': num(facts.medianSalePrice),
      'Sold Count': num(facts.soldCount),
      'Median DOM': num(facts.medianDom),
      'Median Price Per SqFt': num(facts.medianPricePerSqft),
      'Active Listings': num(facts.activeCount),
      '12 Month Sales': num(facts.sales12mo),
      'Months of Supply': num(facts.monthsOfSupply),
      'Recent Trend': trendLine || NA,
      Narrative: narrative ?? 'Narrative not available yet.',
    },
    branding: {
      brokerageName: brokerage?.name ?? 'Ryan Realty',
      brokerageLogoUrl: brokerage?.logo_url ?? null,
    },
  }

  const doc = React.createElement(ReportPdfDocument, { data: pdfData })
  type DocElement = Parameters<typeof renderToBuffer>[0]
  const buffer = await renderToBuffer(doc as DocElement)
  return {
    fileName: `${buildFilename(city, subdivision, facts)}.pdf`,
    bytes: new Uint8Array(buffer),
  }
}

async function buildXlsx(
  city: string,
  subdivision: string | null | undefined,
  period: RangePeriod,
): Promise<{ fileName: string; bytes: Uint8Array }> {
  const [facts, narrative] = await Promise.all([
    loadFacts(city, subdivision, period),
    getNarrative(city, subdivision),
  ])

  const wb = XLSX.utils.book_new()

  const summaryRows = [
    ['City', city],
    ['Subdivision', subdivision?.trim() || NA],
    ['Window', facts.periodLabel],
    ['Period Start', facts.periodStart ?? NA],
    ['Period End', facts.periodEnd ?? NA],
    ['Median Sale Price', num(facts.medianSalePrice)],
    ['Sold Count', num(facts.soldCount)],
    ['Median DOM', num(facts.medianDom)],
    ['Median Price Per SqFt', num(facts.medianPricePerSqft)],
    ['Active Listings', num(facts.activeCount)],
    ['12 Month Sales', num(facts.sales12mo)],
    ['Months of Supply', num(facts.monthsOfSupply)],
    ['Narrative', narrative ?? 'Narrative not available yet.'],
    ['Source', 'market_stats_cache + market_pulse_live (Oregon Data Share via Ryan Realty)'],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Summary')

  const trendSheetRows = [
    ['Month', 'Sold Count', 'Median Sale Price'],
    ...facts.trend.map((row) => [row.month, num(row.soldCount), num(row.medianSalePrice)]),
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(trendSheetRows), 'Trend')

  const bytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  return {
    fileName: `${buildFilename(city, subdivision, facts)}.xlsx`,
    bytes: new Uint8Array(bytes),
  }
}

export async function GET(request: Request) {
  const rl = await checkRateLimit(request, 'strict')
  if (rl.limited) return rl.response

  const { searchParams } = new URL(request.url)

  // §0 GEO ALLOWLIST. `city` used to be unvalidated and flowed straight into a
  // market_stats_cache lookup, so ANY slug in that table could be exported under
  // the Ryan Realty source line — including the ~175 non-canonical city slugs the
  // retired `backfill_rolling` wrote with NO PropertyType/property_sub_type filter.
  // `?city=Central Point` returned a branded workbook reading 367 sales against an
  // SFR truth of 272 (+35%), labeled SFR-only. This route is public and
  // unauthenticated (rate-limited only), so the bound has to be the report
  // registry, not "whatever happens to be in the cache".
  const requestedCity = searchParams.get('city')?.trim()
  const city = requestedCity
    ? MARKET_REPORT_DEFAULT_CITIES.find((c) => c.toLowerCase() === requestedCity.toLowerCase())
    : 'Bend'
  if (!city) {
    return NextResponse.json(
      {
        error: `Unsupported city. This report covers: ${MARKET_REPORT_DEFAULT_CITIES.join(', ')}.`,
      },
      { status: 400 },
    )
  }
  const subdivision = searchParams.get('subdivision')?.trim() || null
  const formatParam = searchParams.get('format')?.toLowerCase()
  const format: ExportFormat = formatParam === 'xlsx' ? 'xlsx' : 'pdf'
  const period = parseRangePeriod(searchParams.get('range'))

  try {
    const built = format === 'xlsx' ? await buildXlsx(city, subdivision, period) : await buildPdf(city, subdivision, period)
    const contentType =
      format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/pdf'

    return new NextResponse(Buffer.from(built.bytes), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${built.fileName}"`,
        'Cache-Control': 'private, no-store, max-age=0',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Export failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
