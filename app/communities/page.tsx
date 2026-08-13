/**
 * /communities — Central Oregon communities index, on the v3 barrel.
 *
 * Places open on Instrument. Order: Breadcrumb, Instrument (aggregate), Ledger
 * (14 registry resorts), Sheet (SFR alerts), Ledger (A to Z), Quiet, Footer
 * outside main. Two Ledgers are not adjacent.
 *
 * THE PAGE CONTRACT: metadata title/description/canonical, revalidate 1800,
 * CollectionPage + ItemList of the 14 registry communities, Dataset from the
 * same aggregate the Instrument prints, V3SectionTracker pageType="index".
 * Capture: submitSearchAlertSignup with city="" and propertyType A.
 *
 * KB-era deletions: KbBreadcrumb, KbFooter, SmoothScrollProvider, kb.css,
 * RegionalSfrAlertsBand, MarketSources, CommunityIndexBrowser (search +
 * collapsed A-Z, replaced by a Ledger of the same URLs so every
 * /communities/[slug] stays in the DOM), unlabeled city-fallback photos on
 * resort rows (Ledger media only when communityImage() has a dedicated photo),
 * "What is your home worth" (D11: Value my home).
 */

import type { Metadata } from 'next'
import { getCommunitiesForIndex } from '@/app/actions/communities'
import { getAllCommunitySnapshots, getAllCitySnapshots } from '@/lib/data'
import { getResortCommunityContent } from '@/lib/resort-community-content'
import { communityImage } from '@/lib/geo-images'
import { subdivisionEntityKey } from '@/lib/slug'
import { listingsBrowsePath } from '@/lib/slug'
import { valuationHref } from '@/lib/site/valuation-href'
import { formatPrice } from '@/lib/format/money'
import { buildMarketFaq, type MarketFaqInput } from '@/lib/site/market-faq'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import type { SchemaInput } from '@/lib/site/json-ld'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Instrument,
  V3Ledger,
  V3Quiet,
  V3SectionTracker,
  type V3InstrumentFigure,
  type V3LedgerFigureRow,
} from '@/components/site/v3'
import { RegionalAlertSheet } from '@/app/central-oregon/_v3/RegionalAlertSheet.client'
import resortCommunitiesRegistry from '@/data/resort-communities.json' assert { type: 'json' }
import { firstSentence } from '@/app/cities/_v3/cities-index-constants'

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

type RegistryCommunity = {
  slug: string
  label: string
  city: string
  city_slug: string
  is_resort: boolean
}

