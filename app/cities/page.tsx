// brand-voice:exempt
/**
 * Cities index — Central Oregon city by city, on components/site/v3.
 *
 * PUBLIC_UI.md (locked 2026-08-11) section 3 and the city grain (2026-08-14):
 * the first screen is doors to cities carrying name, median, months of supply
 * and count. Four patterns, no two adjacent sharing one:
 *
 *   Instrument  the live region pulse: active count, median list, months of
 *               supply with its verdict, pending now, days to contract.
 *   Ledger      one row per featured city, every row a door, the live count in
 *               the value column and the verdict in the context column.
 *   Quiet       the second, third and fourth door per city (guide, inventory,
 *               open houses, and Bend's luxury page), then the page's outbound
 *               edges and the Oregon Data Share citation MarketSources carried.
 *   Sheet       the free SFR listing-alert capture (RegionalAlertSheet — the
 *               same server action and the same payload the KB band posted).
 *
 * Nothing was dropped in the move off the KB register: every figure, every
 * sentence, every link, and both JSON-LD payloads are still here. Chrome is
 * layout-owned; the footer is route-owned and sits outside <main>.
 *
 * Parity contract: design_system/ryan-realty/ui_kits/cities/parity.json
 */

import type { Metadata } from 'next'
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
import { formatCount } from '@/lib/format/count'
import { formatDate } from '@/lib/format/date'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { formatIndexMedianUsd } from '@/lib/market/publish-index-median'
import { pageMetadata } from '@/lib/site/page-metadata'
import { buildMarketFaq, type MarketFaqInput } from '@/lib/site/market-faq'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import {
  V3Breadcrumb,
  V3Footer,
  V3Instrument,
  V3Ledger,
  V3Quiet,
  V3SectionTracker,
  V3_FOOTER_COLUMNS,
  V3_ROOT_CLASS,
  v3Text,
  type V3InstrumentFigure,
  type V3LedgerFigureRow,
  type V3QuietItem,
} from '@/components/site/v3'
import { RegionalAlertSheet } from '@/app/central-oregon/_v3/RegionalAlertSheet.client'
import { cityFeaturedLinks } from '@/app/cities/CityFeaturedLinks'
import type { SchemaInput } from '@/lib/site/json-ld'

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

/** The section 0 traces. Both name the population every figure came from. */
const PULSE_TRACE =
  'live MLS through Oregon Data Share, single-family homes only, Central Oregon region. Every figure names its own window on its label'

const FEATURED_TRACE =
  'live MLS through Oregon Data Share, active single-family listings in each city. The median is the list price of those same listings, and the verdict is the months-of-supply reading behind it'

