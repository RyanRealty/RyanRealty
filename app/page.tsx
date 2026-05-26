import type { Metadata } from 'next'
import path from 'path'
import fs from 'fs'
import { Suspense } from 'react'

import Hero from '@/components/site/Hero'
import MarketSnapshot from '@/components/site/MarketSnapshot'
import PriceRangeTiles from '@/components/site/PriceRangeTiles'
import OpenHousesGrid from '@/components/site/OpenHousesGrid'
import CityGrid from '@/components/site/CityGrid'
import TeamSection from '@/components/site/TeamSection'
import ActivityFeed from '@/components/site/ActivityFeed'
import CtaDuo from '@/components/site/CtaDuo'
import { getBrokerageSettings, type BrokerageSettingsRow } from './actions/brokerage'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/og-home.png`

/**
 * ISR cache the homepage shell at the edge for 60s. Each Suspense'd section
 * fetches its own data; cold renders stream sections as they resolve.
 */
export const revalidate = 60

export const metadata: Metadata = {
  title: 'Ryan Realty — Central Oregon Real Estate | Bend, Redmond, Sisters, Sunriver',
  description:
    'Find your next home in Central Oregon. Search homes in Bend, Redmond, Sisters, Sunriver and surrounding communities. Honest guidance from your local team.',
  alternates: { canonical: siteUrl },
  openGraph: {
    title: 'Ryan Realty — Central Oregon Real Estate',
    description:
      'Search homes in Bend, Redmond, Sisters, Sunriver and surrounding communities. Honest guidance from your local team.',
    url: siteUrl,
    siteName: 'Ryan Realty',
    type: 'website',
    images: [{ url: ogImage, width: 1200, height: 630, alt: 'Ryan Realty — Central Oregon Real Estate' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ryan Realty — Central Oregon Real Estate | Bend, Redmond, Sisters, Sunriver',
    description: 'Honest guidance from your local team for Central Oregon real estate.',
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

function SectionSkeleton({ minH = 'min-h-[320px]' }: { minH?: string }) {
  return <div className={`${minH} px-6 py-14 border-t border-border`} aria-hidden />
}

export default async function Home() {
  const brokerage = await getBrokerageSettings().catch(() => null)
  const teamImageSrc = getTeamImageSrc(brokerage)

  return (
    <main className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'RealEstateAgent',
                name: 'Ryan Realty',
                url: siteUrl,
                areaServed: [
                  { '@type': 'City', name: 'Bend', addressRegion: 'OR' },
                  { '@type': 'City', name: 'Redmond', addressRegion: 'OR' },
                  { '@type': 'City', name: 'Sisters', addressRegion: 'OR' },
                  { '@type': 'City', name: 'Sunriver', addressRegion: 'OR' },
                ],
              },
              {
                '@type': 'WebSite',
                name: 'Ryan Realty',
                url: siteUrl,
                potentialAction: {
                  '@type': 'SearchAction',
                  target: {
                    '@type': 'EntryPoint',
                    urlTemplate: `${siteUrl}/homes-for-sale?keywords={search_term_string}`,
                  },
                  'query-input': 'required name=search_term_string',
                },
              },
            ],
          }),
        }}
      />

      <Hero />

      <Suspense fallback={<SectionSkeleton />}>
        <MarketSnapshot />
      </Suspense>

      <PriceRangeTiles />

      <Suspense fallback={<SectionSkeleton />}>
        <OpenHousesGrid />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <CityGrid />
      </Suspense>

      <TeamSection teamImageSrc={teamImageSrc} />

      <Suspense fallback={<SectionSkeleton />}>
        <ActivityFeed />
      </Suspense>

      <CtaDuo />
    </main>
  )
}
