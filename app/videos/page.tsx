/**
 * /videos — video tours of homes for sale, on the v3 barrel.
 *
 * THE PAGE CONTRACT, carried across unchanged: generateMetadata (city-aware
 * title/description/canonical/OG), ItemList + BreadcrumbList + CollectionPage
 * JSON-LD, one VideoObject per embeddable tour (raw <script>, VideoObject is
 * not in SchemaInput), city chips as real <Link>s with aria-current,
 * revalidate 300, V3SectionTracker pageType="media".
 *
 * LEFTOVERS, not v3 atoms: HideAwareVideoGrid (inline play) and VideoFeedClient
 * (vertical feed at ?view=feed). No video-grid atom exists. Declared the same
 * way the homepage keeps KbMarketHud.
 *
 * KB-era deletions: KbHero ("Walk the house / before you go."), SmoothScrollProvider,
 * KbFooter, naked-verb H2 "Pick a city". H1 is search-first: "Video tours of
 * homes for sale".
 *
 * /feed folds here as ?view=feed (P3 keep /videos, fold /feed). The /feed
 * route 301s. start= is preserved.
 *
 * Chrome: layout owns V3Chrome. V3Footer outside main.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { getListingTiles, getCityListings, type ListingTile } from '@/lib/data'
import { tileToCardData } from '@/lib/site/listing-card'
import { listingsBrowsePath } from '@/lib/slug'
import { valuationHref } from '@/lib/site/valuation-href'
import { cn } from '@/lib/utils'
import HideAwareVideoGrid, { type HideAwareVideoItem } from '@/components/site/HideAwareVideoGrid'
import { VideoFeedClient } from '@/components/site/VideoFeedClient'
import type { ListingCardData } from '@/components/site/ListingCard'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Instrument,
  V3Quiet,
  V3SectionTracker,
} from '@/components/site/v3'
import { CITY_CHIPS, resolveCity, resolveView, resolveStart } from './_v3/videos-constants'
import { tilesToFeedItems } from './_v3/feed-items'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/api/og?type=default`

export const revalidate = 300

type SearchParams = { city?: string | string[]; view?: string | string[]; start?: string | string[] }

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}): Promise<Metadata> {
  const sp = await searchParams
  const city = resolveCity(sp.city)
  const view = resolveView(sp.view)
  const title = city
    ? `Video tours of ${city} homes for sale | Central Oregon`
    : 'Video tours of homes for sale | Bend, Oregon'
  const description = city
    ? `Full video tours of homes for sale in ${city}, Oregon. Walk the floor plan, the light, and the lot before you book a showing.`
    : 'Full video tours of homes for sale across Bend, Redmond, Sisters, and Central Oregon. Walk the floor plan, the light, and the lot before you book a showing.'
  const canonical =
    view === 'feed'
      ? `${siteUrl}/videos?view=feed`
      : city
        ? `${siteUrl}/videos?city=${encodeURIComponent(city)}`
        : `${siteUrl}/videos`
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
      images: [{ url: ogImage, width: 1200, height: 630, alt: 'Video tours of homes for sale | Ryan Realty' }],
    },
    twitter: { card: 'summary_large_image', images: [ogImage] },
  }
}

export default async function VideosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const city = resolveCity(sp.city)
  const view = resolveView(sp.view)
  const startKey = resolveStart(sp.start)

  const filter = {
    status: 'active-and-pending' as const,
    hasVirtualTour: true,
    sort: 'newest' as const,
    limit: view === 'feed' ? 60 : 36,
  }
  const tiles: ListingTile[] = city ? await getCityListings(city, filter) : await getListingTiles(filter)

  const videoItems: HideAwareVideoItem[] = tiles
    .map((t): HideAwareVideoItem | null => {
      const card = tileToCardData(t, { kind: 'video', label: 'Video tour' })
      return card ? { card, ListingKey: t.listingKey, ListNumber: t.listNumber } : null
    })
    .filter((x): x is HideAwareVideoItem => x !== null)
  const cards: ListingCardData[] = videoItems.map((v) => v.card)
  const feedItems = tilesToFeedItems(tiles)

  const heading = city ? `Video tours of ${city} homes for sale` : 'Video tours of homes for sale'
  const canonicalUrl =
    view === 'feed'
      ? `${siteUrl}/videos?view=feed`
      : city
        ? `${siteUrl}/videos?city=${encodeURIComponent(city)}`
        : `${siteUrl}/videos`

  const absoluteUrl = (u: string | null | undefined): string | undefined => {
    if (!u) return undefined
    if (u.startsWith('http://') || u.startsWith('https://')) return u
    return `${siteUrl}${u.startsWith('/') ? '' : '/'}${u}`
  }

  const videoObjects = cards
    .map((c) => {
      const contentUrl = absoluteUrl(c.tourUrl)
      if (!contentUrl) return null
      const thumbnailUrl = absoluteUrl(c.photoUrl)
      return {
        '@context': 'https://schema.org',
        '@type': 'VideoObject',
        name: `Video tour · ${c.addressLine}`,
        description: `Video tour of ${c.addressLine}, ${c.cityLine}.`,
        ...(thumbnailUrl ? { thumbnailUrl } : {}),
        contentUrl,
        embedUrl: contentUrl,
        url: absoluteUrl(c.href),
      }
    })
    .filter((v): v is NonNullable<typeof v> => v !== null)

  const crumbTrail = city
    ? [
        { label: 'Home', href: '/' },
        { label: 'Video tours', href: '/videos' },
        { label: city },
      ]
    : [
        { label: 'Home', href: '/' },
        { label: 'Video tours' },
      ]

  const jsonLd = (
    <>
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: (city
              ? [
                  { name: 'Home', url: `${siteUrl}/` },
                  { name: 'Video tours', url: `${siteUrl}/videos` },
                  { name: city, url: canonicalUrl },
                ]
              : [
                  { name: 'Home', url: `${siteUrl}/` },
                  { name: 'Video tours', url: `${siteUrl}/videos` },
                ]
            ).map((item, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: item.name,
              item: item.url,
            })),
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: heading,
            description: city
              ? `Full video tours of homes for sale in ${city}, Oregon.`
              : 'Full video tours of homes for sale across Bend, Redmond, Sisters, and Central Oregon.',
            url: canonicalUrl,
          }),
        }}
      />
      {videoObjects.map((video) => (
        <script
          key={video.contentUrl}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(video) }}
        />
      ))}
    </>
  )

  if (view === 'feed') {
    return (
      <>
        <main className={V3_ROOT_CLASS}>
          <V3SectionTracker pageType="media" />
          {jsonLd}
          {feedItems.length > 0 ? (
            <>
              <V3Instrument
                id="feed"
                level={1}
                eyebrow={v3Text('Central Oregon')}
                headline={v3Text('Video tours of homes for sale')}
                figures={[
                  {
                    value: v3Text(String(feedItems.length)),
                    label: v3Text(
                      feedItems.length === 1 ? 'home with a video tour' : 'homes with a video tour',
                    ),
                    href: listingsBrowsePath(),
                  },
                ]}
                source={v3Text(
                  'live MLS through Oregon Data Share, active and pending listings that carry a video tour',
                )}
                action={{
                  label: v3Text('See homes for sale'),
                  href: listingsBrowsePath(),
                  variant: 'primary',
                }}
              />
              <VideoFeedClient items={feedItems} startKey={startKey} />
              <V3Quiet
                id="explore"
                heading="Tour the homes"
                items={[
                  { label: 'See homes for sale', href: listingsBrowsePath() },
                  { label: 'Value my home', href: valuationHref('/videos') },
                  { label: 'Grid of video tours', href: '/videos' },
                ]}
              />
            </>
          ) : (
            <V3Quiet
              id="feed"
              heading="Video tours of homes for sale"
              headingLevel={1}
              items={[
                {
                  kind: 'prose',
                  term: 'No video tours yet',
                  body: 'New tours land here as homes come on the market across Central Oregon.',
                },
                { label: 'See homes for sale', href: listingsBrowsePath() },
                { label: 'Value my home', href: valuationHref('/videos') },
              ]}
            />
          )}
        </main>
        {/* Outside <main> on purpose. HTML-AAM maps <footer> to role=contentinfo only
            when it is NOT nested in sectioning content, and <main> is sectioning
            content, so inside it the element is a generic and the page ships no
            contentinfo landmark. */}
        <V3Footer columns={V3_FOOTER_COLUMNS} />
      </>
    )
  }

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker pageType="media" />
        {jsonLd}
        <V3Breadcrumb trail={crumbTrail} />

        {cards.length > 0 ? (
          <V3Instrument
            id="tours"
            level={1}
            eyebrow={v3Text(city ? `${city}, Oregon` : 'Central Oregon')}
            headline={v3Text(heading)}
            figures={[
              {
                value: v3Text(String(cards.length)),
                label: v3Text(cards.length === 1 ? 'home with a video tour' : 'homes with a video tour'),
                href: listingsBrowsePath(),
              },
            ]}
            source={v3Text(
              'live MLS through Oregon Data Share, active and pending listings that carry a video tour',
            )}
            action={{
              label: v3Text('See homes for sale'),
              href: listingsBrowsePath(),
              variant: 'primary',
            }}
          />
        ) : (
          <V3Quiet
            id="tours"
            heading={heading}
            headingLevel={1}
            items={[
              {
                kind: 'prose',
                term: city ? `No ${city} video tours right now` : 'No video tours right now',
                body: 'New tours land here as homes come on the market.',
              },
              { label: 'See homes for sale', href: listingsBrowsePath() },
              { label: 'Value my home', href: valuationHref('/videos') },
            ]}
          />
        )}

        <nav aria-label="Filter video tours by city" className="flex flex-wrap items-center gap-2 px-4 py-4">
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

        {videoItems.length > 0 ? <HideAwareVideoGrid items={videoItems} /> : null}

        <V3Quiet
          id="explore"
          heading="Tour the homes"
          items={[
            { label: 'See homes for sale', href: listingsBrowsePath() },
            { label: 'Value my home', href: valuationHref('/videos') },
            { label: 'Vertical video feed', href: '/videos?view=feed' },
          ]}
        />
      </main>

      {/* Outside <main> on purpose. HTML-AAM maps <footer> to role=contentinfo only
          when it is NOT nested in sectioning content, and <main> is sectioning
          content, so inside it the element is a generic and the page ships no
          contentinfo landmark. */}
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
