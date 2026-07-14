/**
 * CMA authoritative site data — zoning, water, septic from the county + state
 * records (SKILL §3.5 zoning, §3.6 well/septic; CLAUDE.md §GIS-authoritative:
 * NEVER infer these, pull them from the authoritative source).
 *
 * This restores the capability the retired LLM producer had, as deterministic
 * code so no model ever hallucinates a zoning code or a well depth. The LLM
 * judge + adversarial auditor then reason OVER this verified data (buildability,
 * entitlement, well/septic adequacy), and the accuracy contract gates on it.
 *
 * Sources (all Deschutes County + Oregon OWRD, structured where possible):
 *  - Taxlot + tax account: Deschutes ArcGIS Dial2_Taxlots (via owner-resolution).
 *  - Zoning + overlays:     Deschutes ArcGIS OpenData/LandFD/3 (ZONE_TYPE), /9 (wildfire).
 *  - Well:                  Oregon OWRD wl_well_logs_qry_WGS84 (spatial by lat/lng).
 *  - Septic:                Deschutes DIAL /Real/Permits/<account> (onsite-wastewater).
 *
 * Fail-open: any source that errors or returns nothing leaves its field
 * unknown + a flag; the contract turns unresolved site facts into needs_review
 * for non-municipal properties rather than shipping a guess.
 */

import type { CmaSubject } from '@/lib/cma/types'

const ARCGIS_ZONING = 'https://maps.deschutes.org/arcgis/rest/services/OpenData/LandFD/MapServer/3'
const ARCGIS_WILDFIRE = 'https://maps.deschutes.org/arcgis/rest/services/OpenData/LandFD/MapServer/9'
const OWRD_WELLS = 'https://arcgis.wrd.state.or.us/arcgis/rest/services/dynamic/wl_well_logs_qry_WGS84/MapServer/0'
const DIAL_PERMITS = (account: string) => `https://dial.deschutes.org/Real/Permits/${encodeURIComponent(account)}`

// Rural / resource base zones — non-municipal by definition (well + septic).
const RURAL_ZONE_RE = /\b(EFU|EFUTRB|MUA10?|RR10?|UAR10?|F1|F2|SM|FP)\b/i
// Urban base zones — city water/sewer likely.
const URBAN_ZONE_RE = /\b(RS|RM|RH|RL|UAR|CG|CL|CC|CN|IL|IG|IP|R-?[0-9]|UH|UM)\b/i

export type WaterSource = 'well' | 'municipal' | 'unknown'
export type SepticStatus = 'installed' | 'site-evaluation-only' | 'municipal-sewer' | 'none-found' | 'unknown'

export interface CmaWellLog {
  wellNumber: string | null
  completedDepthFt: number | null
  firstWaterFt: number | null
  completedDate: string | null
  use: string | null
}

export interface CmaSiteData {
  taxAccount: string | null
  taxlot: string | null
  zone: string | null
  zoneOverlays: string[]
  wildfireHazard: boolean | null
  water: { source: WaterSource; wellLog: CmaWellLog | null }
  septic: { status: SepticStatus; permit: string | null }
  isMunicipal: boolean
  /** True when this property's utilities/zoning are fully resolved from records. */
  resolved: boolean
  notes: string[]
  citations: Array<{ what: string; source: string; url: string }>
}