const OTHERS_TRACE =
  'live MLS through Oregon Data Share, the city snapshot row for each remaining Central Oregon city: active single-family count and the median list price of those listings'

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

  /* ---- Instrument: the live region pulse ---------------------------------- */

  const regionFigures: V3InstrumentFigure[] = []
  if (totalActive != null && totalActive > 0) {
    regionFigures.push({
      value: v3Text(formatCount(totalActive)),
      label: v3Text('Active homes'),
    })
  }
  const regionMedianText = fmtMedian(regionMedian)
  if (regionMedianText) {
    regionFigures.push({ value: v3Text(regionMedianText), label: v3Text('Median list price') })
  }
  // The stat is the number; the verdict is a sub-line under it (it used to be
  // the verdict alone under "MONTHS OF SUPPLY" — a word where a number was
  // promised, design-audit P2).
  if (hud.monthsSupply != null) {
    regionFigures.push({
      value: v3Text(`${formatMonthsOfSupply(hud.monthsSupply)} mo`),
      label: v3Text(`Months of supply${regionVerdict ? ` · ${regionVerdict}` : ''}`),
    })
  }
  if (regionPace.pendingCount != null) {
    regionFigures.push({
      value: v3Text(formatCount(regionPace.pendingCount)),
      label: v3Text('Pending · now'),
    })
  }
  if (regionPace.daysToContract != null) {
    regionFigures.push({
      value: v3Text(formatCount(regionPace.daysToContract)),
      label: v3Text('Days to contract · 12 months'),
    })
  }
  const [leadFigure, ...restFigures] = regionFigures

  /* ---- Ledger: the featured cities ---------------------------------------- */

  const featuredRows: V3LedgerFigureRow[] = featured.map((city) => {
    const median = fmtMedian(city.medianListPrice)
    const bits = [
      median ? `Median list ${median}` : null,
      city.leftover?.pendingCount != null ? `${formatCount(city.leftover.pendingCount)} pending now` : null,
      city.leftover?.daysToContract != null
        ? `${formatCount(city.leftover.daysToContract)} days to contract · 12 months`
        : null,
      ...(city.leftover?.extras ?? []).map((item) => `${item.value} ${item.noun} for sale`),
      city.sentence,
    ].filter(Boolean)
    return {
      id: city.slug,
      href: `/cities/${city.slug}`,
      when: v3Text(city.verdict ?? 'Central Oregon'),
      what: v3Text(city.name),
      detail: bits.length > 0 ? v3Text(bits.join(' · ')) : undefined,
      value: v3Text(
        city.activeCount != null && city.activeCount > 0
          ? `${formatCount(city.activeCount)} for sale`
          : 'None listed now',
      ),
      // Only a VERIFIED city photograph. The regional Cascade frame is a
      // fallback, and the Ledger's media slot takes no fallbacks.
      media: city.hero.verified ? { src: city.hero.src } : undefined,
      ariaLabel: v3Text(`Homes for sale in ${city.name}, Oregon`),
    }
  })
  const [firstFeatured, ...restFeatured] = featuredRows

  /* ---- Quiet: the rest of each city's doors -------------------------------- */

  const cityDoors: V3QuietItem[] = featured.flatMap((city) =>
    cityFeaturedLinks(city.slug, city.name),
  )

  /* ---- Ledger: the rest of Central Oregon ---------------------------------- */

  const otherRows: V3LedgerFigureRow[] = others.map((city) => {
    const snap = snapshotBySlug.get(city.slug)
    const active = snap ? snap.activeCount : city.activeCount
    const median = snap ? snap.medianPrice : city.medianPrice
    const medianText = fmtMedian(median)
    return {
      id: city.slug,
      href: `/cities/${city.slug}`,
      when: v3Text('Central Oregon'),
      what: v3Text(city.name),
      detail: medianText ? v3Text(`Median list ${medianText}`) : undefined,
      value: v3Text(
        active != null && active > 0 ? `${formatCount(active)} for sale` : 'None listed now',
      ),
    }
  })
  const [firstOther, ...restOthers] = otherRows

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />

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

        <V3Breadcrumb trail={[{ label: 'Home', href: '/' }, { label: 'Cities' }]} />

        {leadFigure ? (
          <V3Instrument
            id="region-pulse"
            level={1}
            eyebrow={v3Text('Live market')}
            headline={v3Text('Central Oregon, city by city.')}
            note={v3Text(
              'Bend, Redmond, Sisters, Sunriver, and the high desert towns around them. Live inventory and pricing from the regional MLS, refreshed through the day.',
            )}
            figures={[leadFigure, ...restFigures]}
            source={v3Text(PULSE_TRACE)}
            updated={leftoverStamp ? v3Text(formatDate(leftoverStamp)) : undefined}
            action={{ label: v3Text('Search all listings'), href: '/search', variant: 'primary' }}
          />
        ) : null}

        {/* ONE LEDGER OF EVERY CITY (2026-08-27). This page's own target says
            "a ledger of Central Oregon cities, NOT a link farm", and it rendered
            THREE overlapping city lists -- a featured ledger, a per-city filter
            Quiet, and a "rest of" ledger -- which is the link farm it names.
            The two city LEDGERS are one now: every city, one list, featured
            first (they carry the richer leftover rows), each row a door. The
            filter-doors Quiet survives below as genuinely different content
            (deep search links, and ci:westside-backlog pins the Bend luxury
            door inside it). */}
        {firstFeatured ? (
          <V3Ledger
            id="featured-cities"
            eyebrow={v3Text('Central Oregon')}
            heading={v3Text('Every city, and what is listed there')}
            rows={[firstFeatured, ...restFeatured, ...(firstOther ? [firstOther, ...restOthers] : [])]}
            source={v3Text(FEATURED_TRACE + '. Remaining cities: ' + OTHERS_TRACE)}
          />
        ) : (
          <V3Ledger
            id="featured-cities"
            eyebrow={v3Text('Central Oregon')}
            heading={v3Text('Every city, and what is listed there')}
            rows={[]}
            emptyMessage={v3Text('The city index returned no city on this refresh.')}
          />
        )}

        {cityDoors.length > 0 ? (
          <V3Quiet
            id="city-doors"
            eyebrow="Straight to the listings"
            heading="Every city, every door"
            items={cityDoors}
          />
        ) : null}

        {/* Free listing_alerts, mid page. Same server action and payload the KB
            band posted. */}
        <RegionalAlertSheet placeLabel="Central Oregon" city="" />

        <V3Quiet
          id="edges"
          eyebrow="Central Oregon"
          heading="Search every listing in Central Oregon"
          items={[
            { label: 'Search all listings', href: '/search' },
            { label: 'Value my home', href: '/sell/valuation' },
            { label: 'Communities', href: '/communities' },
            { label: 'Neighborhoods', href: '/neighborhoods' },
            { label: 'Recorded plats', href: '/subdivisions' },
            { label: 'Oregon Data Share', href: 'https://www.oregondatashare.com' },
          ]}
          note="Filter by price, beds, and location across every city on the list. Oregon Data Share is the regional MLS cooperative behind the live listing and market data on this page."
        />
      </main>

      {/* Outside <main> on purpose. HTML-AAM maps <footer> to role=contentinfo
          only when it is NOT nested in sectioning content. */}
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
