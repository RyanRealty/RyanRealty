import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * How well the MLS row populates the fields the rural comp splits read
 * (Delta 4, Matt 2026-09-09: irrigation, zoning class, usable acreage,
 * outbuildings are hard splits). A data-quality count, not a published stat (zoning lives in the raw RETS `details` jsonb as `Zoning`):
 * it says which split can rest on a column and which must read the remarks
 * or county GIS. Rural = closed SFR on an acre or more in the last 24 months.
 */
export type RuralFieldCoverage = {
  /** Rows read (newest closes first, capped) — the denominator. */
  sample: number
  zoningSet: number
  horseYnSet: number
  horseYnTrue: number
  fencingSet: number
  remarksOutbuilding: number
  remarksIrrigation: number
  remarksTerrain: number
  fivePlusAcres: number
}

const OUTBUILDING_RE = /\b(shop|barn|arena|outbuilding|detached garage|rv garage|stable)/i
const IRRIGATION_RE = /\b(irrigat|water rights)/i
const TERRAIN_RE = /\b(lava|steep|unusable|not usable|wetland|flood|rock outcrop)/i

/** The `details->>Zoning` of a bounded key set — the jsonb is read by key only. */
async function zoningByKey(keys: string[]): Promise<Map<string, string>> {
  const sb = createServiceClient()
  const out = new Map<string, string>()
  for (let i = 0; i < keys.length; i += 200) {
    const part = keys.slice(i, i + 200)
    // @canonical-key — keys were read from listings a moment ago
    const { data, error } = await sb.from('listings').select('ListingKey, zoning:details->>Zoning').in('ListingKey', part)
    if (error) throw new Error(`zoningByKey: ${error.message}`)
    for (const r of (data ?? []) as Array<{ ListingKey: string; zoning: string | null }>) {
      const z = String(r.zoning ?? '').trim()
      if (z) out.set(r.ListingKey, z)
    }
  }
  return out
}

/** A bounded row read tallied in code — the raw table is too large for a filtered count. */
export async function getRuralFieldCoverage(limit = 1000): Promise<RuralFieldCoverage> {
  const sb = createServiceClient()
  const since = new Date()
  since.setMonth(since.getMonth() - 24)
  const { data, error } = await sb
    .from('listings')
    .select('ListingKey, horse_yn, fencing, public_remarks, lot_size_acres')
    .eq('PropertyType', 'A')
    .ilike('StandardStatus', '%closed%')
    .gte('CloseDate', since.toISOString().slice(0, 10))
    .gte('lot_size_acres', 1)
    .order('CloseDate', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`getRuralFieldCoverage: ${error.message}`)
  const rows = (data ?? []) as Array<Record<string, unknown>>
  const zoning = await zoningByKey(rows.map((r) => String(r.ListingKey)))
  const out: RuralFieldCoverage = {
    sample: rows.length,
    zoningSet: 0,
    horseYnSet: 0,
    horseYnTrue: 0,
    fencingSet: 0,
    remarksOutbuilding: 0,
    remarksIrrigation: 0,
    remarksTerrain: 0,
    fivePlusAcres: 0,
  }
  for (const r of rows) {
    if (zoning.has(String(r.ListingKey))) out.zoningSet++
    if (r.horse_yn != null) out.horseYnSet++
    if (r.horse_yn === true) out.horseYnTrue++
    if (String(r.fencing ?? '').trim()) out.fencingSet++
    const remarks = String(r.public_remarks ?? '')
    if (OUTBUILDING_RE.test(remarks)) out.remarksOutbuilding++
    if (IRRIGATION_RE.test(remarks)) out.remarksIrrigation++
    if (TERRAIN_RE.test(remarks)) out.remarksTerrain++
    if (Number(r.lot_size_acres) >= 5) out.fivePlusAcres++
  }
  return out
}

/** The zoning strings rural closed sales carry, most common first. */
export async function getRuralZoningValues(limit = 40): Promise<Array<{ zoning: string; n: number }>> {
  const sb = createServiceClient()
  const since = new Date()
  since.setMonth(since.getMonth() - 24)
  const { data, error } = await sb
    .from('listings')
    .select('ListingKey')
    .eq('PropertyType', 'A')
    .ilike('StandardStatus', '%closed%')
    .gte('CloseDate', since.toISOString().slice(0, 10))
    .gte('lot_size_acres', 1)
    .order('CloseDate', { ascending: false })
    .limit(1000)
  if (error) throw new Error(`getRuralZoningValues: ${error.message}`)
  const zoning = await zoningByKey(((data ?? []) as Array<{ ListingKey: string }>).map((r) => r.ListingKey))
  const tally = new Map<string, number>()
  for (const z of zoning.values()) {
    const key = z.toUpperCase()
    tally.set(key, (tally.get(key) ?? 0) + 1)
  }
  return [...tally.entries()]
    .map(([zoning, n]) => ({ zoning, n }))
    .sort((a, b) => b.n - a.n)
    .slice(0, limit)
}
