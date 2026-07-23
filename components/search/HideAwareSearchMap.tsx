'use client'

import { useEffect, useMemo, useState } from 'react'
import SearchMapClustered from '@/components/LazySearchMapClustered'
import type { ListingForMap } from '@/components/SearchMapClustered'
import { getHiddenListingKeys } from '@/app/actions/hidden-listings'
import { buildHiddenKeySet, excludeHiddenListings } from '@/components/search/hidden-exclusion'

/**
 * The /search?view=map (map-only) pin layer, made hidden-aware. The split view
 * (MapSearchView) already subtracts hidden homes from its pins; the map-only
 * view rendered the same SearchMapClustered directly with the server's
 * unfiltered set, so a home the user hid on the list/split view reappeared as a
 * clickable pin here (W7.2 — found by the adversarial verifier). This wrapper
 * subtracts the signed-in user's hidden homes before the pins are drawn (dual-
 * key: ListingKey OR ListNumber). No hide control — a map-only view has no cards
 * to hide from; hiding happens on the list/split surfaces. Signed-out users get
 * an empty set (no filtering). Server map results are SHARED caches, so the
 * subtraction happens here at the edge of render, never in the fetch.
 */
export default function HideAwareSearchMap({
  listings,
  savedListingKeys,
  likedListingKeys,
  placeQuery,
  className,
}: {
  listings: ListingForMap[]
  savedListingKeys: string[]
  likedListingKeys: string[]
  placeQuery: string
  className?: string
}) {
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    let cancelled = false
    getHiddenListingKeys()
      .then((keys) => { if (!cancelled && keys.length > 0) setHiddenKeys(buildHiddenKeySet(keys)) })
      .catch(() => {}) // fail open
    return () => { cancelled = true }
  }, [])

  const visible = useMemo(() => excludeHiddenListings(listings, hiddenKeys), [listings, hiddenKeys])

  return (
    <SearchMapClustered
      listings={visible}
      savedListingKeys={savedListingKeys}
      likedListingKeys={likedListingKeys}
      placeQuery={placeQuery}
      className={className}
    />
  )
}
