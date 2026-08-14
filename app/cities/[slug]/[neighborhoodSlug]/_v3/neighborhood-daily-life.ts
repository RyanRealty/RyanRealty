/**
 * Daily-life doors for the neighborhood grain: schools and parks on the first
 * path. Amenities and membership stay off this list (PUBLIC_UI.md §3).
 *
 * A door is offered only when the destination exists. Park names that are not
 * in the Central Oregon park registry still name the park and open /parks
 * rather than inventing a slug.
 */

import { v3Text, type V3LedgerPlainRow } from '@/components/site/v3'
import { findSchoolByName, getDistrictForCity } from '@/data/co-schools'
import type { ResortCommunityContent } from '@/lib/resort-community-content'

const FEEDER_SCHOOLS = ['Cascade Middle', 'Summit High'] as const

function resolveSchool(name: string) {
  return (
    findSchoolByName(name) ??
    findSchoolByName(name.replace(/\bElementary\b/i, 'Elem')) ??
    findSchoolByName(name.replace(/\bElem\b/i, 'Elementary'))
  )
}

export function dailyLifeRows(
  content: ResortCommunityContent | null,
  cityName: string,
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
      for (const extra of FEEDER_SCHOOLS) {
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
      push({
        href: '/parks',
        when: v3Text('Park'),
        what: v3Text(name),
        detail: amenity.access?.trim() ? v3Text(amenity.access.trim()) : undefined,
        id: `park-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      })
    }
  }

  const district = getDistrictForCity(cityName)
  if (district) {
    push({
      href: `/schools/${district.districtSlug}`,
      when: v3Text('District'),
      what: v3Text(district.district),
      id: `district-${district.districtSlug}`,
    })
  }

  return rows
}
