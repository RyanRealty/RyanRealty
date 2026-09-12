/**
 * Status-grid and 90-day sold-band math for CMA chapters.
 * Density from an RPR packet. Our grain and our pricing number.
 * Never a ZIP dump. Never an AVM.
 */

import type { CmaAdjustedComp, CmaPricing, CmaSubject } from '@/lib/cma/types'
import { compAreaIn, compAreaPhrase, type CompArea } from '@/lib/pricing/comp-area'
import { countWord } from '@/lib/pricing/estimate'
import { keepSameProductType } from '@/lib/cma/market-area'
import { realSubdivision } from '@/lib/cma/comp-tiers'
import type { CmaMarketAreaRow } from '@/lib/data/cma/marketAreaReads'
import { daysOnMarketFrom, listingHistoryLine as buildListingHistoryLine } from '@/lib/cma/listing-history-line'

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
  daysOnMarket: number | null
  /** Cycle start — used to label or collapse multi-cycle peers. */
  onMarketDate: string | null
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
  baths: number | null
  sqft: number | null
  yearBuilt: number | null
  lotAcres: number | null
  propertySubType: string | null
  latitude: number | null
  longitude: number | null
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


const EXPIRED_PEER_CAP = 5

export type ExpiredPeerSubject = Pick<
  CmaSubject,
  'beds' | 'sqft' | 'latitude' | 'longitude' | 'listingKey' | 'mlsNumber' | 'streetAddress'
>

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
  const addr = peerAddress(row)
  const subjAddr = subject.streetAddress?.trim()
  if (addr && subjAddr && normalizePeerAddress(addr) === normalizePeerAddress(subjAddr)) return true
  return false
}

/** True when a named peer is the subject (defense for stored args). */
export function peerMatchesSubject(
  peer: Pick<CmaExpiredPeer, 'listingKey' | 'address'>,
  subject: Pick<CmaSubject, 'listingKey' | 'mlsNumber' | 'streetAddress'>,
): boolean {
  const ids = peerKeyIds(subject)
  const key = peer.listingKey.trim().toLowerCase()
  if (key && ids.has(key)) return true
  const subjAddr = subject.streetAddress?.trim()
  if (peer.address.trim() && subjAddr && normalizePeerAddress(peer.address) === normalizePeerAddress(subjAddr)) {
    return true
  }
  return false
}

export function peerFitsSubject(
  row: CmaMarketAreaRow,
  subject: Pick<CmaSubject, 'beds' | 'sqft'>,
): boolean {
  if (subject.beds != null && row.BedroomsTotal != null && Number(row.BedroomsTotal) !== subject.beds) {
    return false
  }
  if (subject.sqft != null && subject.sqft > 0 && row.TotalLivingAreaSqFt != null && row.TotalLivingAreaSqFt > 0) {
    if (Math.abs(row.TotalLivingAreaSqFt - subject.sqft) / subject.sqft > 0.25) return false
  }
  return true
}

function peerDist2(row: CmaMarketAreaRow, lat: number, lng: number): number {
  if (row.Latitude == null || row.Longitude == null) return Number.POSITIVE_INFINITY
  const dLat = row.Latitude - lat
  const dLng = row.Longitude - lng
  return dLat * dLat + dLng * dLng
}

