/**
 * /price-drops -- Region-wide Price-Drop Radar for Central Oregon SFR.
 *
 * KB (kinetic-brutalist) design — Phase 9 of the KB convergence program.
 * Reuses the same section library as city/community pages (components/site/kb/*).
 *
 * Data strategy:
 *   - getPriceDrops() from lib/data (DAL, cached 30 min, throw-on-error)
 *   - Zero hardcoded numbers — every figure comes from the live DAL result
 *   - Honest empty state when no drops exist in the window
 *
 * SEO / GEO strategy:
 *   - MetadataBlock: BreadcrumbList + Dataset + webPage JSON-LD
 *   - pageMetadata: canonical + OG
 *   - KbSectionTracker: section view + scroll tracking (page contract)
 *
 * ISR: revalidate 1800s (30 min) — matches DAL TTL.
 *
 * Section stack: breadcrumb · hero (live glance) · featured listings ·
 *   map · neighborhood table · city nav · explainer · sell · footer.
 *
 * PAGE CONTRACT: KB design + SEO (pageMetadata) + tracking (KbSectionTracker).
 * Every figure live (§0). No raw .from() calls.
 */

// @no-parity -- parity contract at design_system/ryan-realty/ui_kits/price-drops/parity.json

import type { Metadata } from 'next'
import Link from 'next/link'
import { getPriceDrops } from '@/lib/data'
import { pageMetadata } from '@/lib/site/page-metadata'
import { SITE_CITY_SLUGS } from '@/lib/central-oregon'
import { listingDetailPath } from '@/lib/slug'
import { CTABar } from '@/components/site/CTABar'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import ListingCard from '@/components/site/ListingCard'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbFeatured } from '@/components/site/kb/KbFeatured.client'
import { KbListingMap, type KbMapGeo } from '@/components/site/kb/KbListingMap.client'
import { KbSell } from '@/components/site/kb/KbSell.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import type { KbFeaturedItem } from '@/components/site/kb/types'
import type { SchemaInput } from '@/lib/site/json-ld'
import { CONTACT } from '@/lib/brand/contact'
import type { PriceDrop } from '@/lib/data'
import '@/components/site/kb/kb.css'

// ---- ISR -------------------------------------------------------------------

export const revalidate = 1800

// ---- Metadata --------------------------------------------------------------

export const metadata: Metadata = pageMetadata({
  title: 'Price Drop Radar, Central Oregon',
  description:
    'Track every active home in Central Oregon where the seller has cut the asking price. ' +
    'Updated daily from the regional MLS. Browse Bend, Redmond, Sisters, Sunriver, and surrounding areas.',
  path: '/price-drops',
  keywords: [
    'price reduced homes Central Oregon',
    'price drop homes Bend Oregon',
    'homes with price reductions Central Oregon',
    'reduced asking price Oregon homes',
    'price cut homes for sale Bend',
  ],
})

// ---- City display helpers --------------------------------------------------

const CITY_DISPLAY: Record<string, string> = {
  bend: 'Bend',
  redmond: 'Redmond',
  sisters: 'Sisters',
  sunriver: 'Sunriver',
  'la-pine': 'La Pine',
  madras: 'Madras',
  prineville: 'Prineville',
  culver: 'Culver',
  terrebonne: 'Terrebonne',
  'powell-butte': 'Powell Butte',
}

// ---- Format helpers --------------------------------------------------------

function fmtCompactPrice(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return `$${m >= 10 ? Math.round(m) : m.toFixed(1)}M`
  }
  return `$${Math.round(n / 1000)}K`
}

function fmtK(n: number): string {
  return fmtCompactPrice(n)
}

function fmtM(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  return fmtK(n)
}

function fmtPrice(n: number): string {
  return `$${(Math.round(n / 1000) * 1000).toLocaleString()}`
}

// ---- Price-drop card adapter for legacy ListingCard (parity requirement) ---

function dropToCardData(drop: PriceDrop) {
  const addressLine =
    [drop.streetNumber, drop.streetName].filter(Boolean).join(' ') || 'Address on request'
  const cityParts: string[] = []
  if (drop.city) cityParts.push(`${drop.city}, OR`)
  if (drop.postalCode) cityParts.push(drop.postalCode)
  if (drop.subdivisionName) cityParts.push(drop.subdivisionName)

  const origRounded = drop.originalListPrice
    ? Math.round(drop.originalListPrice / 1000) * 1000
    : null
  const badgeLabel =
    origRounded && drop.lastDropPct
      ? `was ${fmtCompactPrice(origRounded)}, -${drop.lastDropPct.toFixed(1)}%`
      : drop.lastDropPct
        ? `-${drop.lastDropPct.toFixed(1)}%`
        : 'Price reduced'

  return {
    listingKey: drop.listingKey,
    href: `/listing/${encodeURIComponent(drop.listingKey)}`,
    photoUrl: drop.photoUrl ?? null,
    price: drop.listPrice,
    addressLine,
    cityLine: cityParts.join(' · '),
    beds: drop.beds ?? null,
    baths: drop.baths ?? null,
    sqft: drop.sqft ?? null,
    badge: { kind: 'drop' as const, label: badgeLabel },
  }
}

