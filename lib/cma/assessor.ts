/**
 * Subject facts from the Deschutes County assessor, for homes the MLS has never
 * carried (Matt 2026-09-04).
 *
 * WHY. A homeowner asking what their house is worth has usually not listed it,
 * and the builder resolved its subject only against `listings`. Ten of the 21
 * people who requested a valuation got nothing: three because no MLS row exists
 * for the address at all, three more because the MLS row carries a null
 * TotalLivingAreaSqFt so no price-per-sqft comp set can be formed. Measured
 * 2026-09-04 — 2552 NE Lynda Ln and 653 NE 12th St are both real Bend houses
 * with no MLS record and complete assessor records.
 *
 * The chain, all authoritative and all public:
 *   address -> Google Geocoding (rooftop) -> lng/lat
 *           -> Deschutes LandFD/2 Taxlot polygon at that point -> TAXLOT id
 *           -> Deschutes TablesFD/2 Improvements WHERE Taxlot = id
 *              -> Total_Sqft_1, Bedrooms, Bathrooms, Year_Built_1, acres
 *
 * CLAUDE.md GIS-authoritative: pulled from the county of record, never inferred.
 * Fail-open at every hop — a miss returns null and the caller keeps its own
 * error, because a CMA with no subject is better than a CMA with a guessed one.
 *
 * These facts are NOT MLS data and the caller must say so in the trace. The
 * assessor measures for taxation, so its square footage can differ from the
 * MLS's, and its bath count is often a half-bath out. Good enough to select
 * comps and to price; not good enough to print as though a broker measured it.
 */

import { geocodeAddress } from '@/lib/lead-geocode'

const TAXLOT_LAYER =
  'https://maps.deschutes.org/arcgis/rest/services/OpenData/LandFD/MapServer/2'
const IMPROVEMENTS_TABLE =
  'https://maps.deschutes.org/arcgis/rest/services/OpenData/TablesFD/MapServer/2'
const TIMEOUT_MS = 15_000

export interface AssessorFacts {
  /** Deschutes taxlot id, e.g. 171222DD00170. */
  taxlot: string
  latitude: number
  longitude: number
  /** Assessor living area. Null when the taxlot carries no improvement record. */
  sqft: number | null
  beds: number | null
  baths: number | null
  yearBuilt: number | null
  lotAcres: number | null
  /** Assessor structure class, e.g. "One story", "Two story". */
  statClass: string | null
  /** The county's own record page, for the citation trail. */
  dialUrl: string
  /** Google's geocode precision. Anything below ROOFTOP is a weaker match. */
  geocodePrecision: string
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v))
  return Number.isFinite(n) && n > 0 ? n : null
}

function str(v: unknown): string | null {
  const s = v == null ? '' : String(v).trim()
  return s === '' ? null : s
}

/** Year the assessor recorded, rejecting the impossible rather than passing it on. */
function assessorYear(v: unknown): number | null {
  const n = num(v)
  if (n == null) return null
  const thisYear = new Date().getUTCFullYear()
  return n >= 1850 && n <= thisYear + 2 ? Math.round(n) : null
}

async function getJson(url: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!res.ok) return null
    return (await res.json()) as Record<string, unknown>
  } catch {
    return null
  }
}

/** The taxlot polygon containing this point. Null on miss or error. */
export async function taxlotIdAt(lng: number, lat: number): Promise<string | null> {
  const params = new URLSearchParams({
    geometry: `${lng},${lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'TAXLOT',
    returnGeometry: 'false',
    f: 'json',
  })
  const data = await getJson(`${TAXLOT_LAYER}/query?${params}`)
  const features = Array.isArray(data?.features) ? (data!.features as Array<Record<string, unknown>>) : []
  const attrs = features[0]?.attributes as Record<string, unknown> | undefined
  return str(attrs?.TAXLOT)
}

/**
 * The assessor's improvement record for a taxlot.
 *
 * Only the FIRST improvement (`_1` fields) is read. A taxlot with two dwellings
 * is a different valuation problem than this fallback is for, and silently
 * summing them would overstate the house.
 */
export async function improvementsForTaxlot(taxlot: string): Promise<{
  sqft: number | null
  beds: number | null
  baths: number | null
  yearBuilt: number | null
  lotAcres: number | null
  statClass: string | null
} | null> {
  const params = new URLSearchParams({
    where: `Taxlot='${taxlot.replace(/'/g, "''")}'`,
    outFields: 'Taxlot,Total_Sqft_1,Year_Built_1,Bedrooms,Bathrooms,Stat_Class_Desc_1,Land_Size_Acres',
    returnGeometry: 'false',
    f: 'json',
  })
  const data = await getJson(`${IMPROVEMENTS_TABLE}/query?${params}`)
  const features = Array.isArray(data?.features) ? (data!.features as Array<Record<string, unknown>>) : []
  const a = features[0]?.attributes as Record<string, unknown> | undefined
  if (!a) return null
  return {
    sqft: num(a.Total_Sqft_1),
    beds: num(a.Bedrooms),
    baths: num(a.Bathrooms),
    yearBuilt: assessorYear(a.Year_Built_1),
    lotAcres: num(a.Land_Size_Acres),
    statClass: str(a.Stat_Class_Desc_1),
  }
}

