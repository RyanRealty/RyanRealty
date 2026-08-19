/**
 * /site-index: crawlable HTML index of browse-URL families (W3.4).
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11.
 * Quiet (what this is) then Ledger (every row a door). No sales Sheet.
 * Ranking counts order the rows and are never rendered.
 *
 * VISITOR OBJECTIVE: None as visitor content. A crawler internal-link hub
 * auto-derived from live inventory, linked from the footer legal row.
 * MACHINE OBJECTIVE: Distribute internal link equity across the live route
 * inventory beyond what XML sitemaps convey.
 * EXITS: /homes-for-sale, /cities, /housing-market, /blog
 *
 * THE PAGE CONTRACT: revalidate 3600, getSiteIndexLinks(), noStore() when
 * generatedAt === null, CollectionPage JSON-LD, V3SectionTracker
 * pageType="site_index".
 *
 * D11: no virtue names. No invented quote. No rendered ranking counts.
 */

import type { Metadata } from 'next'
import { unstable_noStore as noStore } from 'next/cache'
import { getSiteIndexLinks } from '@/lib/data'
import { pageMetadata } from '@/lib/site/page-metadata'
import { getCanonicalSiteUrl } from '@/lib/share-metadata'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Ledger,
  V3Quiet,
  V3SectionTracker,
  type V3LedgerPlainRow,
} from '@/components/site/v3'

export const revalidate = 3600

export const metadata: Metadata = pageMetadata({
  title: 'Site index',
  description:
    'Browse pages on ryan-realty.com in one place. Cities, communities, subdivisions, and searches, ordered by live inventory.',
  path: '/site-index',
})

const HUBS = [
  { href: '/homes-for-sale?view=list', label: 'Homes for sale' },
  { href: '/cities', label: 'Cities' },
  { href: '/communities', label: 'Communities' },
  { href: '/neighborhoods', label: 'Neighborhoods' },
  { href: '/subdivisions', label: 'Subdivisions' },
  { href: '/housing-market', label: 'Housing market' },
  { href: '/open-houses', label: 'Open houses' },
  { href: '/price-drops', label: 'Price drops' },
  { href: '/sell/valuation', label: 'Home valuation' },
  { href: '/blog', label: 'Blog' },
] as const

export default async function SiteIndexPage() {
  const data = await getSiteIndexLinks()
  if (data.generatedAt === null) noStore()

  const rows: V3LedgerPlainRow[] = []
  for (const city of data.cities) {
    const name = city.name?.trim()
    const browse = city.browseHref?.trim()
    const hub = city.hubHref?.trim()
    if (name && browse) {
      rows.push({
        href: browse,
        when: v3Text('Homes'),
        what: v3Text(`${name} homes for sale`),
        id: `city-browse-${city.slug}`,
      })
    }
    if (name && hub) {
      rows.push({
        href: hub,
        when: v3Text('Guide'),
        what: v3Text(`${name} city guide`),
        id: `city-hub-${city.slug}`,
      })
    }
  }
  for (const group of data.citySearches) {
    const cityName = group.cityName?.trim()
    if (!cityName) continue
    for (const link of group.links) {
      const label = link.label?.trim()
      const href = link.href?.trim()
      if (!label || !href) continue
      rows.push({
        href,
        when: v3Text(cityName),
        what: v3Text(label),
        id: `search-${href}`,
      })
    }
  }
  for (const community of data.communities) {
    const label = community.label?.trim()
    const href = community.href?.trim()
    if (!label || !href) continue
    rows.push({
      href,
      when: v3Text('Community'),
      what: v3Text(label),
      id: `community-${href}`,
    })
  }
  for (const sub of data.subdivisions) {
    const label = sub.label?.trim()
    const href = sub.href?.trim()
    if (!label || !href) continue
    rows.push({
      href,
      when: v3Text('Subdivision'),
      what: v3Text(label),
      id: `sub-${href}`,
    })
  }
  const [firstRow, ...restRows] = rows

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Site index',
    url: `${getCanonicalSiteUrl()}/site-index`,
    description:
      'Directory of city, community, subdivision, and search pages on ryan-realty.com.',
  }

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <V3Breadcrumb trail={[{ label: 'Home', href: '/' }, { label: 'Site index' }]} />

        <V3Quiet
          id="site-index"
          eyebrow="ryan-realty.com directory"
          heading="Site index"
          headingLevel={1}
          items={[
            {
              kind: 'prose',
              body: 'The browse pages on ryan-realty.com, grouped by city, community, subdivision, and search. Each group is ordered by live active-listing inventory and refreshes through the day.',
            },
            ...HUBS.map((hub) => ({ label: hub.label, href: hub.href })),
          ]}
        />

        {firstRow ? (
          <V3Ledger
            id="site-index-links"
            eyebrow={v3Text('Live inventory')}
            heading={v3Text('Cities, searches, communities')}
            rows={[firstRow, ...restRows]}
          />
        ) : (
          <V3Ledger
            id="site-index-links"
            eyebrow={v3Text('Live inventory')}
            heading={v3Text('Cities, searches, communities')}
            rows={[]}
            emptyMessage={v3Text(
              'The live index did not return rows in this refresh. Use the hub links above.',
            )}
          />
        )}
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
