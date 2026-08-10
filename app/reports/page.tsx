/**
 * /reports (canonical /housing-market/reports) — Central Oregon market reports
 * hub: live per-city data + pre-built sales reports + weekly reports.
 *
 * KB (kinetic-brutalist) design — Phase 9 page-class migration. Restyled IN
 * PLACE. Every piece of content is preserved:
 *   - export const metadata (canonical + OG + Twitter, /housing-market/reports)
 *   - the page-view tracking trio (getSession + getPersonIdFromCookie +
 *     trackPageViewIfPossible) — unchanged
 *   - ReportsDataSection: getCityRangeReport + getReportCities, the verified
 *     Dataset JSON-LD built ONLY from fetched metrics (CLAUDE.md §0 compliance),
 *     and <ReportsByCityView> with all props — Suspense-streamed
 *   - SalesReportsSection: listMarketReports + getSalesReportCardsData +
 *     getEngagementCountsBatchCached + <ReportsIndexContent> — Suspense-streamed
 *   - ReportsSkeleton loading state (restyled to KB skeleton tokens)
 *   - the "Live data" badge + "Housing Market Report" heading
 *   - the hero copy + both CTAs (Explore market data · Search Homes)
 *   - parseReportsParams (cities/range searchParam parsing) — unchanged
 *
 * Only the presentation changed: KB shell (KbNav, KbBreadcrumb, KbFooter,
 * SmoothScrollProvider, KbSectionTracker pageType='market-reports'), KbHero,
 * Amboqia display headings, hard-edge cream surfaces. The interactive client
 * views (ReportsByCityView, ReportsIndexContent) keep their logic intact.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { getSession } from '@/app/actions/auth'
import { getPersonIdFromCookie } from '@/app/actions/identity-bridge'
import { listMarketReports } from '@/lib/data'
import { getSalesReportCardsData } from '../actions/market-reports'
import { getEngagementCountsBatchCached } from '@/app/actions/engagement'
import { getReportCities } from '@/app/actions/reports'
import { getCityRangeReport, parseRangePeriod, type RangePeriod } from '@/lib/data/market/getCityRangeReport'
import { getMarketPulse } from '@/lib/data'
import { getCityReportSnapshots, hasReportSignal } from '@/lib/data/market/getCityReportSnapshot'
import { formatDate } from '@/lib/format/date'
import { marketVerdict } from '@/lib/market/classify'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { MARKET_REPORT_DEFAULT_CITIES } from '@/app/actions/market-report-types'
import { PRIMARY_CITIES } from '@/lib/cities'
import ReportsByCityView from '@/components/reports/ReportsByCityView'
import ReportsIndexContent from './ReportsIndexContent'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSell } from '@/components/site/kb/KbSell.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import type { SchemaInput } from '@/lib/site/json-ld'
import '@/components/site/kb/kb.css'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const defaultOgImage = `${siteUrl}/api/og?type=default`

export const metadata: Metadata = {
  title: 'Central Oregon market reports',
  description:
    'Sold volume, median price, days on market, and inventory by Central Oregon city. Pick cities and a time range. Weekly reports included.',
  alternates: { canonical: `${siteUrl}/housing-market/reports` },
  openGraph: {
    title: 'Central Oregon market reports',
    description:
      'Sold volume, median price, days on market, and inventory by city. Weekly reports included.',
    url: `${siteUrl}/housing-market/reports`,
    type: 'website',
    siteName: 'Ryan Realty',
    images: [{ url: defaultOgImage, width: 1200, height: 630, alt: 'Ryan Realty market reports' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Central Oregon market reports',
    description:
      'Sold volume, median price, days on market, and inventory by city. Weekly reports included.',
    images: [defaultOgImage],
  },
}

type PageProps = { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }

function parseReportsParams(params: { [key: string]: string | string[] | undefined } | null) {
  const citiesParam = params?.cities
  const cities =
    typeof citiesParam === 'string' && citiesParam.trim()
      ? citiesParam.split(',').map((c) => c.trim()).filter(Boolean)
      : [...MARKET_REPORT_DEFAULT_CITIES]
  // W8.1: ?range= is a market_stats_cache period_type, not a day count. The old
  // 7/14/30-day windows were computed live over raw listings; the cache holds no
  // rolling_7d/rolling_14d row, and a 7-day median across these cities ran on
  // n = 0-5 (one Sunriver sale produced a published "median"). parseRangePeriod
  // narrows any untrusted value to a period the cache actually populates.
  return { cities, period: parseRangePeriod(params?.range) }
}

/** KB skeleton — same shape as the prior shadcn skeleton (heading + subhead +
 * 6 rows), restyled onto KB surface tokens with inline styles (no new CSS in
 * kb.css). Announced to assistive tech. */
