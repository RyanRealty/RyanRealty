import type { Metadata } from 'next'
import path from 'path'
import fs from 'fs'
import { Suspense } from 'react'
import Link from 'next/link'
import { getBrokerageSettings } from './actions/brokerage'
import { getMarketSnapshot, getJustListed } from './actions/home'
import { getSession } from './actions/auth'
import { TESTIMONIALS } from '@/lib/testimonials'
import HomeHero from '../components/home/HomeHero'
import SocialProofSection from '../components/home/SocialProofSection'
import ActivityFeedSection from '../components/activity/ActivityFeedSection'
import MarketPulseSection from '../components/market-report/MarketPulseSection'
import EmailSignup from '../components/home/EmailSignup'
import HomeCommunitiesBlock from '../components/home/HomeCommunitiesBlock'
import HomeCitiesBlock from '../components/home/HomeCitiesBlock'
import ShareButton from '@/components/ShareButton'
import { getActivityFeedWithFallbackMulti } from './actions/activity-feed'
import { ACTIVITY_FEED_DEFAULT_CITIES } from './actions/activity-feed-shared'
import { getBrowseCities } from './actions/listings'
import { getSavedListingKeys } from './actions/saved-listings'
import { getLikedListingKeys } from './actions/likes'
import { getOpenHousesWithListings } from './actions/open-houses'
import type { BrokerageSettingsRow } from './actions/brokerage'
import { listingsBrowsePath } from '@/lib/slug'
import OpenHouseSection from '@/components/open-houses/OpenHouseSection'
import VideoToursRow from '@/components/videos/VideoToursRow'
import AdUnit from '@/components/AdUnit'
import HomeValuationCta from '@/components/HomeValuationCta'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/og-home.png`

/**
 * Resolve team photo URL for SocialProofSection.
 * To update: (1) Admin → Site/Brokerage: set team_image_url or hero_image_url (saved to DB). (2) Or replace public/images/team.png; the ?v= cache-buster uses file mtime at request time so a new deploy or revalidate picks it up. This page revalidates every 60s.
 */
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

  // Critical data — needed for hero + search bar (above the fold)
  const [session, brokerage, marketSnapshot] = await Promise.all([
    getSession(),
    getBrokerageSettings(),
    getMarketSnapshot(),
  ])

  // Non-critical data — fetched in parallel but doesn't block hero render
  let activityFeed: Awaited<ReturnType<typeof getActivityFeedWithFallbackMulti>> = []
  let browseCities: Awaited<ReturnType<typeof getBrowseCities>> = []
  let weekendOpenHouses: Awaited<ReturnType<typeof getOpenHousesWithListings>> = []
  let justListed: Awaited<ReturnType<typeof getJustListed>> = []
  let activitySavedKeys: string[] = []
  let activityLikedKeys: string[] = []

  try {
    ;[activityFeed, browseCities, weekendOpenHouses, justListed] = await Promise.all([
      getActivityFeedWithFallbackMulti({ cities: [...ACTIVITY_FEED_DEFAULT_CITIES], limit: 12 }),
      getBrowseCities(),
      getOpenHousesWithListings(),
      getJustListed('Bend'),
    ])
    if (session?.user) {
      ;[activitySavedKeys, activityLikedKeys] = await Promise.all([
        getSavedListingKeys(),
        getLikedListingKeys(),
      ])
    }
  } catch (err) {
    console.error('[Home] Below-fold data fetch failed:', err)
    // Hero still renders — below-fold sections will show empty/fallback
  }

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
      <div className="mx-auto mt-4 flex w-full max-w-7xl justify-end px-4 sm:px-6">
        <ShareButton
          url={siteUrl}
          title="Ryan Realty Central Oregon Real Estate"
          text="Search listings, market insights, and neighborhoods across Central Oregon."
          trackContext="home_page"
          variant="compact"
        />
      </div>

      <SocialProofSection testimonials={TESTIMONIALS} teamImageSrc={getTeamImageSrc(brokerage)} />

      <ActivityFeedSection
        initialItems={activityFeed}
        defaultCities={[...ACTIVITY_FEED_DEFAULT_CITIES]}
        allCities={browseCities.map((c) => ({ city: c.City, count: c.count }))}
        heading="Latest activity"
        viewAllHref={listingsBrowsePath()}
        viewAllLabel="View all listings"
        limit={12}
        signedIn={!!session?.user}
        savedKeys={activitySavedKeys}
        likedKeys={activityLikedKeys}
      />

      <section className="border-b border-border bg-card px-4 py-12 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Discover by lifestyle</h2>
          <p className="mt-2 text-muted-foreground">Find homes that match how you want to live.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { href: '/search/bend/waterfront', label: 'Waterfront Homes', icon: '🌊' },
              { href: '/search/bend/on-golf-course', label: 'Golf Course Homes', icon: '⛳' },
              { href: '/search/bend/new-listings', label: 'New Listings', icon: '✨' },
              { href: '/search/bend/luxury', label: 'Luxury Homes', icon: '🏔️' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-center gap-3 rounded-xl border border-border bg-background p-5 shadow-sm transition hover:border-primary/30 hover:shadow-md"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-lg" aria-hidden>
                  {item.icon}
                </span>
                <span className="text-sm font-semibold text-foreground group-hover:text-primary">
                  {item.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Browse by price range</h2>
          <p className="mt-2 text-muted-foreground">Quickly find homes within your budget.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { href: '/search/bend/under-500k', label: 'Under $500K', sub: 'Starter homes and condos' },
              { href: '/search/bend/under-750k', label: 'Under $750K', sub: 'Move-up homes' },
              { href: '/search/bend/under-1m', label: 'Under $1M', sub: 'Premium properties' },
              { href: '/search/bend/luxury', label: '$1M and up', sub: 'Luxury and estate homes' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/30 hover:shadow-md"
              >
                <span className="text-lg font-bold text-primary">{item.label}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{item.sub}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <Suspense fallback={<div className="min-h-[280px] bg-muted/30" aria-hidden />}>
        <MarketPulseSection />
      </Suspense>
      <section className="px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <OpenHouseSection
            title="Open houses this weekend"
            items={weekendOpenHouses.slice(0, 10)}
            viewAllHref="/open-houses"
          />
        </div>
      </section>
      <section className="px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <VideoToursRow
            title="Video tours in Bend"
            listings={justListed}
            signedIn={!!session?.user}
            savedKeys={activitySavedKeys}
            likedKeys={activityLikedKeys}
            userEmail={session?.user?.email ?? null}
          />
        </div>
      </section>

      <Suspense fallback={<div className="min-h-[320px] bg-muted/30" aria-hidden />}>
        <HomeCommunitiesBlock session={session} />
      </Suspense>

      <section className="px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <AdUnit slot="3003001001" format="horizontal" />
        </div>
      </section>

      <Suspense fallback={<div className="min-h-[320px] bg-muted/30" aria-hidden />}>
        <HomeCitiesBlock session={session} />
      </Suspense>

      <section className="border-b border-border bg-card px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-background p-6 shadow-sm sm:p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </div>
              <h2 className="mt-4 text-xl font-bold tracking-tight text-foreground sm:text-2xl">Never miss a new listing</h2>
              <p className="mt-2 text-muted-foreground">
                Save a search and get instant alerts when matching homes hit the market. Set your criteria once and we handle the rest.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/account/saved-searches" className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                  Set Up Alerts
                </Link>
                <Link href={listingsBrowsePath()} className="rounded-lg border border-border px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted">
                  Browse Listings
                </Link>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-background p-6 shadow-sm sm:p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <h2 className="mt-4 text-xl font-bold tracking-tight text-foreground sm:text-2xl">Your local team</h2>
              <p className="mt-2 text-muted-foreground">
                Brokers who live and work across Central Oregon neighborhoods. Local knowledge, honest guidance, and a team approach to every transaction.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/team" className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                  Meet the Team
                </Link>
                <Link href="/contact" className="rounded-lg border border-border px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted">
                  Contact Us
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-12 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <HomeValuationCta />
        </div>
      </section>

      <EmailSignup />
    </main>
  )
}
