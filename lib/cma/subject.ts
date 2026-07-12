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

/** Leading directional tokens ("1204 NW Iowa" -> direction nw, name iowa). */
const DIRECTIONALS = new Set([
  'n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw',
  'north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest',
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
    yearBuilt: saneYearBuilt(num(row['year_built'])),
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
 * Real-world recency of a listing, for SUBJECT selection. Deliberately EXCLUDES
 * ModificationTimestamp: a bulk MLS re-sync bumps it uniformly across every
 * relisting of a property, which once made an ancient 1998 listing (1 photo,
 * stale 97701 zip) outrank the true 2021 relisting (59 photos, correct 97703
 * zip) simply because the re-sync touched it two hours later. Ranks a
 * currently-on-market listing first, then the latest genuine listing-activity
 * date, then the richest photo set — so a CMA always shows the most recent
 * listing's photos and information for the subject (Matt directive 2026-07-10).
 */
function subjectRecencyKey(row: CmaListingRow): [number, number, number] {
  const status = (str(row['StandardStatus']) ?? '').toLowerCase()
  const onMarket = /(active|pending|coming)/.test(status) ? 1 : 0
  const latest = ['OnMarketDate', 'ListDate', 'CloseDate', 'status_change_timestamp', 'pending_timestamp']
    .reduce((max, key) => {
      const v = row[key]
      const t = v == null ? NaN : Date.parse(String(v))
      return Number.isFinite(t) && t > max ? t : max
    }, 0)
  return [onMarket, latest, num(row['photos_count']) ?? 0]
}

/** Pick the single most recent listing of a property from a candidate set.
 *  Exported for the regression test that locks "CMAs always use the most recent
 *  listing" (Matt directive 2026-07-10). */
export function pickMostRecentListing(rows: CmaListingRow[]): CmaListingRow {
  return rows.slice().sort((a, b) => {
    const ka = subjectRecencyKey(a)
    const kb = subjectRecencyKey(b)
    return kb[0] - ka[0] || kb[1] - ka[1] || kb[2] - ka[2]
  })[0]!
}

/** Every listing for the same property as `row` (relistings differ in zip +
 *  status + MLS number), so subject selection can always land on the newest. */
async function listingsForProperty(row: CmaListingRow): Promise<CmaListingRow[]> {
  const streetNo = str(row['StreetNumber'])
  const streetName = str(row['StreetName'])
  if (!streetNo || !streetName) return [row]
  // No postal filter on purpose: a relisting can carry a re-split/corrected zip.
  const rows = await findCmaSubjectByAddress({
    streetNumber: streetNo,
    streetNameIlike: `${streetName}%`,
    cityIlike: str(row['City']),
  })
  if (rows.length === 0) return [row]
  const anchorKey = str(row['ListingKey'])
  return rows.some((r) => str(r['ListingKey']) === anchorKey) ? rows : [...rows, row]
}

function subjectTrace(entry: string, best: CmaListingRow, poolSize: number): string {
  const when = fmtDate(str(best['OnMarketDate']) ?? str(best['ListDate']) ?? str(best['CloseDate']))
  return (
    `${entry} Subject uses the MOST RECENT listing of the property: MLS ${str(best['ListNumber']) ?? '—'}, ` +
    `${(str(best['StandardStatus']) ?? '—').toLowerCase()}, ${when !== '—' ? `listed ${when}, ` : ''}` +
    `${num(best['photos_count']) ?? 0} photo(s), zip ${str(best['PostalCode']) ?? '—'} ` +
    `(chosen from ${poolSize} listing row(s) by real listing-activity date, not last-modified).`
  )
}

/**
 * Resolve the subject from MLS number or address parts. Always lands on the MOST
 * RECENT listing of the property so the CMA carries current photos, specs, and
 * zip. Returns null subject with a trace explaining the miss.
 */
export async function resolveCmaSubject(opts: {
  mlsNumber?: string | null
  rawAddress?: string | null
  city?: string | null
  postalCode?: string | null
}): Promise<ResolveSubjectResult> {
  // Entry by MLS: resolve the anchor, then gather EVERY relisting of that
  // property so an old MLS number still upgrades to the newest listing.
  if (opts.mlsNumber?.trim()) {
    const rows = await findCmaSubjectByMls(opts.mlsNumber.trim())
    if (rows.length > 0) {
      const pool = await listingsForProperty(rows[0]!)
      const best = pickMostRecentListing(pool)
      return { subject: rowToSubject(best), trace: subjectTrace(`Entered by MLS ${opts.mlsNumber.trim()}.`, best, pool.length) }
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
  // Name-prefix candidates. Central Oregon MLS stores StreetName WITHOUT the
  // directional in ~99.9% of rows ("Iowa", not "NW Iowa"), so "1204 NW Iowa Ave"
  // must fall back to the direction-stripped name — otherwise every westside
  // Bend address (NW/SW ...) fails to resolve. The full name is still tried
  // first because ~600 rows DO carry a direction inside StreetName.
  const namePrefix = parsed.streetNameTokens.join(' ')
  const prefixes = [namePrefix]
  const firstToken = parsed.streetNameTokens[0]
  if (parsed.streetNameTokens.length > 1 && firstToken && DIRECTIONALS.has(firstToken)) {
    prefixes.push(parsed.streetNameTokens.slice(1).join(' '))
  }
  for (const prefix of prefixes) {
    // Two passes: city-scoped, then zip-only (city spellings drift in MLS data).
    let rows = await findCmaSubjectByAddress({
      streetNumber: parsed.streetNumber,
      streetNameIlike: `${prefix}%`,
      cityIlike: parsed.city,
    })
    if (rows.length === 0 && parsed.postalCode) {
      rows = await findCmaSubjectByAddress({
        streetNumber: parsed.streetNumber,
        streetNameIlike: `${prefix}%`,
        postalCode: parsed.postalCode,
      })
    }
    if (rows.length > 0) {
      const best = pickMostRecentListing(rows)
      return {
        subject: rowToSubject(best),
        trace: subjectTrace(
          `Entered by address "${raw}" (StreetName ILIKE '${prefix}%').`,
          best,
          rows.length,
        ),
      }
    }
  }
  return {
    subject: null,
    trace: `No listings row matched StreetNumber=${parsed.streetNumber}, StreetName ILIKE '${prefixes.map((c) => `${c}%`).join("' or '")}', city ${parsed.city ?? 'any'}, zip ${parsed.postalCode ?? 'any'}. The property may never have been MLS-listed.`,
  }
}

/**
 * MLS data-entry guard: year_built sometimes carries a duplicated sqft value
 * (live example 2026-07-11: a fresh listing shipped year_built=2146, its own
 * square footage — caught by the adversarial CMA audit). Implausible years
 * resolve to null so no report states an impossible fact.
 */
export function saneYearBuilt(y: number | null): number | null {
  if (y == null) return null
  const maxYear = new Date().getFullYear() + 2
  return y >= 1850 && y <= maxYear ? y : null
}
