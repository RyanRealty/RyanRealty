import type { Metadata } from 'next'
import path from 'path'
import fs from 'fs'
import { getBrokerageSettings } from './actions/brokerage'
import { getMarketSnapshot } from './actions/home'
import { getSession } from './actions/auth'
import { TESTIMONIALS } from '@/lib/testimonials'
import HomeHero from '../components/home/HomeHero'
import SocialProofSection from '../components/home/SocialProofSection'
import ActivityFeedSection from '../components/activity/ActivityFeedSection'
import BeaconReportSection from '../components/beacon-report/BeaconReportSection'
import EmailSignup from '../components/home/EmailSignup'
import { getActivityFeedWithFallbackMulti, ACTIVITY_FEED_DEFAULT_CITIES } from './actions/activity-feed'
import { getBrowseCities } from './actions/listings'
import type { BrokerageSettingsRow } from './actions/brokerage'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/og-home.png`

/** Resolve team photo URL: admin URL if set, else static file with cache-buster so replacing the file shows immediately. */
function getTeamImageSrc(brokerage: BrokerageSettingsRow | null): string {
  const fromAdmin = brokerage?.team_image_url?.trim() || brokerage?.hero_image_url?.trim()
  if (fromAdmin) return fromAdmin
  try {
    const p = path.join(process.cwd(), 'public', 'images', 'team.png')
    const stat = fs.statSync(p)
    return `/images/team.png?v=${stat.mtimeMs}`
  } catch {
    return '/images/team.png'
  }
}

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Ryan Realty — Central Oregon Real Estate | Bend, Redmond, Sisters, Sunriver',
  description:
    'The most comprehensive Central Oregon real estate platform. Search homes in Bend, Redmond, Sisters, Sunriver and surrounding communities. Listings, market insights, and local expertise.',
  alternates: { canonical: siteUrl },
  openGraph: {
    title: 'Ryan Realty — Central Oregon Real Estate | Bend, Redmond, Sisters, Sunriver',
    description:
      'The most comprehensive Central Oregon real estate platform. Search homes in Bend, Redmond, Sisters, Sunriver and surrounding communities.',
    url: siteUrl,
    siteName: 'Ryan Realty',
    type: 'website',
    images: [{ url: ogImage, width: 1200, height: 630, alt: 'Ryan Realty — Central Oregon Real Estate' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ryan Realty — Central Oregon Real Estate | Bend, Redmond, Sisters, Sunriver',
    description: 'The most comprehensive Central Oregon real estate platform.',
  },
}

type HomeProps = { searchParams?: Promise<{ city?: string }> }

export default async function Home(props: HomeProps) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url?.trim() || !anonKey?.trim()) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-6 text-foreground">
          <h1 className="text-xl font-semibold">Setup required</h1>
          <p className="mt-2 text-sm">
            Add <code className="rounded bg-warning/15 px-1">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
            <code className="rounded bg-warning/15 px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to{' '}
            <code className="rounded bg-warning/15 px-1">.env.local</code> and restart the dev server.
          </p>
        </div>
      </main>
    )
  }

  const [session, brokerage, marketSnapshot, activityFeed, browseCities] = await Promise.all([
    getSession(),
    getBrokerageSettings(),
    getMarketSnapshot(),
    getActivityFeedWithFallbackMulti({ cities: [...ACTIVITY_FEED_DEFAULT_CITIES], limit: 12 }),
    getBrowseCities(),
  ])

  const marketForHero = {
    count: marketSnapshot.count,
    medianPrice: marketSnapshot.medianPrice,
    avgDom: marketSnapshot.avgDom ?? null,
  }

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

      <HomeHero
        marketSnapshot={marketForHero}
        heroVideoUrl={brokerage?.hero_video_url?.trim() || '/videos/hero.mp4'}
        heroImageUrl={brokerage?.hero_image_url ?? null}
      />

      <SocialProofSection testimonials={TESTIMONIALS} teamImageSrc={getTeamImageSrc(brokerage)} />

      <ActivityFeedSection
        initialItems={activityFeed}
        defaultCities={[...ACTIVITY_FEED_DEFAULT_CITIES]}
        allCities={browseCities.map((c) => ({ city: c.City, count: c.count }))}
        heading="Latest activity"
        viewAllHref="/listings"
        viewAllLabel="View all listings"
        limit={12}
      />

      <BeaconReportSection />

      <EmailSignup />
    </main>
  )
}
