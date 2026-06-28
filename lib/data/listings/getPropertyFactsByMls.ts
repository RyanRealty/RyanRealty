/**
 * getPropertyFactsByMls — normalize a listing's property-fact columns into the
 * shape the TC required-document anticipation engine consumes
 * (lib/tc/required-documents.ts). Lives in lib/data/ so the DAL boundary allows
 * the `listings` read.
 *
 * Maps real ODS/MLS columns → trigger facts:
 *   - year_built                          → yearBuilt (drives lead-based-paint)
 *   - property_sub_type                   → isCondo / isManufactured / isVacantLand
 *   - sewer (structured)                  → hasSeptic (septic keys vs public/district)
 *   - association_yn / hoa_monthly        → hasHOA
 *   - water (text, often null in feed)    → hasWell (else null = confirm prompt)
 *
 * Anything the feed can't tell us stays `null` so the engine surfaces it as a
 * "confirm" prompt rather than guessing.
 */

import { supabaseAnon } from '@/lib/data/client'

export type ListingPropertyFacts = {
  yearBuilt: number | null
  hasWell: boolean | null
  hasSeptic: boolean | null
  hasHOA: boolean | null
  isCondo: boolean | null
  isManufactured: boolean | null
  isVacantLand: boolean | null
}

const SEPTIC_KEYS = [
  'septic',
  'leach field',
  'private sewer',
  'holding tank',
  'alternative treatment',
  'perc test',
  'capping fill',
  'sand filter',
]

function parseSewer(sewer: unknown): boolean | null {
  if (sewer == null) return null
  let obj: Record<string, unknown> | null = null
  if (typeof sewer === 'object') obj = sewer as Record<string, unknown>
  else if (typeof sewer === 'string') {
    try {
      obj = JSON.parse(sewer)
    } catch {
      const s = sewer.toLowerCase()
      if (SEPTIC_KEYS.some((k) => s.includes(k))) return true
      if (s.includes('public sewer') || s.includes('district')) return false
      return null
    }
  }
  if (!obj || typeof obj !== 'object') return null
  const keys = Object.keys(obj)
    .filter((k) => obj![k] === true)
    .map((k) => k.toLowerCase())
  if (keys.some((k) => SEPTIC_KEYS.some((s) => k.includes(s)))) return true
  if (keys.length && keys.every((k) => k.includes('public sewer') || k.includes('district'))) return false
  return null
}

function parseWell(water: unknown): boolean | null {
  if (water == null) return null
  const s = typeof water === 'string' ? water.toLowerCase() : JSON.stringify(water).toLowerCase()
  if (s.includes('well')) return true
  if (s.includes('public') || s.includes('district') || s.includes('city') || s.includes('municipal')) return false
  return null
}

export async function getPropertyFactsByMls(mlsNumber: string): Promise<ListingPropertyFacts | null> {
  const sb = supabaseAnon()
  if (!sb) return null
  const k = String(mlsNumber ?? '').trim()
  if (!k) return null

  const { data } = await sb
    .from('listings')
    .select('year_built, property_sub_type, PropertyType, sewer, water, association_yn, hoa_monthly')
    .eq('ListNumber', k)
    // IDX compliance: no facts for seller internet opt-outs / non-IDX listings.
    .not('permit_internet_yn', 'is', false)
    .not('idx_participant', 'is', false)
    .maybeSingle()
  if (!data) return null

  const row = data as Record<string, unknown>
  const sub = String(row.property_sub_type ?? '').toLowerCase()
  const propType = String(row.PropertyType ?? '').toLowerCase()
  const hasSubType = sub.length > 0

  const isCondo = hasSubType ? /condominium|stock cooperative/.test(sub) : null
  const isManufactured = hasSubType ? /manufactured|in park|on leased land|mobile/.test(sub) : null
  const isVacantLand = hasSubType
    ? /lots|leased land|rangeland|recreational|agriculture/.test(sub) || /land/.test(propType)
    : null

  const yb = Number(row.year_built)
  const hoaMonthly = Number(row.hoa_monthly)
  const hasHOA =
    row.association_yn === true || (Number.isFinite(hoaMonthly) && hoaMonthly > 0)
      ? true
      : row.association_yn === false
        ? false
        : null

  return {
    yearBuilt: Number.isFinite(yb) && yb > 0 ? yb : null,
    hasWell: parseWell(row.water),
    hasSeptic: parseSewer(row.sewer),
    hasHOA,
    isCondo,
    isManufactured,
    isVacantLand,
  }
}
