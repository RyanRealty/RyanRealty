/**
 * Comprehensive property & site intelligence — zoning + overlays, buildability
 * constraints, water, septic, flood, irrigation, hunting/recreation, and the
 * entitlement pathway, pulled from the authoritative county + state + federal
 * records (SKILL §3.5 zoning, §3.6 well/septic, §7b/§7c land additions;
 * CLAUDE.md §GIS-authoritative: NEVER infer these, pull them from the source).
 *
 * This is the deterministic backbone the retired hand-built land CMAs assembled
 * by hand. Every fact here is fetched fresh from a public GIS/record so no model
 * ever hallucinates a zone, a well depth, a flood zone, or a setback. The LLM
 * judge + adversarial auditor then reason OVER this verified data (buildability,
 * entitlement, water adequacy, hunting eligibility); they never generate it.
 *
 * Verified-live sources (2026-07-14 — the county reorganized its ArcGIS since
 * the older land-CMA builds, so these are re-confirmed against the live folder):
 *  - Deschutes LandFD (maps.deschutes.org): /3 base Zoning, /1 Public Lands,
 *    /2 Taxlot (+ Township/Range/Section), /4 Airport Safety, /6 LM-Road,
 *    /7 LM-Water, /8 Surface Mining Impact, /9 Wildfire Hazard, /10 Wildlife Area.
 *  - Deschutes BoundaryFD: /2 Irrigation Districts, /3 No Shooting Districts,
 *    /13 Urban Growth Boundary.
 *  - FEMA NFHL (hazards.fema.gov) /28: flood zone + Special Flood Hazard Area
 *    (the county's own WaterFD/EnvironmentFD flood + slope layers are now EMPTY).
 *  - Oregon OWRD wl_well_logs_qry_WGS84/0: nearest domestic well log.
 *  - Deschutes DIAL /Real/Permits/<account>: onsite septic + permit history.
 *
 * Fail-open everywhere: any source that errors or returns nothing leaves its
 * field unknown + a note; the accuracy contract turns unresolved site facts on a
 * non-municipal parcel into needs_review rather than shipping a guess. Slope,
 * wetland, and canal layers are no longer machine-servable from the county, so
 * they are surfaced as explicit field-confirm caveats on rural parcels — never
 * fabricated.
 */

import type { CmaSubject } from '@/lib/cma/types'

const MAPS = 'https://maps.deschutes.org/arcgis/rest/services/OpenData'
const ARCGIS_ZONING = `${MAPS}/LandFD/MapServer/3`
const ARCGIS_WILDFIRE = `${MAPS}/LandFD/MapServer/9`
const ARCGIS_TAXLOT = `${MAPS}/LandFD/MapServer/2`
const ARCGIS_PUBLIC_LAND = `${MAPS}/LandFD/MapServer/1`
const FEMA_NFHL_FLOOD = 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28'
const OWRD_WELLS = 'https://arcgis.wrd.state.or.us/arcgis/rest/services/dynamic/wl_well_logs_qry_WGS84/MapServer/0'
const DIAL_PERMITS = (account: string) => `https://dial.deschutes.org/Real/Permits/${encodeURIComponent(account)}`

// Overlay zones — each its own LandFD layer. Presence = the overlay applies.
const OVERLAY_LAYERS: Array<{ layer: number; code: string; label: string }> = [
  { layer: 4, code: 'AS', label: 'Airport Safety' },
  { layer: 6, code: 'LM', label: 'Landscape Management (Road)' },
  { layer: 7, code: 'LM', label: 'Landscape Management (Water)' },
  { layer: 8, code: 'SMIA', label: 'Surface Mining Impact Area' },
  { layer: 10, code: 'WA', label: 'Wildlife Area' },
]

// Boundary layers.
const BOUNDARY = 'https://maps.deschutes.org/arcgis/rest/services/OpenData/BoundaryFD/MapServer'
const BND_IRRIGATION = `${BOUNDARY}/2`
const BND_NO_SHOOTING = `${BOUNDARY}/3`
const BND_UGB = `${BOUNDARY}/13`

// Rural / resource base zones — non-municipal by definition (well + septic).
const RURAL_ZONE_RE = /\b(EFU|EFUTRB|MUA10?|RR10?|UAR10?|F1|F2|SM|FP)\b/i
// Urban base zones — city water/sewer likely.
const URBAN_ZONE_RE = /\b(RS|RM|RH|RL|UAR|CG|CL|CC|CN|IL|IG|IP|R-?[0-9]|UH|UM)\b/i
// Restrictive/resource base zones where a dwelling needs a verified entitlement.
const RESTRICTIVE_ZONE_RE = /\b(EFU|EFUTRB|F1|F2|SM)\b/i

