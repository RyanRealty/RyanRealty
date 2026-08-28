/**
 * Buyer-facing on-the-ground and school rows. Registry data only. Nothing here
 * fetches. A missing registry row is omitted, never invented.
 */
import type { V3QuietItem } from '@/components/site/v3'
import { CO_PARKS } from '@/data/co-parks'
import { CO_SCHOOLS } from '@/data/co-schools'
import { GOLF_COURSES } from '@/data/golf/courses'
import type { CityQuickFacts } from '@/lib/cities'

function sameCity(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

export function cityGroundItems(
  cityName: string,
  facts: CityQuickFacts | null,
): V3QuietItem[] {
  const items: V3QuietItem[] = []
  const airport = facts?.nearestAirport?.trim()
  if (airport) items.push({ kind: 'prose', term: 'Airport', body: airport })

  const courses = GOLF_COURSES.filter((course) => sameCity(course.city, cityName))
  if (courses.length === 1) {
    items.push({ kind: 'prose', term: 'Golf', body: courses[0]!.name })
  } else if (courses.length > 1) {
    items.push({
      kind: 'prose',
      term: 'Golf',
      body: courses.map((course) => course.name).join(', '),
    })
  }

  const inCityParks = CO_PARKS.filter((park) => sameCity(park.city, cityName))
  for (const park of inCityParks.slice(0, 3)) {
    items.push({ kind: 'prose', term: park.type === 'state' ? 'Park' : 'In town', body: park.name })
  }

  // Smith Rock sits in Terrebonne. Redmond buyers use it. The registry names
  // the park; this page does not claim it as a Redmond district.
  if (sameCity(cityName, 'Redmond')) {
    const smith = CO_PARKS.find((park) => park.slug === 'smith-rock')
    if (smith) items.push({ kind: 'prose', term: 'Nearby', body: smith.name })
  }

  return items
}

export function citySchoolItems(cityName: string): V3QuietItem[] {
  const schools = CO_SCHOOLS.filter((school) => sameCity(school.city, cityName))
  const order = ['high', 'middle', 'elementary'] as const
  const items: V3QuietItem[] = []
  for (const level of order) {
    const names = schools
      .filter((school) => school.level === level)
      .map((school) => school.name)
    if (names.length === 0) continue
    const term = level === 'high' ? 'High' : level === 'middle' ? 'Middle' : 'Elementary'
    items.push({ kind: 'prose', term, body: names.join(', ') })
  }
  const district = schools[0]?.district
  if (district) items.push({ kind: 'prose', term: 'District', body: district })
  return items
}
