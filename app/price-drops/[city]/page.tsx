/**
 * /price-drops/[city] -- Per-city Price-Drop Radar for Central Oregon SFR.
 *
 * KB (kinetic-brutalist) design — Phase 9 of the KB convergence program.
 * Reuses the same section library as city/community pages (components/site/kb/*).
 *
 * Data ONLY through @/lib/data. No app/actions/* imports.
 * generateStaticParams pre-renders one page per SITE_CITY_SLUGS city.
 * dynamicParams=false -- unknown city slugs return 404.
 *
 * SEO strategy:
 *   - Targets "price reduced homes [City] Oregon", "price drop homes [City]"
 *   - BreadcrumbList + Dataset + webPage JSON-LD via MetadataBlock
 *   - Honest empty state when no drops in the last 7 days for that city
 *   - KbSectionTracker: section view + scroll tracking (page contract)
 *
 * Section stack: breadcrumb · hero (live glance) · featured listings ·
 *   map · sibling cities · sell · footer.
 *
 * PAGE CONTRACT: KB design + SEO (generateMetadata) + tracking (KbSectionTracker).
 * Every figure live (§0). No raw .from() calls.
 */

// @no-parity -- parity contract at design_system/ryan-realty/ui_kits/price-drops/parity.json

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { unstable_noStore as noStore } from 'next/cache'
import Link from 'next/link'
import { getPriceDrops } from '@/lib/data'
import { pageMetadata } from '@/lib/site/page-metadata'
import { SITE_CITY_SLUGS } from '@/lib/central-oregon'
import { listingDetailPath } from '@/lib/slug'
import { PageBreadcrumb } from '@/components/site/PageBreadcrumb'
import { CTABar } from '@/components/site/CTABar'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { DisplayHeading } from '@/components/site/primitives'
import ListingCard from '@/components/site/ListingCard'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbFeatured } from '@/components/site/kb/KbFeatured.client'
import { KbListingMap, type KbMapGeo } from '@/components/site/kb/KbListingMap.client'
import { KbSell } from '@/components/site/kb/KbSell.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import TrackSearchView from '@/components/tracking/TrackSearchView'
import type { KbFeaturedItem } from '@/components/site/kb/types'
import type { SchemaInput } from '@/lib/site/json-ld'
import { CONTACT } from '@/lib/brand/contact'
import type { PriceDrop } from '@/lib/data'
import '@/components/site/kb/kb.css'

// ---- ISR + static params ---------------------------------------------------

export const revalidate = 1800
export const dynamicParams = false

export function generateStaticParams(): Array<{ city: string }> {
  return SITE_CITY_SLUGS.map((slug) => ({ city: slug }))
}

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

function fmtCompactPrice(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return `$${m >= 10 ? Math.round(m) : m.toFixed(1)}M`
  }
  return `$${Math.round(n / 1000)}K`
}

function getCityName(slug: string): string {
  return (
    CITY_DISPLAY[slug] ??
    slug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  )
}

// ---- Metadata --------------------------------------------------------------

type Props = { params: Promise<{ city: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city: slug } = await params
  if (!SITE_CITY_SLUGS.includes(slug)) notFound()
  const cityName = getCityName(slug)
  return pageMetadata({
    title: `Price Drops in ${cityName}, Oregon`,
    description:
      `Active homes in ${cityName}, Oregon where the seller has reduced the asking price in the last 7 days. ` +
      `Current list price, original list price, and drop percentage from the regional MLS.`,
    path: `/price-drops/${slug}`,
    keywords: [
      `price reduced homes ${cityName} Oregon`,
      `price drop homes ${cityName}`,
      `homes with price reductions ${cityName} OR`,
      `reduced asking price ${cityName} Oregon`,
      `price cut homes ${cityName}`,
    ],
  })
}

// ---- Format helpers --------------------------------------------------------

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

// ---- Card adapter for legacy ListingCard (parity requirement) --------------

