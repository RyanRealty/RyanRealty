/**
 * Communities index — resort and master-planned communities, on
 * components/site/v3.
 *
 * PUBLIC_UI.md (locked 2026-08-11) section 3, four patterns, no two adjacent
 * sharing one:
 *
 *   Instrument  the live aggregate that is this hub's identity: homes for sale
 *               across the communities, and how many communities there are.
 *   Ledger      one row per registry community, every row a door into its guide,
 *               with the live active count in the value column and the median
 *               list price and the editorial sentence beneath the name.
 *   Quiet       the exact-anchor inventory doors ("<name> homes for sale",
 *               "Homes for sale in <city>") the conversion audit asked for, then
 *               the page's outbound edges and the Oregon Data Share citation
 *               MarketSources used to carry.
 *   Sheet       the A-to-Z browser (a filter set over every community) and the
 *               free listing-alert capture (RegionalAlertSheet, the same server
 *               action and the same payload the KB band submitted).
 *
 * Nothing was dropped in the move off the KB register: every figure, every
 * sentence, every link, and both JSON-LD payloads are still here. Chrome is
 * layout-owned; the footer is route-owned and sits outside <main>.
 *
 * All figures from the DAL. The registry resorts print the alias-aware pair
 * (the same set /communities/{slug} prints), never the snapshot's own count.
 */

import type { Metadata } from 'next'
import { getCommunitiesForIndex } from '@/app/actions/communities'
import { getRegistryResortPublicFigures } from '@/lib/kb/registry-resort-public-figures'
import { formatCount } from '@/lib/format/count'
import { formatPriceExact } from '@/lib/format/money'
import { getResortCommunityContent } from '@/lib/resort-community-content'
import { communityImage, cityHero, preferPlaceHero } from '@/lib/geo-images'
import { getSurfaceImages, pickSurfaceImage } from '@/lib/data'
import { subdivisionEntityKey } from '@/lib/slug'
import CommunityIndexBrowser from '@/components/community/CommunityIndexBrowser'
import { buildMarketFaq, type MarketFaqInput } from '@/lib/site/market-faq'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import type { SchemaInput } from '@/lib/site/json-ld'
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
  type V3QuietItem,
} from '@/components/site/v3'
import { RegionalAlertSheet } from '@/app/central-oregon/_v3/RegionalAlertSheet.client'
import resortCommunitiesRegistry from '@/data/resort-communities.json' assert { type: 'json' }

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

// Statically cached, revalidated every 30 minutes (was force-dynamic — the
// page reads only cached DAL data, so per-request rendering bought nothing
// except a slower TTFB on a 60k-pixel page).
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

/** The section 0 traces. Both name the population, because the alias-aware set
 *  and the snapshot count answer the same question differently. */
const PULSE_TRACE =
  'live MLS through Oregon Data Share, single-family active inventory across every Central Oregon community we track'

const LEDGER_TRACE =
  'live MLS through Oregon Data Share, active single-family listings under each community and its registered subdivision aliases. The median is the list price of those same listings'

type RegistryCommunity = {
  slug: string
  label: string
  city: string
  city_slug: string
  is_resort: boolean
}

function firstSentence(text: string): string {
  const m = text.match(/^.*?[.?](?=\s|$)/)
  return (m ? m[0] : text).trim()
}

