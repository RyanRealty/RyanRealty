/**
 * Peer neighborhoods for the exploration loop (Bend GIS districts).
 */

import { getNeighborhoodDirectory } from '@/lib/data'
import { getBendNeighborhoodLedger } from '@/lib/data/geo/getBendNeighborhoodLedger'
import type { KbTownItem } from '@/lib/kb/types'
import { preferPlaceHero } from '@/lib/geo-images'

export async function peerNeighborhoodTowns(
  citySlug: string,
  selfNeighborhoodSlug: string,
): Promise<KbTownItem[]> {
  if (citySlug !== 'bend') return []
  const [rows, directory] = await Promise.all([getBendNeighborhoodLedger(), getNeighborhoodDirectory()])
  const heroBySlug = new Map(directory.map((d) => [d.neighborhoodSlug, d.heroImageUrl]))
  return rows
    .filter((r) => !r.href.endsWith(`/${selfNeighborhoodSlug}`))
    .slice(0, 12)
    .map((r) => {
      const slug = r.href.split('/').filter(Boolean).at(-1) ?? ''
      return {
        name: r.label,
        href: r.href,
        activeCount: r.activeCount,
        medianPrice: r.medianListPrice,
        img: preferPlaceHero(heroBySlug.get(slug), ''),
      }
    })
}
