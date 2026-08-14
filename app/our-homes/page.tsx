/**
 * /our-homes — homes listed by Ryan Realty, on the components/site/v3 barrel.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md §3 Homes. Opening is
 * Field of those houses. Count is a caption. Towns are filters. The next
 * tap is a house. Empty Field only when both office query shapes are empty.
 *
 * THE PAGE CONTRACT: metadata title, canonical /our-homes, force-dynamic,
 * getBrokerageListings, SHOWN_LISTINGS = 12, V3SectionTracker pageType="info".
 */

import type { Metadata } from 'next'
import { getBrokerageListings } from '@/lib/data'
import {
  V3_ROOT_CLASS,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Quiet,
  V3SectionTracker,
} from '@/components/site/v3'
import { OurHomesField } from './_v3/OurHomesField'
import { OUR_HOMES_TRACE, ourHomesFieldItems, ourHomesTowns } from './_v3/our-homes-rows'

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

export default async function OurHomesPage() {
  const listings = await getBrokerageListings()
  const items = ourHomesFieldItems(listings)
  const towns = ourHomesTowns(listings)
  const count = items.length

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker pageType="info" />
        <V3Breadcrumb trail={[{ label: 'Home', href: '/' }, { label: 'Our homes' }]} />

        <OurHomesField
          heading="Homes listed by Ryan Realty"
          captionValue={count.toLocaleString('en-US')}
          captionLabel={
            count === 1 ? 'home listed by this office' : 'homes listed by this office'
          }
          source={OUR_HOMES_TRACE}
          items={items}
          towns={towns}
          emptyMessage="No Ryan Realty office listing is on the market in this refresh."
        />

        <V3Quiet
          id="sell"
          eyebrow="Sell with Ryan Realty"
          heading="The listing plan"
          items={[
            {
              kind: 'prose',
              body: 'The listing fee is 3% of the sale price. You get a CMA with the comps behind the price, professional photo and video, and one broker from listing to close.',
            },
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
