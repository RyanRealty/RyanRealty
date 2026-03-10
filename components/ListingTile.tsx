'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useMemo } from 'react'
import type { HomeTileRow, ListingTileRow } from '@/app/actions/listings'
import { isResortCommunity } from '@/lib/resort-communities'
import { toggleSavedListing } from '@/app/actions/saved-listings'
import { toggleLikeListing } from '@/app/actions/likes'
import ShareButton from '@/components/ShareButton'
import { trackListingTileClick } from '@/app/actions/track-listing-click'
import { trackListingClick } from '@/lib/tracking'
import { listingAddressSlug } from '@/lib/slug'

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
  if (t.includes('pending')) return 'bg-amber-100 text-amber-800'
  if (t.includes('closed')) return 'bg-zinc-200 text-zinc-700'
  return 'bg-emerald-100 text-emerald-800'
}

/** Listing tile accepts full HomeTileRow or ListingTileRow (missing fields shown as empty). */
export type ListingTileListing = ListingTileRow & Partial<Pick<HomeTileRow, 'TotalLivingAreaSqFt' | 'ListOfficeName' | 'ListAgentName' | 'OnMarketDate' | 'OpenHouses' | 'details'>>

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
  return videos
    .map((v) => (v?.Uri ?? '').trim())
    .filter((uri) => uri.length > 0 && isDirectVideoUrl(uri))
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
  /** When true, preload image (e.g. above-the-fold tiles). */
  priority?: boolean
  /** Optional FUB contact id to attach tile click to. */
  fubPersonId?: number | null
}

