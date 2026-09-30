/**
 * Live MLS relist check for the expired / FSBO outreach send paths.
 *
 * verifyNotRelisted (lib/data/prospecting/batch.ts) reads our listings table,
 * and our table can lag the MLS. On 2026-09-30, 74 of the 552 expired-listing
 * outreach targets had their own listing key back on the market in Spark while
 * our copy still read Expired (the delta sync had skipped finalized rows), for
 * example 15 NW Franklin, Bend, relisted the evening it expired. Soliciting the
 * owner of a home listed with another broker is a license problem, so every
 * send path also asks Spark, the MLS itself, right before it sends:
 *
 *   1. the subject listing by key: on the market (MLS_ON_MARKET_STATUSES)
 *      blocks. Closed blocks when the sale is news: on or after the day the
 *      prospect came off the market (`soldAfter`), or, with no such day, inside
 *      RECENT_SALE_MONTHS. The prospect's OWN expired listing closing blocks
 *      whatever its close date says (our record holds it as ended unsold, and a
 *      late-reported sale carries a close date before the expiry). A CMA's
 *      subject key is often a sale from 2004; that is history, not a block.
 *   2. every on-market listing at the same street number, MLS-wide (up to
 *      1,000; 453 is the most any number had on 2026-09-30, the land "0"),
 *      matched here on city (case- and space-insensitive, "LaPine" is La Pine)
 *      or postal code, then street name and unit. Spark's `City Eq` is exact,
 *      so "LaPine" and "Sun River" found nothing and read as clear. A condo
 *      building answers with every listed unit (2745 NW Ordway had six), so the
 *      street name and the unit decide; an unknown unit on either side blocks,
 *      the safe side.
 *
 * Both calls run in parallel with `_select` limited to the fields read here,
 * bounded by SPARK_RELIST_TIMEOUT_MS, and never wait out a 429. Any error,
 * timeout or ambiguous answer fails closed (verifyFailed), which the caller
 * turns into "do not send". `failureScope` says whose problem it is: 'global'
 * when Spark itself could not answer (every row would fail the same way, so a
 * queue must hold, not dequeue) and 'row' when this address cannot be answered
 * (no key and no street number, a result set past one page, a listing we may
 * not read), which a queue may set aside and, in the end, hand to a person.
 * Measured 2026-09-30 from a dev container against live Spark, 30 calls over
 * 10 real prospects: p50 90 ms, p90 242 ms, max 392 ms.
 */
import 'server-only'
import { MLS_ON_MARKET_STATUSES, isMlsOnMarketStatus } from '@/lib/listing-status-public'
import { fetchSparkListingByKey, fetchSparkListingsPage } from '@/lib/spark'

/** Upper bound on the check, per call; past it the send is blocked. */
export const SPARK_RELIST_TIMEOUT_MS = 8_000

/** With no off-market day to measure a sale against, a sale older than this is history. */
export const RECENT_SALE_MONTHS = 12

const RELIST_SELECT =
  'ListingKey,StandardStatus,StreetNumber,StreetName,UnitNumber,City,PostalCode,CloseDate,StatusChangeTimestamp,OnMarketDate'
/** Spark replication's page ceiling. The widest street number on 2026-09-30 ("0", land) had 453. */
const ADDRESS_PAGE_LIMIT = 1000

export type SparkRelistInput = {
  /** A listing to read by key: the expired prospect's own listing, or a CMA's subject listing. Null for an FSBO. */
  listingKey: string | null
  /**
   * True when `listingKey` is the prospect's own expired listing. Our record
   * holds it as ended unsold, so Spark showing it Closed means it sold after we
   * saw it end, whatever close date the agent entered.
   */
  keyIsProspectListing?: boolean
  streetAddress: string | null
  city: string | null
  postalCode?: string | null
  /**
   * The day the prospect came off the market (expired) or was found (FSBO).
   * A close on or after it is "sold since". Null: only a sale inside
   * RECENT_SALE_MONTHS blocks.
   */
  soldAfter?: string | null
  /** The clock RECENT_SALE_MONTHS is measured on (tests). */
  now?: Date
}