export default async function CommunitiesPage() {
  const registry = resortCommunitiesRegistry.communities as ReadonlyArray<RegistryCommunity>

  const [allCommunities, snapshots, citySnapshots] = await Promise.all([
    getCommunitiesForIndex(),
    getAllCommunitySnapshots(),
    getAllCitySnapshots(),
  ])

  const snapByKey = new Map(snapshots.map((s) => [s.geoKey, s]))
  const snapByLabel = new Map<string, (typeof snapshots)[number]>()
  for (const s of snapshots) {
    const label = s.geoKey.split(':')[1] ?? ''
    const prev = snapByLabel.get(label)
    if (!prev || s.activeSfrCount > prev.activeSfrCount) snapByLabel.set(label, s)
  }
  const cityByKey = new Map(citySnapshots.map((s) => [s.geoKey, s]))
  const indexByEntityKey = new Map(allCommunities.map((c) => [c.entityKey, c]))

  const resorts = await Promise.all(
    registry.map(async (r) => {
      const labelKey = r.label.toLowerCase().trim()
      const geoKey = `${r.city.toLowerCase().trim()}:${labelKey}`
      const snap = snapByKey.get(geoKey) ?? snapByLabel.get(labelKey) ?? cityByKey.get(labelKey) ?? null
      const idx = indexByEntityKey.get(subdivisionEntityKey(r.city, r.label)) ?? null
      const content = await getResortCommunityContent(r.slug)
      const sentence = content?.aboutProse?.[0] ? firstSentence(content.aboutProse[0]) : null
      const name = r.label.trim()
      return {
        slug: r.slug,
        name,
        city: r.city,
        citySlug: r.city_slug,
        sentence,
        photoSrc: communityImage(r.slug),
        activeCount: snap?.activeSfrCount ?? idx?.activeCount ?? null,
        medianPrice: snap?.medianListPrice ?? idx?.medianPrice ?? null,
      }
    }),
  )

  const resortRows: V3LedgerFigureRow[] = []
  for (const r of resorts) {
    if (!r.name) continue
    const value =
      r.activeCount != null && r.activeCount > 0
        ? `${r.activeCount.toLocaleString('en-US')} ${r.activeCount === 1 ? 'home' : 'homes'}`
        : r.medianPrice != null
          ? formatPrice(r.medianPrice)
          : r.activeCount === 0
            ? '0 homes'
            : 'See the community'
    const detail = [r.city, r.sentence].filter((part): part is string => Boolean(part)).join(' · ')
    resortRows.push({
      href: `/communities/${r.slug}`,
      when: v3Text(r.city.trim() || 'Oregon'),
      what: v3Text(r.name),
      detail: detail ? v3Text(detail) : undefined,
      value: v3Text(value),
      id: r.slug,
      media: r.photoSrc ? { src: r.photoSrc } : undefined,
    })
  }
  const [firstResort, ...restResorts] = resortRows

  const indexRows: V3LedgerFigureRow[] = []
  for (const c of allCommunities) {
    const name = c.subdivision.trim()
    const slug = c.slug.trim()
    if (!name || !slug) continue
    const value =
      c.activeCount > 0
        ? `${c.activeCount.toLocaleString('en-US')} ${c.activeCount === 1 ? 'home' : 'homes'}`
        : '0 homes'
    indexRows.push({
      href: `/communities/${slug}`,
      when: v3Text(c.city.trim() || 'Oregon'),
      what: v3Text(name),
      value: v3Text(value),
      id: slug,
    })
  }
  const [firstIndex, ...restIndex] = indexRows

  const totalActive = allCommunities.reduce((sum, c) => sum + c.activeCount, 0)
  const communityCount = allCommunities.length

  const pulse: MarketFaqInput | null = totalActive > 0 ? { activeCount: totalActive } : null
  const communityFaqInput: MarketFaqInput = pulse ?? { activeCount: null }
  const { datasetVariables: communityDatasetVars } = buildMarketFaq(
    'Central Oregon communities',
    communityFaqInput,
  )

  const figures: V3InstrumentFigure[] = []
  figures.push({
    value: v3Text(totalActive.toLocaleString('en-US')),
    label: v3Text('homes for sale across these communities'),
    href: listingsBrowsePath(),
  })
  if (communityCount > 0) {
    figures.push({
      value: v3Text(communityCount.toLocaleString('en-US')),
      label: v3Text('communities'),
      href: '#all-communities',
    })
  }
  const [firstFigure, ...restFigures] = figures

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

        {firstFigure ? (
          <V3Instrument
            id="communities-pulse"
            level={1}
            eyebrow={v3Text('Central Oregon')}
            headline={v3Text('Communities across Central Oregon')}
            figures={[firstFigure, ...restFigures]}
            source={v3Text(
              'active single-family inventory summed across every Central Oregon community the index tracks, from the MLS. No pulse row backs this aggregate, so this page does not print a refresh time.',
            )}
            action={{
              label: v3Text('Value my home'),
              href: valuationHref('/communities'),
            }}
          />
        ) : (
          <V3Quiet
            id="communities-pulse"
            heading="Communities across Central Oregon"
            headingLevel={1}
            items={[
              {
                kind: 'prose',
                term: 'No community inventory on this refresh',
                body: 'The community index returned no rows, so this page is not printing a total.',
              },
            ]}
          />
        )}

        {firstResort ? (
          <V3Ledger
            id="resort-communities"
            eyebrow={v3Text('Resort communities')}
            heading={v3Text('Resorts and planned communities')}
            rows={[firstResort, ...restResorts]}
            source={v3Text(
              'geo_snapshot_mv keyed city:subdivision, with a city-row fallback when the MLS stores the place as a city. Registry order from data/resort-communities.json.',
            )}
            action={{
              label: v3Text('Search all listings'),
              href: listingsBrowsePath(),
              variant: 'ghost',
            }}
          />
        ) : null}

        <RegionalAlertSheet placeLabel="Central Oregon" city="" />

        {firstIndex ? (
          <V3Ledger
            id="all-communities"
            eyebrow={v3Text('The full index')}
            heading={v3Text('Every community, A to Z')}
            rows={[firstIndex, ...restIndex]}
            source={v3Text(
              'community index active single-family counts, one row per tracked subdivision. Every URL is in this list.',
            )}
          />
        ) : (
          <V3Ledger
            id="all-communities"
            heading={v3Text('Every community, A to Z')}
            rows={[]}
            emptyMessage={v3Text('No communities returned on this refresh.')}
          />
        )}

        <V3Quiet
          id="explore"
          eyebrow="Next"
          heading="Keep exploring Central Oregon"
          items={[
            { label: 'Cities', href: '/cities' },
            { label: 'Housing market', href: '/housing-market' },
            { label: 'Search homes', href: listingsBrowsePath() },
            { label: 'Value my home', href: valuationHref('/communities') },
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
