// brand-voice:exempt
/**
 * Cities index — Experience System Geo hub v3.2 (Family 4 rework).
 *
 * Matt's 2026-06-10 verdict: "the cities page is also ultra thin." This
 * rebuild turns the index from a name-and-number list into a destination:
 *
 *   1. Compact navy hero — LIVE region pulse (active count in Amboqia
 *      display, median list, months-of-supply verdict) from getRegionPulse.
 *      Honest empty states when the cache is unreachable.
 *   2. Featured city editorial rows — full-width, hairline rules, alternating
 *      photo/content composition. Each row carries the VERIFIED city hero
 *      (Family 4 curation, lib/geo-images.ts cityHero registry), the city
 *      name in Amboqia, one honest editorial sentence, a live stat band
 *      (active / median / days on market via market_pulse_live snapshots,
 *      geo_snapshot_mv fallback), and links to the city page + its searches.
 *   3. Other-areas compact ledger.
 *   4. Navy search CTA band.
 *
 * Engagement tracking on every section (EngagedSection). All figures from
 * the DAL — no invented numbers, em-dash placeholder when unavailable.
 *
 * Parity contract: design_system/ryan-realty/ui_kits/cities/parity.json
 */

import type { Metadata } from 'next'
import Image from 'next/image'
import { getCitiesForIndex } from '@/app/actions/cities'
import { sortCitiesWithPrimaryFirst } from '@/lib/cities'
import { getAllCitySnapshots, getRegionPulse, getMarketPulseCitySnapshots } from '@/lib/data'
import { getCityContent } from '@/lib/city-content'
import { cityHero } from '@/lib/geo-images'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import { pageMetadata } from '@/lib/site/page-metadata'
import { PageBreadcrumb } from '@/components/site/PageBreadcrumb'
import { Container, DisplayHeading, H2, Eyebrow } from '@/components/site/primitives'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { EngagedSection } from '@/components/site/experience'
import type { SchemaInput } from '@/lib/site/json-ld'

// Statically cached, revalidated every 30 minutes.
export const revalidate = 1800

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const metadata: Metadata = pageMetadata({
  title: 'Central Oregon Cities: Bend, Redmond, Sisters, Sunriver',
  description:
    'Explore homes for sale in Central Oregon cities. Bend, Redmond, Sisters, Sunriver, La Pine, Prineville, and more. Live market data from a local brokerage.',
  path: '/cities',
})

// Featured cities in editorial display order — each has a VERIFIED hero photo
// in the Family 4 curation registry (lib/geo-images.ts).
const FEATURED_CITY_SLUGS = [
  'bend',
  'redmond',
  'sisters',
  'sunriver',
  'la-pine',
  'tumalo',
  'terrebonne',
  'prineville',
  'madras',
  'powell-butte',
  'crooked-river-ranch',
  'culver',
]

// One honest editorial sentence per featured city. Cities with hand-written
// content in lib/city-content.ts use its first sentence; the rest carry a
// verifiable geographic fact (no market claims, no superlatives).
const CITY_SENTENCE_FALLBACK: Record<string, string> = {
  'la-pine': 'Larger lots, ponderosa forest, and a quieter pace at the southern end of Deschutes County.',
  tumalo: 'A small unincorporated community on the Deschutes River between Bend and Sisters, known for acreage and river access.',
  terrebonne: 'Home to Smith Rock State Park, with farm parcels and small-town streets above the Crooked River canyon.',
  'powell-butte': 'Ranch and acreage country between Bend and Prineville, with wide Cascade views.',
  culver: 'A small farm town near Lake Billy Chinook and The Cove Palisades State Park.',
  'crooked-river-ranch': 'A canyon-rim community with its own golf course between Terrebonne and Madras.',
}

function firstSentence(text: string): string {
  const m = text.match(/^.*?[.?](?=\s|$)/)
  return (m ? m[0] : text).trim()
}

function fmtK(n: number | null | undefined): string | null {
  return n != null ? `$${Math.round(n / 1000).toLocaleString()}K` : null
}

function verdictFromMos(mos: number | null): string | null {
  if (mos == null) return null
  if (mos <= 4) return "Seller's market"
  if (mos >= 6) return "Buyer's market"
  return 'Balanced market'
}

