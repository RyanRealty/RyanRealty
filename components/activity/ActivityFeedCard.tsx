'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ActivityFeedItem } from '@/app/actions/activity-feed-shared'
import ActivityCelebrationOverlay from '@/components/activity/ActivityCelebrationOverlay'
import CardActionBar from '@/components/ui/CardActionBar'
import { listingDetailPath } from '@/lib/slug'
import { getCanonicalSiteUrl, listingShareText } from '@/lib/share-metadata'
import { incrementListingShareCount } from '@/app/actions/engagement'
import { toggleSavedListing } from '@/app/actions/saved-listings'
import { toggleLikeListing } from '@/app/actions/likes'

function eventLabel(type: ActivityFeedItem['event_type']): string {
  switch (type) {
    case 'new_listing':
      return 'New to market'
    case 'price_drop':
      return 'Price drop'
    case 'status_pending':
      return 'Pending'
    case 'status_closed':
      return 'Sold'
    case 'status_expired':
      return 'Expired'
    case 'back_on_market':
      return 'Back on market'
    default:
      return type
  }
}

function eventBadgeVariant(
  type: ActivityFeedItem['event_type']
): 'soft-popular' | 'soft-price-drop' | 'soft-trending' | 'soft-neutral' | 'soft-hot' {
  switch (type) {
    case 'new_listing':
      return 'soft-popular'
    case 'price_drop':
      return 'soft-price-drop'
    case 'status_pending':
      return 'soft-trending'
    case 'status_closed':
      return 'soft-neutral'
    case 'status_expired':
      return 'soft-hot'
    case 'back_on_market':
      return 'soft-trending'
    default:
      return 'soft-neutral'
  }
}

function formatPrice(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return ''
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function formatAddress(item: ActivityFeedItem): string {
  const street = [item.StreetNumber, item.StreetName, item.StreetSuffix].filter(Boolean).join(' ').trim()
  const parts = [street, item.City].filter(Boolean) as string[]
  return parts.join(', ') || 'Listing'
}

export type ActivityFeedCardProps = {
  item: ActivityFeedItem
  /** When true, image loads with priority (e.g. first few in slider). */
  priority?: boolean
  className?: string
  /** When true, show save/like and allow toggles. */
  signedIn?: boolean
  saved?: boolean
  liked?: boolean
  /** Engagement counts for social proof (from engagement_metrics). */
  viewCount?: number
  likeCount?: number
  saveCount?: number
  shareCount?: number
}

export default function ActivityFeedCard({ item, priority = false, className, signedIn = false, saved = false, liked = false, viewCount = 0, likeCount = 0, saveCount = 0, shareCount = 0 }: ActivityFeedCardProps) {
  const router = useRouter()
  const imageContainerRef = useRef<HTMLDivElement>(null)
  const [savedState, setSavedState] = useState(saved)
  const [likedState, setLikedState] = useState(liked)
  // Activity feed data can include noisy location segments.
  // Use by-key canonical path for guaranteed listing detail routing.
  const listingHref = listingDetailPath(
    item.listing_key,
    undefined,
    undefined,
    { mlsNumber: item.ListNumber ?? null }
  )
  const shareUrl = `${getCanonicalSiteUrl()}${listingHref}`
  const shareTitle = item.ListPrice != null && item.ListPrice > 0 ? formatPrice(item.ListPrice) : undefined
  const shareText = listingShareText({
    price: item.ListPrice ?? null,
    beds: item.BedroomsTotal ?? null,
    baths: item.BathroomsTotal ?? null,
    address: formatAddress(item) || undefined,
    city: item.City ?? undefined,
  })
  const isPriceDrop = item.event_type === 'price_drop'
  const previousPrice = isPriceDrop && item.payload?.previous_price != null ? Number(item.payload.previous_price) : null
  const newPrice = isPriceDrop && item.payload?.new_price != null ? Number(item.payload.new_price) : item.ListPrice

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
    const result = await toggleSavedListing(item.listing_key)
    setSavedState(result.saved)
  }

  async function handleLike(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!signedIn) return goToLogin(e)
    const result = await toggleLikeListing(item.listing_key)
    setLikedState(result.liked)
  }

  return (
    <Link href={listingHref} className="block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg">
      <Card className={cn('group/card flex h-full flex-col overflow-hidden', className)}>
        <div className="relative block aspect-[4/3] w-full overflow-hidden bg-muted">
          <div ref={imageContainerRef} className="relative h-full w-full">
            {item.PhotoURL ? (
              <Image
                src={item.PhotoURL}
                alt=""
                fill
                className="object-cover transition-transform group-hover/card:scale-[1.02]"
                sizes="(max-width: 640px) 85vw, 320px"
                priority={priority}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground" aria-hidden>
                No photo
              </div>
            )}
            <ActivityCelebrationOverlay
              eventType={item.event_type}
              containerRef={imageContainerRef}
              className="rounded-none"
            />
          </div>
          <div className="absolute left-2 top-2 z-10">
            <Badge variant={eventBadgeVariant(item.event_type)} className="text-xs">
              {eventLabel(item.event_type)}
            </Badge>
          </div>
          <CardActionBar
            position="overlay"
            variant="onDark"
            onClickWrap={(e) => { e.preventDefault(); e.stopPropagation() }}
            share={{
              url: shareUrl,
              title: shareTitle,
              text: shareText,
              ariaLabel: 'Share listing',
              shareCount,
              onShare: () => incrementListingShareCount(item.listing_key),
            }}
            like={signedIn
              ? { active: likedState, count: likeCount, ariaLabel: likedState ? 'Unlike' : 'Like', onToggle: handleLike }
              : { active: false, count: likeCount, ariaLabel: 'Like', onToggle: goToLogin }}
            save={signedIn
              ? { active: savedState, count: saveCount, ariaLabel: savedState ? 'Remove from saved' : 'Save listing', onToggle: handleSave }
              : { active: false, count: saveCount, ariaLabel: 'Save listing', onToggle: goToLogin }}
            signedIn={signedIn}
            viewCount={viewCount}
            guestCounts={!signedIn ? { viewCount, likeCount, saveCount } : undefined}
          />
        </div>
        <CardContent className="flex flex-1 flex-col gap-2 p-3">
          <p className="line-clamp-2 text-sm font-medium text-foreground">{formatAddress(item)}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {item.BedroomsTotal != null && (
              <span>{item.BedroomsTotal} bed</span>
            )}
            {item.BathroomsTotal != null && (
              <span>{item.BathroomsTotal} bath</span>
            )}
            {item.City && <span> · {item.City}</span>}
          </div>
          <div className="mt-auto flex flex-nowrap items-center justify-between gap-2 pt-1">
            <span className="min-w-0 shrink text-sm font-semibold text-primary">
              {isPriceDrop && previousPrice != null ? (
                <>
                  <span className="line-through text-muted-foreground">{formatPrice(previousPrice)}</span>
                  {' → '}
                  {formatPrice(newPrice ?? undefined)}
                </>
              ) : (
                formatPrice(item.ListPrice ?? newPrice ?? undefined)
              )}
            </span>
          </div>
          <span className="inline-flex h-8 items-center rounded-md px-3 text-xs font-medium text-muted-foreground hover:text-foreground">
            View listing
          </span>
        </CardContent>
      </Card>
    </Link>
  )
}
