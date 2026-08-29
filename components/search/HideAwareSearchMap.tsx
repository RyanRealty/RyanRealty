'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import SearchMapClustered from '@/components/LazySearchMapClustered'
import type { ListingForMap, MapBounds } from '@/components/SearchMapClustered'
import { getHiddenListingKeys } from '@/app/actions/hidden-listings'
import { buildHiddenKeySet, excludeHiddenListings } from '@/components/search/hidden-exclusion'
import { Button } from '@/components/ui/button'
import { Eyebrow, H3, Body } from '@/components/site/primitives'
import { nextSearchUrlWithBbox } from '@/lib/search/publish-map-bbox'

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
  degraded = false,
  initialBounds,
  lockBounds = false,
}: {
  listings: ListingForMap[]
  savedListingKeys: string[]
  likedListingKeys: string[]
  placeQuery: string
  className?: string
  /** Timeout/error on the map-only fetch. Empty pins are not "0 homes". */
  degraded?: boolean
  initialBounds?: MapBounds | null
  lockBounds?: boolean
}) {
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(() => new Set())
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    let cancelled = false
    getHiddenListingKeys()
      .then((keys) => { if (!cancelled && keys.length > 0) setHiddenKeys(buildHiddenKeySet(keys)) })
      .catch(() => {}) // fail open
    return () => { cancelled = true }
  }, [])

  const visible = useMemo(() => excludeHiddenListings(listings, hiddenKeys), [listings, hiddenKeys])

  const persistBbox = useCallback(
    (bounds: MapBounds) => {
      const next = nextSearchUrlWithBbox(
        pathname ?? '/homes-for-sale',
        searchParams?.toString() ?? '',
        bounds,
      )
      if (!next) return
      router.replace(next, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  if (degraded) {
    return (
      <div className={className ?? 'flex h-full w-full items-center justify-center p-8'}>
        <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center">
          <Eyebrow>Search delayed</Eyebrow>
          <H3 className="mt-2">We could not load the map in time</H3>
          <Body className="mx-auto mt-2 text-muted-foreground">
            This is a connection or timeout problem, not an empty market. Try again.
          </Body>
          <Button
            type="button"
            variant="outline"
            className="mt-6"
            onClick={() => {
              if (typeof window !== 'undefined') window.location.reload()
            }}
          >
            Reload page
          </Button>
        </div>
      </div>
    )
  }

  return (
    <SearchMapClustered
      listings={visible}
      savedListingKeys={savedListingKeys}
      likedListingKeys={likedListingKeys}
      placeQuery={placeQuery}
      className={className}
      initialBounds={initialBounds}
      lockBounds={lockBounds}
      onBoundsChanged={persistBbox}
    />
  )
}
