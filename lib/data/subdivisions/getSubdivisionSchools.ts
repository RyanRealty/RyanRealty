/**
 * getSubdivisionSchools — the assigned schools for one city-scoped subdivision
 * (W2.4 MPC-parity schools leg), derived from the subdivision's OWN listings'
 * MLS school fields via the get_subdivision_schools RPC (server-side modal
 * aggregate per level — never row-level data).
 *
 * §0 HONESTY THRESHOLD: a school is only CLAIMED when >=70% of >=10 listings
 * carrying the field agree (applySchoolThreshold, pure + unit-tested). Mixed
 * assignments (e.g. Rivers Edge Village elementary splits 59/41 across a
 * boundary) are OMITTED, never guessed — a wrong school claim is worse than
 * none. Junk field values (e.g. "********" district entries, n<=6) fall out of
 * the >=10 floor automatically.
 *
 * Scoped by City + SubdivisionName (same anti-collision posture as
 * compute_subdivision_period_stats). Fails soft to [] pre-migration (PGRST202)
 * via the resilient wrapper, same as getSubdivisionSalesHistory.
 */

import { supabaseAnon } from '@/lib/data/client'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'

export type SchoolLevel = 'elementary' | 'middle' | 'high' | 'district'

export interface SubdivisionSchool {
  level: SchoolLevel
  /** The claimed school name (the modal MLS value). */
  name: string
  /** Listings agreeing / listings carrying the field — the §0 trace. */
  modalCount: number
  totalCount: number
}

type RpcRow = {
  level?: string | null
  modal_name?: string | null
  modal_n?: number | string | null
  total_n?: number | string | null
}

/** Claim floor: at least this many listings must carry the field. */
export const SCHOOL_MIN_SAMPLES = 10
/** Claim threshold: the modal value must cover at least this share. */
export const SCHOOL_MIN_AGREEMENT = 0.7

/**
 * Pure §0 threshold: keep only levels where the modal school is a clear
 * majority of a real sample. Exported for the unit test.
 */
export function applySchoolThreshold(rows: RpcRow[]): SubdivisionSchool[] {
  const out: SubdivisionSchool[] = []
  for (const row of rows) {
    const level = row.level as SchoolLevel | undefined
    const name = (row.modal_name ?? '').trim()
    const modalCount = Number(row.modal_n)
    const totalCount = Number(row.total_n)
    if (!level || !['elementary', 'middle', 'high', 'district'].includes(level)) continue
    if (!name || /^\*+$/.test(name)) continue // masked/junk MLS values
    if (!Number.isFinite(modalCount) || !Number.isFinite(totalCount)) continue
    if (totalCount < SCHOOL_MIN_SAMPLES) continue
    if (modalCount / totalCount < SCHOOL_MIN_AGREEMENT) continue
    out.push({ level, name, modalCount, totalCount })
  }
  // Stable display order.
  const order: SchoolLevel[] = ['elementary', 'middle', 'high', 'district']
  return out.sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level))
}

async function fetchSubdivisionSchools(city: string, subdivisionName: string): Promise<SubdivisionSchool[]> {
  const trimmedCity = city.trim()
  const trimmedName = subdivisionName.trim()
  if (!trimmedCity || !trimmedName) return []

  const supabase = supabaseAnon()
  if (!supabase) return []

  const { data, error } = await supabase.rpc('get_subdivision_schools', {
    p_city: trimmedCity,
    p_name: trimmedName,
  })
  if (error) {
    // Includes PGRST202 (RPC not yet migrated) — throw so the resilient wrapper
    // never caches an empty result for a deployed-tomorrow function.
    throw new Error(`get_subdivision_schools RPC failed for "${trimmedCity}/${trimmedName}": ${error.message}`)
  }
  return applySchoolThreshold((Array.isArray(data) ? data : []) as RpcRow[])
}

/** Cached 6h — school assignments only move on new listings. */
export const getSubdivisionSchools = makeResilientCached(
  fetchSubdivisionSchools,
  ['subdivision-schools-v1'],
  {
    revalidate: CACHE_WINDOWS.marketStats,
    tags: [cacheTag.market],
  },
  [],
)
