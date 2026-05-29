import 'server-only'
import { promises as fs } from 'node:fs'
import path from 'node:path'

/**
 * Rich, verified per-community content (about prose, amenities, drive times,
 * course specs/rankings, HOA, membership, sub-neighborhoods, builders, etc.).
 *
 * Source of truth: `data/resort-community-<slug>.json` — the SAME curated files
 * the resort landing pages (e.g. /lp/tetherow) render from. The community detail
 * page surfaces this so /communities/<slug> carries the depth of the LP.
 *
 * Only communities with an authored config get the rich sections; the loader
 * returns null otherwise so the page degrades gracefully (a community with no
 * config still renders its map, listings, and registry data). Content facts
 * (founded year, architect, course rank, HOA dues) are NEVER invented — a
 * community without a verified config simply shows fewer sections.
 */

export type ResortAmenity = {
  category: string
  name: string
  description?: string | null
  access?: string | null
}

export type ResortDriveTime = {
  minutes: number
  destination: string
  note?: string | null
}

export type ResortCourseRanking = {
  rank: string
  publication: string
  description?: string | null
}

export type ResortCourseSpecs = {
  par?: number | null
  yardage?: number | null
  rating?: number | null
  slope?: number | null
  tees?: string | null
  turf?: string | null
  season?: string | null
  summary?: string | null
}

export type ResortMembershipTier = {
  name?: string
  tier?: string
  label?: string
  eyebrow?: string
  price?: string | number | null
  description?: string | null
  details?: Array<{ label?: string; value?: string }>
  waitlist_status?: string
  [k: string]: unknown
}

export type ResortSignatureHole = {
  number?: number | null
  par?: number | null
  yardage?: number | null
  description?: string | null
}

export type ResortBuilder = {
  name?: string
  role?: string | null
  description?: string | null
  website?: string | null
}

export type ResortCommunityContent = {
  slug: string
  name: string
  acres?: number | null
  founded?: number | string | null
  architect?: string | null
  aboutProse: string[]
  amenities: ResortAmenity[]
  driveTimes: ResortDriveTime[]
  courseRankings: ResortCourseRanking[]
  courseSpecs: ResortCourseSpecs | null
  signatureHole: ResortSignatureHole | null
  membershipTiers: ResortMembershipTier[]
  builders: ResortBuilder[]
  membershipOfficePhone?: string | null
  hoaMasterAnnual?: number | null
  hoaBoard?: Record<string, unknown> | null
}

/** Coerce the `about_prose` field (string OR string[]) to a clean paragraph array. */
function toProse(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
  if (typeof v === 'string' && v.trim()) return [v.trim()]
  return []
}

function toArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : []
}

/**
 * Load the rich content config for a community slug. Returns null when no
 * `data/resort-community-<slug>.json` exists (the other 13 communities until
 * their configs are authored).
 */
export async function getResortCommunityContent(
  slug: string,
): Promise<ResortCommunityContent | null> {
  const safe = slug.toLowerCase().replace(/[^a-z0-9-]/g, '')
  if (!safe) return null
  const file = path.join(process.cwd(), 'data', `resort-community-${safe}.json`)

  let raw: string
  try {
    raw = await fs.readFile(file, 'utf8')
  } catch {
    return null // no config for this community — graceful
  }

  let c: Record<string, unknown>
  try {
    c = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }

  const aboutProse = toProse(c.about_prose)
  const amenities = toArray<ResortAmenity>(c.amenities)
  const driveTimes = toArray<ResortDriveTime>(c.drive_times)
  const courseRankings = toArray<ResortCourseRanking>(c.course_rankings)
  const membershipTiers = toArray<ResortMembershipTier>(c.membership_tiers)

  // A config with no usable rich content is treated as absent.
  if (
    aboutProse.length === 0 &&
    amenities.length === 0 &&
    driveTimes.length === 0 &&
    courseRankings.length === 0
  ) {
    return null
  }

  return {
    slug: safe,
    name: typeof c.name === 'string' ? c.name : safe,
    acres: typeof c.acres === 'number' ? c.acres : null,
    founded: (c.founded as number | string | null) ?? null,
    architect: typeof c.architect === 'string' ? c.architect : null,
    aboutProse,
    amenities,
    driveTimes,
    courseRankings,
    courseSpecs: (c.course_specs as ResortCourseSpecs) ?? null,
    signatureHole: (c.signature_hole as ResortSignatureHole) ?? null,
    membershipTiers,
    builders: toArray<ResortBuilder>(c.builders),
    membershipOfficePhone:
      typeof c.membership_office_phone === 'string' ? c.membership_office_phone : null,
    hoaMasterAnnual:
      typeof c.hoa_master_assessment_annual === 'number' ? c.hoa_master_assessment_annual : null,
    hoaBoard: (c.hoa_board as Record<string, unknown>) ?? null,
  }
}
