'use client'

import {
  MiddleDot,
  Price,
  TabularNumber,
} from '@/components/site/primitives'
import { cn } from '@/lib/utils'
import { displaySubdivision } from '@/lib/slug'
import type { ListingDetail } from '@/lib/data/types/listing'
import { publishListingDrop, publishListingHistoryPrices } from '@/lib/listing/publish-listing-ask'
import { publishListingShareKind, publishListingSharePricePerSqft } from '@/lib/listing/publish-listing-share'
import { publishWholePropertyAmount } from '@/lib/listing/publish-listing-figure'
import { publishStreetLine } from '@/lib/listing/publish-street-line'

/**
 * Status, address, and share under the Stage. The list price lives on the
 * Stage media once. Tour, ask, and save live in the one Sheet at #listing-act.
 */

type Props = {
  listing: Pick<
    ListingDetail,
    | 'listingKey'
    | 'listNumber'
    | 'listPrice'
    | 'closePrice'
    | 'closeDate'
    | 'status'
    | 'dom'
    | 'pricePerSqft'
    | 'propertySubType'
    | 'propertyType'
    | 'streetNumber'
    | 'streetName'
    | 'streetSuffix'
    | 'city'
    | 'postalCode'
    | 'subdivisionName'
    | 'originalListPrice'
    | 'priceDropCount'
  >
  /** Share handler — caller wires to Web Share API or fallback toast. */
  onShare?: (listingKey: string) => void
  /** Prices already on the listing-history rail. Drop withholds without them. */
  historyPrices?: ReadonlyArray<number | null | undefined>
  /** History rows from the listing rail. Mapped to prices when historyPrices is omitted. */
  history?: ReadonlyArray<{ price?: number | null } | null | undefined> | null
  className?: string
}

const PILL_TONE: Record<string, { filled: boolean }> = {
  Active: { filled: true },
  'Active Under Contract': { filled: false },
  Pending: { filled: true },
  Closed: { filled: false },
  Withdrawn: { filled: false },
  Expired: { filled: false },
  Canceled: { filled: false },
}

