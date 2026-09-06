// @no-parity — place-family index, built from the v3 barrel like /neighborhoods
/**
 * Subdivisions index — A–Z directory of recorded subdivisions across
 * Central Oregon. Visitor copy uses subdivision / the place name, never “plat.”
 *
 * PAGE_INVENTORY §3: live counts on the rows, doors. Not a mini-Bend KPI
 * Instrument.
 */

import type { Metadata } from 'next'
import {
  getSurfaceImages,
  pickSurfaceImage,
  getCommunityHeroUrlsBySlug,
} from '@/lib/data'
import {
  getRegistryPlatPublicInventory,
  registryChildPlats,
} from '@/lib/data/geo/plat-public-inventory'
import { communityImage, cityHero, preferPlaceHero } from '@/lib/geo-images'
import { publishFeaturedPlats } from '@/lib/market/publish-featured-plat-inventory'
import { formatCount } from '@/lib/format/count'
import { formatIndexMedianUsd } from '@/lib/market/publish-index-median'
import { pageMetadata } from '@/lib/site/page-metadata'
import CommunityIndexBrowser from '@/components/community/CommunityIndexBrowser'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import {
  V3Breadcrumb,
  V3Footer,
  V3Heading,
  V3Lede,
  V3Ledger,
  V3Quiet,
  V3SectionTracker,
  V3_FOOTER_COLUMNS,
  V3_ROOT_CLASS,
  v3Text,
  type V3LedgerFigureRow,
  type V3LedgerPlainRow,
} from '@/components/site/v3'
import {
  indexBarWeight,
  liveForSaleLabel,
} from '@/app/cities/_v3/cities-index-constants'
import type { SchemaInput } from '@/lib/site/json-ld'

export const revalidate = 1800

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const metadata: Metadata = pageMetadata({
  title: 'Central Oregon subdivisions',
  description:
    'Subdivisions across Central Oregon with live single-family inventory from the regional MLS.',
  path: '/subdivisions',
})

const LEDGER_TRACE =
  'live MLS through Oregon Data Share, active single-family listings filed under each subdivision name (Active and Active Under Contract, Coming Soon excluded). The median is the list price of those same listings'

function fmtPrice(n: number | null | undefined): string | null {
  return formatIndexMedianUsd(n)
}

