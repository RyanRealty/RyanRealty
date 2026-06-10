/**
 * ListingLedger -- Experience System shared module
 *
 * Editorial listing layout for Geo archetype pages. Replaces the uniform
 * card grid with:
 *   1. ONE dominant featured listing -- large edge-bleed photo (left on
 *      desktop, full-width on mobile), price large in Amboqia, address/
 *      beds/baths/sqft as quiet meta. Hover: subtle scale.
 *   2. Remaining listings as full-width LEDGER ROWS -- hairline top rules,
 *      small thumbnail bleeding to section edge, address in Geist, price in
 *      Amboqia tabular, beds/baths/sqft as quiet meta. Hover: row lifts
 *      subtly + thumb scales 1.04.
 *
 * Map <-> ledger linking:
 *   Pass `hoveredKey` / `onRowHover` to sync hovered state with the map.
 *   The hoveredKey on a ledger row highlights its price pill on the map and
 *   vice-versa (reuses SearchMapClustered/NeighborhoodMap's onMarkerHover API).
 *
 * Engagement telemetry: `ledger_hover` event fired via useEngagementTracking.
 *
 * Props:
 *   listings      -- array of ListingCardData (reuses the existing shape)
 *   featuredFirst -- if true (default), first listing is the dominant feature
 *   viewAllHref   -- optional "view all N homes" link
 *   viewAllLabel  -- optional link label
 *   hoveredKey    -- external hover state (map -> ledger sync)
 *   onRowHover    -- callback when a row is hovered (ledger -> map sync)
 *   sectionId     -- passed to useEngagementTracking
 */
// brand-voice:exempt -- pure UI component, no user-facing prose
'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRef, useCallback, useState } from 'react'
import { cn } from '@/lib/utils'
import { DisplayHeading } from '@/components/site/primitives'
import { useEngagementTracking } from './useEngagementTracking'
import type { ListingCardData } from '@/components/site/ListingCard'

function fmtPrice(price: number | null): string {
  if (price == null) return '—'
  const rounded = Math.round(price / 1000) * 1000
  return `$${rounded.toLocaleString()}`
}

function fmtNum(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString()
}

// ---- Featured (dominant) listing --------------------------------------------

type FeaturedProps = {
  listing: ListingCardData
  hoveredKey: string | null
  onRowHover: (key: string | null) => void
  trackInteract: (action: string) => void
}