export function PriceCtaStrip({
  listing,
  onShare,
  historyPrices,
  history,
  className,
}: Props) {
  const railPrices =
    historyPrices ?? (history !== undefined ? publishListingHistoryPrices(history) : undefined)

  const isClosed = listing.status === 'Closed'
  const shareSubject = {
    propertySubType: listing.propertySubType,
    subdivisionName: listing.subdivisionName,
    city: listing.city,
    listNumber: listing.listNumber,
  }
  const shareKind = publishListingShareKind(shareSubject)
  const alertBandIsPublished =
    publishWholePropertyAmount({
      ...shareSubject,
      price: isClosed ? listing.closePrice : listing.listPrice,
      propertyType: listing.propertyType,
    }) != null
  const publishedPpsf = publishListingSharePricePerSqft({
    ...shareSubject,
    propertyType: listing.propertyType,
    pricePerSqft: listing.pricePerSqft,
  })
  const publishedDrop = isClosed
    ? null
    : publishListingDrop({
        listPrice: listing.listPrice,
        originalListPrice: listing.originalListPrice,
        historyPrices: railPrices,
      })
  const street = publishStreetLine({ streetNumber: listing.streetNumber, streetName: listing.streetName, streetSuffix: listing.streetSuffix }) ?? ''
  const cityLine = [listing.city ? `${listing.city}, OR` : null, listing.postalCode]
    .filter(Boolean)
    .join(' ')
  const cleanSubdivision = displaySubdivision(listing.subdivisionName)
  const cityWithCommunity = cleanSubdivision
    ? [cityLine, cleanSubdivision].filter(Boolean).join(' · ')
    : cityLine

  const propertyName = street || 'this home'

  function handleShare() {
    if (onShare) {
      onShare(listing.listingKey)
      return
    }
    const url = typeof window !== 'undefined' ? window.location.href : ''
    const title = street || `Listing ${listing.listingKey}`
    const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { share?: Navigator['share'] }) : null
    if (nav?.share) {
      nav.share({ title, url }).catch(() => {
        if (nav.clipboard) {
          nav.clipboard.writeText(url).catch(() => {})
        }
      })
      return
    }
    if (nav?.clipboard) {
      nav.clipboard.writeText(url).catch(() => {})
    }
  }

  return (
    <div
      className={cn(className)}
      style={{
        borderBottom: '3px solid var(--navy)',
        paddingBottom: '1.5rem',
        paddingTop: '1.25rem',
      }}
    >
      {street ? (
        <div className="text-lg font-medium sm:text-xl" style={{ color: 'var(--navy)' }}>
          {street}
        </div>
      ) : null}
      {cityWithCommunity ? (
        <div className="mt-0.5 text-sm" style={{ color: 'color-mix(in srgb, var(--v3-navy) 72%, transparent)' }}>
          {cityWithCommunity}
        </div>
      ) : null}

      {publishedDrop ? (
        <div className="mt-2 text-sm" style={{ color: 'color-mix(in srgb, var(--v3-navy) 72%, transparent)' }}>
          Down <Price value={publishedDrop.drop} exact /> from original list price{' '}
          <span style={{ color: 'color-mix(in srgb, var(--v3-navy) 72%, transparent)' }}>
            <Price value={publishedDrop.original} exact className="line-through" />
          </span>
          {listing.priceDropCount && listing.priceDropCount > 1 ? (
            <> after {listing.priceDropCount} price changes.</>
          ) : (
            <>.</>
          )}
        </div>
      ) : null}

      <div className="mt-3.5 flex flex-wrap gap-2">
        <Pill kind={listing.status}>
          <span aria-hidden>●</span>{' '}
          {isClosed && listing.closeDate
            ? `Closed ${new Date(listing.closeDate).toLocaleDateString('en-US', {
                month: 'short',
                year: 'numeric',
                timeZone: 'America/Los_Angeles',
              })}`
            : listing.status}
        </Pill>
        {listing.dom != null ? (
          <Pill kind="dom">
            <TabularNumber value={listing.dom} /> days on market
          </Pill>
        ) : null}
        {shareKind ? <Pill kind="dom">{shareKind}</Pill> : null}
        {publishedPpsf != null ? (
          <Pill kind="psqft">
            <Price value={publishedPpsf} exact />/sqft
          </Pill>
        ) : null}
      </div>

      <div className="mt-5">
        <button
          type="button"
          className="btn"
          style={OUTLINE_BTN_STYLE}
          onClick={handleShare}
          aria-label={`Share ${propertyName}`}
        >
          Share
        </button>
      </div>

      <a
        href="#listing-like-alerts"
        className="btn mt-3 w-full text-center sm:w-auto"
        style={OUTLINE_BTN_STYLE}
        aria-label="Get free email alerts for homes like this"
      >
        Get free alerts for homes like this <span className="arr">→</span>
      </a>
      <p className="mt-2 text-xs" style={{ color: 'color-mix(in srgb, var(--v3-navy) 72%, transparent)' }}>
        {alertBandIsPublished
          ? 'Free email when a new home lists in this city near this price. Unsubscribe any time.'
          : 'Free email when a new home lists in this city. Unsubscribe any time.'}
      </p>
    </div>
  )
}

const OUTLINE_BTN_STYLE: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--navy)',
  borderColor: 'var(--navy)',
  minHeight: 44,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
}

function Pill({
  kind,
  children,
}: {
  kind: keyof typeof PILL_TONE | 'dom' | 'psqft'
  children: React.ReactNode
}) {
  const filled = kind === 'dom' || kind === 'psqft' ? false : (PILL_TONE[kind]?.filled ?? false)
  const navy = 'var(--navy)'
  const cream = 'var(--cream)'
  return (
    <span
      className="mono-lab"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        border: `2px solid ${navy}`,
        background: filled ? navy : 'transparent',
        color: filled ? cream : navy,
        padding: '5px 11px',
        fontSize: '0.62rem',
        letterSpacing: '0.14em',
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1.1,
      }}
    >
      {children}
    </span>
  )
}

void MiddleDot