export default async function SubdivisionsPage() {
  const childPlats = registryChildPlats()

  const [inventory, heroPhotoPool, parentHeroBySlug] = await Promise.all([
    getRegistryPlatPublicInventory(),
    getSurfaceImages('hero'),
    getCommunityHeroUrlsBySlug(),
  ])
  const inventoryOk = inventory.length > 0
  const invByKey = new Map(inventory.map((row) => [row.key, row]))
  const countByKey = new Map(inventory.map((row) => [row.key, row.activeCount]))
  const featuredSeeds = publishFeaturedPlats(childPlats, countByKey, {
    inventoryOk,
    cap: 12,
  })

  const featured = featuredSeeds
    .map((p) => {
      const inv = invByKey.get(`${p.citySlug}:${p.slug}`) ?? null
      const live = parentHeroBySlug[p.parentSlug]
      const curated = communityImage(p.parentSlug)
      const fallbackHero = cityHero(p.citySlug)
      const pooled = pickSurfaceImage(heroPhotoPool, {
        geoTags: [p.citySlug],
        seed: p.slug,
        fallback: curated ?? fallbackHero.src,
      })
      const photoSrc = preferPlaceHero(live, curated ?? pooled ?? fallbackHero.src)
      const placeOwned = Boolean(live || curated)
      return {
        ...p,
        href: `/subdivisions/${p.slug}`,
        sentence: `${p.name} is in ${p.parent}, ${p.city}.`,
        photoSrc,
        photoAlt: placeOwned ? `${p.name}, ${p.city} Oregon` : fallbackHero.alt,
        photoIsPlat: placeOwned,
        activeCount: inventoryOk ? (inv?.activeCount ?? 0) : null,
        medianPrice: inventoryOk ? (inv?.medianListPrice ?? null) : null,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  const azSeen = new Set<string>()
  const azSource = childPlats.flatMap((p) => {
    if (azSeen.has(p.slug)) return []
    azSeen.add(p.slug)
    const inv = invByKey.get(`${p.citySlug}:${p.slug}`) ?? null
    return [
      {
        slug: p.slug,
        name: p.name,
        city: p.city,
        activeCount: inventoryOk ? (inv?.activeCount ?? 0) : 0,
        href: `/subdivisions/${p.slug}`,
      },
    ]
  })

  const totalActive = inventoryOk
    ? azSource.reduce((sum, p) => sum + (p.activeCount ?? 0), 0)
    : null
  const platCount = azSource.length
  const maxCount = Math.max(0, ...featured.map((p) => p.activeCount ?? 0))

  const rowBase = featured.map((p) => ({
    id: p.slug,
    href: p.href,
    when: v3Text(`${p.parent} · ${p.city} · Oregon`),
    what: v3Text(p.name),
    detail: (() => {
      const median = fmtPrice(p.medianPrice)
      const bits = [median ? `Median list ${median}` : null, p.sentence].filter(Boolean)
      return bits.length > 0 ? v3Text(bits.join(' · ')) : undefined
    })(),
    media: p.photoIsPlat ? { src: p.photoSrc } : undefined,
    ariaLabel: v3Text(`Homes for sale in ${p.name}, ${p.city} Oregon`),
  }))

  const figureRows: V3LedgerFigureRow[] = rowBase.map((row, i) => ({
    ...row,
    value: v3Text(liveForSaleLabel(featured[i]?.activeCount ?? 0)),
    weight: indexBarWeight(featured[i]?.activeCount, maxCount),
  }))
  const plainRows: V3LedgerPlainRow[] = rowBase

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Subdivisions', url: '/subdivisions' },
      ],
    },
  ]

  const [firstFigureRow, ...restFigureRows] = figureRows
  const [firstPlainRow, ...restPlainRows] = plainRows

  const caption =
    totalActive != null && totalActive > 0
      ? `${formatCount(totalActive)} homes for sale across ${formatCount(platCount)} subdivisions.`
      : `${formatCount(platCount)} subdivisions inside the known communities.`

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
              name: 'Central Oregon subdivisions',
              description:
                'Subdivisions across Central Oregon, with live MLS inventory.',
              url: `${siteUrl}/subdivisions`,
              publisher: { '@type': 'Organization', name: 'Ryan Realty' },
              mainEntity: {
                '@type': 'ItemList',
                itemListElement: featured.map((p, i) => ({
                  '@type': 'ListItem',
                  position: i + 1,
                  name: `${p.name}, ${p.city}, Oregon`,
                  url: `${siteUrl}${p.href}`,
                })),
              },
            }),
          }}
        />

        <V3Breadcrumb trail={[{ label: 'Home', href: '/' }, { label: 'Subdivisions' }]} />

        {inventoryOk && firstFigureRow ? (
          <V3Ledger
            id="featured-plats"
            headingLevel={1}
            eyebrow={v3Text('Central Oregon')}
            heading={v3Text('Central Oregon subdivisions')}
            note={v3Text(caption)}
            rows={[firstFigureRow, ...restFigureRows]}
            encode="bar"
            source={v3Text(LEDGER_TRACE)}
          />
        ) : firstPlainRow ? (
          <V3Ledger
            id="featured-plats"
            headingLevel={1}
            eyebrow={v3Text('Central Oregon')}
            heading={v3Text('Central Oregon subdivisions')}
            note={v3Text(
              'The live inventory read did not return on this refresh, so these rows name the subdivisions without a count.',
            )}
            rows={[firstPlainRow, ...restPlainRows]}
          />
        ) : (
          <V3Ledger
            id="featured-plats"
            headingLevel={1}
            heading={v3Text('Central Oregon subdivisions')}
            rows={[]}
            emptyMessage={v3Text('The community registry returned no subdivision on this refresh.')}
          />
        )}

        <section
          id="all-plats"
          aria-labelledby="all-plats-heading"
          className="mx-auto w-full max-w-5xl px-5 pb-16"
        >
          <V3Heading level={2} id="all-plats-heading">
            Subdivisions, A to Z
          </V3Heading>
          <V3Lede>
            {formatCount(platCount)} subdivisions inside the known communities. Search by name
            or city.
          </V3Lede>
          <CommunityIndexBrowser
            items={azSource}
            searchLabel="Search subdivisions by name or city"
            searchPlaceholder="Search by subdivision or city name"
            emptyLabel="No subdivisions match your search."
            countNoun={{ singular: 'subdivision', plural: 'subdivisions' }}
          />
        </section>

        <V3Quiet
          id="edges"
          eyebrow="Central Oregon"
          heading="Find a home, or price the one you have"
          items={[
            { label: 'Search all listings', href: '/search' },
            { label: 'Communities', href: '/communities' },
            { label: 'Neighborhoods', href: '/neighborhoods' },
            { label: 'Value my home', href: '/sell/valuation' },
            { label: 'Oregon Data Share', href: 'https://www.oregondatashare.com' },
          ]}
          note="Oregon Data Share is the regional MLS cooperative behind the live listing and market data on this page."
        />
      </main>

      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
