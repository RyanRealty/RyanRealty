/**
 * The course a community page draws.
 *
 * A resort can own more than one course (Sunriver three, Eagle Crest three,
 * Black Butte two) and a course map runs the height of the property, so the page
 * shows one and links the rest through the exits it already carries.
 *
 * It shows the most complete map, not the first one listed. Black Butte Ranch is
 * the case that forced this: Big Meadow comes first in the registry but has no
 * hole routings in OSM at all, so its numbers mark greens and no hole prints a
 * length, while Glaze Meadow next to it is routed and misses one hole. Ranking
 * on what the file actually contains keeps that decision out of the registry's
 * ordering, where it would be invisible.
 */
import { GOLF_COURSES, type GolfCourse } from '@/data/golf/courses'
import { getCourseMap, hasCourseMap } from './course-map-registry'
import type { CourseMapData } from './course-map'

export type CommunityCourseMap = { course: GolfCourse; map: CourseMapData }

/**
 * Lower is better: routed beats green-anchored, then fewer absent holes.
 * An operator plate with no OSM routing ranks last so a resort that already
 * has a surveyed eighteen (Pronghorn Nicklaus, Eagle Crest Ridge) keeps it.
 */
export function courseMapRank(map: CourseMapData): number {
  if (map.plate && map.holes.length === 0) return 1000
  return (map.anchor === 'green' ? 100 : 0) + (map.missingHoles?.length ?? 0)
}

export function communityCourses(communitySlug: string): GolfCourse[] {
  return GOLF_COURSES.filter((c) => c.communitySlug === communitySlug && hasCourseMap(c.slug))
}

export async function getCommunityCourseMap(
  communitySlug: string | null | undefined,
): Promise<CommunityCourseMap | null> {
  if (!communitySlug) return null
  let best: CommunityCourseMap | null = null
  for (const course of communityCourses(communitySlug)) {
    const map = await getCourseMap(course.slug)
    if (!map) continue
    if (!best || courseMapRank(map) < courseMapRank(best.map)) best = { course, map }
  }
  return best
}
