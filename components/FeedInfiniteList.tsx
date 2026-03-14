'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { getFeedListings } from '@/app/actions/feed'
import type { ListingTileRow } from '@/app/actions/listings'
import ListingTile from '@/components/ListingTile'

type FeedInfiniteListProps = {
  initialListings: ListingTileRow[]
  initialNextOffset: number | null
  likedKeys: string[]
  savedKeys: string[]
  signedIn: boolean
  userEmail?: string | null
}

export default function FeedInfiniteList({
  initialListings,
  initialNextOffset,
  likedKeys,
  savedKeys,
  signedIn,
  userEmail,
}: FeedInfiniteListProps) {
  const [listings, setListings] = useState(initialListings)
  const [nextOffset, setNextOffset] = useState<number | null>(initialNextOffset)
  const [loading, setLoading] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const likedSet = new Set(likedKeys)
  const savedSet = new Set(savedKeys)

  const loadMore = useCallback(async () => {
    if (nextOffset == null || loading) return
    setLoading(true)
    try {
      const { listings: nextListings, nextOffset: next } = await getFeedListings({ offset: nextOffset })
      setListings((prev) => [...prev, ...nextListings])
      setNextOffset(next)
    } finally {
      setLoading(false)
    }
  }, [nextOffset, loading])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore()
      },
      { rootMargin: '200px', threshold: 0 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore])

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {listings.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">No listings right now. Check back later.</p>
      ) : (
        <>
          {listings.map((listing) => {
            const key = (listing.ListingKey ?? listing.ListNumber ?? '').toString().trim() || String(listing.ListPrice)
            return (
              <ListingTile
                key={key}
                listing={listing}
                listingKey={key}
                signedIn={signedIn}
                userEmail={userEmail}
                saved={savedSet.has(key)}
                liked={likedSet.has(key)}
                priority={listings.indexOf(listing) < 4}
              />
            )
          })}
          <div ref={sentinelRef} className="h-4" aria-hidden />
          {loading && (
            <p className="py-4 text-center text-sm text-muted-foreground">Loading more…</p>
          )}
        </>
      )}
    </div>
  )
}
