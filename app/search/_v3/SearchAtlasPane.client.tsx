'use client'

/**
 * Live house-atlas pane. Dots and the claim come from the listings in view.
 */
import { useEffect, useMemo, useState } from 'react'
import { getHiddenListingKeys } from '@/app/actions/hidden-listings'
import { buildHiddenKeySet, excludeHiddenListings } from '@/components/search/hidden-exclusion'
import { SearchAtlas } from './SearchAtlas.client'
import {
  searchAtlasClaim,
  searchAtlasRegions,
  searchAtlasTypes,
  searchListingsToAtlasDots,
  type SearchAtlasListing,
} from './search-atlas-dots'

export type SearchAtlasPaneProps = {
  listings: readonly SearchAtlasListing[]
  placeName: string
  placeHref: string
  geometry?: GeoJSON.Geometry | null
  source: string
  stamp?: string
  incomplete?: boolean
  claimText?: string
  className?: string
}

export function SearchAtlasPane({
  listings,
  placeName,
  placeHref,
  geometry,
  source,
  stamp,
  incomplete,
  claimText,
  className,
}: SearchAtlasPaneProps) {
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(() => new Set())
  useEffect(() => {
    let cancelled = false
    getHiddenListingKeys()
      .then((keys) => {
        if (!cancelled && keys.length > 0) setHiddenKeys(buildHiddenKeySet(keys))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])
  const visible = useMemo(
    () => excludeHiddenListings([...listings], hiddenKeys),
    [listings, hiddenKeys],
  )
  const dots = useMemo(() => searchListingsToAtlasDots(visible), [visible])
  const types = useMemo(() => searchAtlasTypes(dots), [dots])
  const regions = useMemo(
    () => searchAtlasRegions(placeName, placeHref, geometry),
    [placeName, placeHref, geometry],
  )
  return (
    <SearchAtlas
      headline={placeName}
      claimText={claimText ?? searchAtlasClaim(dots, placeName)}
      dots={dots}
      regions={regions}
      types={types}
      source={source}
      stamp={stamp}
      incomplete={incomplete}
      className={className}
    />
  )
}
