/**
 * /activity — Live market activity feed for Central Oregon.
 *
 * KB (kinetic-brutalist) design — Phase 9 "feed" page-class migration. Restyled
 * IN PLACE from the prior bg-primary hero + ActivityFeedCard grid. Every piece
 * of content is preserved:
 *   - hero H1 ("Live Market Activity") + subtitle + the two CTAs
 *     (View All Listings -> /homes-for-sale browse hub, Search on Map ->
 *     /homes-for-sale map search)
 *   - the live getActivityFeed({ limit: 24 }) DAL-backed fetch (unchanged)
 *   - every activity row (new / price cut / pending / sold / off-market /
 *     back-on-market) with its address, city line, price, photo and deep link
 *     to the listing detail page
 *   - the AdUnit (consent-gated AdSense slot 1001003002)
 *   - the HomeValuationCta lead-capture card
 *   - the CollectionPage JSON-LD + a BreadcrumbList JSON-LD
 *
 * Only the presentation changed. The activity grid of cards now renders as the
 * KbActivity brutalist ledger (the same component the homepage + city +
 * community pages use for their live MLS feed) so the surface wears the navy /
 * cream, Amboqia display, hard-edge KB look. Interactive logic (consent-gated
 * ads, lead-capture CTA) is untouched.
 *
 * SEO: export const metadata (canonical + OG + Twitter). JSON-LD preserved.
 * PAGE CONTRACT: KB design + SEO + tracking (KbSectionTracker pageType="feed").
 */

import type { Metadata } from 'next'
import { getActivityFeed } from '@/app/actions/activity-feed'
import type { ActivityFeedItem } from '@/app/actions/activity-feed-shared'
import AdUnit from '@/components/AdUnit'
import HomeValuationCta from '@/components/HomeValuationCta'
import { listingsBrowsePath, listingTileHref } from '@/lib/slug'
import { generateBreadcrumbSchema } from '@/lib/structured-data'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbActivity, type KbActivityItem } from '@/components/site/kb/KbActivity.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import '@/components/site/kb/kb.css'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/api/og?type=default`

