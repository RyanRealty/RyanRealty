'use client'

import type { CommunityForIndex } from '@/lib/communities'
import { subdivisionEntityKey } from '@/lib/slug'
import GeoSlider from '@/components/geo-page/GeoSlider'
import CommunityBarCard from '@/components/geo-page/CommunityBarCard'

type Props = {
  cityName: string
  communities: CommunityForIndex[]
  signedIn?: boolean
  savedEntityKeys?: string[]
  likedEntityKeys?: string[]
}

/** Compact horizontal bar of communities (thumbnail + name + count). Matches the compact strip below hero on listing detail. */
export default function CommunitiesBar({ cityName, communities, signedIn = false, savedEntityKeys = [], likedEntityKeys = [] }: Props) {
  const resortFirst = [...communities].sort((a, b) => (b.isResort ? 1 : 0) - (a.isResort ? 1 : 0))
  const savedSet = new Set(savedEntityKeys)
  const likedSet = new Set(likedEntityKeys)

  if (resortFirst.length === 0) return null

  return (
    <GeoSlider
      title={`Communities in ${cityName}`}
      titleId="communities-bar-heading"
      titleSrOnly
      className="bg-muted border-b border-border px-4 py-3 sm:px-6 sm:py-4 lg:px-8"
      hoverArrows
    >
      {resortFirst.map((c) => {
        const entityKey = subdivisionEntityKey(c.city, c.subdivision)
        return (
          <CommunityBarCard
            key={c.slug}
            community={c}
            signedIn={signedIn}
            saved={savedSet.has(entityKey)}
            liked={likedSet.has(entityKey)}
          />
        )
      })}
    </GeoSlider>
  )
}