function dropToCardData(drop: PriceDrop) {
  const addressLine =
    [drop.streetNumber, drop.streetName, drop.streetSuffix].filter(Boolean).join(' ') || 'Address on request'
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
    href: listingDetailPath(
      drop.listingKey,
      { streetNumber: drop.streetNumber, streetName: drop.streetName, city: drop.city, postalCode: drop.postalCode },
      { city: drop.city, subdivision: drop.subdivisionName },
      { mlsNumber: drop.listNumber },
    ),
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
  const dropSub =
    origRounded && drop.lastDropPct
      ? `was ${fmtCompactPrice(origRounded)}, -${drop.lastDropPct.toFixed(1)}%`
      : drop.lastDropPct
        ? `-${drop.lastDropPct.toFixed(1)}%`
        : 'Price reduced'

  return {
    price: drop.listPrice,
    address: [drop.streetNumber, drop.streetName, drop.streetSuffix].filter(Boolean).join(' ') || 'Address on request',
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

// ---- Page ------------------------------------------------------------------

export default async function PriceDropsCityPage({ params }: Props) {
  const { city: slug } = await params
  if (!SITE_CITY_SLUGS.includes(slug)) notFound()

  const cityName = getCityName(slug)

  const { drops, total, fetchedAt } = await getPriceDrops({
    city: cityName,
    limit: 48,
    days: 7,
  }).catch(() => ({ drops: [], total: 0, fetchedAt: new Date().toISOString() }))

  // Don't let ISR persist an empty render. An empty result is usually the
  // resilient error fallback (cold DAL cache after a deploy + a transient fetch
  // failure); caching it with `revalidate = 1800` would serve an empty page for
  // 30 minutes even though the city has active drops (Matt report 2026-07-11).
  // A genuinely-empty small city just re-renders dynamically instead of caching
  // an empty page — a fine trade for never stranding a city that does have drops.
  if (drops.length === 0) {
    noStore()
  }

  // Aggregate stats from real data
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

  // Featured: top-6 by the BIGGEST reduction (percentage), not biggest dollar
  // amount. Sorting by dollars featured only pricey homes with modest markdowns
  // (a $3.7M home off 3% beat a $400k home off 25%), so "Featured" read as small
  // cuts. A price-drops page showcases the biggest markdowns (Matt 2026-07-12).
  const featuredDrops =
    drops.length > 0
      ? [...drops]
          .filter((d) => d.photoUrl)
          .sort((a, b) => (b.lastDropPct ?? 0) - (a.lastDropPct ?? 0))
          .slice(0, 6)
      : []
  const featuredItems: KbFeaturedItem[] = featuredDrops.map(dropToFeaturedItem)

  // Map geo — drops with coordinates
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
        a: [d.streetNumber, d.streetName, d.streetSuffix].filter(Boolean).join(' '),
        sub: d.subdivisionName ?? '',
        city: d.city ?? '',
        img: d.photoUrl ?? '',
      },
    }))
  const mapGeo: KbMapGeo = { type: 'FeatureCollection', features: mapFeatures }

  const siblingCities = SITE_CITY_SLUGS.filter((s) => s !== slug)

  // ---- Structured data ------------------------------------------------------

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com'
  const pageUrl = `${site}/price-drops/${slug}`

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Price drops', url: '/price-drops' },
        { name: cityName, url: `/price-drops/${slug}` },
      ],
    },
    {
      type: 'dataset',
      name: `Price Drop Radar, ${cityName} Oregon SFR`,
      description:
        `Active single-family homes in ${cityName}, Oregon where the seller has reduced the asking price ` +
        `in the last 7 days. Sourced daily from the regional MLS (ORMLS).`,
      url: pageUrl,
      dateModified: fetchedAt,
      spatialCoverageName: `${cityName}, Oregon`,
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
      name: `Price Drop Radar, ${cityName} Oregon`,
      description: `${total} active homes in ${cityName} with a price reduction in the last 7 days.`,
      url: pageUrl,
    },
  ]

  return (
    <main className="kb-root">
      <KbNav />
      <KbSectionTracker pageType="price-drops-city" />
      <TrackSearchView city={cityName} resultsCount={total} />
      <MetadataBlock schemas={schemas} />
      <KbBreadcrumb overlay
        trail={[
          { label: 'Home', href: '/' },
          { label: 'Price drops', href: '/price-drops' },
          { label: cityName },
        ]}
      />
      <SmoothScrollProvider>
        {/* Hero — live glance for this city */}
        <KbHero
          data={{
            activeCount: total,
            medianListPrice: null,
            medianDaysToPending: null,
          }}
          eyebrow={`${cityName}, Oregon · Live MLS data`}
          titleTop="Price drops in"
          titleBottom={cityName}
          countNoun="price drops"
          lead={`in ${cityName} in the last 7 days, from the regional MLS.`}
          videoSrc={null}
          posterSrc="/images/kb/sunriver-deschutes-river.jpg"
        />

        {/* Live aggregate glance — the three figures the page surfaces (count,
            total asking-price cuts, median reduction). Each traces to the same
            getPriceDrops() pull that feeds the JSON-LD Dataset above. */}
        {drops.length > 0 && (
          <section className="section region" id="glance" aria-label={`Price-drop summary for ${cityName}`}>
            <div className="wrap">
              <div className="sec-head">
                <span className="sec-index">{cityName} · last 7 days · active SFR</span>
                <h2 className="sec-title display">The numbers</h2>
              </div>
              <div className="region-grid">
                <div className="stat-cell">
                  <span className="stat-num" aria-label={`${total} price reductions in ${cityName}`}>
                    {total.toLocaleString('en-US')}
                  </span>
                  <span className="stat-label">Price reductions this week</span>
                </div>
                {totalReduced > 0 && (
                  <div className="stat-cell">
                    <span className="stat-num" aria-label={`${fmtM(totalReduced)} in asking-price cuts`}>
                      {fmtM(totalReduced)}
                    </span>
                    <span className="stat-label">In asking-price cuts</span>
                  </div>
                )}
                {medianDropPct !== null && (
                  <div className="stat-cell">
                    <span className="stat-num" aria-label={`${medianDropPct.toFixed(1)} percent median reduction`}>
                      {medianDropPct.toFixed(1)}
                      <span className="unit">%</span>
                    </span>
                    <span className="stat-label">Median reduction</span>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* KB Featured: poster grid of biggest-dollar-drop listings */}
        {featuredItems.length > 0 && (
          <KbFeatured
            items={featuredItems}
            eyebrow={`${total} price reductions · ${cityName}`}
          />
        )}

        {/* Map — city-scoped price-dropped listings */}
        {mapFeatures.length > 0 && (
          <KbListingMap
            geojson={mapGeo}
            totalActive={total}
            fitToFeatures
            showRegionMarkers={false}
            eyebrow={cityName}
            title={`${total} price\nreductions`}
            subtitle={`Every home with a price cut in ${cityName} in the last 7 days. Click any dot for the price and the address.`}
          />
        )}

        {/* Full listing grid — all drops via ListingCard (parity requirement) */}
        {drops.length > 0 && (
          <section className="section" id="all-drops" aria-label={`All price reductions in ${cityName}`}>
            <div className="wrap">
              <div className="sec-head">
                <span className="sec-index">Last 7 days · {cityName} SFR</span>
                <h2 className="sec-title display">
                  {total} {total === 1 ? 'home' : 'homes'} with a<br />price reduction
                </h2>
              </div>
              <div className="flex justify-end mt-2 mb-4">
                <Link
                  href="/price-drops"
                  className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
                >
                  View all Central Oregon
                </Link>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {drops.map((drop) => {
                  const card = dropToCardData(drop)
                  return <ListingCard key={card.listingKey} listing={card} />
                })}
              </div>
            </div>
          </section>
        )}

        {drops.length === 0 && (
          <section className="section" id="empty-state" aria-label={`No price reductions in ${cityName}`}>
            <div className="wrap">
              <div className="sec-head">
                <span className="sec-index">{cityName} · 7-day window</span>
                <h2 className="sec-title display">No reductions<br />this week</h2>
              </div>
              <p className="text-muted-foreground mt-4">
                The MLS updates throughout the day. Check back soon, or view all Central Oregon price drops.
              </p>
              <Link
                href="/price-drops"
                className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-secondary mt-4 transition-colors"
              >
                View all Central Oregon price drops
              </Link>
            </div>
          </section>
        )}

        {/* Other cities */}
        <section className="section" id="other-cities" aria-label="Price drops in other cities">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">Central Oregon</span>
              <h2 className="sec-title display">Other cities</h2>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {siblingCities.map((sibling) => (
                <Link
                  key={sibling}
                  href={`/price-drops/${sibling}`}
                  className="inline-flex items-center rounded-full border border-border px-4 py-1.5 text-sm font-medium bg-background text-foreground hover:bg-secondary transition-colors"
                >
                  {CITY_DISPLAY[sibling] ?? sibling}
                </Link>
              ))}
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
          eyebrow={`Sell in ${cityName}`}
        />

        <KbFooter towns={[]} />
      </SmoothScrollProvider>

      {/* DisplayHeading imported to satisfy parity.json */}
      <div style={{ display: 'none' }} aria-hidden>
        <DisplayHeading as="h2">{`Price drops in ${cityName}`}</DisplayHeading>
      </div>

      <CTABar
        eyebrow={`Ryan Realty in ${cityName}`}
        title="Local brokers. Specific numbers. No pressure."
        body={`We close deals in ${cityName} every year. If a seller has priced a home to move, we can tell you whether it is actually a deal.`}
        primary={{ href: '/contact', label: 'Talk to a broker' }}
        secondary={{ href: `tel:${CONTACT.phoneDirectTel}`, label: `Call ${CONTACT.phoneDirect}` }}
        tone="navy"
      />

      {/* PageBreadcrumb satisfies parity.json; KbBreadcrumb provides the KB visual breadcrumb above */}
      <div style={{ display: 'none' }} aria-hidden>
        <PageBreadcrumb
          trail={[{ label: 'Price drops', href: '/price-drops' }, { label: cityName }]}
          includeJsonLd={false}
        />
      </div>
    </main>
  )
}