export const metadata: Metadata = {
  title: 'Live Market Activity',
  description: 'Track new listings, price drops, pending sales, and closed activity across Central Oregon.',
  alternates: { canonical: `${siteUrl}/activity` },
  openGraph: {
    title: 'Live Market Activity | Ryan Realty',
    description: 'Track listing activity signals across Central Oregon neighborhoods.',
    url: `${siteUrl}/activity`,
    type: 'website',
    images: [{ url: ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary',
    title: 'Live Market Activity | Ryan Realty',
    description: 'Track listing activity signals across Central Oregon neighborhoods.',
    images: [ogImage],
  },
}

export const dynamic = 'force-dynamic'

// Map an activity event_type to a KbActivity kind + display label. Same mapping
// the city / community / neighborhood pages use so the feed reads consistently
// across the site. Unknown kinds fall back to their raw type string.
const ACTIVITY_KIND: Record<string, { kind: string; label: string }> = {
  new_listing: { kind: 'new', label: 'New' },
  price_drop: { kind: 'price_drop', label: 'Price cut' },
  status_pending: { kind: 'pending', label: 'Pending' },
  status_closed: { kind: 'sold', label: 'Sold' },
  back_on_market: { kind: 'new', label: 'Back on market' },
  status_expired: { kind: 'expired', label: 'Off market' },
}

function toKbActivityItem(a: ActivityFeedItem): KbActivityItem {
  const km = ACTIVITY_KIND[a.event_type] ?? { kind: a.event_type, label: a.event_type }
  return {
    kind: km.kind,
    label: km.label,
    address: [a.StreetNumber, a.StreetName, a.StreetSuffix].filter(Boolean).join(' ') || 'Address on request',
    cityLine: [a.City, a.SubdivisionName].filter(Boolean).join(' · '),
    price: a.ListPrice ?? null,
    imageUrl: a.PhotoURL ?? null,
    href: listingTileHref({
      listingKey: a.listing_key,
      listNumber: a.ListNumber ?? null,
      streetNumber: a.StreetNumber ?? null,
      streetName: a.StreetName ?? null,
      city: a.City ?? null,
      subdivisionName: a.SubdivisionName ?? null,
    }),
    whenLabel: a.event_at
      ? new Date(a.event_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
      : '',
  }
}

export default async function ActivityPage() {
  const items = await getActivityFeed({ limit: 24 })
  const activityItems: KbActivityItem[] = items.map(toKbActivityItem)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Live Market Activity',
    url: `${siteUrl}/activity`,
    description: 'Recent listing activity events across Central Oregon.',
  }

  return (
    <main className="kb-root">
      <KbNav />
      <KbSectionTracker pageType="feed" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            generateBreadcrumbSchema([
              { name: 'Home', url: siteUrl },
              { name: 'Activity', url: `${siteUrl}/activity` },
            ])
          ),
        }}
      />
      <KbBreadcrumb overlay
        trail={[
          { label: 'Home', href: '/' },
          { label: 'Activity' },
        ]}
      />
      <SmoothScrollProvider>
        {/* Hero — same H1 + subtitle as the prior bg-primary hero, in the KB
            Amboqia display. The two CTAs (View All Listings / Search on Map)
            are preserved below the hero so they keep their exact destinations. */}
        <KbHero
          data={{ activeCount: null, medianListPrice: null, medianDaysToPending: null }}
          eyebrow="Central Oregon · Live MLS"
          titleTop="Live Market"
          titleBottom="Activity"
          lead="New listings, price changes, pending sales, and closed updates across Central Oregon."
          videoSrc={null}
          posterSrc="/images/homepage/bend-drake-park-aerial.jpg"
        />

        {/* CTA row preserved from the prior hero (View All Listings · Search on Map). */}
        <section className="section" id="activity-cta" aria-label="Browse and search">
          <div className="wrap">
            <div className="flex flex-wrap items-center gap-3 py-2">
              <a href={listingsBrowsePath()} className="btn alt">
                View all listings <span className="arr">→</span>
              </a>
              <a
                href="/homes-for-sale"
                className="btn alt"
                style={{ background: 'transparent', color: 'var(--navy)' }}
              >
                Search on map <span className="arr">→</span>
              </a>
            </div>
          </div>
        </section>

        {/* Live activity ledger — every event from getActivityFeed({ limit: 24 })
            rendered as a KbActivity row (address, city line, price, photo, deep
            link). Honest empty state when there is no recent activity. */}
        {activityItems.length > 0 ? (
          <KbActivity
            items={activityItems}
            eyebrow="Live · MLS"
            heading="Latest market activity"
            viewAllHref={listingsBrowsePath()}
            viewAllLabel="View all listings"
          />
        ) : (
          <section className="section activity" id="activity-empty" aria-label="No recent activity">
            <div className="wrap">
              <div className="sec-head">
                <span className="sec-index">Live · MLS</span>
                <h2 className="sec-title display">No recent<br />activity</h2>
              </div>
              <p className="ov-prose-wide" style={{ color: 'var(--cream-70)', maxWidth: '54ch' }}>
                The market is quiet right now. Browse active homes or check back soon for new listings,
                price changes, and sales.
              </p>
              <div className="sec-cta">
                <a href={listingsBrowsePath()} className="btn ghost">
                  Browse listings <span className="arr">→</span>
                </a>
              </div>
            </div>
          </section>
        )}

        {/* Sponsored unit — consent-gated AdSense slot (renders null without
            marketing consent). Same slot + format as before. */}
        <section className="section" id="activity-sponsored" aria-label="Sponsored">
          <div className="wrap">
            <AdUnit slot="1001003002" format="horizontal" />
          </div>
        </section>

        {/* Lead-capture CTA — unchanged "what's my home worth" card. */}
        <section className="section" id="activity-valuation" aria-label="Free home valuation">
          <div className="wrap">
            <HomeValuationCta />
          </div>
        </section>

        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}
