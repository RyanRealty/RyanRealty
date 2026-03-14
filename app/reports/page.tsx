import type { Metadata } from 'next'
import { getSession } from '@/app/actions/auth'
import { getFubPersonIdFromCookie } from '@/app/actions/fub-identity-bridge'
import { trackPageViewIfPossible } from '@/lib/followupboss'
import { listMarketReports, getSalesReportCardsData } from '../actions/market-reports'
import { getEngagementCountsBatch } from '@/app/actions/engagement'
import { PRIMARY_CITIES } from '@/lib/cities'
import ReportsIndexContent from './ReportsIndexContent'
import ContentPageHero from '@/components/layout/ContentPageHero'
import { CONTENT_HERO_IMAGES } from '@/lib/content-page-hero-images'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const metadata: Metadata = {
  title: 'Central Oregon Real Estate Market Reports | Ryan Realty',
  description: 'Weekly Central Oregon real estate market reports: pending and closed sales by city. Explore by area, median price, inventory, DOM.',
  alternates: { canonical: `${siteUrl}/reports` },
  openGraph: {
    title: 'Central Oregon Real Estate Market Reports | Ryan Realty',
    description: 'Weekly Central Oregon real estate market reports: pending and closed sales by city.',
    url: `${siteUrl}/reports`,
    type: 'website',
    siteName: 'Ryan Realty',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Market Reports | Ryan Realty',
    description: 'Weekly Central Oregon real estate market reports: pending and closed sales by city.',
  },
}

export default async function ReportsIndexPage() {
  const [reports, salesCardsRaw, session, fubPersonId] = await Promise.all([
    listMarketReports(30),
    getSalesReportCardsData(PRIMARY_CITIES),
    getSession(),
    getFubPersonIdFromCookie(),
  ])
  const allListingKeys = salesCardsRaw.flatMap((c) => c.listingKeys)
  const engagementMap = allListingKeys.length > 0 ? await getEngagementCountsBatch(allListingKeys) : {}
  const salesCards = salesCardsRaw.map((card) => ({
    ...card,
    likeCount: card.listingKeys.reduce((s, k) => s + (engagementMap[k]?.like_count ?? 0), 0),
    saveCount: card.listingKeys.reduce((s, k) => s + (engagementMap[k]?.save_count ?? 0), 0),
    shareCount: card.listingKeys.reduce((s, k) => s + (engagementMap[k]?.share_count ?? 0), 0),
  }))
  const pageUrl = `${siteUrl}/reports`
  const pageTitle = 'Market Reports | Ryan Realty'
  trackPageViewIfPossible({ sessionUser: session?.user ?? undefined, fubPersonId, pageUrl, pageTitle })

  return (
    <main className="min-h-screen bg-background">
      <ContentPageHero
        title="Market Reports"
        subtitle="Weekly Central Oregon real estate insights: pending and closed sales by city, median price, inventory, and days on market. Data you can trust."
        imageUrl={CONTENT_HERO_IMAGES.reports}
        ctas={[
          { label: 'Explore Reports', href: '#reports', primary: true },
          { label: 'Search Homes', href: '/homes-for-sale', primary: false },
        ]}
      />
      <section id="reports" className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <ReportsIndexContent reports={reports} salesCards={salesCards} />
      </section>
    </main>
  )
}
