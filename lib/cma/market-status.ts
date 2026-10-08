/**
 * Status-grid and 90-day sold-band math for CMA chapters.
 * Density from an RPR packet. Our grain and our pricing number.
 * Never a ZIP dump. Never an AVM.
 */

import type { CmaAdjustedComp, CmaPricing, CmaSubject } from '@/lib/cma/types'
import { compAreaContains, compAreaIn, compAreaPhrase, type CompArea } from '@/lib/pricing/comp-area'
import { countWord } from '@/lib/pricing/estimate'
import { keepSameProductType, letterProductMatch } from '@/lib/cma/market-area'
import { realSubdivision } from '@/lib/cma/comp-tiers'
import { roomNotedSentence, sameAreaFit, sameAreaSubject, type SameAreaCandidate } from '@/lib/cma/same-area-fit'
import type { CmaMarketAreaRow } from '@/lib/data/cma/marketAreaReads'
import { daysOnMarketFrom, listingHistoryLine as buildListingHistoryLine } from '@/lib/cma/listing-history-line'
import { cameOffStatus, lastActiveRun, pacificDay, sameStatus, type ActiveRun } from '@/lib/cma/listing-status'

export type CmaStatusBucket = {
  key: 'selected' | 'active' | 'pending' | 'expired' | 'closed'
  label: string
  count: number
  low: number | null
  median: number | null
  high: number | null
  medianPpsf: number | null
  medianDom: number | null
}

export type CmaSoldBand = {
  count: number
  low: number | null
  median: number | null
  high: number | null
  bedsLabel: string
  source: string
}

export type CmaListingTrendPoint = {
  month: string
  newListings: number
  medianAsk: number | null
}

/** Closed sale prices vs last asks that never sold, in the subject's list band. */
export type CmaBandOutcomes = {
  lo: number
  hi: number
  sold: number[]
  unsold: number[]
  list: number
  lastAsk: number | null
  soldShown: number
  unsoldShown: number
  soldTotal: number
  unsoldTotal: number
  label: string
  source: string
}

/** Named homes like the subject that came off without a sale. */
export type CmaExpiredPeer = {
  listingKey: string
  address: string
  listPrice: number
  originalListPrice: number | null
  status: string
  /** Days on the market: the day it went Active to the day it left Active. */
  daysOnMarket: number | null
  /** Cycle start — used to label or collapse multi-cycle peers. */
  onMarketDate: string | null
  /**
   * YYYY-MM-DD (Pacific) it left Active, from the MLS status log. Absent on rows
   * built before the log was read.
   */
  offMarketDate?: string | null
  /** The status it left Active for, when that differs from `status` (withdrawn, then expired). */
  cameOffAs?: string | null
  /** YYYY-MM-DD (Pacific) `status` took effect: the date the column prints beside it. */
  statusDate?: string | null
  photoUrl: string | null
  listingHistoryLine: string | null
  /**
   * Why this home sat, from the row and nothing else: days on the market, what
   * it did with its opening ask, and its last ask per square foot against what
   * the sales behind the subject's price actually closed at. Null when the row
   * carries none of the three — a peer with no evidence gets no explanation.
   */
  whyItSat?: string | null
  beds: number | null
  /** BathroomsTotal, which counts a half bath whole. Print through `printedBaths`, never raw. */
  baths: number | null
  /** MLS full / half bath split (listings.baths_full / baths_half), when read. */
  bathsFull?: number | null
  bathsHalf?: number | null
  sqft: number | null
  yearBuilt: number | null
  lotAcres: number | null
  propertySubType: string | null
  /** MLS subdivision, so a plat boundary can be re-tested at render. */
  subdivision?: string | null
  /**
   * The recorded plat polygon the area read put the home in (null when tested
   * and none holds it), so the render re-tests the polygon, not the MLS
   * spelling (rule 24; reader review 2026-10-08). Absent on rows stored
   * before then, which keep the name test.
   */
  platSlug?: string | null
  latitude: number | null
  longitude: number | null
  /** Rule 4: one room apart on the subject's own ground, kept and disclosed, zero dollars. */
  roomDifference?: Array<'beds' | 'baths'> | null
}

export type CmaMarketArea = {
  grain: 'subdivision' | 'city-similar'
  label: string
  source: string
  priceLo: number
  priceHi: number
  selected: CmaStatusBucket
  active: CmaStatusBucket | null
  pending: CmaStatusBucket | null
  expired: CmaStatusBucket | null
  closed: CmaStatusBucket | null
  sold90: CmaSoldBand | null
  listingTrend: CmaListingTrendPoint[] | null
  /** Optional on older stored args. */
  outcomes?: CmaBandOutcomes | null
  /** Named expired/withdrawn peers in the same band — letter story beat 2. */
  expiredPeers?: CmaExpiredPeer[]
}

const TERMINAL_OFF = new Set(['Expired', 'Withdrawn', 'Canceled'])

/** List band around the recommended number. Wider than live competition (±10%) so a failed ask above the rec still sits on the axis. */
export const BAND_OUTCOME_BELOW = 0.85
export const BAND_OUTCOME_ABOVE = 1.15
const OUTCOME_CAP = 80

function spreadCap(values: number[], cap: number): number[] {
  if (values.length <= cap) return values
  const s = [...values].sort((a, b) => a - b)
  return Array.from({ length: cap }, (_, i) => s[Math.round((i * (s.length - 1)) / (cap - 1))]!)
}

export function computeBandOutcomes(input: {
  rows: CmaMarketAreaRow[]
  recommended: number
  lastAsk: number | null
  label: string
}): CmaBandOutcomes | null {
  const rec = input.recommended
  if (!(rec > 0)) return null
  let lo = Math.round((rec * BAND_OUTCOME_BELOW) / 1000) * 1000
  let hi = Math.round((rec * BAND_OUTCOME_ABOVE) / 1000) * 1000
  const lastAsk =
    input.lastAsk != null && Number.isFinite(input.lastAsk) && input.lastAsk > 0 ? input.lastAsk : null
  if (lastAsk != null && lastAsk > hi) hi = Math.round(lastAsk / 1000) * 1000
  if (lastAsk != null && lastAsk < lo) lo = Math.round(lastAsk / 1000) * 1000

  const sold = input.rows
    .filter((r) => r.StandardStatus === 'Closed')
    .map((r) => num(r.ClosePrice))
    .filter((n): n is number => n != null && n >= lo && n <= hi)
  const unsold = input.rows
    .filter((r) => TERMINAL_OFF.has(r.StandardStatus))
    .map((r) => num(r.ListPrice))
    .filter((n): n is number => n != null && n >= lo && n <= hi)
  if (sold.length < 3 || unsold.length < 1) return null

  const soldShown = spreadCap(sold, OUTCOME_CAP)
  const unsoldShown = spreadCap(unsold, OUTCOME_CAP)
  const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
  return {
    lo,
    hi,
    sold: soldShown,
    unsold: unsoldShown,
    list: rec,
    lastAsk,
    soldShown: soldShown.length,
    unsoldShown: unsoldShown.length,
    soldTotal: sold.length,
    unsoldTotal: unsold.length,
    label: input.label,
    source: `Oregon Data Share MLS. ${input.label}, ${usd(lo)} to ${usd(hi)}, last 12 months. Closed = sale price. Expired, withdrawn, and canceled = last ask.${
      sold.length > soldShown.length || unsold.length > unsoldShown.length
        ? ` ${soldShown.length} of ${sold.length} sales and ${unsoldShown.length} of ${unsold.length} unsold listings shown, spaced across the range.`
        : ''
    }`,
  }
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}

