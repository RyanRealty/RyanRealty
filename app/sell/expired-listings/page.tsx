/**
 * /sell/expired-listings — expired-listing leaf on the /sell spine.
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
  EXPIRED_FAQ_ITEMS,
  EXPIRED_HEADLINE,
  EXPIRED_ROUTE,
  EXPIRED_SITUATION,
  FAQ_ITEMS,
  ROUTE_PATH,
  SELL_POSTER,
} from '../_v3/sell-constants'

export const revalidate = 300

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'Expired Listing Help in Central Oregon',
    description:
      'Relist an expired Central Oregon home. A written CMA from recent closed sales and current listings, then price, photos, and exposure before you go live again.',
    path: EXPIRED_ROUTE,
    ogImage: SELL_POSTER,
    keywords: [
      'expired listing Bend Oregon',
      'relist my home Central Oregon',
      'expired MLS listing help',
      'Ryan Realty expired listings',
    ],
  })
}

export default async function SellExpiredListingsPage() {
  const [heroSrc, trackRecord, reviewSummary, listings] = await Promise.all([
    getSurfaceImage('hero', {
      geoTags: ['central-oregon'],
      seed: EXPIRED_ROUTE,
      fallback: SELL_POSTER,
    }),
    getBrokerageTrackRecord(),
    getReviews(6).catch(() => null),
    getBrokerageListings().catch(() => []),
  ])

  const reviews = sellReviewState(reviewSummary)
  const listingRows = sellListingRows(listings)
  const quietItems = buildSellQuietItems({
    faq: [...EXPIRED_FAQ_ITEMS, ...FAQ_ITEMS],
    trackRecord,
    extraProse: [EXPIRED_SITUATION],
  })

  return (
    <SellLeafView
      path={EXPIRED_ROUTE}
      headline={EXPIRED_HEADLINE}
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
            { name: 'Expired listings', url: EXPIRED_ROUTE },
          ],
        },
        {
          type: 'service',
          name: 'Value my home',
          serviceType: 'Comparative market analysis',
          description:
            'A written comparative market analysis for a Central Oregon home whose last listing expired. Three closed comps, three active comps, and the list-price range those six support.',
          url: EXPIRED_ROUTE,
          areaServed: 'Bend, Oregon',
          providerOrganization: true,
        },
        { type: 'faqPage', items: [...EXPIRED_FAQ_ITEMS, ...FAQ_ITEMS] },
      ]}
    >
      <V3Breadcrumb
        tone="on-media"
        trail={[
          { label: 'Home', href: '/' },
          { label: 'Sell', href: ROUTE_PATH },
          { label: 'Expired listings' },
        ]}
      />
    </SellLeafView>
  )
}
