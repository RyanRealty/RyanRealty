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
 *
 * §0 on the GEO. Both `?city=` and `?subdivision=` are bounded by a registry,
 * because this route is public, unauthenticated, and stamps the brokerage's name
 * on what it returns. `city` must be in MARKET_REPORT_DEFAULT_CITIES; a
 * community must be one the resort registry places IN THAT CITY
 * (lib/market/report-geo.ts). A registry hit reads the community's
 * geo_type='neighborhood' cache row — the SAME row /communities/<slug> renders —
 * so an exported document cannot contradict the page it came from.
 *
 * §0 on the WINDOWS. A market document mixes three of them: a chosen
 * closed-sale period, a trailing-12-month count, and a live inventory snapshot
 * that has no period at all. Each is emitted as its own labeled block (see
 * buildSections), in both formats, from one builder. Flattened together they
 * read as one measurement, which is how a Terrebonne export printed
 * "21 months of supply" inside a 6.8-month window.
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
import { reportCommunitiesInCity, resolveReportCommunity } from '@/lib/market/report-geo'
import { ReportPdfDocument, type ReportPdfData } from '@/lib/pdf/report-pdf'
import {
  num,
  buildDocumentFilename,
  buildSections,
  windowText,
  type ReportDocumentFacts,
} from '@/lib/market/report-document'

type ExportFormat = 'pdf' | 'xlsx'

/**
 * The geo a document covers, already city-qualified. A community resolves to
 * geo_type='neighborhood' — the alias-aware row the community page renders —
 * never geo_type='subdivision', which is literal-name equality and disagrees
 * with the page. See lib/market/report-geo.ts for the whole argument.
 */
type ExportGeo = {
  geoType: 'city' | 'neighborhood'
  /** Cache slug spellings to try, in order. */
  candidates: string[]
  /** Document title / filename label. */
  label: string
  /** Filename stem, already city-qualified. */
  fileStem: string
  /** The name market_narratives keys this geo by. */
  narrativeName: string
  /** Workbook Summary identity rows — the resolved geo, not the raw query. */
  identityRows: Array<[string, string]>
}

/**
 * Resolve one geo's cache rows.
 *
 * EVERY FIGURE IN A DOCUMENT COMES FROM ONE SLUG SPELLING — the same rule
 * getCityRangeRow documents. Mixing spellings field-by-field produced a workbook
 * whose Summary sheet (44 sales) contradicted its own Trend sheet (92) because
 * the two spellings measured different geographies. Candidates are tried in
 * order and the FIRST that answers supplies every figure.
 */
async function loadFacts(geo: ExportGeo, period: RangePeriod): Promise<ReportDocumentFacts> {
  const { geoType } = geo

  let detail: Awaited<ReturnType<typeof getCityMarketDetail>> = null
  let twelve: Awaited<ReturnType<typeof getCityMarketDetail>> = null
  let pulse: Awaited<ReturnType<typeof getMarketPulse>> = null
  let history: Awaited<ReturnType<typeof getPriceHistory>> = []

  for (const geoSlug of geo.candidates) {
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
  const day = (v: unknown): string | null => (v ? String(v).slice(0, 10) : null)

  return {
    period: {
      label: RANGE_PERIOD_LABELS[period],
      start: day(detail?.periodStart),
      end: day(detail?.periodEnd),
    },
    medianSalePrice: detail?.medianSalePrice ?? null,
    soldCount: detail?.soldCount ?? null,
    medianDom: detail?.medianDom ?? null,
    medianPricePerSqft: detail?.medianPricePerSqft ?? null,
    // The trailing-12 row's OWN bounds. Printing the chosen period's dates here
    // would label a 12-month count with a 30-day window.
    trailing12: {
      label: RANGE_PERIOD_LABELS.rolling_365d,
      start: day(t12?.periodStart),
      end: day(t12?.periodEnd),
    },
    sales12mo: t12?.soldCount ?? null,
    activeCount: pulse?.activeCount ?? null,
    monthsOfSupply: pulse?.monthsOfSupply ?? null,
    liveAsOf: pulse?.refreshedAt ? String(pulse.refreshedAt).slice(0, 10) : null,
    trend: history.map((p) => ({
      month: String(p.periodStart).slice(0, 7),
      soldCount: p.soldCount ?? null,
      medianSalePrice: p.medianSalePrice ?? null,
    })),
  }
}

function getSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createClient(url, key)
}

