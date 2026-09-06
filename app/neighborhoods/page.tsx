// @no-parity — place-family index, built from the v3 barrel like /cities
/**
 * Neighborhoods index — A–Z directory of City of Bend districts.
 *
 * PAGE_INVENTORY §3: live counts on the rows, doors. Not a mini-Bend KPI
 * Instrument.
 */

import type { Metadata } from 'next'
import {
  getBendNeighborhoodLedger,
  getNeighborhoodDirectory,
  getSurfaceImages,
  pickSurfaceImage,
} from '@/lib/data'
import { BEND_NEIGHBORHOOD_DISTRICTS } from '@/lib/data/geo/getBendNeighborhoodLedger'
import { cityHero, preferPlaceHero } from '@/lib/geo-images'
import { formatCount } from '@/lib/format/count'
import { formatIndexMedianUsd } from '@/lib/market/publish-index-median'
import { pageMetadata } from '@/lib/site/page-metadata'
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
  title: 'Bend neighborhoods: Awbrey Butte, Larkspur, Old Bend',
  description:
    'City of Bend neighborhood districts with live single-family inventory and list prices from the regional MLS.',
  path: '/neighborhoods',
})

const LEDGER_TRACE =
  'live MLS through Oregon Data Share, active single-family listings inside each district boundary polygon. The median is the list price of those same listings'

const NEIGHBORHOOD_SENTENCE: Record<string, string> = {
  'awbrey-butte': 'West-side volcanic butte above downtown Bend, with Cascade views from the ridge.',
  'boyd-acres': 'North Bend district between the parkway and the Deschutes.',
  'century-west': 'West Bend along Century Drive, toward Mt. Bachelor.',
  larkspur: 'East Bend around Larkspur Trail and the county fairgrounds.',
  'mountain-view': 'Northeast Bend, toward Pilot Butte and the parkway.',
  'old-bend': 'The original townsite south of downtown, along the Deschutes.',
  'old-farm-district': 'Southeast Bend between the parkway and the Badlands.',
  'orchard-district': 'East-central Bend between downtown and the parkway.',
  'river-west': 'West of the Deschutes through downtown, including Drake Park.',
  'southeast-bend': 'South and east of the parkway, toward Knott Road.',
  'southern-crossing': 'South Bend around the parkway crossing at Reed Market.',
  'southwest-bend': 'Southwest Bend toward the Deschutes National Forest.',
  'summit-west': 'Far west Bend around Summit High and Shevlin Park.',
}

function fmtMedian(n: number | null | undefined): string | null {
  return formatIndexMedianUsd(n)
}