export type WaterSource = 'well' | 'municipal' | 'unknown'
export type SepticStatus = 'installed' | 'site-evaluation-only' | 'municipal-sewer' | 'none-found' | 'unknown'

export interface CmaWellLog {
  wellNumber: string | null
  completedDepthFt: number | null
  firstWaterFt: number | null
  completedDate: string | null
  use: string | null
}

export interface CmaPermitRecord {
  type: string
  permit: string | null
  status: string | null
}

export interface CmaOverlay {
  code: string
  label: string
  /** The land-use consequence a broker must state (setback / review / min lot). */
  effect: string
}

export interface CmaSiteData {
  taxAccount: string | null
  taxlot: string | null
  /** Township-Range-Section from the taxlot layer (game-unit / LOP context). */
  trs: string | null
  /** Authoritative acreage (MLS lot size, cross-checked vs the parcel record). */
  acreage: number | null
  zone: string | null
  /** Base-zone code + every applicable overlay's effect. Populated live. */
  zoneOverlays: string[]
  overlays: CmaOverlay[]
  wildfireHazard: boolean | null
  /** FEMA flood: zone code (X = minimal) + Special Flood Hazard Area flag. */
  flood: { zone: string | null; inSFHA: boolean | null }
  water: { source: WaterSource; wellLog: CmaWellLog | null; irrigationDistrict: string | null }
  septic: { status: SepticStatus; permit: string | null }
  /** Finaled/active permits of record (building/electrical/plumbing/onsite/land-use). */
  permits: CmaPermitRecord[]
  /** Dwelling entitlement pathway for restrictive zones (conditional = needs verification). */
  entitlement: { pathway: string; conditional: boolean } | null
  /** Hunting / landowner-preference eligibility for qualifying acreage (caveated). */
  hunting: { gameUnit: string; lop: string; noShootingDistrict: boolean | null } | null
  isMunicipal: boolean
  insideUGB: boolean | null
  publicLand: boolean | null
  /** Buildability positives + constraints, plainly stated. */
  constraints: string[]
  /** Facts a machine source can no longer serve (slope/wetland/canal) — confirm at listing. */
  fieldConfirm: string[]
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

/** First intersecting feature's attributes, or null. Throws on transport error. */
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

/** Boolean "does this point intersect this layer" — for overlay/boundary presence. */
async function arcgisIntersects(base: string, lng: number, lat: number): Promise<Record<string, unknown> | null | undefined> {
  try {
    return await arcgisPointQuery(base, lng, lat, '*')
  } catch {
    return undefined // undefined = query failed (unknown); null = queried, no hit
  }
}

/** Nearest OWRD well log within a tight envelope around the parcel point. */
async function owrdWellNear(lng: number, lat: number): Promise<CmaWellLog | null> {
  // ~250m envelope: rural parcels are multi-acre and the well often sits well
  // off the mapped address point. This proves the property is on private-well
  // land; the specific log is area context to confirm with the seller's own
  // OWRD log at listing (SKILL §3.6) — never presented as the subject's well.
  const d = 0.00225
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

/** DIAL permits page → onsite septic status + a permit-history digest. */
async function dialPermits(account: string): Promise<{ status: SepticStatus; permit: string | null; permits: CmaPermitRecord[] }> {
  try {
    const res = await fetch(DIAL_PERMITS(account), { signal: AbortSignal.timeout(15000) })
    if (!res.ok) return { status: 'unknown', permit: null, permits: [] }
    const raw = await res.text()
    const html = raw.replace(/\s+/g, ' ')
    const permits: CmaPermitRecord[] = []
    // Deschutes permit numbers: 247-<letter><digits> (E=electrical, P=plumbing,
    // M=mechanical, B=building, S=onsite septic, LM/CU/DR/TU=land-use).
    const seen = new Set<string>()
    for (const m of html.matchAll(/247-?([A-Z]{1,2})(\d{2,6})/g)) {
      const permit = m[0]
      if (seen.has(permit)) continue
      seen.add(permit)
      const letter = (m[1] ?? '').toUpperCase()
      const type =
        letter === 'S' ? 'Onsite septic' :
        letter === 'E' ? 'Electrical' :
        letter === 'P' ? 'Plumbing' :
        letter === 'M' ? 'Mechanical' :
        letter === 'B' ? 'Building' :
        /^(CU|LM|DR|TU|LR|MC|MA|PA|TP)/.test(letter) ? 'Land-use' : 'Permit'
      permits.push({ type, permit, status: null })
      if (permits.length >= 24) break
    }
    const onsite = permits.find((p) => p.type === 'Onsite septic')
    const hasOnsiteText = /onsite|on-site|wastewater|septic/i.test(html)
    let status: SepticStatus
    if (onsite) status = 'installed'
    else if (/site evaluation|feasibility|soil (test|eval)/i.test(html)) status = 'site-evaluation-only'
    else if (hasOnsiteText) status = 'installed'
    else status = 'none-found'
    return { status, permit: onsite?.permit ?? null, permits }
  } catch {
    return { status: 'unknown', permit: null, permits: [] }
  }
}

/**
 * Resolve comprehensive property intelligence for a subject. Zoning, overlays,
 * flood, wildfire, taxlot/TRS, public-land, irrigation, no-shooting, UGB, and
 * the well are fetched for every property in parallel (cheap authoritative
 * JSON). DIAL permits (the one HTML scrape) run only for non-municipal parcels
 * so suburban CMAs don't hammer DIAL.
 */
export async function resolveCmaSiteData(subject: CmaSubject): Promise<CmaSiteData> {
  const site: CmaSiteData = {
    taxAccount: null,
    taxlot: null,
    trs: null,
    acreage: num(subject.lotAcres ?? null),
    zone: null,
    zoneOverlays: [],
    overlays: [],
    wildfireHazard: null,
    flood: { zone: null, inSFHA: null },
    water: { source: 'unknown', wellLog: null, irrigationDistrict: null },
    septic: { status: 'unknown', permit: null },
    permits: [],
    entitlement: null,
    hunting: null,
    isMunicipal: false,
    insideUGB: null,
    publicLand: null,
    constraints: [],
    fieldConfirm: [],
    resolved: false,
    notes: [],
    citations: [],
  }

  const lat = subject.latitude
  const lng = subject.longitude
  if (lat == null || lng == null) {
    site.notes.push('No subject coordinates on the MLS record; zoning/well/septic/flood could not be resolved from GIS. Confirm at listing.')
    return site
  }

  // Tax account + taxlot (for DIAL permits) — reuse the county owner resolver.
  try {
    const { deschutesCountyOwner } = await import('@/lib/owner-resolution.mjs')
    const county = await deschutesCountyOwner(subject.streetAddress, subject.city)
    if (county) {
      site.taxAccount = county.accountId ?? null
      site.taxlot = county.taxlot ?? null
    }
  } catch { /* fail-open */ }

  // One parallel wave of authoritative point queries.
  const [
    zoneRes, fireRes, taxlotRes, publicRes, floodRes, irrigRes, noShootRes, ugbRes, wellRes,
    ...overlayRes
  ] = await Promise.allSettled([
    // Base zone. Layer /3 fields: OBJECTID, ZONE_TYPE, COMMUNITY_TYPE, ZONE,
    // ORDINANCE. There is NO OVERLAY field here (overlays are separate layers).
    arcgisPointQuery(ARCGIS_ZONING, lng, lat, 'ZONE,ZONE_TYPE,COMMUNITY_TYPE,ORDINANCE'),
    arcgisPointQuery(ARCGIS_WILDFIRE, lng, lat, 'HAZARD'),
    arcgisPointQuery(ARCGIS_TAXLOT, lng, lat, 'TAXLOT,TOWNSHIP,RANGE,SECTION'),
    arcgisIntersects(ARCGIS_PUBLIC_LAND, lng, lat),
    arcgisPointQuery(FEMA_NFHL_FLOOD, lng, lat, 'FLD_ZONE,ZONE_SUBTY,SFHA_TF'),
    arcgisPointQuery(BND_IRRIGATION, lng, lat, 'NAME'),
    arcgisIntersects(BND_NO_SHOOTING, lng, lat),
    arcgisIntersects(BND_UGB, lng, lat),
    owrdWellNear(lng, lat),
    ...OVERLAY_LAYERS.map((o) => arcgisIntersects(`${MAPS}/LandFD/MapServer/${o.layer}`, lng, lat)),
  ])

  // ── Base zoning ──────────────────────────────────────────────────────────
  if (zoneRes.status === 'fulfilled' && zoneRes.value) {
    const z = zoneRes.value
    site.zone = z.ZONE != null && String(z.ZONE).trim() ? String(z.ZONE).trim() : null
    if (site.zone) site.citations.push({ what: `Zoning ${site.zone}`, source: 'Deschutes County GIS (LandFD zoning layer)', url: ARCGIS_ZONING })
  } else {
    site.notes.push('Zoning could not be pulled from the county GIS; confirm the zone at listing.')
  }

  // ── Overlays (LM / WA / AS / SMIA) — each its own layer ──────────────────
  const overlayEffect: Record<string, string> = {
    LM: 'Landscape Management: 100 ft scenic setback + design review before a dwelling permit',
    WA: 'Wildlife Area (deer winter range): ~300 ft setback from the road centerline + 40-acre minimum lot (DCC 18.88)',
    AS: 'Airport Safety: height + use limits near the airport approach',
    SMIA: 'Surface Mining Impact Area: noise/dust disclosure + siting review near mining',
  }
  const overlayCodesSeen = new Set<string>()
  OVERLAY_LAYERS.forEach((o, i) => {
    const r = overlayRes[i]
    if (r && r.status === 'fulfilled' && r.value) {
      if (overlayCodesSeen.has(o.code)) return
      overlayCodesSeen.add(o.code)
      const effect = overlayEffect[o.code] ?? o.label
      site.overlays.push({ code: o.code, label: o.label, effect })
      site.zoneOverlays.push(o.code)
      site.citations.push({ what: `${o.label} overlay`, source: 'Deschutes County GIS (LandFD)', url: `${MAPS}/LandFD/MapServer/${o.layer}` })
    }
  })

  // ── Wildfire ─────────────────────────────────────────────────────────────
  if (fireRes.status === 'fulfilled' && fireRes.value) {
    site.wildfireHazard = /^y/i.test(String(fireRes.value.HAZARD ?? ''))
  }

  // ── Taxlot + Township/Range/Section ──────────────────────────────────────
  if (taxlotRes.status === 'fulfilled' && taxlotRes.value) {
    const t = taxlotRes.value
    if (!site.taxlot && t.TAXLOT) site.taxlot = String(t.TAXLOT)
    const tw = t.TOWNSHIP, rg = t.RANGE, sc = t.SECTION
    if (tw && rg && sc) site.trs = `T${tw}S R${rg}E Sec ${sc}`
    site.citations.push({ what: `Taxlot ${site.taxlot ?? ''}`, source: 'Deschutes County GIS (taxlot layer)', url: ARCGIS_TAXLOT })
  }

  // ── Public land ──────────────────────────────────────────────────────────
  if (publicRes.status === 'fulfilled') site.publicLand = publicRes.value != null ? true : (publicRes.value === null ? false : null)

  // ── FEMA flood ───────────────────────────────────────────────────────────
  if (floodRes.status === 'fulfilled' && floodRes.value) {
    const fz = floodRes.value.FLD_ZONE != null ? String(floodRes.value.FLD_ZONE) : null
    const sfha = floodRes.value.SFHA_TF != null ? /^t/i.test(String(floodRes.value.SFHA_TF)) : null
    site.flood = { zone: fz, inSFHA: sfha }
    site.citations.push({ what: `FEMA flood zone ${fz ?? '—'}`, source: 'FEMA National Flood Hazard Layer', url: FEMA_NFHL_FLOOD })
    if (sfha === true) site.constraints.push(`In a FEMA Special Flood Hazard Area (zone ${fz}). Flood insurance is required for a federally backed loan. Verify the elevation certificate.`)
    else if (sfha === false) site.constraints.push(`Not in a FEMA Special Flood Hazard Area (zone ${fz ?? 'X'}). No mandatory flood insurance.`)
  }

  // ── Irrigation district ──────────────────────────────────────────────────
  if (irrigRes.status === 'fulfilled' && irrigRes.value?.NAME) {
    site.water.irrigationDistrict = String(irrigRes.value.NAME).trim()
    site.citations.push({ what: `Irrigation district: ${site.water.irrigationDistrict}`, source: 'Deschutes County GIS (BoundaryFD)', url: BND_IRRIGATION })
  }

  // ── UGB ──────────────────────────────────────────────────────────────────
  if (ugbRes.status === 'fulfilled') site.insideUGB = ugbRes.value != null ? true : (ugbRes.value === null ? false : null)

  // ── Well ─────────────────────────────────────────────────────────────────
  if (wellRes.status === 'fulfilled' && wellRes.value) {
    site.water.source = 'well'
    site.water.wellLog = wellRes.value
    site.notes.push(
      `Private well country: nearest domestic OWRD well log ${wellRes.value.wellNumber ?? ''} (${wellRes.value.completedDepthFt ?? '—'} ft, ${wellRes.value.completedDate ?? 'date n/a'}). Confirm the SUBJECT's own well log + a recent flow test at listing.`,
    )
    site.citations.push({ what: `Nearest domestic well log ${wellRes.value.wellNumber ?? ''}`, source: 'Oregon OWRD well logs', url: OWRD_WELLS })
  }

  // ── Municipal vs private determination ───────────────────────────────────
  const zoneStr = site.zone ?? ''
  const ruralZone = RURAL_ZONE_RE.test(zoneStr)
  const urbanZone = URBAN_ZONE_RE.test(zoneStr) && !ruralZone
  const nonMunicipal = site.water.source === 'well' || ruralZone || site.insideUGB === false

  if (nonMunicipal && site.taxAccount) {
    const perm = await dialPermits(site.taxAccount)
    site.septic = { status: perm.status, permit: perm.permit }
    site.permits = perm.permits
    if (perm.permit) site.citations.push({ what: `Septic permit ${perm.permit}`, source: 'Deschutes County DIAL permits', url: DIAL_PERMITS(site.taxAccount) })
    if (site.permits.length) site.citations.push({ what: `${site.permits.length} permits of record`, source: 'Deschutes County DIAL permits', url: DIAL_PERMITS(site.taxAccount) })
    if (site.water.source === 'unknown') {
      site.notes.push('Rural zoning but no on-parcel OWRD well log surfaced by coordinate (older wells log by TRS/owner). Seller to provide the OWRD well log + a recent flow test.')
    }
    // Rural facts the county can no longer serve by machine — confirm at listing.
    site.fieldConfirm.push('Steep slope (over 25%), wetland inventory, and any irrigation-canal easement crossing the parcel. The county retired those map services, so confirm these from the survey or a site visit.')
    if (!site.water.irrigationDistrict) site.fieldConfirm.push('Certificated water rights and irrigation shares. Confirm with the irrigation district and OWRD.')
    else site.fieldConfirm.push(`Irrigation district is ${site.water.irrigationDistrict}, but district boundary ≠ certificated water right. Confirm the parcel's actual irrigated acreage + rights with the district and OWRD.`)
  } else if (urbanZone && site.water.source !== 'well') {
    site.isMunicipal = true
    site.water.source = 'municipal'
    site.septic = { status: 'municipal-sewer', permit: null }
    site.notes.push('Urban zoning with no private well of record — city water and sewer indicated. Confirm the utility connections at listing.')
  }

  // ── Entitlement pathway (restrictive/resource zones) ─────────────────────
  if (site.zone && RESTRICTIVE_ZONE_RE.test(site.zone)) {
    site.entitlement = {
      pathway: 'Farm dwelling, lot-of-record dwelling, or an approved Conditional Use Permit',
      conditional: true,
    }
    site.constraints.push(`Zone ${site.zone} is a resource zone. A dwelling is not by-right. It requires a verified current entitlement (farm dwelling, lot-of-record, or an approved CUP, and CUPs lapse in 2 to 4 years). Confirm the current status before any value rests on buildability.`)
  } else if (site.zone && !site.isMunicipal) {
    site.constraints.push(`Zone ${site.zone} allows a dwelling by-right subject to standard siting review.`)
  }

  // ── Setbacks from overlays ──────────────────────────────────────────────
  for (const ov of site.overlays) {
    if (!site.constraints.some((c) => c.includes(ov.effect))) site.constraints.push(ov.effect + '.')
  }

  // ── Hunting / landowner-preference (qualifying acreage only) ─────────────
  const ac = site.acreage
  if (ac != null && ac >= 40 && !site.isMunicipal) {
    const noShoot =
      noShootRes.status === 'fulfilled' ? (noShootRes.value != null ? true : (noShootRes.value === null ? false : null)) : null
    const lop =
      ac >= 160
        ? 'At 160 acres or more, eligible under Oregon LOP (OAR 635-075) for buck deer, bull elk, either-sex, and pronghorn tags. Caveated, confirm with ODFW.'
        : 'At 40 acres or more, eligible under Oregon LOP (OAR 635-075) for antlerless deer and antlerless elk tags. Caveated, confirm with ODFW.'
    site.hunting = { gameUnit: 'Upper Deschutes (about Unit 34), confirm with ODFW', lop, noShootingDistrict: noShoot }
    if (noShoot === true) site.hunting.lop += '. Note that the parcel is inside a county No Shooting District.'
    site.citations.push({ what: 'Landowner-preference eligibility (ODFW OAR 635-075)', source: 'Oregon ODFW LOP rule + county No Shooting District GIS', url: BND_NO_SHOOTING })
  }

  site.resolved =
    site.zone != null && (site.isMunicipal || site.water.source === 'well' || site.septic.status !== 'unknown')
  return site
}
