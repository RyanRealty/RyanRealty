// @no-parity — derived subdivision page (no standalone mockup; reuses site-v2 blocks)
// brand-voice:exempt
/**
 * Subdivision detail page -- the page a resort/community "Subdivisions within"
 * card links to. A subdivision is a GIS plat inside a resort community (e.g.
 * "Tetherow Phase 3" inside Tetherow). This page shows the plat's authoritative
 * boundary on the map plus the homes for sale physically inside it.
 *
 * Data ONLY through @/lib/data: getGeoBoundaryMapData (boundary polygon + spatial
 * pins via listings_in_boundary, geoType='subdivision') and getListingTiles
 * (hydrate the pin keys into cards). No raw .from(). Gate G31/G8 compliant.
 *
 * A plat with no active listings still renders its boundary + a contact CTA --
 * individual plats frequently have zero active homes at a given moment.
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getGeoBoundaryMapData, getListingTiles } from '@/lib/data'
import { pageMetadata } from '@/lib/site/page-metadata'
import { BreadcrumbNav } from '@/components/site/BreadcrumbNav'
import { HeroBlock } from '@/components/site/HeroBlock'
import { CTABar } from '@/components/site/CTABar'
import { NeighborhoodMap } from '@/components/site/NeighborhoodMap'
import { Container } from '@/components/site/primitives'
import ListingCard, { type ListingCardData } from '@/components/site/ListingCard'
import { listingTileHref } from '@/lib/slug'
import { CONTACT } from '@/lib/brand/contact'

export const dynamicParams = true
export const revalidate = 60

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  return []
}

type Props = { params: Promise<{ slug: string }> }

/** Title-case a slug: "golf-homes-at-tetherow" -> "Golf Homes At Tetherow". */
function slugToTitle(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function tileToCard(tile: Awaited<ReturnType<typeof getListingTiles>>[number]): ListingCardData {
  const addressLine =
    [tile.streetNumber ?? '', tile.streetName ?? ''].filter(Boolean).join(' ') || 'Address on request'
  const cityParts: string[] = []
  if (tile.city) cityParts.push(tile.city + ', OR')
  if (tile.postalCode) cityParts.push(tile.postalCode)
  if (tile.subdivisionName) cityParts.push(tile.subdivisionName)
  return {
    listingKey: tile.listingKey,
    href: listingTileHref(tile),
    photoUrl: tile.photoUrl ?? null,
    price: tile.listPrice ?? null,
    addressLine,
    cityLine: cityParts.join(' · '),
    beds: tile.beds,
    baths: tile.baths,
    sqft: tile.sqft,
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const name = slugToTitle(slug)
  return pageMetadata({
    title: `${name} Homes for Sale | Bend, Oregon`,
    description: `Homes for sale in ${name}, a subdivision in Central Oregon. Boundary map and live listings from a local brokerage.`,
    path: `/subdivisions/${slug}`,
  })
}

export default async function SubdivisionPage({ params }: Props) {
  const { slug } = await params
  const name = slugToTitle(slug)

  const boundary = await getGeoBoundaryMapData({ geoType: 'subdivision', geoSlug: slug }).catch(
    () => ({ polygon: null, pins: [] }),
  )
  if (!boundary.polygon) notFound()

  const listingKeys = boundary.pins.map((p) => p.listingKey)
  const tiles =
    listingKeys.length > 0
      ? await getListingTiles({ listingKeys, status: 'active', limit: 24 }).catch(() => [])
      : []
  const cards: ListingCardData[] = tiles.map(tileToCard)

  const count = boundary.pins.length
  const lede =
    count > 0
      ? `${count} ${count === 1 ? 'home' : 'homes'} for sale in ${name}.`
      : `No active listings in ${name} right now. We can tell you the moment one comes up.`

  return (
    <main className="min-h-screen bg-background">
      <Container className="pt-3 pb-1">
        <BreadcrumbNav
          items={[
            { label: 'Home', href: '/' },
            { label: 'Communities', href: '/communities' },
            { label: name },
          ]}
        />
      </Container>

      <HeroBlock headline={`${name}, Oregon`} lede={lede} minHeight={420} />

      {/* Subdivision boundary + the homes physically inside it. */}
      <NeighborhoodMap
        polygons={[{ slug, name, geometry: boundary.polygon }]}
        listings={boundary.pins.map((p) => ({
          lat: p.lat,
          lng: p.lng,
          href: listingTileHref({ listingKey: p.listingKey }),
          price: p.price,
        }))}
        zoom={15}
        height={460}
        tone="muted"
      />

      {cards.length > 0 ? (
        <section className="border-t border-border bg-background py-10 md:py-14">
          <Container>
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                  {name}
                </p>
                <h2 className="text-2xl font-bold text-foreground">Homes for sale in {name}</h2>
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {cards.map((card) => (
                <ListingCard key={card.listingKey} listing={card} />
              ))}
            </div>
          </Container>
        </section>
      ) : null}

      <CTABar
        eyebrow={`Buying or selling in ${name}`}
        title="Local brokers. Specific numbers. No pressure."
        body={`We know ${name} and the wider Central Oregon market. If you want to know what is selling here and what it is worth, we will give you the real numbers.`}
        primary={{ href: '/contact', label: 'Meet the team' }}
        secondary={{ href: `tel:${CONTACT.phoneDirectTel}`, label: `Call ${CONTACT.phoneDirect}` }}
        tone="navy"
      />
    </main>
  )
}
