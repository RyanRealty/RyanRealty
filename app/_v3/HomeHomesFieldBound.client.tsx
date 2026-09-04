'use client'

/**
 * Client island that binds the photographed homepage Field to the living atlas
 * camera. page.tsx stays a server component; V3Atlas publishes bounds, this
 * list subscribes.
 */
import {
  cloneElement,
  isValidElement,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
import { inAtlasView, subscribeAtlasView, type AtlasViewBounds } from '@/lib/geo/atlas-camera'
import type { ListingTileRow } from '@/app/actions/listings'
import { HomeHomesField } from './HomeHomesField'

const PLACE_EMPTY_IN_VIEW =
  'No photographed homes in this view of the map. Zoom out or pan to see the homes in this place.'

function useAtlasViewBounds(override?: AtlasViewBounds | null): AtlasViewBounds | null {
  const [live, setLive] = useState<AtlasViewBounds | null>(null)
  useEffect(() => subscribeAtlasView(setLive), [])
  return override !== undefined ? override : live
}

export function HomeHomesFieldBound(
  props: Omit<Parameters<typeof HomeHomesField>[0], 'bounds'> & {
    bounds?: AtlasViewBounds | null
  },
) {
  const { bounds: boundsOverride, ...fieldProps } = props
  const bounds = useAtlasViewBounds(boundsOverride)
  return <HomeHomesField {...fieldProps} bounds={bounds} />
}

/**
 * Place-page list under the atlas. Filters listing cards by the visible
 * lon/lat box. Empty-in-view is a sentence, not a zero count.
 */
export function PlaceSplitHomesBound({
  listings,
  totalCount,
  bounds: boundsOverride,
  emptyInView = PLACE_EMPTY_IN_VIEW,
  children,
}: {
  listings: ListingTileRow[]
  totalCount: number
  bounds?: AtlasViewBounds | null
  emptyInView?: string
  children: ReactNode
}) {
  const bounds = useAtlasViewBounds(boundsOverride)
  const visible = useMemo(
    () => listings.filter((row) => inAtlasView(row.Latitude, row.Longitude, bounds)),
    [listings, bounds],
  )
  const emptyInThisView = bounds != null && listings.length > 0 && visible.length === 0
  if (emptyInThisView) {
    return (
      <div className="srch-panel m-4 p-8 text-center">
        <p className="srch-label">This view</p>
        <p className="mt-2 text-base font-semibold text-foreground">{emptyInView}</p>
      </div>
    )
  }
  if (!isValidElement(children)) return children
  return cloneElement(children as ReactElement<{ initialListings: ListingTileRow[]; initialTotalCount: number }>, {
    initialListings: visible,
    initialTotalCount: bounds == null ? totalCount : visible.length,
  })
}
