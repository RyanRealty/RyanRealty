/**
 * /cities — Central Oregon cities index, on the components/site/v3 barrel.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md. First screenful opens the
 * Field of photographed homes, then Instrument (region pulse). Section order:
 * Breadcrumb, Field, Instrument, Ledger (cities), Sheet (SFR alerts), Quiet
 * (edges), Footer outside main.
 *
 * THE PAGE CONTRACT, carried across unchanged: pageMetadata title/description/path,
 * revalidate 1800, CollectionPage + ItemList JSON-LD, Dataset from the same region
 * pulse the Instrument prints, V3SectionTracker pageType="index", MetadataBlock
 * breadcrumb. Capture: submitSearchAlertSignup with city="" and propertyType A.
 *
 * KB-era deletions: KbBreadcrumb, KbFooter, SmoothScrollProvider, kb.css,
 * RegionalSfrAlertsBand (same capture, V3Sheet markup), MarketSources (Oregon
 * Data Share citation is the Instrument source line plus a Quiet edge), per-city
 * "homes for sale" and "open houses" links on the index (those doors live on
 * /cities/[slug]), em-dash empty placeholders (absent figures are omitted),
 * inline verdictFromMos (marketVerdict classifies the raw MoS).
 *
 * ONE PRIMARY PER VIEWPORT: at 390 the chrome CTA sits in the menu, so the
 * Instrument ask is primary. Value my home, via valuationHref('/cities').
 */

import type { Metadata } from 'next'
import { getCitiesForIndex } from '@/app/actions/cities'
import { sortCitiesWithPrimaryFirst } from '@/lib/cities'
import { getAllCitySnapshots, getRegionPulse, getMarketPulseCitySnapshots, getListingTiles } from '@/lib/data'
import { getCityContent } from '@/lib/city-content'
import { cityHero } from '@/lib/geo-images'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { formatPrice } from '@/lib/format/money'
import { formatDate } from '@/lib/format/date'
import { pageMetadata } from '@/lib/site/page-metadata'
import { buildMarketFaq, type MarketFaqInput } from '@/lib/site/market-faq'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import type { SchemaInput } from '@/lib/site/json-ld'
import {
  marketVerdict,
  MOS_METHODOLOGY_CLAUSE,
  MOS_THRESHOLD_CLAUSE,
} from '@/lib/market/classify'
import { listingsBrowsePath } from '@/lib/slug'
import { valuationHref } from '@/lib/site/valuation-href'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Instrument,
  V3Field,
  V3Ledger,
  V3Quiet,
  V3SectionTracker,
  type V3InstrumentFigure,
  type V3LedgerFigureRow,
} from '@/components/site/v3'
import { RegionalAlertSheet } from '@/app/central-oregon/_v3/RegionalAlertSheet.client'
import {
  FEATURED_CITY_SLUGS,
  FEATURED_PULSE_LABELS,
  CITY_SENTENCE_FALLBACK,
  firstSentence,
} from './_v3/cities-index-constants'
import { homeFieldItems } from '@/app/_v3/home-field-items'

export const revalidate = 1800

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const metadata: Metadata = pageMetadata({
  title: 'Central Oregon cities: Bend, Redmond, Sisters',
  description:
    'Active single-family homes in Bend, Redmond, Sisters, Sunriver, La Pine, Prineville, and the rest of Central Oregon. Live inventory and pricing from the regional MLS.',
  path: '/cities',
})

