'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { ListingTileRow } from '@/app/actions/listings'
import { toggleSavedListing } from '@/app/actions/saved-listings'
import { toggleLikeListing } from '@/app/actions/likes'
import { getCanonicalSiteUrl, listingShareText } from '@/lib/share-metadata'
import { incrementListingShareCount } from '@/app/actions/engagement'
import CardActionBar from '@/components/ui/CardActionBar'
import { listingDetailPath } from '@/lib/slug'
import { HugeiconsIcon } from '@hugeicons/react'
import { Camera01Icon } from '@hugeicons/core-free-icons'

type Props = {
  listing: ListingTileRow
  listingKey: string
  signedIn?: boolean
  saved?: boolean
  liked?: boolean
  userEmail?: string | null
  viewCount?: number
  likeCount?: number
  saveCount?: number
  shareCount?: number
}

function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return ''
  return `$${Number(n).toLocaleString()}`
}

function addressOneLine(listing: ListingTileRow): string {
  const parts = [listing.StreetNumber, listing.StreetName, listing.StreetSuffix].filter(Boolean).join(' ')
  return parts || listing.City || ''
}

function getNeighborhoodName(listing: ListingTileRow): string | null {
  const maybe = listing as ListingTileRow & {
    NeighborhoodName?: string | null
    neighborhood_name?: string | null
    Neighborhood?: string | null
    neighborhood?: string | null
  }
  const value =
    maybe.NeighborhoodName ??
    maybe.neighborhood_name ??
    maybe.Neighborhood ??
    maybe.neighborhood ??
    null
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed || null
}

/**
 * Compact listing card for the bar under hero on community/neighborhood pages.
 * Matches listing detail strip: small thumb + price + address. Share/like/save shown; guest click → login.
 */
export default function ListingBarCard({
  listing,
  listingKey,
  signedIn = false,
  saved = false,
  liked = false,
  viewCount = 0,
  likeCount = 0,
  saveCount = 0,
  shareCount = 0,
}: Props) {
  const router = useRouter()
  const [savedState, setSavedState] = useState(saved)
  const [likedState, setLikedState] = useState(liked)
  const neighborhood = getNeighborhoodName(listing)
  const href = listingDetailPath(
    listingKey,
    { streetNumber: listing.StreetNumber, streetName: listing.StreetName, city: listing.City, state: listing.State, postalCode: listing.PostalCode },
    { city: listing.City, neighborhood, subdivision: listing.SubdivisionName }
  )
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

  return (
    <div className="relative flex shrink-0 scroll-snap-align-center min-w-[140px] max-w-[160px] flex-col overflow-hidden rounded-xl bg-card text-card-foreground ring-1 ring-foreground/10 transition hover:shadow-lg hover:-translate-y-1">
      <Link href={href} className="block">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-xl bg-muted">
          {listing.PhotoURL ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={listing.PhotoURL}
                alt={`${addressOneLine(listing) || 'Property'} photo`}
                className="h-full w-full object-cover object-top"
                width={160}
                height={120}
                decoding="async"
              />
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              <HugeiconsIcon icon={Camera01Icon} className="h-5 w-5" />
            </div>
          )}
          <CardActionBar
            position="overlay"
            variant="onDark"
            onClickWrap={(e) => { e.preventDefault(); e.stopPropagation() }}
            viewCount={viewCount}
            share={{
              url: shareUrl,
              title: shareTitle,
              text: shareText,
              ariaLabel: 'Share',
              shareCount,
              onShare: () => incrementListingShareCount(listingKey),
            }}
            like={signedIn
              ? { active: likedState, count: likeCount, ariaLabel: likedState ? 'Unlike' : 'Like', onToggle: handleLike }
              : { active: false, count: likeCount, ariaLabel: 'Like', onToggle: goToLogin }}
            save={signedIn
              ? { active: savedState, count: saveCount, ariaLabel: savedState ? 'Remove from saved' : 'Save listing', onToggle: handleSave }
              : { active: false, count: saveCount, ariaLabel: 'Save listing', onToggle: goToLogin }}
            signedIn={signedIn}
            guestCounts={!signedIn ? { viewCount, likeCount, saveCount } : undefined}
          />
        </div>
        <div className="min-w-0 px-2 py-2">
          {listing.ListPrice != null && listing.ListPrice > 0 && (
            <p className="text-xs font-semibold text-foreground truncate">{formatPrice(listing.ListPrice)}</p>
          )}
          <p className="text-xs text-muted-foreground truncate">{addressOneLine(listing) || listing.City || '—'}</p>
        </div>
      </Link>
    </div>
  )
}
