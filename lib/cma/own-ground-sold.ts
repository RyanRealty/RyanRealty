/**
 * DID ANY HOME SELL ON THE SUBJECT'S OWN GROUND AT ALL (reader review
 * 2026-10-09, 915 Saginaw).
 *
 * The comp story said "No sale inside Park Place in the last 24 months
 * matched your home." No home sold in Park Place in those 24 months, by the
 * MLS name or inside the recorded polygon, so "matched" suggested sales that
 * were looked at and turned down. The own-subdivision rungs cannot say which
 * it was: the facts pool is read 60 to 140 percent of the home's size and of
 * its own product, and the listings rungs read their size band in the query.
 * So when those rungs found nothing, this reads the subject's own ground once,
 * any size and any residential type, over the same window, and the sentence
 * says "No home sold in Park Place in the last 24 months" only when this read
 * holds none (lib/pricing/comp-search.ts absentSentence).
 *
 * The ground is the one decision every rule asks (lib/pricing/plat-ground.ts
 * platGroundReach): the recorded plat the home sits in, its phases and family
 * inside its neighborhood, and the MLS name for a row no polygon holds. Both
 * shapes are read, the MLS name and the box around the recorded plats, so a
 * zero is a zero by name and by polygon (CLAUDE.md §0, "Reporting absence
 * from ONE query shape").
 */
import { selectCmaCompsPool, type CmaListingRow } from '@/lib/data/cma/builderReads'
import { getPlatGroundBounds } from '@/lib/data/cma/platGroundBounds'
import { assignSubdivisionSlugs } from '@/lib/data/geo/subdivision-ring'
import { platGroundReach, subjectPlatGround } from '@/lib/pricing/plat-ground'
import { usableSubdivision } from '@/lib/pricing/comp-search'
import type { CmaSubject } from '@/lib/cma/types'

/** What the read found, stored on the selection diagnostics as `own_ground_sold`. */
export type OwnGroundSold = {
  /** The window read, in months back from the as-of day: the widest own-subdivision rung's. */
  months: number
  /** First close day read (inclusive). */
  since: string
  /** Distinct closed sales on the subject's own ground in that window, any size. At least this many when `capped`. */
  n: number
  /** True when a read hit its row cap, so `n` is a floor. */
  capped: boolean
  /** The reads, for the citation. */
  source: string
}

const NAMED_LIMIT = 100
const BOX_LIMIT = 500

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/** The calendar day `months` before `asOf` (YYYY-MM-DD), the window the rungs read. */
export function monthsBefore(asOf: string, months: number): string {
  const d = new Date(`${asOf.slice(0, 10)}T12:00:00.000Z`)
  d.setUTCMonth(d.getUTCMonth() - months)
  return d.toISOString().slice(0, 10)
}

/**
 * The sales the reads returned that sit on the subject's own ground, one per
 * closed sale (address and close price), never the subject itself. Pure.
 */
export function ownGroundSales(
  subject: Pick<CmaSubject, 'subdivision' | 'city' | 'latitude' | 'longitude' | 'streetAddress'> &
    Partial<Pick<CmaSubject, 'subdivisionSlug' | 'listingKey'>>,
  rows: readonly CmaListingRow[],
  plats: readonly (string | null)[],
): CmaListingRow[] {
  const ground = subjectPlatGround(subject)
  const self = (subject.streetAddress ?? '').trim().toLowerCase()
  const seen = new Set<string>()
  const out: CmaListingRow[] = []
  rows.forEach((row, i) => {
    const key = str(row['ListingKey'])
    if (key && subject.listingKey && key === subject.listingKey) return
    const address = [row['StreetNumber'], row['StreetName']].filter(Boolean).join(' ').trim().toLowerCase()
    if (self && address === self) return
    const onGround =
      platGroundReach(ground, {
        platSlug: plats[i] ?? null,
        subdivision: str(row['SubdivisionName']),
        latitude: num(row['Latitude']),
        longitude: num(row['Longitude']),
      }) != null
    if (!onGround) return
    const sale = `${address}|${Math.round(num(row['ClosePrice']) ?? 0)}`
    if (seen.has(sale)) return
    seen.add(sale)
    out.push(row)
  })
  return out
}

/**
 * Read the subject's own ground over the window. Null when the subject has no
 * usable subdivision or a read failed: no claim is made then.
 */
export async function readOwnGroundSold(args: {
  subject: CmaSubject
  months: number
  asOf: string
}): Promise<OwnGroundSold | null> {
  const { subject } = args
  const name = usableSubdivision(subject.subdivision)
  if (!name || !subject.city || !(args.months > 0)) return null
  const since = monthsBefore(args.asOf, args.months)
  try {
    const ground = subjectPlatGround(subject)
    const [named, box] = await Promise.all([
      selectCmaCompsPool({ cityIlike: subject.city, subdivisionIlike: name, closeDateGte: since, limit: NAMED_LIMIT, throwOnError: true }),
      getPlatGroundBounds(ground, { city: subject.city }),
    ])
    const boxed = box
      ? await selectCmaCompsPool({ cityIlike: subject.city, closeDateGte: since, bounds: box, limit: BOX_LIMIT, throwOnError: true })
      : []
    const byKey = new Map<string, CmaListingRow>()
    for (const r of [...named, ...boxed]) {
      const key = str(r['ListingKey'])
      if (key && !byKey.has(key)) byKey.set(key, r)
    }
    const rows = [...byKey.values()]
    const plats = await assignSubdivisionSlugs(rows.map((r) => ({ lat: num(r['Latitude']), lng: num(r['Longitude']) })))
    const sold = ownGroundSales(subject, rows, plats)
    // A plat lookup that failed reads as "no polygon" on every row. Rows in
    // the box with no plat at all is that failure, not evidence, so a zero
    // read that way makes no claim.
    if (sold.length === 0 && rows.length > 0 && plats.every((p) => p == null)) return null
    return {
      months: args.months,
      since,
      n: sold.length,
      capped: named.length >= NAMED_LIMIT || boxed.length >= BOX_LIMIT,
      source:
        `listings, Closed, PropertyType A, any size and sub type, City ILIKE '${subject.city}', CloseDate >= ${since}: ` +
        `SubdivisionName ILIKE '${name}' (${named.length} rows) and the box around the recorded plats (${boxed.length} rows), ` +
        `kept when the point sits on the subject's own ground (platGroundReach): ${sold.length}`,
    }
  } catch (err) {
    console.error('[readOwnGroundSold]', err instanceof Error ? err.message : String(err))
    return null
  }
}
