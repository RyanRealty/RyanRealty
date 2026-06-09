import Link from 'next/link'
import { Container, Section, Stack, Grid, Eyebrow, H2, Body } from '@/components/site/primitives'
import ListingCard, { type ListingCardData } from '@/components/site/ListingCard'
import { tileToCardData } from '@/lib/site/listing-card'
import {
  getCityListings,
  getCommunityListings,
  getNeighborhoodListings,
  getListingTiles,
  type ListingTile,
} from '@/lib/data'

/**
 * Site-wide "homes with video tours" section. Surfaces active listings that
 * carry a video / virtual tour (listing_tile_mv.has_virtual_tour) for a given
 * scope, as a strategic way to lead with the richest, highest-engagement
 * listings and pull visitors toward the listing-detail pages where the tour
 * plays. Self-fetching server component (mirrors FeaturedListings) so any
 * surface can drop it in with one line. Renders nothing when the scope has no
 * video homes, so it never shows an empty shell.
 *
 * Reads the FAST path (listing_tile_mv via the DAL), not the jsonb video tables,
 * so it stays sub-second on every surface.
 */

export type VideoHomesScope =
  | { kind: 'region' }
  | { kind: 'city'; city: string }
  | { kind: 'community'; subdivision: string }
  | { kind: 'neighborhood'; neighborhood: string }

async function fetchVideoTiles(scope: VideoHomesScope, fetchLimit: number): Promise<ListingTile[]> {
  const filter = {
    status: 'active-and-pending' as const,
    hasVirtualTour: true,
    sort: 'newest' as const,
    limit: fetchLimit,
  }
  switch (scope.kind) {
    case 'city':
      return getCityListings(scope.city, filter)
    case 'community':
      return getCommunityListings(scope.subdivision, filter)
    case 'neighborhood':
      return getNeighborhoodListings(scope.neighborhood, filter)
    case 'region':
    default:
      return getListingTiles(filter)
  }
}

export default async function VideoHomesSection({
  scope,
  limit = 8,
  excludeKey,
  viewAllHref,
  eyebrow = 'Video tours',
  heading,
  body,
  tone = 'default',
}: {
  scope: VideoHomesScope
  limit?: number
  /** Drop this listing from the grid (listing-detail "more video homes"). */
  excludeKey?: string
  /** Optional "see all video tours" link. */
  viewAllHref?: string
  eyebrow?: string
  heading?: string
  body?: string
  tone?: 'default' | 'muted'
}) {
  const tiles = await fetchVideoTiles(scope, (limit + (excludeKey ? 1 : 0)) * 2)
  const cards: ListingCardData[] = tiles
    .filter((t) => (excludeKey ? t.listingKey !== excludeKey && t.listNumber !== excludeKey : true))
    .map((t) => tileToCardData(t, { kind: 'video', label: 'Video tour' }))
    .filter((c): c is ListingCardData => c !== null)
    .slice(0, limit)

  // A grid of one looks broken; require a couple to justify the section.
  if (cards.length < 2) return null

  const h2 = heading ?? 'Walk through homes on video'
  const copy =
    body ??
    'Browse current listings with a full video tour. See the flow, the light, and the lot before you book a showing.'

  return (
    <Section padding="default" tone={tone} divider>
      <Container>
        <div className="mb-8 flex items-end justify-between gap-4">
          <Stack gap="tight">
            <Eyebrow>{eyebrow}</Eyebrow>
            <H2>{h2}</H2>
            <Body size="default" tone="muted">
              {copy}
            </Body>
          </Stack>
          {viewAllHref ? (
            <Link
              href={viewAllHref}
              className="hidden shrink-0 text-sm font-medium text-primary underline-offset-4 hover:underline sm:inline"
            >
              See all video tours
            </Link>
          ) : null}
        </div>
        <Grid cols={4} gap="default">
          {cards.map((card) => (
            <ListingCard key={card.listingKey} listing={card} />
          ))}
        </Grid>
      </Container>
      {/* AEO: the video-tour homes as a structured ItemList so an answer engine
          can surface "homes for sale with video tours in <area>". */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: h2,
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
    </Section>
  )
}
