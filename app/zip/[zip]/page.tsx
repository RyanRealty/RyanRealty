/**
 * ZIP listings page (/zip/[zip]) — Wave 3 site-v2 rebuild, full mockup
 * fidelity (design_system/ryan-realty/ui_kits/zip/index.html).
 *
 * Section order matches the mockup: breadcrumb, hero, "what's in this ZIP"
 * subdivision grid, ZIP-level market snapshot, active-listings grid, "other
 * ZIPs we serve" grid, dual CTA.
 *
 * Data accuracy (CLAUDE.md §0): ZIP codes have NO market_pulse_live /
 * market_stats_cache rows (those are keyed by city + region), so every stat is
 * derived live from the listing_tile_mv tiles returned by ONE getZipListings
 * call (propertyType 'A' = the codebase SFR convention). The subdivision grid
 * is grouped from those same tiles. Nothing is fabricated. Reads go through
 * @/lib/data only; no app/actions, no raw .from().
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getZipListings, getSurfaceImage } from '@/lib/data'
import { listingTileHref } from '@/lib/slug'
import { pageMetadata } from '@/lib/site/page-metadata'
import { BreadcrumbNav } from '@/components/site/BreadcrumbNav'
import { HeroBlock } from '@/components/site/HeroBlock'
import { RelatedAreas, type RelatedAreaItem } from '@/components/site/RelatedAreas'
import { ZipMarketStats, type ZipMarketStatsData } from '@/components/site/ZipMarketStats'
import CtaDuo from '@/components/site/CtaDuo'
import ListingCard, { type ListingCardData } from '@/components/site/ListingCard'
import { Body, Container, Eyebrow, Grid, H2, Section, Stack } from '@/components/site/primitives'

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

// Service-area labels for the "other ZIPs we serve" cross-nav grid. These are
// verified geography facts (which city/area each ZIP covers), human-authored.
const ZIP_AREA: Record<string, string> = {
  '97701': 'Bend NE',
  '97702': 'Bend SE',
  '97703': 'Bend West',
  '97707': 'Sunriver',
  '97739': 'La Pine',
  '97741': 'Madras',
  '97754': 'Prineville',
  '97756': 'Redmond',
  '97759': 'Sisters',
  '97760': 'Terrebonne',
}

const SUBDIVISION_NOISE = new Set(['', 'n/a', 'none', 'unknown', 'other'])
const SHOWN_LISTINGS = 24

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
    href: listingTileHref(tile),
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
    description: `Browse active single-family listings in ZIP code ${zip}, Central Oregon, with photos, prices, a live ZIP market snapshot, and the neighborhoods inside the code.`,
    path: `/zip/${zip}`,
  })
}

export default async function ZipPage({ params }: { params: Promise<Params> }) {
  const { zip: rawZip } = await params
  const zip = normalizeZip(rawZip)
  if (!CANONICAL_ZIPS.has(zip)) notFound()

  // Distinct approved Central Oregon hero, seeded by ZIP so it is stable per
  // page but varies across ZIPs (instead of reusing the Old Mill banner).
  const zipHero = await getSurfaceImage('hero', {
    geoTags: ['central-oregon'],
    seed: `zip-${zip}`,
    fallback: '/brand/hero/hero-old-mill-master-4k.jpg',
  })

  // ONE fetch feeds the hero lede, the subdivision grid, the market snapshot,
  // and the listing grid. propertyType 'A' = the codebase SFR convention.
  // limit is the MV cap (5000) so the active count + medians + subdivision
  // counts are the TRUE totals for the ZIP, not a sampled slice — no ZIP has
  // anywhere near 5000 active SFR, so this fetches the whole code. Per
  // CLAUDE.md §0 we never report a fetch cap as if it were the real count.
  const tiles = await getZipListings(zip, { status: 'active', propertyType: 'A', limit: 5000 }).catch(
    () => [] as Awaited<ReturnType<typeof getZipListings>>,
  )

  const activeCount = tiles.length
  const listPrices = tiles
    .map((t) => t.listPrice)
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0)
  const pricePerSqfts = tiles
    .map((t) => t.pricePerSqft)
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0)
  const doms = tiles
    .map((t) => t.dom)
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0)

  const medianListPrice = median(listPrices)
  const medianPricePerSqft = median(pricePerSqfts)
  const medianDom = median(doms)

  const now = Date.now()
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
  const newLast30Days = tiles.filter((t) => {
    if (!t.onMarketDate) return false
    const d = Date.parse(t.onMarketDate)
    return Number.isFinite(d) && now - d >= 0 && now - d <= THIRTY_DAYS_MS
  }).length

  const stats: ZipMarketStatsData = {
    zip,
    activeCount,
    medianListPrice,
    medianPricePerSqft,
    newLast30Days,
  }

  // Subdivision cross-nav, derived from the same tiles (verified counts).
  const subCounts = new Map<string, number>()
  for (const t of tiles) {
    const name = (t.subdivisionName ?? '').trim()
    if (!name || SUBDIVISION_NOISE.has(name.toLowerCase())) continue
    subCounts.set(name, (subCounts.get(name) ?? 0) + 1)
  }
  const subItems: RelatedAreaItem[] = [...subCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({
      name,
      href: `/search?keywords=${encodeURIComponent(name)}`,
      activeCount: count,
    }))

  // Other canonical ZIPs we serve (static service-area facts).
  const otherZips: RelatedAreaItem[] = [...CANONICAL_ZIPS]
    .filter((z) => z !== zip)
    .map((z) => ({ name: `${z} · ${ZIP_AREA[z] ?? 'Central Oregon'}`, href: `/zip/${z}` }))

  const cards = tiles.map(tileToCardData)
  const shownCards = cards.slice(0, SHOWN_LISTINGS)

  const ledeParts = [`${activeCount} active single-family ${activeCount === 1 ? 'listing' : 'listings'} in ${zip}.`]
  if (medianListPrice != null) {
    ledeParts.push(`Median list price $${(Math.round(medianListPrice / 1000) * 1000).toLocaleString()}.`)
  }
  if (medianDom != null) {
    ledeParts.push(`Median ${Math.round(medianDom)} days on market.`)
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
          src: zipHero ?? '/brand/hero/hero-old-mill-master-4k.jpg',
          alt: 'Central Oregon high desert and Cascade mountains.',
          priority: true,
        }}
        minHeight={360}
      />

      <RelatedAreas
        eyebrow={`Neighborhoods and communities in ${zip}`}
        title="What's in this ZIP"
        items={subItems}
        tone="default"
        cols={4}
        viewAllHref={`/search?keywords=${encodeURIComponent(zip)}`}
        viewAllLabel="All homes in this ZIP →"
      />

      <ZipMarketStats stats={stats} />

      <Section padding="default" tone="default" divider>
        <Container>
          <div className="mb-6 flex items-end justify-between gap-4">
            <Stack gap="tight" className="max-w-prose">
              <Eyebrow>Available now</Eyebrow>
              <H2>All active homes in {zip}</H2>
              <Body size="small" tone="muted">
                {activeCount > 0
                  ? `Showing ${Math.min(SHOWN_LISTINGS, activeCount)} of ${activeCount}.`
                  : `No active listings in ${zip} right now. Inventory turns over weekly, so check back soon.`}
              </Body>
            </Stack>
            <Link
              href="/search"
              className="shrink-0 text-sm font-medium text-primary underline-offset-2 hover:underline"
            >
              Open map search →
            </Link>
          </div>
          {shownCards.length > 0 ? (
            <Grid cols={3} gap="default">
              {shownCards.map((c) => (
                <ListingCard key={c.listingKey} listing={c} />
              ))}
            </Grid>
          ) : null}
        </Container>
      </Section>

      <RelatedAreas
        eyebrow="Other Central Oregon ZIPs we serve"
        title="Looking elsewhere in Central Oregon"
        items={otherZips}
        tone="muted"
        cols={4}
      />

      <CtaDuo />
    </main>
  )
}
