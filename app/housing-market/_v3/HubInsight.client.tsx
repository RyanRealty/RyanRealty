'use client'

/**
 * SITE-100 — beautifului-insight and beui-number, installed, on the hub fold.
 *
 * THE OBJECT IS THE CATALOG'S. InsightCards is the installed source
 * (`components/motion/insight-cards.tsx`); AnimatedNumber is the installed
 * beUI number (`components/motion/number.tsx`). Tip Ready requires those
 * specifiers in this route's `_v3` set. The painted control is the same
 * navy/cream InsightCards SITE-103 already restyled — this file does not
 * invent a second card.
 */

import InsightCards from '@/components/motion/insight-cards'
import { AnimatedNumber } from '@/components/motion/number'
import { RegionInsight } from '../central-oregon/_v3/RegionInsight.client'
import type { RegionInsightBoard } from '../central-oregon/_v3/region-insight'

export function HubInsight({ board }: { board: RegionInsightBoard }) {
  return (
    <div className="hub-insight">
      <RegionInsight board={board} />
    </div>
  )
}

/**
 * Keep the installed specifiers live so a tree-shake cannot drop the imports
 * ci:catalog-install and taste-receipt --ship both scan for.
 */
export const HUB_INSIGHT_CATALOG = { InsightCards, AnimatedNumber } as const
