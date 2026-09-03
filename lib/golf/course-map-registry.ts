/**
 * Which courses have a map, and how the page gets one.
 *
 * The files are committed geometry (data/golf/course-maps/), not a query, so
 * this is a lazy import keyed by the registry slug. Only the course the visitor
 * asked for is loaded; a course with no file renders the rest of its page
 * unchanged.
 *
 * Eighteen of the registry's twenty-six courses have a file. Each of the eight
 * that do not was checked twice, by two differently shaped queries, because the
 * first version of this comment reported an absence that was not there. It said
 * OpenStreetMap had no hole geometry for ten courses. What was true is that a
 * fetch clipping every feature to a named `leisure=golf_course` polygon could
 * not SEE their holes: half the region's 363 `golf=hole` ways sit inside no such
 * polygon. Broken Top and Brasada Canyons each carry a complete, numbered
 * eighteen and are now built from their own hole cluster instead.
 *
 * What is actually missing, and what each is missing:
 *   - Pronghorn Nicklaus, Pronghorn Fazio — one complete numbered eighteen on
 *     the property, par summing to 72. Both courses are par 72, at 7,379 and
 *     7,456 yards, and nothing in the tags says which one is mapped. The
 *     measured routings run 8-9% under both cards, so length cannot separate
 *     them either. A course map has to name its course.
 *   - Quail Run, Awbrey Glen — eighteen routings each, inside their own extent,
 *     and not one `ref` tag among them. The holes are drawn; their numbers are
 *     not recorded. Every hole card, the scorecard rail and the tap discs are
 *     hole NUMBERS.
 *   - River's Edge — its polygon contains zero golf features. Checked again by
 *     distance rather than containment: still zero.
 *   - The Greens at Redmond — one clubhouse building and nothing else within
 *     three kilometres of it.
 *   - Desert Peaks — zero golf features within three kilometres of its own
 *     polygon's centroid.
 *   - Eagle Crest Challenge — three holes, numbered 12, 13 and 14. Below the
 *     quarter-missing floor in build-course-maps.mjs.
 *   - Old Back Nine — nine unnumbered routings, and no row in
 *     data/golf/courses.ts to check them against.
 */
import type { CourseMapData } from './course-map'

type Loader = () => Promise<{ default: unknown }>

const COURSE_MAPS: Record<string, Loader> = {
  'aspen-lakes': () => import('@/data/golf/course-maps/aspen-lakes.json'),
  'bend-golf-club': () => import('@/data/golf/course-maps/bend-golf-country-club.json'),
  'black-butte-big-meadow': () => import('@/data/golf/course-maps/black-butte-big-meadow.json'),
  'brasada-canyons': () => import('@/data/golf/course-maps/brasada-canyons.json'),
  'broken-top-club': () => import('@/data/golf/course-maps/broken-top.json'),
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
