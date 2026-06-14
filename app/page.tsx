import type { Metadata } from 'next'

import HomepageV6Hero from '@/components/site/HomepageV6Hero'
import HomepageV6DealFlow, { type DealFlowCard } from '@/components/site/HomepageV6DealFlow'
import HomepageV6Collection from '@/components/site/HomepageV6Collection'
import HomepageV6Ledger from '@/components/site/HomepageV6Ledger'
import HomepageV6Tools from '@/components/site/HomepageV6Tools'
import HomepageV6Sell from '@/components/site/HomepageV6Sell'
import HomepageV6Standard from '@/components/site/HomepageV6Standard'
import HomepageV6Guides from '@/components/site/HomepageV6Guides'
import HomepageV6Closer from '@/components/site/HomepageV6Closer'

import { getRegionPulse } from '@/lib/data'
import { getBendNeighborhoodLedger } from '@/lib/data'
import { getListingTiles } from '@/lib/data'
import { getRecentBlogPosts } from '@/lib/data'
import { getActivityFeed } from '@/app/actions/activity-feed'
import type { ActivityFeedItem } from '@/app/actions/activity-feed-shared'
import type { ListingTile } from '@/lib/data/types/listing'
import type { BlogPostCard } from '@/lib/data/blog/getRecentBlogPosts'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/api/og?type=default`

/**
 * Homepage — "the city is the homepage." Linear finish on v6 bones
 * (LOCKED, Matt 2026-06-13: Linear spec, not cinematic). Live photoreal 3D
 * Bend hero (Google 3D Tiles over poster-first LCP) + ask bar + coords
 * readout, then a Linear-discipline section stack: live deal flow, top-of-
 * market collection, neighborhood ledger, working tools, instant home value,
 * the standard every home gets, market guides, seller closer. Hairline
 * borders, glass panels, micro-tracked labels, 150ms motion, one Amboqia
 * moment (hero H1). Every figure live from the DAL (§0).
 *
 * ISR cache at 60s. Organization + WebSite JSON-LD emitted once by the root
 * layout (<JsonLd>); the homepage does not re-declare it.
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

function fmtPrice(n: number): string {
  return `$${(Math.round(n / 1000) * 1000).toLocaleString('en-US')}`
}

/** Most specific HUMAN-READABLE verified geo. Plat codes ("OWW1") fall back to city. */
function placeFor(ev: ActivityFeedItem): string {
  const sub = ev.NeighborhoodName ?? ev.SubdivisionName
  if (sub && sub.length >= 4 && !/\d/.test(sub)) return sub
  return ev.City ?? 'Central Oregon'
}

const MINUS = '−'

/** Activity event → deal card. Null when the class's figure can't be verified (§0). */
function toDealCard(ev: ActivityFeedItem): DealFlowCard | null {
  const base = { key: ev.id, href: `/listing/${ev.listing_key}`, place: placeFor(ev) }
  const when = timeSince(ev.event_at)
  const payload = (ev.payload ?? {}) as Record<string, unknown>

  switch (ev.event_type) {
    case 'new_listing':
    case 'back_on_market': {
      if (ev.ListPrice == null) return null
      return { ...base, type: 'New', meta: [fmtPrice(ev.ListPrice), when] }
    }
    case 'price_drop': {
      const prev = typeof payload.previous_price === 'number' ? payload.previous_price : null
      const next = typeof payload.new_price === 'number' ? payload.new_price : null
      if (prev == null || next == null || next >= prev) return null
      return { ...base, type: 'Price drop', meta: [fmtPrice(next), `${MINUS}${fmtPrice(prev - next)}`, when], posIndex: 1 }
    }
    case 'status_pending': {
      if (ev.OnMarketDate) {
        const days = Math.floor((new Date(ev.event_at).getTime() - new Date(ev.OnMarketDate).getTime()) / 86_400_000)
        if (Number.isFinite(days) && days >= 0) return { ...base, type: 'Pending', meta: [`${days} days on market`, when] }
      }
      if (ev.ListPrice == null) return null
      return { ...base, type: 'Pending', meta: [fmtPrice(ev.ListPrice), when] }
    }
    case 'status_closed': {
      const close = typeof payload.ClosePrice === 'number' ? payload.ClosePrice : null
      if (close == null) return null
      return { ...base, type: 'Sold', meta: [fmtPrice(close), when] }
    }
    default:
      return null
  }
}

/** Up to 4 cards: one of each class first (variety), newest fill after. */
function buildDealCards(events: ActivityFeedItem[]): DealFlowCard[] {
  const all = events.map(toDealCard).filter((c): c is DealFlowCard => c !== null)
  const picked: DealFlowCard[] = []
  for (const type of ['New', 'Price drop', 'Pending', 'Sold'] as const) {
    const hit = all.find((c) => c.type === type)
    if (hit) picked.push(hit)
  }
  for (const c of all) {
    if (picked.length >= 4) break
    if (!picked.includes(c)) picked.push(c)
  }
  return picked.slice(0, 4)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function Home() {
  const [pulse, ledgerRows, activity, topTiles, posts] = await Promise.all([
    getRegionPulse().catch(() => null),
    getBendNeighborhoodLedger().catch(() => []),
    getActivityFeed({
      limit: 40,
      eventTypes: ['new_listing', 'price_drop', 'status_pending', 'status_closed'],
    }).catch(() => [] as ActivityFeedItem[]),
    getListingTiles({
      status: 'active',
      sort: 'price-desc',
      limit: 12,
      propertyType: 'A',
      cities: ['Bend', 'Sisters', 'Sunriver', 'Redmond', 'Tumalo'],
    }).catch(() => [] as ListingTile[]),
    getRecentBlogPosts({ limit: 6 }).catch(() => [] as BlogPostCard[]),
  ])

  const cards = buildDealCards(activity)
  const freshnessLabel = pulse?.updatedAt ? timeSince(pulse.updatedAt) : null

  return (
    <main className="min-h-screen bg-background">
      {/* Site-wide Organization + WebSite JSON-LD is emitted once by the root
          layout (<JsonLd>). The homepage does not re-declare it. */}

      <HomepageV6Hero
        activeCount={pulse?.activeCount ?? null}
        medianListPrice={pulse?.medianListPrice ?? null}
        freshnessLabel={freshnessLabel}
      />

      <HomepageV6DealFlow cards={cards} />

      <HomepageV6Collection tiles={topTiles} />

      <HomepageV6Ledger rows={ledgerRows} />

      <HomepageV6Tools />

      <HomepageV6Sell
        medianListPrice={pulse?.medianListPrice ?? null}
        soldCount30d={pulse?.soldCount30d ?? null}
        medianDaysToPending={pulse?.medianDaysToPending ?? null}
      />

      <HomepageV6Standard />

      <HomepageV6Guides posts={posts} />

      <HomepageV6Closer />
    </main>
  )
}
