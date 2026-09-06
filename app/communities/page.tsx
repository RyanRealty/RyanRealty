/**
 * Communities index — A–Z directory of resort and master-planned communities.
 *
 * PAGE_INVENTORY §3: live counts on the rows, doors. Resorts / master-plans
 * only, not every neighborhood dumped in. Not a mini-Bend KPI Instrument.
 */

import { valuationHref } from '@/lib/site/valuation-href'
import type { Metadata } from 'next'
import { getCommunitiesForIndex } from '@/app/actions/communities'
import { getRegistryResortPublicFigures } from '@/lib/kb/registry-resort-public-figures'
import { formatCount } from '@/lib/format/count'
import { formatPriceExact } from '@/lib/format/money'
import { getResortCommunityContent } from '@/lib/resort-community-content'
import { communityImage, cityHero, preferPlaceHero } from '@/lib/geo-images'
import { getSurfaceImages, pickSurfaceImage } from '@/lib/data'
import { subdivisionEntityKey } from '@/lib/slug'
import { buildMarketFaq, type MarketFaqInput } from '@/lib/site/market-faq'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import type { SchemaInput } from '@/lib/site/json-ld'
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
import { belongingLine, resortIndexRow } from '@/app/communities/_v3/community-index-rows'
import { indexBarWeight } from '@/app/cities/_v3/cities-index-constants'
import resortCommunitiesRegistry from '@/data/resort-communities.json' assert { type: 'json' }

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const revalidate = 1800