/**
 * Resolve subject facts for an address the MLS does not carry.
 *
 * Returns null when any hop misses, so the caller can keep its own error rather
 * than report a half-known subject. A result with `sqft: null` is still
 * returned when the taxlot resolved — the parcel is real, it simply has no
 * improvement on record, and that is a fact worth stating.
 */
export async function resolveAssessorFacts(address: string): Promise<AssessorFacts | null> {
  const clean = address.trim()
  if (!clean) return null

  const geo = await geocodeAddress(clean)
  if (!geo) return null

  const taxlot = await taxlotIdAt(geo.lng, geo.lat)
  if (!taxlot) return null

  const impr = await improvementsForTaxlot(taxlot)
  return {
    taxlot,
    latitude: geo.lat,
    longitude: geo.lng,
    sqft: impr?.sqft ?? null,
    beds: impr?.beds ?? null,
    baths: impr?.baths ?? null,
    yearBuilt: impr?.yearBuilt ?? null,
    lotAcres: impr?.lotAcres ?? null,
    statClass: impr?.statClass ?? null,
    dialUrl: `https://dial.deschutes.org/Real/Index/${encodeURIComponent(taxlot)}`,
    geocodePrecision: geo.confidence,
  }
}

/**
 * MLS property sub-type from the assessor's own structure class.
 *
 * Read off the county's real vocabulary (119 distinct Stat_Class_Desc_1 values,
 * enumerated 2026-09-04), not guessed. This matters more than it looks: the
 * comp ladder pins its SQL pool with compPoolPropertySubType(subject), so a
 * subject with a null sub-type opens the pool to every product in the county
 * and then throws most of it away in JS. On 2552 NE Lynda that cost 755 of 980
 * candidates and the build died at zero comps with a perfectly good subject.
 *
 * Conservative by design: anything not clearly one of these four residential
 * shapes returns null rather than being forced into SFR. An apartment block, a
 * tiny home, a vacation cabin and every commercial class land there on purpose.
 */
export function propertySubTypeFromStatClass(statClass: string | null): string | null {
  const c = (statClass ?? '').trim().toLowerCase()
  if (!c) return null
  if (/\bcondo/.test(c)) return 'Condominium'
  if (/\btownhouse\b/.test(c)) return 'Townhouse'
  // "Single wide" / "Double wide" / "Triple wide" / "Four wide" are the
  // county's manufactured-home classes.
  if (/\b(single|double|triple|four)\s+wide\b/.test(c)) return 'Manufactured Home'
  // Stick-built detached: the story-count classes and their attic/basement
  // variants, plus split level.
  if (/^(one|two|three)\s+story/.test(c) || /^split level/.test(c)) return 'Single Family Residence'
  return null
}

/** One line naming the source, for the subject trace and the report citation. */
export function assessorTrace(facts: AssessorFacts, address: string): string {
  const parts = [
    facts.sqft != null ? `${facts.sqft} sqft` : 'no living area on record',
    facts.beds != null ? `${facts.beds} bed` : null,
    facts.baths != null ? `${facts.baths} bath` : null,
    facts.yearBuilt != null ? `built ${facts.yearBuilt}` : null,
  ].filter(Boolean)
  return (
    `Subject "${address}" has no MLS record. Facts from the Deschutes County assessor ` +
    `(taxlot ${facts.taxlot}, ${parts.join(', ')}), geocoded ${facts.geocodePrecision}. ` +
    `Assessor measurements are for taxation and can differ from an MLS measurement.`
  )
}
