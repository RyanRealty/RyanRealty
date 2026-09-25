/**
 * Daily-life doors for the neighborhood grain: schools, then parks that have
 * their own page. Amenities and membership stay off this list.
 *
 * SCHOOLS ARE THE COUNTY ATTENDANCE AREAS (Matt 2026-09-24). The rows used to
 * come from the school names in the authored neighborhood file, and in three
 * of thirteen neighborhoods a listed school was not among the Deschutes County
 * attendance areas covering the neighborhood (5% floor, measured 2026-09-25):
 * Southeast Bend listed Lava Ridge Elementary (its areas are R E Jewell and
 * Silver Rail), Southern Crossing listed Caldera High (Bend Senior and Summit)
 * and River West listed Highland School at Kenwood, which has no attendance
 * area (River West's are High Lakes and William E Miller). The rows now come
 * from getPlaceSchools, the same attendance
 * polygons the community pages print and the FAQ answers from, so the
 * section, the answer and the FAQPage markup name the same schools.
 *
 * A park that can only open /parks is not a named park: omit it rather than
 * invent a slug.
 */

import { v3Text, type V3LedgerPlainRow } from '@/components/site/v3'
import { CO_PARKS } from '@/data/co-parks'
import type { PlaceSchool } from '@/lib/data'
import type { ResortCommunityContent } from '@/lib/resort-community-content'
import { parkDepthLine } from '@/lib/site/place-recreation'

/** The line under the section: what each kind of row is. */
export const NEIGHBORHOOD_SCHOOLS_TRACE =
  'Schools are the Deschutes County attendance areas that cover this neighborhood.'
export const NEIGHBORHOOD_DAILY_PARKS_TRACE =
  "Parks are the ones this neighborhood's own write-up names, each with a page of its own."

const SCHOOL_LEVEL_LABEL: Record<PlaceSchool['level'], string> = {
  elementary: 'Elementary',
  middle: 'Middle school',
  high: 'High school',
}

function resolvePark(name: string) {
  const needle = name.trim().toLowerCase()
  if (!needle) return undefined
  return CO_PARKS.find((park) => park.name.trim().toLowerCase() === needle)
}

export type DailyLifeRows = {
  /** The attendance schools, elementary then middle then high. */
  schools: V3LedgerPlainRow[]
  /** The parks the authored write-up names, when each has a page. */
  parks: V3LedgerPlainRow[]
}

export function dailyLifeRows(
  content: ResortCommunityContent | null,
  _cityName: string,
  placeSchools: readonly PlaceSchool[] = [],
): DailyLifeRows {
  const seen = new Set<string>()
  const schools: V3LedgerPlainRow[] = []
  const parks: V3LedgerPlainRow[] = []

  // Already ordered elementary, middle, high, and by share inside a level.
  for (const school of placeSchools) {
    const slug = school.slug?.trim()
    const name = school.name?.trim()
    const level = SCHOOL_LEVEL_LABEL[school.level]
    if (!slug || !name || !level || seen.has(slug)) continue
    seen.add(slug)
    schools.push({
      href: `/schools/${slug}`,
      when: v3Text(level),
      what: v3Text(name),
      id: `school-${slug}`,
    })
  }

  for (const amenity of content?.amenities ?? []) {
    if (amenity.category?.trim() !== 'Parks') continue
    const name = amenity.name?.trim()
    if (!name) continue
    const park = resolvePark(name)
    if (!park || seen.has(`park:${park.slug}`)) continue
    seen.add(`park:${park.slug}`)
    const access = amenity.access?.trim()
    const depth = parkDepthLine(park)
    parks.push({
      href: `/parks/${park.slug}`,
      when: v3Text('Park'),
      what: v3Text(park.name),
      detail: access ? v3Text(access) : depth ? v3Text(depth) : undefined,
      id: `park-${park.slug}`,
    })
  }

  return { schools, parks }
}

/**
 * The daily-life section, or nothing. It opens on schools, so it renders only
 * when the attendance read returned some: a timed-out read drops the section
 * and leaves its parks to the page's own Parks section, rather than printing
 * a second "Parks" section above that one. The heading and the source line
 * name both kinds of row when both are there.
 */
export function dailyLifeSection(rows: DailyLifeRows): {
  heading: string
  source: string
  rows: [V3LedgerPlainRow, ...V3LedgerPlainRow[]]
} | null {
  const [first, ...rest] = [...rows.schools, ...rows.parks]
  if (rows.schools.length === 0 || !first) return null
  const withParks = rows.parks.length > 0
  return {
    heading: withParks ? 'Schools and parks' : 'Schools',
    source: withParks
      ? `${NEIGHBORHOOD_SCHOOLS_TRACE} ${NEIGHBORHOOD_DAILY_PARKS_TRACE}`
      : NEIGHBORHOOD_SCHOOLS_TRACE,
    rows: [first, ...rest],
  }
}
