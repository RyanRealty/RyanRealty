/**
 * Which courses have a map, and how the page gets one.
 *
 * The files are committed geometry (data/golf/course-maps/), not a query, so
 * this is a lazy import keyed by the registry slug. Only the course the visitor
 * asked for is loaded; a course with no file renders the rest of its page
 * unchanged.
 *
 * A course earns a file by mapping its published holes, less at most one in
 * eighteen; see the refusals in scripts/golf/build-course-maps.mjs. Woodlands,
 * Widgi Creek and Glaze Meadow are each missing one hole and say so on the page.
 * Caldera Links (8 of 9), Eagle Crest Resort (14 of 18), Lost Tracks (15 of 18),
 * Big Meadow, Quail Run and River's Edge are refused.
 */
import type { CourseMapData } from './course-map'

type Loader = () => Promise<{ default: unknown }>

const COURSE_MAPS: Record<string, Loader> = {
  'tetherow-golf-club': () => import('@/data/golf/course-maps/tetherow.json'),
  crosswater: () => import('@/data/golf/course-maps/crosswater.json'),
  'sunriver-meadows': () => import('@/data/golf/course-maps/sunriver-meadows.json'),
  'eagle-crest-ridge': () => import('@/data/golf/course-maps/eagle-crest-ridge.json'),
  'aspen-lakes': () => import('@/data/golf/course-maps/aspen-lakes.json'),
  juniper: () => import('@/data/golf/course-maps/juniper.json'),
  'bend-golf-club': () => import('@/data/golf/course-maps/bend-golf-country-club.json'),
  'widgi-creek': () => import('@/data/golf/course-maps/widgi-creek.json'),
  'sunriver-woodlands': () => import('@/data/golf/course-maps/sunriver-woodlands.json'),
  'black-butte-glaze-meadow': () => import('@/data/golf/course-maps/black-butte-glaze-meadow.json'),
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