/** MLS DOM when present; else on-market → off-market (status change) sit-time. */
function peerDom(row: CmaMarketAreaRow): number | null {
  const d = num(row.CumulativeDaysOnMarket) ?? num(row.DaysOnMarket)
  if (d != null && d > 0) return d
  const on = row.OnMarketDate ?? row.ListDate
  const offRaw = row.status_change_timestamp ?? row.CloseDate
  if (on && offRaw) {
    const off = new Date(offRaw.length <= 10 ? `${offRaw}T12:00:00.000Z` : offRaw)
    if (!Number.isNaN(off.getTime())) {
      return daysOnMarketFrom({ onMarketDate: on, asOf: off })
    }
  }
  return daysOnMarketFrom({ onMarketDate: on })
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
  cap = EXPIRED_PEER_CAP,
): CmaExpiredPeer[] {
  const named = rows
    .map((row) => {
      if (isSubjectExpiredRow(row, subject)) return null
      const address = peerAddress(row)
      const listPrice = Number(row.ListPrice)
      if (!address || !Number.isFinite(listPrice) || listPrice <= 0) return null
      const key = String(row.ListingKey ?? address).trim()
      if (!key) return null
      const originalListPrice =
        row.OriginalListPrice != null && Number.isFinite(Number(row.OriginalListPrice))
          ? Number(row.OriginalListPrice)
          : null
      const onMarketDate = row.OnMarketDate ?? row.ListDate ?? null
      const daysOnMarket = peerDom(row)
      const status = row.StandardStatus
      const peer: CmaExpiredPeer = {
        listingKey: key,
        address,
        listPrice,
        originalListPrice,
        status,
        daysOnMarket,
        onMarketDate,
        photoUrl: row.PhotoURL ?? null,
        listingHistoryLine: buildListingHistoryLine({
          listPrice,
          originalListPrice,
          status,
          onMarketDate,
          daysOnMarket,
        }),
        beds: row.BedroomsTotal,
        baths: row.BathroomsTotal,
        sqft: row.TotalLivingAreaSqFt,
        yearBuilt: row.year_built ?? null,
        lotAcres: row.lot_size_acres ?? null,
        propertySubType: row.property_sub_type ?? null,
        latitude: row.Latitude ?? null,
        longitude: row.Longitude ?? null,
      }
      return { row, peer }
    })
    .filter((x): x is { row: CmaMarketAreaRow; peer: CmaExpiredPeer } => x != null)

  const similar = named.filter((x) => peerFitsSubject(x.row, subject))
  const pool = similar.length > 0 ? similar : named
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
  // Collapse multi-cycle same-address peers, then cap columns.
  return collapseExpiredPeerCycles(picked).slice(0, cap)
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

  const expiredPeers = pickExpiredPeers(expired, {
    beds: input.subject.beds,
    sqft: input.subject.sqft,
    latitude: input.subject.latitude,
    longitude: input.subject.longitude,
    listingKey: input.subject.listingKey,
    mlsNumber: input.subject.mlsNumber,
    streetAddress: input.subject.streetAddress,
  })

  return {
    grain,
    label,
    source: `Oregon Data Share MLS. ${label}, priced $${band.lo.toLocaleString('en-US')} to $${band.hi.toLocaleString('en-US')}, last 12 months.`,
    priceLo: band.lo,
    priceHi: band.hi,
    selected: selectedBucket(input.comps),
    active: pack('active', 'For sale now', live('Active')),
    pending: pack('pending', 'Under contract', live('Pending')),
    expired: pack('expired', 'Expired or withdrawn', expired),
    closed: pack('closed', 'Closed, last 12 months', closed),
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
   * How many the sentence claims: `areaTotal`, or the subset like the subject
   * when the pick narrowed to those. `count` is what the document PRINTS, and
   * it is capped, so the sentence must never be built on it (§0).
   */
  found: number
  /** True when the printed peers were narrowed to homes like the subject. */
  likeYours: boolean
  /** True when even 24 months inside the area holds fewer than three. */
  shortfall: boolean
  sentence: string
  peers: CmaExpiredPeer[]
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

/** Months between an off-market day and as-of. Null when the row carries no date. */
function offMarketMonths(row: CmaMarketAreaRow, asOf: Date): number | null {
  const raw = row.status_change_timestamp?.trim()
  if (!raw) return null
  const t = new Date(raw.length <= 10 ? `${raw}T12:00:00.000Z` : raw)
  if (Number.isNaN(t.getTime())) return null
  const months = (asOf.getTime() - t.getTime()) / (30.44 * 24 * 3600e3)
  return months >= 0 ? months : 0
}

/**
 * Build the peer set from rows ALREADY scoped to the area and the price band.
 * This function never widens the geography — only the clock. When 24 months
 * inside the area still holds fewer than three, it returns what exists with
 * `shortfall` set and a sentence that says nothing was brought in from
 * outside. §0: the document goes out with fewer facts rather than a padded set.
 */
export function buildExpiredPeerSet(input: {
  rows: readonly CmaMarketAreaRow[]
  subject: ExpiredPeerSubject
  area: CompArea
  asOf?: Date
  /** Median $/sqft of the sales that set the price, for `whyItSat`. */
  keptCompMedianPpsf?: number | null
  cap?: number
  /**
   * Matt ADD 2026-09-12: cap the peer clock to the closed-sales lookback so
   * expireds do not come from an older pocket than the solds.
   */
  maxWindowMonths?: number | null
}): CmaExpiredPeerSet {
  const asOf = input.asOf ?? new Date()
  const cap = input.cap ?? EXPIRED_PEER_CAP
  const dated = input.rows
    .map((row) => ({ row, months: offMarketMonths(row, asOf) }))
    // A row with no off-market date cannot support "in the last N months", so
    // it is not evidence for any window. It is dropped, never dated.
    .filter((x): x is { row: CmaMarketAreaRow; months: number } => x.months != null)

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
  for (const w of windows) {
    tried.push(w)
    const inWindow = dated.filter((x) => x.months <= w).map((x) => x.row)
    peers = pickExpiredPeers(inWindow, input.subject, cap)
    // How many homes came off in the area at all, one per address, subject
    // excluded. The narrowed set is what the document prints; this is what the
    // sentence would otherwise silently claim to be counting.
    // What the SENTENCE counts. `peers` is capped at five columns, so a
    // sentence built on its length would say five homes came off the market
    // in a neighborhood where seven did. These mirror pickExpiredPeers' own
    // pool rule: the homes like the subject when there are any, else all.
    const key = (r: CmaMarketAreaRow) =>
      normalizePeerAddress(peerAddress(r)) || String(r.ListingKey ?? '')
    const eligible = inWindow.filter(
      (r) =>
        !isSubjectExpiredRow(r, input.subject) &&
        peerAddress(r).length > 0 &&
        Number(r.ListPrice) > 0,
    )
    areaTotal = new Set(eligible.map(key).filter((k) => k.length > 0)).size
    const similar = eligible.filter((r) => peerFitsSubject(r, input.subject))
    likeYours = similar.length > 0
    found = likeYours ? new Set(similar.map(key).filter((k) => k.length > 0)).size : areaTotal
    windowMonths = w
    if (peers.length >= EXPIRED_PEER_MIN) break
  }

  const withWhy = peers.map((p) => ({ ...p, whyItSat: whyItSat(p, input.keptCompMedianPpsf) }))
  const count = withWhy.length
  const shortfall = count < EXPIRED_PEER_MIN
  const widenedTo = !shortfall && windowMonths > windows[0]! ? windowMonths : null

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
    sentence: peerSetSentence({
      area: input.area,
      count,
      found,
      windowMonths,
      shortfall,
      likeYours,
    }),
    peers: withWhy,
  }
}

function peerSetSentence(input: {
  area: CompArea
  count: number
  found: number
  windowMonths: number
  shortfall: boolean
  likeYours: boolean
}): string {
  const where = compAreaIn(input.area)
  const w = monthsWord(input.windowMonths)
  // "like yours" is not decoration: the peers are narrowed to the subject's
  // bedroom count and within 25% of its size, so a bare "three homes in X" —
  // over an area that may hold thirty unsold listings — would be a count of
  // one set attached to the name of another (§0).
  const like = input.likeYours ? ' like yours' : ''
  const n = input.found
  if (n === 0) {
    return `No home${like} ${where} came off the market without selling in the last ${w} months.`
  }
  // The columns are capped; the sentence is not. Say how many were found and
  // then say how many of them are drawn below.
  const shown =
    input.count > 0 && input.count < n
      ? ` The ${countWord(input.count)} closest to your home ${input.count === 1 ? 'is' : 'are'} below.`
      : ''
  const homes = `${countWord(n)} ${n === 1 ? 'home' : 'homes'}${like}`
  if (!input.shortfall) {
    const head = `${countWord(n, true)} ${n === 1 ? 'home' : 'homes'}${like}`
    return `${head} ${where} came off the market without selling in the last ${w} months.${shown}`
  }
  // Fewer than three even at the widest window. Say the number, say the
  // window, and say plainly that nothing was brought in from outside.
  const outside =
    input.area.kind === 'radius' ? 'further out' : `outside ${compAreaPhrase(input.area)}`
  return `Only ${homes} ${where} came off the market without selling in the last ${w} months, and nothing from ${outside} was added to make up the number.`
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
