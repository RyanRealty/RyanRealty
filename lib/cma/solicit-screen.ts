/**
 * THE SOLICITATION SCREEN — the last thing between our list and a listed seller.
 *
 * Matt 2026-09-09: "we have to ensure that we do not send out solicitations to
 * for-sale-by-owners that are listed on the MLS or expired listings that either
 * sold since they came off the market or are currently listed. That just has to
 * be behind the scenes. You can just pull them right off the list."
 *
 * Why it is a hard block and not a preference: soliciting a seller who is
 * already under an exclusive listing agreement is a licensing and ethics
 * problem for a principal broker (NAR Article 16, and Oregon's own conduct
 * rules), and writing to someone whose home sold weeks ago is a different kind
 * of failure — it says we do not know the market we claim to know.
 *
 * The screen reads the CURRENT MLS state for the SUBJECT'S ADDRESS, not for the
 * listing key we started from. A relist carries a NEW ListingKey, so the old
 * key's status reads "Expired" forever; only the address tells the truth.
 *
 * It FAILS CLOSED. An unreadable listings table blocks the send and says why,
 * the same rule lib/crm/suppressions.ts follows. An unverified row is never
 * archived — a degraded read must not delete a live prospect (§0: unknown is
 * not empty).
 */

import { findCmaSubjectByAddress, findCmaSubjectByMls } from '@/lib/data'
import type { CmaListingRow } from '@/lib/data'
import { parseCmaAddress } from '@/lib/cma/subject'

export type SolicitBlockReason = 'sold' | 'listed' | 'pending' | 'unverified'

export type SolicitScreen =
  | { ok: true; checked: number; detail: string }
  | { ok: false; reason: SolicitBlockReason; detail: string; listingKey: string | null; checked: number }

/** Statuses that mean a broker holds this listing right now. */
const ON_MARKET = new Set(['Active', 'Active Under Contract', 'Coming Soon'])
const UNDER_CONTRACT = new Set(['Pending'])

/** With no off-market date to measure against, a sale older than this is history. */
export const RECENT_SALE_MONTHS = 12

function isoMonthsAgo(months: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - months)
  return d.toISOString().slice(0, 10)
}

