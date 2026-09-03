/**
 * Which courses have a map, and how the page gets one.
 *
 * The files are committed geometry (data/golf/course-maps/), not a query, so
 * this is a lazy import keyed by the registry slug. Only the course the visitor
 * asked for is loaded; a course with no file renders the rest of its page
 * unchanged.
 *
 * Sixteen of the registry's twenty-six courses have a file. The ten that do not
 * are held by scripts/golf/build-course-maps.mjs, which will not write a course
 * missing more than a quarter of its holes, and by OpenStreetMap, which has no
 * hole geometry for the rest: Quail Run and River's Edge have a boundary and
 * nothing inside it; Pronghorn's two courses, Brasada Canyons, Broken Top,
 * Awbrey Glen, the Eagle Crest Challenge course, The Greens at Redmond and
 * Desert Peaks have no course polygon carrying golf features at all.
 */
import type { CourseMapData } from './course-map'

type Loader = () => Promise<{ default: unknown }>

const COURSE_MAPS: Record<string, Loader> = {
  'aspen-lakes': () => import('@/data/golf/course-maps/aspen-lakes.json'),
  'bend-golf-club': () => import('@/data/golf/course-maps/bend-golf-country-club.json'),
  'black-butte-big-meadow': () => import('@/data/golf/course-maps/black-butte-big-meadow.json'),
  'black-butte-glaze-meadow': () => import('@/data/golf/course-maps/black-butte-glaze-meadow.json'),
  'caldera-links': () => import('@/data/golf/course-maps/caldera-links.json'),
  'crooked-river-ranch': () => import('@/data/golf/course-maps/crooked-river-ranch.json'),
  crosswater: () => import('@/data/golf/course-maps/crosswater.json'),
  'eagle-crest-resort': () => import('@/data/golf/course-maps/eagle-crest-resort.json'),
  'eagle-crest-ridge': () => import('@/data/golf/course-maps/eagle-crest-ridge.json'),
  juniper: () => import('@/data/golf/course-maps/juniper.json'),
  'lost-tracks': () => import('@/data/golf/course-maps/lost-tracks.json'),
  'meadow-lakes': () => import('@/data/golf/course-maps/meadow-lakes.json'),
  'sunriver-meadows': () => import('@/data/golf/course-maps/sunriver-meadows.json'),
  'sunriver-woodlands': () => import('@/data/golf/course-maps/sunriver-woodlands.json'),
  'tetherow-golf-club': () => import('@/data/golf/course-maps/tetherow.json'),
  'widgi-creek': () => import('@/data/golf/course-maps/widgi-creek.json'),
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
