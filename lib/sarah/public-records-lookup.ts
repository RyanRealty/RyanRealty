/**
 * Cached public-records lookup for Sarah.
 *
 * Prefer stored MLS fields (parcel_number is the Deschutes DIAL account).
 * Then documented ArcGIS REST. DIAL HTML is a single user-initiated page,
 * never a crawl (dial.deschutes.org robots.txt Disallow: /).
 */
import { lookupCountyZone } from '@/lib/cma/county'
import { normalizeRedmond } from '@/lib/cma/zoning-explainer'
import { resolveZoning, type ZoningDefinition } from '@/lib/zoning/resolve'
import { parseDialPermitsHtml, type ParsedDialPermitsPage } from './public-records-parse'

export const DIAL_PERMITS_URL = (account: string) =>
  `https://dial.deschutes.org/Real/Permits/${encodeURIComponent(account)}`
export const DIAL_HOME = 'https://dial.deschutes.org'
export const DESCHUTES_ZONING_LAYER =
  'https://maps.deschutes.org/arcgis/rest/services/OpenData/LandFD/MapServer/3'
export const CROOK_TAXLOTS =
  'https://gis.crookcountyor.gov/server/rest/services/CC_Taxlots_Helion/FeatureServer/0'
export const SARAH_RECORDS_UA = 'RyanRealty-Sarah/1.0 (+https://ryan-realty.com)'

const CACHE_TTL_MS = 6 * 60 * 60 * 1000

export type PublicRecordsSubject = {
  streetNumber?: string | null
  streetName?: string | null
  city?: string | null
  county?: string | null
  parcelNumber?: string | null
  latitude?: number | null
  longitude?: number | null
}

export type PublicRecordsZone = {
  code: string
  name: string
  jurisdiction: string
  adu: ZoningDefinition['adu']
  sourceUrl: string
  sourceCite: string
  notes: string | null
  limits: string | null
}

export type PublicRecordsBundle = {
  county: string | null
  city: string | null
  account: string | null
  taxlot: string | null
  zone: PublicRecordsZone | null
  permits: ParsedDialPermitsPage | null
  notes: string[]
  citations: Array<{ what: string; source: string; url: string }>
}

export type PublicRecordsFetch = (url: string) => Promise<string | null>
export type ZoneLookup = (
  lat: number,
  lng: number,
) => Promise<{ zone: string | null; zoneType: string | null } | null>

export type PublicRecordsDeps = {
  fetchText?: PublicRecordsFetch
  lookupZone?: ZoneLookup
  now?: () => number
}

type CacheRow<T> = { expires: number; value: T }

const cache = new Map<string, CacheRow<unknown>>()

export function clearPublicRecordsCache(): void {
  cache.clear()
}

function cached<T>(key: string, now: number, compute: () => Promise<T>): Promise<T> {
  const hit = cache.get(key) as CacheRow<T> | undefined
  if (hit && hit.expires > now) return Promise.resolve(hit.value)
  return compute().then((value) => {
    cache.set(key, { expires: now + CACHE_TTL_MS, value })
    return value
  })
}

async function defaultFetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': SARAH_RECORDS_UA, Accept: 'text/html, application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

const CITY_JURISDICTIONS = new Set(['bend', 'redmond', 'sisters', 'la pine', 'prineville', 'madras'])

function aduLimits(def: ZoningDefinition): string | null {
  const j = def.jurisdiction
  if (j === 'bend' && def.adu === 'allowed') {
    return 'the first ADU is generally capped at 800 square feet and a second at 500 square feet (BDC 3.6.200)'
  }
  if (j === 'redmond' && def.adu === 'allowed') {
    return 'a stand-alone ADU is generally 300 to 900 square feet (Redmond Development Code Sec. 8.325)'
  }
  if (j === 'sisters' && def.adu === 'allowed') {
    return 'one ADU per lot up to 800 square feet through a Type I review (SDC 2.15.300)'
  }
  if (def.notes && /adu|accessory dwelling/i.test(def.notes)) {
    const sentence = def.notes.split(/(?<=[.])\s+/).find((s) => /adu|accessory dwelling/i.test(s))
    return sentence?.replace(/\s+/g, ' ').trim() ?? null
  }
  return null
}

function zoneFromDefinition(def: ZoningDefinition): PublicRecordsZone {
  return {
    code: def.code,
    name: def.name,
    jurisdiction: def.jurisdiction,
    adu: def.adu,
    sourceUrl: def.sourceUrl,
    sourceCite: def.sourceCite,
    notes: def.notes ?? null,
    limits: aduLimits(def),
  }
}