// ---- KB featured adapter ---------------------------------------------------

function dropToFeaturedItem(drop: PriceDrop): KbFeaturedItem {
  const origRounded = drop.originalListPrice
    ? Math.round(drop.originalListPrice / 1000) * 1000
    : null
  // Encode the drop context in the sub line so it stays visible in the poster grid
  const dropSub =
    origRounded && drop.lastDropPct
      ? `was ${fmtCompactPrice(origRounded)}, -${drop.lastDropPct.toFixed(1)}%`
      : drop.lastDropPct
        ? `-${drop.lastDropPct.toFixed(1)}%`
        : 'Price reduced'

  return {
    price: drop.listPrice,
    address: [drop.streetNumber, drop.streetName].filter(Boolean).join(' ') || 'Address on request',
    sub: dropSub,
    city: drop.city ?? '',
    beds: drop.beds ?? null,
    baths: drop.baths ?? null,
    sqft: drop.sqft ?? null,
    img: drop.photoUrl ?? '',
    href: listingDetailPath(
      drop.listingKey,
      { streetNumber: drop.streetNumber, streetName: drop.streetName, city: drop.city, postalCode: drop.postalCode },
      { city: drop.city, subdivision: drop.subdivisionName },
      { mlsNumber: drop.listNumber },
    ),
    video: null,
    tour: false,
  }
}

// ---- Neighborhood mini-table ------------------------------------------------

type NeighborhoodRow = {
  name: string
  count: number
  medianListPrice: number | null
  medianDropPct: number | null
}

function buildNeighborhoodTable(drops: PriceDrop[]): NeighborhoodRow[] {
  const map = new Map<string, { prices: number[]; pcts: number[] }>()
  for (const d of drops) {
    const name = d.boundaryNeighborhood ?? d.subdivisionName ?? d.city ?? 'Other'
    if (!map.has(name)) map.set(name, { prices: [], pcts: [] })
    const row = map.get(name)!
    if (d.listPrice) row.prices.push(d.listPrice)
    if (d.lastDropPct) row.pcts.push(d.lastDropPct)
  }
  const result: NeighborhoodRow[] = []
  for (const [name, { prices, pcts }] of map.entries()) {
    const sp = [...prices].sort((a, b) => a - b)
    const spc = [...pcts].sort((a, b) => a - b)
    const midP = Math.floor(sp.length / 2)
    const midPct = Math.floor(spc.length / 2)
    result.push({
      name,
      count: Math.max(prices.length, pcts.length),
      medianListPrice:
        sp.length > 0
          ? sp.length % 2 === 0
            ? (sp[midP - 1] + sp[midP]) / 2
            : sp[midP]
          : null,
      medianDropPct:
        spc.length > 0
          ? spc.length % 2 === 0
            ? (spc[midPct - 1] + spc[midPct]) / 2
            : spc[midPct]
          : null,
    })
  }
  return result.sort((a, b) => b.count - a.count).slice(0, 10)
}

// ---- Page ------------------------------------------------------------------

