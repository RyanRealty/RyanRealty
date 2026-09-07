/**
 * getSchools — the Central Oregon schools registry, grouped for the index page.
 *
 * Pure registry read (data/co-schools.ts) — no DB query. The index page shows
 * every verified school grouped by district, then by level. Academic stats are
 * intentionally omitted (enriched later; never invented — CLAUDE.md §0).
 *
 * Lives behind the DAL boundary so pages import from @/lib/data only (Gate G8).
 */

import { CO_SCHOOLS, type CoSchool, type SchoolLevel } from '@/data/co-schools'

export type SchoolsByLevel = {
  high: CoSchool[]
  middle: CoSchool[]
  elementary: CoSchool[]
}

export type SchoolDistrictGroup = {
  district: string
  districtSlug: string
  schools: CoSchool[]
  byLevel: SchoolsByLevel
}

/** Stable display order: high, middle, elementary. */
const LEVEL_ORDER: SchoolLevel[] = ['high', 'middle', 'elementary']

function emptyByLevel(): SchoolsByLevel {
  return { high: [], middle: [], elementary: [] }
}

/**
 * Return the registry grouped by district, each district's schools further
 * split by level. Districts are ordered by total school count (largest first),
 * with schools alphabetised within each level.
 */
export function getSchools(): SchoolDistrictGroup[] {
  const groups = new Map<string, SchoolDistrictGroup>()

  for (const school of CO_SCHOOLS) {
    let group = groups.get(school.districtSlug)
    if (!group) {
      group = {
        district: school.district,
        districtSlug: school.districtSlug,
        schools: [],
        byLevel: emptyByLevel(),
      }
      groups.set(school.districtSlug, group)
    }
    group.schools.push(school)
    group.byLevel[school.level].push(school)
  }

  const sortByName = (a: CoSchool, b: CoSchool) => a.name.localeCompare(b.name)
  for (const group of groups.values()) {
    for (const level of LEVEL_ORDER) {
      group.byLevel[level].sort(sortByName)
    }
  }

  return [...groups.values()].sort((a, b) => b.schools.length - a.schools.length)
}

/** Total count of schools in the registry (for the index intro). */
export function getSchoolsCount(): number {
  return CO_SCHOOLS.length
}

/** District options for Places search grain — label, slug, and cities that feed it. */
export type SchoolDistrictOption = {
  label: string
  slug: string
  cities: string[]
}

/**
 * Unique school districts from the registry, each with the cities its schools sit in.
 * Used by /homes-for-sale Places multi-select (filter via city CSV; boundary via GIS).
 */
export function getSchoolDistrictOptions(): SchoolDistrictOption[] {
  const bySlug = new Map<string, { label: string; cities: Set<string> }>()
  for (const school of CO_SCHOOLS) {
    let row = bySlug.get(school.districtSlug)
    if (!row) {
      row = { label: school.district, cities: new Set() }
      bySlug.set(school.districtSlug, row)
    }
    if (school.city.trim()) row.cities.add(school.city.trim())
  }
  return [...bySlug.entries()]
    .map(([slug, row]) => ({
      label: row.label,
      slug,
      cities: [...row.cities].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
}