export const metadata: Metadata = {
  title: 'Communities in Central Oregon | Bend, Redmond, Sisters',
  description:
    'Resort and master-planned communities across Central Oregon. Live single-family inventory for Bend, Redmond, Sisters, Sunriver, and the towns around them.',
  alternates: { canonical: `${siteUrl}/communities` },
  openGraph: {
    title: 'Communities in Central Oregon | Ryan Realty',
    description:
      'Resort and master-planned communities across Central Oregon, with live MLS inventory.',
    url: `${siteUrl}/communities`,
    siteName: 'Ryan Realty',
    type: 'website',
    images: [{ url: `${siteUrl}/api/og?type=default`, width: 1200, height: 630, alt: 'Communities in Central Oregon' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: [`${siteUrl}/api/og?type=default`],
  },
}

const LEDGER_TRACE =
  'live MLS through Oregon Data Share, active single-family listings under each community and its registered subdivision aliases. The median is the list price of those same listings'

type RegistryCommunity = {
  slug: string
  label: string
  city: string
  city_slug: string
  is_resort: boolean
}

export default async function CommunitiesPage() {
  const registry = resortCommunitiesRegistry.communities as ReadonlyArray<RegistryCommunity>

  const [allCommunities, heroPhotoPool, resortFigures] = await Promise.all([
    getCommunitiesForIndex(),
    getSurfaceImages('hero'),
    getRegistryResortPublicFigures(),
  ])

  const indexByEntityKey = new Map(allCommunities.map((c) => [c.entityKey, c]))

  const resorts = (
    await Promise.all(
      registry.map(async (r) => {
        const idx = indexByEntityKey.get(subdivisionEntityKey(r.city, r.label)) ?? null
        const content = await getResortCommunityContent(r.slug)
        const sentence = belongingLine(content)
        const live = idx?.heroImageUrl
        const curated = communityImage(r.slug)
        const fallbackHero = cityHero(r.city_slug)
        const pooledFallback = pickSurfaceImage(heroPhotoPool, {
          geoTags: [r.city_slug],
          seed: r.slug,
          fallback: fallbackHero.src,
        })
        const photoSrc = preferPlaceHero(live, curated ?? pooledFallback ?? fallbackHero.src)
        const placeOwned = Boolean(live?.trim() || curated)
        return {
          slug: r.slug,
          name: r.label,
          city: r.city,
          citySlug: r.city_slug,
          sentence,
          photoSrc,
          photoAlt: placeOwned ? `${r.label}, ${r.city} Oregon` : fallbackHero.alt,
          photoIsCommunity: placeOwned,
          activeCount: resortFigures.get(r.slug)?.activeCount ?? idx?.activeCount ?? 0,
          medianPrice: resortFigures.get(r.slug)?.medianListPrice ?? idx?.medianPrice ?? null,
        }
      }),
    )
  ).sort((a, b) => a.name.localeCompare(b.name))

  const totalActive = resorts.reduce((sum, c) => sum + c.activeCount, 0)
  const communityCount = resorts.length
  const maxCount = Math.max(0, ...resorts.map((r) => r.activeCount))

  const pulse: MarketFaqInput | null = totalActive > 0 ? { grain: 'region', activeCount: totalActive } : null
  const communityFaqInput: MarketFaqInput = pulse ?? { grain: 'region', activeCount: null }
  const { datasetVariables: communityDatasetVars } = buildMarketFaq(
    'Central Oregon communities',
    communityFaqInput,
  )

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Communities', url: '/communities' },
      ],
    },
  ]

  if (communityDatasetVars.length > 0) {
    schemas.push({
      type: 'dataset',
      name: 'Central Oregon communities, Oregon real estate market statistics',
      description:
        'Live single-family home active-inventory count across the 14 registered Central Oregon resort ' +
        'and master-planned communities. Sourced from Oregon Data Share via Ryan Realty.',
      url: '/communities',
      spatialCoverageName: 'Central Oregon, OR',
      variableMeasured: communityDatasetVars,
    })
  }

  const rows: V3LedgerFigureRow[] = resorts.flatMap((r) => {
    const median = r.medianPrice != null ? formatPriceExact(r.medianPrice) : null
    const row = resortIndexRow({
      slug: r.slug,
      name: r.name,
      city: r.city,
      belonging: r.sentence,
      photoSrc: r.photoIsCommunity ? r.photoSrc : null,
      activeCount: r.activeCount,
      medianLine: median ? `Median list ${median}` : null,
      weight: indexBarWeight(r.activeCount, maxCount),
    })
    return row ? [row] : []
  })
  const [firstRow, ...restRows] = rows

  const inventoryDoors: V3QuietItem[] = resorts.flatMap((r) => [
    { label: `${r.name} homes for sale`, href: `/communities/${r.slug}#listings` },
    { label: `Homes for sale in ${r.city}`, href: `/homes-for-sale/${r.citySlug}` },
  ])

  const caption =
    totalActive > 0
      ? `${formatCount(totalActive)} homes for sale across ${formatCount(communityCount)} communities.`
      : `${formatCount(communityCount)} resort and master-planned communities.`

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
              name: 'Communities in Central Oregon',
              description:
                'Resort and master-planned communities across Central Oregon, with live MLS inventory.',
              url: `${siteUrl}/communities`,
              publisher: { '@type': 'Organization', name: 'Ryan Realty' },
              mainEntity: {
                '@type': 'ItemList',
                itemListElement: resorts.map((r, i) => ({
                  '@type': 'ListItem',
                  position: i + 1,
                  name: `${r.name}, ${r.city}, Oregon`,
                  url: `${siteUrl}/communities/${r.slug}`,
                })),
              },
            }),
          }}
        />

        <V3Breadcrumb trail={[{ label: 'Home', href: '/' }, { label: 'Communities' }]} />

        {firstRow ? (
          <V3Ledger
            id="resort-communities"
            headingLevel={1}
            eyebrow={v3Text('Resort communities')}
            heading={v3Text('Resorts and planned communities')}
            note={v3Text(caption)}
            rows={[firstRow, ...restRows]}
            encode="bar"
            source={v3Text(LEDGER_TRACE)}
          />
        ) : (
          <V3Ledger
            id="resort-communities"
            headingLevel={1}
            eyebrow={v3Text('Resort communities')}
            heading={v3Text('Resorts and planned communities')}
            rows={[]}
            emptyMessage={v3Text('The community registry returned no community on this refresh.')}
          />
        )}

        <V3Quiet
          id="community-inventory"
          eyebrow="Straight to the listings"
          heading="Homes for sale, community by community"
          items={inventoryDoors}
        />

        <V3Quiet
          id="edges"
          eyebrow="Central Oregon"
          heading="Find a home, or price the one you have"
          items={[
            { label: 'Search all listings', href: '/search' },
            { label: 'Luxury homes in Bend', href: '/luxury-homes-bend' },
            { label: 'Subdivisions', href: '/subdivisions' },
            { label: 'Value my home', href: valuationHref('/communities') },
            { label: 'Oregon Data Share', href: 'https://www.oregondatashare.com' },
          ]}
          note="Search active listings across every community, with filters for price, beds, and place. Oregon Data Share is the regional MLS cooperative behind the live listing and market data on this page."
        />

        <RegionalAlertSheet placeLabel="Central Oregon" city="" />
      </main>

      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