const skelBlock = (h: number, w: number | string): React.CSSProperties => ({
  height: h,
  width: w,
  background: 'var(--navy-12)',
  border: '1px solid var(--navy-12)',
})
function ReportsSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-live="polite" aria-label="Loading market data">
      <div style={skelBlock(32, 256)} />
      <div style={skelBlock(24, 192)} />
      <div className="mt-4 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={skelBlock(48, '100%')} />
        ))}
      </div>
    </div>
  )
}

/* ---- Per-city headline cards (§0 canonical cache path) ------------------- */

const fmtMoneyFull = (n: number | null): string =>
  n != null ? `$${(Math.round(n / 1000) * 1000).toLocaleString('en-US')}` : '—'
const fmtCount = (n: number | null): string => (n != null ? n.toLocaleString('en-US') : '—')
const fmtDays = (n: number | null): string => (n != null ? `${Math.round(n)} days` : '—')
const fmtYoy = (n: number | null): string => {
  if (n == null) return '—'
  const arrow = n > 0 ? '↑ ' : n < 0 ? '↓ ' : ''
  return `${arrow}${Math.abs(n).toFixed(1)}% YoY`
}
const fmtDate = (iso: string | null): string | null => {
  if (!iso) return null
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : iso)
  if (Number.isNaN(d.getTime())) return null
  return formatDate(d, { timeZone: 'UTC' })
}
const fmtAsOf = (iso: string | null): string | null => {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Los_Angeles',
  })
}

const cardRow = (label: string, value: string, sub?: string | null) => (
  <div
    className="flex items-baseline justify-between gap-3 py-1.5"
    style={{ borderBottom: '1px solid var(--navy-12)' }}
  >
    <span className="text-sm" style={{ color: 'var(--navy-70)' }}>
      {label}
    </span>
    <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--navy)' }}>
      {value}
      {sub ? (
        <span className="ml-1.5 text-xs font-normal" style={{ color: 'var(--navy-70)' }}>
          {sub}
        </span>
      ) : null}
    </span>
  </div>
)

/**
 * City headline cards. Every figure comes from the SAME cache DAL the KB city
 * pages read (getMarketPulse + getCityMarketDetail via getCityReportSnapshots),
 * so a hub card and /cities/<slug> can never show different numbers for the
 * same stat (§0 one-number rule; 2026-07-22 four-paths consolidation, step 1).
 *
 * Each card renders two labeled windows and never mixes figures across them:
 *   - "Live single-family": market_pulse_live, labeled with its refresh time
 *   - "Trailing 12 months": market_stats_cache rolling_365d, labeled with the
 *     cache row's OWN period bounds
 * The months-of-supply verdict is computed from the number it sits next to
 * (lib/market/classify, the single threshold source).
 *
 * The range-filtered table below (ReportsDataSection) now reads the SAME cache,
 * via getCityRangeReport — W8.1 retired the get_city_period_metrics RPC from
 * this page. The card and the table therefore agree by construction rather than
 * by the market-stat-consistency cron catching drift after publication.
 */
