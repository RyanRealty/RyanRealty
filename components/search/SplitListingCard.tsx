'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { formatPublishedSaleAsk } from '@/lib/listing/publish-listing-ask'
import {
  publishListingShareKind,
  publishListingSharePricePerSqft,
} from '@/lib/listing/publish-listing-share'
import { V3_ROOT_CLASS } from '@/components/site/v3/atoms'
import { SplitCardMedia } from '@/components/site/v3/SplitCardMedia'
import type { V3ListingRowBadge } from '@/components/site/v3/V3ListingRow'
import '@/components/site/v3/V3ListingRow.css'

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
      />
      <Link href={href} className="v3-lrow__copy">
        <span className="v3-lrow__price">{ask ?? '—'}</span>
        {shareKind ? <span className="v3-lrow__tag">{shareKind}</span> : null}
        {meta.length > 0 ? <span className="v3-lrow__meta">{meta.join(' · ')}</span> : null}
        <span className="v3-lrow__addr">{addressLine}</span>
        <span className="v3-lrow__city">{cityLine}</span>
        {listOfficeName ? <span className="v3-lrow__office">{listOfficeName}</span> : null}
      </Link>
    </article>
  )
}