const num = (v: unknown): number | null => {
  if (v == null) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

async function arcgisPointQuery(base: string, lng: number, lat: number, outFields = '*'): Promise<Record<string, unknown> | null> {
  const params = new URLSearchParams({
    geometry: `${lng},${lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields,
    returnGeometry: 'false',
    f: 'json',
  })
  const res = await fetch(`${base}/query?${params}`, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`ArcGIS ${res.status}`)
  const data = await res.json()
  return data?.features?.[0]?.attributes ?? null
}

/** Nearest OWRD well log within a tight envelope around the parcel point. */
async function owrdWellNear(lng: number, lat: number): Promise<CmaWellLog | null> {
  const d = 0.0009 // ~100m envelope
  const params = new URLSearchParams({
    geometry: JSON.stringify({ xmin: lng - d, ymin: lat - d, xmax: lng + d, ymax: lat + d, spatialReference: { wkid: 4326 } }),
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'wl_nbr,completed_depth,depth_first_water,complete_date,primary_use',
    returnGeometry: 'false',
    f: 'json',
  })
  const res = await fetch(`${OWRD_WELLS}/query?${params}`, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`OWRD ${res.status}`)
  const data = await res.json()
  const feats: Array<{ attributes?: Record<string, unknown> }> = Array.isArray(data?.features) ? data.features : []
  // Prefer a domestic-use log; else the first hit.
  const domestic = feats.find((f) => /dom/i.test(String(f?.attributes?.primary_use ?? '')))
  const a = (domestic ?? feats[0])?.attributes
  if (!a) return null
  const epoch = num(a.complete_date)
  return {
    wellNumber: a.wl_nbr != null ? String(a.wl_nbr) : null,
    completedDepthFt: num(a.completed_depth),
    firstWaterFt: num(a.depth_first_water),
    completedDate: epoch ? new Date(epoch).toISOString().slice(0, 10) : null,
    use: a.primary_use != null ? String(a.primary_use) : null,
  }
}

/** DIAL permits page → onsite-wastewater (septic) status. Server-rendered HTML. */
async function dialSepticStatus(account: string): Promise<{ status: SepticStatus; permit: string | null }> {
  try {
    const res = await fetch(DIAL_PERMITS(account), { signal: AbortSignal.timeout(15000) })
    if (!res.ok) return { status: 'unknown', permit: null }
    const html = (await res.text()).replace(/\s+/g, ' ')
    // Onsite wastewater construction permits are numbered 247-S##### (Deschutes).
    const permitMatch = html.match(/247-?S\d{4,6}/i)
    const hasOnsite = /onsite|on-site|wastewater|septic/i.test(html)
    const finaled = /final(ized|ed)?/i.test(html) && hasOnsite
    if (permitMatch && finaled) return { status: 'installed', permit: permitMatch[0] }
    if (permitMatch) return { status: 'installed', permit: permitMatch[0] }
    if (/site evaluation|feasibility|soil (test|eval)/i.test(html)) return { status: 'site-evaluation-only', permit: null }
    if (hasOnsite) return { status: 'installed', permit: null }
    return { status: 'none-found', permit: null }
  } catch {
    return { status: 'unknown', permit: null }
  }
}

/**
 * Resolve authoritative site data for a subject. Zoning + well are fetched for
 * every property (cheap JSON, they decide municipal-vs-private); the DIAL septic
 * HTML is fetched only when the property is non-municipal (rural zone or a well
 * exists) so suburban CMAs don't hammer DIAL.
 */
export async function resolveCmaSiteData(subject: CmaSubject): Promise<CmaSiteData> {
  const site: CmaSiteData = {
    taxAccount: null,
    taxlot: null,
    zone: null,
    zoneOverlays: [],
    wildfireHazard: null,
    water: { source: 'unknown', wellLog: null },
    septic: { status: 'unknown', permit: null },
    isMunicipal: false,
    resolved: false,
    notes: [],
    citations: [],
  }

  const lat = subject.latitude
  const lng = subject.longitude
  if (lat == null || lng == null) {
    site.notes.push('No subject coordinates on the MLS record; zoning/well/septic could not be resolved from GIS. Confirm at listing.')
    return site
  }

  // Tax account + taxlot (for the DIAL permits lookup) — reuse the county owner resolver.
  try {
    const { deschutesCountyOwner } = await import('@/lib/owner-resolution.mjs')
    const county = await deschutesCountyOwner(subject.streetAddress, subject.city)
    if (county) {
      site.taxAccount = county.accountId ?? null
      site.taxlot = county.taxlot ?? null
    }
  } catch { /* fail-open */ }

  // Zoning + wildfire + well in parallel (all cheap, authoritative).
  const [zoneRes, fireRes, wellRes] = await Promise.allSettled([
    arcgisPointQuery(ARCGIS_ZONING, lng, lat, 'ZONE_TYPE,ZONE,OVERLAY'),
    arcgisPointQuery(ARCGIS_WILDFIRE, lng, lat, 'HAZARD'),
    owrdWellNear(lng, lat),
  ])

  if (zoneRes.status === 'fulfilled' && zoneRes.value) {
    // The base zone CODE is the `ZONE` string (e.g. "EFUTRB", "RS", "MUA10").
    // `ZONE_TYPE` is an integer jurisdiction id — not the code.
    const z = zoneRes.value
    site.zone = z.ZONE != null && String(z.ZONE).trim() ? String(z.ZONE).trim() : null
    if (site.zone) site.citations.push({ what: `Zoning ${site.zone}`, source: 'Deschutes County GIS (LandFD zoning layer)', url: ARCGIS_ZONING })
  } else {
    site.notes.push('Zoning could not be pulled from the county GIS; confirm the zone at listing.')
  }

  if (fireRes.status === 'fulfilled' && fireRes.value) {
    site.wildfireHazard = /^y/i.test(String(fireRes.value.HAZARD ?? ''))
  }

  if (wellRes.status === 'fulfilled' && wellRes.value) {
    // Envelope query = nearest domestic well within ~100m, not a confirmed
    // point-in-parcel match (older wells log by TRS/owner and mis-geocode).
    // It proves this is private-well country; the specific log is area context
    // to be confirmed with the seller's OWRD log at listing (SKILL §3.6).
    site.water = { source: 'well', wellLog: wellRes.value }
    site.notes.push(
      `Private well country: nearest domestic OWRD well log ${wellRes.value.wellNumber ?? ''} (${wellRes.value.completedDepthFt ?? '—'} ft, ${wellRes.value.completedDate ?? 'date n/a'}). Confirm the SUBJECT's own well log + a recent flow test at listing.`,
    )
    site.citations.push({ what: `Nearest domestic well log ${wellRes.value.wellNumber ?? ''}`, source: 'Oregon OWRD well logs', url: OWRD_WELLS })
  }

  // Municipal vs private determination.
  const zoneStr = site.zone ?? ''
  const ruralZone = RURAL_ZONE_RE.test(zoneStr)
  const urbanZone = URBAN_ZONE_RE.test(zoneStr) && !ruralZone
  const nonMunicipal = site.water.source === 'well' || ruralZone

  if (nonMunicipal && site.taxAccount) {
    site.septic = await dialSepticStatus(site.taxAccount)
    if (site.septic.permit) site.citations.push({ what: `Septic permit ${site.septic.permit}`, source: 'Deschutes County DIAL permits', url: DIAL_PERMITS(site.taxAccount) })
    if (site.water.source === 'unknown') {
      // rural zone but no well surfaced by coordinate — common for older logs.
      site.water.source = 'unknown'
      site.notes.push('Rural zoning but no on-parcel OWRD well log surfaced by coordinate (older wells log by TRS/owner). Seller to provide the OWRD well log + a recent flow test.')
    }
  } else if (urbanZone && site.water.source !== 'well') {
    site.isMunicipal = true
    site.water.source = 'municipal'
    site.septic = { status: 'municipal-sewer', permit: null }
    site.notes.push('Urban zoning with no private well of record — city water and sewer indicated. Confirm the utility connections at listing.')
  }

  site.resolved =
    site.zone != null && (site.isMunicipal || site.water.source === 'well' || site.septic.status !== 'unknown')
  return site
}
