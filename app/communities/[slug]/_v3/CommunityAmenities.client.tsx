'use client'

/**
 * SITE-116. beautifului InsightCards on the community amenity section.
 *
 * THE OBJECT IS THE CATALOG'S. InsightCards + AllocationCard are the installed
 * source at components/motion/insight-cards.tsx (beautifului.dev/r/insight-cards.json):
 * pager head, previous/next, prose claim, allocation bar, chips, pill.
 * This file supplies the amenity pages. It does not re-implement the control.
 * Pager title is AMENITY_INSIGHT_TITLE ("What's here"), not "Amenities" + index.
 */

import { useMemo } from 'react'
import InsightCards, {
  AllocationCard,
  type InsightPage,
} from '@/components/motion/insight-cards'
import { AMENITY_INSIGHT_TITLE, type CommunityAmenityBoard } from './community-amenities'

export function CommunityAmenities({ board }: { board: CommunityAmenityBoard }) {
  const pages = useMemo<InsightPage[]>(() => {
    const mixPage: InsightPage = {
      key: 'amenity-mix',
      prose: <>{board.claim}</>,
      Card: function AmenityMixCard() {
        return (
          <AllocationCard
            segments={board.mix}
            note={board.mixNote}
          />
        )
      },
      pill: board.mixPill,
      pillHref: board.mixPillHref,
    }

    const categoryPages = board.categories.map((category) => ({
      key: category.key,
      prose: <>{category.claim}</>,
      Card: function AmenityCategoryCard() {
        return (
          <AllocationCard
            segments={category.segments}
            note={category.note}
          />
        )
      },
      pill: category.pill,
      pillHref: category.pillHref,
    }))

    return [mixPage, ...categoryPages]
  }, [board])

  return <InsightCards pages={pages} labels={{ title: AMENITY_INSIGHT_TITLE }} />
}
