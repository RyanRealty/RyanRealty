'use client'

import { useCallback, useEffect, useState } from 'react'
import { V3Button, V3Figure, V3Lede } from '@/components/site/v3'
import { Heart } from 'lucide-react'
import ShareButton from '@/components/ShareButton'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { isListingSaved, toggleSavedListing } from '@/app/actions/saved-listings'
import { formatPriceExact } from '@/lib/format/money'
import { redirectToLoginForSave } from '@/lib/pending-save'
import { publishLandFacts, type ListingFace } from '@/lib/listing/listing-face'

type PriceCtaStripProps = {
  listingKey: string
  mlsNumber?: string | null
  street: string
  city?: string | null
  subdivision?: string | null
  price: number | null
  beds?: number | null
  baths?: number | null
  sqft?: number | null
  status?: string | null
  daysOnMarket?: number | null
  pricePerSqft?: number | null
  shareTitle?: string
  face?: ListingFace
  lineTwo?: string | null
  acres?: number | null
  propertyType?: string | null
  propertySubType?: string | null
  taxAnnualAmount?: number | null
  hoaMonthly?: number | null
  associationFee?: number | null
  associationFeeFrequency?: string | null
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="listing-price-cta-fact">
      <dt className="listing-price-cta-fact-label">{label}</dt>
      <dd className="listing-price-cta-fact-value">{value}</dd>
    </div>
  )
}

function formatBeds(beds: number | null | undefined): string | null {
  if (beds == null) return null
  return `${beds} ${beds === 1 ? 'bed' : 'beds'}`
}

function formatBaths(baths: number | null | undefined): string | null {
  if (baths == null) return null
  return `${baths} ${baths === 1 ? 'bath' : 'baths'}`
}

function formatSqft(sqft: number | null | undefined): string | null {
  if (sqft == null) return null
  return `${sqft.toLocaleString('en-US')} sqft`
}

function formatDom(days: number | null | undefined): string | null {
  if (days == null) return null
  return `${days} DOM`
}

function formatPpsf(value: number | null | undefined): string | null {
  if (value == null) return null
  return `$${Math.round(value).toLocaleString('en-US')}/sqft`
}

export function PriceCtaStrip({
  listingKey,
  mlsNumber,
  street,
  city,
  subdivision,
  price,
  beds,
  baths,
  sqft,
  status,
  daysOnMarket,
  pricePerSqft,
  shareTitle,
  face = 'house',
  lineTwo,
  acres,
  propertyType,
  propertySubType,
  taxAnnualAmount,
  hoaMonthly,
  associationFee,
  associationFeeFrequency,
}: PriceCtaStripProps) {
  const [saved, setSaved] = useState(false)
  const [pending, setPending] = useState(false)
  const isLand = face === 'land'
  const place = isLand
    ? (lineTwo?.trim() || null)
    : [subdivision, city].filter(Boolean).join(' · ') || null
  const title = shareTitle ?? [street, city].filter(Boolean).join(', ')
  const shareUrl = mlsNumber
    ? `/homes-for-sale/listing/${encodeURIComponent(mlsNumber)}`
    : `/listing/${listingKey}`

  const facts = isLand
    ? publishLandFacts({
        acres,
        propertyType,
        propertySubType,
        daysOnMarket,
        taxAnnualAmount,
        hoaMonthly,
        associationFee,
        associationFeeFrequency,
      })
    : [
        { label: 'Beds', value: formatBeds(beds) },
        { label: 'Baths', value: formatBaths(baths) },
        { label: 'Sqft', value: formatSqft(sqft) },
        { label: 'DOM', value: formatDom(daysOnMarket) },
        { label: '$/sqft', value: formatPpsf(pricePerSqft) },
        { label: 'Status', value: status ?? null },
      ].filter((row): row is { label: string; value: string } => Boolean(row.value))

  useEffect(() => {
    let cancelled = false
    void isListingSaved(listingKey).then((value) => {
      if (!cancelled) setSaved(value)
    })
    return () => {
      cancelled = true
    }
  }, [listingKey])

  const handleSave = useCallback(async () => {
    if (pending) return
    setPending(true)
    try {
      const result = await toggleSavedListing(listingKey)
      if (result.error === 'Not signed in') {
        redirectToLoginForSave(listingKey)
        return
      }
      if (result.error) {
        toast.error(result.error)
        return
      }
      setSaved(result.saved)
      toast.success(result.saved ? 'Saved' : 'Removed from saved')
    } finally {
      setPending(false)
    }
  }, [listingKey, pending])

  return (
    <div className="listing-price-cta listing-price-cta--facts">
      {price != null ? (
        <V3Figure value={formatPriceExact(price)} label="List price" emphasis="lead" />
      ) : (
        <V3Lede>Ask for price</V3Lede>
      )}
      {place ? <p className="listing-price-cta-place">{place}</p> : null}

      {facts.length > 0 ? (
        <dl className="listing-price-cta-facts">
          {facts.map((row) => (
            <Fact key={row.label} label={row.label} value={row.value} />
          ))}
        </dl>
      ) : null}

      <div className="listing-price-cta-actions">
        <V3Button href="#listing-sheet-schedule" className="listing-sheet-schedule">
          {isLand ? 'Schedule' : 'Schedule a tour'}
        </V3Button>
        <V3Button href="#text-matt" variant="ghost">
          {isLand ? 'Ask about this lot' : 'Ask about this home'}
        </V3Button>
        <div className="listing-price-cta-icons">
          <button
            type="button"
            className="listing-icon-action"
            onClick={() => void handleSave()}
            disabled={pending}
            aria-pressed={saved}
            aria-label={
              saved
                ? isLand
                  ? 'Remove from saved lots'
                  : 'Remove from saved homes'
                : isLand
                  ? 'Save this lot'
                  : 'Save this home'
            }
          >
            <Heart className={cn('size-5', saved && 'fill-current')} />
          </button>
          <ShareButton
            url={shareUrl}
            title={title}
            variant="compact"
            className="listing-icon-action"
            aria-label="Share this listing"
          />
        </div>
      </div>
    </div>
  )
}
