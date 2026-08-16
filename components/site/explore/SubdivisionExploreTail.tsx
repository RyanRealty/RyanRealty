/**
 * Tail of the subdivision page: lifestyle · parents · peer plats · sell.
 * Split out so page.tsx stays under the file-size budget.
 */

import { LifestyleNearSection } from '@/components/site/explore/LifestyleNearSection'
import { PlaceParentsSection } from '@/components/site/explore/PlaceParentsSection'
import { KbExploreTowns } from '@/components/site/kb/KbExploreTowns.client'
import { KbSell } from '@/components/site/kb/KbSell.client'
import { publishSellMedian } from '@/lib/market/publish-median-caption'
import type { PlaceContext } from '@/lib/data/geo/resolvePlaceContext'
import type { LifestyleNearItem } from '@/lib/explore/lifestyle-near'
import type { KbTownItem } from '@/components/site/kb/types'

type Props = {
  displayName: string
  placeContext: PlaceContext
  lifestyleItems: LifestyleNearItem[]
  centroid: { lat: number; lng: number } | null
  peerPlats: KbTownItem[]
  resortLabel: string | null
  resortSlug: string | null
  cityName: string
  citySlug: string | null
  heroMedian: number | null
  heroDom: number | null
  soldCount: number | null
}

export function SubdivisionExploreTail({
  displayName,
  placeContext,
  lifestyleItems,
  centroid,
  peerPlats,
  resortLabel,
  resortSlug,
  cityName,
  citySlug,
  heroMedian,
  heroDom,
  soldCount,
}: Props) {
  const sellMedian = publishSellMedian({
    placeMedian: heroMedian,
    grain: 'subdivision',
    placeName: displayName,
  })
  return (
    <>
      <LifestyleNearSection
        lat={centroid?.lat}
        lng={centroid?.lng}
        items={lifestyleItems}
        eyebrow={`${displayName} · Lifestyle`}
        title="Parks, trails, and golf nearby"
      />
      <PlaceParentsSection
        parents={placeContext.parents}
        eyebrow="Keep exploring"
        title={`${displayName} sits inside`}
      />
      {peerPlats.length > 0 ? (
        <KbExploreTowns
          towns={peerPlats}
          eyebrow={`${resortLabel ?? 'Community'} · Other plats`}
          title={`More areas in ${resortLabel ?? 'this community'}`}
          sectionId="peer-plats"
          cta={
            resortSlug
              ? {
                  href: `/communities/${resortSlug}`,
                  label: `Explore ${resortLabel ?? 'the community'}`,
                }
              : citySlug
                ? { href: `/cities/${citySlug}`, label: `Explore ${cityName}` }
                : null
          }
        />
      ) : null}
      <KbSell
        data={{
          medianListPrice: sellMedian?.value ?? null,
          medianCaption: sellMedian?.caption ?? null,
          medianDaysToPending: heroDom,
          soldCount30d: soldCount,
        }}
      />
    </>
  )
}
