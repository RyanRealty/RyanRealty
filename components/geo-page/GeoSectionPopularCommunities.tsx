'use client'

import Link from 'next/link'
import type { CommunityForIndex } from '@/lib/communities'
import type { HotCommunity } from '@/app/actions/listings'
import { subdivisionEntityKey } from '@/lib/slug'
import CommunityTile from '@/components/CommunityTile'
import TilesSlider, { TilesSliderItem } from '@/components/TilesSlider'
import { TILE_MIN_HEIGHT_PX } from '@/lib/tile-constants'

function toHotCommunity(c: CommunityForIndex): HotCommunity {
  return {
    subdivisionName: c.subdivision,
    forSale: c.activeCount,
    pending: 0,
    newLast7Days: 0,
    medianListPrice: c.medianPrice,
  }
}

type Props = {
  title: string
  communities: CommunityForIndex[]
  viewAllHref: string
  viewAllLabel?: string
  excludeSlug?: string | null
  signedIn?: boolean
  savedEntityKeys?: string[]
  likedEntityKeys?: string[]
}

/** Popular communities section: single-row slider of community tiles. Resort first. */
export default function GeoSectionPopularCommunities({
  title,
  communities,
  viewAllHref,
  viewAllLabel = 'View all communities',
  excludeSlug,
  signedIn = false,
  savedEntityKeys = [],
  likedEntityKeys = [],
}: Props) {
  const resortFirst = [...communities]
    .filter((c) => c.slug !== excludeSlug)
    .sort((a, b) => (b.isResort ? 1 : 0) - (a.isResort ? 1 : 0))

  if (resortFirst.length === 0) return null

  const savedSet = new Set(savedEntityKeys)
  const likedSet = new Set(likedEntityKeys)

  return (
    <TilesSlider
      title={title}
      titleId="popular-communities-heading"
      headerRight={
        <Link href={viewAllHref} className="text-sm font-semibold text-accent-foreground hover:text-accent-foreground">
          {viewAllLabel}
        </Link>
      }
      className="bg-muted px-4 py-10 sm:px-6 sm:py-12"
    >
      {resortFirst.map((c) => {
        const entityKey = subdivisionEntityKey(c.city, c.subdivision)
        return (
          <TilesSliderItem key={c.slug} style={{ minHeight: TILE_MIN_HEIGHT_PX }}>
            <CommunityTile
              city={c.city}
              community={toHotCommunity(c)}
              bannerUrl={c.heroImageUrl}
              signedIn={signedIn}
              saved={savedSet.has(entityKey)}
              liked={likedSet.has(entityKey)}
            />
          </TilesSliderItem>
        )
      })}
    </TilesSlider>
  )
}
