'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { formatPublishedSaleAsk } from '@/lib/listing/publish-listing-ask'
import {
  publishListingShareKind,
  publishListingSharePricePerSqft,
} from '@/lib/listing/publish-listing-share'
import { V3_ROOT_CLASS } from '@/components/site/v3/atoms'
import { SplitCardMedia, SPLIT_CARD_MEDIA_SIZES_SPLIT } from '@/components/site/v3/SplitCardMedia'
import type { V3ListingRowBadge } from '@/components/site/v3/V3ListingRow'
import { bandLabel, bandPosition, type PpsfBand } from '@/components/search/ppsf-band'
import '@/components/site/v3/V3ListingRow.css'
import './search-ledger.css'

export function SplitListingCard({
  href,
  photoUrls,
  price,
  addressLine,
  cityLine,
  beds,
  baths,
  sqft,
  pricePerSqft,
  propertyType,
  propertySubType,
  subdivisionName,
  city,
  listNumber,
  listOfficeName,
  badges,
  hasTour,
  tourLabel,
  onOpenTour,
  className,
  priority,
  ppsfBand,
}: {
  href: string
  photoUrls: string[]
  price: number | null
  addressLine: string
  cityLine: string
  beds: number | null
  baths: number | null
  sqft: number | null
  pricePerSqft?: number | null
  propertyType: string | null
  propertySubType: string | null
  subdivisionName: string | null
  city: string | null
  listNumber: string | null
  listOfficeName?: string | null
  badges: Array<{ kind: V3ListingRowBadge; label: string }>
  hasTour: boolean
  tourLabel?: string
  onOpenTour?: () => void
  className?: string
  priority?: boolean
  /**
   * The price-per-square-foot spread of the homes CURRENTLY IN VIEW, so this
   * card can say where it sits among them (SITE-44). Null when the visible set
   * is too small to describe — the mark then renders its own empty state rather
   * than disappearing, so the rail keeps one rhythm.
   */
  ppsfBand?: PpsfBand | null
}) {
  const shareKind = publishListingShareKind({
    propertySubType,
    subdivisionName,
    city,
    listNumber,
  })
  const ask = formatPublishedSaleAsk({ price, propertyType })
  const meta: string[] = []
  if (beds != null) meta.push(`${Math.round(beds).toLocaleString()} bd`)
  if (baths != null) meta.push(`${Math.round(baths).toLocaleString()} ba`)
  if (sqft != null) meta.push(`${Math.round(sqft).toLocaleString()} sqft`)
  const publishedPpsf = publishListingSharePricePerSqft({
    propertyType,
    propertySubType,
    subdivisionName,
    city,
    listNumber,
    pricePerSqft: pricePerSqft ?? null,
  })
  if (publishedPpsf != null && publishedPpsf > 0) {
    meta.push(`$${Math.round(publishedPpsf).toLocaleString()}/sqft`)
  }

  // The comparative mark. A hairline track for the visible set's full spread, a
  // navy band for its middle half, and this home's tick on it. No number is
  // printed on the mark itself — the figure is already in the meta line above,
  // and a number on every point is the dataviz skill's first anti-pattern.
  const bandMark = ppsfBand ? (
    <span
      className="srch-ppsf"
      role="img"
      aria-label={bandLabel(ppsfBand, publishedPpsf != null && publishedPpsf > 0 ? publishedPpsf : null)}
      title={bandLabel(ppsfBand, publishedPpsf != null && publishedPpsf > 0 ? publishedPpsf : null)}
    >
      <span
        className="srch-ppsf__mid"
        style={{
          left: `${bandPosition(ppsfBand, ppsfBand.q1)}%`,
          right: `${100 - bandPosition(ppsfBand, ppsfBand.q3)}%`,
        }}
      />
      {publishedPpsf != null && publishedPpsf > 0 ? (
        <span
          className="srch-ppsf__tick"
          style={{ left: `${bandPosition(ppsfBand, publishedPpsf)}%` }}
        />
      ) : (
        <span className="srch-ppsf__none">no living area reported</span>
      )}
    </span>
  ) : null

  return (
    <article className={cn(V3_ROOT_CLASS, 'v3-lrow', 'v3-lrow--split', className)}>
      <SplitCardMedia
        urls={photoUrls}
        tags={badges}
        hasTour={hasTour}
        onOpenTour={onOpenTour}
        addressLine={addressLine}
        priority={priority}
        tourLabel={tourLabel}
        sizes={SPLIT_CARD_MEDIA_SIZES_SPLIT}
        href={href}
      />
      <Link href={href} className="v3-lrow__copy">
        <span className="v3-lrow__price">{ask ?? '—'}</span>
        {shareKind ? <span className="v3-lrow__tag">{shareKind}</span> : null}
        {meta.length > 0 ? <span className="v3-lrow__meta">{meta.join(' · ')}</span> : null}
        {bandMark}
        <span className="v3-lrow__addr">{addressLine}</span>
        <span className="v3-lrow__city">{cityLine}</span>
        {listOfficeName ? <span className="v3-lrow__office">{listOfficeName}</span> : null}
      </Link>
    </article>
  )
}
