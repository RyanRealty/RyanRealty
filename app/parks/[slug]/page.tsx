/**
 * /parks/[slug] — park detail page.
 *
 * Shows the park's official boundary polygon (from the `boundaries` table,
 * geo_type='park') on a map together with the REAL active single-family homes
 * for sale near it (from our own MLS listings, a ~1.5-mile bounding box), plus
 * a sourced description, amenities, and source attribution.
 *
 * Structure mirrors the /schools/[slug] template and the city content-page
 * template (app/cities/[slug]/page.tsx): BreadcrumbNav, hero heading, sourced
 * about + amenities, stat band, NeighborhoodMap (polygon + nearby-home pins),
 * ListingCard grid, cross-links, CTA. Data ONLY through @/lib/data (Gate G8).
 *
 * Park facts (blurb, amenities, acreage) are verified + cited in the registry,
 * never invented (CLAUDE.md §0). If a park ever has no polygon, the map frames
 * on the centroid + nearby homes only rather than drawing a wrong shape.
 */

import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import {
  getParkDetail,
  getParkBoundaryGeoJSON,
  type ParkHomeTile,
} from '@/lib/data'
import { CO_PARKS, getParkBySlug, type ParkType } from '@/data/co-parks'
import { pageMetadata } from '@/lib/site/page-metadata'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { BreadcrumbNav } from '@/components/site/BreadcrumbNav'
import { NeighborhoodMap } from '@/components/site/NeighborhoodMap'
import ListingCard, { type ListingCardData } from '@/components/site/ListingCard'
import { CTABar } from '@/components/site/CTABar'
import {
  Body,
  Caption,
  Container,
  Eyebrow,
  Grid,
  H1,
  H2,
  Price,
  Section,
  Stack,
  TabularNumber,
  TextLink,
} from '@/components/site/primitives'
import type { SchemaInput } from '@/lib/site/json-ld'
import { CONTACT } from '@/lib/brand/contact'

export const dynamicParams = false
export const revalidate = 300

const TYPE_LABEL: Record<ParkType, string> = {
  state: 'State park',
  city: 'City park',
  'natural-area': 'Natural area',
}

const MAX_CARDS = 12

type Props = { params: Promise<{ slug: string }> }

export function generateStaticParams(): Array<{ slug: string }> {
  return CO_PARKS.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  // Registry-only — the metadata needs no live data, so it never touches the
  // DB. That keeps a transient listings timeout from failing metadata
  // generation (and shaves a query off every render).
  const park = getParkBySlug(slug)
  if (!park) notFound()

  const typeLabel = TYPE_LABEL[park.type].toLowerCase()
  const desc = `${park.name} is a ${typeLabel} in ${park.city}, Central Oregon. See what is there and the homes for sale nearby, from Ryan Realty, a local Central Oregon brokerage.`

  return pageMetadata({
    title: `${park.name} | Central Oregon Parks`,
    description: desc,
    path: `/parks/${slug}`,
  })
}

function homeToCard(home: ParkHomeTile): ListingCardData {
  return {
    listingKey: home.listingKey,
    href: home.href,
    photoUrl: home.photoUrl,
    price: home.price,
    addressLine: home.addressLine,
    cityLine: home.cityLine,
    beds: home.beds,
    baths: home.baths,
    sqft: home.sqft,
  }
}

