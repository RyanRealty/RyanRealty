/**
 * CMA subject resolution — turn "MLS number or free-text address" into a
 * normalized CmaSubject from the listings table.
 *
 * Address matching mirrors the expired-listing pipeline: street number is
 * highly selective, street name matches as a prefix (MLS street names are
 * stored without suffix in Central Oregon feeds: "Lava", "Robin"), city and
 * zip narrow further. The newest MLS row for the property wins (a canceled
 * or expired listing is still the authoritative record of the structure).
 */

import { findCmaSubjectByMls, findCmaSubjectByAddress } from '@/lib/data'
import type { CmaListingRow } from '@/lib/data'
import type { CmaSubject } from '@/lib/cma/types'
import { formatPriceExact } from '@/lib/format/money'
import { formatDate } from '@/lib/format/date'

const STREET_SUFFIXES = new Set([
  'rd', 'road', 'st', 'street', 'ave', 'avenue', 'dr', 'drive', 'ln', 'lane',
  'ct', 'court', 'pl', 'place', 'blvd', 'boulevard', 'hwy', 'highway',
  'pkwy', 'parkway', 'cir', 'circle', 'way', 'trail', 'trl', 'ter', 'terrace', 'loop',
])

export interface ParsedAddress {
  streetNumber: string
  streetNameTokens: string[]
  city: string | null
  postalCode: string | null
}

/** Parse "16111 Lava, La Pine, OR 97739" into matchable parts. */
export function parseCmaAddress(raw: string, cityHint?: string | null, zipHint?: string | null): ParsedAddress | null {
  const text = raw.trim().replace(/\s+/g, ' ')
  if (!text) return null
  const zipMatch = text.match(/\b(9\d{4})(?:-\d{4})?\b/)
  const parts = text.split(',').map((p) => p.trim()).filter(Boolean)
  const streetPart = parts[0] ?? ''
  const tokens = streetPart.toLowerCase().split(' ').filter(Boolean)
  if (tokens.length < 2 || !/^\d+$/.test(tokens[0]!)) return null
  let nameTokens = tokens.slice(1)
  const last = nameTokens[nameTokens.length - 1]
  if (last && STREET_SUFFIXES.has(last) && nameTokens.length > 1) {
    nameTokens = nameTokens.slice(0, -1)
  }
  // City: hint wins, else the second comma segment stripped of state/zip noise.
  let city = cityHint?.trim() || null
  if (!city && parts[1]) {
    const cityCandidate = parts[1].replace(/\b(or|oregon)\b/gi, '').replace(/\b9\d{4}(-\d{4})?\b/g, '').trim()
    if (cityCandidate && !/^usa?$/i.test(cityCandidate)) city = cityCandidate
  }
  return {
    streetNumber: tokens[0]!,
    streetNameTokens: nameTokens,
    city,
    postalCode: zipHint?.trim() || zipMatch?.[1] || null,
  }
}

function num(v: unknown): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function str(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : null
  return s || null
}

function fmtDate(iso: string | null): string | null {
  if (!iso) return null
  const s = formatDate(iso, { month: 'short', day: undefined, year: 'numeric' })
  return s === '—' ? null : s
}

const fmtUsd = formatPriceExact

/** Map a listings row to the normalized subject shape. */
export function rowToSubject(row: CmaListingRow): CmaSubject {
  const streetAddress = `${str(row['StreetNumber']) ?? ''} ${str(row['StreetName']) ?? ''}`.trim()
  const status = str(row['StandardStatus'])
  const listPrice = num(row['ListPrice'])
  const listDate = str(row['ListDate']) ?? str(row['OnMarketDate'])
  const listedWhen = fmtDate(listDate)
  let historyLine: string | null = null
  if (status && listPrice) {
    historyLine =
      status.toLowerCase() === 'active'
        ? `Currently listed at ${fmtUsd(listPrice)}${listedWhen ? ` since ${listedWhen}` : ''}.`
        : `Last on market${listedWhen ? ` ${listedWhen}` : ''} at ${fmtUsd(listPrice)} (${status.toLowerCase()}).`
  }
  return {
    listingKey: str(row['ListingKey']),
    mlsNumber: str(row['ListNumber']),
    streetAddress,
    city: str(row['City']) ?? '',
    state: str(row['State']) ?? 'OR',
    postalCode: str(row['PostalCode']),
    subdivision: str(row['SubdivisionName']),
    latitude: num(row['Latitude']),
    longitude: num(row['Longitude']),
    beds: num(row['BedroomsTotal']),
    baths: num(row['BathroomsTotal']),
    sqft: num(row['TotalLivingAreaSqFt']),
    lotAcres: num(row['lot_size_acres']),
    yearBuilt: num(row['year_built']),
    garageSpaces: num(row['garage_spaces']),
    photoUrl: str(row['PhotoURL']),
    publicRemarks: str(row['public_remarks']),
    viewDescription: str(row['view_description']),
    taxAnnual: num(row['tax_annual_amount']),
    standardStatus: status,
    lastListPrice: listPrice,
    lastListDate: listDate,
    listingHistoryLine: historyLine,
  }
}

export interface ResolveSubjectResult {
  subject: CmaSubject | null
  /** Human-readable trace of how the subject was resolved (citations). */
  trace: string
}

/**
 * Resolve the subject from MLS number or address parts. Returns null subject
 * with a trace explaining the miss (the build surfaces it to Matt).
 */
export async function resolveCmaSubject(opts: {
  mlsNumber?: string | null
  rawAddress?: string | null
  city?: string | null
  postalCode?: string | null
}): Promise<ResolveSubjectResult> {
  if (opts.mlsNumber?.trim()) {
    const rows = await findCmaSubjectByMls(opts.mlsNumber.trim())
    if (rows.length > 0) {
      return {
        subject: rowToSubject(rows[0]!),
        trace: `Subject resolved by MLS number ${opts.mlsNumber.trim()} (listings table, newest of ${rows.length} matching rows).`,
      }
    }
  }
  const raw = opts.rawAddress?.trim()
  if (!raw) {
    return { subject: null, trace: 'No MLS number match and no address provided.' }
  }
  const parsed = parseCmaAddress(raw, opts.city, opts.postalCode)
  if (!parsed) {
    return { subject: null, trace: `Address "${raw}" could not be parsed into street number + name.` }
  }
  const namePrefix = parsed.streetNameTokens.join(' ')
  // Two passes: city-scoped, then zip-only (city spellings drift in MLS data).
  let rows = await findCmaSubjectByAddress({
    streetNumber: parsed.streetNumber,
    streetNameIlike: `${namePrefix}%`,
    cityIlike: parsed.city,
  })
  if (rows.length === 0 && parsed.postalCode) {
    rows = await findCmaSubjectByAddress({
      streetNumber: parsed.streetNumber,
      streetNameIlike: `${namePrefix}%`,
      postalCode: parsed.postalCode,
    })
  }
  if (rows.length === 0) {
    return {
      subject: null,
      trace: `No listings row matched StreetNumber=${parsed.streetNumber}, StreetName ILIKE '${namePrefix}%', city ${parsed.city ?? 'any'}, zip ${parsed.postalCode ?? 'any'}. The property may never have been MLS-listed.`,
    }
  }
  return {
    subject: rowToSubject(rows[0]!),
    trace: `Subject resolved by address match: StreetNumber=${parsed.streetNumber}, StreetName ILIKE '${namePrefix}%'${parsed.city ? `, City ILIKE '${parsed.city}'` : ''}. Newest of ${rows.length} matching listings rows.`,
  }
}
