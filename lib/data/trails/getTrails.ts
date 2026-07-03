/**
 * getTrails — the Central Oregon trails registry, grouped for the hub.
 *
 * Pure registry read (data/co-trails.ts) — no DB query. The hub lists trails by
 * use (hiking, then mountain biking; a both-use trail appears in each), every
 * one linking to its detail page. All data is verified + cited (CLAUDE.md §0).
 *
 * Lives behind the DAL boundary so pages import from @/lib/data only (Gate G8).
 */

import { CO_TRAILS, type CoTrail } from '@/data/co-trails'

export type TrailIndex = {
  /** Trails you can hike (use 'hike' or 'both'), by city then name. */
  hiking: CoTrail[]
  /** Trails you can ride (use 'mtb' or 'both'), by city then name. */
  biking: CoTrail[]
}

export function getTrailsForIndex(): TrailIndex {
  const byCityName = (a: CoTrail, b: CoTrail) =>
    a.city.localeCompare(b.city) || a.name.localeCompare(b.name)
  return {
    hiking: CO_TRAILS.filter((t) => t.use !== 'mtb').sort(byCityName),
    biking: CO_TRAILS.filter((t) => t.use !== 'hike').sort(byCityName),
  }
}

/** Total count of trails in the registry (for the hub intro). */
export function getTrailsCount(): number {
  return CO_TRAILS.length
}
