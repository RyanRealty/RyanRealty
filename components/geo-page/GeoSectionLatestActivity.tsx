'use client'

import type { ActivityFeedItem } from '@/app/actions/activity-feed'
import TilesSlider, { TilesSliderItem } from '@/components/TilesSlider'
import { TILE_MIN_HEIGHT_PX } from '@/lib/tile-constants'
import ActivityFeedCard from './ActivityFeedCard'

type Props = {
  title: string
  items: ActivityFeedItem[]
}

/** Latest activity section: single-row slider, all items intermingled, sorted by newest first, each card badged by event type. */
export default function GeoSectionLatestActivity({ title, items }: Props) {
  if (items.length === 0) return null

  const sorted = [...items].sort(
    (a, b) => new Date(b.event_at).getTime() - new Date(a.event_at).getTime()
  )

  return (
    <TilesSlider
      title={title}
      titleId="latest-activity-heading"
      className="bg-muted px-4 py-10 sm:px-6 sm:py-12"
    >
      {sorted.map((item) => (
        <TilesSliderItem key={item.id} style={{ minHeight: TILE_MIN_HEIGHT_PX }}>
          <ActivityFeedCard item={item} />
        </TilesSliderItem>
      ))}
    </TilesSlider>
  )
}
