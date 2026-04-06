import type { Metadata } from 'next'
import path from 'path'
import fs from 'fs'
import { Suspense } from 'react'
import Link from 'next/link'
import { getMarketSnapshot } from './actions/home'
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
import { getBrokerageSettings, type BrokerageSettingsRow } from './actions/brokerage'
import { listingsBrowsePath } from '@/lib/slug'
import OpenHouseSection from '@/components/open-houses/OpenHouseSection'
import VideoToursRow from '@/components/videos/VideoToursRow'
import AdUnit from '@/components/AdUnit'
import HomeValuationCta from '@/components/HomeValuationCta'
import BrokerageListingsSlider from '@/components/home/BrokerageListingsSlider'
import PopularSearchesSection from '@/components/home/PopularSearchesSection'
import { Skeleton } from '@/components/ui/skeleton'
import LifestyleSearchSlider from '@/components/home/LifestyleSearchSlider'
import { getListingsWithVideosCached } from './actions/videos'
import type { ListingTileRow } from './actions/listings'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import CentralOregonSalesChart from '@/components/home/CentralOregonSalesChart'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/og-home.png`
type PublicSession = { user?: { email?: string | null } } | null

/** Home streams many heavy Supabase scans; allow time and never reject the Suspense boundary. */
const HOME_FETCH_MS = 12_000
/** Video tour query can scan listings + listing_videos; 12s was timing out and yielded an empty slider. */
const HOME_VIDEO_TOURS_MS = 90_000

function withTimeout<T>(promise: Promise<T>, fallback: T, timeoutMs = HOME_FETCH_MS, label?: string): Promise<T> {
  return withTimeoutFallback(promise, fallback, timeoutMs, label)
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

export const revalidate = 60
export const dynamic = 'force-dynamic'

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

/* ─── Skeleton fallbacks ──────────────────────────────────── */

function SectionSkeleton({ height = 'min-h-[320px]' }: { height?: string }) {
  return (
    <div className={`${height} px-4 py-12 sm:px-6`}>
      <div className="mx-auto max-w-7xl">
        <Skeleton className="mb-4 h-8 w-48" />
        <Skeleton className="mb-6 h-4 w-72" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Async streamed sections ────────────────────────────── */

async function ActivityFeedAsync({ session }: { session: PublicSession }) {
  const [activityFeed, browseCities, savedKeys, likedKeys] = await Promise.all([
    withTimeout(getActivityFeedWithFallbackMulti({ cities: [...ACTIVITY_FEED_DEFAULT_CITIES], limit: 12 }), [], HOME_FETCH_MS, 'home-activity-feed'),
    withTimeout(getBrowseCities(), [], HOME_FETCH_MS, 'home-browse-cities'),
    session?.user ? withTimeout(getSavedListingKeys(), [] as string[], HOME_FETCH_MS, 'home-saved-keys') : Promise.resolve([] as string[]),
    session?.user ? withTimeout(getLikedListingKeys(), [] as string[], HOME_FETCH_MS, 'home-liked-keys') : Promise.resolve([] as string[]),
  ])

  return (
    <ActivityFeedSection
      initialItems={activityFeed}
      defaultCities={[...ACTIVITY_FEED_DEFAULT_CITIES]}
      allCities={browseCities.map((c) => ({ city: c.City, count: c.count }))}
      heading="Latest activity"
      viewAllHref={listingsBrowsePath()}
      viewAllLabel="View all listings"
      limit={12}
      signedIn={!!session?.user}
      savedKeys={savedKeys}
      likedKeys={likedKeys}
      userEmail={session?.user?.email ?? null}
    />
  )
}

async function OpenHouseAsync() {
  const weekendOpenHouses = await withTimeout(getOpenHousesWithListings(), [], HOME_FETCH_MS, 'home-open-houses')
  return (
    <section className="px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <OpenHouseSection
          title="Open houses this weekend"
          items={weekendOpenHouses.slice(0, 10)}
          viewAllHref="/open-houses"
        />
      </div>
    </section>
  )
}

async function MarketSnapshotSection() {
  const snapshot = await withTimeout(
    getMarketSnapshot(),
    {
      count: 0,
      avgPrice: null,
      medianPrice: null,
      avgDom: null,
      newListingsLast30Days: 0,
      pendingCount: 0,
      closedLast12Months: 0,
      regionSalesSeries: [],
      closedYtdResidential: 0,
    },
    HOME_FETCH_MS,
    'home-market-snapshot'
  )
  return (
    <section className="px-4 py-12 sm:px-6 sm:py-14" aria-labelledby="central-oregon-snapshot-heading">
      <div className="mx-auto max-w-7xl">
        <h2
          id="central-oregon-snapshot-heading"
          className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
        >
          Central Oregon Market Snapshot
        </h2>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Active residential inventory across Bend, Redmond, Sunriver, La Pine, Sisters, Tumalo, Madras, Prineville,
          Powell Butte, Terrebonne, and Crooked River Ranch. Condos and townhomes are included. Land, manufactured
          homes, and commercial listings are excluded. Under-contract counts follow MLS status by city and can
          include other property types.
        </p>
        <p className="mt-3 text-base font-medium text-foreground">
          Closed year to date{' '}
          <span className="tabular-nums">{snapshot.closedYtdResidential.toLocaleString()}</span> residential sales
          region-wide (same cities and filters).
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Active residential listings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tabular-nums text-foreground">{snapshot.count.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Under contract</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tabular-nums text-foreground">
                {snapshot.pendingCount.toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Median sale price YTD</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tabular-nums text-foreground">
                {snapshot.medianPrice != null ? `$${Math.round(snapshot.medianPrice).toLocaleString()}` : '—'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Typical days to sell</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tabular-nums text-foreground">
                {snapshot.avgDom != null ? Math.round(snapshot.avgDom).toLocaleString() : '—'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Median days on market for closed sales YTD</p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-10">
          <h3 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            Regional closed sales by month
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Each point is the sum of closed residential sales across the cities above. For price bands, absorption,
            and custom ranges, use the report tools below.
          </p>
          <div className="mt-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
            <CentralOregonSalesChart series={snapshot.regionSalesSeries} />
            <div className="mt-6 flex flex-wrap gap-3">
              <Button variant="outline" size="default" asChild>
                <Link href="/reports/explore">Explore market reports</Link>
              </Button>
              <Button variant="ghost" size="default" asChild>
                <Link href="/housing-market">Housing market hub</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
      <MarketPulseSection
        className="!px-0 !pt-12 !pb-0"
        omitCityCharts
        headingVariant="nested"
      />
    </section>
  )
}

async function VideoToursAsync({ session }: { session: PublicSession }) {
  const [videoRows, savedKeys, likedKeys] = await Promise.all([
    withTimeout(
      getListingsWithVideosCached({
        region: 'central_oregon',
        sort: 'price_desc',
        status: 'active',
        limit: 12,
      }),
      [],
      HOME_VIDEO_TOURS_MS,
      'home-video-listings'
    ),
    session?.user ? withTimeout(getSavedListingKeys(), [] as string[], HOME_FETCH_MS, 'home-video-saved') : Promise.resolve([] as string[]),
    session?.user ? withTimeout(getLikedListingKeys(), [] as string[], HOME_FETCH_MS, 'home-video-liked') : Promise.resolve([] as string[]),
  ])
  const listingsWithVideo = videoRows.map((row) => {
    const [streetNumber = '', ...streetNameParts] = (row.unparsed_address ?? '').trim().split(/\s+/)
    const streetName = streetNameParts.join(' ').trim() || null
    return {
      ListingKey: row.listing_key,
      ListNumber: row.list_number ?? row.listing_key,
      ListPrice: row.list_price,
      BedroomsTotal: row.beds_total,
      BathroomsTotal: row.baths_full,
      StreetNumber: streetNumber || null,
      StreetName: streetName,
      City: row.city,
      State: 'OR',
      PostalCode: null,
      SubdivisionName: row.subdivision_name,
      PhotoURL: row.photo_url,
      Latitude: null,
      Longitude: null,
      StandardStatus: 'Active',
      TotalLivingAreaSqFt: row.living_area,
      has_virtual_tour: true,
      details: { Videos: [{ Uri: row.video_url }] },
    } as ListingTileRow & {
      TotalLivingAreaSqFt?: number | null
      has_virtual_tour?: boolean
      details?: { Videos?: Array<{ Uri?: string }> }
    }
  })

  return (
    <section className="px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <VideoToursRow
          title="Popular Tours"
          listings={listingsWithVideo}
          signedIn={!!session?.user}
          savedKeys={savedKeys}
          likedKeys={likedKeys}
          userEmail={session?.user?.email ?? null}
          viewAllHref="/videos"
          listingsAreVideoCurated
        />
      </div>
    </section>
  )
}

/* ─── Main page ──────────────────────────────────────────── */

export default async function Home() {
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

  // Keep public home route cache-friendly by avoiding auth lookup in server render path.
  const session: PublicSession = null
  const brokerage = await getBrokerageSettings()
  const heroVideoUrl = brokerage?.hero_video_url?.trim() || null
  const heroImageUrl = brokerage?.hero_image_url?.trim() || null

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

      {/* Hero renders IMMEDIATELY with placeholder stats — no Suspense blocking LCP */}
      <HomeHero
        marketSnapshot={{ count: 0, medianPrice: null, avgDom: null }}
        heroVideoUrl={heroVideoUrl}
        heroImageUrl={heroImageUrl}
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

      {/* Static — renders immediately, no data fetch */}
      <SocialProofSection testimonials={TESTIMONIALS} teamImageSrc={getTeamImageSrc(null)} />

      <Suspense fallback={<SectionSkeleton />}>
        <MarketSnapshotSection />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <HomeCitiesBlock session={null} />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <ActivityFeedAsync session={session} />
      </Suspense>

      <LifestyleSearchSlider />

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

      <section className="px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <AdUnit slot="3003001001" format="horizontal" />
        </div>
      </section>

      {/* Restore core home sliders with streaming + fallbacks */}
      <Suspense fallback={<SectionSkeleton />}>
        <BrokerageListingsSlider />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <PopularSearchesSection />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <OpenHouseAsync />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <VideoToursAsync session={session} />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <HomeCommunitiesBlock session={null} />
      </Suspense>


      {/* Static CTA sections — render immediately */}
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