function resolveCityZone(raw: string, city: string | null, county: string | null): PublicRecordsZone | null {
  const cityLower = city?.trim().toLowerCase() ?? null
  const inside = cityLower ? CITY_JURISDICTIONS.has(cityLower) : undefined
  const code = cityLower === 'redmond' ? normalizeRedmond(raw) : raw
  const resolved = resolveZoning({
    code,
    county,
    cityLower,
    insideCityLimits: inside,
  })
  if (resolved.status !== 'resolved') return null
  const def = resolved.definition ?? resolved.candidates?.find((c) => c.jurisdiction !== (county ?? '').toLowerCase())
  if (!def) return null
  return zoneFromDefinition(def)
}

async function fetchDialPermits(
  account: string,
  deps: PublicRecordsDeps,
  now: number,
): Promise<ParsedDialPermitsPage | null> {
  const id = account.trim()
  if (!/^\d{4,10}$/.test(id)) return null
  const url = DIAL_PERMITS_URL(id)
  return cached(`dial-permits:${id}`, now, async () => {
    const fetchText = deps.fetchText ?? defaultFetchText
    const html = await fetchText(url)
    if (!html) return null
    return parseDialPermitsHtml(html, url)
  })
}

async function fetchCrookTaxlot(
  lat: number,
  lng: number,
  deps: PublicRecordsDeps,
  now: number,
): Promise<{ taxlot: string | null; sourceUrl: string | null } | null> {
  const key = `crook-taxlot:${lat.toFixed(5)},${lng.toFixed(5)}`
  return cached(key, now, async () => {
    const params = new URLSearchParams({
      geometry: `${lng},${lat}`,
      geometryType: 'esriGeometryPoint',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'MAPTAXLOT,PSO_Link',
      returnGeometry: 'false',
      f: 'json',
    })
    const url = `${CROOK_TAXLOTS}/query?${params}`
    const fetchText = deps.fetchText ?? defaultFetchText
    const raw = await fetchText(url)
    if (!raw) return null
    try {
      const data = JSON.parse(raw) as {
        features?: Array<{ attributes?: Record<string, unknown> }>
      }
      const a = data.features?.[0]?.attributes
      if (!a) return null
      const taxlot = a.MAPTAXLOT != null ? String(a.MAPTAXLOT) : null
      const sourceUrl = a.PSO_Link != null ? String(a.PSO_Link) : null
      return { taxlot, sourceUrl }
    } catch {
      return null
    }
  })
}

export async function lookupPublicRecords(
  subject: PublicRecordsSubject,
  deps: PublicRecordsDeps = {},
): Promise<PublicRecordsBundle> {
  const now = deps.now?.() ?? Date.now()
  const city = subject.city?.trim() || null
  const county = subject.county?.trim() || null
  const notes: string[] = []
  const citations: PublicRecordsBundle['citations'] = []
  const bundle: PublicRecordsBundle = {
    county,
    city,
    account: subject.parcelNumber?.trim() || null,
    taxlot: null,
    zone: null,
    permits: null,
    notes,
    citations,
  }

  const lat = subject.latitude
  const lng = subject.longitude
  const lookupZone = deps.lookupZone ?? lookupCountyZone
  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    const gis = await cached(`zone:${lat.toFixed(5)},${lng.toFixed(5)}`, now, () => lookupZone(lat, lng))
    if (gis?.zone) {
      bundle.zone = resolveCityZone(gis.zone, city, county)
      citations.push({
        what: `Zoning ${gis.zone}`,
        source: 'Deschutes County GIS (LandFD zoning layer)',
        url: DESCHUTES_ZONING_LAYER,
      })
      if (!bundle.zone) {
        notes.push(`The GIS zone is ${gis.zone}, but it is not in our verified code registry.`)
      }
    }
  }

  const countyKey = (county ?? '').toLowerCase()
  if (countyKey === 'deschutes' && bundle.account) {
    const page = await fetchDialPermits(bundle.account, deps, now)
    if (page) {
      bundle.permits = page
      bundle.taxlot = page.taxlot
      citations.push({
        what: 'Deschutes County DIAL permits',
        source: 'Deschutes County DIAL',
        url: page.sourceUrl,
      })
    } else {
      notes.push('DIAL did not return a permits page for this account.')
    }
  } else if (countyKey === 'crook' && lat != null && lng != null) {
    const lot = await fetchCrookTaxlot(lat, lng, deps, now)
    if (lot?.taxlot) {
      bundle.taxlot = lot.taxlot
      citations.push({
        what: `Crook map-taxlot ${lot.taxlot}`,
        source: 'Crook County GIS',
        url: lot.sourceUrl || CROOK_TAXLOTS,
      })
    }
    notes.push('Crook County has no public permit feed we can read. A broker can check with the county.')
  } else if (countyKey === 'jefferson') {
    notes.push('Jefferson County publishes no public taxlot or permit layer we can read.')
  } else if (countyKey && countyKey !== 'deschutes') {
    notes.push(`No public permit lookup is wired for ${county}.`)
  }

  return bundle
}
