'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { ListingTileRow } from '@/app/actions/listings'
import { toggleSavedListing } from '@/app/actions/saved-listings'
import { toggleLikeListing } from '@/app/actions/likes'
import { getCanonicalSiteUrl, listingShareText } from '@/lib/share-metadata'
import ShareButton from '@/components/ShareButton'
import { HeartIcon as ActionHeartIcon, BookmarkIcon as ActionBookmarkIcon } from '@/components/icons/ActionIcons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Camera01Icon } from '@hugeicons/core-free-icons'
import { Button } from "@/components/ui/button"

type Props = {
  listing: ListingTileRow
  listingKey: string
  signedIn?: boolean
  saved?: boolean
  liked?: boolean
  userEmail?: string | null
}

function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return ''
  return `$${Number(n).toLocaleString()}`
}

function addressOneLine(listing: ListingTileRow): string {
  const parts = [listing.StreetNumber, listing.StreetName].filter(Boolean).join(' ')
  return parts || listing.City || ''
}

/**
 * Compact listing card for the bar under hero on community/neighborhood pages.
 * Matches listing detail strip: small thumb + price + address. Share/like/save shown; guest click → login.
 */
export default function ListingBarCard({ listing, listingKey, signedIn = false, saved = false, liked = false }: Props) {
  const router = useRouter()
  const [savedState, setSavedState] = useState(saved)
  const [likedState, setLikedState] = useState(liked)
  const href = `/listing/${encodeURIComponent(listingKey)}`
  const shareUrl = `${getCanonicalSiteUrl()}${href}`
  const shareTitle = listing.ListPrice != null && listing.ListPrice > 0 ? `$${Number(listing.ListPrice).toLocaleString()}` : undefined
  const shareText = listingShareText({
    price: listing.ListPrice ?? null,
    beds: listing.BedroomsTotal ?? null,
    baths: listing.BathroomsTotal ?? null,
    sqft: (listing as { TotalLivingAreaSqFt?: number | null }).TotalLivingAreaSqFt ?? null,
    address: addressOneLine(listing) || undefined,
    city: listing.City ?? undefined,
  })

  function goToLogin(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const returnUrl = typeof window !== 'undefined' ? encodeURIComponent(window.location.pathname + window.location.search) : ''
    router.push(`/login${returnUrl ? `?returnUrl=${returnUrl}` : ''}`)
  }

  async function handleSave(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!signedIn) return goToLogin(e)
    const result = await toggleSavedListing(listingKey)
    setSavedState(result.saved)
  }

  async function handleLike(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!signedIn) return goToLogin(e)
    const result = await toggleLikeListing(listingKey)
    setLikedState(result.liked)
  }

  const btn = 'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 border-border bg-muted text-muted-foreground transition hover:bg-border hover:text-foreground'
  const btnLike = likedState ? 'border-destructive/60 text-destructive' : ''
  const btnSave = savedState ? 'border-primary/60 text-primary' : ''

  return (
    <div className="relative flex shrink-0 scroll-snap-align-center min-w-[140px] max-w-[160px] flex-col overflow-hidden rounded-xl bg-card text-card-foreground ring-1 ring-foreground/10 transition hover:shadow-lg hover:-translate-y-1">
      <Link href={href} className="flex gap-2 p-0">
        <div className="relative h-10 w-14 shrink-0 overflow-hidden bg-muted">
          {listing.PhotoURL ? (
            <img
              src={listing.PhotoURL}
              alt={`${addressOneLine(listing) || 'Property'} photo`}
              className="h-full w-full object-cover"
              width={56}
              height={40}
              decoding="async"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              <HugeiconsIcon icon={Camera01Icon} className="h-5 w-5" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 py-1 pr-1.5">
          {listing.ListPrice != null && listing.ListPrice > 0 && (
            <p className="text-xs font-semibold text-foreground truncate">{formatPrice(listing.ListPrice)}</p>
          )}
          <p className="text-xs text-muted-foreground truncate">{addressOneLine(listing) || listing.City || '—'}</p>
        </div>
      </Link>
      <div className="flex items-center justify-end gap-0.5 border-t border-border px-1 py-1" onClick={(e) => e.stopPropagation()}>
        <ShareButton url={shareUrl} title={shareTitle} text={shareText} variant="compact" iconClassName="h-3 w-3" className={`${btn} text-foreground`} aria-label="Share" />
        <Button type="button" onClick={handleLike} className={`${btn} ${btnLike}`} aria-label={signedIn ? (likedState ? 'Unlike' : 'Like') : 'Like'}>
          <ActionHeartIcon filled={likedState} className="h-3 w-3" />
        </Button>
        <Button type="button" onClick={handleSave} className={`${btn} ${btnSave}`} aria-label={signedIn ? (savedState ? 'Remove from saved' : 'Save listing') : 'Save listing'}>
          <ActionBookmarkIcon filled={savedState} className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}
