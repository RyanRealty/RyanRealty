/**
 * WHY A HOME IN THE AREA IS NOT COMPARED, SAID ONLY AS FAR AS IT IS TRUE
 * (reader review 2026-10-08).
 *
 * The letter used to say of every home the fit refused: "None were close to
 * this home in bedrooms, bathrooms, size or age, so they are not compared
 * here." On 3062 NW Kelly Hill both homes that came off unsold were 3 bed 2
 * bath like the subject; they were refused for size alone (3,070 and 2,142
 * square feet against 1,702). 1355 Jacksonville said the same of homes with
 * its own room counts. A list of four reasons is read as all four.
 *
 * Each refused home is described here by the refusal `sameAreaFit` itself
 * returned (lib/cma/same-area-fit.ts, the one fit the competition and the
 * came-off homes pass), with the direction and the limit read off the same
 * numbers the fit compared. The sentence names only those reasons.
 */

import {
  SAME_AREA_SQFT_BAND,
  sameAreaAgeYears,
  sameAreaFit,
  type SameAreaCandidate,
  type SameAreaReason,
  type SameAreaSubject,
} from '@/lib/cma/same-area-fit'
import { countWord } from '@/lib/pricing/estimate'
import type { CompArea } from '@/lib/pricing/comp-area'

/** One home in the area that did not pass the fit, with the reason that is true of it. */
export type CmaUnlikeHome = {
  /** Its own last ask: the list price on its row. Null when the row has none. */
  lastAsk: number | null
  /** The first rule it failed, in `sameAreaFit`'s order. */
  reason: SameAreaReason
  /** Size: larger or smaller than the subject. Age: built before or after it. */
  direction?: 'larger' | 'smaller' | 'older' | 'newer' | null
  /** Rooms: the counts that differ. */
  rooms?: Array<'beds' | 'baths'> | null
  /** The limit the rule held it to: percent for size, years for age. */
  limit?: number | null
}

/**
 * The refusal for one home, or null when the home fits. The direction and the
 * limit are read off the same numbers `sameAreaFit` compared.
 */
export function describeUnlikeHome(
  area: CompArea | null,
  subject: Partial<SameAreaSubject>,
  candidate: SameAreaCandidate,
  lastAsk: number | null,
): CmaUnlikeHome | null {
  const fit = sameAreaFit(area, subject, candidate)
  if (fit.ok) return null
  const ask = lastAsk != null && Number.isFinite(lastAsk) && lastAsk > 0 ? lastAsk : null
  const home: CmaUnlikeHome = { lastAsk: ask, reason: fit.reason }
  if (fit.reason === 'size') {
    const s = subject.sqft ?? null
    const c = candidate.sqft ?? null
    home.direction = s != null && c != null ? (c > s ? 'larger' : 'smaller') : null
    home.limit = Math.round(SAME_AREA_SQFT_BAND * 100)
  } else if (fit.reason === 'age') {
    const s = subject.yearBuilt ?? null
    const c = candidate.yearBuilt ?? null
    home.direction = s != null && c != null ? (c < s ? 'older' : 'newer') : null
    home.limit = sameAreaAgeYears(area)
  } else if (fit.reason === 'rooms') {
    home.rooms = fit.rooms ?? []
  }
  return home
}

type Verb = { one: string; many: string }
const BE: Verb = { one: 'is', many: 'are' }
const HAVE: Verb = { one: 'has', many: 'have' }
const WAS: Verb = { one: 'was', many: 'were' }

