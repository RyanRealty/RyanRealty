// @no-parity — place-family index, built from the v3 barrel like /cities
/**
 * Neighborhoods index — the City of Bend districts, on components/site/v3.
 *
 * PUBLIC_UI.md (locked 2026-08-11) section 3, three patterns, no two adjacent
 * sharing one:
 *
 *   Instrument  the live answer: how many homes are for sale across the
 *               districts, and how many districts there are.
 *   Ledger      one row per district, every row a door into the district page.
 *   Quiet       the outbound edges, including the Oregon Data Share citation
 *               that MarketSources used to carry.
 *
 * Chrome is layout-owned (app/layout.tsx mounts V3Chrome); the footer is
 * route-owned and sits outside <main>. MetadataBlock stays: it is JSON-LD, not
 * visual language, and ci:ai-structured-data pins this route to it by name.
 *
 * Each row opens the existing neighborhood detail at /cities/{city}/{slug}.
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
  V3Instrument,
  V3Ledger,
  V3Quiet,
  V3SectionTracker,
  V3_FOOTER_COLUMNS,
  V3_ROOT_CLASS,
  v3Text,
  type V3InstrumentFigure,
  type V3LedgerFigureRow,
  type V3LedgerPlainRow,
} from '@/components/site/v3'
import type { SchemaInput } from '@/lib/site/json-ld'

export const revalidate = 1800

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const metadata: Metadata = pageMetadata({
  title: 'Bend neighborhoods: Awbrey Butte, Larkspur, Old Bend',
  description:
    'City of Bend neighborhood districts with live single-family inventory and list prices from the regional MLS.',
  path: '/neighborhoods',
})

/**
 * The section 0 trace for the district rows. The population is named because
 * two other tables also hold a per-neighborhood "active" figure and disagree
 * with this one (getBendNeighborhoodLedger's header, the 52 / 62 / 63 split on
 * Awbrey Butte).
 */
const LEDGER_TRACE =
  'live MLS through Oregon Data Share, active single-family listings inside each district boundary polygon. The median is the list price of those same listings'

const PULSE_TRACE =
  'live MLS through Oregon Data Share, single-family only, summed across the City of Bend neighborhood districts'

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

  const featured = source.map((n) => {
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

  const totalActive = featured.reduce((sum, n) => sum + (n.activeCount ?? 0), 0)

  /**
   * A count column is published only when EVERY district has a measured count.
   * A degraded ledger read returns [], and `?? 0` on a timeout would print
   * thirteen fake zeros (city-places invariant 4). So the value column either
   * carries a real number for every row or the ledger carries none at all.
   */
  const countsPublishable = ledger.length > 0 && featured.every((n) => n.activeCount != null)

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
    // Only a photograph of the district itself. The city hero is a fallback,
    // and the Ledger's media slot takes no fallbacks.
    media: n.photoIsPlace ? { src: n.photoSrc } : undefined,
    ariaLabel: v3Text(`Homes for sale in ${n.name}, ${n.cityName} Oregon`),
  }))

  const figureRows: V3LedgerFigureRow[] = rowBase.map((row, i) => ({
    ...row,
    value: v3Text(`${formatCount(featured[i]?.activeCount ?? 0)} for sale`),
  }))
  const plainRows: V3LedgerPlainRow[] = rowBase

  const figures: V3InstrumentFigure[] = []
  if (countsPublishable && totalActive > 0) {
    figures.push({
      value: v3Text(formatCount(totalActive)),
      label: v3Text('Active homes across these districts'),
    })
  }
  figures.push({
    value: v3Text(formatCount(featured.length)),
    label: v3Text('Neighborhood districts'),
  })
  const [leadFigure, ...restFigures] = figures

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Neighborhoods', url: '/neighborhoods' },
      ],
    },
  ]

  const [firstFigureRow, ...restFigureRows] = figureRows
  const [firstPlainRow, ...restPlainRows] = plainRows

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

        {leadFigure ? (
          <V3Instrument
            id="neighborhoods-pulse"
            level={1}
            eyebrow={v3Text('Live market')}
            headline={v3Text('Bend, neighborhood by neighborhood.')}
            note={v3Text(
              'The City of Bend neighborhood districts. Live single-family inventory from the regional MLS, refreshed through the day.',
            )}
            figures={[leadFigure, ...restFigures]}
            source={v3Text(PULSE_TRACE)}
            action={{ label: v3Text('Bend guide'), href: '/cities/bend', variant: 'primary' }}
          />
        ) : null}

        {countsPublishable && firstFigureRow ? (
          <V3Ledger
            id="bend-neighborhoods"
            eyebrow={v3Text('City of Bend')}
            heading={v3Text('Pick a district. See what is listed.')}
            rows={[firstFigureRow, ...restFigureRows]}
            source={v3Text(LEDGER_TRACE)}
          />
        ) : firstPlainRow ? (
          <V3Ledger
            id="bend-neighborhoods"
            eyebrow={v3Text('City of Bend')}
            heading={v3Text('Pick a district. See what is listed.')}
            note={v3Text(
              'The live inventory read did not return on this refresh, so these rows name the districts without a count.',
            )}
            rows={[firstPlainRow, ...restPlainRows]}
          />
        ) : (
          <V3Ledger
            id="bend-neighborhoods"
            eyebrow={v3Text('City of Bend')}
            heading={v3Text('Pick a district. See what is listed.')}
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
