/**
 * /reports (canonical /housing-market/reports) — Central Oregon market reports
 * hub: live per-city data + pre-built sales reports + weekly reports.
 *
 * KB (kinetic-brutalist) design — Phase 9 page-class migration. Restyled IN
 * PLACE. Every piece of content is preserved:
 *   - export const metadata (canonical + OG + Twitter, /housing-market/reports)
 *   - the page-view tracking trio (getSession + getPersonIdFromCookie +
 *     trackPageViewIfPossible) — unchanged
 *   - ReportsDataSection: getMarketReportData + getReportCities, the verified
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
import { trackPageViewIfPossible } from '@/lib/followupboss'
import { listMarketReports } from '@/lib/data'
import { getSalesReportCardsData } from '../actions/market-reports'
import { getEngagementCountsBatchCached } from '@/app/actions/engagement'
import { getReportCities } from '@/app/actions/reports'
import { getMarketReportData } from '@/app/actions/market-report'
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
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import type { SchemaInput } from '@/lib/site/json-ld'
import '@/components/site/kb/kb.css'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const defaultOgImage = `${siteUrl}/api/og?type=default`

export const metadata: Metadata = {
  title: 'Central Oregon Real Estate Market Reports | Ryan Realty',
  description: 'Real-time Housing Market Report by city: sold volume, median price, days on market, inventory. Choose cities and time range. Weekly reports and explore tools.',
  alternates: { canonical: `${siteUrl}/housing-market/reports` },
  openGraph: {
    title: 'Central Oregon Real Estate Market Reports | Ryan Realty',
    description: 'Real-time Housing Market Report by city. Weekly reports and explore tools.',
    url: `${siteUrl}/housing-market/reports`,
    type: 'website',
    siteName: 'Ryan Realty',
    images: [{ url: defaultOgImage, width: 1200, height: 630, alt: 'Ryan Realty market reports' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Market Reports | Ryan Realty',
    description: 'Real-time Housing Market Report by city. Weekly reports and explore.',
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
  const rangeParam = params?.range
  const rangeStr = typeof rangeParam === 'string' ? rangeParam : Array.isArray(rangeParam) ? rangeParam[0] : undefined
  const rangeDays = Math.min(30, Math.max(7, parseInt(rangeStr ?? '7', 10) || 7))
  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - rangeDays)
  const periodStart = start.toISOString().slice(0, 10)
  const periodEnd = end.toISOString().slice(0, 10)
  return { cities, rangeDays, periodStart, periodEnd }
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

/** Heavy data section — streamed via Suspense so the hero renders instantly.
 * Also emits Dataset JSON-LD using the verified per-city figures it fetches.
 * variableMeasured is populated only from the actual fetched metrics objects,
 * never from hardcoded or approximated values (compliance rule).
 */
async function ReportsDataSection({
  selectedCities,
  rangeDays,
  periodStart,
  periodEnd,
}: {
  selectedCities: string[]
  rangeDays: number
  periodStart: string
  periodEnd: string
}) {
  const [reportData, allCitiesRes] = await Promise.all([
    getMarketReportData({ periodStart, periodEnd, cities: selectedCities }),
    getReportCities(),
  ])
  const allCities = allCitiesRes.cities ?? []

  // Build Dataset variableMeasured from the verified fetched data only.
  // We aggregate across cities — each stat gets a label that names the city
  // so the JSON-LD is unambiguous. Only include values that are present and
  // finite in the fetched metrics (never fabricate or approximate).
  const datasetVariables: Array<{ name: string; value: string | number; unitText?: string }> = []
  for (const row of reportData.metricsByCity) {
    const m = row.metrics
    if (m.sold_count > 0) {
      datasetVariables.push({ name: `${row.city} closed sales`, value: m.sold_count })
    }
    if (m.median_price != null && Number.isFinite(m.median_price) && m.median_price > 0) {
      datasetVariables.push({ name: `${row.city} median sale price`, value: Math.round(m.median_price), unitText: 'USD' })
    }
    if (m.median_dom != null && Number.isFinite(m.median_dom) && m.median_dom >= 0) {
      datasetVariables.push({ name: `${row.city} median days on market`, value: m.median_dom, unitText: 'days' })
    }
    if (m.current_listings > 0) {
      datasetVariables.push({ name: `${row.city} active listings`, value: m.current_listings })
    }
  }

  const datasetSchema: SchemaInput | null = datasetVariables.length > 0
    ? {
        type: 'dataset',
        name: `Central Oregon real estate market report, ${periodStart} to ${periodEnd}`,
        description:
          `Residential home sales and inventory data for Central Oregon cities. ` +
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
        rangeDays={rangeDays}
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
  const { cities: selectedCities, rangeDays, periodStart, periodEnd } = parseReportsParams(params ?? null)

  // Light queries — don't block the page
  const [session, fubPersonId] = await Promise.all([
    getSession(),
    getPersonIdFromCookie(),
  ])
  const pageUrl = `${siteUrl}/housing-market/reports`
  const pageTitle = 'Market Reports | Ryan Realty'
  trackPageViewIfPossible({ sessionUser: session?.user ?? undefined, fubPersonId, pageUrl, pageTitle })

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
          titleTop="Market"
          titleBottom="reports"
          lead="Real-time market data by city. Add or remove cities and change the time range. Default: last 7 days."
          videoSrc={null}
          posterSrc="/images/hero/hero-old-mill-master-4k.jpg"
        />

        {/* CTA row preserved from the prior hero. */}
        <section className="section" id="reports-cta" aria-label="Explore and search">
          <div className="wrap">
            <div className="flex flex-wrap items-center gap-3 py-2">
              <Link href="/housing-market/explore" className="btn alt">
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
              <h2 className="sec-title display">Housing<br />market report</h2>
            </div>
            <div className="pt-7">
              <Suspense fallback={<ReportsSkeleton />}>
                <ReportsDataSection
                  selectedCities={selectedCities}
                  rangeDays={rangeDays}
                  periodStart={periodStart}
                  periodEnd={periodEnd}
                />
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

        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}
