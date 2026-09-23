// @no-parity — place-family index, built from the v3 barrel like /neighborhoods
/**
 * Subdivisions index — A–Z directory of recorded subdivisions across
 * Central Oregon. Visitor copy uses subdivision / the place name, never “plat.”
 *
 * PAGE_INVENTORY §3: live counts on the rows, doors. Not a mini-Bend KPI
 * Instrument.
 */

import type { Metadata } from 'next'
import { getSurfaceImages, getCommunityHeroUrlsBySlug } from '@/lib/data'
import {
  getRegistryPlatPublicInventory,
  registryChildPlats,
} from '@/lib/data/geo/plat-public-inventory'
import { preferPlaceHeroOrNull } from '@/lib/geo-images'
import { indexImagineStill, resolveIndexPlacePhoto } from '@/lib/geo/index-place-photo'
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
  V3PlaceDirectory,
  V3Quiet,
  V3SectionTracker,
  V3_FOOTER_COLUMNS,
  V3_ROOT_CLASS,
  v3Text,
  type V3LedgerFigureRow,
  type V3LedgerPlainRow,
} from '@/components/site/v3'
import { getIndexableSubdivisions } from '@/lib/data/subdivisions/getIndexableSubdivisions'
import { getPlatFamilies } from '@/lib/data/subdivisions/getPlatFamilies'
import {
  getPlatFamilyInventory,
  type PlatFamilyInventory,
} from '@/lib/data/subdivisions/getPlatFamilyInventory'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import {
  buildSubdivisionDirectory,
  SUBDIVISION_DIRECTORY_TRACE,
} from './_v3/subdivision-directory'
import {
  indexBarWeight,
  liveForSaleLabel,
} from '@/app/cities/_v3/cities-index-constants'
import type { SchemaInput } from '@/lib/site/json-ld'

export const revalidate = 3600

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const metadata: Metadata = pageMetadata({
  title: 'Central Oregon subdivisions',
  description:
    'Subdivisions across Central Oregon with live single-family inventory from the regional MLS.',
  path: '/subdivisions',
})

const LEDGER_TRACE =
  'live MLS through Oregon Data Share, active single-family listings filed under each subdivision name (Active and Active Under Contract, Coming Soon excluded); for a subdivision the county recorded in phases, every active single-family listing standing inside any of its recorded phases, each counted once. The median is the list price of those same listings'

function fmtPrice(n: number | null | undefined): string | null {
  return formatIndexMedianUsd(n)
}

