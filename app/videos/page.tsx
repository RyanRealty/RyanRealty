import type { Metadata } from 'next'
import Link from 'next/link'
import { getListingTiles, getCityListings, type ListingTile } from '@/lib/data'
import { tileToCardData } from '@/lib/site/listing-card'
import VideoListingCard from '@/components/site/VideoListingCard'
import type { ListingCardData } from '@/components/site/ListingCard'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import { cn } from '@/lib/utils'
import '@/components/site/kb/kb.css'

/**
 * /videos — "Watch homes on video" destination.
 *
 * KB (kinetic-brutalist) design — Phase 9 page-class migration (media class).
 * Restyled IN PLACE. Every piece of content is preserved:
 *   - generateMetadata (city-aware title/description/canonical/OG)
 *   - ItemList JSON-LD over the video-tour homes (AEO)
 *   - the city filter chips (All Central Oregon + six cities), restyled as KB
 *     pills, still real <Link>s with aria-current on the active city
 *   - the inline-playing video grid (VideoListingCard — logic untouched)
 *   - the honest empty state with the fallback link to /homes-for-sale
 *   - export const revalidate = 300
 *
 * The region-wide home of every active / pending listing that carries a video
 * tour. Unlike the old lightbox client, this is a SERVER component that reads
 * the FAST tile path (listing_tile_mv via the DAL — getListingTiles /
 * getCityListings), maps each tile to the ONE card shape, and renders
 * VideoListingCard so the tour PLAYS inline in the grid (no navigation, no
 * lightbox) using the same listing-detail player + normalizeEmbed host rules.
 *
 * Optional `?city=` narrows the grid to one city (chips below the header). The
 * page revalidates every 5 min so new video listings surface without a deploy.
 */

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/api/og?type=default`

export const revalidate = 300

/** Cities offered as filter chips. Labels are the canonical display names; the
 *  value is what getCityListings filters on (the MLS City string). */
const CITY_CHIPS = ['Bend', 'Redmond', 'Sisters', 'La Pine', 'Prineville', 'Sunriver'] as const

/** Resolve the `city` searchParam to one of the offered chips (case-insensitive),
 *  so a stray value can't poison the canonical or the DAL filter. */
function resolveCity(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value) return null
  const match = CITY_CHIPS.find((c) => c.toLowerCase() === value.trim().toLowerCase())
  return match ?? null
}

type SearchParams = { city?: string | string[] }

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}): Promise<Metadata> {
  const city = resolveCity((await searchParams).city)
  const title = city
    ? `${city} homes for sale with video tours | Central Oregon`
    : 'Homes for sale with video tours | Bend, Oregon'
  const description = city
    ? `Watch video tours of homes for sale in ${city}, Oregon. See the flow, the light, and the lot before you book a showing.`
    : 'Watch video tours of homes for sale across Bend, Redmond, Sisters, and Central Oregon. See the flow, the light, and the lot before you book a showing.'
  const canonical = city ? `${siteUrl}/videos?city=${encodeURIComponent(city)}` : `${siteUrl}/videos`
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: 'Ryan Realty',
      type: 'website',
      images: [{ url: ogImage, width: 1200, height: 630, alt: 'Homes for sale with video tours | Ryan Realty' }],
    },
    twitter: { card: 'summary_large_image', images: [ogImage] },
  }
}

export default async function VideosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const city = resolveCity((await searchParams).city)

  const filter = {
    status: 'active-and-pending' as const,
    hasVirtualTour: true,
    sort: 'newest' as const,
    limit: 36,
  }
  const tiles: ListingTile[] = city ? await getCityListings(city, filter) : await getListingTiles(filter)

  const cards: ListingCardData[] = tiles
    .map((t) => tileToCardData(t, { kind: 'video', label: 'Video tour' }))
    .filter((c): c is ListingCardData => c !== null)

  const lede = city
    ? `Current ${city} listings with a full video tour. Press play and walk the home from anywhere.`
    : 'Current Central Oregon listings with a full video tour. Press play and walk the home from anywhere, then book a showing when one feels right.'
  const heading = city ? `Watch ${city} homes on video` : 'Watch homes on video'
  const canonicalUrl = city ? `${siteUrl}/videos?city=${encodeURIComponent(city)}` : `${siteUrl}/videos`

  return (
    <main className="kb-root">
      <KbNav />
      <KbSectionTracker pageType="media" />

      {/* AEO: the video-tour homes as a structured ItemList so an answer engine
          can surface "homes for sale with video tours in <area>". Mirrors the
          pattern in components/site/VideoHomesSection.tsx. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: heading,
            url: canonicalUrl,
            numberOfItems: cards.length,
            itemListElement: cards.map((c, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              item: {
                '@type': 'SingleFamilyResidence',
                name: c.addressLine,
                address: c.cityLine,
                ...(c.price
                  ? { offers: { '@type': 'Offer', price: c.price, priceCurrency: 'USD', availability: 'https://schema.org/InStock' } }
                  : {}),
              },
            })),
          }),
        }}
      />

      <KbBreadcrumb
        trail={
          city
            ? [
                { label: 'Home', href: '/' },
                { label: 'Video tours', href: '/videos' },
                { label: city },
              ]
            : [
                { label: 'Home', href: '/' },
                { label: 'Video tours' },
              ]
        }
      />

      <SmoothScrollProvider>
        {/* Hero — same H1 + lede as the prior ContentPageHero, on the KB display
            type. activeCount surfaces the live count of video-tour homes. */}
        <KbHero
          data={{ activeCount: cards.length, medianListPrice: null, medianDaysToPending: null }}
          eyebrow={city ? `${city} · Oregon · Video tours` : 'Central Oregon · Video tours'}
          titleTop={city ? `Watch ${city}` : 'Watch homes'}
          titleBottom="on video"
          lead={lede}
          videoSrc={null}
          posterSrc="/images/hero/hero-old-mill-master-4k.jpg"
        />

        {/* City filter chips — KB pills. The active city is the solid navy pill;
            the rest are hard-edged outline pills. "All" clears the filter back
            to the region-wide grid. Real <Link>s with aria-current. */}
        <section className="section" id="city-filter" aria-label="Filter video tours by city">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">Filter by city</span>
              <h2 className="sec-title display">
                Where to<br />press play
              </h2>
            </div>
            <nav aria-label="Filter video tours by city" className="flex flex-wrap items-center gap-2 pt-6">
              <Link
                href="/videos"
                aria-current={city ? undefined : 'page'}
                className={cn(
                  'inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                  city
                    ? 'border border-border bg-background text-foreground hover:bg-secondary'
                    : 'bg-primary text-primary-foreground',
                )}
              >
                All Central Oregon
              </Link>
              {CITY_CHIPS.map((c) => {
                const active = c === city
                return (
                  <Link
                    key={c}
                    href={`/videos?city=${encodeURIComponent(c)}`}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                      active
                        ? 'bg-primary text-primary-foreground pointer-events-none'
                        : 'border border-border bg-background text-foreground hover:bg-secondary',
                    )}
                  >
                    {c}
                  </Link>
                )
              })}
            </nav>
          </div>
        </section>

        {/* The inline-playing video grid (cards.length > 0) or the honest empty
            state. VideoListingCard logic is untouched — each tile plays the tour
            in place or degrades to a link to listing detail. */}
        <section className="section" id="video-grid" aria-label="Homes with video tours">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">
                {cards.length} {cards.length === 1 ? 'home' : 'homes'} · video tour
              </span>
              <h2 className="sec-title display">
                {city ? `${city} homes` : 'Tour the homes'}
              </h2>
            </div>

            {cards.length > 0 ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mt-8">
                {cards.map((card) => (
                  <VideoListingCard key={card.listingKey} listing={card} />
                ))}
              </div>
            ) : (
              <div className="mt-8 border border-border bg-background p-10 text-center">
                <p className="font-display text-xl text-foreground">
                  {city
                    ? `No ${city} listings have a video tour right now.`
                    : 'No listings have a video tour right now.'}
                </p>
                <p className="mt-3 text-sm text-muted-foreground">
                  New tours are added as listings come on the market.
                </p>
                <Link href="/homes-for-sale" className="btn alt mt-5">
                  Browse every home for sale <span className="arr">→</span>
                </Link>
              </div>
            )}
          </div>
        </section>

        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}
