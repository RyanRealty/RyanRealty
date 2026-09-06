/**
 * /sell/for-sale-by-owner — FSBO leaf on the /sell spine.
 * Capture is SellValueForm → submitSellerLPForm.
 */
import type { Metadata } from 'next'
import {
  getBrokerageListings,
  getBrokerageTrackRecord,
  getReviews,
  getSurfaceImage,
} from '@/lib/data'
import { pageMetadata } from '@/lib/site/page-metadata'
import { V3Breadcrumb } from '@/components/site/v3'
import { SellLeafView } from '../_v3/SellLeafView'
import { buildSellQuietItems } from '../_v3/sell-quiet'
import { sellListingRows } from '../_v3/sell-listings'
import { sellReviewState } from '../_v3/sell-reviews'
import {
  FAQ_ITEMS,
  FSBO_FAQ_ITEMS,
  FSBO_HEADLINE,
  FSBO_ROUTE,
  FSBO_SITUATION,
  ROUTE_PATH,
  SELL_POSTER,
} from '../_v3/sell-constants'

export const revalidate = 300

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'FSBO Help in Central Oregon',
    description:
      'Considering for sale by owner in Central Oregon. A written CMA from recent closed sales and current listings, with no listing agreement.',
    path: FSBO_ROUTE,
    ogImage: SELL_POSTER,
    keywords: [
      'FSBO Central Oregon',
      'for sale by owner Bend',
      'sell my home myself Bend Oregon',
      'Ryan Realty FSBO',
    ],
  })
}

export default async function SellFsboPage() {
  const [heroSrc, trackRecord, reviewSummary, listings] = await Promise.all([
    getSurfaceImage('hero', {
      geoTags: ['central-oregon'],
      seed: FSBO_ROUTE,
      fallback: SELL_POSTER,
    }),
    getBrokerageTrackRecord(),
    getReviews(6).catch(() => null),
    getBrokerageListings().catch(() => []),
  ])

  const reviews = sellReviewState(reviewSummary)
  const listingRows = sellListingRows(listings)
  const quietItems = buildSellQuietItems({
    faq: [...FSBO_FAQ_ITEMS, ...FAQ_ITEMS],
    trackRecord,
    extraProse: [FSBO_SITUATION],
  })

  return (
    <SellLeafView
      path={FSBO_ROUTE}
      headline={FSBO_HEADLINE}
      posterSrc={heroSrc ?? SELL_POSTER}
      listingRows={listingRows}
      quietItems={quietItems}
      {...reviews}
      schemas={[
        {
          type: 'breadcrumb',
          items: [
            { name: 'Home', url: '/' },
            { name: 'Sell', url: ROUTE_PATH },
            { name: 'For sale by owner', url: FSBO_ROUTE },
          ],
        },
        {
          type: 'service',
          name: 'Value my home',
          serviceType: 'Comparative market analysis',
          description:
            'A written comparative market analysis for a Central Oregon home listed for sale by owner. Three closed comps, three active comps, and the list-price range those six support.',
          url: FSBO_ROUTE,
          areaServed: 'Bend, Oregon',
          providerOrganization: true,
        },
        { type: 'faqPage', items: [...FSBO_FAQ_ITEMS, ...FAQ_ITEMS] },
      ]}
    >
      <V3Breadcrumb
        tone="on-media"
        trail={[
          { label: 'Home', href: '/' },
          { label: 'Sell', href: ROUTE_PATH },
          { label: 'For sale by owner' },
        ]}
      />
    </SellLeafView>
  )
}