const DIRECTIONALS = new Set(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw', 'north', 'south', 'east', 'west'])

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function iso(v: unknown): string | null {
  const s = str(v)
  return s ? s.slice(0, 10) : null
}

/**
 * Normalize a UNIT FIELD: "UNIT 12", "#12", "12", "12 Lot 20" → "12".
 * This is for a value that is already known to be a unit — never for an
 * address. Feeding it "61304 Wizard, Bend, OR 97702" used to return the whole
 * string as a "unit", which matched no row and silently emptied the screen on
 * a 15-listing condo complex (caught 2026-09-09 on 61304 Wizard and 57655
 * Aspen, both actively listed, both wrongly cleared).
 */
export function unitToken(value: string | null | undefined): string | null {
  const s = str(value)
  if (!s) return null
  const marked = s.match(/(?:#|\bunit\b|\bapt\b|\bste\b|\bsuite\b)\s*([A-Za-z0-9-]+)/i)
  const bare = s.match(/^([A-Za-z0-9-]+)/)
  const raw = marked ? marked[1] : bare ? bare[1] : null
  const t = (raw ?? '').trim().toLowerCase().replace(/^0+(?=\d)/, '')
  return t || null
}

/** A unit ONLY when the address says so explicitly. No marker, no unit. */
export function unitFromAddress(address: string | null | undefined): string | null {
  const s = str(address)
  if (!s) return null
  const m = s.match(/(?:#|\bunit\b|\bapt\b|\bste\b|\bsuite\b)\s*([A-Za-z0-9-]+)/i)
  return m ? unitToken(m[1]) : null
}

/**
 * The rows that describe the SUBJECT's home, not its neighbours in the same
 * building. Returns 'ambiguous' when the address is multi-unit and the
 * subject's unit is unknown.
 */
function narrowToUnit(
  rows: readonly CmaListingRow[],
  subjectUnit: string | null,
  unitKnown: boolean,
): CmaListingRow[] | 'ambiguous' {
  const unitOf = (r: CmaListingRow) => unitToken((r as unknown as Record<string, unknown>).unit_number as string | null)
  const units = new Set(rows.map(unitOf).filter((u): u is string => Boolean(u)))
  const want = unitToken(subjectUnit)
  // THE SUBJECT'S OWN ROW SETTLES IT, including when it says "no unit". A
  // house whose address also carries a neighbour's lot number ("lot #79") or a
  // fractional share ("Share 4") is a whole property, and those rows are other
  // people's homes: 21512 Etna and 3345 Panorama both read as ambiguous until
  // this case existed (2026-09-09).
  if (unitKnown) {
    return rows.filter((r) => unitOf(r) === want)
  }
  if (want) {
    const exact = rows.filter((r) => unitOf(r) === want)
    if (exact.length > 0) return exact
    // The subject's unit has no listing of its own. Only the rows recorded
    // WITHOUT a unit can speak for it, and only when this address has no
    // unit-bearing rows at all — otherwise the null rows are some other home's
    // and deciding from them is how an Active listing gets missed.
    if (units.size > 0) return 'ambiguous'
    return rows.filter((r) => unitOf(r) == null)
  }
  if (units.size === 0) return [...rows]
  // Multi-unit address, unknown subject unit. A row recorded WITHOUT a unit
  // does not prove it is the subject's home: 57655 Aspen has an Active unit 2
  // and one older sale with no unit, and reading that sale as "the property"
  // cleared a listed condo. Unknown is unknown.
  return 'ambiguous'
}

/** Newest first, by the date the listing actually went on the market. */
function newestFirst(rows: readonly CmaListingRow[]): CmaListingRow[] {
  return [...rows].sort((a, b) => {
    const ad = iso((a as Record<string, unknown>).OnMarketDate) ?? iso((a as Record<string, unknown>).ListDate) ?? ''
    const bd = iso((b as Record<string, unknown>).OnMarketDate) ?? iso((b as Record<string, unknown>).ListDate) ?? ''
    return bd.localeCompare(ad)
  })
}

/**
 * Decide from the rows alone, so the rule is testable without a database.
 * `sinceIso` is the date the prospect came off the market; a close before that
 * belongs to an older chapter of the property and is not "sold since".
 */
export function decideSolicitScreen(
  rows: readonly CmaListingRow[],
  opts: {
    sinceIso?: string | null
    unit?: string | null
    /**
     * True when the subject's OWN listing row was read, so `unit` is the
     * answer even when it is null. Without this a whole-property subject and
     * an unknown one look identical, and the screen cannot tell a condo
     * building from a house whose neighbours' rows carry a lot number.
     */
    unitKnown?: boolean
  } = {},
): SolicitScreen {
  // ONE ADDRESS CAN BE MANY HOMES. A condo building shares its street address
  // across every unit, so an Active listing on #12 must not silence the owner
  // of #14. Rows are narrowed to the subject's unit before anything is decided,
  // and where the unit cannot be established on a multi-unit address the screen
  // returns unverified — which blocks the send and archives nothing.
  const narrowed = narrowToUnit(rows, opts.unit ?? null, opts.unitKnown === true)
  if (narrowed === 'ambiguous') {
    return {
      ok: false,
      reason: 'unverified',
      detail:
        'This street address carries listings for more than one unit and the subject\'s unit is not recorded, so its MLS state cannot be established.',
      listingKey: null,
      checked: rows.length,
    }
  }
  rows = narrowed
  const checked = rows.length
  if (checked === 0) {
    // No MLS record for the address is the normal FSBO case: nothing to block.
    return { ok: true, checked, detail: 'No MLS listing on record for this address.' }
  }
  // THE REFERENCE DATE — what "sold since" is measured against. The caller's
  // off-market date when it has one; otherwise the newest listing on record
  // that is NOT a sale, which IS the listing we are prospecting. Without this
  // the screen read a 2011 close as a reason to skip a 2026 expired owner
  // (1204 NW Iowa, caught on the first live run), which pulls real prospects
  // off the list for a sale that happened fifteen years ago.
  const explicit = opts.sinceIso ? opts.sinceIso.slice(0, 10) : null
  const newestOpen = newestFirst(rows)
    .filter((r) => str((r as unknown as Record<string, unknown>).StandardStatus) !== 'Closed')
    .map((r) => {
      const rec = r as unknown as Record<string, unknown>
      return iso(rec.status_change_timestamp) ?? iso(rec.OnMarketDate) ?? iso(rec.ListDate)
    })
    .find((d): d is string => Boolean(d)) ?? null
  const since = explicit ?? newestOpen
  for (const row of newestFirst(rows)) {
    const r = row as unknown as Record<string, unknown>
    const status = str(r.StandardStatus)
    const key = str(r.ListingKey) || null
    if (ON_MARKET.has(status)) {
      return {
        ok: false,
        reason: 'listed',
        detail: `The address is on the MLS right now as ${status}${key ? ` (${key})` : ''}. A listed seller is not ours to solicit.`,
        listingKey: key,
        checked,
      }
    }
    if (UNDER_CONTRACT.has(status)) {
      return {
        ok: false,
        reason: 'pending',
        detail: `The address is under contract on the MLS${key ? ` (${key})` : ''}, so it is still someone's listing.`,
        listingKey: key,
        checked,
      }
    }
    if (status === 'Closed') {
      const closed = iso(r.CloseDate)
      // With no reference date at all, only a RECENT sale blocks. An old sale
      // is part of the property's history, not a reason to stay silent.
      const recentEnough = closed ? closed >= isoMonthsAgo(RECENT_SALE_MONTHS) : false
      if ((since && closed && closed >= since) || (!since && recentEnough)) {
        return {
          ok: false,
          reason: 'sold',
          detail: `The address closed${closed ? ` on ${closed}` : ''}${key ? ` (${key})` : ''}${
            since ? `, after it came off the market on ${since}` : ''
          }.`,
          listingKey: key,
          checked,
        }
      }
    }
  }
  return { ok: true, checked, detail: `Checked ${checked} MLS listing(s) for this address; none is live or newly closed.` }
}

/**
 * The live screen. Resolves the address the same way the builder does — the
 * MLS stores StreetName without the directional on nearly every row, so the
 * direction-stripped name is the fallback that makes westside Bend addresses
 * resolve at all.
 */
export async function screenAddressForSolicitation(input: {
  address: string | null | undefined
  city?: string | null
  postalCode?: string | null
  /** When the prospect came off the market, so an older sale is not "sold since". */
  sinceIso?: string | null
  /** The subject's unit, when the row carries one. A condo address is many homes. */
  unit?: string | null
  /**
   * The subject's own MLS listing. Its `unit_number` is the reliable answer to
   * "which home is this?" on a shared address — better than any address parse.
   */
  subjectListingKey?: string | null
}): Promise<SolicitScreen> {
  const raw = str(input.address)
  if (!raw) {
    return { ok: false, reason: 'unverified', detail: 'No subject address to screen.', listingKey: null, checked: 0 }
  }
  const parsed = parseCmaAddress(raw, input.city ?? null, input.postalCode ?? null)
  if (!parsed) {
    return {
      ok: false,
      reason: 'unverified',
      detail: `Could not parse "${raw}" into a street number and name, so its MLS state is unknown.`,
      listingKey: null,
      checked: 0,
    }
  }
  const namePrefix = parsed.streetNameTokens.join(' ')
  const prefixes = [namePrefix]
  const first = parsed.streetNameTokens[0]
  if (parsed.streetNameTokens.length > 1 && first && DIRECTIONALS.has(first)) {
    prefixes.push(parsed.streetNameTokens.slice(1).join(' '))
  }
  const seen = new Map<string, CmaListingRow>()
  let read = false
  for (const prefix of prefixes) {
    try {
      const byCity = await findCmaSubjectByAddress({
        streetNumber: parsed.streetNumber,
        streetNameIlike: `${prefix}%`,
        cityIlike: parsed.city,
      })
      read = true
      for (const row of byCity) seen.set(str((row as unknown as Record<string, unknown>).ListingKey), row)
      if (byCity.length === 0 && parsed.postalCode) {
        const byZip = await findCmaSubjectByAddress({
          streetNumber: parsed.streetNumber,
          streetNameIlike: `${prefix}%`,
          postalCode: parsed.postalCode,
        })
        for (const row of byZip) seen.set(str((row as unknown as Record<string, unknown>).ListingKey), row)
      }
    } catch (e) {
      return {
        ok: false,
        reason: 'unverified',
        detail: `The MLS read failed, so this address could not be screened: ${e instanceof Error ? e.message : String(e)}`,
        listingKey: null,
        checked: 0,
      }
    }
  }
  if (!read) {
    return { ok: false, reason: 'unverified', detail: 'The MLS read did not answer.', listingKey: null, checked: 0 }
  }
  // The unit, in order of reliability: what the caller passed, the subject's
  // own listing row, then an explicit unit written into the address.
  const all = [...seen.values()]
  let own = input.subjectListingKey
    ? all.find((r) => str((r as unknown as Record<string, unknown>).ListingKey) === str(input.subjectListingKey))
    : undefined
  // The address read returns the 15 most recent listings. On a large complex
  // the subject's own (older) listing falls outside that window, and without it
  // the unit is unknown and the screen can only answer "unverified". Read it
  // straight from its key instead.
  if (!own && input.subjectListingKey) {
    try {
      const byKey = await findCmaSubjectByMls(input.subjectListingKey)
      own = byKey[0]
      for (const row of byKey) seen.set(str((row as unknown as Record<string, unknown>).ListingKey), row)
    } catch {
      // The address rows still decide; a failed key read is not fatal here.
    }
  }
  const ownUnitField = (own as unknown as Record<string, unknown> | undefined)?.unit_number as string | null | undefined
  const unitKnown = input.unit != null || own != null
  const unit =
    input.unit ?? (own != null ? unitToken(ownUnitField ?? null) : unitFromAddress(raw))
  return decideSolicitScreen([...seen.values()], { sinceIso: input.sinceIso ?? null, unit, unitKnown })
}
