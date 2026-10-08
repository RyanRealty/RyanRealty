/**
 * HOW THE SALES WERE CHOSEN AND ADJUSTED, in plain English, for Basis and
 * limits (Matt 2026-10-07).
 *
 * The price chapter used to print three stored method sentences under its
 * headline. On 2566 Keats they read like notes to ourselves ("One more was
 * added: 530 Majesty in Deer Pointe Village.", "That share is a list-strategy
 * fact. It is not applied to this range.") and one of them was wrong against
 * the grid: "every sale below moves down" sat over a sale the grid moved by $0.
 *
 * Delivered documents carry those sentences STORED on render_args
 * (`pricing.timeAdjustment.sentence`, `pricing.rangeRule.sentence`,
 * `compSearch.sentence`), so changing the pricing builder alone would never
 * reach a report that has already gone out. This composes the reader's
 * paragraph from the structured fields beside them, and from the grid the
 * reader can check, at render time:
 *
 *  - which sales sit outside the home's subdivision, named, with their own
 *    subdivision (CMA rule 17: the count you use is the count you show, and a
 *    sale in another subdivision is named with that subdivision);
 *  - the date move: the city's monthly price-per-square-foot figure
 *    (`timeAdjustment.n`, `.windowMonths`, `.shape.extreme`,
 *    `.shape.extremeMonth`, `.shape.sinceExtremePct`), and how many of the
 *    printed sales it actually moved, read off each sale's own
 *    `timeAdjustment`;
 *  - the sale-to-ask share (`rangeRule.saleToAskRatio`), stated once, with
 *    what it is for.
 *
 * Every number prints exactly as stored, formatted the way the pricing unit
 * formatted it. A basis this does not know (the year-over-year fallback)
 * prints its stored sentence as written.
 *
 * THE EXCLUSIVE POCKET IS COMPOSED, NEVER PRINTED AS STORED (reader review,
 * 2382 Jackson, 2026-10-07). Its stored sentence is an engine note: "These
 * sales are the exclusive pocket ... The Bend city index is not used to pump
 * prices. Size and story class do not adjust.", and the measure line after it
 * ("That index is sold and last-ask prices in this exclusive pocket") was not
 * even true of the move. The homeowner gets one plain sentence on how the
 * dates were moved, counted off the grid; the note stays in build_summary and
 * citations.
 */

import { cleanText, countWord, int } from '@/lib/cma/render-blocks'
import { sanitizeLetterEmDash } from '@/lib/cma/voice-sanitize'
import { FLAT_LOCAL_DATE_SENTENCE } from '@/lib/cma/flat-date-story'
import { realSubdivisionName } from '@/lib/pricing/classes'
import { TIME_ADJUSTMENT_BASIS_POCKET } from '@/lib/pricing/exclusive-pocket-date-adj'
import { concessionOffClose } from '@/lib/pricing/seller-net'
import type { CmaAdjustedComp, CmaPricing, CmaSubject } from '@/lib/cma/types'

const INDEX_BASIS = 'city-monthly-index-trailing-3'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v)
  return v != null && Number.isFinite(n) ? n : null
}

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? sanitizeLetterEmDash(v.trim()) : null
}

function capitalise(s: string): string {
  return s ? `${s.charAt(0).toUpperCase()}${s.slice(1)}` : s
}

function joinAnd(parts: readonly string[]): string {
  if (parts.length <= 1) return parts[0] ?? ''
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/** "May 2026" from "2026-05-01". Null on anything else. */
function monthLabel(month: unknown): string | null {
  const m = typeof month === 'string' ? /^(\d{4})-(\d{2})/.exec(month) : null
  if (!m) return null
  const name = MONTHS[Number(m[2]) - 1]
  return name ? `${name} ${m[1]}` : null
}

function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=\.)\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

// ── which sales ─────────────────────────────────────────────────────────────

/** The search story's "One more was added: ..." sentence, in any count. */
const ADDED_SENTENCE = /\bmore (?:was|were) added\b/i

/**
 * "One of the five sales, 530 Majesty, is outside Hampton Park, in Deer
 * Pointe Village." Read off the printed grid. Null when the home has no
 * subdivision or every printed sale is in it.
 */