export default function ListingTile({
  listing,
  listingKey,
  monthlyPayment,
  saved = false,
  liked = false,
  signedIn,
  userEmail,
  hasRecentPriceChange = false,
  priority = false,
  fubPersonId,
}: ListingTileProps) {
  const [savedState, setSavedState] = useState(saved)
  const [likedState, setLikedState] = useState(liked)
  const price = Number(listing.ListPrice ?? 0)
  const dom = daysOnMarket(listing.OnMarketDate ?? undefined)
  const hasOpenHouse = Array.isArray(listing.OpenHouses) && listing.OpenHouses.length > 0
  const isResort =
    listing.City != null &&
    listing.SubdivisionName != null &&
    isResortCommunity(listing.City, listing.SubdivisionName)
  // SEO-friendly URL: /listing/[key]-[street-city-state-zip]. Detail page resolves key from slug; key-only fallback when no address.
  const row = listing as { ListNumber?: string | null; ListingKey?: string | null; list_number?: string | null; listing_key?: string | null }
  const linkKey = (row.ListNumber ?? row.ListingKey ?? row.list_number ?? row.listing_key ?? listingKey).toString().trim()
  const addressSlug = linkKey ? listingAddressSlug({
    streetNumber: listing.StreetNumber,
    streetName: listing.StreetName,
    city: listing.City,
    state: listing.State,
    postalCode: listing.PostalCode,
  }) : ''
  const pathSegment = addressSlug ? `${linkKey}-${addressSlug}` : linkKey
  const href = pathSegment ? `/listing/${encodeURIComponent(pathSegment)}` : '/listings'
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
    const result = await toggleSavedListing(listingKey)
    setSavedState(result.saved)
  }

  async function handleToggleLike(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!signedIn) return
    const result = await toggleLikeListing(listingKey)
    setLikedState(result.liked)
  }

  const shareTitle =
    price > 0
      ? `$${price.toLocaleString()}${listing.City ? ` · ${listing.City}` : ''}`
      : address || undefined

  function handleTileClick() {
    const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}${href}` : href
    const sourcePage = typeof window !== 'undefined' ? window.location.href : ''
    trackListingClick({
      listingKey,
      listingUrl: fullUrl,
      sourcePage,
      price: price > 0 ? price : undefined,
      city: listing.City ?? undefined,
      mlsNumber: listingKey,
    })
    trackListingTileClick({
      listingKey,
      listingUrl: fullUrl,
      sourcePage,
      userEmail: userEmail ?? undefined,
      fubPersonId: fubPersonId ?? undefined,
      property: {
        street: address || undefined,
        city: listing.City ?? undefined,
        state: listing.State ?? undefined,
        mlsNumber: listingKey,
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
      className="group flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:border-zinc-300 hover:shadow-md"
    >
      {/* Photo / video area */}
      <div className="relative aspect-[4/3] bg-zinc-100">
        {showVideoFirst ? (
          <VideoSlider urls={videoUrls} address={address} />
        ) : primaryPhoto ? (
          <Image
            src={primaryPhoto}
            alt=""
            fill
            className="object-cover transition group-hover:scale-[1.02]"
            sizes="(max-width: 640px) 85vw, 320px"
            priority={priority}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-400">No photo</div>
        )}

        {/* Top-left: Open house OR days on market (one badge), then resort if applicable */}
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {hasOpenHouse && (
            <span className="rounded-md bg-rose-600 px-2 py-1 text-xs font-semibold text-white shadow">
              Open house
            </span>
          )}
          {!hasOpenHouse && dom != null && dom >= 0 && (
            <span className="rounded-md bg-white/95 px-2 py-1 text-xs font-semibold text-zinc-800 shadow">
              {dom === 0 ? 'New' : `${dom} day${dom !== 1 ? 's' : ''} on market`}
            </span>
          )}
          {isResort && (
            <span className="rounded-md bg-indigo-700 px-2 py-1 text-xs font-semibold text-white shadow">
              Resort lifestyle — golf, trails and more
            </span>
          )}
          {hasRecentPriceChange && (
            <span className="rounded-md bg-amber-500 px-2 py-1 text-xs font-semibold text-white shadow">
              Price reduced
            </span>
          )}
        </div>

        {/* Top-right: Like + Share — same size for symmetry */}
        <div
          className="absolute right-2 top-2 flex items-center gap-1.5"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
        >
          <ShareButton
            url={typeof window !== 'undefined' ? `${window.location.origin}${href}` : undefined}
            title={shareTitle}
            variant="compact"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/95 p-0 shadow hover:bg-white"
            aria-label="Share listing"
          />
          {signedIn && (
            <button
              type="button"
              onClick={handleToggleLike}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/95 p-0 shadow hover:bg-white"
              aria-label={likedState ? 'Unlike' : 'Like'}
            >
              {likedState ? (
                <svg className="h-5 w-5 text-rose-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              )}
            </button>
          )}
          {signedIn && (
            <button
              type="button"
              onClick={handleToggleSave}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/95 p-0 shadow hover:bg-white"
              aria-label={savedState ? 'Remove from saved' : 'Save listing'}
            >
              {savedState ? (
                <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              )}
            </button>
          )}
        </div>

        {/* Media badges: video, virtual tour, floor plan — click goes to listing */}
        {(hasVideo || hasVirtTour || hasPlans) && (
          <div className="absolute bottom-2 left-2 flex flex-wrap items-center gap-1.5">
            {hasVideo && (
              <span className="flex items-center gap-1 rounded bg-black/70 px-2 py-1 text-xs font-medium text-white shadow">
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M8 5v14l11-7z" />
                </svg>
                Video
              </span>
            )}
            {hasVirtTour && (
              <span className="rounded bg-black/70 px-2 py-1 text-xs font-medium text-white shadow">
                Virtual tour
              </span>
            )}
            {hasPlans && (
              <span className="rounded bg-black/70 px-2 py-1 text-xs font-medium text-white shadow">
                Floor plan
              </span>
            )}
          </div>
        )}

        {/* MLS logo bottom-right of photo */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-white/90 px-1.5 py-0.5 shadow">
          <img
            src="/images/oregon-data-share-logo.svg"
            alt=""
            className="h-5 w-auto"
            width={100}
            height={22}
          />
        </div>
      </div>

      {/* White content below photo */}
      <div className="flex flex-1 flex-col bg-white p-4">
        <p className="text-xl font-bold text-zinc-900">
          ${price > 0 ? price.toLocaleString() : '—'}
        </p>
        {monthlyPayment && (
          <p className="mt-0.5 text-sm text-zinc-500">Est. {monthlyPayment}/mo</p>
        )}
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0 text-sm text-zinc-600">
          {listing.BedroomsTotal != null && <span>{listing.BedroomsTotal} bed</span>}
          {listing.BathroomsTotal != null && <span>{listing.BathroomsTotal} bath</span>}
          {listing.TotalLivingAreaSqFt != null && listing.TotalLivingAreaSqFt > 0 && (
            <span>{Number(listing.TotalLivingAreaSqFt).toLocaleString()} sq ft</span>
          )}
          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${statusColor(listing.StandardStatus)}`}>
            {statusLabel(listing.StandardStatus)}
          </span>
        </div>
        {address && <p className="mt-2 text-sm font-medium text-zinc-800">{address}</p>}
        <div className="mt-3 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
          <p>MLS# {listingKey}</p>
          {listing.ListOfficeName && <p>{listing.ListOfficeName}</p>}
          {listing.ListAgentName && <p>{listing.ListAgentName}</p>}
          <p className="mt-1">Listing provided by {LISTING_PROVIDED_BY}</p>
        </div>
      </div>
    </Link>
  )
}

function VideoSlider({ urls, address }: { urls: string[]; address: string }) {
  const [index, setIndex] = useState(0)
  const url = urls[index] ?? urls[0]

  if (!url) return null

  return (
    <div className="relative h-full w-full">
      <video
        key={url}
        src={url}
        className="h-full w-full object-cover"
        playsInline
        muted
        loop
        poster=""
      />
      {address && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-2">
          <p className="text-sm font-medium text-white drop-shadow">{address}</p>
        </div>
      )}
      {urls.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIndex((i) => (i - 1 + urls.length) % urls.length)
            }}
            className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 shadow"
            aria-label="Previous video"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIndex((i) => (i + 1) % urls.length)
            }}
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 shadow"
            aria-label="Next video"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
            {urls.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setIndex(i)
                }}
                className={`h-1.5 w-1.5 rounded-full ${i === index ? 'bg-white' : 'bg-white/50'}`}
                aria-label={`Video ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
