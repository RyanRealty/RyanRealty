/**
 * /our-homes — homes listed by Ryan Realty, on the components/site/v3 barrel.
 *
 * THE PAGE CONTRACT, carried across unchanged: metadata title, canonical
 * /our-homes, force-dynamic, getBrokerageListings (ListOfficeName ILIKE
 * '%Ryan Realty%'), SHOWN_LISTINGS = 12, KbSectionTracker pageType="info".
 *
 * KB-era deletions: KbHero, KbFeatured, KbFooter, SmoothScrollProvider, the
 * raw CTA row, the restyled empty-state section, the "List your home on this
 * page" block (its 3% fee fact moves to Quiet).
 *
 * Chrome: layout owns V3Chrome. V3Footer outside main.
 */

import type { Metadata } from 'next'
import { getBrokerageListings } from '@/lib/data'
import { listingsBrowsePath } from '@/lib/slug'
import { valuationHref } from '@/lib/site/valuation-href'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Instrument,
  V3Ledger,
  V3Quiet,
} from '@/components/site/v3'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import { ourHomesRows, SHOWN_LISTINGS } from './_v3/our-homes-rows'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/api/og?type=default`

export const metadata: Metadata = {
  title: 'Homes listed by Ryan Realty · Central Oregon',
  description:
    'Current homes listed for sale by Ryan Realty across Bend, Redmond, Sisters, Sunriver, and Central Oregon. Live inventory from the regional MLS.',
  alternates: { canonical: `${siteUrl}/our-homes` },
  openGraph: {
    title: 'Homes listed by Ryan Realty · Central Oregon',
    url: `${siteUrl}/our-homes`,
    type: 'website',
    images: [{ url: ogImage, width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', images: [ogImage] },
}

export const dynamic = 'force-dynamic'

const BROKERAGE_TRACE =
  'active, pending, and closed listings where ListOfficeName matches Ryan Realty, regional MLS'

export default async function OurHomesPage() {
  const listings = await getBrokerageListings()
  const rows = ourHomesRows(listings)
  const [firstRow, ...restRows] = rows
  const total = listings.length

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <KbSectionTracker pageType="info" />
        <V3Breadcrumb trail={[{ label: 'Home', href: '/' }, { label: 'Our homes' }]} />

        {total > 0 ? (
          <V3Instrument
            id="listed"
            level={1}
            eyebrow={v3Text('Ryan Realty')}
            headline={v3Text('Homes listed by Ryan Realty')}
            figures={[
              {
                value: v3Text(String(total)),
                label: v3Text(total === 1 ? 'home listed by this office' : 'homes listed by this office'),
                href: listingsBrowsePath(),
              },
            ]}
            source={v3Text(BROKERAGE_TRACE)}
            action={{
              label: v3Text('See homes for sale'),
              href: listingsBrowsePath(),
              variant: 'primary',
            }}
          />
        ) : (
          <V3Quiet
            id="listed"
            heading="Homes listed by Ryan Realty"
            headingLevel={1}
            items={[
              {
                kind: 'prose',
                term: 'No listings right now',
                body: 'No Ryan Realty office listings are on the market in this refresh. Browse every Central Oregon home, or value your own.',
              },
              { label: 'See homes for sale', href: listingsBrowsePath() },
              { label: 'Value my home', href: valuationHref('/our-homes') },
              { label: 'Contact us', href: '/contact?inquiry=Selling' },
            ]}
          />
        )}

        {firstRow ? (
          <V3Ledger
            id="inventory"
            eyebrow={v3Text('On the market')}
            heading={v3Text('Current listings for sale')}
            rows={[firstRow, ...restRows]}
            source={v3Text(BROKERAGE_TRACE)}
            action={
              total > SHOWN_LISTINGS
                ? { label: v3Text(`View all ${total} listings`), href: listingsBrowsePath() }
                : { label: v3Text('See homes for sale'), href: listingsBrowsePath() }
            }
          />
        ) : (
          <V3Ledger
            id="inventory"
            eyebrow={v3Text('On the market')}
            heading={v3Text('Current listings for sale')}
            rows={[]}
            emptyMessage={v3Text(
              'No Ryan Realty listing in this refresh has a street address and a list price.',
            )}
          />
        )}

        <V3Quiet
          id="sell"
          eyebrow="Sell with Ryan Realty"
          heading="The listing plan"
          items={[
            {
              kind: 'prose',
              body: 'The listing fee is 3% of the sale price. You get a CMA with the comps behind the price, professional photo and video, and one broker from listing to close.',
            },
            { label: 'Value my home', href: valuationHref('/our-homes') },
            { label: 'See the listing plan', href: '/sell' },
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