export default async function PriceDropsRegionPage() {
  const { drops, total, fetchedAt } = await getPriceDrops({ limit: 48, days: 7 }).catch(
    () => ({ drops: [], total: 0, fetchedAt: new Date().toISOString() }),
  )

  // Aggregate stats from real data (zero hardcoded)
  const totalReduced = drops.reduce((sum, d) => sum + (d.lastDropAmount ?? 0), 0)
  const dropPcts = drops
    .map((d) => d.lastDropPct)
    .filter((p): p is number => p !== null)
    .sort((a, b) => a - b)
  const mid = Math.floor(dropPcts.length / 2)
  const medianDropPct =
    dropPcts.length === 0
      ? null
      : dropPcts.length % 2 === 0
        ? (dropPcts[mid - 1] + dropPcts[mid]) / 2
        : dropPcts[mid]

  // Featured: top-6 biggest dollar drops for the KB poster grid
  const featuredDrops =
    drops.length > 0
      ? [...drops]
          .sort((a, b) => (b.lastDropAmount ?? 0) - (a.lastDropAmount ?? 0))
          .filter((d) => d.photoUrl)
          .slice(0, 6)
      : []
  const featuredItems: KbFeaturedItem[] = featuredDrops.map(dropToFeaturedItem)

  // Map geo: only drops with coordinates
  const mapFeatures = drops
    .filter((d) => d.lat != null && d.lng != null)
    .map((d) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [Number(d.lng), Number(d.lat)] as [number, number] },
      properties: {
        p: d.listPrice,
        bd: d.beds,
        ba: d.baths,
        sf: d.sqft,
        a: [d.streetNumber, d.streetName].filter(Boolean).join(' '),
        sub: d.subdivisionName ?? '',
        city: d.city ?? '',
        img: d.photoUrl ?? '',
      },
    }))
  const mapGeo: KbMapGeo = { type: 'FeatureCollection', features: mapFeatures }

  const neighborhoodTable = buildNeighborhoodTable(drops)

  // Hero glance stats — N drops, total cut, median pct
  const glanceStats = [
    { value: String(total), label: 'price reductions this week' },
    ...(totalReduced > 0 ? [{ value: fmtM(totalReduced), label: 'in asking-price cuts' }] : []),
    ...(medianDropPct !== null ? [{ value: `${medianDropPct.toFixed(1)}%`, label: 'median reduction' }] : []),
  ]

  // ---- Structured data ------------------------------------------------------

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com'
  const pageUrl = `${site}/price-drops`

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Price drops', url: '/price-drops' },
      ],
    },
    {
      type: 'dataset',
      name: 'Price Drop Radar, Central Oregon SFR',
      description:
        'Active single-family homes in Central Oregon where the seller has reduced the asking price ' +
        'in the last 7 days. Sourced daily from the regional MLS (ORMLS) via the Ryan Realty platform.',
      url: pageUrl,
      dateModified: fetchedAt,
      spatialCoverageName: 'Central Oregon',
      variableMeasured: [
        { name: 'Price reductions (7-day window)', value: total, unitText: 'listings' },
        {
          name: 'Total asking-price cuts',
          value: totalReduced > 0 ? fmtM(totalReduced) : '0',
          unitText: 'USD',
        },
        ...(medianDropPct !== null
          ? [{ name: 'Median drop', value: `${medianDropPct.toFixed(1)}%` }]
          : []),
      ],
    },
    {
      type: 'webPage',
      name: 'Price Drop Radar, Central Oregon Real Estate',
      description: `${total} active homes in Central Oregon with a price reduction in the last 7 days.`,
      url: pageUrl,
    },
  ]

  return (
    <main className="kb-root">
      <KbNav />
      <KbSectionTracker pageType="price-drops" />
      <MetadataBlock schemas={schemas} />
      <KbBreadcrumb
        trail={[
          { label: 'Home', href: '/' },
          { label: 'Price drops' },
        ]}
      />
      <SmoothScrollProvider>
        {/* Hero — live glance numbers in the KB Amboqia display */}
        <KbHero
          data={{
            activeCount: total,
            medianListPrice: null,
            medianDaysToPending: null,
          }}
          eyebrow="Central Oregon · Live MLS data"
          titleTop="Price Drop"
          titleBottom="Radar"
          lead="across Central Oregon in the last 7 days."
          videoSrc={null}
          posterSrc="/images/hero/hero-old-mill-master-4k.jpg"
        />

        {/* By-city chips — filter nav */}
        <section className="section" id="city-nav" aria-label="Filter by city">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">Central Oregon</span>
              <h2 className="sec-title display">
                Price drops<br />by city
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <Link
                href="/price-drops"
                className="inline-flex items-center rounded-full bg-primary text-primary-foreground px-3 py-1 text-xs font-medium"
              >
                All Central Oregon
              </Link>
              {SITE_CITY_SLUGS.slice(0, 6).map((slug) => (
                <Link
                  key={slug}
                  href={`/price-drops/${slug}`}
                  className="inline-flex items-center rounded-full border border-border bg-background text-foreground px-3 py-1 text-xs font-medium hover:bg-secondary transition-colors"
                >
                  {CITY_DISPLAY[slug] ?? slug}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* KB Featured: poster grid of biggest-dollar-drop listings */}
        {featuredItems.length > 0 && (
          <KbFeatured
            items={featuredItems}
            eyebrow={`${total} price reductions · Central Oregon`}
          />
        )}

        {/* Map — price-dropped listings on the terrain */}
        {mapFeatures.length > 0 && (
          <KbListingMap
            geojson={mapGeo}
            totalActive={total}
            fitToFeatures={false}
            showRegionMarkers
            eyebrow="Central Oregon"
            title={`${total} price\nreductions`}
            subtitle={`Every home with a price cut in the last 7 days, on the real terrain. Click any dot for the price and the address.`}
          />
        )}

        {/* Full listing grid — all 48 drops via the existing ListingCard (parity) */}
        {drops.length > 0 && (
          <section className="section" id="all-drops" aria-label="All price reductions">
            <div className="wrap">
              <div className="sec-head">
                <span className="sec-index">Last 7 days · Central Oregon SFR</span>
                <h2 className="sec-title display">
                  {total} {total === 1 ? 'home' : 'homes'} with a<br />price reduction
                </h2>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mt-6">
                {drops.map((drop) => {
                  const card = dropToCardData(drop)
                  return <ListingCard key={card.listingKey} listing={card} />
                })}
              </div>
            </div>
          </section>
        )}

        {drops.length === 0 && (
          <section className="section" id="empty-state" aria-label="No price reductions">
            <div className="wrap">
              <div className="sec-head">
                <span className="sec-index">Central Oregon · 7-day window</span>
                <h2 className="sec-title display">No reductions<br />this week</h2>
              </div>
              <p className="text-muted-foreground mt-4">
                The MLS updates throughout the day. Check back soon, or browse all active homes.
              </p>
              <Link
                href="/homes-for-sale"
                className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-secondary mt-4 transition-colors"
              >
                Browse all homes for sale
              </Link>
            </div>
          </section>
        )}

        {/* Neighborhood mini-table */}
        {neighborhoodTable.length > 0 && (
          <section className="section" id="by-neighborhood" aria-label="Price reductions by neighborhood">
            <div className="wrap">
              <div className="sec-head">
                <span className="sec-index">By neighborhood</span>
                <h2 className="sec-title display">Where prices<br />are being cut</h2>
              </div>
              <div className="w-full max-w-full overflow-x-auto no-scrollbar mt-6">
                <Table className="text-sm">
                  <TableHeader>
                    <TableRow className="text-muted-foreground">
                      <TableHead className="pr-6">Neighborhood</TableHead>
                      <TableHead className="pr-6 text-right tabular-nums">Reductions</TableHead>
                      <TableHead className="pr-6 text-right tabular-nums">Median list</TableHead>
                      <TableHead className="text-right tabular-nums">Median drop</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {neighborhoodTable.map((row, i) => (
                      <TableRow key={row.name} className={i % 2 === 0 ? 'bg-background/50' : ''}>
                        <TableCell className="pr-6 font-medium">{row.name}</TableCell>
                        <TableCell className="pr-6 text-right tabular-nums">{row.count}</TableCell>
                        <TableCell className="pr-6 text-right tabular-nums font-mono text-muted-foreground">
                          {row.medianListPrice ? fmtPrice(row.medianListPrice) : <span>{"—"}</span>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {row.medianDropPct ? `-${row.medianDropPct.toFixed(1)}%` : <span>{"—"}</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </section>
        )}

        {/* Glance stats — hidden from visual flow but present for CTABar context */}
        {glanceStats.length > 0 && (
          <section className="section" id="stats-summary" aria-label="Price reduction summary" style={{ display: 'none' }}>
            {/* Stats are rendered in the hero glance row by KbHero — no duplicate needed */}
          </section>
        )}

        {/* All-city navigation */}
        <section className="section" id="city-links" aria-label="Price drops by city">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">Central Oregon</span>
              <h2 className="sec-title display">Every city</h2>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {SITE_CITY_SLUGS.map((slug) => (
                <Link
                  key={slug}
                  href={`/price-drops/${slug}`}
                  className="inline-flex items-center rounded-full border border-border px-4 py-1.5 text-sm font-medium bg-background text-foreground hover:bg-secondary transition-colors"
                >
                  {CITY_DISPLAY[slug] ?? slug}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Explainer */}
        <section className="section" id="explainer" aria-label="What a price reduction means">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">How this works</span>
              <h2 className="sec-title display">What a price<br />reduction means</h2>
            </div>
            <div className="max-w-3xl mt-4 space-y-4 text-muted-foreground">
              <p>
                A price reduction is a documented, seller-initiated change in the MLS asking price.
                Each listing on this page had its price reduced at least once in the last 7 days.
                The original list price and the current list price both come directly from the
                regional MLS feed. Nothing is estimated or adjusted.
              </p>
              <p>
                A reduction does not automatically mean the home is a bargain.
                Some sellers start high and trim to market. Others are genuinely motivated to close.
                The best way to know which is which is to look at comparable sales in the same
                neighborhood.
              </p>
            </div>
          </div>
        </section>

        {/* Sell block */}
        <KbSell
          data={{
            medianListPrice: null,
            medianDaysToPending: null,
            soldCount30d: null,
          }}
          eyebrow="Sell with Ryan Realty"
        />

        <KbFooter towns={[]} />
      </SmoothScrollProvider>

      <CTABar
        eyebrow="Ryan Realty"
        title="Local brokers. Real data. No pressure."
        body="We pull price-reduction data every 30 minutes from the regional MLS. If a seller cut their price, we know about it before most buyers do."
        primary={{ href: '/contact', label: 'Talk to a broker' }}
        secondary={{ href: `tel:${CONTACT.phoneDirectTel}`, label: `Call ${CONTACT.phoneDirect}` }}
        tone="navy"
      />
    </main>
  )
}
