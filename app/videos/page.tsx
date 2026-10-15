/**
 * /videos — video tours of homes for sale, on the v3 barrel.
 *
 * THE PAGE CONTRACT, carried across unchanged: generateMetadata (city-aware
 * title/description/canonical/OG), ItemList + BreadcrumbList + CollectionPage
 * JSON-LD, city chips as V3Button ghosts with aria-current,
 * revalidate 300, V3SectionTracker pageType="media".
 *
 * TOURS (2026-10-14). listing_tile_mv carries has_virtual_tour but no URL, so
 * every tile shipped tourUrl: null and the page emitted no VideoObject. The
 * tiles' real video and tour URLs now come from the MLS payload in one bounded
 * read (getListingMlsVideosByKeys), shaped exactly as the listing page shapes
 * them, cleaned of mail-scanner wrappers. A VideoObject is emitted only for a
 * YouTube or Vimeo player with a dated MLS record (publishListingVideoSchemas),
 * built through buildJsonLd.
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

import { siteOrigin } from '@/lib/site-origin'
import type { Metadata } from 'next'
import {
  getListingTiles,
  getCityListings,
  getListingMlsVideosByKeys,
  getListingVideoPlacesByKeys,
  type ListingTile,
  type ListingVideoPlace,
} from '@/lib/data'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import { buildJsonLd } from '@/lib/site/json-ld'
import { publishListingHeroVideo } from '@/lib/listing/publish-listing-hero-video'
import {
  listingVideoDescription,
  publishListingVideoSchemas,
  publishListingVideos,
} from '@/lib/listing/publish-listing-video-schema'
import { LISTING_MOSAIC_LEAD_PHOTO_SIZE, listingRowPhotoSrc } from '@/lib/listing/row-photo'
import type { VideoEmbed } from '@/lib/data/types/video'
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

const siteUrl = siteOrigin()
const ogImage = `${siteUrl}/api/og?type=default`

export const revalidate = 3600

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
  const flaggedTiles: ListingTile[] = city ? await getCityListings(city, filter) : await getListingTiles(filter)
  // The tiles' MLS videos, one bounded read (the tile MV has no URL). A failed
  // or slow read leaves the photo tiles as they were, never an error page.
  const mlsMedia = await withTimeoutFallback(
    getListingMlsVideosByKeys(flaggedTiles.map((t) => t.listingKey).filter(Boolean)),
    new Map<string, { videos: VideoEmbed[]; leadPhotoUrl: string | null }>(),
    6000,
    'videos:mls-media',
  )
  const enriched = flaggedTiles.map((t) => {
    const m = mlsMedia.get(t.listingKey)
    const videos = m?.videos ?? []
    // The walkthrough reel the listing page leads with, else any playable tour.
    const playable = publishListingHeroVideo(videos) ?? videos.find((v) => v.embedType !== 'link') ?? null
    const lead = m?.leadPhotoUrl ? listingRowPhotoSrc(m.leadPhotoUrl, LISTING_MOSAIC_LEAD_PHOTO_SIZE) : null
    return { tile: playable ? { ...t, tourUrl: playable.url } : t, videos, lead }
  })
  const tiles: ListingTile[] = enriched.map((e) => e.tile)
  // A VideoObject names the street line the listing page prints and credits
  // the brokerage; that read is only for the tiles whose video qualifies.
  const qualifying = enriched.filter((e) => publishListingVideos(e.videos, e.lead, 1).length > 0)
  const places =
    qualifying.length > 0
      ? await withTimeoutFallback(
          getListingVideoPlacesByKeys(qualifying.map((e) => e.tile.listingKey)),
          new Map<string, ListingVideoPlace>(),
          4000,
          'videos:places',
        )
      : new Map<string, ListingVideoPlace>()

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

  // One VideoObject per tile whose video is a YouTube or Vimeo player with a
  // dated MLS record; the listing page is the item's url.
  const hrefByKey = new Map(videoItems.map((v) => [v.ListingKey, v.card.href]))
  const videoObjects = qualifying.flatMap((e) => {
    const p = places.get(e.tile.listingKey)
    const href = hrefByKey.get(e.tile.listingKey)
    if (!p?.street || !href) return []
    const place = `${p.street}${p.city ? `, ${p.city}, OR` : ''}`
    return publishListingVideoSchemas({
      videos: e.videos,
      name: `Video tour of ${place}`,
      description: listingVideoDescription(place, p.listOfficeName),
      pageUrl: absoluteUrl(href) ?? href,
      leadPhotoUrl: e.lead,
      max: 1,
    }).map((schema) => buildJsonLd(schema))
  })

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
          key={String(video.embedUrl)}
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
