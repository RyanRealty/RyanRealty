'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { HotCommunity } from '@/app/actions/listings'
import { cityEntityKey, subdivisionEntityKey } from '@/lib/slug'
import ShareButton from '@/components/ShareButton'
import { toggleSavedCommunity } from '@/app/actions/saved-communities'

export type CommunityTileProps = {
  city: string
  community: HotCommunity
  /** Optional banner image URL for the tile */
  bannerUrl?: string | null
  /** When true, show saved state and allow toggle (signed-in users). */
  signedIn?: boolean
  /** Whether this community is currently saved by the user */
  saved?: boolean
}

/**
 * Single community tile. Use the same component anywhere community tiles are displayed (home, search, etc.).
 */
export default function CommunityTile({ city, community, bannerUrl = null, signedIn = false, saved = false }: CommunityTileProps) {
  const href = `/search/${cityEntityKey(city)}/${encodeURIComponent(community.subdivisionName)}`
  const entityKey = subdivisionEntityKey(city, community.subdivisionName)
  const countLabel = community.forSale + community.pending > 0 ? `${community.forSale + community.pending} homes` : 'Explore'
  const [savedState, setSavedState] = useState(saved)
  const [pending, setPending] = useState(false)
  useEffect(() => {
    setSavedState(saved)
  }, [saved])

  async function handleToggleSave(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!signedIn || pending) return
    setPending(true)
    const result = await toggleSavedCommunity(entityKey)
    setPending(false)
    if (result.error == null) setSavedState(result.saved)
  }

  return (
    <div className="relative h-full min-h-[200px] w-full overflow-hidden rounded-xl border border-zinc-200 shadow-sm transition hover:shadow-md">
      <div className="relative aspect-[4/3] w-full">
        <Link href={href} className="absolute inset-0 block">
          {bannerUrl ? (
            <Image
              src={bannerUrl}
              alt=""
              fill
              className="object-cover transition hover:scale-[1.02]"
              sizes="300px"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-zinc-700 to-zinc-900" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
            <span className="block font-semibold drop-shadow">{community.subdivisionName}</span>
            <span className="mt-0.5 block text-sm text-white/90">{countLabel}</span>
            {community.medianListPrice != null && community.medianListPrice > 0 && (
              <span className="mt-0.5 block text-xs text-white/80">
                Median ${(community.medianListPrice / 1000).toFixed(0)}k
              </span>
            )}
          </div>
        </Link>
        <div
          className="absolute right-2 top-2 z-10 flex items-center gap-1.5"
          onClick={(e) => e.preventDefault()}
        >
          <ShareButton
            url={typeof window !== 'undefined' ? `${window.location.origin}${href}` : undefined}
            title={`${community.subdivisionName} homes for sale in ${city}`}
            variant="compact"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/95 p-0 shadow hover:bg-white"
            aria-label={`Share ${community.subdivisionName}`}
          />
          {signedIn && (
            <button
              type="button"
              onClick={handleToggleSave}
              disabled={pending}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/95 p-0 shadow hover:bg-white disabled:opacity-60"
              aria-label={savedState ? 'Remove from saved communities' : 'Save community'}
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
      </div>
    </div>
  )
}
