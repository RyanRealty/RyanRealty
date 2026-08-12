/**
 * The plat node's outbound edges, which the closing Quiet block renders.
 *
 * PUBLIC_UI.md pattern 6 defines Quiet as the block that carries the graph's
 * outbound edges. Three KB sections used to carry them (LifestyleNearSection,
 * PlaceParentsSection, KbExploreTowns) and every link all three held is here.
 *
 * DEDUPED BY DESTINATION. A resort plat reaches its community through
 * placeContext.parents AND through its own registry entry, so without the seen
 * set the same door renders twice under two labels.
 *
 * THE ONE FIGURE IN THIS BLOCK IS TRACED. Quiet carries no source line, so the
 * distances on the lifestyle rows are introduced by a prose item that states
 * what they measure and where the places come from, immediately above them.
 */

import type { V3QuietItem } from '@/components/site/v3'
import type { PlaceContext } from '@/lib/data/geo/resolvePlaceContext'
import type { LifestyleNearItem } from '@/lib/explore/lifestyle-near'

export type EdgeInput = {
  displayName: string
  cityName: string
  citySlug: string | null
  resortLabel: string | null
  resortSlug: string | null
  placeContext: PlaceContext
  lifestyleItems: readonly LifestyleNearItem[]
  peerPlats: ReadonlyArray<{ name: string; href: string }>
  /** Where "every home for sale here" goes, built by the page from lib/slug. */
  browseHref: string
}

function milesLabel(distanceMiles: number): string {
  return distanceMiles < 10
    ? `${distanceMiles.toFixed(1)} mi`
    : `${Math.round(distanceMiles)} mi`
}

export function buildSubdivisionEdges(input: EdgeInput): V3QuietItem[] {
  const {
    displayName,
    cityName,
    citySlug,
    resortLabel,
    resortSlug,
    placeContext,
    lifestyleItems,
    peerPlats,
    browseHref,
  } = input

  const seen = new Set<string>()
  const edges: V3QuietItem[] = []
  const push = (label: string, href: string) => {
    if (label.trim().length === 0) return
    if (href.trim().length === 0) return
    if (seen.has(href)) return
    seen.add(href)
    edges.push({ label, href })
  }

  if (lifestyleItems.length > 0) {
    edges.push({
      kind: 'prose',
      term: 'Parks, trails, and golf nearby',
      body:
        `Straight-line distance from the middle of the listings recorded in ${displayName}, ` +
        `measured against the curated Central Oregon parks, trails, and golf registry.`,
    })
    for (const item of lifestyleItems) push(`${item.name} · ${milesLabel(item.distanceMiles)}`, item.href)
  }

  for (const parent of placeContext.parents) push(parent.label, parent.href)
  if (resortSlug && resortLabel) push(`${resortLabel} community`, `/communities/${resortSlug}`)
  if (citySlug && cityName !== 'Central Oregon') push(`${cityName} homes`, `/cities/${citySlug}`)

  if (peerPlats.length > 0) {
    edges.push({
      kind: 'prose',
      term: `Other plats in ${resortLabel ?? 'this community'}`,
      body: 'Each one is recorded under its own MLS subdivision name.',
    })
    for (const peer of peerPlats) push(peer.name, peer.href)
  }

  push(`Every ${displayName} home for sale`, browseHref)
  push('All Central Oregon communities', '/communities')
  push('All Central Oregon cities', '/cities')
  push('Sell your home', '/sell')
  push('Oregon Data Share', 'https://www.oregondatashare.com')

  return edges
}