/** 'global': the MLS could not answer at all. 'row': this address cannot be answered. */
export type VerifyFailureScope = 'global' | 'row'

export type SparkRelistResult = {
  relisted: boolean
  /** Spark could not answer: the caller must not send. */
  verifyFailed: boolean
  /** Whose problem a failure is (null unless verifyFailed). */
  failureScope: VerifyFailureScope | null
  /** Which listing blocked the send, or why the check could not answer. */
  reason: string | null
  /** The MLS status that blocked (Active, Active Under Contract, Coming Soon, Pending, Closed). */
  blockedStatus: string | null
  /** The listing that blocked. */
  blockedKey: string | null
  /** When the blocking state began (YYYY-MM-DD): the close date of a sale, else the status change. */
  blockedDate: string | null
  /** The subject listing's CloseDate when Spark shows it Closed, blocking or not. */
  closeDate: string | null
}

const DIRECTIONS = new Set([
  'N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW',
  'NORTH', 'SOUTH', 'EAST', 'WEST', 'NORTHEAST', 'NORTHWEST', 'SOUTHEAST', 'SOUTHWEST',
])
const NAME_ALIASES: Record<string, string> = { MT: 'MOUNT', FT: 'FORT', ST: 'SAINT', HWY: 'HIGHWAY' }
const UNIT_TAIL = /(?:#\s*|\b(?:UNIT|APT|APARTMENT|STE|SUITE|SPC|SPACE|LOT)\b\.?\s*#?\s*)([A-Z0-9][A-Z0-9-]*)\s*$/i

function word(t: string): string {
  return t.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/** The first word of a street name, past any direction: "NW Ordway Ave" and "Ordway" are both ORDWAY. */
export function streetNameKey(name: unknown): string | null {
  if (typeof name !== 'string') return null
  const words = name.split(/\s+/).map(word).filter(Boolean)
  const first = words.find((w) => !DIRECTIONS.has(w))
  if (!first) return null
  return NAME_ALIASES[first] ?? first
}

/** A unit as a bare token: "#311", "Unit 311", "0311" and "311" are all 311. */
export function unitKey(unit: unknown): string | null {
  if (unit == null) return null
  const v = String(unit)
    .toUpperCase()
    .replace(/^\s*(?:#|UNIT|APT|APARTMENT|STE|SUITE|SPC|SPACE|LOT)\.?\s*#?\s*/, '')
    .replace(/[^A-Z0-9]/g, '')
    .replace(/^0+(?=\d)/, '')
  return v === '' ? null : v
}

/** A city as one token: "La Pine", "LaPine" and "la pine" are all LAPINE; "Sun River" is SUNRIVER. */
export function cityKey(city: unknown): string | null {
  if (typeof city !== 'string') return null
  const v = city.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return v === '' ? null : v
}

/** The five-digit ZIP, or null. */
function zipKey(postal: unknown): string | null {
  const m = /^\s*(\d{5})/.exec(String(postal ?? ''))
  return m ? m[1]! : null
}

/** "2745 NW Ordway Ave #311, Bend, OR" -> number 2745, name ORDWAY, unit 311. */
export function parseStreetAddress(raw: string | null): { number: string | null; nameKey: string | null; unit: string | null } {
  const street = String(raw ?? '').split(',')[0]!.trim()
  if (!street) return { number: null, nameKey: null, unit: null }
  // A unit carries a digit or is one letter ("#311", "Unit B"); "Lot Road" is a street, not lot "Road".
  const tail = UNIT_TAIL.exec(street)
  const unitMatch = tail && (/\d/.test(tail[1]!) || tail[1]!.length === 1) ? tail : null
  const unit = unitMatch ? unitKey(unitMatch[1]) : null
  const rest = (unitMatch ? street.slice(0, unitMatch.index) : street).trim().split(/\s+/)
  const number = rest[0] && /\d/.test(rest[0]) ? rest[0] : null
  return { number, nameKey: streetNameKey(rest.slice(number ? 1 : 0).join(' ')), unit }
}

function sparkQuote(v: string): string {
  return `'${v.replace(/'/g, '')}'`
}

function withDeadline<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Spark ${what} read timed out after ${ms} ms`)), ms)
  })
  return Promise.race([p.finally(() => clearTimeout(timer)), deadline])
}

const CLEAR: SparkRelistResult = {
  relisted: false,
  verifyFailed: false,
  failureScope: null,
  reason: null,
  blockedStatus: null,
  blockedKey: null,
  blockedDate: null,
  closeDate: null,
}

function failed(reason: string, scope: VerifyFailureScope): SparkRelistResult {
  return { ...CLEAR, verifyFailed: true, failureScope: scope, reason }
}

function blocked(reason: string, status: string, key: string | null, date: string | null, closeDate: string | null = null): SparkRelistResult {
  return { ...CLEAR, relisted: true, reason, blockedStatus: status, blockedKey: key, blockedDate: date, closeDate }
}

/**
 * A Spark read error that is about THIS listing or query (a listing our key
 * may not read, a filter Spark rejects) rather than about Spark. Everything
 * else (timeouts, network, 401, 429, 5xx) is global: every row would fail.
 */
function scopeOfError(e: unknown): VerifyFailureScope {
  const m = /Spark API error (\d{3})/.exec(e instanceof Error ? e.message : String(e))
  const status = m ? Number(m[1]) : null
  return status === 400 || status === 403 || status === 422 ? 'row' : 'global'
}

function ymd(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : ''
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null
}

function monthsBefore(now: Date, months: number): string {
  const d = new Date(now.getTime())
  d.setUTCMonth(d.getUTCMonth() - months)
  return d.toISOString().slice(0, 10)
}

function addressLine(f: Record<string, unknown>): string {
  const unit = f.UnitNumber ? ` #${String(f.UnitNumber)}` : ''
  return `${String(f.StreetNumber ?? '')} ${String(f.StreetName ?? '')}${unit}, ${String(f.City ?? '')}`.trim()
}

/** Ask Spark whether the subject listing, or its address, is back on the market or newly sold. Fail closed. */
export async function sparkRelistCheck(
  input: SparkRelistInput,
  opts: { timeoutMs?: number } = {},
): Promise<SparkRelistResult> {
  const address = parseStreetAddress(input.streetAddress)
  const key = input.listingKey?.trim() || null
  if (!key && !address.number) {
    return failed('nothing to ask the MLS: no listing key and no street number on the record', 'row')
  }
  const token = (process.env.SPARK_API_KEY ?? '').trim()
  if (!token) return failed('SPARK_API_KEY is not set', 'global')
  const timeoutMs = opts.timeoutMs ?? SPARK_RELIST_TIMEOUT_MS

  // No City term: Spark's `City Eq` is exact ("LaPine" matched none of La
  // Pine's 377 listings), so the city is matched below, loosely.
  const filter = [
    `StreetNumber Eq ${sparkQuote(address.number ?? '')}`,
    `(${MLS_ON_MARKET_STATUSES.map((s) => `StandardStatus Eq '${s}'`).join(' Or ')})`,
  ].join(' And ')

  const [subjectRead, addressRead] = await Promise.allSettled([
    key
      ? withDeadline(fetchSparkListingByKey(token, key, '', { select: RELIST_SELECT, timeoutMs }), timeoutMs, 'by-key')
      : Promise.resolve(null),
    address.number
      ? withDeadline(
          fetchSparkListingsPage(token, {
            page: 1,
            limit: ADDRESS_PAGE_LIMIT,
            filter,
            select: RELIST_SELECT,
            timeoutMs,
            retryOn429: false,
            // A 404 on a search is a broken endpoint, not "nothing listed here".
            notFoundAsError: true,
          }),
          timeoutMs,
          'address',
        )
      : Promise.resolve(null),
  ])
  if (subjectRead.status === 'rejected') {
    return failed(`Spark by-key read failed: ${String(subjectRead.reason?.message ?? subjectRead.reason)}`, scopeOfError(subjectRead.reason))
  }
  if (addressRead.status === 'rejected') {
    return failed(`Spark address read failed: ${String(addressRead.reason?.message ?? addressRead.reason)}`, scopeOfError(addressRead.reason))
  }

  // 1. The subject listing itself (null: Spark does not know the key; the address check decides).
  const subject = (subjectRead.value?.D?.Results?.[0]?.StandardFields ?? null) as Record<string, unknown> | null
  let closeDate: string | null = null
  if (subject) {
    const status = String(subject.StandardStatus ?? '')
    const changed = ymd(subject.StatusChangeTimestamp) ?? ymd(subject.OnMarketDate)
    if (isMlsOnMarketStatus(status)) {
      return blocked(`Spark: listing ${key} is ${status}${changed ? ` since ${changed}` : ''}`, status, key, changed)
    }
    if (/closed/i.test(status)) {
      closeDate = ymd(subject.CloseDate)
      const soldOn = closeDate ?? ymd(subject.StatusChangeTimestamp)
      const soldAfter = ymd(input.soldAfter)
      const recentFloor = monthsBefore(input.now ?? new Date(), RECENT_SALE_MONTHS)
      const line = `Spark: listing ${key} is Closed${closeDate ? ` (closed ${closeDate})` : ''}`
      if (input.keyIsProspectListing) {
        return blocked(`${line}, the listing this owner was prospected from`, 'Closed', key, soldOn, closeDate)
      }
      if (!soldOn) {
        return failed(`${line} with no close date, so whether it sold after the prospect came off the market is unknown`, 'row')
      }
      if (soldAfter ? soldOn >= soldAfter : soldOn >= recentFloor) {
        return blocked(
          `${line}${soldAfter ? `, on or after ${soldAfter} when this prospect came off the market` : `, inside ${RECENT_SALE_MONTHS} months`}`,
          'Closed',
          key,
          soldOn,
          closeDate,
        )
      }
      // An older sale is the property's history; the address check decides.
    }
  }

  // 2. Any listing on the market at the same street number, city (or ZIP), street and unit.
  const page = addressRead.value
  if (page) {
    if (!page.D || page.D.Success === false) return failed('Spark address read returned no result set', 'global')
    const rows = page.D.Results ?? []
    const total = page.D.Pagination?.TotalRows ?? rows.length
    if (total > rows.length) {
      return failed(`Spark lists ${total} listings on the market at number ${address.number}, more than one page shows`, 'row')
    }
    const nameKey = streetNameKey(subject?.StreetName) ?? address.nameKey
    const unit = unitKey(subject?.UnitNumber) ?? address.unit
    const wantCity = cityKey(input.city) ?? cityKey(subject?.City)
    const wantZip = zipKey(input.postalCode) ?? zipKey(subject?.PostalCode)
    for (const r of rows) {
      const f = (r.StandardFields ?? {}) as Record<string, unknown>
      const status = String(f.StandardStatus ?? '')
      if (!isMlsOnMarketStatus(status)) continue
      // Same place: the city in any spelling, or the ZIP. A side that does
      // not know its place cannot rule a row out (the safe side).
      const rowCity = cityKey(f.City)
      const rowZip = zipKey(f.PostalCode)
      const cityKnown = Boolean(wantCity && rowCity)
      const zipKnown = Boolean(wantZip && rowZip)
      const samePlace = (cityKnown && rowCity === wantCity) || (zipKnown && rowZip === wantZip) || (!cityKnown && !zipKnown)
      if (!samePlace) continue
      const rowName = streetNameKey(f.StreetName)
      if (nameKey && rowName && rowName !== nameKey) continue
      const rowUnit = unitKey(f.UnitNumber)
      if (unit && rowUnit && rowUnit !== unit) continue
      const rowKey = typeof f.ListingKey === 'string' ? f.ListingKey : null
      const since = ymd(f.StatusChangeTimestamp) ?? ymd(f.OnMarketDate)
      return blocked(
        `Spark: ${addressLine(f)} is ${status}${since ? ` since ${since}` : ''} (listing ${rowKey ?? '?'})`,
        status,
        rowKey,
        since,
        closeDate,
      )
    }
  }
  return { ...CLEAR, closeDate }
}
