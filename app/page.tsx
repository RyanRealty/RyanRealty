import type { Metadata } from 'next'

import HomepageV6Hero from '@/components/site/HomepageV6Hero'
import CityGrid from '@/components/site/CityGrid'
import { RelatedAreas, type RelatedAreaItem } from '@/components/site/RelatedAreas'
import FeaturedListings from '@/components/site/FeaturedListings'
import MarketSnapshot from '@/components/site/MarketSnapshot'
import { ArticleGrid } from '@/components/site/ArticleGrid'
import { CTABar } from '@/components/site/CTABar'

import { getRegionPulse } from '@/lib/data'
import { getRecentBlogPosts } from '@/lib/data'
import { getAllResortCommunities } from '@/lib/data/communities/registry'
import type { BlogPostCard } from '@/lib/data/blog/getRecentBlogPosts'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/api/og?type=default`

/**
 * Homepage — drone-flyover hero + standard section stack that matches the
 * rest of the site (cities, communities, buy, listings pages).
 *
 * Hero: HomepageV6Hero (Matt-approved, locked).
 * Below: CityGrid → RelatedAreas (communities) → FeaturedListings →
 *        MarketSnapshot → ArticleGrid → CTABar.
 *
 * All standard components — the same ones that render /cities, /communities,
 * /buy, and search pages. No bespoke data-terminal sections. Every figure
 * live from the DAL (§0).
 *
 * ISR cache at 60s.
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

function timeSince(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// Community slugs to feature on the homepage (highlight the most-searched
// resort communities and Bend neighborhoods).
const FEATURED_COMMUNITY_SLUGS = [
  'tetherow',
  'northwest-crossing',
  'bend-awbrey-butte',
  'broken-top',
  'caldera-springs',
  'black-butte-ranch',
  'sunriver-resort',
  'eagle-crest',
]

export default async function Home() {
  const [pulse, posts] = await Promise.all([
    getRegionPulse().catch(() => null),
    getRecentBlogPosts({ limit: 6 }).catch(() => [] as BlogPostCard[]),
  ])

  const freshnessLabel = pulse?.updatedAt ? timeSince(pulse.updatedAt) : null

  // Build community items from the registry (synchronous, zero Supabase cost).
  // RelatedAreas shows text-tile rows when no imageUrl is supplied, which
  // matches the design-system pattern and avoids an extra media fetch here.
  const allCommunities = getAllResortCommunities()
  const communityMap = new Map(allCommunities.map((c) => [c.slug, c]))
  const communityItems: RelatedAreaItem[] = FEATURED_COMMUNITY_SLUGS
    .map((slug) => {
      const entry = communityMap.get(slug)
      if (!entry) return null
      return {
        name: entry.label,
        href: `/communities/${entry.slug}`,
      } satisfies RelatedAreaItem
    })
    .filter((item): item is RelatedAreaItem => item !== null)

  return (
    <main className="min-h-screen bg-background">
      {/* 1. Hero — drone-flyover video + ask bar (Matt-approved, locked) */}
      <HomepageV6Hero
        activeCount={pulse?.activeCount ?? null}
        medianListPrice={pulse?.medianListPrice ?? null}
        freshnessLabel={freshnessLabel}
      />

      {/* 2. Browse by city — standard CityGrid used on /about and /cities */}
      <CityGrid
        eyebrow="Search by location"
        title="Browse by city"
        subtitle="Median prices refreshed daily from Oregon Data Share."
      />

      {/* 3. Browse by neighborhood / community — standard RelatedAreas */}
      <RelatedAreas
        eyebrow="Communities"
        title="Browse by neighborhood"
        items={communityItems}
        cols={4}
        viewAllHref="/communities"
        viewAllLabel="View all communities"
        tone="default"
      />

      {/* 4. Featured listings — real active inventory, newest first */}
      <FeaturedListings
        title="Active Central Oregon homes"
        viewAllHref="/homes-for-sale"
        viewAllLabel="View all homes"
        limit={8}
      />

      {/* 5. Market snapshot — region-level, live from market_pulse_live */}
      <MarketSnapshot />

      {/* 6. Guides from the blog */}
      <ArticleGrid
        items={posts}
        eyebrow="Guides & insights"
        heading="From the blog"
        viewAllHref="/blog"
        tone="muted"
      />

      {/* 7. Sell CTA */}
      <CTABar
        eyebrow="Thinking about selling?"
        title="Find out what your home is worth."
        body="Real numbers from brokers who work this market every day. No algorithms, no automated estimates."
        primary={{ href: '/sell/valuation', label: "What's my home worth?" }}
        secondary={{ href: 'tel:5412136706', label: '541.213.6706' }}
        tone="navy"
      />
    </main>
  )
}