function FeaturedListing({ listing, hoveredKey, onRowHover, trackInteract }: FeaturedProps) {
  const isHovered = hoveredKey === listing.listingKey

  return (
    <Link
      href={listing.href}
      className={cn(
        'group block relative overflow-hidden rounded-xl',
        'transition-transform duration-300 ease-out',
        isHovered ? 'scale-[1.01]' : '',
      )}
      onMouseEnter={() => {
        onRowHover(listing.listingKey)
        trackInteract('ledger_hover')
      }}
      onMouseLeave={() => onRowHover(null)}
    >
      {/* Photo */}
      <div className="relative h-[380px] md:h-[480px] w-full overflow-hidden bg-muted">
        {listing.photoUrl ? (
          <Image
            src={listing.photoUrl}
            alt={listing.addressLine}
            fill
            sizes="(max-width: 768px) 100vw, 56vw"
            className={cn(
              'object-cover transition-transform duration-500 ease-out',
              'group-hover:scale-[1.03]',
            )}
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-muted" aria-hidden />
        )}
        {/* Gradient scrim for text readability */}
        <div
          className="absolute inset-0"
          aria-hidden
          style={{
            background: 'linear-gradient(to top, rgba(16,39,66,0.82) 0%, rgba(16,39,66,0.38) 38%, transparent 65%)',
          }}
        />
        {/* Price + meta overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-5 md:p-7">
          {listing.badge ? (
            <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.1em] text-white/80 bg-primary/60 rounded-full px-2.5 py-0.5 mb-2 border border-white/18">
              {listing.badge.label}
            </span>
          ) : null}
          <DisplayHeading
            as="div"
            className="tabular-nums text-white leading-none"
            style={{ fontSize: 'clamp(2rem, 4.5vw, 3.25rem)', letterSpacing: '-0.01em' }}
          >
            {fmtPrice(listing.price)}
          </DisplayHeading>
          <p className="mt-1.5 text-sm font-medium text-white/80">{listing.addressLine}</p>
          <div className="mt-1 flex items-center gap-3 text-xs tabular-nums text-white/62">
            {listing.beds != null ? <span>{fmtNum(listing.beds)} bd</span> : null}
            {listing.baths != null ? <span>{fmtNum(listing.baths)} ba</span> : null}
            {listing.sqft != null ? <span>{fmtNum(listing.sqft)} sqft</span> : null}
          </div>
        </div>
      </div>
    </Link>
  )
}

// ---- Ledger row -------------------------------------------------------------

type RowProps = {
  listing: ListingCardData
  isHovered: boolean
  onRowHover: (key: string | null) => void
  trackInteract: (action: string) => void
}

function LedgerRow({ listing, isHovered, onRowHover, trackInteract }: RowProps) {
  return (
    <Link
      href={listing.href}
      className={cn(
        'group flex items-center gap-4 py-4 border-t border-border',
        'transition-all duration-200 ease-out',
        '-mx-4 px-4 sm:-mx-6 sm:px-6',
        isHovered
          ? 'bg-secondary/70 shadow-sm -translate-y-px'
          : 'hover:bg-secondary/50 hover:-translate-y-px hover:shadow-sm',
      )}
      onMouseEnter={() => {
        onRowHover(listing.listingKey)
        trackInteract('ledger_hover')
      }}
      onMouseLeave={() => onRowHover(null)}
    >
      {/* Thumbnail */}
      <div className="relative w-[72px] h-[52px] flex-shrink-0 rounded-md overflow-hidden bg-muted">
        {listing.photoUrl ? (
          <Image
            src={listing.photoUrl}
            alt=""
            fill
            sizes="80px"
            className={cn(
              'object-cover transition-transform duration-300 ease-out',
              isHovered ? 'scale-[1.04]' : 'group-hover:scale-[1.04]',
            )}
            aria-hidden
          />
        ) : (
          <div className="absolute inset-0 bg-muted" aria-hidden />
        )}
      </div>

      {/* Address block */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">{listing.addressLine}</p>
        <p className="text-xs text-muted-foreground truncate">{listing.cityLine}</p>
        <div className="mt-0.5 flex items-center gap-2.5 text-xs tabular-nums text-muted-foreground">
          {listing.beds != null ? <span>{fmtNum(listing.beds)} bd</span> : null}
          {listing.baths != null ? <span>{fmtNum(listing.baths)} ba</span> : null}
          {listing.sqft != null ? <span>{fmtNum(listing.sqft)} sqft</span> : null}
        </div>
      </div>

      {/* Price -- Amboqia tabular */}
      <div className="flex-shrink-0 text-right">
        <DisplayHeading
          as="div"
          className="tabular-nums text-foreground leading-none"
          style={{ fontSize: 'clamp(1.1rem, 2vw, 1.4rem)', letterSpacing: '-0.01em' }}
        >
          {fmtPrice(listing.price)}
        </DisplayHeading>
        {listing.badge ? (
          <span className="text-[10px] font-medium text-muted-foreground mt-0.5 block">
            {listing.badge.label}
          </span>
        ) : null}
      </div>

      {/* Arrow */}
      <span aria-hidden className="hidden sm:block text-muted-foreground/40 group-hover:text-muted-foreground transition-colors flex-shrink-0">
        &rarr;
      </span>
    </Link>
  )
}

// ---- ListingLedger ----------------------------------------------------------

type Props = {
  listings: ReadonlyArray<ListingCardData>
  /** If true (default), first listing renders as the dominant feature above the ledger. */
  featuredFirst?: boolean
  viewAllHref?: string
  viewAllLabel?: string
  /** External hover state (map -> ledger). The listing key currently highlighted from the map. */
  hoveredKey?: string | null
  /** Callback when a ledger row is hovered (ledger -> map). */
  onRowHover?: (key: string | null) => void
  sectionId?: string
  className?: string
}

export function ListingLedger({
  listings,
  featuredFirst = true,
  viewAllHref,
  viewAllLabel,
  hoveredKey: externalHoveredKey,
  onRowHover: externalOnRowHover,
  sectionId = 'listing-ledger',
  className,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const { trackInteract } = useEngagementTracking(sectionId, { ref, pageType: 'geo', position: 3 })

  const [internalHoveredKey, setInternalHoveredKey] = useState<string | null>(null)

  const hoveredKey = externalHoveredKey !== undefined ? externalHoveredKey : internalHoveredKey
  const onRowHover = useCallback(
    (key: string | null) => {
      if (externalOnRowHover) externalOnRowHover(key)
      setInternalHoveredKey(key)
    },
    [externalOnRowHover],
  )

  if (listings.length === 0) return null

  const featured = featuredFirst ? listings[0] : null
  const ledgerRows = featuredFirst ? listings.slice(1) : listings

  return (
    <div ref={ref} className={cn('', className)}>
      {/* Dominant featured listing */}
      {featured ? (
        <div className="mb-6">
          <FeaturedListing
            listing={featured}
            hoveredKey={hoveredKey}
            onRowHover={onRowHover}
            trackInteract={trackInteract}
          />
        </div>
      ) : null}

      {/* Ledger rows */}
      {ledgerRows.length > 0 ? (
        <div>
          {ledgerRows.map((listing) => (
            <LedgerRow
              key={listing.listingKey}
              listing={listing}
              isHovered={hoveredKey === listing.listingKey}
              onRowHover={onRowHover}
              trackInteract={trackInteract}
            />
          ))}
        </div>
      ) : null}

      {/* View all link */}
      {viewAllHref ? (
        <div className="mt-5 flex justify-end">
          <Link
            href={viewAllHref}
            className="text-sm font-semibold text-primary hover:underline underline-offset-2"
          >
            {viewAllLabel ?? 'View all listings'}
          </Link>
        </div>
      ) : null}
    </div>
  )
}