async function CityHeadlineCardsSection({ selectedCities }: { selectedCities: string[] }) {
  // No-signal cities (zero active, zero sales, no median) are dropped rather
  // than rendered as a wall of dashes — the same rule the CRM report emails
  // apply (lib/data/crm/getMarketReportData.ts buildAreaBlock).
  const snapshots = (await getCityReportSnapshots(selectedCities)).filter(hasReportSignal)
  if (snapshots.length === 0) return null
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {snapshots.map((s) => {
          const mos = s.live?.monthsOfSupply ?? null
          const verdict = mos != null ? marketVerdict(mos) : null
          const asOf = fmtAsOf(s.live?.refreshedAt ?? null)
          const periodStart = fmtDate(s.trailing12mo?.periodStart ?? null)
          const periodEnd = fmtDate(s.trailing12mo?.periodEnd ?? null)
          return (
            <div
              key={s.urlSlug}
              className="p-5"
              style={{ border: '1px solid var(--navy-12)', background: 'transparent' }}
            >
              <div className="flex items-baseline justify-between gap-3">
                <Link
                  href={`/cities/${s.urlSlug}`}
                  className="text-lg font-semibold underline-offset-4 hover:underline"
                  style={{ color: 'var(--navy)' }}
                >
                  {s.cityLabel}
                </Link>
                {verdict && verdict.kind !== 'unknown' ? (
                  <span className="text-xs" style={{ color: 'var(--navy-70)' }}>
                    {verdict.label}
                  </span>
                ) : null}
              </div>

              {s.live ? (
                <div className="mt-4">
                  <p
                    className="text-xs uppercase tracking-wide"
                    style={{ color: 'var(--navy-70)' }}
                  >
                    Live single-family{asOf ? ` · as of ${asOf}` : ''}
                  </p>
                  <div className="mt-1">
                    {cardRow('Active listings', fmtCount(s.live.activeCount))}
                    {cardRow('Median list price', fmtMoneyFull(s.live.medianListPrice))}
                    {cardRow(
                      'Months of supply',
                      mos != null ? formatMonthsOfSupply(mos) : '—',
                      verdict && verdict.kind !== 'unknown' ? verdict.label : null,
                    )}
                    {cardRow('Closed, last 30 days', fmtCount(s.live.closedLast30Days))}
                    {cardRow('Median days to pending', fmtDays(s.live.medianDaysToPending))}
                  </div>
                </div>
              ) : null}

              {s.trailing12mo ? (
                <div className="mt-4">
                  <p
                    className="text-xs uppercase tracking-wide"
                    style={{ color: 'var(--navy-70)' }}
                  >
                    Trailing 12 months
                    {periodStart && periodEnd ? ` · ${periodStart} to ${periodEnd}` : ''}
                  </p>
                  <div className="mt-1">
                    {cardRow('Median sale price', fmtMoneyFull(s.trailing12mo.medianSalePrice))}
                    {cardRow('Homes sold', fmtCount(s.trailing12mo.soldCount))}
                    {cardRow('Median days on market', fmtDays(s.trailing12mo.medianDom))}
                    {cardRow('Median price change', fmtYoy(s.trailing12mo.yoyMedianPriceDeltaPct))}
                  </div>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-xs" style={{ color: 'var(--navy-70)' }}>
        Single-family data from Oregon Data Share. The same figures each city page shows.
      </p>
    </div>
  )
}

/** Heavy data section — streamed via Suspense so the hero renders instantly.
 * Also emits Dataset JSON-LD using the verified per-city figures it fetches.
 * variableMeasured is populated only from the actual fetched metrics objects,
 * never from hardcoded or approximated values (compliance rule).
 */
async function ReportsDataSection({
  selectedCities,
  period,
}: {
  selectedCities: string[]
  period: RangePeriod
}) {
  const [reportData, allCitiesRes] = await Promise.all([
    getCityRangeReport(selectedCities, period),
    getReportCities(),
  ])
  const allCities = allCitiesRes.cities ?? []

  // Build Dataset variableMeasured from the verified fetched data only.
  // We aggregate across cities — each stat gets a label that names the city
  // so the JSON-LD is unambiguous. Only include values that are present and
  // finite in the fetched rows (never fabricate or approximate). Every figure
  // is a market_stats_cache / market_pulse_live column, the same rows the
  // headline cards above render.
  const datasetVariables: Array<{ name: string; value: string | number; unitText?: string }> = []
  for (const r of reportData.rows) {
    if ((r.soldCount ?? 0) > 0) {
      datasetVariables.push({ name: `${r.city} closed sales`, value: r.soldCount as number })
    }
    if (r.medianSalePrice != null && r.medianSalePrice > 0) {
      datasetVariables.push({ name: `${r.city} median sale price`, value: Math.round(r.medianSalePrice), unitText: 'USD' })
    }
    if (r.medianDom != null && r.medianDom >= 0) {
      datasetVariables.push({ name: `${r.city} median days on market`, value: r.medianDom, unitText: 'days' })
    }
    if ((r.activeCount ?? 0) > 0) {
      datasetVariables.push({ name: `${r.city} active listings`, value: r.activeCount as number })
    }
  }

  // temporalCoverage must describe the window the numbers actually cover — the
  // cache rows' own bounds, never a window recomputed from today's date.
  const { periodStart, periodEnd } = reportData
  const datasetSchema: SchemaInput | null =
    datasetVariables.length > 0 && periodStart && periodEnd
      ? {
          type: 'dataset',
          name: `Central Oregon real estate market report, ${periodStart} to ${periodEnd}`,
          description:
            `Single-family home sales and inventory data for Central Oregon cities. ` +
            `Includes closed sales, median sale price, median days on market, and active listings. ` +
            `Sourced from Oregon Data Share via Ryan Realty.`,
          url: `${siteUrl}/housing-market/reports`,
          temporalCoverage: `${periodStart}/${periodEnd}`,
          spatialCoverageName: 'Central Oregon, OR',
          variableMeasured: datasetVariables,
        }
      : null

  return (
    <>
      {datasetSchema && <MetadataBlock schema={datasetSchema} />}
      <ReportsByCityView
        data={reportData}
        selectedCities={selectedCities}
        allCities={allCities}
      />
    </>
  )
}

/** Sales reports section — also streamed separately. */
async function SalesReportsSection() {
  const [reports, salesCardsRaw] = await Promise.all([
    listMarketReports(30),
    getSalesReportCardsData(PRIMARY_CITIES),
  ])
  const allListingKeys = salesCardsRaw.flatMap((c) => c.listingKeys).slice(0, 200)
  const engagementMap = allListingKeys.length > 0 ? await getEngagementCountsBatchCached(allListingKeys) : {}
  const salesCards = salesCardsRaw.map((card) => ({
    ...card,
    likeCount: card.listingKeys.reduce((s, k) => s + (engagementMap[k]?.like_count ?? 0), 0),
    saveCount: card.listingKeys.reduce((s, k) => s + (engagementMap[k]?.save_count ?? 0), 0),
    shareCount: card.listingKeys.reduce((s, k) => s + (engagementMap[k]?.share_count ?? 0), 0),
  }))

  return <ReportsIndexContent reports={reports} salesCards={salesCards} />
}

export default async function ReportsIndexPage({ searchParams }: PageProps) {
  const params = await searchParams
  const { cities: selectedCities, period } = parseReportsParams(params ?? null)

  // Session + identity-bridge reads kept (they pin this route's dynamic
  // rendering mode); the FUB page-view mirror they fed was deleted with the
  // FUB decommission — first-party visitor_sessions covers page views now.
  await Promise.all([
    getSession(),
    getPersonIdFromCookie(),
  ])

  return (
    <main className="kb-root">
      <KbNav />
      <KbSectionTracker pageType="market-reports" />
      <MetadataBlock
        schemas={[
          {
            type: 'breadcrumb',
            items: [
              { name: 'Home', url: '/' },
              { name: 'Market reports', url: '/housing-market/reports' },
            ],
          },
          {
            type: 'webPage',
            name: 'Central Oregon real estate market reports',
            description:
              'Real-time Housing Market Report by city: sold volume, median price, days on market, inventory. Choose cities and time range.',
            url: '/housing-market/reports',
          },
        ]}
      />
      <KbBreadcrumb overlay
        trail={[
          { label: 'Home', href: '/' },
          { label: 'Market reports' },
        ]}
      />
      <SmoothScrollProvider>
        {/* Hero — same H1 + subtitle as the prior ContentPageHero. The two CTAs
            (Explore market data / Search Homes) are preserved in the CTA row
            below so both destinations stay one tap away. */}
        <KbHero
          data={{ activeCount: null, medianListPrice: null, medianDaysToPending: null }}
          eyebrow="Central Oregon · Live market data"
          titleTop="What sold,"
          titleBottom="and what is still listed."
          lead="Inventory, median price, and days on market by city. Pick the cities and the range. Last 30 days is the default."
          videoSrc={null}
          posterSrc="/images/lp/hero-mountain.jpg"
        />

        {/* CTA row preserved from the prior hero. */}
        <section className="section" id="reports-cta" aria-label="Explore and search">
          <div className="wrap">
            <div className="flex flex-wrap items-center gap-3 py-2">
              <Link href="/housing-market" className="btn alt">
                Explore market data <span className="arr">→</span>
              </Link>
              <Link
                href="/homes-for-sale"
                className="btn alt"
                style={{ background: 'transparent', color: 'var(--navy)' }}
              >
                Search homes <span className="arr">→</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Live per-city Housing Market Report — Suspense-streamed. The
            "Live data" badge + heading are preserved; ReportsByCityView keeps
            its full interactive logic (city chips, range selector, table). */}
        <section
          id="housing-market-report"
          className="section"
          aria-label="Housing market report"
        >
          <div className="wrap pb-12">
            <div className="sec-head">
              <span className="sec-index">Live data</span>
              <h2 className="sec-title display">By city,<br />and by range</h2>
            </div>
            {/* Headline figures per city: the §0 canonical cache path
                (market_pulse_live + market_stats_cache via getCityReportSnapshots),
                identical to the KB city pages. Streamed separately so a pulse
                hiccup never blocks the range table below. */}
            <div className="pt-7">
              <Suspense fallback={<ReportsSkeleton />}>
                <CityHeadlineCardsSection selectedCities={selectedCities} />
              </Suspense>
            </div>
            {/* Range-filtered detail (30d / 90d / YTD / 12mo). W8.1 moved this
                table off the get_city_period_metrics RPC onto the SAME cache the
                cards above read, so the two can no longer disagree about a city
                (they did: Bend read 507 active · MoS 3.9 "seller's" in the card
                and 984 active · MoS 5.3 "balanced" in the table, §0). */}
            <div className="pt-10">
              <Suspense fallback={<ReportsSkeleton />}>
                <ReportsDataSection selectedCities={selectedCities} period={period} />
              </Suspense>
            </div>
          </div>
        </section>

        {/* Sales reports + weekly reports — Suspense-streamed. ReportsIndexContent
            keeps its full logic (sales-report tiles slider, weekly report list,
            empty state). */}
        <section className="section" id="sales-and-weekly-reports" aria-label="Sales and weekly reports">
          <div className="wrap pb-16">
            <Suspense fallback={<ReportsSkeleton />}>
              <SalesReportsSection />
            </Suspense>
          </div>
        </section>

        {/* Seller conversion CTA — the highest-intent readers on the site
            (actively studying market data) previously hit a bare footer with
            zero on-page capture. Region pulse figures per §0; streamed so a
            pulse hiccup never blocks the page. */}
        <Suspense fallback={null}>
          <ReportsSellSection />
        </Suspense>

        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}

/** Region-pulse-fed KbSell (same §0-verified figures the hub's CTA uses). */
async function ReportsSellSection() {
  const regionPulse = await getMarketPulse({ geoType: 'region', geoSlug: 'central-oregon' }).catch(() => null)
  return (
    <KbSell
      data={{
        medianListPrice: regionPulse?.medianListPrice ?? null,
        medianDaysToPending: regionPulse?.medianDaysToPending ?? null,
        soldCount30d: regionPulse?.closedLast30Days ?? null,
      }}
      eyebrow="Sell in Central Oregon"
    />
  )
}
