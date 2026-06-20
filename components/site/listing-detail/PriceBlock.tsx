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
  >
  className?: string
}

const STATUS_TONE: Record<string, 'navy' | 'success' | 'warning' | 'danger' | 'neutral'> = {
  Active: 'success',
  'Coming Soon': 'warning',
  'Active Under Contract': 'warning',
  Pending: 'navy',
  Closed: 'neutral',
  Withdrawn: 'neutral',
  Expired: 'neutral',
  Canceled: 'neutral',
}

function priceDropDelta(
  listPrice: number | null,
  originalListPrice: number | null,
): number | null {
  if (listPrice == null || originalListPrice == null) return null
  if (originalListPrice <= listPrice) return null
  return originalListPrice - listPrice
}

export function PriceBlock({ listing, className }: Props) {
  const isClosed = listing.status === 'Closed'
  const headlinePrice = isClosed ? listing.closePrice : listing.listPrice
  const ppsqft = isClosed ? listing.closePricePerSqft : listing.pricePerSqft
  const drop = priceDropDelta(listing.listPrice, listing.originalListPrice)
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
        <Price value={headlinePrice} />
      </H1>

      {drop ? (
        <Body size="small" tone="muted">
          Down <Price value={drop} /> from original list price{' '}
          <Price value={listing.originalListPrice} className="line-through text-foreground/70" />
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
