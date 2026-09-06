'use client'
// brand-voice:exempt — map chrome only; status lines state a failure, not a pitch.

/**
 * Homepage Google Map — regular explore map with listing pins.
 * Not Atlas: no heatmap, no type sidebar, no region chips.
 */

import dynamic from 'next/dynamic'
import type { HomeExploreMapPin } from './HomeExploreMapImpl'

export type { HomeExploreMapPin }

const Impl = dynamic(
  () => import('./HomeExploreMapImpl').then((m) => m.HomeExploreMapImpl),
  {
    ssr: false,
    loading: () => <div className="home-explore-map__loading" aria-hidden="true" />,
  },
)

export function HomeExploreMap(props: {
  pins: readonly HomeExploreMapPin[]
  boundary?: unknown
}) {
  return (
    <div className="home-explore-map__frame">
      <div className="home-explore-map__pending" aria-hidden="true" />
      <Impl {...props} />
    </div>
  )
}