export function marketAreaPriceBand(anchor: number): { lo: number; hi: number } | null {
  if (!Number.isFinite(anchor) || anchor < 50_000) return null
  return {
    lo: Math.round((anchor * 0.55) / 1000) * 1000,
    hi: Math.round((anchor * 1.85) / 1000) * 1000,
  }
}

export function similarBedRange(beds: number | null): { lo: number; hi: number } | null {
  if (beds == null || !Number.isFinite(beds) || beds < 1) return null
  return { lo: Math.max(1, beds - 1), hi: beds + 1 }
}

function num(v: unknown): number | null {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * A count off an MLS row, blank kept blank. `num` reads null as 0, and a blank
 * bed or bath count read as zero would fail the one-room rule a blank passes
 * (an unknown count is a match, rule 4).
 */
function countOrNull(v: unknown): number | null {
  if (v == null || (typeof v === 'string' && v.trim() === '')) return null
  return num(v)
}



export type ExpiredPeerSubject = Pick<
  CmaSubject,
  | 'beds'
  | 'sqft'
  | 'latitude'
  | 'longitude'
  | 'listingKey'
  | 'mlsNumber'
  | 'streetAddress'
> & {
  /** Absent on older callers. A blank type is not a different product. */
  propertySubType?: string | null
  /** The rest of what the sales rules read (lib/cma/same-area-fit.ts). Absent on older callers. */
  baths?: number | null
  yearBuilt?: number | null
  subdivision?: string | null
  subdivisionSlug?: string | null
  city?: string | null
  /** The subject's remarks: the multi-unit and ADU walls read them (rule 24). Absent states no ADU. */
  publicRemarks?: string | null
}

function peerAddress(row: CmaMarketAreaRow): string {
  return [row.StreetNumber, row.StreetName]
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join(' ')
}

/** Fold street noise so "15935 Woodchip" matches "15935 Woodchip Ln". */
export function normalizePeerAddress(address: string): string {
  return address
    .toLowerCase()
    .replace(/[.,#]/g, '')
    .replace(/\b(street|st|avenue|ave|road|rd|drive|dr|lane|ln|court|ct|way|loop|circle|cir|place|pl|boulevard|blvd|terrace|ter)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const ADDRESS_DIRECTIONALS = new Set(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw', 'north', 'south', 'east', 'west'])

/**
 * One house's street address with the directional folded away as well.
 *
 * The MLS stores StreetName without the directional on most rows, and the
 * subject's own line carries it: 3062 NW Kelly Hill's own Active listing came
 * back from the band read as "3062 Kelly Hill" and was drawn as its own
 * competitor at 0.00 miles (reader review 2026-10-08). Only for telling
 * whether two records are the same house; the printed address is untouched.
 */
export function sameHouseAddressKey(address: string): string {
  return normalizePeerAddress(address)
    .split(' ')
    .filter((w, _i, all) => !(ADDRESS_DIRECTIONALS.has(w) && all.length > 2))
    .join(' ')
}

function sameHouse(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = a?.trim() ? sameHouseAddressKey(a) : ''
  const y = b?.trim() ? sameHouseAddressKey(b) : ''
  return x !== '' && x === y
}

/**
 * THE HOUSE SOLD AFTER IT CAME OFF (cma-1648-pheasant, reader review
 * 2026-10-08). The letter said "One home in Pheasant Hill, Neal, Meadowview
 * Estate and North Pilot Butte came off the market without selling in the
 * last 12 months." The only unsold cycles there besides the subject's own
 * were 2639 Harvey (canceled Jun 8, 2026, relisted Jun 12, closed Jul 31 at
 * $549,000) and 1382 Drost (canceled Jun 9, relisted Jun 10, closed Jul 16 at
 * $645,000). Both houses sold. A cancel and relist is a re-entry, not a home
 * that failed to sell.
 *
 * So an unsold cycle is not a came-off home when a LATER cycle of the same
 * house closed, or is for sale or under contract now (the rule the live band
 * already applies through `liveAddresses`, for every relist). Later means it
 * went on the market after this cycle did: an earlier sale of the same house
 * (1382 Drost closed in 2024 too) never counts. The same house is the same
 * parcel, or the same street address (sameHouseAddressKey, the fold the
 * subject test uses) when the parcels do not say otherwise, in the same city
 * when both rows carry one.
 */
export const RELIST_OUTCOME_STATUSES = ['Closed', 'Active', 'Coming Soon', 'Active Under Contract', 'Pending'] as const
const RELIST_OUTCOME = new Set<string>(RELIST_OUTCOME_STATUSES)

/** One MLS record of a house, as the relist test reads it. */
export type HouseCycleRecord = {
  ListingKey?: string | null
  StreetNumber?: string | null
  StreetName?: string | null
  City?: string | null
  parcel_number?: string | null
  StandardStatus: string
  OnMarketDate?: string | null
  ListDate?: string | null
  CloseDate?: string | null
  status_change_timestamp?: string | null
}

function isoMs(raw: string | null | undefined): number | null {
  const s = raw?.trim()
  if (!s) return null
  const t = new Date(s.length <= 10 ? `${s}T12:00:00.000Z` : s).getTime()
  return Number.isFinite(t) ? t : null
}

function parcelKey(raw: string | null | undefined): string {
  return (raw ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function recordAddressKey(r: Pick<HouseCycleRecord, 'StreetNumber' | 'StreetName'>): string {
  const street = (r.StreetName ?? '').trim()
  if (!street) return ''
  return sameHouseAddressKey(`${(r.StreetNumber ?? '').trim()} ${street}`.trim())
}

function sameHouseRecord(a: HouseCycleRecord, b: HouseCycleRecord): boolean {
  const ca = (a.City ?? '').trim().toLowerCase()
  const cb = (b.City ?? '').trim().toLowerCase()
  if (ca && cb && ca !== cb) return false
  const pa = parcelKey(a.parcel_number)
  const pb = parcelKey(b.parcel_number)
  if (pa && pb) return pa === pb
  const xa = recordAddressKey(a)
  return xa !== '' && xa === recordAddressKey(b)
}

/**
 * The later cycle of the same house that closed or is on the market now, or
 * null when there is none (or the dates cannot say which came first).
 */
export function laterOutcomeCycle(
  row: HouseCycleRecord,
  records: readonly HouseCycleRecord[],
): HouseCycleRecord | null {
  const key = (row.ListingKey ?? '').trim()
  const rowStart = isoMs(row.OnMarketDate) ?? isoMs(row.ListDate)
  const rowOff = isoMs(row.status_change_timestamp)
  for (const other of records) {
    if (!RELIST_OUTCOME.has(other.StandardStatus)) continue
    const otherKey = (other.ListingKey ?? '').trim()
    if (key && otherKey === key) continue
    if (!sameHouseRecord(row, other)) continue
    const otherStart = isoMs(other.OnMarketDate) ?? isoMs(other.ListDate)
    if (otherStart != null && rowStart != null) {
      if (otherStart > rowStart) return other
      continue
    }
    if (otherStart != null && rowOff != null) {
      if (otherStart >= rowOff) return other
      continue
    }
    const closed = other.StandardStatus === 'Closed' ? isoMs(other.CloseDate) : null
    const after = rowOff ?? rowStart
    if (closed != null && after != null && closed > after) return other
  }
  return null
}

/** The unsold cycles whose house did not later sell or come back on the market, and the ones that did. */
export function dropRelistedUnsoldCycles<T extends HouseCycleRecord>(
  rows: readonly T[],
  records: readonly HouseCycleRecord[],
): { kept: T[]; dropped: Array<{ row: T; later: HouseCycleRecord }> } {
  const kept: T[] = []
  const dropped: Array<{ row: T; later: HouseCycleRecord }> = []
  for (const row of rows) {
    const later = records.length > 0 ? laterOutcomeCycle(row, records) : null
    if (later) dropped.push({ row, later })
    else kept.push(row)
  }
  return { kept, dropped }
}

function peerKeyIds(subject: Pick<CmaSubject, 'listingKey' | 'mlsNumber'>): Set<string> {
  const ids = new Set<string>()
  for (const raw of [subject.listingKey, subject.mlsNumber]) {
    const s = raw?.trim()
    if (s) ids.add(s.toLowerCase())
  }
  return ids
}

/** True when this market-area row is the subject listing (not a peer). */
export function isSubjectExpiredRow(
  row: CmaMarketAreaRow,
  subject: Pick<CmaSubject, 'listingKey' | 'mlsNumber' | 'streetAddress'>,
): boolean {
  const ids = peerKeyIds(subject)
  const key = String(row.ListingKey ?? '').trim().toLowerCase()
  if (key && ids.has(key)) return true
  return sameHouse(peerAddress(row), subject.streetAddress)
}

/**
 * True when a named record (an unsold peer, a home for sale or under
 * contract) is the subject itself: its own listing key or MLS number, or any
 * other record of the same house by address (an earlier cycle, a duplicate
 * entry). Every competition, came-off and status set excludes it.
 */
export function peerMatchesSubject(
  peer: { listingKey?: string | null; address?: string | null },
  subject: Pick<CmaSubject, 'listingKey' | 'mlsNumber' | 'streetAddress'>,
): boolean {
  const ids = peerKeyIds(subject)
  const key = (peer.listingKey ?? '').trim().toLowerCase()
  if (key && ids.has(key)) return true
  return sameHouse(peer.address, subject.streetAddress)
}

/** An unsold MLS row as the one fit reads it (lib/cma/same-area-fit.ts). */
function rowToCandidate(row: CmaMarketAreaRow): SameAreaCandidate {
  return {
    address: peerAddress(row) || null,
    city: row.City ?? null,
    subdivision: row.SubdivisionName ?? null,
    // The polygon the area read placed it in, when it read one.
    subdivisionSlug: row.plat_slug,
    latitude: row.Latitude ?? null,
    longitude: row.Longitude ?? null,
    beds: countOrNull(row.BedroomsTotal),
    baths: countOrNull(row.BathroomsTotal),
    bathsFull: countOrNull(row.baths_full),
    bathsHalf: countOrNull(row.baths_half),
    sqft: countOrNull(row.TotalLivingAreaSqFt),
    yearBuilt: row.year_built ?? null,
    propertySubType: row.property_sub_type ?? null,
    publicRemarks: row.public_remarks ?? null,
  }
}

function peerDist2(row: CmaMarketAreaRow, lat: number, lng: number): number {
  if (row.Latitude == null || row.Longitude == null) return Number.POSITIVE_INFINITY
  const dLat = row.Latitude - lat
  const dLng = row.Longitude - lng
  return dLat * dLat + dLng * dLng
}

/**
 * The last stretch an unsold listing was on the market, from its status log
 * when the read attached one, else its own on-market and off-market days.
 */
function peerRun(row: CmaMarketAreaRow): ActiveRun | null {
  return lastActiveRun({
    changes: row.statusChanges ?? [],
    onMarketDate: row.OnMarketDate ?? row.ListDate,
    offMarketDate: row.off_market_date ?? row.status_change_timestamp ?? row.CloseDate,
    status: row.StandardStatus,
  })
}

/**
 * DAYS ON THE MARKET END THE DAY IT LEFT ACTIVE (reader review 2026-10-08).
 *
 * 3204 Spring Creek went Active Oct 16, was withdrawn Jan 20 and expired Jul
 * 31. Its MLS DaysOnMarket ran to the expiry, and both letters said it "came
 * off after 288 days". The status log gives 96. Without a log the count is its
 * on-market day to its off-market day, as calendar days between Pacific days,
 * and the MLS figure only when neither date is on the row.
 */
function peerDom(row: CmaMarketAreaRow, run: ActiveRun | null): number | null {
  if (run?.days != null) return run.days
  const d = num(row.CumulativeDaysOnMarket) ?? num(row.DaysOnMarket)
  if (d != null && d > 0) return d
  return daysOnMarketFrom({ onMarketDate: row.OnMarketDate ?? row.ListDate })
}

function onMarketSortKey(iso: string | null | undefined): number {
  if (!iso) return 0
  const t = new Date(iso.length <= 10 ? `${iso}T12:00:00.000Z` : iso).getTime()
  return Number.isFinite(t) ? t : 0
}

/**
 * Same street twice (two failed list cycles) → one peer column.
 * Primary facts from the newest cycle; Listing history carries every cycle.
 */
export function collapseExpiredPeerCycles(peers: readonly CmaExpiredPeer[]): CmaExpiredPeer[] {
  const byAddr = new Map<string, CmaExpiredPeer[]>()
  const order: string[] = []
  for (const peer of peers) {
    const key = normalizePeerAddress(peer.address) || peer.listingKey
    if (!byAddr.has(key)) {
      byAddr.set(key, [])
      order.push(key)
    }
    byAddr.get(key)!.push(peer)
  }
  return order.map((key) => {
    const group = byAddr.get(key)!
    if (group.length === 1) return group[0]!
    const sorted = [...group].sort(
      (a, b) => onMarketSortKey(b.onMarketDate) - onMarketSortKey(a.onMarketDate),
    )
    const primary = sorted[0]!
    const histories = sorted
      .map((p) => p.listingHistoryLine?.trim())
      .filter((line): line is string => Boolean(line))
    // De-dupe identical lines if the feed repeated a cycle.
    const uniqueHist: string[] = []
    for (const line of histories) {
      if (!uniqueHist.includes(line)) uniqueHist.push(line)
    }
    return {
      ...primary,
      listingHistoryLine: uniqueHist.length > 0 ? uniqueHist.join(' · ') : primary.listingHistoryLine,
    }
  })
}

/**
 * Cycle-month label when the same address must stay as separate columns.
 * Used only if collapse is bypassed; prefer collapseExpiredPeerCycles.
 */
export function expiredPeerCycleLabel(peer: CmaExpiredPeer): string {
  const addr = peer.address.trim()
  const raw = peer.onMarketDate?.trim()
  if (!raw) return addr
  const d = new Date(raw.length <= 10 ? `${raw}T12:00:00.000Z` : raw)
  if (Number.isNaN(d.getTime())) return addr
  const mon = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
  const yy = String(d.getUTCFullYear()).slice(-2)
  const street = addr.replace(/^\d+\s+/, '').trim() || addr
  return `${street} · ${mon} '${yy}`
}

export function pickExpiredPeers(
  rows: readonly CmaMarketAreaRow[],
  subject: ExpiredPeerSubject,
  area?: CompArea | null,
): CmaExpiredPeer[] {
  const named = rows
    .map((row) => {
      if (isSubjectExpiredRow(row, subject)) return null
      if (!letterProductMatch(subject.propertySubType, row.property_sub_type ?? null)) return null
      const address = peerAddress(row)
      const listPrice = Number(row.ListPrice)
      if (!address || !Number.isFinite(listPrice) || listPrice <= 0) return null
      const key = String(row.ListingKey ?? address).trim()
      if (!key) return null
      const originalListPrice =
        row.OriginalListPrice != null && Number.isFinite(Number(row.OriginalListPrice))
          ? Number(row.OriginalListPrice)
          : null
      const run = peerRun(row)
      const onMarketDate = (run?.source === 'status-history' ? run.from : null) ?? row.OnMarketDate ?? row.ListDate ?? null
      const daysOnMarket = peerDom(row, run)
      const status = row.StandardStatus
      const leftAs = run?.source === 'status-history' ? run.leftAs : null
      const cameOffAs = leftAs && !sameStatus(leftAs, status) ? leftAs : null
      const statusDay = pacificDay(row.status_change_timestamp ?? row.off_market_date ?? null)
      const peer: CmaExpiredPeer = {
        listingKey: key,
        address,
        listPrice,
        originalListPrice,
        status,
        daysOnMarket,
        onMarketDate,
        ...(run?.to ? { offMarketDate: run.to } : {}),
        ...(cameOffAs ? { cameOffAs } : {}),
        ...(statusDay ? { statusDate: statusDay } : {}),
        photoUrl: row.PhotoURL ?? null,
        listingHistoryLine: buildListingHistoryLine({
          listPrice,
          originalListPrice,
          status: cameOffStatus(status, cameOffAs),
          onMarketDate,
          daysOnMarket,
        }),
        beds: row.BedroomsTotal,
        baths: row.BathroomsTotal,
        bathsFull: countOrNull(row.baths_full),
        bathsHalf: countOrNull(row.baths_half),
        sqft: row.TotalLivingAreaSqFt,
        yearBuilt: row.year_built ?? null,
        lotAcres: row.lot_size_acres ?? null,
        propertySubType: row.property_sub_type ?? null,
        subdivision: row.SubdivisionName ?? null,
        ...(row.plat_slug !== undefined ? { platSlug: row.plat_slug } : {}),
        latitude: row.Latitude ?? null,
        longitude: row.Longitude ?? null,
      }
      return { row, peer }
    })
    .filter((x): x is { row: CmaMarketAreaRow; peer: CmaExpiredPeer } => x != null)

  // Only a home that passes the sales rules inside the sales area is a peer
  // (Matt 2026-10-07, rule 24). A wide price band across a neighborhood used
  // to print unlike homes once nothing close was in the first window, and
  // then the window stopped. A home kept one room apart on the subject's own
  // ground carries the note so the sentence can disclose it.
  const pool = named.flatMap((x) => {
    const fit = sameAreaFit(area ?? null, subject, rowToCandidate(x.row))
    return fit.ok ? [{ row: x.row, peer: { ...x.peer, roomDifference: fit.roomDifference } }] : []
  })
  const slat = subject.latitude
  const slng = subject.longitude
  const ranked =
    slat != null && slng != null && Number.isFinite(slat) && Number.isFinite(slng)
      ? [...pool].sort((a, b) => peerDist2(a.row, slat, slng) - peerDist2(b.row, slat, slng))
      : [...pool]
  const seenKeys = new Set<string>()
  const picked: CmaExpiredPeer[] = []
  for (const item of ranked) {
    if (seenKeys.has(item.peer.listingKey)) continue
    seenKeys.add(item.peer.listingKey)
    picked.push(item.peer)
  }
  // Every peer the set counted. A column cap made the sentence name homes
  // the table left off.
  return collapseExpiredPeerCycles(picked)
}

function inBand(price: number | null, lo: number, hi: number): boolean {
  return price != null && price >= lo && price <= hi
}

function inBeds(beds: number | null, range: { lo: number; hi: number } | null): boolean {
  if (!range) return true
  return beds != null && beds >= range.lo && beds <= range.hi
}

function rowPrice(row: CmaMarketAreaRow): number | null {
  if (row.StandardStatus === 'Closed') return num(row.ClosePrice)
  return num(row.ListPrice)
}

function rowDom(row: CmaMarketAreaRow): number | null {
  const d = num(row.CumulativeDaysOnMarket) ?? num(row.DaysOnMarket)
  return d != null && d > 0 ? d : null
}

function rowSqft(row: CmaMarketAreaRow): number | null {
  const s = num(row.TotalLivingAreaSqFt)
  return s != null && s > 0 ? s : null
}

function bucketFrom(
  key: CmaStatusBucket['key'],
  label: string,
  prices: number[],
  ppsfs: number[],
  doms: number[],
): CmaStatusBucket | null {
  if (prices.length === 0) return null
  return {
    key,
    label,
    count: prices.length,
    low: Math.min(...prices),
    median: median(prices),
    high: Math.max(...prices),
    medianPpsf: median(ppsfs),
    medianDom: median(doms),
  }
}

function selectedBucket(comps: CmaAdjustedComp[]): CmaStatusBucket {
  const prices = comps.map((c) => c.closePrice).filter((n) => n > 0)
  const ppsfs = comps.filter((c) => c.closePrice > 0 && c.sqft > 0).map((c) => c.closePrice / c.sqft)
  const doms = comps.map((c) => c.domTotal).filter((n): n is number => n != null && n >= 0)
  return (
    bucketFrom('selected', 'Used for the recommend', prices, ppsfs, doms) ?? {
      key: 'selected',
      label: 'Used for the recommend',
      count: comps.length,
      low: null,
      median: null,
      high: null,
      medianPpsf: null,
      medianDom: null,
    }
  )
}

function monthKey(iso: string | null | undefined): string | null {
  if (!iso || iso.length < 7) return null
  return iso.slice(0, 7)
}

function listingTrend(rows: CmaMarketAreaRow[], asOf: Date): CmaListingTrendPoint[] | null {
  const months: CmaListingTrendPoint[] = []
  for (let i = 12; i >= 1; i--) {
    const d = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() - i, 1))
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    const opened = rows.filter((r) => monthKey(r.OnMarketDate ?? r.ListDate) === key)
    const asks = opened.map((r) => num(r.ListPrice)).filter((n): n is number => n != null && n > 0)
    months.push({ month: key, newListings: opened.length, medianAsk: median(asks) })
  }
  return months.some((m) => m.newListings > 0) ? months : null
}

export function computeMarketArea(input: {
  rows: CmaMarketAreaRow[]
  subject: CmaSubject
  comps: CmaAdjustedComp[]
  pricing: CmaPricing
  asOf?: Date
}): CmaMarketArea | null {
  const asOf = input.asOf ?? new Date()
  const anchor = input.pricing.recommended || input.subject.lastListPrice
  const band = marketAreaPriceBand(anchor ?? 0)
  if (!band) return null
  const beds = similarBedRange(input.subject.beds)
  // An MLS placeholder ('N/A', 'None', …) names no subdivision, so it can never
  // be the grain OR the place in a source line. 62,974 `listings` rows carry
  // the literal 'N/A' (see realSubdivision); scoping on it returns citywide
  // strangers and then labels them a subdivision.
  const subdivision = realSubdivision(input.subject.subdivision) ?? ''
  const since90 = new Date(asOf.getTime() - 90 * 24 * 3600e3).toISOString().slice(0, 10)

  const inPriceAndBeds = (row: CmaMarketAreaRow) =>
    inBand(rowPrice(row), band.lo, band.hi) &&
    inBeds(num(row.BedroomsTotal), beds) &&
    keepSameProductType(input.subject.propertySubType, row.property_sub_type ?? null)

  const comparable = input.rows.filter(inPriceAndBeds)
  const subRows = subdivision ? comparable.filter((r) => (r.SubdivisionName ?? '').trim() === subdivision) : []
  const subClosed = subRows.filter((r) => r.StandardStatus === 'Closed')
  const useSub = Boolean(subdivision) && subClosed.length >= 5
  const scoped = useSub ? subRows : comparable
  const grain: CmaMarketArea['grain'] = useSub ? 'subdivision' : 'city-similar'
  const bedsLabel =
    beds != null ? `${beds.lo === beds.hi ? beds.lo : `${beds.lo} to ${beds.hi}`} bedroom` : 'similar'
  const label = useSub ? `${subdivision}` : `${bedsLabel} homes in ${input.subject.city}`

  const live = (status: string) => scoped.filter((r) => r.StandardStatus === status)
  const expired = scoped.filter((r) => TERMINAL_OFF.has(r.StandardStatus))
  const closed = scoped.filter((r) => r.StandardStatus === 'Closed')

  const pack = (key: CmaStatusBucket['key'], label: string, rows: CmaMarketAreaRow[]) => {
    const prices = rows.map(rowPrice).filter((n): n is number => n != null && n > 0)
    const ppsfs = rows
      .map((r) => {
        const p = rowPrice(r)
        const s = rowSqft(r)
        return p != null && s != null ? p / s : null
      })
      .filter((n): n is number => n != null)
    const doms = rows.map(rowDom).filter((n): n is number => n != null)
    return bucketFrom(key, label, prices, ppsfs, doms)
  }

  const sold90Rows = closed.filter((r) => (r.CloseDate ?? '') >= since90)
  const sold90Prices = sold90Rows.map((r) => num(r.ClosePrice)).filter((n): n is number => n != null && n > 0)
  const place = useSub ? subdivision : input.subject.city
  const where = useSub ? place : `${bedsLabel} homes in ${place}`
  const priced = `priced $${band.lo.toLocaleString('en-US')} to $${band.hi.toLocaleString('en-US')}`
  const sold90: CmaSoldBand | null =
    sold90Prices.length >= 3
      ? {
          count: sold90Prices.length,
          low: Math.min(...sold90Prices),
          median: median(sold90Prices),
          high: Math.max(...sold90Prices),
          bedsLabel,
          source: `Oregon Data Share MLS. Closed ${bedsLabel} sales in ${place} in the last 90 days.`,
        }
      : null

  // These rows are citywide and read only when the document carries no
  // expiredPeers set (lib/cma/matrix-sets.ts), so no area is tested here; the
  // product, room, size and year rules still are. A cycle whose house later
  // closed or is listed again (in the same twelve-month read) is not a
  // came-off home.
  const expiredPeers = pickExpiredPeers(
    dropRelistedUnsoldCycles(expired, input.rows).kept,
    {
      ...sameAreaSubject(input.subject),
      streetAddress: input.subject.streetAddress,
      listingKey: input.subject.listingKey,
      mlsNumber: input.subject.mlsNumber,
    },
    null,
  )

  return {
    grain,
    label,
    source: `Oregon Data Share MLS. ${label}, priced $${band.lo.toLocaleString('en-US')} to $${band.hi.toLocaleString('en-US')}, last 12 months.`,
    priceLo: band.lo,
    priceHi: band.hi,
    selected: selectedBucket(input.comps),
    active: pack('active', `For sale now in ${where}, ${priced}`, live('Active')),
    pending: pack('pending', `Under contract in ${where}, ${priced}`, live('Pending')),
    expired: pack('expired', `Came off unsold in ${where}, last 12 months, ${priced}`, expired),
    closed: pack('closed', `Closed sales in ${where}, last 12 months, ${priced}`, closed),
    sold90,
    listingTrend: listingTrend(scoped, asOf),
    outcomes: computeBandOutcomes({
      rows: scoped,
      recommended: input.pricing.recommended,
      lastAsk: input.subject.lastListPrice,
      label,
    }),
    expiredPeers,
  }
}

/**
 * THE PEER LADDER — Matt 2026-09-08: "when we're looking at expireds, we can go
 * back until we have at least 3 expired, withdrawn, or canceled, and then we
 * have to be able to tell the story."
 *
 * Twelve months was a fixed window whether it held thirty failed listings or
 * one. These are the steps it opens through, stopping at the first that holds
 * three. The rows come from ONE read at the widest step
 * (getCmaAreaUnsoldCycles), so the ladder is a walk, not six queries.
 */
export const EXPIRED_PEER_WINDOWS = [3, 6, 9, 12, 18, 24] as const
export const EXPIRED_PEER_MIN = 3

export type CmaExpiredPeerSet = {
  /** The area these came from — the same object the comps and the competition use. */
  area: CompArea
  /** The window that produced them. */
  windowMonths: number
  /** Every window the ladder tried, in order. */
  windowsTried: number[]
  /** The window it had to open to, or null when the tightest one already held three. */
  widenedTo: number | null
  count: number
  /** Every unsold home inside the area, the band and the window, one per address. */
  areaTotal: number
  /**
   * Homes like the subject the map can show, after same-address cycles collapse.
   * Unlike homes stay in `areaTotal` and are not this number.
   */
  found: number
  /** True when the printed peers are homes like the subject. */
  likeYours: boolean
  /** True when even 24 months inside the area holds fewer than three. */
  shortfall: boolean
  sentence: string
  peers: CmaExpiredPeer[]
  /**
   * The list-price window the read counted (marketAreaPriceBand of the list
   * the competition was read around). `areaTotal` counts only homes listed
   * inside it, so a sentence that says that count names it. Absent on rows
   * built before 2026-10-08.
   */
  priceBand?: { lo: number; hi: number } | null
}

function usd(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

/** "3" → "three"; "24" stays "24". Nine is where the words stop (countWord). */
function monthsWord(months: number): string {
  return countWord(months)
}

/** "a, b and c" — no Oxford comma. */
function joinBits(parts: readonly string[]): string {
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]!
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/**
 * Why this home sat. Every clause is a number off the row: days, what it did
 * with its opening ask, and its last ask per square foot beside the median
 * $/sqft of the sales that set the subject's price. No adjectives, no motive,
 * nothing about the sellers.
 */
export function whyItSat(
  peer: CmaExpiredPeer,
  keptCompMedianPpsf: number | null | undefined,
): string | null {
  const bits: string[] = []
  if (peer.daysOnMarket != null && peer.daysOnMarket > 0) {
    bits.push(`${peer.daysOnMarket} ${peer.daysOnMarket === 1 ? 'day' : 'days'} on the market`)
  }
  const open = peer.originalListPrice
  if (open != null && Number.isFinite(open) && open > 0 && peer.listPrice > 0) {
    if (open > peer.listPrice) bits.push(`came down ${usd(open - peer.listPrice)} from ${usd(open)}`)
    else if (open === peer.listPrice) bits.push(`never came down from ${usd(open)}`)
  }
  if (peer.sqft != null && peer.sqft > 0 && peer.listPrice > 0) {
    // Round the $/sqft FIRST, then take the gap off the rounded figure, so the
    // percentage a reader checks reproduces from the two numbers printed here.
    const ppsf = Math.round(peer.listPrice / peer.sqft)
    const bench =
      keptCompMedianPpsf != null && Number.isFinite(keptCompMedianPpsf) && keptCompMedianPpsf > 0
        ? Math.round(keptCompMedianPpsf)
        : null
    if (bench != null && ppsf !== bench) {
      const pct = ((ppsf - bench) / bench) * 100
      const shown = Math.abs(pct) >= 10 ? Math.round(Math.abs(pct)) : Math.round(Math.abs(pct) * 10) / 10
      bits.push(
        `a last ask of ${usd(ppsf)} a square foot, ${shown} percent ${pct > 0 ? 'above' : 'below'} the ${usd(
          bench,
        )} the sales behind your price closed at`,
      )
    } else {
      bits.push(`a last ask of ${usd(ppsf)} a square foot`)
    }
  }
  return bits.length > 0 ? `${joinBits(bits)}.` : null
}

/**
 * Months between the day it came off the market and as-of. Null when the row
 * carries no date. The day it left Active when the status log says, so a home
 * withdrawn 25 months ago whose listing expired 23 months ago did not come off
 * "in the last 24 months".
 */
function offMarketMonths(row: CmaMarketAreaRow, asOf: Date): number | null {
  const run = row.statusChanges?.length ? peerRun(row) : null
  const raw = (run?.source === 'status-history' ? run.to : null) ?? row.status_change_timestamp?.trim()
  if (!raw) return null
  const t = new Date(raw.length <= 10 ? `${raw}T12:00:00.000Z` : raw)
  if (Number.isNaN(t.getTime())) return null
  const months = (asOf.getTime() - t.getTime()) / (30.44 * 24 * 3600e3)
  return months >= 0 ? months : 0
}

/** The sentence names a subdivision only when a shown peer sits there. */
function sentenceArea(area: CompArea, peers: readonly CmaExpiredPeer[]): CompArea {
  if (peers.length === 0) return area
  if (area.kind !== 'subdivision' && area.kind !== 'subdivisions') return area
  const names: string[] = []
  const push = (raw: string | null | undefined) => {
    const name = realSubdivision(raw)
    if (!name) return
    if (names.some((n) => n.toLowerCase() === name.toLowerCase())) return
    names.push(name)
  }
  const peerHas = (name: string) =>
    peers.some((peer) => realSubdivision(peer.subdivision)?.toLowerCase() === name.toLowerCase())
  for (const name of area.names) {
    if (peerHas(name)) push(name)
  }
  for (const peer of peers) push(peer.subdivision)
  if (names.length === 0) return area
  const unchanged =
    names.length === area.names.length &&
    names.every((name, i) => name.toLowerCase() === area.names[i]?.toLowerCase())
  if (unchanged) return area
  return { ...area, kind: names.length === 1 ? 'subdivision' : 'subdivisions', names }
}

/**
 * Build the peer set from rows ALREADY scoped to the sales area and the price
 * band. This function never widens to a neighborhood, a city, a mile ring, or
 * the subdivisions drawn as competition, and never opens the fit (Matt
 * 2026-10-07, rule 24). Short of three, it says so. §0: the document goes out
 * with fewer facts rather than a padded set.
 */
export function buildExpiredPeerSet(input: {
  rows: readonly CmaMarketAreaRow[]
  subject: ExpiredPeerSubject
  area: CompArea
  asOf?: Date
  /** Median $/sqft of the sales that set the price, for `whyItSat`. */
  keptCompMedianPpsf?: number | null
  /**
   * Matt ADD 2026-09-12: cap the peer clock to the closed-sales lookback so
   * expireds do not come from an older pocket than the solds.
   */
  maxWindowMonths?: number | null
  /**
   * Street addresses of the closed sales that set the price. An unsold cycle
   * at one of those streets already sold, so it is not a peer that failed.
   * A different listing key at the same street is still that sale. Omitted
   * leaves every unsold row in the set.
   */
  closedSaleAddresses?: readonly (string | null | undefined)[]
  /**
   * The subject itself came off without selling. With no other peers, the
   * "no home came off" sentence would be about this home. Omit it. Omitted
   * or false keeps that sentence.
   */
  subjectCameOff?: boolean
  /**
   * A home that is for sale or under contract now is not also a pin for an
   * older cycle that came off. The address is enough. The listing keys differ.
   */
  liveAddresses?: readonly (string | null | undefined)[]
  /**
   * Other MLS records of the houses in `rows` (getCmaAreaUnsoldCycles reads
   * them). A cycle whose house relisted later and closed, or is on the market
   * now, did not come off unsold (laterOutcomeCycle). Omitted drops nothing.
   */
  laterCycles?: readonly HouseCycleRecord[]
  /** The list-price window `rows` were read inside (getCmaAreaUnsoldCycles priceLo..priceHi). */
  priceBand?: { lo: number; hi: number } | null
}): CmaExpiredPeerSet {
  const asOf = input.asOf ?? new Date()
  // One house key for every "same street" test here: "3062 NW Kelly Hill" on a
  // priced sale and "3062 Kelly Hill" on an MLS row are the same house.
  const liveNorms = new Set(
    (input.liveAddresses ?? [])
      .map((address) => sameHouseAddressKey(address ?? ''))
      .filter((address) => address.length > 0),
  )
  const closedSaleNorms = new Set(
    (input.closedSaleAddresses ?? [])
      .map((address) => sameHouseAddressKey(address ?? ''))
      .filter((address) => address.length > 0),
  )
  const soldAtThisStreet = (row: CmaMarketAreaRow): boolean => {
    if (closedSaleNorms.size === 0) return false
    const address = sameHouseAddressKey(peerAddress(row))
    return address.length > 0 && closedSaleNorms.has(address)
  }
  const unsoldRows = dropRelistedUnsoldCycles(input.rows, input.laterCycles ?? []).kept
  const dated = unsoldRows
    .map((row) => ({ row, months: offMarketMonths(row, asOf) }))
    // A row with no off-market date cannot support "in the last N months", so
    // it is not evidence for any window. It is dropped, never dated.
    // A street that already closed in the priced set is a sale, not a failure.
    .filter((x): x is { row: CmaMarketAreaRow; months: number } => {
      if (x.months == null || soldAtThisStreet(x.row)) return false
      const address = sameHouseAddressKey(peerAddress(x.row))
      return address.length === 0 || !liveNorms.has(address)
    })

  const maxW =
    input.maxWindowMonths != null && Number.isFinite(input.maxWindowMonths) && input.maxWindowMonths > 0
      ? Math.max(3, Math.round(input.maxWindowMonths))
      : null
  const filtered = [...EXPIRED_PEER_WINDOWS].filter((w) => (maxW == null ? true : w <= maxW))
  const windows = filtered.length > 0 ? filtered : [maxW ?? 12]
  let windowMonths = windows[windows.length - 1]!
  let peers: CmaExpiredPeer[] = []
  let areaTotal = 0
  let found = 0
  let likeYours = false
  const tried: number[] = []
  // A row outside the sales area is not in the area, whatever read returned
  // it (Matt 2026-10-07, rule 24): the same exact test the fit applies, so
  // `areaTotal` only counts homes the fit compared, and "none were close"
  // is never said of a home that was never inside.
  const inArea = (r: CmaMarketAreaRow) =>
    compAreaContains(input.area, {
      latitude: r.Latitude ?? null,
      longitude: r.Longitude ?? null,
      subdivision: r.SubdivisionName ?? null,
      city: r.City ?? null,
      // The polygon the area read placed it in, when it read one.
      platSlug: r.plat_slug,
      // A plat held to the subject's street holds only that street.
      address: r.StreetName?.trim() ? `${(r.StreetNumber ?? '').trim()} ${r.StreetName.trim()}`.trim() : null,
    })
  for (const w of windows) {
    tried.push(w)
    const inWindow = dated.filter((x) => x.months <= w).map((x) => x.row)
    peers = pickExpiredPeers(inWindow, input.subject, input.area)
    // How many homes came off in the area at all, one per address, subject
    // excluded. The narrowed set is what the document prints; this is what the
    // sentence would otherwise silently claim to be counting.
    // What the sentence counts is the set the table shows. `found` is that
    // set: homes that fit this one. Unlike homes stay in areaTotal only.
    const key = (r: CmaMarketAreaRow) =>
      normalizePeerAddress(peerAddress(r)) || String(r.ListingKey ?? '')
    const eligible = inWindow.filter(
      (r) =>
        inArea(r) &&
        !isSubjectExpiredRow(r, input.subject) &&
        peerAddress(r).length > 0 &&
        Number(r.ListPrice) > 0,
    )
    areaTotal = new Set(eligible.map(key).filter((k) => k.length > 0)).size
    // Pins are only homes that fit. Unlike homes stay in areaTotal. They do
    // not fill the three-home quota, so this window keeps opening.
    likeYours = peers.length > 0
    found = peers.length
    windowMonths = w
    if (peers.length >= EXPIRED_PEER_MIN) break
  }

  const withWhy = peers.map((p) => ({ ...p, whyItSat: whyItSat(p, input.keptCompMedianPpsf) }))
  const count = withWhy.length
  const shortfall = count < EXPIRED_PEER_MIN
  const widenedTo = !shortfall && windowMonths > windows[0]! ? windowMonths : null
  // A peer kept one room apart on the subject's own ground is named with the
  // room, and the sentence says no dollar value is applied (rule 4).
  const noted = roomNotedSentence(withWhy)
  const roomNote = noted ? ` ${noted}` : ''

  return {
    area: input.area,
    windowMonths,
    windowsTried: tried,
    widenedTo,
    count,
    areaTotal,
    found,
    likeYours,
    shortfall,
    sentence:
      peerSetSentence({
        area: sentenceArea(input.area, withWhy),
        searchArea: input.area,
        count,
        areaTotal,
        windowMonths,
        shortfall,
        likeYours,
        subjectCameOff: input.subjectCameOff === true,
        priceBand: input.priceBand ?? null,
      }) + roomNote,
    peers: withWhy,
    ...(input.priceBand ? { priceBand: { lo: input.priceBand.lo, hi: input.priceBand.hi } } : {}),
  }
}

/**
 * "Two homes in Northwest Townsite, Grandview, Highland and Bonne Home listed
 * between $403,000 and $1,356,000 came off the market without selling in the
 * last 18 months. None were close to this home ..."
 *
 * THE COUNT NAMES THE WINDOW IT COUNTED (reader review, 1355 Jacksonville and
 * 2745 Aldrich, 2026-10-08). The read behind it is held to a list-price window
 * (marketAreaPriceBand, 0.55 to 1.85 times the list the competition was read
 * around); four more homes in Jacksonville's area came off unsold outside it,
 * so "Two homes in ... came off the market" was false as written. With no
 * window on the row there is no count it can truthfully say, so it says that
 * homes came off near this price and none were close, without a number.
 */
export function unsoldAreaTotalSentence(input: {
  area: CompArea
  areaTotal: number
  windowMonths: number
  priceBand: { lo: number; hi: number } | null
}): string {
  const where = compAreaIn(input.area)
  const w = monthsWord(input.windowMonths)
  if (!input.priceBand) {
    return `Homes ${where} came off the market without selling in the last ${w} months. None of those near this price were close to this home in bedrooms, bathrooms, size or age, so they are not compared here.`
  }
  const cameOff = input.areaTotal
  const came = cameOff === 1 ? 'One home' : `${countWord(cameOff, true)} homes`
  const listed = `listed between ${usd(input.priceBand.lo)} and ${usd(input.priceBand.hi)}`
  return `${came} ${where} ${listed} came off the market without selling in the last ${w} months. None were close to this home in bedrooms, bathrooms, size or age, so they are not compared here.`
}

function peerSetSentence(input: {
  /** The plats holding a shown peer, for the count sentence. */
  area: CompArea
  /** The whole sales area the rows were read over, for the "nothing from outside" clause. */
  searchArea: CompArea
  count: number
  areaTotal?: number
  windowMonths: number
  shortfall: boolean
  likeYours: boolean
  subjectCameOff?: boolean
  priceBand?: { lo: number; hi: number } | null
}): string {
  const where = compAreaIn(input.area)
  const whereOr = compAreaIn(input.area, { negative: true })
  const w = monthsWord(input.windowMonths)
  // "like yours" is not decoration: every peer passed the sales rules, so a
  // bare "three homes in X" over an area that may hold thirty unsold
  // listings would be a count of one set attached to the name of another (§0).
  const like = input.likeYours ? ' like yours' : ''
  // `count` is the rows the table prints. The sentence uses that number.
  const n = input.count
  if (n === 0) {
    const cameOff = input.areaTotal ?? 0
    if (cameOff > 0) {
      // The count is of homes inside the read's list-price window, so the
      // sentence says the window (unsoldAreaTotalSentence). A count with no
      // window to name is not said at all.
      return unsoldAreaTotalSentence({
        area: input.area,
        areaTotal: cameOff,
        windowMonths: input.windowMonths,
        priceBand: input.priceBand ?? null,
      })
    }
    // The subject is the home that came off, so the sentence says no OTHER
    // home did. It used to say nothing, which left the chapter as one line
    // about the seller's own listing under a heading about the listings near
    // them (3037 Purcell, reader review 2026-10-08; rule 24: an area that
    // holds none says so plainly).
    if (input.subjectCameOff) return noOtherPeerSentence(input.searchArea, input.windowMonths)
    return `No home ${whereOr} came off the market without selling in the last ${w} months.`
  }
  const homes = `${countWord(n)} ${n === 1 ? 'home' : 'homes'}${like}`
  if (!input.shortfall) {
    const sentence = `${homes} ${where} came off the market without selling in the last ${w} months.`
    return sentence.charAt(0).toUpperCase() + sentence.slice(1)
  }
  // Fewer than three even at the widest window. Say the number, say the
  // window, and say plainly that nothing was brought in from outside the
  // WHOLE search area, so the sentence never implies only one plat was read.
  const outside =
    input.searchArea.kind === 'radius' ? 'further out' : `outside ${compAreaPhrase(input.searchArea)}`
  return `Only ${homes} ${where} came off the market without selling in the last ${w} months, and nothing from ${outside} was added to make up the number.`
}

/**
 * The zero sentence a render prints when the stored peers all fell to the
 * sales-area re-test (an old row read over a wider ring than the sales sit
 * in). It names no place: the places the stored sentence named are not the
 * area the map draws, and the area itself is the map's caption. Same shape as
 * the build's zero sentence above ("No home in Purcell came off the market
 * without selling in the last 12 months."), scoped to homes like yours
 * because the stored set only ever held homes like yours. A window that is
 * not on the row prints nothing: an absence with no window is not a fact the
 * row supports (§0).
 */
/**
 * No listing other than the seller's own came off unsold in the area, over the
 * longest window the search tried. "Like yours" always: the read behind it is
 * the subject's own property type inside the price band
 * (getCmaAreaUnsoldCycles), so a bare "no other home" would claim more than
 * the search looked at (CLAUDE.md §0).
 */
export function noOtherPeerSentence(area: CompArea, windowMonths: number | null | undefined): string {
  if (windowMonths == null || !Number.isFinite(windowMonths) || windowMonths <= 0) return ''
  return `No other home like yours ${compAreaIn(area, { negative: true })} came off the market without selling in the last ${monthsWord(
    Math.round(windowMonths),
  )} months.`
}

export function noPeerInAreaSentence(windowMonths: number | null | undefined): string {
  if (windowMonths == null || !Number.isFinite(windowMonths) || windowMonths <= 0) return ''
  return `No home like yours in this area came off the market without selling in the last ${monthsWord(
    Math.round(windowMonths),
  )} months.`
}

/**
 * Median close $/sqft over the sales that set the price — the benchmark
 * `whyItSat` measures a failed home's last ask against. Raw close price over
 * size, not the time-adjusted figure: the comparison is to what buyers
 * actually paid, not to what the grid restated those sales as.
 */
export function keptCompMedianPpsf(
  comps: readonly { closePrice: number; sqft: number }[],
): number | null {
  const values = comps
    .filter((c) => c.closePrice > 0 && c.sqft > 0)
    .map((c) => c.closePrice / c.sqft)
  return median(values)
}
