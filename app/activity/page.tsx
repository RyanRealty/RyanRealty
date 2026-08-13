/**
 * /activity — what just moved on the list, on the v3 barrel.
 *
 * THE PAGE CONTRACT, carried across unchanged: metadata title "What just moved
 * on the list", canonical /activity, force-dynamic, getActivityFeed({ limit: 24 }),
 * CollectionPage + BreadcrumbList JSON-LD, V3SectionTracker pageType="feed",
 * AdUnit slot 1001003002 (monetization leftover).
 *
 * KB-era deletions: KbHero, KbActivity, KbFooter, SmoothScrollProvider,
 * HomeValuationCta ("What's your home worth?", D11 ban). Valuation ask is
 * now Quiet "Value my home" via valuationHref('/activity'). Dates through
 * formatDate (Pacific), not toLocaleDateString UTC.
 *
 * LEFTOVER: AdUnit. Monetization owns the slot. Declared, not restyled.
 *
 * Chrome: layout owns V3Chrome. V3Footer outside main.
 */

import type { Metadata } from 'next'
import { getActivityFeed } from '@/app/actions/activity-feed'
import AdUnit from '@/components/AdUnit'
import { listingsBrowsePath } from '@/lib/slug'
import { valuationHref } from '@/lib/site/valuation-href'
import { generateBreadcrumbSchema } from '@/lib/structured-data'
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
} from '@/components/site/v3'
import { activityRows } from './_v3/activity-rows'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/api/og?type=default`

export const metadata: Metadata = {
  title: 'What just moved on the list',
  description:
    'New listings, price cuts, pending sales, and closed sales across Central Oregon, as they hit the MLS.',
  alternates: { canonical: `${siteUrl}/activity` },
  openGraph: {
    title: 'What just moved on the list | Ryan Realty',
    description:
      'New listings, price cuts, pending sales, and closed sales across Central Oregon neighborhoods.',
    url: `${siteUrl}/activity`,
    type: 'website',
    images: [{ url: ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary',
    title: 'What just moved on the list | Ryan Realty',
    description:
      'New listings, price cuts, pending sales, and closed sales across Central Oregon neighborhoods.',
    images: [ogImage],
  },
}

export const dynamic = 'force-dynamic'

const ACTIVITY_TRACE =
  'live MLS activity events joined to Central Oregon listings, newest first, cap 24'

export default async function ActivityPage() {
  const items = await getActivityFeed({ limit: 24 })
  const rows = activityRows(items)
  const [firstRow, ...restRows] = rows

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'What just moved on the list',
    url: `${siteUrl}/activity`,
    description: 'New listings, price cuts, pending sales, and closed sales across Central Oregon.',
  }

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker pageType="feed" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              generateBreadcrumbSchema([
                { name: 'Home', url: siteUrl },
                { name: 'Activity', url: `${siteUrl}/activity` },
              ]),
            ),
          }}
        />
        <V3Breadcrumb trail={[{ label: 'Home', href: '/' }, { label: 'Activity' }]} />

        {items.length > 0 ? (
          <V3Instrument
            id="moved"
            level={1}
            eyebrow={v3Text('Central Oregon')}
            headline={v3Text('What just moved on the list')}
            figures={[
              {
                value: v3Text(String(items.length)),
                label: v3Text(items.length === 1 ? 'recent MLS move' : 'recent MLS moves'),
                href: listingsBrowsePath(),
              },
            ]}
            source={v3Text(ACTIVITY_TRACE)}
            action={{
              label: v3Text('See homes for sale'),
              href: listingsBrowsePath(),
              variant: 'primary',
            }}
          />
        ) : (
          <V3Quiet
            id="moved"
            heading="What just moved on the list"
            headingLevel={1}
            items={[
              {
                kind: 'prose',
                term: 'No recent activity',
                body: 'The market is quiet right now. Browse active homes or check back for new listings, price changes, and sales.',
              },
              { label: 'See homes for sale', href: listingsBrowsePath() },
            ]}
          />
        )}

        {firstRow ? (
          <V3Ledger
            id="feed"
            eyebrow={v3Text('Live MLS')}
            heading={v3Text('Latest moves on the list')}
            rows={[firstRow, ...restRows]}
            source={v3Text(ACTIVITY_TRACE)}
            action={{ label: v3Text('See homes for sale'), href: listingsBrowsePath() }}
          />
        ) : (
          <V3Ledger
            id="feed"
            eyebrow={v3Text('Live MLS')}
            heading={v3Text('Latest moves on the list')}
            rows={[]}
            emptyMessage={v3Text(
              'The market is quiet right now. Browse active homes or check back for new listings, price changes, and sales.',
            )}
          />
        )}

        <AdUnit slot="1001003002" format="horizontal" />

        <V3Quiet
          id="value"
          eyebrow="Selling"
          heading="Value my home"
          items={[
            {
              kind: 'prose',
              body: 'A written opinion of value from a Central Oregon broker, using the same live list this page reads.',
            },
            { label: 'Value my home', href: valuationHref('/activity') },
            { label: 'See homes for sale', href: listingsBrowsePath() },
          ]}
        />
      </main>

      {/* Outside <main> on purpose. HTML-AAM maps <footer> to role=contentinfo only
          when it is NOT nested in sectioning content, and <main> is sectioning
          content, so inside it the element is a generic and the page ships no
          contentinfo landmark. */}
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
