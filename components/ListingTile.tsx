'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState, useMemo, memo, useRef, useCallback, useEffect } from 'react'
import type { HomeTileRow, ListingTileRow } from '@/app/actions/listings'
import { isResortCommunity } from '@/lib/resort-communities'
import { toggleSavedListing } from '@/app/actions/saved-listings'
import { toggleLikeListing } from '@/app/actions/likes'
import { cn } from '@/lib/utils'
import CardActionBar from '@/components/ui/CardActionBar'
import { useComparison } from '@/contexts/ComparisonContext'
import CardBadges from '@/components/ui/CardBadges'
import { Button } from '@/components/ui/button'
import { getCanonicalSiteUrl, listingShareText } from '@/lib/share-metadata'
import { incrementListingShareCount } from '@/app/actions/engagement'
import { trackListingTileClick } from '@/app/actions/track-listing-click'
import { trackListingClick } from '@/lib/tracking'
import { listingDetailPath, listingsBrowsePath } from '@/lib/slug'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeftRightIcon, ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons'

const LISTING_PROVIDED_BY = 'Oregon Data Share'

function daysOnMarket(onMarketDate: string | null | undefined): number | null {
  if (!onMarketDate) return null
  const d = new Date(onMarketDate)
  if (Number.isNaN(d.getTime())) return null
  const days = Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000))
  return days >= 0 ? days : null
}

function statusLabel(s: string | null | undefined): string {
  const t = (s ?? '').toLowerCase()
  if (!t || t.includes('active') || t.includes('for sale') || t.includes('coming soon')) return 'Active'
  if (t.includes('pending')) return 'Pending'
  if (t.includes('closed')) return 'Closed'
  return s ?? 'Active'
}

function statusColor(s: string | null | undefined): string {
  const t = (s ?? '').toLowerCase()
  if (t.includes('pending')) return 'bg-warning/15 text-warning'
  if (t.includes('closed')) return 'bg-border text-muted-foreground'
  return 'bg-success/15 text-success'
}

/** Listing tile accepts full HomeTileRow or ListingTileRow (missing fields shown as empty). */
export type ListingTileListing = ListingTileRow & Partial<Pick<HomeTileRow, 'TotalLivingAreaSqFt' | 'ListOfficeName' | 'ListAgentName' | 'OnMarketDate' | 'OpenHouses' | 'details'>>