export function outsideSubdivisionSentence(
  subject: Pick<CmaSubject, 'subdivision'>,
  comps: readonly CmaAdjustedComp[],
): string | null {
  const home = realSubdivisionName(cleanText(subject.subdivision ?? null))
  if (!home) return null
  const homeKey = home.toLowerCase()
  // A sale with no subdivision on its record is unknown, not outside: §0 says
  // no claim the data does not hold, so the pricing side's own words print.
  if (comps.some((c) => !realSubdivisionName(c.subdivision))) return null
  const outside = comps.filter((c) => realSubdivisionName(c.subdivision)?.toLowerCase() !== homeKey)
  if (outside.length === 0 || outside.length >= comps.length) return null
  const total = comps.length
  if (outside.length === 1) {
    const c = outside[0]!
    const theirs = realSubdivisionName(c.subdivision)
    return `One of the ${countWord(total)} sales, ${c.address}, is outside ${home}${theirs ? `, in ${theirs}` : ''}.`
  }
  const named = outside.map((c) => {
    const theirs = realSubdivisionName(c.subdivision)
    return theirs ? `${c.address} in ${theirs}` : c.address
  })
  return `${capitalise(countWord(outside.length))} of the ${countWord(total)} sales are outside ${home}: ${joinAnd(named)}.`
}

/**
 * The rest of the search story, after the sentence the chapter uses as its
 * heading. The "added" sentence is rewritten from the grid; anything else in
 * the story prints as the pricing side wrote it.
 */
function searchNote(
  subject: Pick<CmaSubject, 'subdivision'>,
  comps: readonly CmaAdjustedComp[],
  tail: string | null | undefined,
): string[] {
  const said = str(tail)
  if (!said) return []
  const outside = outsideSubdivisionSentence(subject, comps)
  return sentencesOf(said).map((s) => (outside && ADDED_SENTENCE.test(s) ? outside : s))
}

// ── the date move ───────────────────────────────────────────────────────────

function months(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((m): m is string => typeof m === 'string').map((m) => m.slice(0, 7)) : []
}

/**
 * How the printed sales moved for date, counted off the grid.
 *
 * A sale the grid did not move is explained only when the index says why:
 * its month sits inside the window and is in neither `shape.movesDown` nor
 * `shape.movesUp`, so that month's level already IS today's. "Sold in the last
 * three months" is not that reason: on 61404 Skene two July sales inside the
 * reference months still moved, because July's own level is a different
 * three-month window.
 */
function dateMovesSentence(comps: readonly CmaAdjustedComp[], ta: Record<string, unknown>): string {
  const total = comps.length
  const down = comps.filter((c) => (c.timeAdjustment ?? 0) <= -1).length
  const up = comps.filter((c) => (c.timeAdjustment ?? 0) >= 1).length
  const still = comps.filter((c) => Math.abs(c.timeAdjustment ?? 0) < 1)
  if (down === 0 && up === 0) return ''
  if (down === total) return `That moves all ${countWord(total)} sales down.`
  if (up === total) return `That moves all ${countWord(total)} sales up.`
  const parts: string[] = []
  if (down > 0) parts.push(`${countWord(down)} of the ${countWord(total)} sales down`)
  if (up > 0) parts.push(down > 0 ? `${countWord(up)} up` : `${countWord(up)} of the ${countWord(total)} sales up`)
  const moved = `That moves ${joinAnd(parts)}.`
  if (still.length === 0) return moved
  const shape = obj(ta.shape)
  const off = new Set([...months(shape?.movesDown), ...months(shape?.movesUp)])
  const window = [...off, ...months(ta.referenceMonths)].sort()
  const first = window[0]
  const last = window[window.length - 1]
  const atLevel = (c: CmaAdjustedComp) => {
    const m = (c.closeDate ?? '').slice(0, 7)
    return Boolean(shape && first && last && m >= first && m <= last && !off.has(m))
  }
  const who = still.length === 1 ? 'The other one' : `The other ${countWord(still.length)}`
  return still.every(atLevel)
    ? `${moved} ${who} sold when that figure was already at today's level, so ${
        still.length === 1 ? 'it does' : 'they do'
      } not move.`
    : `${moved} ${who} ${still.length === 1 ? 'does' : 'do'} not move.`
}

/** The shape of the index over the window, from `shape`, in plain words. */
function indexShapeSentence(ta: Record<string, unknown>): string {
  const window = num(ta.windowMonths)
  const over = window != null && window > 0 ? `Over the last ${window} months` : 'Over the last year'
  const shape = obj(ta.shape)
  const month = monthLabel(shape?.extremeMonth)
  const since = num(shape?.sinceExtremePct)
  if (shape?.extreme === 'peak' && month && since != null) {
    return `${over} it peaked in ${month} and has come down ${Math.abs(since).toFixed(1)} percent since.`
  }
  if (shape?.extreme === 'trough' && month && since != null) {
    return `${over} it hit a low in ${month} and has climbed ${Math.abs(since).toFixed(1)} percent since.`
  }
  const move = num(shape?.overWindowPct) ?? num(ta.pctOverWindow)
  if (move == null) return ''
  if (move === 0) return `${over} it held flat.`
  return `${over} it ${move > 0 ? 'rose' : 'fell'} ${Math.abs(move).toFixed(1)} percent.`
}

