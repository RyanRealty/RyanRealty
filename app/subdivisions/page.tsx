// @no-parity — place-family index, built from the v3 barrel like /neighborhoods
/**
 * Subdivisions index — recorded plats across Central Oregon, on
 * components/site/v3.
 *
 * PUBLIC_UI.md (locked 2026-08-11) section 3:
 *
 *   Instrument  the live answer: homes for sale across these plats, and how
 *               many plats are in the index.
 *   Ledger      one row per featured plat, every row a door.
 *   Sheet       the A-to-Z browser: a filter set over the full index. It is the
 *               pre-barrel client component (components/community/
 *               CommunityIndexBrowser); the pattern it serves is Sheet, and it
 *               is not re-skinned in this pass.
 *   Quiet       the outbound edges, including the Oregon Data Share citation
 *               that MarketSources used to carry.
 *
 * Featured rows and the A-to-Z list are recorded child plats from the
 * community registry (not marketing community slugs). The county-wide
 * indexable set still feeds the sitemap. It is too heavy to render here.
 *
 * MetadataBlock stays: JSON-LD is not visual language, and ci:ai-structured-data
 * pins this route to it by name.
 */

import type { Metadata } from 'next'
import {
  getSurfaceImages,
  pickSurfaceImage,
} from '@/lib/data'
import { getCommunitiesForIndex } from '@/app/actions/communities'
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
  V3Instrument,
  V3Lede,
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
  title: 'Central Oregon subdivisions and recorded plats',
  description:
    'Recorded plats across Central Oregon with live single-family inventory from the regional MLS.',
  path: '/subdivisions',
})

/**
 * The section 0 traces. The plat population is named because three other reads
 * once answered the same question differently (plat-public-inventory's header,
 * the Ridge At Eagle Crest 12 / 14 / 26 split).
 */
const LEDGER_TRACE =
  'live MLS through Oregon Data Share, active single-family listings filed under each plat name (Active and Active Under Contract, Coming Soon excluded). The median is the list price of those same listings'

const PULSE_TRACE =
  'live MLS through Oregon Data Share, single-family active inventory on recorded plats inside the known communities'

function fmtPrice(n: number | null | undefined): string | null {
  return formatIndexMedianUsd(n)
}

export default async function SubdivisionsPage() {
  const childPlats = registryChildPlats()

  const [inventory, heroPhotoPool, communities] = await Promise.all([
    getRegistryPlatPublicInventory(),
    getSurfaceImages('hero'),
    getCommunitiesForIndex(),
  ])
  const parentHeroBySlug = new Map<string, string>()
  for (const c of communities) {
    const url = c.heroImageUrl?.trim()
    if (!url) continue
    parentHeroBySlug.set(c.slug, url)
    parentHeroBySlug.set(c.entityKey.includes(':') ? c.entityKey.split(':')[1]! : c.slug, url)
  }
  const inventoryOk = inventory.length > 0
  const invByKey = new Map(inventory.map((row) => [row.key, row]))
  const countByKey = new Map(inventory.map((row) => [row.key, row.activeCount]))
  const featuredSeeds = publishFeaturedPlats(childPlats, countByKey, {
    inventoryOk,
    cap: 12,
  })

  const featured = featuredSeeds.map((p) => {
    const inv = invByKey.get(`${p.citySlug}:${p.slug}`) ?? null
    const live = parentHeroBySlug.get(p.parentSlug)
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
      sentence: `${p.name} is a recorded plat in ${p.parent}, ${p.city}.`,
      photoSrc,
      photoAlt: placeOwned ? `${p.name}, ${p.city} Oregon` : fallbackHero.alt,
      photoIsPlat: placeOwned,
      activeCount: inventoryOk ? (inv?.activeCount ?? 0) : null,
      medianPrice: inventoryOk ? (inv?.medianListPrice ?? null) : null,
    }
  })

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
    // A curated photograph of the parent community only. The pooled city frame
    // is a fallback, and the Ledger's media slot takes no fallbacks.
    media: p.photoIsPlat ? { src: p.photoSrc } : undefined,
    ariaLabel: v3Text(`Homes for sale in ${p.name}, ${p.city} Oregon`),
  }))

  // A degraded inventory read publishes no counts at all rather than a column
  // of zeros that would each read as "nothing for sale here".
  const figureRows: V3LedgerFigureRow[] = rowBase.map((row, i) => ({
    ...row,
    value: v3Text(`${formatCount(featured[i]?.activeCount ?? 0)} for sale`),
  }))
  const plainRows: V3LedgerPlainRow[] = rowBase

  const figures: V3InstrumentFigure[] = []
  if (totalActive != null && totalActive > 0) {
    figures.push({
      value: v3Text(formatCount(totalActive)),
      label: v3Text('Homes for sale across these plats'),
    })
  }
  figures.push({
    value: v3Text(formatCount(platCount)),
    label: v3Text('Community plats in this index'),
  })
  const [leadFigure, ...restFigures] = figures

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
                'Recorded plats across Central Oregon, with live MLS inventory.',
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

        {leadFigure ? (
          <V3Instrument
            id="subdivisions-pulse"
            level={1}
            eyebrow={v3Text('Live market')}
            headline={v3Text('Recorded plats across Central Oregon.')}
            note={v3Text(
              'County plats with live single-family inventory. Each name opens the listings and sales history for that plat.',
            )}
            figures={[leadFigure, ...restFigures]}
            source={v3Text(PULSE_TRACE)}
            action={{ label: v3Text('Search all listings'), href: '/search', variant: 'primary' }}
          />
        ) : null}

        {inventoryOk && firstFigureRow ? (
          <V3Ledger
            id="featured-plats"
            eyebrow={v3Text('Recorded plats')}
            heading={v3Text('Plats inside the known communities')}
            rows={[firstFigureRow, ...restFigureRows]}
            source={v3Text(LEDGER_TRACE)}
          />
        ) : firstPlainRow ? (
          <V3Ledger
            id="featured-plats"
            eyebrow={v3Text('Recorded plats')}
            heading={v3Text('Plats inside the known communities')}
            note={v3Text(
              'The live inventory read did not return on this refresh, so these rows name the plats without a count.',
            )}
            rows={[firstPlainRow, ...restPlainRows]}
          />
        ) : (
          <V3Ledger
            id="featured-plats"
            eyebrow={v3Text('Recorded plats')}
            heading={v3Text('Plats inside the known communities')}
            rows={[]}
            emptyMessage={v3Text('The community registry returned no child plat on this refresh.')}
          />
        )}

        {/* Pattern 5, Sheet: a filter set over the full index. The control is
            the pre-barrel client browser, which owns its own markup. */}
        <section
          id="all-plats"
          aria-labelledby="all-plats-heading"
          className="mx-auto w-full max-w-5xl px-5 pb-16"
        >
          <V3Heading level={2} id="all-plats-heading">
            Community plats, A to Z
          </V3Heading>
          <V3Lede>
            {formatCount(platCount)} recorded plats inside the known communities. Search by name
            or city.
          </V3Lede>
          <CommunityIndexBrowser
            items={azSource}
            searchLabel="Search plats by name or city"
            searchPlaceholder="Search by plat or city name"
            emptyLabel="No plats match your search."
            countNoun={{ singular: 'plat', plural: 'plats' }}
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

      {/* Outside <main> on purpose. HTML-AAM maps <footer> to role=contentinfo
          only when it is NOT nested in sectioning content. */}
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