function getNeighborhoodName(listing: ListingTileListing): string | null {
  const maybe = listing as ListingTileListing & {
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

function formatAddress(listing: ListingTileListing): string {
  const parts = [
    [listing.StreetNumber, listing.StreetName].filter(Boolean).join(' ').trim(),
    listing.City,
    listing.State,
    listing.PostalCode,
  ].filter(Boolean) as string[]
  return parts.join(', ')
}

function isDirectVideoUrl(uri: string): boolean {
  const u = uri.toLowerCase()
  return u.endsWith('.mp4') || u.endsWith('.webm') || u.endsWith('.mov') || u.includes('video') || u.includes('mp4')
}

function getVideoUrls(listing: ListingTileListing): string[] {
  const videos = listing.details?.Videos
  if (!Array.isArray(videos)) return []

  // First: try direct video URLs (.mp4, .webm, .mov) — these can auto-play on hover
  const direct = videos
    .map((v) => (v?.Uri ?? '').trim())
    .filter((uri) => uri.length > 0 && isDirectVideoUrl(uri))
  if (direct.length > 0) return direct

  // Fallback: use ObjectHtml URLs (embed links like VisitHome.ai, YouTube, etc.)
  // These can't auto-play on hover but indicate video content exists
  return videos
    .map((v) => (v?.ObjectHtml ?? v?.Uri ?? '').trim())
    .filter((uri) => uri.length > 0)
}

/** Check if a URL is an embeddable video tour (not a direct .mp4) */
function isEmbedVideoUrl(url: string): boolean {
  return !isDirectVideoUrl(url) && url.length > 0
}

function hasVirtualTour(listing: ListingTileListing): boolean {
  const d = listing.details as { VirtualTours?: unknown; VirtualTour?: unknown } | undefined
  const tours = d?.VirtualTours ?? d?.VirtualTour
  if (Array.isArray(tours)) return tours.length > 0
  if (tours && typeof tours === 'object' && 'Uri' in tours) return true
  return false
}

function hasFloorPlans(listing: ListingTileListing): boolean {
  const d = listing.details as { FloorPlans?: unknown[]; FloorPlan?: unknown[] } | undefined
  const plans = d?.FloorPlans ?? d?.FloorPlan
  return Array.isArray(plans) && plans.length > 0
}

export type ListingTileProps = {
  listing: ListingTileListing
  listingKey: string
  /** Est. monthly P&I when available */
  monthlyPayment?: string
  saved?: boolean
  liked?: boolean
  signedIn: boolean
  userEmail?: string | null
  /** When true, show "Price reduced" badge (e.g. from listing history). */
  hasRecentPriceChange?: boolean
  /** When true, show "Hot" badge (e.g. Trending section). */
  hotBadge?: boolean
  /** When true, preload image (e.g. above-the-fold tiles). */
  priority?: boolean
  /** Optional FUB contact id to attach tile click to. */
  fubPersonId?: number | null
  /** Engagement counts for social proof (small number next to icons). */
  likeCount?: number
  saveCount?: number
  shareCount?: number
  /** View count shown when not signed in (e.g. "X views"). */
  viewCount?: number
}

const MIN_LIKES_FOR_FIRE = 3

function ListingTile({
  listing,
  listingKey,
  monthlyPayment,
  saved = false,
  liked = false,
  signedIn,
  userEmail,
  hasRecentPriceChange = false,
  hotBadge = false,
  priority = false,
  fubPersonId,
  likeCount = 0,
  saveCount = 0,
  shareCount = 0,
  viewCount = 0,
}: ListingTileProps) {
  const router = useRouter()
  const [savedState, setSavedState] = useState(saved)
  const [likedState, setLikedState] = useState(liked)
  const { isInComparison, addToComparison, removeFromComparison, comparisonItems } = useComparison()
  const inCompare = isInComparison(listingKey)

  function handleCompareToggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (inCompare) removeFromComparison(listingKey)
    else addToComparison(listingKey)
  }

  function goToLogin(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const returnUrl = typeof window !== 'undefined' ? encodeURIComponent(window.location.pathname + window.location.search) : ''
    router.push(`/login${returnUrl ? `?returnUrl=${returnUrl}` : ''}`)
  }
  const price = Number(listing.ListPrice ?? 0)
  const dom = daysOnMarket(listing.OnMarketDate ?? undefined)
  const hasOpenHouse = Array.isArray(listing.OpenHouses) && listing.OpenHouses.length > 0
  const isResort =
    listing.City != null &&
    listing.SubdivisionName != null &&
    isResortCommunity(listing.City, listing.SubdivisionName)
  const row = listing as { ListNumber?: string | null; ListingKey?: string | null; list_number?: string | null; listing_key?: string | null }
  const canonicalListingKey = (row.ListingKey ?? row.listing_key ?? listingKey ?? row.ListNumber ?? row.list_number ?? '').toString().trim()
  const linkKey = canonicalListingKey
  /** MLS# shown to users: prefer ListNumber (actual MLS list number); fall back to link key for routing. */
  const mlsDisplay = (row.ListNumber ?? row.list_number ?? canonicalListingKey).toString().trim()
  const neighborhood = getNeighborhoodName(listing)
  const href = linkKey
    ? listingDetailPath(
        linkKey,
        { streetNumber: listing.StreetNumber, streetName: listing.StreetName, city: listing.City, state: listing.State, postalCode: listing.PostalCode },
        { city: listing.City, neighborhood, subdivision: listing.SubdivisionName },
        { mlsNumber: row.ListNumber ?? row.list_number ?? null }
      )
    : listingsBrowsePath()
  const videoUrls = useMemo(() => getVideoUrls(listing), [listing.details])
  const primaryPhoto = listing.PhotoURL?.trim() || null
  const showVideoFirst = videoUrls.length > 0
  const hasVideo = videoUrls.length > 0
  const hasVirtTour = hasVirtualTour(listing)
  const hasPlans = hasFloorPlans(listing)

  const address = formatAddress(listing)

  async function handleToggleSave(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!signedIn) return
    if (!canonicalListingKey) return
    const result = await toggleSavedListing(canonicalListingKey)
    setSavedState(result.saved)
  }

  async function handleToggleLike(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!signedIn) return
    if (!canonicalListingKey) return
    const result = await toggleLikeListing(canonicalListingKey)
    setLikedState(result.liked)
  }

  const shareTitle =
    price > 0
      ? `$${price.toLocaleString()}${listing.City ? ` · ${listing.City}` : ''}`
      : address || undefined

  const shareUrl = `${getCanonicalSiteUrl()}${href}`
  const shareText = listingShareText({
    price: listing.ListPrice ?? null,
    beds: listing.BedroomsTotal ?? null,
    baths: listing.BathroomsTotal ?? null,
    sqft: (listing as ListingTileListing).TotalLivingAreaSqFt ?? null,
    address: address || undefined,
    city: listing.City ?? undefined,
  })

  function handleTileClick() {
    if (!canonicalListingKey) return
    const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}${href}` : href
    const sourcePage = typeof window !== 'undefined' ? window.location.href : ''
    trackListingClick({
      listingKey: canonicalListingKey,
      listingUrl: fullUrl,
      sourcePage,
      price: price > 0 ? price : undefined,
      city: listing.City ?? undefined,
      mlsNumber: mlsDisplay,
    })
    trackListingTileClick({
      listingKey: canonicalListingKey,
      listingUrl: fullUrl,
      sourcePage,
      userEmail: userEmail ?? undefined,
      fubPersonId: fubPersonId ?? undefined,
      property: {
        street: address || undefined,
        city: listing.City ?? undefined,
        state: listing.State ?? undefined,
        mlsNumber: mlsDisplay,
        price: price > 0 ? price : undefined,
        bedrooms: listing.BedroomsTotal ?? undefined,
        bathrooms: listing.BathroomsTotal ?? undefined,
      },
    })
  }

  return (
    <Link
      href={href}
      onClick={handleTileClick}
      className="group flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl bg-card text-card-foreground ring-1 ring-foreground/10 transition hover:shadow-lg hover:-translate-y-1"
    >
      {/* Photo / video area — photo first, video on hover for engagement */}
      <div
        className="relative aspect-[4/3] overflow-hidden rounded-t-xl bg-muted"
        onMouseEnter={(e) => {
          if (hasVideo) {
            const video = e.currentTarget.querySelector('video')
            if (video) { video.currentTime = 0; video.play().catch(() => {}) }
          }
        }}
        onMouseLeave={(e) => {
          if (hasVideo) {
            const video = e.currentTarget.querySelector('video')
            if (video) { video.pause() }
          }
        }}
      >
        {/* Photo is always the base layer */}
        {primaryPhoto ? (
          <Image
            src={primaryPhoto}
            alt={address || 'Property photo'}
            fill
            className={cn(
              'object-cover object-top transition duration-300',
              hasVideo ? 'group-hover:opacity-0' : 'group-hover:scale-[1.02]'
            )}
            sizes="(max-width: 640px) 85vw, 320px"
            priority={priority}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">No photo</div>
        )}

        {/* Video crossfades on top on hover — only for direct .mp4 files */}
        {hasVideo && isDirectVideoUrl(videoUrls[0]) && (
          <video
            src={videoUrls[0]}
            className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            muted
            playsInline
            loop
            preload="none"
            aria-hidden
          />
        )}

        {/* Video tour badge — for embed URLs (VisitHome, YouTube, Google Drive) */}
        {hasVideo && !isDirectVideoUrl(videoUrls[0]) && (
          <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1 rounded-md bg-foreground/70 px-2 py-1 text-xs font-medium text-background">
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            Video Tour
          </div>
        )}

        {/* Compare toggle: top-right */}
        <Button
          type="button"
          onClick={handleCompareToggle}
          disabled={!inCompare && comparisonItems.length >= 4}
          className={cn(
            'absolute top-2 right-2 z-10 flex items-center justify-center rounded-full border-2 shadow-sm transition disabled:opacity-40',
            'h-8 w-8',
            inCompare
              ? 'border-accent bg-accent text-accent-foreground'
              : 'border-primary-foreground/30 bg-foreground/40 text-primary-foreground hover:bg-foreground/60',
          )}
          aria-label={inCompare ? 'Remove from comparison' : 'Add to comparison'}
        >
          <HugeiconsIcon icon={ArrowLeftRightIcon} className="h-4 w-4" />
        </Button>

        {/* Smart badges: top-left — max 3, no wrap */}
        <CardBadges
          position="top-left"
          max={3}
          items={[
            ...(dom !== 0 && likeCount >= MIN_LIKES_FOR_FIRE ? [{ label: String(likeCount), variant: 'hot' as const, icon: <span aria-hidden><svg className="size-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 23C12 23 20 16 20 10c0-2.5-1.5-4-4-4-.8 0-1.5.2-2 .7-.5-.5-1.2-.7-2-.7-2.5 0-4 1.5-4 4 0 6 8 13 8 13z" /></svg></span> }] : []),
            ...(hotBadge ? [{ label: 'Hot', variant: 'hot' as const }] : []),
            ...(hasOpenHouse ? [{ label: 'Open house', variant: 'open-house' as const }] : []),
            ...(dom === 0 ? [{ label: 'New', variant: 'new' as const, icon: <span aria-hidden><svg className="size-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" /></svg></span> }] : []),
            ...(hasRecentPriceChange ? [{ label: 'Price reduced', variant: 'price-drop' as const }] : []),
            ...(isResort ? [{ label: 'Resort & master plan', variant: 'resort' as const }] : []),
          ]}
        />

        {/* Badges on image: bottom-left — Watch video (engagement), Virtual tour, Floor plan */}
        <CardBadges
          position="bottom-left"
          max={3}
          items={[
            ...(hasVideo ? [{ label: 'Watch video', variant: 'media' as const, icon: <span aria-hidden><svg className="size-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg></span> }] : []),
            ...(hasVirtTour ? [{ label: 'Virtual tour', variant: 'media' as const }] : []),
            ...(hasPlans ? [{ label: 'Floor plan', variant: 'media' as const }] : []),
          ]}
        />
        <CardActionBar
          position="overlay"
          variant="onDark"
          onClickWrap={(e) => { e.preventDefault(); e.stopPropagation() }}
          viewCount={viewCount}
          share={{
            url: shareUrl,
            title: shareTitle,
            text: shareText,
            ariaLabel: 'Share listing',
            shareCount,
            onShare: () => canonicalListingKey ? incrementListingShareCount(canonicalListingKey) : Promise.resolve({ ok: false }),
          }}
          like={signedIn
            ? { active: likedState, count: likeCount, ariaLabel: likedState ? 'Unlike' : 'Like', onToggle: handleToggleLike }
            : { active: false, count: likeCount, ariaLabel: 'Like', onToggle: goToLogin }}
          save={signedIn
            ? { active: savedState, count: saveCount, ariaLabel: savedState ? 'Remove from saved' : 'Save listing', onToggle: handleToggleSave }
            : { active: false, count: saveCount, ariaLabel: 'Save listing', onToggle: goToLogin }}
          signedIn={signedIn}
          guestCounts={!signedIn ? { viewCount, likeCount, saveCount } : undefined}
        />

      </div>

      {/* White content below photo: price row (price + action icons) and details */}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-nowrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xl font-semibold text-foreground">
              ${price > 0 ? price.toLocaleString() : '—'}
            </p>
            {monthlyPayment && (
              <p className="mt-0.5 text-sm text-muted-foreground">Est. {monthlyPayment}/mo</p>
            )}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0 text-sm text-muted-foreground">
          {listing.BedroomsTotal != null && <span>{listing.BedroomsTotal} bed</span>}
          {listing.BathroomsTotal != null && <span>{listing.BathroomsTotal} bath</span>}
          {listing.TotalLivingAreaSqFt != null && listing.TotalLivingAreaSqFt > 0 && (
            <span>{Number(listing.TotalLivingAreaSqFt).toLocaleString()} sq ft</span>
          )}
          <span>
            Days on market: {dom != null && dom >= 0 ? (dom === 0 ? 'New' : `${dom} day${dom !== 1 ? 's' : ''}`) : '—'}
          </span>
          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${statusColor(listing.StandardStatus)}`}>
            {statusLabel(listing.StandardStatus)}
          </span>
        </div>
        {address && <p className="mt-2 text-sm font-medium text-foreground">{address}</p>}
        <div className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
          <p>MLS# {mlsDisplay}</p>
          {listing.ListOfficeName && <p>{listing.ListOfficeName}</p>}
          {listing.ListAgentName && <p>{listing.ListAgentName}</p>}
          <p className="mt-1">Listing provided by {LISTING_PROVIDED_BY}</p>
        </div>
      </div>
    </Link>
  )
}

