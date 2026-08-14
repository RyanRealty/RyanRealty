/**
 * /communities — master-plan index. Opens a Ledger of the 14 registry
 * communities. Belonging is the row, not a 753 / 613 Instrument.
 * The old line "Places open on Instrument" is retired.
 */

import type { Metadata } from 'next'
import { getCommunitiesForIndex } from '@/app/actions/communities'
import { getResortCommunityContent } from '@/lib/resort-community-content'
import { communityImage } from '@/lib/geo-images'
import { listingsBrowsePath } from '@/lib/slug'
import { valuationHref } from '@/lib/site/valuation-href'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import type { SchemaInput } from '@/lib/site/json-ld'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Ledger,
  V3Quiet,
  V3SectionTracker,
  type V3LedgerFigureRow,
  type V3LedgerPlainRow,
} from '@/components/site/v3'
import { RegionalAlertSheet } from '@/app/central-oregon/_v3/RegionalAlertSheet.client'
import resortCommunitiesRegistry from '@/data/resort-communities.json' assert { type: 'json' }
import { belongingLine, resortIndexRow } from './_v3/community-index-rows'

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
  const allCommunities = await getCommunitiesForIndex()

  const resorts = await Promise.all(
    registry.map(async (entry) => {
      const content = await getResortCommunityContent(entry.slug)
      return {
        slug: entry.slug,
        name: entry.label.trim(),
        city: entry.city,
        belonging: belongingLine(content),
        photoSrc: communityImage(entry.slug),
      }
    }),
  )

  const resortRows: V3LedgerPlainRow[] = []
  for (const entry of resorts) {
    const row = resortIndexRow(entry)
    if (row) resortRows.push(row)
  }
  const [firstResort, ...restResorts] = resortRows

  const indexRows: V3LedgerFigureRow[] = []
  for (const community of allCommunities) {
    const name = community.subdivision.trim()
    const slug = community.slug.trim()
    if (!name || !slug) continue
    const value =
      community.activeCount > 0
        ? `${community.activeCount.toLocaleString('en-US')} ${community.activeCount === 1 ? 'home' : 'homes'}`
        : 'See the community'
    indexRows.push({
      href: `/communities/${slug}`,
      when: v3Text(community.city.trim() || 'Oregon'),
      what: v3Text(name),
      value: v3Text(value),
      id: slug,
    })
  }
  const [firstIndex, ...restIndex] = indexRows

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Communities', url: '/communities' },
      ],
    },
  ]

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
                itemListElement: resorts.map((entry, index) => ({
                  '@type': 'ListItem',
                  position: index + 1,
                  name: `${entry.name}, ${entry.city}, Oregon`,
                  url: `${siteUrl}/communities/${entry.slug}`,
                })),
              },
            }),
          }}
        />

        <V3Breadcrumb trail={[{ label: 'Home', href: '/' }, { label: 'Communities' }]} />

        {firstResort ? (
          <V3Ledger
            id="resort-communities"
            headingLevel={1}
            eyebrow={v3Text('Central Oregon')}
            heading={v3Text('Communities across Central Oregon')}
            rows={[firstResort, ...restResorts]}
            action={{
              label: v3Text(firstResort.what),
              href: firstResort.href,
              variant: 'ghost',
            }}
          />
        ) : (
          <V3Ledger
            id="resort-communities"
            headingLevel={1}
            heading={v3Text('Communities across Central Oregon')}
            rows={[]}
            emptyMessage={v3Text('No master-plan communities returned on this refresh.')}
          />
        )}

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

      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