export default async function CitiesPage() {
  const [allCities, allSnapshots, regionPulse, citySnapshots, tiles] = await Promise.all([
    getCitiesForIndex(),
    getAllCitySnapshots(),
    getRegionPulse(),
    getMarketPulseCitySnapshots([...FEATURED_PULSE_LABELS]),
    getListingTiles({ status: 'active', propertyType: 'A', limit: 80 }),
  ])
  const fieldItems = homeFieldItems(tiles, 12)

  const sortedCities = sortCitiesWithPrimaryFirst(allCities)
  const visibleCities = sortedCities.slice(0, 60)

  const pulseBySlug = new Map(
    citySnapshots
      .filter((s) => s.active_count > 0 || s.median_list_price != null)
      .map((s) => [s.geo_slug.replace(/\s+/g, '-'), s]),
  )
  const rawPulseBySlug = new Map(citySnapshots.map((s) => [s.geo_slug.replace(/\s+/g, '-'), s]))

  const snapshotBySlug = new Map<string, { activeCount: number; medianPrice: number | null }>()
  for (const s of allSnapshots) {
    snapshotBySlug.set(s.geoKey.replace(/\s+/g, '-'), {
      activeCount: s.activeSfrCount,
      medianPrice: s.medianListPrice != null ? Math.round(s.medianListPrice) : null,
    })
  }

  const cityNameBySlug = new Map(visibleCities.map((c) => [c.slug, c.name]))

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
    const hero = cityHero(slug)
    return {
      slug,
      name,
      sentence,
      photoSrc: hero.verified ? hero.src : null,
      activeCount: pulse?.active_count ?? snap?.activeCount ?? null,
      medianListPrice: pulse?.median_list_price ?? snap?.medianPrice ?? null,
    }
  })

  const featuredSlugs = new Set<string>(featured.map((f) => f.slug))
  const others = visibleCities.filter((c) => featuredSlugs.has(c.slug) === false)

  const cityRows: V3LedgerFigureRow[] = []
  for (const city of featured) {
    const name = city.name.trim()
    if (!name) continue
    const active = city.activeCount
    const value =
      active != null
        ? `${active.toLocaleString('en-US')} ${active === 1 ? 'home' : 'homes'}`
        : city.medianListPrice != null
          ? formatPrice(city.medianListPrice)
          : 'See the city'
    const detailParts = [
      city.sentence,
      city.medianListPrice != null && active != null ? formatPrice(city.medianListPrice) : null,
    ].filter((part): part is string => Boolean(part))
    cityRows.push({
      href: `/cities/${city.slug}`,
      when: v3Text('City'),
      what: v3Text(name),
      detail: detailParts[0] ? v3Text(detailParts.join(' · ')) : undefined,
      value: v3Text(value),
      id: city.slug,
      media: city.photoSrc ? { src: city.photoSrc } : undefined,
    })
  }
  for (const city of others) {
    const name = city.name.trim()
    if (!name) continue
    const snap = snapshotBySlug.get(city.slug)
    const active = snap?.activeCount ?? city.activeCount
    const median = snap?.medianPrice ?? city.medianPrice
    const value =
      active > 0
        ? `${active.toLocaleString('en-US')} ${active === 1 ? 'home' : 'homes'}`
        : median != null
          ? formatPrice(median)
          : 'See the city'
    cityRows.push({
      href: `/cities/${city.slug}`,
      when: v3Text('Oregon'),
      what: v3Text(name),
      value: v3Text(value),
      id: city.slug,
    })
  }
  const [firstCityRow, ...restCityRows] = cityRows

  const mosRaw =
    regionPulse?.monthsOfSupply != null && regionPulse.monthsOfSupply > 0
      ? regionPulse.monthsOfSupply
      : null
  const verdict = marketVerdict(mosRaw)
  const totalActive: number | null =
    regionPulse?.activeCount ??
    (allSnapshots.length > 0 ? allSnapshots.reduce((sum, s) => sum + s.activeSfrCount, 0) : null)
  const regionMedian = regionPulse?.medianListPrice ?? null

  const regionFigures: V3InstrumentFigure[] = []
  if (totalActive != null) {
    regionFigures.push({
      value: v3Text(totalActive.toLocaleString('en-US')),
      label: v3Text('active homes'),
      href: listingsBrowsePath(),
    })
  }
  if (regionMedian != null && regionMedian > 0) {
    regionFigures.push({
      value: v3Text(formatPrice(regionMedian)),
      label: v3Text('median list price'),
      href: '/housing-market',
    })
  }
  if (mosRaw != null) {
    regionFigures.push({
      value: v3Text(`${formatMonthsOfSupply(mosRaw)} mo`),
      label: v3Text('months of supply'),
      href: '/months-of-supply',
    })
  }
  const [firstRegionFigure, ...restRegionFigures] = regionFigures

  const pulse: MarketFaqInput | null = regionPulse
    ? {
        activeCount: regionPulse.activeCount,
        medianListPrice: regionPulse.medianListPrice,
        monthsOfSupply: regionPulse.monthsOfSupply,
        medianDaysToPending: regionPulse.medianDaysToPending,
        refreshedAt: regionPulse.updatedAt,
      }
    : null
  const latestSnapshotAt = allSnapshots.reduce<string | null>(
    (latest, s) => (latest == null || s.refreshedAt > latest ? s.refreshedAt : latest),
    null,
  )
  const regionFaqInput: MarketFaqInput = pulse ?? { activeCount: totalActive, refreshedAt: latestSnapshotAt }
  const { datasetVariables: regionDatasetVars, asOfIso: regionAsOfIso } = buildMarketFaq(
    'Central Oregon',
    regionFaqInput,
  )

  const regionTrace =
    'live MLS through Oregon Data Share, single-family homes across the Central Oregon region. ' +
    MOS_METHODOLOGY_CLAUSE +
    ' ' +
    MOS_THRESHOLD_CLAUSE

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

  const headline =
    verdict.kind === 'unknown'
      ? 'Central Oregon cities'
      : `Central Oregon cities: a ${verdict.label}`

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker pageType="index" />
        <MetadataBlock schemas={schemas} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'CollectionPage',
              name: 'Central Oregon cities',
              description:
                'Active single-family homes in Bend, Redmond, Sisters, and the rest of Central Oregon. Live inventory from the regional MLS.',
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

        <V3Field
          id="listed"
          ariaLabel="Homes for sale in Central Oregon"
          items={fieldItems}
          footNote={
            fieldItems.length > 0
              ? `Listed here: photographed homes from the live list. Each photograph opens the listing.`
              : undefined
          }
          emptyMessage="No photographed active single-family home with a list price and a street address returned on this refresh."
        />

        {firstRegionFigure ? (
          <V3Instrument
            id="region-pulse"
            level={1}
            eyebrow={v3Text('Central Oregon')}
            headline={v3Text(headline)}
            figures={[firstRegionFigure, ...restRegionFigures]}
            source={v3Text(regionTrace)}
            updated={regionPulse?.updatedAt ? v3Text(formatDate(regionPulse.updatedAt)) : undefined}
            action={{
              label: v3Text('Value my home'),
              href: valuationHref('/cities'),
            }}
          />
        ) : (
          <V3Quiet
            id="region-pulse"
            heading="Central Oregon cities"
            headingLevel={1}
            items={[
              {
                kind: 'prose',
                term: 'No live region figures right now',
                body: 'The Central Oregon market row did not return on this refresh, so this page is not printing a region median, an inventory count, or a verdict. The city rows below carry their own figures.',
              },
            ]}
          />
        )}

        {firstCityRow ? (
          <V3Ledger
            id="cities"
            eyebrow={v3Text('Central Oregon')}
            heading={v3Text('Cities with homes for sale')}
            rows={[firstCityRow, ...restCityRows]}
            source={v3Text(
              'live MLS through Oregon Data Share, active single-family listings, one row per city. Featured rows prefer the 15-minute market_pulse_live row, then geo_snapshot_mv.',
            )}
            action={{ label: v3Text('Search all listings'), href: listingsBrowsePath(), variant: 'ghost' }}
          />
        ) : (
          <V3Ledger
            id="cities"
            heading={v3Text('Cities with homes for sale')}
            rows={[]}
            emptyMessage={v3Text('No city rows returned on this refresh.')}
          />
        )}

        <RegionalAlertSheet placeLabel="Central Oregon" city="" />

        <V3Quiet
          id="explore"
          eyebrow="Next"
          heading="Keep exploring Central Oregon"
          items={[
            { label: 'Communities', href: '/communities' },
            { label: 'Housing market', href: '/housing-market' },
            { label: 'Search homes', href: listingsBrowsePath() },
            { label: 'Value my home', href: valuationHref('/cities') },
            { label: 'Oregon Data Share', href: 'https://www.oregondatashare.com/' },
          ]}
        />
      </main>

      {/* Outside <main> on purpose. HTML-AAM maps <footer> to role=contentinfo only
          when it is NOT nested in sectioning content, and <main> is sectioning
          content, so inside it the element is a generic and the page ships no
          contentinfo landmark. ci:default-chrome-footer counts footers without
          checking placement. */}
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