/** The pocket's own engine note, on rows stored before the basis was stamped. */
const POCKET_NOTE = /^these sales are the exclusive pocket\b/i

/**
 * The exclusive pocket's date sentence, one sentence, off the grid.
 *
 * The pocket walks the same city figure the index basis walks, sale by sale,
 * but only down: a sale whose month sits under today's level keeps its own
 * price (lib/pricing/exclusive-pocket-date-adj.ts applyExclusivePocketDateAdj).
 * A grid that moved a sale up is not that path, so it gets the plain counted
 * sentence instead of a claim about falling prices.
 */
function pocketDateSentence(subject: Pick<CmaSubject, 'city'>, comps: readonly CmaAdjustedComp[]): string {
  const total = comps.length
  const down = comps.filter((c) => (c.timeAdjustment ?? 0) <= -1).length
  const up = comps.filter((c) => (c.timeAdjustment ?? 0) >= 1).length
  if (total === 0 || (down === 0 && up === 0)) return 'None of these sales is moved for the month it sold.'
  const city = cleanText(subject.city ?? null)
  const whose = city ? `${city}'s` : "this city's"
  if (up > 0) {
    return `Each sale is moved by how much ${whose} median price per square foot changed between the month it sold and the last three full months. ${dateMovesSentence(comps, {})}`.trim()
  }
  if (down === total) {
    return `To bring each sale to today's market, we moved it down by how much ${whose} median price per square foot fell between the month it sold and the last three full months.`
  }
  const rest = total - down
  return `To bring the sales to today's market, we moved ${countWord(down)} of the ${countWord(total)} down by how much ${whose} median price per square foot fell between the month each sold and the last three full months. The other ${countWord(rest)} ${rest === 1 ? 'is' : 'are'} not moved.`
}

/** The date paragraph, or the stored sentence when the basis is not the city index. */
function dateNote(
  subject: Pick<CmaSubject, 'city'>,
  comps: readonly CmaAdjustedComp[],
  pricing: CmaPricing,
): string[] {
  const ta = obj((pricing as unknown as { timeAdjustment?: unknown }).timeAdjustment)
  if (!ta) return []
  const stored = str(ta.sentence)
  if (ta.sentence === FLAT_LOCAL_DATE_SENTENCE) return [FLAT_LOCAL_DATE_SENTENCE]
  if (ta.basis === TIME_ADJUSTMENT_BASIS_POCKET || (stored != null && POCKET_NOTE.test(stored))) {
    return [pocketDateSentence(subject, comps)]
  }
  const n = num(ta.n)
  const anyMoved = comps.some((c) => Math.abs(c.timeAdjustment ?? 0) >= 1)
  if (ta.basis === INDEX_BASIS && n != null && n > 0 && comps.length > 0) {
    if (!anyMoved) return ['None of these sales is moved for the month it sold.']
    const city = cleanText(subject.city ?? null)
    const whose = city ? `${city}'s` : "this city's"
    return [
      `To bring each sale to today's market, we move it by how much ${whose} median price per square foot changed between the month it sold and the last three full months.`,
      `That figure is built from ${int(n)} home sales across ${city ?? 'the city'}.`,
      indexShapeSentence(ta),
      dateMovesSentence(comps, ta),
    ].filter(Boolean)
  }
  if (!stored) return []
  // Any other basis prints as the pricing side wrote it, with the plain name
  // of what its index measures when the sentence does not already say.
  const measure = str(ta.measure)
  return measure && !stored.toLowerCase().includes(measure.toLowerCase())
    ? [stored, `That index is ${measure}.`]
    : [stored]
}

/**
 * The line under the grid that names what its "Adjusted for date" row is.
 *
 * The grid prints the date move the price was built on (reader review,
 * 62475 Woodsman, 2026-10-08), so the reader is told which figure moved it,
 * beside the row. Read off the stored basis and the printed rows: null when no
 * printed sale moved for date, or when the basis is one this line cannot name.
 * The pocket basis walks the city figure only down
 * (lib/pricing/exclusive-pocket-date-adj.ts applyExclusivePocketDateAdj), so
 * it says so only while no printed sale moved up.
 */
