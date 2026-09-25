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

/** The line under the section when it lists attendance schools. */
export const NEIGHBORHOOD_SCHOOLS_TRACE =
  'Schools are the Deschutes County attendance areas that cover this neighborhood.'

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

export function dailyLifeRows(
  content: ResortCommunityContent | null,
  _cityName: string,
  schools: readonly PlaceSchool[] = [],
): V3LedgerPlainRow[] {
  const rows: V3LedgerPlainRow[] = []
  const seen = new Set<string>()

  const push = (row: V3LedgerPlainRow) => {
    const id = row.id ?? row.href
    if (seen.has(id)) return
    seen.add(id)
    rows.push(row)
  }

  // Already ordered elementary, middle, high, and by share inside a level.
  for (const school of schools) {
    const slug = school.slug?.trim()
    const name = school.name?.trim()
    const level = SCHOOL_LEVEL_LABEL[school.level]
    if (!slug || !name || !level) continue
    push({
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
    if (!park) continue
    const access = amenity.access?.trim()
    const depth = parkDepthLine(park)
    push({
      href: `/parks/${park.slug}`,
      when: v3Text('Park'),
      what: v3Text(park.name),
      detail: access ? v3Text(access) : depth ? v3Text(depth) : undefined,
      id: `park-${park.slug}`,
    })
  }

  return rows
}

/** True when the rows carry at least one attendance school. */
export function dailyLifeHasSchools(rows: readonly V3LedgerPlainRow[]): boolean {
  return rows.some((row) => typeof row.id === 'string' && row.id.startsWith('school-'))
}
