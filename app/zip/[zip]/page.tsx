/**
 * ZIP listings page (/zip/[zip]) — Wave 3 site-v2 rebuild.
 *
 * ZIPs carry no market data (no boundaries, no market_stats_cache rows), so
 * this is a pure "homes for sale in {zip}" listings page: hero + ListingCard
 * grid + CTA. Data through @/lib/data (getZipListings -> getListingTiles,
 * postal_code filter). No legacy ListingTile / app/actions.
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getZipListings } from '@/lib/data'
import { pageMetadata } from '@/lib/site/page-metadata'
import { BreadcrumbNav } from '@/components/site/BreadcrumbNav'
import { HeroBlock } from '@/components/site/HeroBlock'
import { CTABar } from '@/components/site/CTABar'
import ListingCard, { type ListingCardData } from '@/components/site/ListingCard'
import { Body, Container, Grid, Section } from '@/components/site/primitives'

type Params = { zip: string }

// Canonical ZIP codes Ryan Realty serves. dynamicParams=false keeps the route
// strict so a random ZIP 404s rather than SSG-ing an empty page.
const CANONICAL_ZIPS = new Set([
  '97701', '97702', '97703', // Bend
  '97756', // Redmond
  '97759', // Sisters
  '97739', // La Pine
  '97707', // Sunriver
  '97741', // Madras
  '97754', // Prineville
  '97760', // Terrebonne
])

export const dynamicParams = false
export const revalidate = 60

export async function generateStaticParams(): Promise<Array<{ zip: string }>> {
  return Array.from(CANONICAL_ZIPS).map((zip) => ({ zip }))
}

function normalizeZip(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 5)
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

function tileToCardData(tile: Awaited<ReturnType<typeof getZipListings>>[number]): ListingCardData {
  const addressLine =
    [tile.streetNumber ?? '', tile.streetName ?? ''].filter(Boolean).join(' ') || 'Address on request'
  const cityParts: string[] = []
  if (tile.city) cityParts.push(tile.city + ', OR')
  if (tile.postalCode) cityParts.push(tile.postalCode)
  if (tile.subdivisionName) cityParts.push(tile.subdivisionName)
  return {
    listingKey: tile.listingKey,
    href: `/listing/${tile.listingKey}`,
    photoUrl: tile.photoUrl ?? null,
    price: tile.listPrice ?? null,
    addressLine,
    cityLine: cityParts.join(' · '),
    beds: tile.beds,
    baths: tile.baths,
    sqft: tile.sqft,
    badge:
      tile.status === 'Coming Soon'
        ? { kind: 'new' as const, label: 'Coming Soon' }
        : tile.priceDropCount && tile.priceDropCount > 0
          ? { kind: 'drop' as const, label: 'Price reduced' }
          : undefined,
  }
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { zip: rawZip } = await params
  const zip = normalizeZip(rawZip)
  if (!CANONICAL_ZIPS.has(zip)) {
    return pageMetadata({ title: 'ZIP not found · Ryan Realty', description: 'This ZIP code is outside the Ryan Realty service area.', path: `/zip/${zip}`, noindex: true })
  }
  return pageMetadata({
    title: `Homes for sale in ${zip} · Ryan Realty`,
    description: `Browse active single-family listings in ZIP code ${zip}, Central Oregon, with photos, prices, and live updates from the MLS.`,
    path: `/zip/${zip}`,
  })
}

export default async function ZipPage({ params }: { params: Promise<Params> }) {
  const { zip: rawZip } = await params
  const zip = normalizeZip(rawZip)
  if (!CANONICAL_ZIPS.has(zip)) notFound()

  const tiles = await getZipListings(zip, { status: 'active', limit: 48 }).catch(() => [])
  const cards = tiles.map(tileToCardData)
  const prices = cards
    .map((c) => c.price)
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
  const med = median(prices)

  const ledeParts = [`${cards.length} active single-family listings in ${zip}.`]
  if (med != null) {
    ledeParts.push(`Median list price $${(Math.round(med / 1000) * 1000).toLocaleString()}.`)
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="bg-background border-b border-border py-3">
        <Container>
          <BreadcrumbNav
            items={[
              { label: 'Home', href: '/' },
              { label: 'Search', href: '/search' },
              { label: zip },
            ]}
            tone="on-light"
          />
        </Container>
      </div>

      <HeroBlock
        headline={`Homes for sale in ${zip}`}
        lede={ledeParts.join(' ')}
        photo={{
          src: '/brand/hero/hero-old-mill-master-4k.jpg',
          alt: 'Old Mill District drone view with the Deschutes River and the Cascade mountains.',
          priority: true,
        }}
        minHeight={360}
      />

      <Section padding="default" tone="default">
        <Container>
          {cards.length === 0 ? (
            <Body tone="muted">
              No active listings in ZIP {zip} right now. Inventory turns over weekly, so check back soon.
            </Body>
          ) : (
            <Grid cols={3} gap="default">
              {cards.map((c) => (
                <ListingCard key={c.listingKey} listing={c} />
              ))}
            </Grid>
          )}
        </Container>
      </Section>

      <CTABar
        eyebrow="Looking wider?"
        title="Search every home in Central Oregon."
        body="Filter by price, beds, baths, and more across Bend, Redmond, Sisters, Sunriver, and the surrounding communities."
        primary={{ href: '/search', label: 'Search all homes' }}
        secondary={{ href: '/contact', label: 'Talk to a broker' }}
        tone="navy"
      />
    </main>
  )
}
