/**
 * Peer neighborhoods for the exploration loop (Bend GIS districts).
 */

import { getBendNeighborhoodLedger } from '@/lib/data/geo/getBendNeighborhoodLedger'
import type { KbTownItem } from '@/lib/kb/types'
import { cityHero } from '@/lib/geo-images'

export async function peerNeighborhoodTowns(
  citySlug: string,
  selfNeighborhoodSlug: string,
): Promise<KbTownItem[]> {
  if (citySlug !== 'bend') return []
  const rows = await getBendNeighborhoodLedger()
  return rows
    .filter((r) => !r.href.endsWith(`/${selfNeighborhoodSlug}`))
    .slice(0, 12)
    .map((r) => ({
      name: r.label,
      href: r.href,
      activeCount: r.activeCount,
      medianPrice: r.medianListPrice,
      img: cityHero('bend').src,
    }))
}
