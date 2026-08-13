/**
 * /luxury-homes-bend — Bend homes above $1.5 million, on the v3 barrel.
 *
 * THE PAGE CONTRACT, carried across unchanged: metadata title "Luxury Homes in
 * Bend, Oregon", canonical /luxury-homes-bend, revalidate 900, LUX_MIN =
 * 1_500_000, propertyType A, getListingTiles + getListingTilesCount,
 * KbSectionTracker pageType="luxury-homes-bend".
 *
 * KB-era deletions: the hardcoded-hex film hero, the raw listing cards, the
 * raw community chips, KbFooter, @no-breadcrumb (this is a content page, so it
 * now carries Home → Luxury homes).
 *
 * Chrome: layout owns V3Chrome. V3Footer outside main.
 */

import type { Metadata } from 'next'
import { getListingTiles, getListingTilesCount } from '@/lib/data'
import { homesForSalePath } from '@/lib/slug'
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
import { LUX_MIN, LUX_COMMUNITIES, luxuryRows } from './_v3/luxury-rows'

export const revalidate = 900

const LUX_FILTER = {
  city: 'Bend',
  status: 'active' as const,
  minPrice: LUX_MIN,
  propertyType: 'A',
}

const LUX_TRACE =
  'live MLS through Oregon Data Share, active single-family homes in Bend with list price at or above $1,500,000'

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
  const [tiles, count] = await Promise.all([
    getListingTiles({ ...LUX_FILTER, sort: 'price-desc', limit: 12 }),
    getListingTilesCount(LUX_FILTER),
  ])
  const rows = luxuryRows(tiles)
  const [firstRow, ...restRows] = rows

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <KbSectionTracker pageType="luxury-homes-bend" />
        <V3Breadcrumb trail={[{ label: 'Home', href: '/' }, { label: 'Luxury homes' }]} />

        {count > 0 ? (
          <V3Instrument
            id="luxury"
            level={1}
            eyebrow={v3Text('Bend, Oregon')}
            headline={v3Text('Homes in Bend above $1.5 million')}
            figures={[
              {
                value: v3Text(count.toLocaleString('en-US')),
                label: v3Text('single-family homes above $1.5 million'),
                href: homesForSalePath('Bend'),
              },
            ]}
            source={v3Text(LUX_TRACE)}
            action={{
              label: v3Text('See all active Bend homes'),
              href: homesForSalePath('Bend'),
              variant: 'primary',
            }}
          />
        ) : (
          <V3Quiet
            id="luxury"
            heading="Homes in Bend above $1.5 million"
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

        {firstRow ? (
          <V3Ledger
            id="listings"
            eyebrow={v3Text('Bend')}
            heading={v3Text('Active listings, high to low')}
            rows={[firstRow, ...restRows]}
            source={v3Text(LUX_TRACE)}
            action={{ label: v3Text('See all active Bend homes'), href: homesForSalePath('Bend') }}
          />
        ) : (
          <V3Ledger
            id="listings"
            eyebrow={v3Text('Bend')}
            heading={v3Text('Active listings, high to low')}
            rows={[]}
            emptyMessage={v3Text(
              'No Bend home above $1.5 million in this refresh has a photo, a street address, and a list price.',
            )}
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
            { label: 'Value my home', href: valuationHref('/luxury-homes-bend') },
            { label: 'Set up an alert', href: '/lp/buyer-listing-alerts' },
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
