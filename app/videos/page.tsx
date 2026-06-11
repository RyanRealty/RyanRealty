import type { Metadata } from 'next'
import Link from 'next/link'
import { getListingTiles, getCityListings, type ListingTile } from '@/lib/data'
import { tileToCardData } from '@/lib/site/listing-card'
import VideoListingCard from '@/components/site/VideoListingCard'
import type { ListingCardData } from '@/components/site/ListingCard'
import { PageBreadcrumb } from '@/components/site/PageBreadcrumb'
import { Container, Section, Stack, Grid, Eyebrow, H1, Body } from '@/components/site/primitives'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * /videos — "Watch homes on video" destination.
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

  const heading = city ? `Watch ${city} homes on video` : 'Watch homes on video'
  const lede = city
    ? `Current ${city} listings with a full video tour. Press play and walk the home from anywhere.`
    : 'Current Central Oregon listings with a full video tour. Press play and walk the home from anywhere, then book a showing when one feels right.'
  const canonicalUrl = city ? `${siteUrl}/videos?city=${encodeURIComponent(city)}` : `${siteUrl}/videos`

  return (
    <main className="min-h-screen bg-background">
      <PageBreadcrumb trail={[...(city ? [{ label: 'Video tours', href: '/videos' }, { label: city }] : [{ label: 'Video tours' }])]} />

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

      <Section padding="default">
        <Container>
          <Stack gap="default">
            <Stack gap="tight">
              <Eyebrow>Video tours</Eyebrow>
              <H1>{heading}</H1>
              <Body size="large">{lede}</Body>
            </Stack>

            {/* City filter chips — design-system Button (asChild Link). The active
                city is the solid primary variant; the rest are outline. "All" clears
                the filter back to the region-wide grid. */}
            <nav aria-label="Filter video tours by city" className="flex flex-wrap gap-2">
              <Button
                asChild
                size="sm"
                variant={city ? 'outline' : 'default'}
                className="rounded-full"
              >
                <Link href="/videos" aria-current={city ? undefined : 'page'}>
                  All Central Oregon
                </Link>
              </Button>
              {CITY_CHIPS.map((c) => {
                const active = c === city
                return (
                  <Button
                    key={c}
                    asChild
                    size="sm"
                    variant={active ? 'default' : 'outline'}
                    className={cn('rounded-full', active && 'pointer-events-none')}
                  >
                    <Link href={`/videos?city=${encodeURIComponent(c)}`} aria-current={active ? 'page' : undefined}>
                      {c}
                    </Link>
                  </Button>
                )
              })}
            </nav>
          </Stack>

          {cards.length > 0 ? (
            <Grid cols={4} gap="default" className="mt-10">
              {cards.map((card) => (
                <VideoListingCard key={card.listingKey} listing={card} />
              ))}
            </Grid>
          ) : (
            <div className="mt-12 rounded-xl border border-border bg-card p-10 text-center">
              <Body tone="primary" className="font-medium">
                {city
                  ? `No ${city} listings have a video tour right now.`
                  : 'No listings have a video tour right now.'}
              </Body>
              <Body size="small" className="mt-2">
                New tours are added as listings come on the market.{' '}
                <Link href="/homes-for-sale" className="text-primary underline-offset-4 hover:underline">
                  Browse every home for sale
                </Link>
                .
              </Body>
            </div>
          )}
        </Container>
      </Section>
    </main>
  )
}