/** The predicate for one reason, with its verb, singular or plural. */
function reasonPredicate(home: CmaUnlikeHome, many: boolean): string {
  const v = (verb: Verb) => (many ? verb.many : verb.one)
  switch (home.reason) {
    case 'size': {
      const pct = home.limit != null && home.limit > 0 ? home.limit : Math.round(SAME_AREA_SQFT_BAND * 100)
      const how =
        home.direction === 'larger' ? 'larger' : home.direction === 'smaller' ? 'smaller' : 'larger or smaller'
      return `${v(BE)} more than ${pct} percent ${how} than this home`
    }
    case 'age': {
      if (home.limit == null || !(home.limit > 0)) return `${v(BE)} too far apart from this home in age`
      const when = home.direction === 'older' ? 'before' : home.direction === 'newer' ? 'after' : 'apart from'
      return `${v(WAS)} built more than ${home.limit} years ${when} this home`
    }
    case 'rooms': {
      const r = home.rooms ?? []
      const rooms =
        r.includes('beds') && r.includes('baths')
          ? 'bedrooms and bathrooms'
          : r.includes('beds')
            ? 'bedrooms'
            : r.includes('baths')
              ? 'bathrooms'
              : 'bedrooms or bathrooms'
      return `${v(HAVE)} a different number of ${rooms}`
    }
    case 'product':
      return `${v(BE)} a different kind of home`
    case 'adu':
      return `${v(HAVE)} a second living unit, such as an ADU, and this home does not`
    case 'area':
    default:
      return `${v(BE)} not enough like this home to compare`
  }
}

function groupKey(home: CmaUnlikeHome): string {
  return [home.reason, home.direction ?? '', (home.rooms ?? []).join('+'), home.limit ?? ''].join('|')
}

/** "a, b and c". */
function joinAnd(parts: readonly string[]): string {
  if (parts.length <= 1) return parts[0] ?? ''
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/**
 * "Both are more than 25 percent larger than this home, so they are not
 * compared here." Only the reasons the homes were refused for, grouped. With
 * no home described, the sentence says they are not enough like this home and
 * names no reason it cannot back. Empty when `count` is zero.
 */
export function unlikeReasonSentence(homes: readonly CmaUnlikeHome[] | null | undefined, count?: number): string {
  const list = homes ?? []
  const n = count ?? list.length
  if (!(n > 0)) return ''
  const them = n === 1 ? 'it is' : 'they are'
  if (list.length !== n) {
    // The homes were counted but not described (a row stored before the
    // reasons were): say what is true of all of them, and no more.
    const who = n === 1 ? 'It is not' : n === 2 ? 'Neither is' : 'None is'
    return `${who} enough like this home to compare here.`
  }
  const groups = new Map<string, { home: CmaUnlikeHome; n: number }>()
  for (const home of list) {
    const key = groupKey(home)
    const g = groups.get(key)
    if (g) g.n += 1
    else groups.set(key, { home, n: 1 })
  }
  const all = [...groups.values()]
  if (all.length === 1) {
    const only = all[0]!
    const who = n === 1 ? 'It' : n === 2 ? 'Both' : `All ${countWord(n)}`
    const said = `${who} ${reasonPredicate(only.home, n > 1)}, so ${them} not compared here.`
    // "It is not enough like this home to compare, so it is not compared here" says one thing twice.
    return only.home.reason === 'area' ? `${who} ${reasonPredicate(only.home, n > 1)} here.` : said
  }
  const parts = all.map((g, i) => `${countWord(g.n, i === 0)} ${reasonPredicate(g.home, g.n > 1)}`)
  return `${joinAnd(parts)}, so ${them} not compared here.`
}

/**
 * The homes' own last asks, with the preposition: "at $895,000 and $999,000",
 * "at $895,000 each", or four and more as their span, "between $640,000 and
 * $1,100,000". Empty when a home in the list has no ask on its row, because a
 * phrase that skipped one would not be the asks of the homes counted.
 */
export function unlikeAsksPhrase(homes: readonly CmaUnlikeHome[] | null | undefined): string {
  const list = homes ?? []
  if (list.length === 0) return ''
  if (list.some((h) => h.lastAsk == null || !(h.lastAsk > 0))) return ''
  const asks = list.map((h) => Math.round(h.lastAsk!)).sort((a, b) => a - b)
  const unique = [...new Set(asks)]
  const usd = (n: number) => `$${n.toLocaleString('en-US')}`
  if (unique.length === 1) return asks.length === 1 ? `at ${usd(unique[0]!)}` : `at ${usd(unique[0]!)} each`
  if (asks.length <= 3) return `at ${joinAnd(asks.map(usd))}`
  return `between ${usd(asks[0]!)} and ${usd(asks[asks.length - 1]!)}`
}