export function dateBasisCaption(input: {
  subject: Pick<CmaSubject, 'city'>
  comps: readonly CmaAdjustedComp[]
  pricing: CmaPricing
}): string | null {
  const moved = input.comps.filter((c) => Math.abs(c.timeAdjustment ?? 0) >= 1)
  if (moved.length === 0) return null
  const ta = obj((input.pricing as unknown as { timeAdjustment?: unknown }).timeAdjustment)
  if (!ta) return null
  const city = cleanText(input.subject.city ?? null)
  const whose = city ? `${city}'s` : "this city's"
  const stored = str(ta.sentence)
  const pocket = ta.basis === TIME_ADJUSTMENT_BASIS_POCKET || (stored != null && POCKET_NOTE.test(stored))
  const up = moved.some((c) => (c.timeAdjustment ?? 0) > 0)
  if (pocket && !up) {
    return `Adjusted for date is how much ${whose} median price per square foot fell between the month a sale closed and the last three full months. No sale is moved up for date.`
  }
  if (pocket || ta.basis === INDEX_BASIS) {
    return `Adjusted for date is how much ${whose} median price per square foot changed between the month a sale closed and the last three full months.`
  }
  if (ta.basis === 'year-over-year') {
    return `Adjusted for date is ${whose} year-over-year change in median sale price, spread evenly over the months since a sale closed.`
  }
  return null
}

// ── what the printed adjustments were ───────────────────────────────────────

/**
 * "date and seller concessions": the adjustment lines that moved at least one
 * of these sales by a dollar, in the order the weight sentence names them
 * (lib/pricing/reconciliation.ts adjustmentClaim). Null when none moved.
 *
 * A pocket letter priced with no size line printed "before adjusting for date
 * and size" beside an engine note that said size does not adjust (reader
 * review, 2382 Jackson, 2026-10-07). The phrase is read off the sales, so it
 * names what the letter was actually priced on.
 */
export function adjustedForPhrase(comps: readonly CmaAdjustedComp[]): string | null {
  const parts: string[] = []
  if (comps.some((c) => Math.abs(c.timeAdjustment ?? 0) >= 1)) parts.push('date')
  if (comps.some((c) => Math.abs(c.sizeAdjustment ?? 0) >= 1)) parts.push('size')
  if (comps.some((c) => Math.abs(c.storyAdjustment ?? 0) >= 1)) parts.push('story')
  if (comps.some((c) => concessionOffClose(c) >= 1)) parts.push('seller concessions')
  return parts.length > 0 ? joinAnd(parts) : null
}

// ── the sale-to-ask share ───────────────────────────────────────────────────

function askShareNote(subject: Pick<CmaSubject, 'city'>, pricing: CmaPricing, onMarket = false): string[] {
  const rr = obj((pricing as unknown as { rangeRule?: unknown }).rangeRule)
  const ratio = num(rr?.saleToAskRatio)
  if (ratio == null || !(ratio > 0.5) || !(ratio < 1.5)) return []
  const pct = (ratio * 100).toFixed(1)
  const city = cleanText(subject.city ?? null)
  const source = rr?.saleToAskSource
  const fact =
    source === 'these-sales'
      ? `Typically, these sales sold for ${pct} percent of the price they first asked.`
      : source === 'city-index' || source === 'market-context'
        ? `Homes in ${city ?? 'this city'} are selling for ${pct} percent of the price they first asked.`
        : null
  // A home on the market already has its list price, set with its own broker:
  // the share is stated as a fact about the range and nothing about a list
  // (3062 NW Kelly Hill, reader review 2026-10-08).
  if (!fact) return []
  return [fact, onMarket ? 'It does not change the range.' : 'That matters for the list price, not for the range.']
}

// ── the paragraph ───────────────────────────────────────────────────────────

export const SALES_METHOD_LABEL = 'How the sales were chosen and adjusted.'

/** The plain sentences, in reading order. Empty when the row says nothing. */
export function salesMethodSentences(input: {
  subject: Pick<CmaSubject, 'subdivision' | 'city'>
  comps: readonly CmaAdjustedComp[]
  pricing: CmaPricing
  /** The search story after its first sentence (the price chapter's heading). */
  searchTail?: string | null
  /** The subject is on the market today (lib/cma/subject-on-market.ts). */
  onMarket?: boolean
}): string[] {
  return [
    ...searchNote(input.subject, input.comps, input.searchTail),
    ...dateNote(input.subject, input.comps, input.pricing),
    ...askShareNote(input.subject, input.pricing, input.onMarket === true),
  ].map((s) => sanitizeLetterEmDash(s))
}
