/**
 * Live MLS relist check for the expired / FSBO outreach send path.
 *
 * verifyNotRelisted (lib/data/prospecting/batch.ts) reads our listings table,
 * and our table can lag the MLS. On 2026-09-30, 74 of the 552 expired-listing
 * outreach targets had their own listing key back on the market in Spark while
 * our copy still read Expired (the delta sync had skipped finalized rows), for
 * example 15 NW Franklin, Bend, relisted the evening it expired. Soliciting the
 * owner of a home listed with another broker is a license problem, so the send
 * path also asks Spark, the MLS itself, right before it sends:
 *
 *   1. the subject listing by key: on the market (Active, Active Under
 *      Contract, Coming Soon, Pending) or Closed blocks;
 *   2. one page of on-market listings at the same street number and city:
 *      any on the same street and unit blocks. A condo building answers with
 *      every listed unit (2745 NW Ordway had six), so the street name and the
 *      unit decide; an unknown unit on either side blocks, the safe side.
 *
 * Both calls run in parallel with `_select` limited to the seven fields read
 * here, bounded by SPARK_RELIST_TIMEOUT_MS, and never wait out a 429. Any
 * error, timeout or ambiguous answer fails closed (verifyFailed), which the
 * caller turns into "do not send". Measured 2026-09-30 from a dev container
 * against live Spark, 30 calls over 10 real prospects: p50 90 ms, p90 242 ms,
 * max 392 ms (the slow ones open a connection).
 */
import 'server-only'
import { COMING_SOON_STATUS } from '@/lib/listing-status-public'
import { fetchSparkListingByKey, fetchSparkListingsPage } from '@/lib/spark'

/**
 * The on-market statuses in this MLS's enumeration (Spark
 * /standardfields/StandardStatus, 2026-09-30), pre-marketing included: a home
 * listed with a broker is off limits before it is public.
 */
export const SPARK_ON_MARKET_STATUSES = ['Active', 'Active Under Contract', COMING_SOON_STATUS, 'Pending'] as const

/** Upper bound on the check, per call; past it the send is blocked. */
export const SPARK_RELIST_TIMEOUT_MS = 8_000

const RELIST_SELECT = 'ListingKey,StandardStatus,StreetNumber,StreetName,UnitNumber,City,CloseDate'
const ADDRESS_PAGE_LIMIT = 100
const ON_MARKET = new Set<string>(SPARK_ON_MARKET_STATUSES)

/**
 * No off-market date is needed: any listing on the market right now at the
 * subject's address and unit is someone's listing today, whenever it started,
 * and the subject's own key closing means it sold after it came off.
 */
export type SparkRelistInput = {
  /** The expired listing's own key (expired prospects); null for FSBO. */
  listingKey: string | null
  streetAddress: string | null
  city: string | null
}

export type SparkRelistResult = {
  relisted: boolean
  /** Spark could not answer: the caller must not send. */
  verifyFailed: boolean
  /** Which listing blocked the send, or why the check could not answer. */
  reason: string | null
  /** The MLS status that blocked (Active, Active Under Contract, Coming Soon, Pending, Closed). */
  blockedStatus: string | null
  /** The listing that blocked. */
  blockedKey: string | null
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

const CLEAR: SparkRelistResult = { relisted: false, verifyFailed: false, reason: null, blockedStatus: null, blockedKey: null }

function failed(reason: string): SparkRelistResult {
  return { ...CLEAR, verifyFailed: true, reason }
}

function blocked(reason: string, status: string, key: string | null): SparkRelistResult {
  return { ...CLEAR, relisted: true, reason, blockedStatus: status, blockedKey: key }
}

function addressLine(f: Record<string, unknown>): string {
  const unit = f.UnitNumber ? ` #${String(f.UnitNumber)}` : ''
  return `${String(f.StreetNumber ?? '')} ${String(f.StreetName ?? '')}${unit}, ${String(f.City ?? '')}`.trim()
}

/** Ask Spark whether the subject listing, or its address, is back on the market. Fail closed. */
export async function sparkRelistCheck(
  input: SparkRelistInput,
  opts: { timeoutMs?: number } = {},
): Promise<SparkRelistResult> {
  const address = parseStreetAddress(input.streetAddress)
  const key = input.listingKey?.trim() || null
  if (!key && !address.number) return { ...CLEAR }
  const token = (process.env.SPARK_API_KEY ?? '').trim()
  if (!token) return failed('SPARK_API_KEY is not set')
  const timeoutMs = opts.timeoutMs ?? SPARK_RELIST_TIMEOUT_MS

  const city = input.city?.trim() || null
  const filter = [
    `StreetNumber Eq ${sparkQuote(address.number ?? '')}`,
    city ? `City Eq ${sparkQuote(city)}` : null,
    `(${SPARK_ON_MARKET_STATUSES.map((s) => `StandardStatus Eq '${s}'`).join(' Or ')})`,
  ]
    .filter(Boolean)
    .join(' And ')

  const [subjectRead, addressRead] = await Promise.allSettled([
    key
      ? withDeadline(fetchSparkListingByKey(token, key, '', { select: RELIST_SELECT, timeoutMs }), timeoutMs, 'by-key')
      : Promise.resolve(null),
    address.number
      ? withDeadline(
          fetchSparkListingsPage(token, { page: 1, limit: ADDRESS_PAGE_LIMIT, filter, select: RELIST_SELECT, timeoutMs, retryOn429: false }),
          timeoutMs,
          'address',
        )
      : Promise.resolve(null),
  ])
  if (subjectRead.status === 'rejected') return failed(`Spark by-key read failed: ${String(subjectRead.reason?.message ?? subjectRead.reason)}`)
  if (addressRead.status === 'rejected') return failed(`Spark address read failed: ${String(addressRead.reason?.message ?? addressRead.reason)}`)

  // 1. The subject listing itself (null: Spark does not know the key; the address check decides).
  const subject = (subjectRead.value?.D?.Results?.[0]?.StandardFields ?? null) as Record<string, unknown> | null
  if (subject) {
    const status = String(subject.StandardStatus ?? '')
    if (ON_MARKET.has(status)) return blocked(`Spark: listing ${key} is ${status}`, status, key)
    if (/closed/i.test(status)) {
      return blocked(`Spark: listing ${key} is Closed (${String(subject.CloseDate ?? 'no close date')})`, 'Closed', key)
    }
  }

  // 2. Any listing on the market at the same street number, city, street and unit.
  const page = addressRead.value
  if (page) {
    if (!page.D || page.D.Success === false) return failed('Spark address read returned no result set')
    const rows = page.D.Results ?? []
    const total = page.D.Pagination?.TotalRows ?? rows.length
    if (total > rows.length) return failed(`Spark lists ${total} listings on the market at ${address.number}, more than one page shows`)
    const nameKey = streetNameKey(subject?.StreetName) ?? address.nameKey
    const unit = unitKey(subject?.UnitNumber) ?? address.unit
    for (const r of rows) {
      const f = (r.StandardFields ?? {}) as Record<string, unknown>
      const status = String(f.StandardStatus ?? '')
      if (!ON_MARKET.has(status)) continue
      const rowName = streetNameKey(f.StreetName)
      if (nameKey && rowName && rowName !== nameKey) continue
      const rowUnit = unitKey(f.UnitNumber)
      if (unit && rowUnit && rowUnit !== unit) continue
      const rowKey = typeof f.ListingKey === 'string' ? f.ListingKey : null
      return blocked(`Spark: ${addressLine(f)} is ${status} (listing ${rowKey ?? '?'})`, status, rowKey)
    }
  }
  return { ...CLEAR }
}
