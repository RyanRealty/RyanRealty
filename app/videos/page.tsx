/**
 * /videos — video tours of homes for sale, on the v3 barrel.
 *
 * THE PAGE CONTRACT, carried across unchanged: generateMetadata (city-aware
 * title/description/canonical/OG), ItemList + BreadcrumbList + CollectionPage
 * JSON-LD, one VideoObject per embeddable tour (raw <script>, VideoObject is
 * not in SchemaInput), city chips as V3Button ghosts with aria-current,
 * revalidate 300, V3SectionTracker pageType="media".
 *
 * LEFTOVERS, not v3 atoms: HideAwareVideoGrid (inline play) and VideoFeedClient
 * (vertical feed at ?view=feed). No video-grid atom exists. Those two are the
 * page's ENTIRE remaining non-v3 count; the third, a type-only import of
 * ListingCardData, went on 2026-08-26 because the value it annotated already
 * carried that type.
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
import { getListingTiles, getCityListings, type ListingTile } from '@/lib/data'
import { tileToCardData } from '@/lib/site/listing-card'
import { listingsBrowsePath } from '@/lib/slug'
import { valuationHref } from '@/lib/site/valuation-href'
import HideAwareVideoGrid, { type HideAwareVideoItem } from '@/components/site/HideAwareVideoGrid'
import { VideoFeedClient } from '@/components/site/VideoFeedClient'
import {
  V3_ROOT_CLASS,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Quiet,
  V3SectionTracker,
  V3SourceLine,
} from '@/components/site/v3'
import { resolveCity, resolveView, resolveStart } from './_v3/videos-constants'
import { tilesToFeedItems } from './_v3/feed-items'
import { VideosOpening } from './_v3/VideosOpening'

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
  // Inferred, not annotated. HideAwareVideoItem['card'] IS ListingCardData, so
  // the annotation bought nothing and cost this page an import from the flat
  // legacy register — one more non-v3 import site on the ci:public-ui ledger for
  // a type the value already carries.
  const cards = videoItems.map((v) => v.card)
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
          <V3SectionTracker />
          {jsonLd}
          {feedItems.length > 0 ? (
            <>
              <VideosOpening
                heading="Video tours of homes for sale"
                city={null}
                count={feedItems.length}
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
        <V3SectionTracker />
        {jsonLd}
        <V3Breadcrumb trail={crumbTrail} />

        <VideosOpening heading={heading} city={city} count={cards.length} />

        {videoItems.length > 0 ? (
          <>
            <HideAwareVideoGrid items={videoItems} />
            <V3SourceLine source="live MLS through Oregon Data Share, homes on this page that carry a video tour" />
          </>
        ) : (
          <V3Quiet
            id="tours"
            heading="Tour the homes"
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
