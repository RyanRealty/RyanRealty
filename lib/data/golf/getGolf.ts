/**
 * getGolf — the Central Oregon golf courses registry, grouped for the hub.
 *
 * Pure registry read (data/co-golf.ts) — no DB query. The hub lists courses by
 * access (public + resort first, then semi-private, then private), each linking
 * to its detail page. All data is verified + cited (CLAUDE.md §0).
 *
 * Lives behind the DAL boundary so pages import from @/lib/data only (Gate G8).
 */

import { CO_GOLF_COURSES, type CoGolfCourse } from '@/data/co-golf'

export type GolfIndex = {
  /** Publicly playable (public + resort + semi-private), by city then name. */
  playable: CoGolfCourse[]
  /** Private members-only clubs, by city then name. */
  private: CoGolfCourse[]
}

export function getGolfForIndex(): GolfIndex {
  const byCityName = (a: CoGolfCourse, b: CoGolfCourse) =>
    a.city.localeCompare(b.city) || a.name.localeCompare(b.name)
  return {
    playable: CO_GOLF_COURSES.filter((c) => c.access !== 'private').sort(byCityName),
    private: CO_GOLF_COURSES.filter((c) => c.access === 'private').sort(byCityName),
  }
}

/** Total count of courses in the registry (for the hub intro). */
export function getGolfCount(): number {
  return CO_GOLF_COURSES.length
}
