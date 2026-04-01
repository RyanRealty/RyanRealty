import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getSession } from '@/app/actions/auth'
import { getFubPersonIdFromCookie } from '@/app/actions/fub-identity-bridge'
import { trackPageViewIfPossible } from '@/lib/followupboss'
import { listMarketReports, getSalesReportCardsData } from '../actions/market-reports'
import { getEngagementCountsBatch } from '@/app/actions/engagement'
import { getReportCities } from '@/app/actions/reports'
import { getMarketReportData } from '@/app/actions/market-report'
import { MARKET_REPORT_DEFAULT_CITIES } from '@/app/actions/market-report-types'
import { PRIMARY_CITIES } from '@/lib/cities'
import ContentPageHero from '@/components/layout/ContentPageHero'
import { CONTENT_HERO_IMAGES } from '@/lib/content-page-hero-images'
import ReportsByCityView from '@/components/reports/ReportsByCityView'
import ReportsIndexContent from './ReportsIndexContent'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const defaultOgImage = `${siteUrl}/api/og?type=default`

export const metadata: Metadata = {
  title: 'Central Oregon Real Estate Market Reports | Ryan Realty',
  description: 'Real-time Housing Market Report by city: sold volume, median price, days on market, inventory. Choose cities and time range. Weekly reports and explore tools.',
  alternates: { canonical: `${siteUrl}/reports` },
  openGraph: {
    title: 'Central Oregon Real Estate Market Reports | Ryan Realty',
    description: 'Real-time Housing Market Report by city. Weekly reports and explore tools.',
    url: `${siteUrl}/reports`,
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

function ReportsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-6 w-48" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  )
}

/** Heavy data section — streamed via Suspense so the hero renders instantly. */
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

  return (
    <ReportsByCityView
      data={reportData}
      selectedCities={selectedCities}
      allCities={allCities}
      rangeDays={rangeDays}
    />
  )
}

/** Sales reports section — also streamed separately. */
async function SalesReportsSection() {
  const [reports, salesCardsRaw] = await Promise.all([
    listMarketReports(30),
    getSalesReportCardsData(PRIMARY_CITIES),
  ])
  const allListingKeys = salesCardsRaw.flatMap((c) => c.listingKeys)
  const engagementMap = allListingKeys.length > 0 ? await getEngagementCountsBatch(allListingKeys) : {}
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
    getFubPersonIdFromCookie(),
  ])
  const pageUrl = `${siteUrl}/reports`
  const pageTitle = 'Market Reports | Ryan Realty'
  trackPageViewIfPossible({ sessionUser: session?.user ?? undefined, fubPersonId, pageUrl, pageTitle })

  return (
    <main className="min-h-screen bg-background">
      <ContentPageHero
        title="Market Reports"
        subtitle="Real-time market data by city. Add or remove cities and change the time range. Default: last 7 days."
        imageUrl={CONTENT_HERO_IMAGES.reports}
        ctas={[
          { label: 'Explore market data', href: '/reports/explore', primary: false },
          { label: 'Search Homes', href: '/homes-for-sale', primary: false },
        ]}
      />

      <section id="housing-market-report" className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="rounded-md border-primary/30 text-xs font-medium uppercase tracking-wider text-primary">
            Live data
          </Badge>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Housing Market Report
          </h2>
        </div>
        <Suspense fallback={<ReportsSkeleton />}>
          <ReportsDataSection
            selectedCities={selectedCities}
            rangeDays={rangeDays}
            periodStart={periodStart}
            periodEnd={periodEnd}
          />
        </Suspense>
      </section>

      <section className="mx-auto max-w-6xl border-t border-border px-4 py-10 sm:px-6 sm:py-12">
        <Suspense fallback={<ReportsSkeleton />}>
          <SalesReportsSection />
        </Suspense>
      </section>
    </main>
  )
}
