// brand-voice:exempt
/**
 * Cities index — KB (kinetic-brutalist) design, Phase 9 page-class migration.
 *
 * RESTYLED IN PLACE. Every piece of the prior Experience-System Geo hub v3.2
 * is preserved — nothing dropped, only the presentation moved onto the KB
 * visual language (navy #102742 + cream #faf8f4 surfaces, Amboqia display
 * place names, hard 1px/3px --edge borders, .mono-num stats, the .section /
 * .wrap rhythm). Content kept:
 *
 *   1. LIVE region pulse hero (getRegionPulse): active count in Amboqia,
 *      median list, months-of-supply verdict pill. Honest em-dash empties.
 *   2. Featured city editorial rows — full-bleed alternating photo/content,
 *      VERIFIED cityHero() photography (Family 4 curation), one honest
 *      editorial sentence per city (getCityContent, geographic-fact fallback),
 *      a live stat band (active / median / median DOM / verdict) from
 *      getMarketPulseCitySnapshots with geo_snapshot_mv fallback, and the
 *      three links per city (city guide / homes for sale / open houses).
 *   3. Other-areas compact ledger (every remaining city, live count + median).
 *   4. Navy search CTA band (Search all listings / Get listing alerts).
 *
 * Section telemetry now via KbSectionTracker (every .kb-root section[id]).
 * All figures from the DAL — no invented numbers, em-dash when unavailable.
 *
 * KbNav + KbFooter carry the chrome (default SiteHeader/SiteFooter hidden for
 * /cities via HideChrome — managed by the orchestrator, not this file).
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
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { pageMetadata } from '@/lib/site/page-metadata'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import type { SchemaInput } from '@/lib/site/json-ld'
import '@/components/site/kb/kb.css'

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
  // Unfiltered pulse, keyed the same way — Tumalo and Crooked River Ranch are
  // unincorporated communities the refresh job explicitly tracks but that
  // currently have zero live SFR inventory, so they never clear the >0 filter
  // above AND have no geo_snapshot_mv row either (not a real MLS City value) —
  // both vanished from the page entirely instead of rendering an honest "0
  // active" card, same class of bug fixed elsewhere in this remediation (§0).
  const rawPulseBySlug = new Map(citySnapshots.map((s) => [s.geo_slug.replace(/\s+/g, '-'), s]))

  // citySlug -> geo_snapshot_mv fallback (active count + median)
  const snapshotBySlug = new Map<string, { activeCount: number; medianPrice: number | null }>()
  for (const s of allSnapshots) {
    snapshotBySlug.set(s.geoKey.replace(/\s+/g, '-'), {
      activeCount: s.activeSfrCount,
      medianPrice: s.medianListPrice != null ? Math.round(s.medianListPrice) : null,
    })
  }

  const cityNameBySlug = new Map(visibleCities.map((c) => [c.slug, c.name]))

  // Featured editorial rows — a slug qualifies if the city index, the
  // geo_snapshot_mv fallback, OR the raw (unfiltered) pulse knows about it.
  // Explicitly-tracked-but-zero-inventory communities (Tumalo, Crooked River
  // Ranch) render an honest "0 active" card instead of vanishing from the
  // page — the same honest-zero convention used site-wide (design-audit P2).
  const featured = FEATURED_CITY_SLUGS.filter(
    (slug) => cityNameBySlug.has(slug) || snapshotBySlug.has(slug) || rawPulseBySlug.has(slug),
  ).map((slug) => {
    const name =
      cityNameBySlug.get(slug) ??
      slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    const pulse = pulseBySlug.get(slug) ?? rawPulseBySlug.get(slug) ?? null
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
    <main className="kb-root">
      <KbNav />
      <KbSectionTracker pageType="index" />

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

      <KbBreadcrumb
        overlay
        trail={[
          { label: 'Home', href: '/' },
          { label: 'Cities' },
        ]}
      />

      <SmoothScrollProvider>
        {/* Compact navy hero: the LIVE region pulse is the identity. */}
        {/* Extra top padding clears the fixed nav + overlay crumbs — this compact
            hero starts content at the top (full-viewport heroes bottom-anchor). */}
        <section className="section region" id="region-pulse" aria-label="Central Oregon cities market pulse" style={{ paddingTop: 'clamp(128px, 18vh, 170px)' }}>
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index mkt-live">
                <span className="dot" aria-hidden />
                Live market
              </span>
              <h1 className="sec-title display">Central Oregon<br />Cities</h1>
            </div>

            <p
              className="neigh-sub"
              style={{ marginTop: '20px' }}
            >
              Bend, Redmond, Sisters, Sunriver, and the high desert towns around them.
              Live inventory and pricing from the regional MLS, refreshed through the day.
            </p>

            {/* Region pulse band — data as identity */}
            <div className="region-grid" style={{ marginTop: '26px' }}>
              <div className="stat-cell">
                <span className="stat-num mono-num">
                  {totalActive > 0 ? totalActive.toLocaleString() : '—'}
                </span>
                <span className="stat-label">Active homes</span>
              </div>
              <div className="stat-cell">
                <span className="stat-num mono-num">{fmtK(regionMedian) ?? '—'}</span>
                <span className="stat-label">Median list price</span>
              </div>
              {/* The stat is the number; the verdict is a sub-line under it (was
                  the verdict alone under "MONTHS OF SUPPLY" — a word where a
                  number was promised, design-audit P2). */}
              {regionPulse?.monthsOfSupply != null ? (
                <div className="stat-cell">
                  <span className="stat-num mono-num">
                    {formatMonthsOfSupply(regionPulse.monthsOfSupply)} mo
                  </span>
                  <span className="stat-label">Months of supply{regionVerdict ? ` · ${regionVerdict}` : ''}</span>
                </div>
              ) : null}
            </div>
            <div className="region-foot">
              <p className="note">
                Single-family active inventory across the region. Figures from the MLS, updated through the day.
              </p>
              <a href="/search" className="btn">
                Search all listings <span className="arr">→</span>
              </a>
            </div>
          </div>
        </section>

        {/* Featured cities — full-width editorial rows, alternating composition,
            verified hero photography, live stat bands, honest sentences. */}
        <section className="section towns" id="featured-cities">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">Central Oregon</span>
              <h2 className="sec-title display">Where do you<br />want to live?</h2>
            </div>

            <div>
              {featured.map((city, i) => (
                <article
                  key={city.slug}
                  className="py-8 md:py-10 first:pt-8"
                  style={{ borderBottom: 'var(--edge) solid var(--navy)' }}
                >
                  <div className="grid gap-5 md:gap-10 md:items-center md:grid-cols-12">
                    {/* Verified photo — alternates sides on desktop for editorial rhythm */}
                    <a
                      href={`/cities/${city.slug}`}
                      className={`relative block overflow-hidden aspect-[16/10] md:aspect-[4/3] md:col-span-5 ${
                        i % 2 === 1 ? 'md:order-2' : ''
                      }`}
                      style={{ border: 'var(--edge) solid var(--navy)' }}
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
                        <span className="hero-caption">Regional view · Cascade Range</span>
                      )}
                    </a>

                    {/* Editorial content */}
                    <div className={`md:col-span-7 ${i % 2 === 1 ? 'md:order-1' : ''}`}>
                      <a href={`/cities/${city.slug}`} className="group inline-block">
                        <h3
                          className="display"
                          style={{
                            fontSize: 'clamp(2rem, 4.4vw, 3.4rem)',
                            lineHeight: 0.92,
                          }}
                        >
                          {city.name}
                        </h3>
                      </a>

                      {city.sentence ? (
                        <p
                          className="mt-3 max-w-prose"
                          style={{ color: 'var(--navy-70)', fontSize: 'clamp(.95rem,1.5vw,1.1rem)', lineHeight: 1.5 }}
                        >
                          {city.sentence}
                        </p>
                      ) : null}

                      {/* Live stat band — tabular numerals, honest em-dash empties */}
                      <div className="mt-6 flex flex-wrap items-baseline gap-x-9 gap-y-4">
                        <div>
                          <p className="display mono-num" style={{ fontSize: 'clamp(1.6rem,4vw,2.3rem)', lineHeight: 1 }}>
                            {city.activeCount != null && city.activeCount > 0
                              ? city.activeCount.toLocaleString()
                              : '—'}
                          </p>
                          <p className="mono-lab" style={{ color: 'var(--navy-70)', marginTop: '7px' }}>
                            Active
                          </p>
                        </div>
                        <div>
                          <p className="display mono-num" style={{ fontSize: 'clamp(1.6rem,4vw,2.3rem)', lineHeight: 1 }}>
                            {fmtK(city.medianListPrice) ?? '—'}
                          </p>
                          <p className="mono-lab" style={{ color: 'var(--navy-70)', marginTop: '7px' }}>
                            Median list
                          </p>
                        </div>
                        {/* "Median on market" here and "Median to pending" on the
                            city's own detail page measure two different things
                            (how long CURRENT actives have been listed, vs. how
                            fast RECENT listings went pending) — the same-sounding
                            label with a 4x-different number read as a
                            contradiction between the two pages (design-audit P3).
                            Label now names which population it's measuring. */}
                        {city.medianDom != null ? (
                          <div>
                            <p className="display mono-num" style={{ fontSize: 'clamp(1.6rem,4vw,2.3rem)', lineHeight: 1 }}>
                              {Math.round(city.medianDom)}
                              <span className="font-sans text-xs font-medium" style={{ color: 'var(--navy-70)', marginLeft: '5px' }}>days</span>
                            </p>
                            <p className="mono-lab" style={{ color: 'var(--navy-70)', marginTop: '7px' }}>
                              Active listings' median age
                            </p>
                          </div>
                        ) : null}
                        {city.verdict ? (
                          <span
                            className="self-center mono-lab"
                            style={{
                              border: '1px solid var(--navy)',
                              borderRadius: '3px',
                              padding: '6px 12px',
                              color: 'var(--navy)',
                            }}
                          >
                            {city.verdict}
                          </span>
                        ) : null}
                      </div>

                      {/* Links into the city */}
                      <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
                        <a
                          href={`/cities/${city.slug}`}
                          className="underline-offset-4 hover:underline"
                          style={{ color: 'var(--navy)' }}
                        >
                          {city.name} guide
                        </a>
                        <a
                          href={`/homes-for-sale/${city.slug}`}
                          className="underline-offset-4 hover:underline"
                          style={{ color: 'var(--navy)' }}
                        >
                          Homes for sale
                        </a>
                        <a
                          href={`/open-houses/${city.slug}`}
                          className="underline-offset-4 hover:underline"
                          style={{ color: 'var(--navy)' }}
                        >
                          Open houses
                        </a>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Other cities: compact ledger */}
        {others.length > 0 ? (
          <section
            className="section towns"
            id="other-cities"
            style={{ background: 'rgba(16,39,66,0.04)' }}
          >
            <div className="wrap">
              {/* Reworded off "Other Central Oregon cities" — at the shared
                  .sec-title size it echoed the page H1 ("Central Oregon
                  Cities") closely enough that a scrolling visitor read it as
                  the page starting over (design-audit P3). */}
              <div className="sec-head">
                <span className="sec-index">More areas</span>
                <h2 className="sec-title display">Smaller towns<br />on the ledger</h2>
              </div>

              <div className="max-w-2xl pt-2" style={{ borderTop: '1px solid var(--navy-12)' }}>
                {others.map((city) => {
                  const snap = snapshotBySlug.get(city.slug)
                  const active = snap?.activeCount ?? city.activeCount
                  const median = snap?.medianPrice ?? city.medianPrice

                  return (
                    <a
                      key={city.slug}
                      href={`/cities/${city.slug}`}
                      className="group flex items-center justify-between gap-4 py-3"
                      style={{ borderBottom: '1px solid var(--navy-12)' }}
                    >
                      <span className="text-sm font-semibold" style={{ color: 'var(--navy)' }}>
                        {city.name}
                      </span>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        {active > 0 ? (
                          <span className="text-xs mono-num" style={{ color: 'var(--navy-70)' }}>
                            {active} {active === 1 ? 'home' : 'homes'}
                          </span>
                        ) : null}
                        {median != null ? (
                          <span className="text-xs mono-num" style={{ color: 'var(--navy-70)' }}>
                            ${Math.round(median / 1000).toLocaleString()}K
                          </span>
                        ) : null}
                        <span aria-hidden className="arr" style={{ color: 'var(--navy-70)' }}>
                          →
                        </span>
                      </div>
                    </a>
                  )
                })}
              </div>
            </div>
          </section>
        ) : null}

        {/* Search CTA: navy band */}
        <section className="section region" id="search-cta" aria-label="Search Central Oregon listings">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">Central Oregon</span>
              <h2 className="sec-title display">Find your home<br />in Central Oregon</h2>
            </div>
            <div className="max-w-xl pt-6 pb-12">
              <p className="neigh-sub" style={{ margin: 0 }}>
                Search active listings across all cities with live filters for price, beds, and location.
              </p>
              <div className="sec-cta" style={{ gap: '12px', flexWrap: 'wrap', display: 'flex' }}>
                <a href="/search" className="btn">
                  Search all listings <span className="arr">→</span>
                </a>
                <a href="/lp/buyer-listing-alerts" className="btn ghost">
                  Get listing alerts
                </a>
              </div>
            </div>
          </div>
        </section>

        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}
