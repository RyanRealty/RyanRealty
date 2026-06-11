import type { Metadata } from 'next'

import { Suspense } from 'react'
import HomepageHeroV3 from '@/components/site/HomepageHeroV3'
import HomepagePulseTicker from '@/components/site/HomepagePulseTicker'
import HomepageListingsMosaic from '@/components/site/HomepageListingsMosaic'
import HomepageNeighborhoodMap from '@/components/site/HomepageNeighborhoodMap'
import HomepageMarketBand from '@/components/site/HomepageMarketBand'
import HomepageVoiceBlock from '@/components/site/HomepageVoiceBlock'
import HomepageToolsRow from '@/components/site/HomepageToolsRow'
import HomepageTrustBand from '@/components/site/HomepageTrustBand'
import CtaDuo from '@/components/site/CtaDuo'

import { getRegionPulse } from '@/lib/data'
import { getBendNeighborhoodStats } from '@/lib/data'
import { getListingTiles } from '@/lib/data'
import { getBrokers } from '@/lib/data'
import { getActivityFeed } from '@/app/actions/activity-feed'
import type { ActivityFeedItem } from '@/app/actions/activity-feed-shared'
import type { ListingTile } from '@/lib/data/types/listing'
import type { PulseChip } from '@/components/site/HomepagePulseTicker'
import type { ListingCardShape } from '@/components/site/HomepageListingsMosaic'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/api/og?type=default`

/**
 * ISR cache at 60s. Parallel data fetches stream section-by-section.
 * Organization + WebSite JSON-LD is emitted once by the root layout (<JsonLd>).
 * The homepage does NOT re-declare them — duplicate entities confuse schema parsers.
 */
export const revalidate = 60

export const metadata: Metadata = {
  title: 'Ryan Realty. Central Oregon Real Estate | Bend, Redmond, Sisters, Sunriver',
  description:
    'Find your next home in Central Oregon. Search homes in Bend, Redmond, Sisters, Sunriver and surrounding communities. Real numbers, direct from the brokers who close deals here.',
  alternates: { canonical: siteUrl },
  openGraph: {
    title: 'Ryan Realty. Central Oregon Real Estate',
    description:
      'Search homes in Bend, Redmond, Sisters, Sunriver and surrounding communities. Real numbers, direct from the brokers who close deals here.',
    url: siteUrl,
    siteName: 'Ryan Realty',
    type: 'website',
    images: [{ url: ogImage, width: 1200, height: 630, alt: 'Ryan Realty. Central Oregon Real Estate' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ryan Realty. Central Oregon Real Estate | Bend, Redmond, Sisters, Sunriver',
    description: 'Real numbers, direct from the brokers who close deals in Central Oregon.',
  },
}

// ─── Converters ──────────────────────────────────────────────────────────────

function timeSince(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function toPulseChip(ev: ActivityFeedItem): PulseChip | null {
  const price = ev.ListPrice
  if (!price) return null
  const city = ev.City ?? ''
  const street = [ev.StreetNumber, ev.StreetName].filter(Boolean).join(' ')
  const location = [street, city].filter(Boolean).join(', ') || city || 'Central Oregon'
  const tag: PulseChip['tag'] =
    ev.event_type === 'status_closed'
      ? 'Sold'
      : ev.event_type === 'new_listing' || ev.event_type === 'back_on_market'
        ? 'New'
        : ev.event_type === 'status_pending'
          ? 'Pending'
          : ev.event_type === 'price_drop'
            ? 'Price drop'
            : null
  if (!tag) return null
  return { tag, price, location, timeAgo: timeSince(ev.event_at) }
}

function toCardShape(tile: ListingTile): ListingCardShape {
  const address = [tile.streetNumber, tile.streetName].filter(Boolean).join(' ')
  const cityLine = [tile.city, tile.postalCode].filter(Boolean).join(' ')
  return {
    listingKey: tile.listingKey,
    href: `/listing/${tile.listingKey}`,
    price: tile.listPrice ?? null,
    address,
    cityLine,
    beds: tile.beds,
    baths: tile.baths,
    sqft: tile.sqft,
    photoUrl: tile.photoUrl,
    dom: tile.dom,
    status: tile.status,
    subdivisionName: tile.subdivisionName,
  }
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function SectionSkeleton({ minH = 'min-h-64' }: { minH?: string }) {
  return <div className={`${minH} border-t border-border`} aria-hidden />
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function Home() {
  // Parallel data fetches — all critical paths race; fallback on error.
  const [pulse, neighborhoodStats, activity, tiles, brokers] = await Promise.all([
    getRegionPulse().catch(() => null),
    getBendNeighborhoodStats().catch(() => null),
    getActivityFeed({ limit: 24 }).catch(() => [] as ActivityFeedItem[]),
    getListingTiles({ status: 'active', sort: 'newest', limit: 5 }).catch(() => [] as ListingTile[]),
    getBrokers().catch(() => []),
  ])

  // Convert activity events to pulse chips (filter out null results)
  const chips: PulseChip[] = activity
    .map(toPulseChip)
    .filter((c): c is PulseChip => c !== null)

  // Convert listing tiles to card shapes
  const cards: ListingCardShape[] = tiles.map(toCardShape)

  // Freshness label from region pulse
  const freshnessLabel = pulse?.updatedAt
    ? timeSince(pulse.updatedAt)
    : null

  return (
    <main className="min-h-screen bg-background">
      {/* Site-wide Organization + WebSite JSON-LD is emitted once by the root
          layout (<JsonLd>), with the canonical @id, sameAs, brokers, and NAP.
          The homepage does NOT re-declare them — duplicate, thinner entities
          confuse schema parsers (the #1 cause of markup being discarded). */}

      <HomepageHeroV3
        activeCount={pulse?.activeCount ?? null}
        medianListPrice={pulse?.medianListPrice ?? null}
        medianDaysToPending={pulse?.medianDaysToPending ?? null}
        freshnessLabel={freshnessLabel}
      />

      {chips.length > 0 && (
        <HomepagePulseTicker chips={chips} />
      )}

      <Suspense fallback={<SectionSkeleton minH="min-h-96" />}>
        <HomepageListingsMosaic listings={cards} />
      </Suspense>

      <Suspense fallback={<SectionSkeleton minH="min-h-96" />}>
        <HomepageNeighborhoodMap neighborhoodStats={neighborhoodStats ?? []} />
      </Suspense>

      <HomepageMarketBand
        activeCount={pulse?.activeCount ?? null}
        medianListPrice={pulse?.medianListPrice ?? null}
        monthsOfSupply={pulse?.monthsOfSupply ?? null}
        soldCount30d={pulse?.soldCount30d ?? null}
      />

      <HomepageVoiceBlock />

      <HomepageToolsRow />

      <HomepageTrustBand brokers={brokers} />

      <CtaDuo />
    </main>
  )
}
