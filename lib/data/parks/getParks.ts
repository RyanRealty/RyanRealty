/**
 * getParks — the Central Oregon parks registry, grouped for the index page.
 *
 * Pure registry read (data/co-parks.ts) — no DB query. The index page shows
 * every verified park grouped by city, ordered by park count (largest first).
 *
 * Lives behind the DAL boundary so pages import from @/lib/data only (Gate G8).
 */

import { CO_PARKS, type CoPark } from '@/data/co-parks'

export type ParkCityGroup = {
  city: string
  parks: CoPark[]
}

/**
 * Return the registry grouped by city, each city's parks ordered state parks
 * first (by descending acreage) then city parks (by name). Cities are ordered
 * by total park count, largest first, with Bend leading.
 */
export function getParks(): ParkCityGroup[] {
  const groups = new Map<string, ParkCityGroup>()

  for (const park of CO_PARKS) {
    let group = groups.get(park.city)
    if (!group) {
      group = { city: park.city, parks: [] }
      groups.set(park.city, group)
    }
    group.parks.push(park)
  }

  const typeRank = (p: CoPark) => (p.type === 'state' ? 0 : p.type === 'natural-area' ? 1 : 2)
  for (const group of groups.values()) {
    group.parks.sort((a, b) => {
      const t = typeRank(a) - typeRank(b)
      if (t !== 0) return t
      const acr = (b.acres ?? 0) - (a.acres ?? 0)
      if (acr !== 0) return acr
      return a.name.localeCompare(b.name)
    })
  }

  return [...groups.values()].sort((a, b) => b.parks.length - a.parks.length)
}

/** Total count of parks in the registry (for the index intro). */
export function getParksCount(): number {
  return CO_PARKS.length
}
