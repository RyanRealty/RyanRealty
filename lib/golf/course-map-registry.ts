/**
 * Which courses have a map, and how the page gets one.
 *
 * The files are committed geometry (data/golf/course-maps/), not a query, so
 * this is a lazy import keyed by the registry slug. Only the course the visitor
 * asked for is loaded; a course with no file renders the rest of its page
 * unchanged.
 *
 * All twenty-six registry courses have a file. Twenty-one are OSM routings.
 * The five that are not were checked twice by two differently shaped queries
 * (region-golf-holes.json, unclipped bbox dumps, live Overpass) and still have
 * no honest numbered 18 or 9, so they ship the club's own published scorecard
 * or layout as a raster plate — sourced, not a survey. hasCourseMap is true
 * when the file has holes or a plate.
 *
 * The first version of this comment reported an absence that was not there. It
 * said OpenStreetMap had no hole geometry for ten courses. What was true is
 * that a fetch clipping every feature to a named `leisure=golf_course` polygon
 * could not SEE their holes: half the region's 363 `golf=hole` ways sit inside
 * no such polygon. Broken Top, Brasada Canyons and Pronghorn Nicklaus each
 * carry a complete, numbered eighteen and are built from their own hole
 * cluster instead.
 *
 * Pronghorn Nicklaus is named from the operator scorecard (PRH-SC.pdf, titled
 * NICKLAUS COURSE, TIPS 7,379 yards) whose per-hole par sequence matches the
 * OSM tags on this cluster and the USGA row (CourseID 5779). Measured routings
 * run ~8% under the card, so per-hole yardage is held; the drawing is not.
 *
 * Two of the twenty-one carry no hole numbers. Awbrey Glen and Quail Run each
 * have eighteen `golf=hole` ways and exactly one tag on every feature — `golf`
 * — so their routings draw, select and describe themselves, and nothing on the
 * page prints a hole number. A routing order could be reconstructed by chaining
 * each green to the nearest next tee; where hole 1 starts and where the turn
 * falls would be a guess, and a number on a map is a claim.
 *
 * The five plates (2026-09-04). OSM still has no numbered second 18 at
 * Pronghorn, no hole/green/tee at River's Edge or Desert Peaks, eight nearby
 * holes at The Greens that already ship as Juniper, and Challenge holes 12–14
 * that match the Resort card (14 is par 4; Challenge's 14 is par 3). Leftover
 * untagged ways on the Nicklaus west edge are not named Fazio and are not
 * numbered here. Old Back Nine still has no row in data/golf/courses.ts.
 */
import type { CourseMapData } from './course-map'

type Loader = () => Promise<{ default: unknown }>

const COURSE_MAPS: Record<string, Loader> = {
  'aspen-lakes': () => import('@/data/golf/course-maps/aspen-lakes.json'),
  'awbrey-glen': () => import('@/data/golf/course-maps/awbrey-glen.json'),
  'bend-golf-club': () => import('@/data/golf/course-maps/bend-golf-country-club.json'),
  'black-butte-big-meadow': () => import('@/data/golf/course-maps/black-butte-big-meadow.json'),
  'brasada-canyons': () => import('@/data/golf/course-maps/brasada-canyons.json'),
  'broken-top-club': () => import('@/data/golf/course-maps/broken-top.json'),
  'black-butte-glaze-meadow': () => import('@/data/golf/course-maps/black-butte-glaze-meadow.json'),
  'caldera-links': () => import('@/data/golf/course-maps/caldera-links.json'),
  'crooked-river-ranch': () => import('@/data/golf/course-maps/crooked-river-ranch.json'),
  crosswater: () => import('@/data/golf/course-maps/crosswater.json'),
  'desert-peaks': () => import('@/data/golf/course-maps/desert-peaks.json'),
  'eagle-crest-challenge': () => import('@/data/golf/course-maps/eagle-crest-challenge.json'),
  'eagle-crest-resort': () => import('@/data/golf/course-maps/eagle-crest-resort.json'),
  'eagle-crest-ridge': () => import('@/data/golf/course-maps/eagle-crest-ridge.json'),
  'greens-at-redmond': () => import('@/data/golf/course-maps/greens-at-redmond.json'),
  juniper: () => import('@/data/golf/course-maps/juniper.json'),
  'lost-tracks': () => import('@/data/golf/course-maps/lost-tracks.json'),
  'meadow-lakes': () => import('@/data/golf/course-maps/meadow-lakes.json'),
  'pronghorn-fazio': () => import('@/data/golf/course-maps/pronghorn-fazio.json'),
  'pronghorn-nicklaus': () => import('@/data/golf/course-maps/pronghorn.json'),
  'quail-run': () => import('@/data/golf/course-maps/quail-run.json'),
  'rivers-edge': () => import('@/data/golf/course-maps/rivers-edge.json'),
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
