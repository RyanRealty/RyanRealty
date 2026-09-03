/**
 * The course a community page draws.
 *
 * A resort can own more than one course — Sunriver has three, Eagle Crest two —
 * and a course map runs the height of the property, so the page shows ONE and
 * links the rest through the exits it already carries. The one it shows is the
 * first course the registry lists for that community which has a map at all,
 * which keeps the choice in data/golf/courses.ts rather than here.
 */
import { GOLF_COURSES, type GolfCourse } from '@/data/golf/courses'
import { getCourseMap, hasCourseMap } from './course-map-registry'
import type { CourseMapData } from './course-map'

export function communityCourse(communitySlug: string): GolfCourse | null {
  return GOLF_COURSES.find((c) => c.communitySlug === communitySlug && hasCourseMap(c.slug)) ?? null
}

export type CommunityCourseMap = { course: GolfCourse; map: CourseMapData }

export async function getCommunityCourseMap(
  communitySlug: string | null | undefined,
): Promise<CommunityCourseMap | null> {
  if (!communitySlug) return null
  const course = communityCourse(communitySlug)
  if (!course) return null
  const map = await getCourseMap(course.slug)
  return map ? { course, map } : null
}
