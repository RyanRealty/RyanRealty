/**
 * Shared Sell shop after Stage: 3% plan, firm proof, our listings, questions.
 */
import { formatDate } from '@/lib/format/date'
import {
  v3Text,
  V3Ledger,
  V3Proof,
  V3Quiet,
  V3Sheet,
  type V3LedgerFigureRow,
  type V3ProofQuote,
  type V3QuietItem,
} from '@/components/site/v3'
import { PLAN_STEPS } from './sell-constants'
import { OUR_LISTINGS_TRACE } from './sell-listings'

type Props = {
  reviewQuotes: readonly V3ProofQuote[]
  reviewCount: number
  reviewAverage: number
  newestReview: string | null
  listingRows: readonly V3LedgerFigureRow[]
  quietItems: V3QuietItem[]
}

export function SellShop({
  reviewQuotes,
  reviewCount,
  reviewAverage,
  newestReview,
  listingRows,
  quietItems,
}: Props) {
  const [firstListing, ...restListings] = listingRows

  return (
    <>
      <V3Sheet
        id="listing-plan"
        className="sell-plan"
        heading="The 3% listing plan"
        eyebrow="One plan. Enhanced inclusions. No add-on fees."
        steps={PLAN_STEPS}
        showEcho={false}
        showProgress={false}
      />

      {reviewQuotes.length > 0 ? (
        <V3Proof
          id="reviews"
          eyebrow="Ryan Realty · Google"
          headline={`${reviewCount} Google reviews`}
          headingLevel={2}
          claim={`${reviewAverage.toFixed(1)} of 5 across ${reviewCount} reviews. The newest four, in full, as written.`}
          figures={[
            { value: String(reviewCount), label: 'Google reviews' },
            { value: reviewAverage.toFixed(1), label: 'average of 5' },
            ...(newestReview
              ? [
                  {
                    value: formatDate(newestReview, {
                      month: 'short',
                      day: undefined,
                      year: 'numeric',
                    }),
                    label: 'newest',
                  },
                ]
              : []),
          ]}
          quotes={[...reviewQuotes]}
          source={{ label: 'Every review', href: '/reviews' }}
          record={false}
        />
      ) : null}

      {firstListing ? (
        <V3Ledger
          id="our-listings"
          eyebrow={v3Text('Ryan Realty')}
          heading={v3Text('Our listings')}
          rows={[firstListing, ...restListings]}
          source={v3Text(OUR_LISTINGS_TRACE)}
          action={{ label: v3Text('All office listings'), href: '/our-homes' }}
        />
      ) : (
        <V3Ledger
          id="our-listings"
          eyebrow={v3Text('Ryan Realty')}
          heading={v3Text('Our listings')}
          rows={[]}
          emptyMessage={v3Text(
            'No Ryan Realty office listing is on the market in this refresh.',
          )}
          action={{ label: v3Text('Homes for sale'), href: '/homes-for-sale' }}
        />
      )}

      <V3Quiet id="selling-questions" heading="Selling questions" items={quietItems} />
    </>
  )
}