const TILE_VIDEO_PREVIEW_SECONDS = 3

function VideoSlider({ urls, address, previewSeconds = 0 }: { urls: string[]; address: string; previewSeconds?: number }) {
  const [index, setIndex] = useState(0)
  const url = urls[index] ?? urls[0]
  const videoRef = useRef<HTMLVideoElement>(null)
  const [previewEnded, setPreviewEnded] = useState(false)

  useEffect(() => {
    setPreviewEnded(false)
  }, [url])

  const handleTimeUpdate = useCallback(() => {
    if (previewSeconds <= 0 || !videoRef.current) return
    if (videoRef.current.currentTime >= previewSeconds) {
      videoRef.current.pause()
      setPreviewEnded(true)
    }
  }, [previewSeconds])

  if (!url) return null

  return (
    <div className="relative h-full w-full">
      <video
        ref={videoRef}
        key={url}
        src={url}
        className="h-full w-full object-cover object-top"
        playsInline
        muted
        loop={previewSeconds <= 0}
        autoPlay
        poster=""
        onTimeUpdate={handleTimeUpdate}
      />
      {previewSeconds > 0 && previewEnded && (
        <div className="absolute inset-0 flex items-center justify-center bg-foreground/20" aria-hidden>
          <span className="rounded-full bg-card/90 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm flex items-center gap-1.5">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            Watch video
          </span>
        </div>
      )}
      {address && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-foreground/70 to-transparent px-2 py-2">
          <p className="text-sm font-medium text-primary-foreground drop-shadow">{address}</p>
        </div>
      )}
      {urls.length > 1 && (
        <>
          <Button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIndex((i) => (i - 1 + urls.length) % urls.length)
            }}
            className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-card/90 p-1.5 shadow-shadow-subtle"
            aria-label="Previous video"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIndex((i) => (i + 1) % urls.length)
            }}
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-card/90 p-1.5 shadow-shadow-subtle"
            aria-label="Next video"
          >
            <HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4" />
          </Button>
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
            {urls.map((_, i) => (
              <Button
                key={i}
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setIndex(i)
                }}
                className={`h-1.5 w-1.5 rounded-full ${i === index ? 'bg-card' : 'bg-card/50'}`}
                aria-label={`Video ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default memo(ListingTile)