export default async function CommunitiesPage() {
  const registry = resortCommunitiesRegistry.communities as ReadonlyArray<RegistryCommunity>

  const [allCommunities, heroPhotoPool, resortFigures] = await Promise.all([
    getCommunitiesForIndex(),
    getSurfaceImages('hero'),
    getRegistryResortPublicFigures(),
  ])

  const indexByEntityKey = new Map(allCommunities.map((c) => [c.entityKey, c]))

  // The 14 registry communities — the editorial layer. Registry order is
  // curated (data/resort-communities.json is the source of truth).
  const resorts = await Promise.all(
    registry.map(async (r) => {
      const idx = indexByEntityKey.get(subdivisionEntityKey(r.city, r.label)) ?? null
      const content = await getResortCommunityContent(r.slug)
      const sentence = content?.aboutProse?.[0] ? firstSentence(content.aboutProse[0]) : null
      const live = idx?.heroImageUrl
      const curated = communityImage(r.slug)
      const fallbackHero = cityHero(r.city_slug)
      // Four consecutive rows with no curated photo of their own (Mt Bachelor
      // Village, Inn of the 7th Mountain, Rivers Edge, Mountain High) all fell
      // back to the SAME single cityHero() image, reading as duplicate
      // template filler (design-audit P2). pickSurfaceImage spreads them
      // across the real, approved Bend-area photo pool instead — seeded by
      // slug so each community's fallback is still stable across renders.
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
        // Honest alt: a curated or live place photo shows the community itself,
        // the city fallback's alt describes what the photo actually shows.
        photoAlt: placeOwned ? `${r.label}, ${r.city} Oregon` : fallbackHero.alt,
        photoIsCommunity: placeOwned,
        // Registry resorts print the alias-aware pair (same set as
        // /communities/{slug}). Snapshot pending is a different set — withhold.
        activeCount: resortFigures.get(r.slug)?.activeCount ?? idx?.activeCount ?? 0,
        medianPrice: resortFigures.get(r.slug)?.medianListPrice ?? idx?.medianPrice ?? null,
      }
    }),
  )

  // Long tail: every community the index knows, alphabetical (already sorted
  // by getCommunitiesForIndex). Resorts stay in the index too so the A-to-Z
  // list is complete and every community URL is in the DOM.
  const indexItems = allCommunities.map((c) => ({
    slug: c.slug,
    name: c.subdivision,
    city: c.city,
    activeCount: c.activeCount,
  }))

  const totalActive = allCommunities.reduce((sum, c) => sum + c.activeCount, 0)
  const communityCount = allCommunities.length

  // Dataset JSON-LD from the SAME aggregate the hero tile renders. No pulse
  // row backs this aggregate, so dateModified stays unset rather than
  // guessing a refresh time (CLAUDE.md §0: never fabricate a timestamp).
  //
  // Unlike every other market surface, this page has NO second source to fall
  // back to. `totalActive` is already an aggregate over the community index, so
  // when it is unusable there is no snapshot row to reach for, and the §0-correct
  // degradation is to publish no Dataset at all rather than a figure nothing
  // backs. The `pulse ?? fallback` shape below makes that explicit at the call
  // site instead of burying it in a ternary: the fallback deliberately carries
  // no figures, buildMarketFaq therefore returns no variables, and the
  // `communityDatasetVars.length > 0` guard below drops the schema. Same
  // contract shape as the other KB data pages (G52), honest about having one
  // source rather than two.
  // 'region' — this index page's only figure is a region-wide active total.
  // It publishes no months of supply and no sold count, so the grain names the
  // population the count came from and nothing here can reach the withheld ones.
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

  const figures: V3InstrumentFigure[] = []
  if (totalActive > 0) {
    figures.push({
      value: v3Text(formatCount(totalActive)),
      label: v3Text('Homes for sale across these communities'),
    })
  }
  figures.push({
    value: v3Text(formatCount(communityCount)),
    label: v3Text('Communities'),
  })
  const [leadFigure, ...restFigures] = figures

  /**
   * "0 active" is itself the honest, verified figure — activeCount always
   * resolves through a `?? 0` above, so it is never truly unknown here, and
   * treating 0 as "data missing" contradicted the same zero-inventory case
   * rendering as "0 Active" everywhere else on the site (design-audit P3).
   */
  const rows: V3LedgerFigureRow[] = resorts.map((r) => {
    const median = r.medianPrice != null ? formatPriceExact(r.medianPrice) : null
    const bits = [median ? `Median list ${median}` : null, r.sentence].filter(Boolean)
    return {
      id: r.slug,
      href: `/communities/${r.slug}`,
      when: v3Text(`${r.city} · Oregon`),
      what: v3Text(r.name),
      detail: bits.length > 0 ? v3Text(bits.join(' · ')) : undefined,
      value: v3Text(`${formatCount(r.activeCount)} for sale`),
      // Only a curated photograph of the community itself. The pooled city
      // frame is a fallback, and the Ledger's media slot takes no fallbacks.
      media: r.photoIsCommunity ? { src: r.photoSrc } : undefined,
      ariaLabel: v3Text(`${r.name} guide, ${r.city} Oregon`),
    }
  })
  const [firstRow, ...restRows] = rows

  /**
   * The exact-match inventory anchors. Conversion audit #9: "tetherow homes
   * for sale" sat at position 13 with zero exact-anchor internal links, and
   * the bare guide link promised inventory it did not deliver (design-audit
   * P2). Both doors per community live here, as the Quiet block that carries
   * this node's outbound edges.
   */
  const inventoryDoors: V3QuietItem[] = resorts.flatMap((r) => [
    { label: `${r.name} homes for sale`, href: `/communities/${r.slug}#listings` },
    { label: `Homes for sale in ${r.city}`, href: `/homes-for-sale/${r.citySlug}` },
  ])

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />

        {/* Structured data: BreadcrumbList + Dataset (aggregate active count) +
            the CollectionPage + ItemList inline script below. */}
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

        {leadFigure ? (
          <V3Instrument
            id="communities-pulse"
            level={1}
            eyebrow={v3Text('Live market')}
            headline={v3Text('Communities across Central Oregon.')}
            note={v3Text(
              'Resorts, master-planned communities, and the plats between them. Bend, Redmond, Sisters, Sunriver, and the high desert towns in between. Live single-family inventory from the regional MLS.',
            )}
            figures={[leadFigure, ...restFigures]}
            source={v3Text(PULSE_TRACE)}
            action={{ label: v3Text('Search all listings'), href: '/search', variant: 'primary' }}
          />
        ) : null}

        {firstRow ? (
          <V3Ledger
            id="resort-communities"
            eyebrow={v3Text('Resort communities')}
            heading={v3Text('Resorts and planned communities')}
            rows={[firstRow, ...restRows]}
            source={v3Text(LEDGER_TRACE)}
          />
        ) : (
          <V3Ledger
            id="resort-communities"
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

        {/* Pattern 5, Sheet: a filter set over every community. The control is
            the pre-barrel client browser, which owns its own markup. */}
        <section
          id="all-communities"
          aria-labelledby="all-communities-heading"
          className="mx-auto w-full max-w-5xl px-5 pb-16"
        >
          <V3Heading level={2} id="all-communities-heading">
            Every community, A to Z
          </V3Heading>
          <V3Lede>
            {formatCount(communityCount)} neighborhoods and subdivisions across Central Oregon.
            Search by name or city, or browse the index. Each links to live listings and market
            data.
          </V3Lede>
          <CommunityIndexBrowser items={indexItems} />
        </section>

        <V3Quiet
          id="edges"
          eyebrow="Central Oregon"
          heading="Find a home, or price the one you have"
          items={[
            { label: 'Search all listings', href: '/search' },
            { label: 'Luxury homes in Bend', href: '/luxury-homes-bend' },
            { label: 'Recorded plats', href: '/subdivisions' },
            { label: 'Value my home', href: '/sell/valuation' },
            { label: 'Oregon Data Share', href: 'https://www.oregondatashare.com' },
          ]}
          note="Search active listings across every community, with filters for price, beds, and place. Oregon Data Share is the regional MLS cooperative behind the live listing and market data on this page."
        />

        {/* F3 residual: free listing_alerts on the communities hub (was LP-only
            hop). Same server action and the same payload the KB band posted. */}
        <RegionalAlertSheet placeLabel="Central Oregon" city="" />
      </main>

      {/* Outside <main> on purpose. HTML-AAM maps <footer> to role=contentinfo
          only when it is NOT nested in sectioning content. */}
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
