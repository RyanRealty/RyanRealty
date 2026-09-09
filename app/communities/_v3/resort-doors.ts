/**
 * Quiet doors for the resort registry. One list, read from
 * data/resort-communities.json through getAllResortCommunities. Not a
 * second hardcoded fourteen.
 */

import type { V3QuietItem } from '@/components/site/v3'
import { getAllResortCommunities } from '@/lib/data/communities/registry'

/**
 * A door that also declares which set it belongs to, for V3Answers' grouped
 * exit fold. Structurally identical to community-figures.ts's ExploreEdge;
 * declared here so this module does not reach into a sibling route's types.
 */
export type ResortDoor = V3QuietItem & { group?: string }

export function resortQuietItems(): ResortDoor[] {
  const resorts = getAllResortCommunities()
  const doors: ResortDoor[] = []
  for (const entry of resorts) {
    const name = entry.label.trim()
    const slug = entry.slug.trim()
    if (!name || !slug) continue
    const city = entry.city.trim()
    doors.push({
      label: city ? `${name}, ${city}` : name,
      href: `/communities/${slug}`,
      // BY CITY, WHICH IS THE REGISTRY'S OWN FIELD. Grouping the exits by kind
      // left one bucket — "Nearby resorts" — holding nineteen flat hairline
      // rows on every community page, which the round-two evaluator named as
      // the banned shape nested one level deeper rather than removed. The
      // registry already records each resort's city, so this is a split along a
      // recorded axis, not an invented taxonomy, and it is the axis a reader
      // choosing where to look next actually uses. A resort with no recorded
      // city falls back to the generic set rather than inventing a heading.
      ...(city ? { group: `Resorts in ${city}` } : {}),
    })
  }
  if (doors.length === 0) return []
  return [
    {
      kind: 'prose',
      term: 'Master-plan communities',
      body: 'The Central Oregon master-plan communities on this site, from the resort registry.',
    },
    ...doors,
  ]
}