export default async function CitiesPage() {
  // market_pulse_live filters by geo_label (display name) — include known
  // aliases (Lapine/La Pine, Sun River/Sunriver); rows are re-keyed by
  // geo_slug below so the alias spelling never leaks into the UI.
  const featuredLabels = [
    'Bend', 'Redmond', 'Sisters', 'Sunriver', 'Sun River', 'La Pine', 'Lapine',
    'Tumalo', 'Terrebonne', 'Prineville', 'Madras', 'Powell Butte',
    'Crooked River Ranch', 'Culver',
  ]
  const [allCities, allSnapshots, regionPulse, citySnapshots] = await Promise.all([
    getCitiesForIndex(),
    getAllCitySnapshots(),
    withTimeoutFallback(getRegionPulse(), null, 3500, 'cities:regionPulse'),
    withTimeoutFallback(getMarketPulseCitySnapshots(featuredLabels), [], 3500, 'cities:cityPulse'),
  ])

  const sortedCities = sortCitiesWithPrimaryFirst(allCities)
  const visibleCities = sortedCities.slice(0, 60)

  // citySlug -> live pulse snapshot (market_pulse_live, 10–15 min freshness).
  // geo_slug in market_pulse_live uses spaces ('la pine') — normalize to
  // hyphens. A pulse row with zero actives and no median is treated as
  // absent so the geo_snapshot_mv fallback can answer honestly.
  const pulseBySlug = new Map(
    citySnapshots
      .filter((s) => s.active_count > 0 || s.median_list_price != null)
      .map((s) => [s.geo_slug.replace(/\s+/g, '-'), s]),
  )

  // citySlug -> geo_snapshot_mv fallback (active count + median)
  const snapshotBySlug = new Map<string, { activeCount: number; medianPrice: number | null }>()
  for (const s of allSnapshots) {
    snapshotBySlug.set(s.geoKey.replace(/\s+/g, '-'), {
      activeCount: s.activeSfrCount,
      medianPrice: s.medianListPrice != null ? Math.round(s.medianListPrice) : null,
    })
  }

  const cityNameBySlug = new Map(visibleCities.map((c) => [c.slug, c.name]))

  // Featured editorial rows — only cities the index actually knows about
  const featured = FEATURED_CITY_SLUGS.filter(
    (slug) => cityNameBySlug.has(slug) || snapshotBySlug.has(slug),
  ).map((slug) => {
    const name =
      cityNameBySlug.get(slug) ??
      slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    const pulse = pulseBySlug.get(slug) ?? null
    const snap = snapshotBySlug.get(slug) ?? null
    const content = getCityContent(name)
    const sentence = content?.description
      ? firstSentence(content.description)
      : CITY_SENTENCE_FALLBACK[slug] ?? null
    return {
      slug,
      name,
      hero: cityHero(slug),
      sentence,
      activeCount: pulse?.active_count ?? snap?.activeCount ?? null,
      medianListPrice: pulse?.median_list_price ?? snap?.medianPrice ?? null,
      medianDom: pulse?.median_active_dom ?? null,
      verdict: verdictFromMos(pulse?.months_of_supply ?? null),
    }
  })

  const featuredSlugs = new Set(featured.map((f) => f.slug))
  const others = visibleCities.filter((c) => featuredSlugs.has(c.slug) === false)

  // Region totals — live pulse first, mv fallback
  const totalActive =
    regionPulse?.activeCount ?? allSnapshots.reduce((sum, s) => sum + s.activeSfrCount, 0)
  const regionMedian = regionPulse?.medianListPrice ?? null
  const regionVerdict = verdictFromMos(regionPulse?.monthsOfSupply ?? null)

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Cities', url: '/cities' },
      ],
    },
  ]

  return (
    <main className="min-h-screen bg-background">

      {/* Structured data: breadcrumb + CollectionPage + ItemList of city pages */}
      <MetadataBlock schemas={schemas} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'Central Oregon Cities',
            description: 'Explore homes for sale in Central Oregon cities.',
            url: `${siteUrl}/cities`,
            publisher: { '@type': 'Organization', name: 'Ryan Realty' },
            mainEntity: {
              '@type': 'ItemList',
              itemListElement: featured.map((c, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                name: `${c.name}, Oregon`,
                url: `${siteUrl}/cities/${c.slug}`,
              })),
            },
          }),
        }}
      />

      <PageBreadcrumb trail={[{ label: 'Cities' }]} includeJsonLd={false} />

      {/* Compact hero: the LIVE region pulse is the identity — no tile wall, no video */}
      <section
        className="relative overflow-hidden bg-primary"
        aria-label="Central Oregon cities hero"
      >
        <Container className="relative py-12 md:py-16">
          {/* Live indicator */}
          <div className="flex items-center gap-2 mb-5">
            <span
              className="inline-block w-[7px] h-[7px] rounded-full bg-green-400"
              style={{
                boxShadow: '0 0 0 2px rgba(74,222,128,0.30)',
                animation: 'rr-pulse-dot 2s ease-in-out infinite',
              }}
              aria-hidden
            />
            <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-white/70">
              Live market
            </span>
          </div>

          <DisplayHeading
            as="h1"
            className="text-white"
            style={{
              fontSize: 'clamp(2rem, 4.5vw, 3.25rem)',
              letterSpacing: '-0.015em',
              lineHeight: 1.12,
            }}
          >
            Central Oregon Cities
          </DisplayHeading>
          <p className="mt-3 text-white/65 text-sm md:text-[15px] max-w-md leading-relaxed">
            Bend, Redmond, Sisters, Sunriver, and the high desert towns around them.
            Live inventory and pricing from the regional MLS, refreshed through the day.
          </p>

          {/* Region pulse band — data as identity */}
          <div className="mt-8 flex flex-wrap items-end gap-x-10 gap-y-5">
            <div className="flex flex-col gap-0.5">
              <span
                className="font-display tabular-nums text-white leading-none"
                style={{ fontSize: 'clamp(2.75rem, 7vw, 4.5rem)', letterSpacing: '-0.02em' }}
              >
                {totalActive > 0 ? totalActive.toLocaleString() : '—'}
              </span>
              <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-white/55 mt-1">
                Active homes
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span
                className="font-display tabular-nums text-white leading-none"
                style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', letterSpacing: '-0.015em' }}
              >
                {fmtK(regionMedian) ?? '—'}
              </span>
              <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-white/55 mt-1">
                Median list price
              </span>
            </div>
            {regionVerdict ? (
              <div className="flex flex-col gap-1 pb-1">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/25 px-3 py-1.5 text-xs font-semibold text-white/85">
                  {regionVerdict}
                </span>
                <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-white/55">
                  Months of supply
                </span>
              </div>
            ) : null}
          </div>
        </Container>

        <style>{`
          @keyframes rr-pulse-dot {
            0%, 100% { box-shadow: 0 0 0 2px rgba(74,222,128,0.30); }
            50%       { box-shadow: 0 0 0 5px rgba(74,222,128,0.14); }
          }
        `}</style>
      </section>

      {/* Featured cities — full-width editorial rows, alternating composition,
          verified hero photography, live stat bands, honest sentences. */}
      <EngagedSection id="featured-cities" pageType="geo-hub" position={1} className="bg-background">
        <Container>
          <div className="pt-10 md:pt-14 pb-2">
            <Eyebrow className="mb-1">Central Oregon</Eyebrow>
            <H2 className="text-2xl text-foreground">Where do you want to live?</H2>
          </div>

          <div>
            {featured.map((city, i) => (
              <article
                key={city.slug}
                className="border-b border-border py-8 md:py-10 first:border-t first:mt-6"
              >
                <div className="grid gap-5 md:gap-10 md:items-center md:grid-cols-12">
                  {/* Verified photo — alternates sides on desktop for editorial rhythm */}
                  <a
                    href={`/cities/${city.slug}`}
                    className={`relative block overflow-hidden rounded-xl aspect-[16/10] md:aspect-[4/3] md:col-span-5 ${
                      i % 2 === 1 ? 'md:order-2' : ''
                    }`}
                    aria-label={`Homes for sale in ${city.name}, Oregon`}
                  >
                    <Image
                      src={city.hero.src}
                      alt={city.hero.alt}
                      fill
                      sizes="(max-width: 768px) 100vw, 42vw"
                      className="object-cover transition-transform duration-500 hover:scale-[1.03]"
                      priority={i < 2}
                    />
                    {city.hero.verified ? null : (
                      <span
                        className="absolute bottom-2 right-2 rounded-md px-2 py-1 text-[10px] font-medium uppercase tracking-[0.08em] text-white/80"
                        style={{ background: 'rgba(16,39,66,0.55)' }}
                      >
                        Regional view · Cascade Range
                      </span>
                    )}
                  </a>

                  {/* Editorial content */}
                  <div className={`md:col-span-7 ${i % 2 === 1 ? 'md:order-1' : ''}`}>
                    <a href={`/cities/${city.slug}`} className="group inline-block">
                      <DisplayHeading
                        as="h3"
                        className="text-foreground group-hover:text-primary transition-colors"
                        style={{
                          fontSize: 'clamp(1.75rem, 3.4vw, 2.5rem)',
                          letterSpacing: '-0.015em',
                          lineHeight: 1.1,
                        }}
                      >
                        {city.name}
                      </DisplayHeading>
                    </a>

                    {city.sentence ? (
                      <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground max-w-prose">
                        {city.sentence}
                      </p>
                    ) : null}

                    {/* Live stat band — tabular numerals, honest em-dash empties */}
                    <div className="mt-5 flex flex-wrap items-baseline gap-x-8 gap-y-3">
                      <div>
                        <p className="font-display tabular-nums text-foreground text-xl md:text-2xl leading-none">
                          {city.activeCount != null && city.activeCount > 0
                            ? city.activeCount.toLocaleString()
                            : '—'}
                        </p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                          Active
                        </p>
                      </div>
                      <div>
                        <p className="font-display tabular-nums text-foreground text-xl md:text-2xl leading-none">
                          {fmtK(city.medianListPrice) ?? '—'}
                        </p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                          Median list
                        </p>
                      </div>
                      {city.medianDom != null ? (
                        <div>
                          <p className="font-display tabular-nums text-foreground text-xl md:text-2xl leading-none">
                            {Math.round(city.medianDom)}
                            <span className="font-sans text-xs font-medium text-muted-foreground ml-1">days</span>
                          </p>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                            Median on market
                          </p>
                        </div>
                      ) : null}
                      {city.verdict ? (
                        <span className="self-center rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-foreground/80">
                          {city.verdict}
                        </span>
                      ) : null}
                    </div>

                    {/* Links into the city */}
                    <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium">
                      <a
                        href={`/cities/${city.slug}`}
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        {city.name} guide
                      </a>
                      <a
                        href={`/homes-for-sale/${city.slug}`}
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        Homes for sale
                      </a>
                      <a
                        href={`/open-houses/${city.slug}`}
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        Open houses
                      </a>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </Container>
      </EngagedSection>

      {/* Other cities: compact ledger */}
      {others.length > 0 ? (
        <EngagedSection
          id="other-cities"
          pageType="geo-hub"
          position={2}
          className="border-t border-border bg-secondary/30 py-10 md:py-14"
        >
          <Container>
            <div className="mb-6">
              <Eyebrow className="mb-1">More areas</Eyebrow>
              <H2 className="text-2xl text-foreground">Other Central Oregon cities</H2>
            </div>

            <div className="divide-y divide-border max-w-2xl">
              {others.map((city) => {
                const snap = snapshotBySlug.get(city.slug)
                const active = snap?.activeCount ?? city.activeCount
                const median = snap?.medianPrice ?? city.medianPrice

                return (
                  <a
                    key={city.slug}
                    href={`/cities/${city.slug}`}
                    className="group flex items-center justify-between gap-4 py-3 hover:text-primary transition-colors"
                  >
                    <span className="text-sm font-semibold text-foreground group-hover:text-primary">
                      {city.name}
                    </span>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      {active > 0 ? (
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {active} {active === 1 ? 'home' : 'homes'}
                        </span>
                      ) : null}
                      {median != null ? (
                        <span className="text-xs tabular-nums text-muted-foreground">
                          ${Math.round(median / 1000).toLocaleString()}K
                        </span>
                      ) : null}
                      <span
                        aria-hidden
                        className="text-muted-foreground/40 group-hover:text-primary transition-colors"
                      >
                        &rarr;
                      </span>
                    </div>
                  </a>
                )
              })}
            </div>
          </Container>
        </EngagedSection>
      ) : null}

      {/* Search CTA: navy band */}
      <EngagedSection id="search-cta" pageType="geo-hub" position={3} className="bg-primary py-12 md:py-16">
        <Container>
          <div className="max-w-xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.10em] text-white/50 mb-3">
              Central Oregon
            </p>
            <DisplayHeading
              as="h2"
              className="text-white mb-4"
              style={{
                fontSize: 'clamp(1.5rem, 2.5vw, 2.25rem)',
                letterSpacing: '-0.01em',
                lineHeight: 1.2,
              }}
            >
              Find your home in Central Oregon
            </DisplayHeading>
            <p className="text-white/68 text-sm leading-relaxed mb-8 max-w-md">
              Search active listings across all cities with live filters for price, beds, and location.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="/search"
                className="inline-flex items-center px-6 py-3 rounded-xl bg-background text-primary font-semibold text-sm hover:bg-white transition-colors"
              >
                Search all listings
              </a>
              <a
                href="/lp/buyer-listing-alerts"
                className="inline-flex items-center px-6 py-3 rounded-xl border border-white/28 text-white/88 font-medium text-sm hover:bg-white/10 hover:text-white transition-colors"
              >
                Get listing alerts
              </a>
            </div>
          </div>
        </Container>
      </EngagedSection>

    </main>
  )
}
