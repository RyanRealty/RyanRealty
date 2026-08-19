import {
  BadgePill,
  Body,
  DaysCount,
  Eyebrow,
  H1,
  Price,
  Stack,
} from '@/components/site/primitives'
import type { ListingDetail } from '@/lib/data/types/listing'
import { publishListingAsk, publishListingDrop } from '@/lib/listing/publish-listing-ask'
import { publishListingSharePricePerSqft } from '@/lib/listing/publish-listing-share'
import { cn } from '@/lib/utils'

/**
 * Listing-detail PriceBlock — top of the detail page. Renders ListPrice
 * (or ClosePrice on closed listings), status pill, DOM, original-list
 * compare when the listing has dropped, and price-per-sqft when known.
 *
 * Per CLAUDE.md §0 Data Accuracy: every figure here ships through a
 * primitive (Price, DaysCount, TabularNumber) that enforces the
 * formatting rules. Em-dash fallback when data is missing.
 *
 * Used by the listing-detail page hero block.
 *
 * Per plan §9 Layer 4.
 */

type Props = {
  listing: Pick<
    ListingDetail,
    | 'listPrice'
    | 'originalListPrice'
    | 'closePrice'
    | 'closeDate'
    | 'status'
    | 'dom'
    | 'pricePerSqft'
    | 'closePricePerSqft'
    | 'priceDropCount'
    | 'propertySubType'
  >
  className?: string
}

const STATUS_TONE: Record<string, 'navy' | 'success' | 'warning' | 'danger' | 'neutral'> = {
  Active: 'success',
  'Active Under Contract': 'warning',
  Pending: 'navy',
  Closed: 'neutral',
  Withdrawn: 'neutral',
  Expired: 'neutral',
  Canceled: 'neutral',
}

export function PriceBlock({ listing, className }: Props) {
  const isClosed = listing.status === 'Closed'
  const headlinePrice = isClosed
    ? publishListingAsk(listing.closePrice)?.ask ?? null
    : publishListingAsk(listing.listPrice)?.ask ?? null
  const ppsqft = publishListingSharePricePerSqft(
    listing.propertySubType,
    isClosed ? listing.closePricePerSqft : listing.pricePerSqft,
  )
  const publishedDrop = isClosed
    ? null
    : publishListingDrop({
        listPrice: listing.listPrice,
        originalListPrice: listing.originalListPrice,
      })
  const statusTone = STATUS_TONE[listing.status] ?? 'neutral'

  return (
    <Stack gap="tight" className={cn('max-w-[60ch]', className)}>
      <div className="flex items-center gap-2 flex-wrap">
        <BadgePill tone={statusTone}>{listing.status}</BadgePill>
        {isClosed && listing.closeDate ? (
          <Eyebrow>Closed {new Date(listing.closeDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Eyebrow>
        ) : (
          <Eyebrow>
            <DaysCount value={listing.dom} fallback="—" /> on market
          </Eyebrow>
        )}
      </div>

      <H1 className="font-bold tracking-[-0.015em]">
        <Price value={headlinePrice} exact />
      </H1>

      {publishedDrop ? (
        <Body size="small" tone="muted">
          Down <Price value={publishedDrop.drop} exact /> from original list price{' '}
          <Price value={publishedDrop.original} exact className="line-through text-foreground/70" />
          {listing.priceDropCount && listing.priceDropCount > 1 ? (
            <> after {listing.priceDropCount} price changes.</>
          ) : (
            <>.</>
          )}
        </Body>
      ) : null}

      {ppsqft ? (
        <Body size="small" tone="muted" className="tabular-nums">
          <Price value={Math.round(ppsqft)} compact /> per square foot
        </Body>
      ) : null}
    </Stack>
  )
}
