/**
 * Homepage Stage inventory strip from the same pulse read #right-now uses.
 * Two or three live counts so the first viewport opens on data, not a stock
 * search-hero. Withheld entirely when fewer than two figures survive (§0).
 */
import { formatCount } from '@/lib/format/count'
import { publishRegionalSearchHref } from '@/lib/search/publish-regional-search-href'
import type { V3StageInventory } from '@/components/site/v3'
import type { HomePulseCounts } from './home-pulse'
import { HOME_PULSE_ID } from './home-pulse'

const TRACE = 'live MLS through Oregon Data Share · Central Oregon'

export type HomeHeroLive = {
  forSale: number
  forSaleLabel: string
}

/**
 * @returns Stage `inventory` when at least two counts are honest, else undefined.
 */
export function homeHeroInventory(
  counts: HomePulseCounts | null | undefined,
  stamp?: string | null,
): V3StageInventory | undefined {
  if (!counts) return undefined
  const figures: V3StageInventory['figures'] = []

  if (counts.forSale > 0) {
    figures.push({
      value: formatCount(counts.forSale),
      // Short labels: the Stage band columns are narrow; a long phrase wraps
      // into three ragged lines at 1440 (SITE-83 shots).
      label: 'you can tour today',
      href: publishRegionalSearchHref(),
    })
  }
  if (counts.pending > 0) {
    figures.push({
      value: formatCount(counts.pending),
      label: 'already spoken for',
      href: `/#${HOME_PULSE_ID}`,
    })
  }
  if (counts.sold > 0) {
    figures.push({
      value: formatCount(counts.sold),
      label: 'closed this month',
      href: '/homes-for-sale?view=list&status=Sold',
    })
  }

  if (figures.length < 2) return undefined
  return {
    figures,
    source: TRACE,
    updatedAt: stamp ?? null,
  }
}

/** Compact live chip for the search control (animated via V3Number). */
export function homeHeroLive(
  counts: HomePulseCounts | null | undefined,
): HomeHeroLive | undefined {
  if (!counts || counts.forSale <= 0) return undefined
  return {
    forSale: counts.forSale,
    forSaleLabel: formatCount(counts.forSale),
  }
}