async function getNarrative(geo: ExportGeo): Promise<string | null> {
  const supabase = getSupabaseServiceClient()
  if (!supabase) return null

  // market_narratives predates the neighborhood routing and stores communities
  // under geo_type='subdivision' keyed by display name. It currently has zero
  // writers, so this is a null lookup either way; keeping the historical key
  // shape means a future writer's rows are found rather than silently missed.
  const geoType = geo.geoType === 'neighborhood' ? 'subdivision' : 'city'
  const geoName = geo.narrativeName
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

async function buildPdf(
  geo: ExportGeo,
  period: RangePeriod,
): Promise<{ fileName: string; bytes: Uint8Array }> {
  const [brokerage, facts, narrative] = await Promise.all([
    getBrokerageSettings(),
    loadFacts(geo, period),
    getNarrative(geo),
  ])

  const pdfData: ReportPdfData = {
    title: `${geo.label} Market Report`,
    geoName: geo.label,
    period: windowText(facts.period),
    sections: buildSections(facts, narrative),
    branding: {
      brokerageName: brokerage?.name ?? 'Ryan Realty',
      brokerageLogoUrl: brokerage?.logo_url ?? null,
    },
  }

  const doc = React.createElement(ReportPdfDocument, { data: pdfData })
  type DocElement = Parameters<typeof renderToBuffer>[0]
  const buffer = await renderToBuffer(doc as DocElement)
  return {
    fileName: `${buildDocumentFilename(geo.fileStem, facts.period)}.pdf`,
    bytes: new Uint8Array(buffer),
  }
}

async function buildXlsx(
  geo: ExportGeo,
  period: RangePeriod,
): Promise<{ fileName: string; bytes: Uint8Array }> {
  const [facts, narrative] = await Promise.all([loadFacts(geo, period), getNarrative(geo)])

  const wb = XLSX.utils.book_new()

  // Same three labeled blocks as the PDF, from the same builder, so the two
  // formats of ONE document cannot describe their figures differently. Each
  // block's heading is its own row above its figures. (§0)
  const summaryRows: Array<Array<string | number>> = [
    ...geo.identityRows.map(([k, v]) => [k, v] as Array<string | number>),
  ]
  for (const section of buildSections(facts, narrative)) {
    summaryRows.push([], [section.heading])
    for (const [k, v] of section.rows) summaryRows.push([k, v])
  }
  summaryRows.push(
    [],
    ['Source', 'market_stats_cache + market_pulse_live (Oregon Data Share via Ryan Realty)'],
  )
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Summary')

  // Header states the window these rows measure: monthly CLOSED sales, so a
  // reader cannot take the sheet for a listing history. (§0)
  const trendSheetRows = [
    ['Monthly closed sales'],
    ['Month', 'Sold Count', 'Median Sale Price'],
    ...facts.trend.map((row) => [row.month, num(row.soldCount), num(row.medianSalePrice)]),
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(trendSheetRows), 'Trend')

  const bytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  return {
    fileName: `${buildDocumentFilename(geo.fileStem, facts.period)}.xlsx`,
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
  // §0 THE CITY MUST ACTUALLY SCOPE THE DOCUMENT. `subdivision` was validated
  // by nothing and resolved to a BARE cache slug, so the city above bounded the
  // TITLE and nothing else: `?city=Madras&subdivision=Tetherow` returned a
  // branded workbook headed "Tetherow, Madras" carrying Bend's Tetherow numbers.
  // The registry is the only source that knows which city a community belongs
  // to, and a community it cannot place is refused rather than guessed at.
  const requestedCommunity = searchParams.get('subdivision')?.trim() || null
  const community = requestedCommunity ? resolveReportCommunity(city, requestedCommunity) : null
  if (requestedCommunity && !community) {
    const available = reportCommunitiesInCity(city).map((c) => c.label)
    return NextResponse.json(
      {
        error: available.length
          ? `${requestedCommunity} is not a registered community in ${city}. ${city} communities: ${available.join(', ')}.`
          : `${city} has no registered communities. Drop the subdivision parameter for a city-wide report.`,
      },
      { status: 400 },
    )
  }

  const geo: ExportGeo = community
    ? {
        // geo_type 'neighborhood' — the alias-aware row the community page
        // renders. The 'subdivision' row is literal-name equality and publishes
        // different numbers for the same community over the same window. (W8.1)
        geoType: 'neighborhood',
        candidates: [community.slug],
        label: `${community.label}, ${community.city}`,
        fileStem: `${community.city}-${community.label}`,
        narrativeName: community.label,
        identityRows: [
          ['City', community.city],
          ['Community', community.label],
        ],
      }
    : {
        geoType: 'city',
        candidates: citySlugCandidates(city),
        label: city,
        fileStem: city,
        narrativeName: city,
        identityRows: [
          ['City', city],
          ['Community', 'City-wide'],
        ],
      }

  const formatParam = searchParams.get('format')?.toLowerCase()
  const format: ExportFormat = formatParam === 'xlsx' ? 'xlsx' : 'pdf'
  const period = parseRangePeriod(searchParams.get('range'))

  try {
    const built = format === 'xlsx' ? await buildXlsx(geo, period) : await buildPdf(geo, period)
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
