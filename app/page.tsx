import type { Metadata } from 'next'
import path from 'path'
import fs from 'fs'
import { Suspense } from 'react'

import Hero from '@/components/site/Hero'
import MarketSnapshot from '@/components/site/MarketSnapshot'
import PriceRangeTiles from '@/components/site/PriceRangeTiles'
import OpenHousesGrid from '@/components/site/OpenHousesGrid'
import CityGrid from '@/components/site/CityGrid'
import ResortCommunities from '@/components/site/ResortCommunities'
import FeaturedListings from '@/components/site/FeaturedListings'
import TeamSection from '@/components/site/TeamSection'
import ActivityFeed from '@/components/site/ActivityFeed'
import CtaDuo from '@/components/site/CtaDuo'
import { getBrokerageSettings, type BrokerageSettingsRow } from './actions/brokerage'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
// /og-home.png never existed → broken homepage share image. Use the dynamic OG route.
const ogImage = `${siteUrl}/api/og?type=default`

/**
 * ISR cache the homepage shell at the edge for 60s. Each Suspense'd section
 * fetches its own data; cold renders stream sections as they resolve.
 */
export const revalidate = 60

export const metadata: Metadata = {
  title: 'Ryan Realty — Central Oregon Real Estate | Bend, Redmond, Sisters, Sunriver',
  description:
    'Find your next home in Central Oregon. Search homes in Bend, Redmond, Sisters, Sunriver and surrounding communities. Real numbers, direct from the brokers who close deals here.',
  alternates: { canonical: siteUrl },
  openGraph: {
    title: 'Ryan Realty — Central Oregon Real Estate',
    description:
      'Search homes in Bend, Redmond, Sisters, Sunriver and surrounding communities. Real numbers, direct from the brokers who close deals here.',
    url: siteUrl,
    siteName: 'Ryan Realty',
    type: 'website',
    images: [{ url: ogImage, width: 1200, height: 630, alt: 'Ryan Realty — Central Oregon Real Estate' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ryan Realty — Central Oregon Real Estate | Bend, Redmond, Sisters, Sunriver',
    description: 'Real numbers, direct from the brokers who close deals in Central Oregon.',
  },
}

function getTeamImageSrc(brokerage: BrokerageSettingsRow | null): string {
  const fromAdmin = brokerage?.team_image_url?.trim() || brokerage?.hero_image_url?.trim()
  if (fromAdmin) return fromAdmin
  try {
    const webp = path.join(process.cwd(), 'public', 'images', 'team.webp')
    const stat = fs.statSync(webp)
    return `/images/team.webp?v=${stat.mtimeMs}`
  } catch {
    return '/images/team.webp'
  }
}

function SectionSkeleton({ minH = 'min-h-80' }: { minH?: string }) {
  return <div className={`${minH} px-6 py-14 border-t border-border`} aria-hidden />
}

export default async function Home() {
  const brokerage = await getBrokerageSettings().catch(() => null)
  const teamImageSrc = getTeamImageSrc(brokerage)

  return (
    <main className="min-h-screen bg-background">
      {/* Site-wide Organization + WebSite JSON-LD is emitted once by the root
          layout (<JsonLd>), with the canonical @id, sameAs, brokers, and NAP.
          The homepage does NOT re-declare them — duplicate, thinner entities
          confuse schema parsers (the #1 cause of markup being discarded). */}

      <Hero />

      <Suspense fallback={<SectionSkeleton />}>
        <MarketSnapshot />
      </Suspense>

      {/* Featured listings — premium active Central Oregon inventory. Self-fetching
          (its own Suspense). Locked into the homepage by the mockup-parity gate. */}
      <FeaturedListings city="Bend" title="Featured Central Oregon homes" viewAllHref="/homes-for-sale" />

      <PriceRangeTiles />

      <Suspense fallback={<SectionSkeleton />}>
        <OpenHousesGrid />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <CityGrid />
      </Suspense>

      {/* Resort + master-planned communities — the mockup section now built live
          (components/site/ResortCommunities). Self-fetching; locked by parity. */}
      <Suspense fallback={<SectionSkeleton />}>
        <ResortCommunities />
      </Suspense>

      <TeamSection teamImageSrc={teamImageSrc} />

      <Suspense fallback={<SectionSkeleton />}>
        <ActivityFeed />
      </Suspense>

      <CtaDuo />
    </main>
  )
}
