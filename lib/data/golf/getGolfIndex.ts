/**
 * getGolfIndex — the Central Oregon golf registry, ordered for the hub.
 *
 * Pure registry read (data/golf/courses.ts) — no DB query, the same shape as
 * getTrailsForIndex. The hub at /central-oregon/golf lists every course, each
 * one linking to its own /central-oregon/golf/[slug] page. ONE registry: the
 * hub, the 26 detail pages, and /lp/central-oregon-golf all read this file, so
 * a corrected figure lands everywhere at once.
 *
 * CLAUDE.md §0: holes, par, and yardsBackTees carry a named source
 * (USGA National Course Rating Database, verified per course 2026-08-26,
 * recorded in data/golf/SOURCES.md). Nothing is computed or estimated here.
 *
 * Lives behind the DAL boundary so pages import from @/lib/data only (Gate G8).
 */

import { GOLF_COURSES, type GolfCourse } from '@/data/golf/courses'
import { displayCity } from '@/lib/golf-format'

/**
 * Every course, sorted by city then course name, so the hub reads as a place
 * list. Registry order is curated for the LP's destination-8 callout, which is
 * a different job; sorting here does not touch it.
 */
export function getGolfCoursesForIndex(): GolfCourse[] {
  return [...GOLF_COURSES].sort(
    (a, b) => displayCity(a.city).localeCompare(displayCity(b.city)) || a.name.localeCompare(b.name),
  )
}

/** Total courses in the registry (the hub caption). */
export function getGolfCourseCount(): number {
  return GOLF_COURSES.length
}
