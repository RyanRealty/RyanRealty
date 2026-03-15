import type { Metadata } from 'next'
import { getSession } from '@/app/actions/auth'
import { getFubPersonIdFromCookie } from '@/app/actions/fub-identity-bridge'
import { trackPageViewIfPossible } from '@/lib/followupboss'
import { listMarketReports, getSalesReportCardsData } from '../actions/market-reports'
import { getEngagementCountsBatch } from '@/app/actions/engagement'
import { getReportCities } from '@/app/actions/reports'
import { getBeaconReportData, BEACON_REPORT_DEFAULT_CITIES } from '@/app/actions/beacon-report'
import { PRIMARY_CITIES } from '@/lib/cities'
import ContentPageHero from '@/components/layout/ContentPageHero'
import { CONTENT_HERO_IMAGES } from '@/lib/content-page-hero-images'
import BeaconReportView from '@/components/reports/BeaconReportView'
import ReportsIndexContent from './ReportsIndexContent'
import { Badge } from '@/components/ui/badge'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const metadata: Metadata = {
  title: 'Central Oregon Real Estate Market Reports | Ryan Realty',
  description: 'Real-time Beacon market reports by city: sold volume, median price, days on market, inventory. Choose cities and time range. Weekly reports and explore tools.',
  alternates: { canonical: `${siteUrl}/reports` },
  openGraph: {
    title: 'Central Oregon Real Estate Market Reports | Ryan Realty',
    description: 'Real-time Beacon market reports by city. Weekly reports and explore tools.',
    url: `${siteUrl}/reports`,
    type: 'website',
    siteName: 'Ryan Realty',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Market Reports | Ryan Realty',
    description: 'Real-time Beacon market reports by city. Weekly reports and explore.',
  },
}

type PageProps = { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }

function parseReportsParams(params: { [key: string]: string | string[] | undefined } | null) {
  const citiesParam = params?.cities
  const cities =
    typeof citiesParam === 'string' && citiesParam.trim()
      ? citiesParam.split(',').map((c) => c.trim()).filter(Boolean)
      : [...BEACON_REPORT_DEFAULT_CITIES]
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

export default async function ReportsIndexPage({ searchParams }: PageProps) {
  const params = await searchParams
  const { cities: selectedCities, rangeDays, periodStart, periodEnd } = parseReportsParams(params ?? null)

  const [reports, salesCardsRaw, session, fubPersonId, beaconData, allCitiesRes] = await Promise.all([
    listMarketReports(30),
    getSalesReportCardsData(PRIMARY_CITIES),
    getSession(),
    getFubPersonIdFromCookie(),
    getBeaconReportData({ periodStart, periodEnd, cities: selectedCities }),
    getReportCities(),
  ])
  const allListingKeys = salesCardsRaw.flatMap((c) => c.listingKeys)
  const engagementMap = allListingKeys.length > 0 ? await getEngagementCountsBatch(allListingKeys) : {}
  const salesCards = salesCardsRaw.map((card) => ({
    ...card,
    likeCount: card.listingKeys.reduce((s, k) => s + (engagementMap[k]?.like_count ?? 0), 0),
    saveCount: card.listingKeys.reduce((s, k) => s + (engagementMap[k]?.save_count ?? 0), 0),
    shareCount: card.listingKeys.reduce((s, k) => s + (engagementMap[k]?.share_count ?? 0), 0),
  }))
  const allCities = allCitiesRes.cities ?? []
  const pageUrl = `${siteUrl}/reports`
  const pageTitle = 'Market Reports | Ryan Realty'
  trackPageViewIfPossible({ sessionUser: session?.user ?? undefined, fubPersonId, pageUrl, pageTitle })

  return (
    <main className="min-h-screen bg-background">
      <ContentPageHero
        title="Market Reports"
        subtitle="Real-time Beacon data by city. Add or remove cities and change the time range. Default: last 7 days."
        imageUrl={CONTENT_HERO_IMAGES.reports}
        ctas={[
          { label: 'Explore market data', href: '/reports/explore', primary: false },
          { label: 'Search Homes', href: '/homes-for-sale', primary: false },
        ]}
      />

      <section id="beacon" className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="rounded-md border-primary/30 text-xs font-medium uppercase tracking-wider text-primary">
            Live data
          </Badge>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Beacon report
          </h2>
        </div>
        <BeaconReportView
          data={beaconData}
          selectedCities={selectedCities}
          allCities={allCities}
          rangeDays={rangeDays}
        />
      </section>

      <section className="mx-auto max-w-6xl border-t border-border px-4 py-10 sm:px-6 sm:py-12">
        <ReportsIndexContent reports={reports} salesCards={salesCards} />
      </section>
    </main>
  )
}