export default async function NeighborhoodsPage() {
  const [directory, ledger, heroPhotoPool] = await Promise.all([
    getNeighborhoodDirectory(),
    getBendNeighborhoodLedger(),
    getSurfaceImages('hero'),
  ])

  const ledgerByHref = new Map(ledger.map((row) => [row.href, row]))

  const source =
    directory.length > 0
      ? directory.map((d) => ({
          slug: d.neighborhoodSlug,
          name: d.neighborhoodName,
          citySlug: d.citySlug,
          cityName: d.cityName,
          heroImageUrl: d.heroImageUrl,
        }))
      : BEND_NEIGHBORHOOD_DISTRICTS.map((n) => ({
          slug: n.slug,
          name: n.label,
          citySlug: 'bend',
          cityName: 'Bend',
          heroImageUrl: null as string | null,
        }))

  const featured = source
    .map((n) => {
      const href = `/cities/${n.citySlug}/${n.slug}`
      const stats = ledgerByHref.get(href)
      const hero = cityHero(n.citySlug)
      const pooled =
        pickSurfaceImage(heroPhotoPool, {
          geoTags: [n.citySlug],
          seed: n.slug,
          fallback: hero.src,
        }) ?? hero.src
      const photoSrc = preferPlaceHero(n.heroImageUrl, pooled)
      return {
        slug: n.slug,
        name: n.name,
        citySlug: n.citySlug,
        cityName: n.cityName,
        href,
        sentence: NEIGHBORHOOD_SENTENCE[n.slug] ?? null,
        photoSrc,
        photoAlt: `${n.name}, ${n.cityName} Oregon`,
        photoIsPlace: Boolean(n.heroImageUrl?.trim()) || photoSrc !== hero.src,
        activeCount: stats?.activeCount ?? (ledger.length > 0 && n.citySlug === 'bend' ? 0 : null),
        medianListPrice: stats?.medianListPrice ?? null,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  const totalActive = featured.reduce((sum, n) => sum + (n.activeCount ?? 0), 0)
  const countsPublishable = ledger.length > 0 && featured.every((n) => n.activeCount != null)
  const maxCount = Math.max(0, ...featured.map((n) => n.activeCount ?? 0))

  const rowBase = featured.map((n) => ({
    id: n.slug,
    href: n.href,
    when: v3Text(`${n.cityName} · Oregon`),
    what: v3Text(n.name),
    detail: (() => {
      const median = fmtMedian(n.medianListPrice)
      const bits = [median ? `Median list ${median}` : null, n.sentence].filter(Boolean)
      return bits.length > 0 ? v3Text(bits.join(' · ')) : undefined
    })(),
    media: n.photoIsPlace ? { src: n.photoSrc } : undefined,
    ariaLabel: v3Text(`Homes for sale in ${n.name}, ${n.cityName} Oregon`),
  }))

  const figureRows: V3LedgerFigureRow[] = rowBase.map((row, i) => ({
    ...row,
    value: v3Text(liveForSaleLabel(featured[i]?.activeCount ?? 0)),
    weight: indexBarWeight(featured[i]?.activeCount, maxCount),
  }))
  const plainRows: V3LedgerPlainRow[] = rowBase

  const [firstFigureRow, ...restFigureRows] = figureRows
  const [firstPlainRow, ...restPlainRows] = plainRows

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Neighborhoods', url: '/neighborhoods' },
      ],
    },
  ]

  const caption =
    countsPublishable && totalActive > 0
      ? `${formatCount(totalActive)} homes for sale across these districts.`
      : null

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
              name: 'Bend neighborhoods',
              description:
                'City of Bend neighborhood districts with live single-family inventory from the regional MLS.',
              url: `${siteUrl}/neighborhoods`,
              publisher: { '@type': 'Organization', name: 'Ryan Realty' },
              mainEntity: {
                '@type': 'ItemList',
                itemListElement: featured.map((n, i) => ({
                  '@type': 'ListItem',
                  position: i + 1,
                  name: `${n.name}, ${n.cityName}, Oregon`,
                  url: `${siteUrl}${n.href}`,
                })),
              },
            }),
          }}
        />

        <V3Breadcrumb trail={[{ label: 'Home', href: '/' }, { label: 'Neighborhoods' }]} />

        {countsPublishable && firstFigureRow ? (
          <V3Ledger
            id="bend-neighborhoods"
            headingLevel={1}
            eyebrow={v3Text('City of Bend')}
            heading={v3Text('Bend neighborhoods')}
            note={v3Text(caption || 'City of Bend neighborhood districts.')}
            rows={[firstFigureRow, ...restFigureRows]}
            encode="bar"
            source={v3Text(LEDGER_TRACE)}
          />
        ) : firstPlainRow ? (
          <V3Ledger
            id="bend-neighborhoods"
            headingLevel={1}
            eyebrow={v3Text('City of Bend')}
            heading={v3Text('Bend neighborhoods')}
            note={v3Text(
              'The live inventory read did not return on this refresh, so these rows name the districts without a count.',
            )}
            rows={[firstPlainRow, ...restPlainRows]}
          />
        ) : (
          <V3Ledger
            id="bend-neighborhoods"
            headingLevel={1}
            heading={v3Text('Bend neighborhoods')}
            rows={[]}
            emptyMessage={v3Text('The neighborhood directory returned no district on this refresh.')}
          />
        )}

        <V3Quiet
          id="edges"
          eyebrow="Central Oregon"
          heading="Search every listing in Central Oregon"
          items={[
            { label: 'Search all listings', href: '/search' },
            { label: 'All cities', href: '/cities' },
            { label: 'Communities', href: '/communities' },
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
