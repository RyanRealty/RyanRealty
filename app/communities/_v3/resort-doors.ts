/**
 * Quiet doors for the resort registry. One list, read from
 * data/resort-communities.json through getAllResortCommunities. Not a
 * second hardcoded fourteen.
 */

import type { V3QuietItem } from '@/components/site/v3'
import { getAllResortCommunities } from '@/lib/data/communities/registry'

export function resortQuietItems(): V3QuietItem[] {
  const resorts = getAllResortCommunities()
  const doors: V3QuietItem[] = []
  for (const entry of resorts) {
    const name = entry.label.trim()
    const slug = entry.slug.trim()
    if (!name || !slug) continue
    const city = entry.city.trim()
    doors.push({
      label: city ? `${name}, ${city}` : name,
      href: `/communities/${slug}`,
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
