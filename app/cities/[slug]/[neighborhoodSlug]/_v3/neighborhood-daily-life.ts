/**
 * Daily-life doors for the neighborhood grain: schools (and parks only when
 * the park has its own page). Amenities and membership stay off this list.
 *
 * A park that can only open /parks is not a named park — omit it rather than
 * invent a slug. Do not invent an elementary that the authored file does not
 * name.
 */

import { v3Text, type V3LedgerPlainRow } from '@/components/site/v3'
import { findSchoolByName } from '@/data/co-schools'
import { CO_PARKS } from '@/data/co-parks'
import type { ResortCommunityContent } from '@/lib/resort-community-content'

/** Named in authored school descriptions (High Lakes → Cascade → Summit). */
const AUTHORED_SECONDARY = ['Cascade Middle', 'Summit High'] as const

function resolveSchool(name: string) {
  return (
    findSchoolByName(name) ??
    findSchoolByName(name.replace(/\bElementary\b/i, 'Elem')) ??
    findSchoolByName(name.replace(/\bElem\b/i, 'Elementary'))
  )
}

function resolvePark(name: string) {
  const needle = name.trim().toLowerCase()
  if (!needle) return undefined
  return CO_PARKS.find((park) => park.name.trim().toLowerCase() === needle)
}

export function dailyLifeRows(
  content: ResortCommunityContent | null,
  _cityName: string,
): V3LedgerPlainRow[] {
  const rows: V3LedgerPlainRow[] = []
  const seen = new Set<string>()

  const push = (row: V3LedgerPlainRow) => {
    const id = row.id ?? row.href
    if (seen.has(id)) return
    seen.add(id)
    rows.push(row)
  }

  for (const amenity of content?.amenities ?? []) {
    const category = amenity.category?.trim()
    const name = amenity.name?.trim()
    if (!name) continue

    if (category === 'Schools') {
      const school = resolveSchool(name)
      if (school) {
        push({
          href: `/schools/${school.slug}`,
          when: v3Text('School'),
          what: v3Text(school.name),
          detail: amenity.access?.trim() ? v3Text(amenity.access.trim()) : undefined,
          id: `school-${school.slug}`,
        })
      }
      const description = amenity.description ?? ''
      for (const extra of AUTHORED_SECONDARY) {
        if (!description.includes(extra)) continue
        const found = findSchoolByName(extra)
        if (!found) continue
        push({
          href: `/schools/${found.slug}`,
          when: v3Text('School'),
          what: v3Text(found.name),
          id: `school-${found.slug}`,
        })
      }
    }

    if (category === 'Parks') {
      const park = resolvePark(name)
      if (!park) continue
      push({
        href: `/parks/${park.slug}`,
        when: v3Text('Park'),
        what: v3Text(park.name),
        detail: amenity.access?.trim() ? v3Text(amenity.access.trim()) : undefined,
        id: `park-${park.slug}`,
      })
    }
  }

  return rows
}