export default async function ParkDetailPage({ params }: Props) {
  const { slug } = await params

  // The park's core content (blurb, amenities, acreage) comes from the static
  // registry; only the nearby homes need the DB. A transient listings timeout
  // (Supabase 57014) must never fail the static build or 500 the page — degrade
  // to the park with zero homes (which already has its own empty state) and let
  // ISR retry on the next revalidate. getParkDetail returns null for an unknown
  // slug and throws on a DB error; the registry lookup tells the two apart, so a
  // real 404 still 404s while a transient timeout renders the park.
  const detail = await getParkDetail(slug).catch(() => null)
  const park = detail?.park ?? getParkBySlug(slug)
  if (!park) notFound()

  const homes = detail?.homes ?? []
  const stats = detail?.stats ?? { count: 0, medianListPrice: null }
  const nearbyParks =
    detail?.nearbyParks ?? CO_PARKS.filter((p) => p.slug !== park.slug && p.city === park.city)

  // The map frames the park's official boundary polygon, then renders the
  // nearby-home pins inside the same view. The polygon is the authoritative
  // shape; the pins are the verified homes from our listings. On a transient
  // boundary error we degrade to a point-only map (no polygon).
  const polygon = park.hasPolygon
    ? await getParkBoundaryGeoJSON(slug).catch(() => null)
    : null

  const mapPins = homes
    .filter((h) => typeof h.lat === 'number' && typeof h.lng === 'number')
    .map((h) => ({
      lat: h.lat as number,
      lng: h.lng as number,
      href: h.href,
      price: h.price,
    }))

  const typeLabel = TYPE_LABEL[park.type]

  // "See all homes" → search pre-filtered to the park's city (the search route
  // has no dedicated park filter).
  const seeAllHref = `/search?city=${encodeURIComponent(park.city)}`

  const cards = homes.slice(0, MAX_CARDS)

  // ── Structured data: Park + BreadcrumbList. additionalProperty carries only
  //    verified values (acreage + the home-count we actually computed). ──
  const additionalProperty: Array<{ name: string; value: string | number; unitText?: string }> = [
    { name: 'Homes for sale near this park', value: stats.count },
  ]
  if (typeof park.acres === 'number') {
    additionalProperty.push({ name: 'Area', value: park.acres, unitText: 'acre' })
  }
  if (stats.medianListPrice != null) {
    additionalProperty.push({
      name: 'Median list price of nearby homes',
      value: stats.medianListPrice,
      unitText: 'USD',
    })
  }

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Parks', url: '/parks' },
        { name: park.name, url: `/parks/${slug}` },
      ],
    },
    {
      type: 'place',
      placeType: 'Park',
      name: park.name,
      description: park.blurb,
      url: `/parks/${slug}`,
      address: { city: park.city, state: 'OR', country: 'US' },
      geo: { lat: park.lat, lng: park.lng },
      additionalProperty,
    },
  ]

  return (
    <main className="min-h-screen bg-background">
      <MetadataBlock schemas={schemas} />

      <Container className="pt-3 pb-1">
        <BreadcrumbNav
          includeJsonLd={false}
          items={[
            { label: 'Home', href: '/' },
            { label: 'Parks', href: '/parks' },
            { label: park.name },
          ]}
        />
      </Container>

      {/* Hero heading */}
      <Section padding="default">
        <Container>
          <Stack gap="default" className="max-w-prose">
            <Eyebrow>
              {typeLabel} · {park.city}
            </Eyebrow>
            <H1>{park.name}</H1>
            <Body tone="muted">{park.blurb}</Body>
          </Stack>
        </Container>
      </Section>

      {/* About — amenities + source attribution. Every fact traces to sourceUrl. */}
      <Section padding="default" divider>
        <Container>
          <Stack gap="loose">
            <div>
              <Eyebrow>What is here</Eyebrow>
              <H2 className="mt-1.5">Amenities at {park.name}</H2>
            </div>

            <ul className="grid w-full grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
              {park.amenities.map((amenity) => (
                <li
                  key={amenity}
                  className="flex items-start gap-2 text-sm text-foreground"
                >
                  <span aria-hidden className="mt-1 text-primary">
                    ·
                  </span>
                  <span>{amenity}</span>
                </li>
              ))}
            </ul>

            <Caption tone="muted">
              Park information: {park.agency}
              {' · '}
              <TextLink href={park.sourceUrl} external>
                View source
              </TextLink>
            </Caption>
          </Stack>
        </Container>
      </Section>

      {/* Stat band — verified facts only */}
      <Section padding="tight" tone="muted" divider>
        <Container>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {typeof park.acres === 'number' ? (
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <Eyebrow className="text-muted-foreground">Park size</Eyebrow>
                <div className="mt-1.5 text-3xl font-bold tracking-[-0.01em] text-foreground">
                  <TabularNumber value={park.acres} />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">Acres</div>
              </div>
            ) : null}
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <Eyebrow className="text-muted-foreground">Homes for sale</Eyebrow>
              <div className="mt-1.5 text-3xl font-bold tracking-[-0.01em] text-foreground">
                <TabularNumber value={stats.count} />
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Active single-family homes near this park
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <Eyebrow className="text-muted-foreground">Median list price</Eyebrow>
              <div className="mt-1.5 text-3xl font-bold tracking-[-0.01em] text-foreground">
                <Price value={stats.medianListPrice} />
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Across those homes, rounded to the nearest thousand
              </div>
            </div>
          </div>
        </Container>
      </Section>

      {/* Map — park boundary polygon + nearby-home pins */}
      {polygon ? (
        <NeighborhoodMap
          eyebrow={park.city}
          title={`${park.name} and homes nearby`}
          intro={`The park boundary plus the active single-family homes for sale within roughly 1.5 miles, from our listings.`}
          polygons={[
            {
              slug: park.slug,
              name: park.name,
              geometry: polygon,
            },
          ]}
          listings={mapPins}
          zoom={13}
          height={520}
          tone="default"
        />
      ) : null}

      {/* Home cards */}
      {cards.length > 0 ? (
        <Section padding="default" tone="muted" divider>
          <Container>
            <Stack gap="loose">
              <div>
                <Eyebrow>Homes for sale</Eyebrow>
                <H2 className="mt-1.5">Homes near {park.name}</H2>
              </div>
              <Grid cols={3} gap="loose" className="w-full">
                {cards.map((home) => (
                  <ListingCard key={home.listingKey} listing={homeToCard(home)} />
                ))}
              </Grid>
              {stats.count > cards.length ? (
                <TextLink href={seeAllHref}>
                  See more homes in {park.city} →
                </TextLink>
              ) : null}
            </Stack>
          </Container>
        </Section>
      ) : (
        <Section padding="default" divider>
          <Container>
            <Stack gap="default" className="max-w-prose">
              <H2>No active homes near this park right now</H2>
              <Body tone="muted">
                There are no active single-family listings within about 1.5 miles of {park.name} at
                the moment. Inventory changes often. Browse current homes in {park.city} to see what
                is on the market today.
              </Body>
              <TextLink href={`/search?city=${encodeURIComponent(park.city)}`}>
                Browse homes in {park.city} →
              </TextLink>
            </Stack>
          </Container>
        </Section>
      )}

      {/* Other parks in the same city */}
      {nearbyParks.length > 0 ? (
        <Section padding="default" divider>
          <Container>
            <Stack gap="loose">
              <div>
                <Eyebrow>More parks</Eyebrow>
                <H2 className="mt-1.5">Other parks in {park.city}</H2>
              </div>
              <ul className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {nearbyParks.map((p) => (
                  <li key={p.slug}>
                    <Link
                      href={`/parks/${p.slug}`}
                      className="block rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md"
                    >
                      <div className="text-base font-bold tracking-[-0.01em] text-foreground">
                        {p.name}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {TYPE_LABEL[p.type]}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
              <TextLink href="/parks">All Central Oregon parks →</TextLink>
            </Stack>
          </Container>
        </Section>
      ) : (
        <Section padding="default" divider>
          <Container>
            <TextLink href="/parks">All Central Oregon parks →</TextLink>
          </Container>
        </Section>
      )}

      <CTABar
        eyebrow={`Living near ${park.name}`}
        title="Local brokers. Specific numbers. No pressure."
        body={`We work across ${park.city} and the rest of Central Oregon. Tell us what matters to you, the trails, the river, room to roam, and we will show you the homes that fit.`}
        primary={{ href: '/contact', label: 'Meet the team' }}
        secondary={{ href: `tel:${CONTACT.phoneDirectTel}`, label: `Call ${CONTACT.phoneDirect}` }}
        tone="navy"
      />
    </main>
  )
}
