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
 *   4. Mid-page RegionalSfrAlertsBand + navy search CTA.
 *
 * Section telemetry: KbSectionTracker. DAL figures only. PublicNav from layout.
 *
 * Parity contract: design_system/ryan-realty/ui_kits/cities/parity.json
 */

import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { getCitiesForIndex } from '@/app/actions/cities'
import { sortCitiesWithPrimaryFirst } from '@/lib/cities'
import { getAllCitySnapshots } from '@/lib/data'
import { getDetachedOverlays } from '@/lib/data/market-truth/getSellBendMarket'
import { leftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import { EMPTY_PUBLIC_PACE, getPublicDetachedPace } from '@/lib/data/market-truth/public-pace'
import { getPublicPlaceSegments, publicSegmentItems } from '@/lib/data/market-truth/public-segments'
import { getCityContent } from '@/lib/city-content'
import { cityHero } from '@/lib/geo-images'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { formatIndexMedianUsd } from '@/lib/market/publish-index-median'
import { pageMetadata } from '@/lib/site/page-metadata'
import { buildMarketFaq, type MarketFaqInput } from '@/lib/site/market-faq'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { MarketSources } from '@/components/site/MarketSources'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import { RegionalSfrAlertsBand } from '@/components/site/kb/RegionalSfrAlertsBand'
import { CityFeaturedLinks } from '@/app/cities/CityFeaturedLinks'
import type { SchemaInput } from '@/lib/site/json-ld'
import '@/components/site/kb/kb.css'

// Statically cached, revalidated every 30 minutes.
export const revalidate = 1800

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const metadata: Metadata = pageMetadata({
  // Kept short enough that the " | Ryan Realty" template suffix still lands
  // inside the ~60-char SERP display budget (46 chars resolved).
  title: 'Central Oregon cities: Bend, Redmond, Sisters',
  description:
    'Active single-family homes in Bend, Redmond, Sisters, Sunriver, La Pine, Prineville, and the rest of Central Oregon. Live inventory and pricing from the regional MLS.',
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
  'la-pine': 'Larger lots and ponderosa forest at the southern end of Deschutes County.',
  tumalo: 'An unincorporated community on the Deschutes River between Bend and Sisters, with acreage lots and river access.',
  terrebonne: 'Home to Smith Rock State Park, with farm parcels above the Crooked River canyon.',
  'powell-butte': 'Ranch and acreage country between Bend and Prineville, with open Cascade views.',
  culver: 'A farm town near Lake Billy Chinook and The Cove Palisades State Park.',
  'crooked-river-ranch': 'A canyon-rim community with its own golf course between Terrebonne and Madras.',
}

function firstSentence(text: string): string {
  const m = text.match(/^.*?[.?](?=\s|$)/)
  return (m ? m[0] : text).trim()
}

function fmtMedian(n: number | null | undefined): string | null {
  // Exact whole dollars — same as the city page hero. Thousand-rounding
  // made /cities La Pine $500,000 against /cities/la-pine $499,900.
  return formatIndexMedianUsd(n)
}

function verdictFromMos(mos: number | null): string | null {
  if (mos == null) return null
  if (mos <= 4) return "Seller's market"
  if (mos >= 6) return "Buyer's market"
  return 'Balanced market'
}

export default async function CitiesPage() {
  const [allCities, allSnapshots, overlays, regionPace] = await Promise.all([
    getCitiesForIndex(),
    getAllCitySnapshots(),
    withTimeoutFallback(
      getDetachedOverlays([
        { geoType: 'region', geoSlug: 'central-oregon' },
        ...FEATURED_CITY_SLUGS.map((slug) => ({ geoType: 'city' as const, geoSlug: slug })),
      ]),
      new Map(),
      3500,
      'cities:leftoverOverlays',
    ),
    withTimeoutFallback(
      getPublicDetachedPace({ geoType: 'region', geoSlug: 'central-oregon' }),
      EMPTY_PUBLIC_PACE,
      3000,
      'cities:regionPace',
    ),
  ])
  const regionMt = overlays.get('region:central-oregon')
  const hud = leftoverHudKpis({
    grain: 'region',
    headlines: regionMt?.headlines ?? null,
    inventory: regionMt?.inventory ?? null,
    pace: regionPace,
  })

  const sortedCities = sortCitiesWithPrimaryFirst(allCities)
  const visibleCities = sortedCities.slice(0, 60)

  const snapshotBySlug = new Map<string, { activeCount: number | null; medianPrice: number | null }>()
  for (const s of allSnapshots) {
    snapshotBySlug.set(s.geoKey.replace(/\s+/g, '-'), {
      activeCount: s.activeSfrCount,
      medianPrice: s.medianListPrice != null ? Math.round(s.medianListPrice) : null,
    })
  }

  const cityNameBySlug = new Map(visibleCities.map((c) => [c.slug, c.name]))

  const featuredBase = FEATURED_CITY_SLUGS.filter(
    (slug) => cityNameBySlug.has(slug) || snapshotBySlug.has(slug) || overlays.has(`city:${slug}`),
  ).map((slug) => {
    const name =
      cityNameBySlug.get(slug) ??
      slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    const layers = overlays.get(`city:${slug}`)
    const leftoverActive = layers?.headlines?.activeCount ?? layers?.inventory?.activeCount ?? null
    const leftoverMedian = layers?.headlines?.medianListPrice ?? layers?.inventory?.medianListPrice ?? null
    const leftoverMos = layers?.headlines?.monthsOfSupply ?? null
    const content = getCityContent(name)
    const sentence = content?.description
      ? firstSentence(content.description)
      : CITY_SENTENCE_FALLBACK[slug] ?? null
    return {
      slug,
      name,
      hero: cityHero(slug),
      sentence,
      activeCount: leftoverActive,
      medianListPrice: leftoverMedian,
      medianDom: null as number | null,
      verdict: verdictFromMos(leftoverMos),
    }
  })

  const leftoverBySlug = await Promise.all(
    featuredBase.map(async (city) => {
      const [pace, segs] = await Promise.all([
        withTimeoutFallback(
          getPublicDetachedPace({ geoType: 'city', geoSlug: city.slug }),
          EMPTY_PUBLIC_PACE,
          3000,
          `cities:pace:${city.slug}`,
        ),
        withTimeoutFallback(
          getPublicPlaceSegments({ geoType: 'city', geoSlug: city.slug }),
          [],
          3000,
          `cities:segments:${city.slug}`,
        ),
      ])
      return {
        pendingCount: pace.pendingCount,
        daysToContract: pace.daysToContract,
        extras: publicSegmentItems(segs, city.slug).filter(
          (item) => item.key === 'condo' || item.key === 'townhome',
        ),
      }
    }),
  )
  const featured = featuredBase.map((city, i) => ({
    ...city,
    leftover: leftoverBySlug[i] ?? { pendingCount: null, daysToContract: null, extras: [] },
  }))

  const featuredSlugs = new Set(featured.map((f) => f.slug))
  const others = visibleCities.filter((c) => featuredSlugs.has(c.slug) === false)

  const totalActive: number | null = hud.active
  const regionMedian = hud.medianList
  const regionVerdict = verdictFromMos(hud.monthsSupply)

  const leftoverStamp = regionMt?.headlines?.computedAt ?? regionMt?.inventory?.computedAt ?? null
  const pulse: MarketFaqInput | null = {
    grain: 'region',
    source: 'market-truth',
    activeCount: hud.active,
    medianListPrice: hud.medianList,
    monthsOfSupply: hud.monthsSupply,
    medianDaysToPending: hud.daysToPending,
    soldCount12mo: regionPace.closedCount ?? null,
    pulseActiveCount: hud.active,
    refreshedAt: leftoverStamp,
  }
  const latestSnapshotAt = allSnapshots.reduce<string | null>(
    (latest, s) => (latest == null || s.refreshedAt > latest ? s.refreshedAt : latest),
    null,
  )
  const regionFaqInput: MarketFaqInput = pulse ?? { grain: 'region', activeCount: totalActive, refreshedAt: latestSnapshotAt }
  const { datasetVariables: regionDatasetVars, asOfIso: regionAsOfIso } = buildMarketFaq(
    'Central Oregon',
    regionFaqInput,
  )

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Cities', url: '/cities' },
      ],
    },
  ]

  if (regionDatasetVars.length > 0) {
    schemas.push({
      type: 'dataset',
      name: `Central Oregon cities, Oregon real estate market statistics${regionAsOfIso ? `, ${regionAsOfIso}` : ''}`,
      description:
        'Live single-family home market data across Central Oregon cities. Includes region active inventory, ' +
        'median list price, and months of supply. Sourced from Oregon Data Share via Ryan Realty.',
      url: '/cities',
      dateModified: regionAsOfIso ?? undefined,
      spatialCoverageName: 'Central Oregon, OR',
      variableMeasured: regionDatasetVars,
    })
  }

  return (
    <main className="kb-root">
      <KbSectionTracker />

      {/* Structured data: breadcrumb + CollectionPage + ItemList of city pages */}
      <MetadataBlock schemas={schemas} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'Central Oregon cities',
            description: 'Active single-family homes in Bend, Redmond, Sisters, and the rest of Central Oregon. Live inventory from the regional MLS.',
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
              <h1 className="sec-title display">Central Oregon, <br />city by city.</h1>
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
                  {totalActive != null && totalActive > 0 ? totalActive.toLocaleString() : '—'}
                </span>
                <span className="stat-label">Active homes</span>
              </div>
              <div className="stat-cell">
                <span className="stat-num mono-num">{fmtMedian(regionMedian) ?? '—'}</span>
                <span className="stat-label">Median list price</span>
              </div>
              {/* The stat is the number; the verdict is a sub-line under it (was
                  the verdict alone under "MONTHS OF SUPPLY" — a word where a
                  number was promised, design-audit P2). */}
              {hud.monthsSupply != null ? (
                <div className="stat-cell">
                  <span className="stat-num mono-num">
                    {formatMonthsOfSupply(hud.monthsSupply)} mo
                  </span>
                  <span className="stat-label">Months of supply{regionVerdict ? ` · ${regionVerdict}` : ''}</span>
                </div>
              ) : null}
              {regionPace.pendingCount != null ? (
                <div className="stat-cell">
                  <span className="stat-num mono-num">{regionPace.pendingCount.toLocaleString()}</span>
                  <span className="stat-label">Pending · now</span>
                </div>
              ) : null}
              {regionPace.daysToContract != null ? (
                <div className="stat-cell">
                  <span className="stat-num mono-num">{regionPace.daysToContract}</span>
                  <span className="stat-label">Days to contract · 12 months</span>
                </div>
              ) : null}
            </div>
            <div className="region-foot">
              <p className="note">
                Single-family homes only. Figures come from the regional MLS.
              </p>
              <Link href="/search" className="btn">
                Search all listings <span className="arr">→</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Featured cities — full-width editorial rows, alternating composition,
            verified hero photography, live stat bands, honest sentences. */}
        <section className="section towns" id="featured-cities">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">Central Oregon</span>
              <h2 className="sec-title display">Pick a city. <br />See what is listed.</h2>
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

                      {/* Live stat band — tabular numerals, honest em-dash empties.
                          design-audit STA-5: a featured city with zero inventory
                          showed "— Active / — Median" (two bare dashes, reading as
                          broken). Show a single honest state when there is no data. */}
                      {(city.activeCount != null && city.activeCount > 0) || city.medianListPrice != null ? (
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
                            {fmtMedian(city.medianListPrice) ?? '—'}
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
                              Active listings&apos; median age
                            </p>
                          </div>
                        ) : null}
                        {city.leftover?.pendingCount != null ? (
                          <div>
                            <p className="display mono-num" style={{ fontSize: 'clamp(1.6rem,4vw,2.3rem)', lineHeight: 1 }}>
                              {city.leftover.pendingCount.toLocaleString()}
                            </p>
                            <p className="mono-lab" style={{ color: 'var(--navy-70)', marginTop: '7px' }}>
                              Pending now
                            </p>
                          </div>
                        ) : null}
                        {city.leftover?.daysToContract != null ? (
                          <div>
                            <p className="display mono-num" style={{ fontSize: 'clamp(1.6rem,4vw,2.3rem)', lineHeight: 1 }}>
                              {city.leftover.daysToContract}
                              <span className="font-sans text-xs font-medium" style={{ color: 'var(--navy-70)', marginLeft: '5px' }}>days</span>
                            </p>
                            <p className="mono-lab" style={{ color: 'var(--navy-70)', marginTop: '7px' }}>
                              Days to contract · 12 months
                            </p>
                          </div>
                        ) : null}
                        {(city.leftover?.extras ?? []).map((item) => (
                          <div key={item.key}>
                            <p className="display mono-num" style={{ fontSize: 'clamp(1.6rem,4vw,2.3rem)', lineHeight: 1 }}>
                              {item.value}
                            </p>
                            <p className="mono-lab" style={{ color: 'var(--navy-70)', marginTop: '7px' }}>
                              {item.noun} for sale
                            </p>
                          </div>
                        ))}
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
                      ) : (
                        <p className="mono-lab" style={{ color: 'var(--navy-70)', marginTop: '24px' }}>
                          No active listings right now.{' '}
                          <a href={`/cities/${city.slug}`} style={{ color: 'var(--navy)', textDecoration: 'underline' }}>
                            See the market
                          </a>
                          .
                        </p>
                      )}

                      <CityFeaturedLinks slug={city.slug} name={city.name} />
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
                <h2 className="sec-title display">The rest of <br />Central Oregon</h2>
              </div>

              <div className="max-w-2xl pt-2" style={{ borderTop: '1px solid var(--navy-12)' }}>
                {others.map((city) => {
                  const snap = snapshotBySlug.get(city.slug)
                  const active = snap ? snap.activeCount : city.activeCount
                  const median = snap ? snap.medianPrice : city.medianPrice

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
                        {active != null && active > 0 ? (
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

        {/* Mid-page free listing_alerts (shared band — keeps this page under LOC budget). */}
        <RegionalSfrAlertsBand />

        {/* Search CTA: navy band */}
        <section className="section region" id="search-cta" aria-label="Search Central Oregon listings">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">Central Oregon</span>
              <h2 className="sec-title display">Search every listing <br />in Central Oregon</h2>
            </div>
            <div className="max-w-xl pt-6 pb-12">
              <p className="neigh-sub" style={{ margin: 0 }}>
                Filter by price, beds, and location across every city on the list.
              </p>
              <div className="sec-cta" style={{ gap: '12px', flexWrap: 'wrap', display: 'flex' }}>
                <Link href="/search" className="btn">
                  Search all listings <span className="arr">→</span>
                </Link>
                <Link href="/sell/valuation" className="btn ghost">
                  Value my home
                </Link>
              </div>
            </div>
          </div>
        </section>

        <MarketSources sources={['ods']} />
        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}
