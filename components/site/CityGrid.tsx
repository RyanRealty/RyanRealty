import Image from 'next/image'
import Link from 'next/link'
import { getCitiesForIndex } from '@/app/actions/cities'
import { getGeoTileImages } from '@/lib/data'
import { pickGeoImage } from '@/lib/geo-images'
import {
  Body,
  Container,
  Eyebrow,
  Grid,
  H2,
  MiddleDot,
  Price,
  Section,
  Stack,
  TabularNumber,
} from '@/components/site/primitives'

/**
 * Site v2 city grid — 8 city photo cards with median + active count + community
 * count. Mirrors design_system/ryan-realty/ui_kits/website/index.html §cities.
 *
 * Data accuracy: every figure traces to geo_snapshot_mv via getCitiesForIndex().
 * Unavailable values render as em-dash via the Price primitive's fallback.
 *
 * Imagery (D86): the photo on each card comes from the canonical asset_library
 * store via getGeoTileImages(), seeded per city by pickGeoImage(). Never the
 * fake hero_image_url stock columns. Same source the city-page tiles use.
 */

// 8 mockup-aligned cities. Order matches market relevance for Central Oregon.
const CITY_ORDER = [
  'bend',
  'redmond',
  'sisters',
  'sunriver',
  'la-pine',
  'tumalo',
  'prineville',
  'terrebonne',
] as const

type CityCardData = {
  slug: string
  name: string
  medianPrice: number | null
  activeCount: number
  communityCount: number
}

function CityCard({ city, imageUrl }: { city: CityCardData; imageUrl: string | null }) {
  return (
    <Link
      href={`/cities/${city.slug}`}
      className="group block bg-card border border-border rounded-xl overflow-hidden shadow-sm hover:border-primary/30 hover:shadow-md transition"
    >
      <div className="relative aspect-video overflow-hidden bg-primary">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={city.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
        ) : null}
        <div
          className="absolute inset-0 bg-gradient-to-t from-primary via-primary/25 to-transparent"
          aria-hidden
        />
        <div className="absolute inset-x-0 bottom-0 p-4">
          <div className="text-lg font-bold tracking-tight text-white drop-shadow">{city.name}</div>
        </div>
      </div>
      <div className="p-4">
        <div className="text-sm font-semibold text-foreground">
          <Price value={city.medianPrice} />
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {city.activeCount > 0 ? (
            <>
              <TabularNumber value={city.activeCount} /> active
            </>
          ) : (
            'No active listings'
          )}
          {city.communityCount > 0 ? (
            <>
              {' '}
              <MiddleDot className="text-muted-foreground/60" />{' '}
              <TabularNumber value={city.communityCount} /> communities
            </>
          ) : null}
        </div>
      </div>
    </Link>
  )
}

export default async function CityGrid() {
  const [cities, geoImages] = await Promise.all([
    getCitiesForIndex().catch(() => []),
    getGeoTileImages([...CITY_ORDER]).catch(() => ({})),
  ])
  const bySlug = new Map(cities.map((c) => [c.slug, c]))
  const ordered = CITY_ORDER.map((slug) => bySlug.get(slug)).filter(
    (c): c is NonNullable<typeof c> => c != null,
  )

  // If geo_snapshot_mv is empty for some reason, fall back to whatever we got.
  const shown = ordered.length > 0 ? ordered : cities.slice(0, 8)

  if (shown.length === 0) {
    return null
  }

  const cityImage = (slug: string): string | null =>
    pickGeoImage(geoImages[slug], slug) ?? pickGeoImage(geoImages['central-oregon'], slug)

  return (
    <Section padding="default" tone="muted" divider>
      <Container>
        <Stack gap="tight" className="mb-6">
          <Eyebrow>Communities</Eyebrow>
          <H2>Search by city</H2>
          <Body size="small" tone="muted">
            Eleven Central Oregon communities. Median prices refreshed daily.
          </Body>
        </Stack>

        <Grid cols={4} gap="default">
          {shown.map((c) => (
            <CityCard key={c.slug} city={c} imageUrl={cityImage(c.slug)} />
          ))}
        </Grid>
      </Container>
    </Section>
  )
}
