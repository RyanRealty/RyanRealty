/**
 * /luxury-homes-bend — Bend homes above $1.5 million, on the v3 barrel.
 *
 * THE PAGE CONTRACT, carried across unchanged: metadata title "Luxury Homes in
 * Bend, Oregon", canonical /luxury-homes-bend, revalidate 900, LUX_MIN =
 * 1_500_000, propertyType A, getListingTiles, V3SectionTracker
 * pageType="luxury-homes-bend".
 *
 * Opening is Field of these houses. Count is a caption of the set on screen.
 */

import type { Metadata } from 'next'
import { getListingTiles } from '@/lib/data'
import { homesForSalePath } from '@/lib/slug'
import { valuationHref } from '@/lib/site/valuation-href'
import {
  V3_ROOT_CLASS,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Quiet,
  V3SectionTracker,
} from '@/components/site/v3'
import { LUX_MIN, LUX_COMMUNITIES, LUX_TRACE, luxuryFieldItems } from './_v3/luxury-rows'
import { LuxuryHomesField } from './_v3/LuxuryHomesField'

export const revalidate = 900

const LUX_FILTER = {
  city: 'Bend',
  status: 'active' as const,
  minPrice: LUX_MIN,
  propertyType: 'A',
}

export const metadata: Metadata = {
  title: 'Luxury Homes in Bend, Oregon',
  description:
    'Homes for sale in Bend, Oregon above $1.5 million. Live MLS listings and the communities where they sit.',
  alternates: { canonical: '/luxury-homes-bend' },
  openGraph: {
    title: 'Luxury Homes in Bend, Oregon | Ryan Realty',
    description: 'Active Bend homes above $1.5 million, pulled from the regional MLS.',
    images: ['/images/homepage/tetherow-golf-aerial.jpg'],
  },
}

export default async function LuxuryHomesBendPage() {
  const tiles = await getListingTiles({ ...LUX_FILTER, sort: 'price-desc', limit: 48 })
  const items = luxuryFieldItems(tiles)
  const count = items.length

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker pageType="luxury-homes-bend" />
        <V3Breadcrumb trail={[{ label: 'Home', href: '/' }, { label: 'Luxury homes' }]} />

        {count > 0 ? (
          <LuxuryHomesField
            heading="Bend homes above $1.5 million"
            captionValue={count.toLocaleString('en-US')}
            captionLabel={count === 1 ? 'home above $1.5 million' : 'homes above $1.5 million'}
            source={LUX_TRACE}
            items={items}
            emptyMessage="No Bend home above $1.5 million in this refresh has a photo, a street address, and a list price."
          />
        ) : (
          <V3Quiet
            id="homes"
            heading="Bend homes above $1.5 million"
            headingLevel={1}
            items={[
              {
                kind: 'prose',
                term: 'None active right now',
                body: 'No single-family home above $1.5 million is active in Bend on this refresh. We can email you when the next one lists.',
              },
              { label: 'See all active Bend homes', href: homesForSalePath('Bend') },
              { label: 'Value my home', href: valuationHref('/luxury-homes-bend') },
              { label: 'Set up an alert', href: '/lp/buyer-listing-alerts' },
            ]}
          />
        )}

        <V3Quiet
          id="communities"
          eyebrow="Bend"
          heading="Where these homes sit"
          items={[
            {
              kind: 'prose',
              body: 'Most Bend homes above $1.5 million sit in gated and golf communities on the west side and along the Deschutes. These are the ones with dedicated pages.',
            },
            ...LUX_COMMUNITIES.map((c) => ({
              label: c.label,
              href: `/communities/${c.slug}`,
            })),
            { label: 'All active Bend homes', href: homesForSalePath('Bend') },
            { label: 'Value my home', href: valuationHref('/luxury-homes-bend') },
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