export default async function SubdivisionsPage() {
  const childPlats = registryChildPlats()

  const [inventory, heroPhotoPool, parentHeroBySlug, indexablePlats, platFamilies] = await Promise.all([
    getRegistryPlatPublicInventory(),
    getSurfaceImages('hero'),
    getCommunityHeroUrlsBySlug(),
    // The whole directory (SEO-4 / EXP-3): every indexable subdivision page and
    // every multi-phase family, both off 6h caches the plat pages already fill.
    getIndexableSubdivisions(),
    getPlatFamilies(),
  ])
  const directoryGroups = buildSubdivisionDirectory({ indexable: indexablePlats, families: platFamilies })
  const directoryCount = directoryGroups.reduce((sum, g) => sum + g.entries.length, 0)
  const directoryFamilies = directoryGroups.reduce(
    (sum, g) => sum + g.entries.filter((e) => (e.children?.length ?? 0) > 0).length,
    0,
  )
  const inventoryOk = inventory.length > 0
  // A registry subdivision recorded in phases (Ridge at Eagle Crest, 60 county
  // plats) is counted the way its own page counts it: every active
  // single-family listing inside any recorded phase, each once, not only the
  // ones filed under the name (Matt 2026-09-23; VOICE-8). Same read, same set,
  // so the row and the page it opens print one number. A family read that does
  // not answer leaves the name-filed row as it was.
  const familyHeads = new Map(
    platFamilies.filter((f) => f.mainKind === 'subdivision').map((f) => [f.slug, f] as const),
  )
  const familyRows = await Promise.all(
    childPlats
      .filter((p) => familyHeads.has(p.slug))
      .map(async (p) => {
        const family = familyHeads.get(p.slug)!
        const inv = await withTimeoutFallback(
          getPlatFamilyInventory(family.members.map((m) => m.slug)),
          null,
          4000,
          'subdivisions:familyInventory',
        )
        return inv ? ([`${p.citySlug}:${p.slug}`, inv] as [string, PlatFamilyInventory]) : null
      }),
  )
  const familyInventoryByKey = new Map<string, PlatFamilyInventory>(familyRows.filter((row) => row != null))
  const inventoryRows = inventory.map((row) => {
    const fam = familyInventoryByKey.get(row.key)
    return fam ? { ...row, activeCount: fam.activeCount, medianListPrice: fam.medianListPrice } : row
  })
  const invByKey = new Map(inventoryRows.map((row) => [row.key, row]))
  const countByKey = new Map(inventoryRows.map((row) => [row.key, row.activeCount]))
  const featuredSeeds = publishFeaturedPlats(childPlats, countByKey, {
    inventoryOk,
    cap: 12,
  })

  const featured = featuredSeeds
    .map((p) => {
      const inv = invByKey.get(`${p.citySlug}:${p.slug}`) ?? null
      const live = parentHeroBySlug[p.parentSlug]
      const owned = resolveIndexPlacePhoto({
        slug: p.slug,
        parentSlug: p.parentSlug,
        pool: heroPhotoPool,
      })
      const photoSrc = indexImagineStill(owned, live) ?? preferPlaceHeroOrNull(live, owned)
      return {
        ...p,
        href: `/subdivisions/${p.slug}`,
        // "Deer Park is in Sunriver, Sunriver." named one place twice when the
        // community is the city (SITE-52 when audit).
        sentence: p.parent === p.city ? `${p.name} is in ${p.parent}.` : `${p.name} is in ${p.parent}, ${p.city}.`,
        photoSrc,
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

  const platCount = azSource.length
  const maxCount = Math.max(0, ...featured.map((p) => p.activeCount ?? 0))

  const rowBase = featured.map((p) => ({
    id: p.slug,
    href: p.href,
    // No `when`: the row's sentence already says where the plat is, and the
    // phone printed the same place twice, once as an eyebrow and once in the
    // sentence ("SUNRIVER" over "Deer Park is in Sunriver.", evaluator
    // 2026-09-09). The desktop encode hides `when` anyway (SITE-52 when audit).
    what: v3Text(p.name),
    detail: (() => {
      const median = fmtPrice(p.medianPrice)
      const bits = [median ? `Median list ${median}` : null, p.sentence].filter(Boolean)
      return bits.length > 0 ? v3Text(bits.join(' · ')) : undefined
    })(),
    media: p.photoSrc ? { src: p.photoSrc } : undefined,
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

  const caption = `${formatCount(platCount)} subdivisions inside the known communities.`

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
            Resort subdivisions, A to Z
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

        {/* THE WHOLE DIRECTORY (SEO-4 / EXP-3; Matt 2026-09-23). Every
            subdivision page the sitemap submits, town by town, with each
            multi-phase subdivision under its recorded name and its phases
            nested beneath it. Every anchor is in the served HTML. */}
        <V3PlaceDirectory
          id="directory"
          eyebrow="Central Oregon"
          heading="Every subdivision, by town"
          lede={`${formatCount(directoryCount)} subdivisions across Central Oregon, ${formatCount(directoryFamilies)} of them recorded in phases. Open a town, then a subdivision; a subdivision recorded in phases lists every phase under its name.`}
          groups={directoryGroups}
          source={SUBDIVISION_DIRECTORY_TRACE}
        />

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
