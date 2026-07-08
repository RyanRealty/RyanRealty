'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import type { ActivityFeedItem } from '@/app/actions/activity-feed-shared'
import { Badge } from '@/components/ui/badge'
import ActivityCelebrationOverlay from '@/components/activity/ActivityCelebrationOverlay'
import CardActionBar from '@/components/ui/CardActionBar'
import { listingDetailPath } from '@/lib/slug'
import { getCanonicalSiteUrl, listingShareText } from '@/lib/share-metadata'
import { incrementListingShareCount } from '@/app/actions/engagement'
import { toggleSavedListing } from '@/app/actions/saved-listings'
import { toggleLikeListing } from '@/app/actions/likes'

type Props = {
  item: ActivityFeedItem
  signedIn?: boolean
  saved?: boolean
  liked?: boolean
  viewCount?: number
  likeCount?: number
  saveCount?: number
  shareCount?: number
}

function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function eventLabel(type: ActivityFeedItem['event_type']): string {
  switch (type) {
    case 'new_listing':
      return 'New listing'
    case 'price_drop':
      return 'Price reduced'
    case 'status_pending':
      return 'Went pending'
    case 'status_closed':
      return 'Closed'
    default:
      return 'Activity'
  }
}

function eventBadgeVariant(
  type: ActivityFeedItem['event_type']
): 'soft-popular' | 'soft-price-drop' | 'soft-trending' | 'soft-neutral' {
  switch (type) {
    case 'new_listing':
      return 'soft-popular'
    case 'price_drop':
      return 'soft-price-drop'
    case 'status_pending':
      return 'soft-trending'
    case 'status_closed':
      return 'soft-neutral'
    default:
      return 'soft-neutral'
  }
}

/** Single activity feed card for Latest activity slider. Same general size as listing/community tiles; badged by event type. */
export default function ActivityFeedCard({
  item,
  signedIn = false,
  saved = false,
  liked = false,
  viewCount = 0,
  likeCount = 0,
  saveCount = 0,
  shareCount = 0,
}: Props) {
  const router = useRouter()
  const imageContainerRef = useRef<HTMLDivElement>(null)
  const [savedState, setSavedState] = useState(saved)
  const [likedState, setLikedState] = useState(liked)
  const address = [item.StreetNumber, item.StreetName, item.StreetSuffix].filter(Boolean).join(' ').trim() || 'Property'
  // Activity items can carry inconsistent hierarchy fields; by-key path is always resolvable.
  const href = listingDetailPath(
    item.listing_key,
    undefined,
    undefined,
    { mlsNumber: item.ListNumber ?? null }
  )
  const shareUrl = `${getCanonicalSiteUrl()}${href}`
  const shareTitle = item.ListPrice != null && item.ListPrice > 0 ? formatPrice(item.ListPrice) : undefined
  const shareText = listingShareText({
    price: item.ListPrice ?? null,
    beds: item.BedroomsTotal ?? null,
    baths: item.BathroomsTotal ?? null,
    address: address || undefined,
    city: item.City ?? undefined,
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
    <Link
      href={href}
      className="group flex h-full min-h-full flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm transition hover:shadow-md"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-border">
        <div ref={imageContainerRef} className="relative h-full w-full">
          {item.PhotoURL ? (
            <Image
              src={item.PhotoURL}
              alt={`${address} — ${eventLabel(item.event_type).toLowerCase()}`}
              fill
              className="object-cover transition group-hover:scale-[1.02]"
              sizes="(max-width: 640px) 320px, (max-width: 1024px) 360px, 420px"
            />
          ) : (
            <div className="absolute inset-0 bg-primary/10" />
          )}
          <ActivityCelebrationOverlay
            eventType={item.event_type}
            containerRef={imageContainerRef}
            className="rounded-lg"
          />
        </div>
        <div className="absolute left-2 top-2 z-10">
          <Badge variant={eventBadgeVariant(item.event_type)}>{eventLabel(item.event_type)}</Badge>
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
      <div className="flex flex-1 flex-col p-3">
        <p className="font-medium text-primary line-clamp-2">{address}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatPrice(item.ListPrice)}
          {item.BedroomsTotal != null && ` · ${item.BedroomsTotal} bed`}
        </p>
      </div>
    </Link>
  )
}
