'use client'

import { useEffect, useMemo, useState } from 'react'
import VideoListingCard from '@/components/site/VideoListingCard'
import type { ListingCardData } from '@/components/site/ListingCard'
import { getHiddenListingKeys } from '@/app/actions/hidden-listings'
import { buildHiddenKeySet, isHiddenListing } from '@/components/search/hidden-exclusion'

export type HideAwareVideoItem = {
  card: ListingCardData
  ListingKey: string | null
  ListNumber: string | null
}

/**
 * Client grid for the /videos "homes on video" browse. It subtracts the signed-
 * in user's hidden homes (dual-key: ListingKey OR ListNumber) so a home hidden
 * on /search does not reappear in the video-tour grid (W7.2). No hide control
 * here — VideoListingCard owns a click-to-play overlay, and stacking a second
 * overlay would fight it; the exclusion is the leak that mattered. Signed-out
 * users get an empty set (no filtering). Server results are SHARED caches, so
 * the hiding happens at the edge of render, never in the fetch.
 */
export default function HideAwareVideoGrid({ items }: { items: HideAwareVideoItem[] }) {
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    let cancelled = false
    getHiddenListingKeys()
      .then((keys) => { if (!cancelled && keys.length > 0) setHiddenKeys(buildHiddenKeySet(keys)) })
      .catch(() => {}) // fail open
    return () => { cancelled = true }
  }, [])

  const visible = useMemo(
    () => items.filter((it) => !isHiddenListing({ ListingKey: it.ListingKey, ListNumber: it.ListNumber }, hiddenKeys)),
    [items, hiddenKeys],
  )

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mt-8">
      {visible.map(({ card }) => (
        <VideoListingCard key={card.listingKey} listing={card} />
      ))}
    </div>
  )
}
