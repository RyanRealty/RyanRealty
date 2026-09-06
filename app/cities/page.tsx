// brand-voice:exempt
/**
 * Cities index — A–Z directory of Central Oregon cities.
 *
 * PAGE_INVENTORY §3: live counts on the rows, doors. Not a mini-Bend KPI
 * Instrument. Caption carries the region count and months-of-supply verdict.
 *
 * Parity contract: design_system/ryan-realty/ui_kits/cities/parity.json
 */

import { valuationHref } from '@/lib/site/valuation-href'
import type { Metadata } from 'next'
import { getCitiesForIndex } from '@/app/actions/cities'
import { sortCitiesWithPrimaryFirst } from '@/lib/cities'
import { getAllCitySnapshots } from '@/lib/data'
import { getDetachedOverlays } from '@/lib/data/market-truth/getSellBendMarket'
import { leftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import { EMPTY_PUBLIC_PACE } from '@/lib/data/market-truth/public-pace'
import { getCityContent } from '@/lib/city-content'
import { cityHero, preferPlaceHero } from '@/lib/geo-images'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import { formatCount } from '@/lib/format/count'
import { formatDate } from '@/lib/format/date'
import { formatMonthsOfSupply, monthsOfSupplyVerdict } from '@/lib/format/months-of-supply'
import { formatIndexMedianUsd } from '@/lib/market/publish-index-median'
import { pageMetadata } from '@/lib/site/page-metadata'
import { buildMarketFaq, type MarketFaqInput } from '@/lib/site/market-faq'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import {
  V3Breadcrumb,
  V3Footer,
  V3Ledger,
  V3Quiet,
  V3SectionTracker,
  V3_FOOTER_COLUMNS,
  V3_ROOT_CLASS,
  v3Text,
  type V3LedgerFigureRow,
  type V3QuietItem,
} from '@/components/site/v3'
import { RegionalAlertSheet } from '@/app/central-oregon/_v3/RegionalAlertSheet.client'
import { cityFeaturedLinks } from '@/app/cities/CityFeaturedLinks'
import {
  CITY_SENTENCE_FALLBACK,
  FEATURED_CITY_SLUGS,
  firstSentence,
  indexBarWeight,
  liveForSaleLabel,
} from '@/app/cities/_v3/cities-index-constants'
import type { SchemaInput } from '@/lib/site/json-ld'

export const revalidate = 1800

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const metadata: Metadata = pageMetadata({
  title: 'Central Oregon cities: Bend, Redmond, Sisters',
  description:
    'Active single-family homes in Bend, Redmond, Sisters, Sunriver, La Pine, Prineville, and the rest of Central Oregon. Live inventory and pricing from the regional MLS.',
  path: '/cities',
})

const FEATURED_TRACE =
  'live MLS through Oregon Data Share, active single-family listings in each city. The median is the list price of those same listings, and the verdict is the months-of-supply reading behind it'

const OTHERS_TRACE =
  'live MLS through Oregon Data Share, the city snapshot row for each remaining Central Oregon city: active single-family count and the median list price of those listings'

function fmtMedian(n: number | null | undefined): string | null {
  return formatIndexMedianUsd(n)
}

export default async function CitiesPage() {
  const [allCities, allSnapshots, overlays] = await Promise.all([
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
  ])
  const regionMt = overlays.get('region:central-oregon')
  const hud = leftoverHudKpis({
    grain: 'region',
    headlines: regionMt?.headlines ?? null,
    inventory: regionMt?.inventory ?? null,
    pace: EMPTY_PUBLIC_PACE,
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

  const featured = FEATURED_CITY_SLUGS.filter(
    (slug) => cityNameBySlug.has(slug) || snapshotBySlug.has(slug) || overlays.has(`city:${slug}`),
  ).map((slug) => {
    const name =
      cityNameBySlug.get(slug) ??
      slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    const layers = overlays.get(`city:${slug}`)
    const leftoverActive = layers?.headlines?.activeCount ?? layers?.inventory?.activeCount ?? null
    const leftoverMedian = layers?.headlines?.medianListPrice ?? layers?.inventory?.medianListPrice ?? null
    const content = getCityContent(name)
    const sentence = content?.description
      ? firstSentence(content.description)
      : CITY_SENTENCE_FALLBACK[slug] ?? null
    const fallbackHero = cityHero(slug)
    const liveHero = allCities.find((c) => c.slug === slug)?.heroImageUrl
    const src = preferPlaceHero(liveHero, fallbackHero.src)
    return {
      slug,
      name,
      hero: {
        ...fallbackHero,
        src,
        verified: Boolean(liveHero?.trim()) || fallbackHero.verified,
      },
      sentence,
      activeCount: leftoverActive,
      medianListPrice: leftoverMedian,
    }
  })

  const featuredSlugs = new Set<string>(featured.map((f) => f.slug))
  const others = visibleCities.filter((c) => featuredSlugs.has(c.slug) === false)

  const ledgerSlugs = new Set<string>([...featuredSlugs, ...others.map((c) => c.slug)])
  const ledgerRowStamps = allSnapshots
    .filter((s) => ledgerSlugs.has(s.geoKey.replace(/\s+/g, '-')))
    .map((s) => s.refreshedAt)
    .filter((s): s is string => Boolean(s))
  const ledgerStamp = ledgerRowStamps.length > 0
    ? ledgerRowStamps.reduce((oldest, cur) => (cur < oldest ? cur : oldest))
    : null

  const totalActive: number | null = hud.active
  const leftoverStamp = regionMt?.headlines?.computedAt ?? regionMt?.inventory?.computedAt ?? null
  const pulse: MarketFaqInput | null = {
    grain: 'region',
    source: 'market-truth',
    activeCount: hud.active,
    medianListPrice: hud.medianList,
    monthsOfSupply: hud.monthsSupply,
    medianDaysToPending: hud.daysToPending,
    soldCount12mo: null,
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

  const directory: Array<{
    slug: string
    name: string
    sentence: string | null
    activeCount: number | null
    medianListPrice: number | null
    mediaSrc: string | undefined
  }> = [
    ...featured.map((city) => ({
      slug: city.slug,
      name: city.name,
      sentence: city.sentence,
      activeCount: city.activeCount,
      medianListPrice: city.medianListPrice,
      mediaSrc: city.hero.verified ? city.hero.src : undefined,
    })),
    ...others.map((city) => {
      const snap = snapshotBySlug.get(city.slug)
      return {
        slug: city.slug,
        name: city.name,
        sentence: null as string | null,
        activeCount: snap ? snap.activeCount : city.activeCount,
        medianListPrice: snap ? snap.medianPrice : city.medianPrice,
        mediaSrc: undefined as string | undefined,
      }
    }),
  ].sort((a, b) => a.name.localeCompare(b.name))

  const publishedCounts = directory.map((row) => row.activeCount).filter((n): n is number => n != null)
  const maxCount = publishedCounts.length > 0 ? Math.max(...publishedCounts) : 0
  const countsPublishable = directory.length > 0 && directory.every((row) => row.activeCount != null)

  const figureRows: V3LedgerFigureRow[] = directory.map((city) => {
    const median = fmtMedian(city.medianListPrice)
    const bits = [median ? `Median list ${median}` : null, city.sentence].filter(Boolean)
    return {
      id: city.slug,
      href: `/cities/${city.slug}`,
      when: v3Text('Oregon'),
      what: v3Text(city.name),
      detail: bits.length > 0 ? v3Text(bits.join(' · ')) : undefined,
      value: v3Text(liveForSaleLabel(city.activeCount ?? 0)),
      weight: indexBarWeight(city.activeCount, maxCount),
      media: city.mediaSrc ? { src: city.mediaSrc } : undefined,
      ariaLabel: v3Text(`Homes for sale in ${city.name}, Oregon`),
    }
  })
  const [firstFeatured, ...restFeatured] = figureRows

  const cityDoors: V3QuietItem[] = featured.flatMap((city) =>
    cityFeaturedLinks(city.slug, city.name),
  )

  const mosText = hud.monthsSupply != null ? formatMonthsOfSupply(hud.monthsSupply) : null
  const regionVerdict = monthsOfSupplyVerdict(hud.monthsSupply)
  const directoryNote = [
    totalActive != null && totalActive > 0
      ? `${formatCount(totalActive)} homes for sale across these cities.`
      : null,
    mosText && regionVerdict ? `${regionVerdict.label} at ${mosText} months of supply.` : null,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />

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

        {firstFeatured ? (
          <V3Ledger
            id="featured-cities"
            headingLevel={1}
            eyebrow={v3Text('Central Oregon')}
            heading={v3Text('Central Oregon cities')}
            note={v3Text(
              directoryNote || 'Live single-family inventory from the regional MLS.',
            )}
            rows={[firstFeatured, ...restFeatured]}
            encode={countsPublishable ? 'bar' : undefined}
            source={v3Text(FEATURED_TRACE + '. Remaining cities: ' + OTHERS_TRACE)}
            updated={ledgerStamp ? v3Text(formatDate(ledgerStamp)) : undefined}
            action={{ label: v3Text('Search all listings'), href: '/search', variant: 'primary' }}
          />
        ) : (
          <V3Ledger
            id="featured-cities"
            headingLevel={1}
            heading={v3Text('Central Oregon cities')}
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

        <RegionalAlertSheet placeLabel="Central Oregon" city="" />

        <V3Quiet
          id="edges"
          eyebrow="Central Oregon"
          heading="Search every listing in Central Oregon"
          items={[
            { label: 'Search all listings', href: '/search' },
            { label: 'Value my home', href: valuationHref('/cities') },
            { label: 'Communities', href: '/communities' },
            { label: 'Neighborhoods', href: '/neighborhoods' },
            { label: 'Subdivisions', href: '/subdivisions' },
            { label: 'Oregon Data Share', href: 'https://www.oregondatashare.com' },
          ]}
          note="Filter by price, beds, and location across every city on the list. Oregon Data Share is the regional MLS cooperative behind the live listing and market data on this page."
        />
      </main>

      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
