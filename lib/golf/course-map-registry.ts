/**
 * Which courses have a map, and how the page gets one.
 *
 * The files are committed geometry (data/golf/course-maps/), not a query, so
 * this is a lazy import keyed by the registry slug rather than a fetch. Only the
 * course the visitor asked for is loaded, and a course with no file renders the
 * rest of its page unchanged — the absence is the honest state, not a hole.
 *
 * A course earns a file by mapping every one of its published holes; see the
 * refusals in scripts/golf/build-course-maps.mjs. Sunriver Woodlands maps 17 of
 * 18 and so is deliberately not here.
 */
import type { CourseMapData } from './course-map'

type Loader = () => Promise<{ default: unknown }>

const COURSE_MAPS: Record<string, Loader> = {
  'tetherow-golf-club': () => import('@/data/golf/course-maps/tetherow.json'),
  crosswater: () => import('@/data/golf/course-maps/crosswater.json'),
  'sunriver-meadows': () => import('@/data/golf/course-maps/sunriver-meadows.json'),
}

export function hasCourseMap(courseSlug: string): boolean {
  return courseSlug in COURSE_MAPS
}

export async function getCourseMap(courseSlug: string): Promise<CourseMapData | null> {
  const load = COURSE_MAPS[courseSlug]
  if (!load) return null
  const mod = await load()
  return mod.default as CourseMapData
}
