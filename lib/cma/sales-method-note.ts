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
 *
 * AND IT NAMES THE FIGURE THAT MOVED THE SALES (reader review, 62475 Woodsman,
 * 2026-10-08). A pocket's dated sales are moved down along the CITY's median
 * price per square foot, every home sale in the city, not the subdivision's
 * own trend. The letter said only "Bend's median price per square foot",
 * after a page that told the owner Shevlin West's own price per square foot
 * held flat, so the move read as Shevlin West's. Both pocket sentences now
 * name the city-wide figure, the reference months, and, where the build
 * stored them (`timeAdjustment.indexLevels`, `.referencePpsf`), the levels
 * each move is the ratio of.
 *
 * AND IT SAYS WHY, OFF THE LOCAL READ (Matt 2026-10-08, "Down only if local
 * fell"). The pocket moves down with the city figure only when homes like
 * this one in its own place fell too, on the per-foot read the local page
 * prints. A row built with that gate stores it (`timeAdjustment.localGate`),
 * and both pocket sentences then say which way that read went, with its two
 * figures: "These sales move with Bend's figure only because homes like yours
 * in Shevlin West also fell", or "None of these sales is moved for the month
 * it sold. Homes like yours in Shevlin West held flat while your home was
 * listed, $581 then $572 a square foot, so each sale stands at its sold
 * price." Rows stored before the gate print as they did.
 */

import { cleanText, countWord, int, usd } from '@/lib/cma/render-blocks'
import { sanitizeLetterEmDash } from '@/lib/cma/voice-sanitize'
import { FLAT_LOCAL_DATE_SENTENCE } from '@/lib/cma/flat-date-story'
import { realSubdivisionName } from '@/lib/pricing/classes'
import { isPocketTimeBasis } from '@/lib/pricing/exclusive-pocket-date-adj'
import { adjustmentNouns, adjustmentsApplied } from '@/lib/cma/adjustments-applied'
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
 * "Four more were added: 1345 Milwaukee in Grandview, ..." made whole on its
 * own, from the heading sentence it followed.
 *
 * The search story's first sentence is the price chapter's heading ("One of
 * the five sales is in Northwest Townsite."), and the rest prints in Basis and
 * limits, a chapter and several pages away. There "Four more were added"
 * opened the method paragraph with nothing it was more than (reader review
 * 2026-10-09, 1355 Jacksonville). When the grid cannot name the sales outside
 * the subdivision itself (`outsideSubdivisionSentence`), the sentence is
 * restated from the two stored ones, saying only what they said: "Four of
 * the five sales are outside Northwest Townsite: 1345 Milwaukee in Grandview,
 * ...", or, when the story named places rather than sales, "Four of the five
 * sales come from Grandview and Highland." Null when the heading is not the
 * "N of the M sales are in X" sentence the added one follows.
 */
export function addedSentenceOnItsOwn(heading: string | null | undefined, added: string): string | null {
  const head = /^(\w+) of the (\w+) sales (?:is|are) in (.+?)\.$/i.exec((heading ?? '').trim())
  const more = /^(\w+) more (?:was|were) added(?:: (.+)| from (.+))\.$/i.exec(added.trim())
  if (!head || !more) return null
  const total = head[2]!.toLowerCase()
  const place = head[3]!
  const rest = more[1]!.toLowerCase()
  const one = rest === 'one'
  const lead = `${capitalise(rest)} of the ${total} sales`
  if (more[2]) return `${lead} ${one ? 'is' : 'are'} outside ${place}: ${more[2]}.`
  return `${lead} ${one ? 'comes' : 'come'} from ${more[3]}.`
}

/**
 * The rest of the search story, after the sentence the chapter uses as its
 * heading. The "added" sentence is rewritten from the grid, or, when the grid
 * cannot say it, made whole from the heading it followed; anything else in the
 * story prints as the pricing side wrote it.
 */
function searchNote(
  subject: Pick<CmaSubject, 'subdivision'>,
  comps: readonly CmaAdjustedComp[],
  tail: string | null | undefined,
  heading?: string | null,
): string[] {
  const said = str(tail)
  if (!said) return []
  const outside = outsideSubdivisionSentence(subject, comps)
  return sentencesOf(said).map((s) => {
    if (!ADDED_SENTENCE.test(s)) return s
    return outside ?? addedSentenceOnItsOwn(heading, s) ?? s
  })
}

// ── the date move ───────────────────────────────────────────────────────────

function months(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((m): m is string => typeof m === 'string').map((m) => m.slice(0, 7)) : []
}

/** "July to September 2026", "December 2025 and February 2026", "May 2026". Null on nothing. */
function monthSpan(list: readonly string[], joiner: 'to' | 'and'): string | null {
  const labels = list
    .map((m) => ({ m, label: monthLabel(m) }))
    .filter((x): x is { m: string; label: string } => x.label != null)
  if (labels.length === 0) return null
  const name = (x: { label: string }) => x.label.split(' ')[0]!
  if (joiner === 'to') {
    const first = labels[0]!
    const last = labels[labels.length - 1]!
    if (first.m === last.m) return first.label
    return first.m.slice(0, 4) === last.m.slice(0, 4) ? `${name(first)} to ${last.label}` : `${first.label} to ${last.label}`
  }
  const years = new Set(labels.map((x) => x.m.slice(0, 4)))
  return years.size === 1
    ? `${joinAnd(labels.map(name))} ${labels[0]!.m.slice(0, 4)}`
    : joinAnd(labels.map((x) => x.label))
}

/** The last three full months the date move runs to, from the stored reference months. */
function referenceWindow(ta: Record<string, unknown> | null): string | null {
  return ta ? monthSpan(months(ta.referenceMonths), 'to') : null
}

function ppsfUsd(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * "$389.94 in December 2025 and February 2026, $398.13 in April 2026, $413.30
 * in May and June 2026, and $384.50 for July to September 2026": the stored
 * levels each pocket move is the ratio of, months that share a level printed
 * together. Null when the build stored no levels (rows built before
 * 2026-10-08), so the sentence prints without figures rather than invented ones.
 */
function pocketLevelsClause(ta: Record<string, unknown> | null): string | null {
  if (!ta) return null
  const ref = num(ta.referencePpsf)
  const window = referenceWindow(ta)
  const raw: unknown[] = Array.isArray(ta.indexLevels) ? ta.indexLevels : []
  const levels = raw
    .map((l) => obj(l))
    .map((l) => ({ month: typeof l?.month === 'string' ? l.month.slice(0, 7) : '', ppsf: num(l?.ppsf) }))
    .filter((l): l is { month: string; ppsf: number } => /^\d{4}-\d{2}$/.test(l.month) && l.ppsf != null && l.ppsf > 0)
    .sort((a, b) => a.month.localeCompare(b.month))
  if (ref == null || !(ref > 0) || !window || levels.length === 0) return null
  const groups: { ppsf: number; months: string[] }[] = []
  for (const l of levels) {
    const g = groups.find((x) => x.ppsf === l.ppsf)
    if (g) g.months.push(l.month)
    else groups.push({ ppsf: l.ppsf, months: [l.month] })
  }
  const parts = groups
    .map((g) => {
      const when = monthSpan(g.months, 'and')
      return when ? `${ppsfUsd(g.ppsf)} in ${when}` : null
    })
    .filter((p): p is string => p != null)
  if (parts.length === 0) return null
  return `${parts.join(', ')}, and ${ppsfUsd(ref)} for ${window}`
}

/** ", not only Shevlin West" when the home has a subdivision, else nothing. */
function notOnlyHome(subject: Partial<Pick<CmaSubject, 'subdivision'>>, sales: boolean): string {
  const home = realSubdivisionName(cleanText(subject.subdivision ?? null))
  if (!home) return ''
  return sales ? `, not only the sales in ${home}` : `, not only ${home}`
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

// ── the pocket's local gate (Matt 2026-10-08, "Down only if local fell") ───

type LocalGate = {
  verdict: 'fell' | 'held flat' | 'rose' | null
  missing: string | null
  place: string | null
  sized: boolean
  productNoun: string | null
  fromPpsf: number | null
  toPpsf: number | null
  /** Sales behind the city index on this basis. Zero when the city has no index. */
  indexN: number
}

/**
 * The stored gate, or null on a row built before it. A verdict with no
 * per-foot figure reads as no verdict: the sentence never prints a word it
 * cannot show the numbers for.
 */
function localGateOf(ta: Record<string, unknown> | null): LocalGate | null {
  const g = obj(ta?.localGate)
  if (!g || typeof g.branch !== 'string') return null
  const early = obj(g.early)
  const late = obj(g.late)
  const fromPpsf = num(early?.ppsf)
  const toPpsf = num(late?.ppsf)
  const said = g.verdict === 'fell' || g.verdict === 'held flat' || g.verdict === 'rose' ? g.verdict : null
  const verdict = said && fromPpsf != null && toPpsf != null ? said : null
  return {
    verdict,
    missing: typeof g.missing === 'string' ? g.missing : verdict ? null : 'too-few-sales',
    place: str(g.place),
    sized: g.sized === true,
    productNoun: str(g.productNoun),
    fromPpsf,
    toPpsf,
    indexN: num(ta?.n) ?? 0,
  }
}

/** "homes like yours in Shevlin West": the homes the local page measured. */
function localHomes(g: LocalGate, subject: Partial<Pick<CmaSubject, 'subdivision'>>): string {
  const noun = g.productNoun === 'townhouse' ? 'townhouses' : g.productNoun === 'condo' ? 'condos' : 'homes'
  const place = g.place ?? realSubdivisionName(cleanText(subject.subdivision ?? null))
  const like = g.sized ? `${noun} like yours` : noun
  return place ? `${like} in ${place}` : `${like} nearby`
}

/** "held flat while your home was listed, $581 then $572 a square foot", the local page's own words. */
function localMoveClause(g: LocalGate): string {
  const from = usd(g.fromPpsf)
  const to = usd(g.toPpsf)
  if (g.verdict === 'held flat') return `held flat while your home was listed, ${from} then ${to} a square foot`
  return `${g.verdict} while your home was listed, from ${from} to ${to} a square foot`
}

/** Why no sale moved, off the gate. Always ends on the sold price standing. */
function localNoMoveReason(
  g: LocalGate,
  subject: Pick<CmaSubject, 'city'> & Partial<Pick<CmaSubject, 'subdivision'>>,
): string {
  const homes = localHomes(g, subject)
  const Homes = capitalise(homes)
  const city = cleanText(subject.city ?? null)
  const whose = city ? `${city}'s` : "this city's"
  if (g.verdict === 'held flat') return `${Homes} ${localMoveClause(g)}, so each sale stands at its sold price.`
  if (g.verdict === 'rose') {
    return `${Homes} ${localMoveClause(g)}, and these sales are never moved up for date, so each sale stands at its sold price.`
  }
  if (g.verdict === 'fell') {
    return g.indexN > 0
      ? `${Homes} ${localMoveClause(g)}, but every sale here closed when ${whose} median price per square foot was already at or under today's level, so each sale stands at its sold price.`
      : `${Homes} ${localMoveClause(g)}, but there is no monthly price figure for ${city ?? 'this city'} to move the sales by, so each sale stands at its sold price.`
  }
  if (g.missing === 'no-listing-window') {
    return `We move these sales down for date only when ${homes} are falling in price, and there is no recent listing of your home to measure that over, so each sale stands at its sold price.`
  }
  if (g.missing === 'no-living-area') {
    return `We move these sales down for date only when ${homes} fell in price while your home was listed, and those sales carry no living area to measure it by, so each sale stands at its sold price.`
  }
  return `We move these sales down for date only when ${homes} fell in price while your home was listed, and too few of them sold then to tell, so each sale stands at its sold price.`
}

/** The local reason a moved pocket sale moved, or '' when the row has no gate or it did not fall. */
function localFellSentence(
  g: LocalGate | null,
  subject: Pick<CmaSubject, 'city'> & Partial<Pick<CmaSubject, 'subdivision'>>,
): string {
  if (!g || g.verdict !== 'fell') return ''
  const city = cleanText(subject.city ?? null)
  const whose = city ? `${city}'s` : "this city's"
  return `These sales move with ${whose} figure only because ${localHomes(g, subject)} also ${localMoveClause(g)}.`
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
/**
 * Where Basis and limits points for the local reason a gated pocket did or did
 * not move for date. The note under the sales grid (dateBasisCaption) says the
 * reason in full, with the local figures, beside the row it explains; this
 * paragraph used to say the same sentence again (reader review, 3037 Purcell
 * and 62475 Woodsman, 2026-10-08: "We move these sales down for date only
 * when homes like yours in Silver Sage fell in price ..." printed twice).
 */
export const DATE_REASON_UNDER_GRID = 'The note under the sales grid says why.'

function pocketDateSentence(
  subject: Pick<CmaSubject, 'city' | 'subdivision'>,
  comps: readonly CmaAdjustedComp[],
  ta: Record<string, unknown> | null,
): string {
  const total = comps.length
  const down = comps.filter((c) => (c.timeAdjustment ?? 0) <= -1).length
  const up = comps.filter((c) => (c.timeAdjustment ?? 0) >= 1).length
  const gate = localGateOf(ta)
  if (total === 0 || (down === 0 && up === 0)) {
    // The grid's note gives the gate's reason in full (dateBasisCaption).
    return gate && total > 0
      ? `None of these sales is moved for the month it sold. ${DATE_REASON_UNDER_GRID}`
      : 'None of these sales is moved for the month it sold.'
  }
  const city = cleanText(subject.city ?? null)
  const whose = city ? `${city}'s` : "this city's"
  const window = referenceWindow(ta)
  const to = window ? `the last three full months, ${window}` : 'the last three full months'
  if (up > 0) {
    return `Each sale is moved by how much ${whose} median price per square foot changed between the month it sold and ${to}. ${dateMovesSentence(comps, {})}`.trim()
  }
  // What the figure is: the whole city over the stored window, never only the
  // home's own subdivision, and only ever a move down.
  const n = ta ? num(ta.n) : null
  const windowMonths = ta ? num(ta.windowMonths) : null
  const over = windowMonths != null && windowMonths > 0 ? ` over the last ${windowMonths} months` : ''
  const built =
    n != null && n > 0
      ? `That figure is built from ${int(n)} home sales across all of ${city ?? 'the city'}${over}${notOnlyHome(subject, true)}, and a rise in it never moves a sale up.`
      : `That figure covers every home sale in ${city ?? 'the city'}${notOnlyHome(subject, false)}, and a rise in it never moves a sale up.`
  // The local reason prints once, in the grid's note (dateBasisCaption prints
  // localFellSentence on every gated pocket that moved only down).
  const why = localFellSentence(gate, subject)
  const tail = why ? ` ${DATE_REASON_UNDER_GRID}` : ''
  if (down === total) {
    return `To bring each sale to today's market, we moved it down by how much ${whose} median price per square foot fell between the month it sold and ${to}. ${built}${tail}`
  }
  const rest = total - down
  return `To bring the sales to today's market, we moved ${countWord(down)} of the ${countWord(total)} down by how much ${whose} median price per square foot fell between the month each sold and ${to}. The other ${countWord(rest)} ${rest === 1 ? 'is' : 'are'} not moved. ${built}${tail}`
}

/** The date paragraph, or the stored sentence when the basis is not the city index. */
function dateNote(
  subject: Pick<CmaSubject, 'city' | 'subdivision'>,
  comps: readonly CmaAdjustedComp[],
  pricing: CmaPricing,
): string[] {
  const ta = obj((pricing as unknown as { timeAdjustment?: unknown }).timeAdjustment)
  if (!ta) return []
  const stored = str(ta.sentence)
  const pocket = isPocketTimeBasis(ta.basis) || (stored != null && POCKET_NOTE.test(stored))
  // A pocket row that stored its local gate says the gate's own reason, with
  // the local figures, ahead of the generic flat-story line (Matt 2026-10-08).
  if (pocket && localGateOf(ta)) return [pocketDateSentence(subject, comps, ta)]
  if (ta.sentence === FLAT_LOCAL_DATE_SENTENCE) return [FLAT_LOCAL_DATE_SENTENCE]
  if (pocket) return [pocketDateSentence(subject, comps, ta)]
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
 *
 * The line names which figure (the whole city's, not the subdivision's), the
 * months it runs to, and on a pocket row that stored them, the levels each
 * move is the ratio of (reader review, 62475 Woodsman, 2026-10-08).
 */
export function dateBasisCaption(input: {
  subject: Pick<CmaSubject, 'city'> & Partial<Pick<CmaSubject, 'subdivision'>>
  comps: readonly CmaAdjustedComp[]
  pricing: CmaPricing
}): string | null {
  const moved = input.comps.filter((c) => Math.abs(c.timeAdjustment ?? 0) >= 1)
  const ta = obj((input.pricing as unknown as { timeAdjustment?: unknown }).timeAdjustment)
  if (!ta) return null
  const stored = str(ta.sentence)
  const pocket = isPocketTimeBasis(ta.basis) || (stored != null && POCKET_NOTE.test(stored))
  const gate = pocket ? localGateOf(ta) : null
  // Nothing moved on a gated pocket: the grid folds its all-zero date row, so
  // the line says no sale was adjusted for date and why, off the local read.
  if (moved.length === 0) {
    return gate && input.comps.length > 0
      ? `No sale is adjusted for date. ${localNoMoveReason(gate, input.subject)}`
      : null
  }
  const city = cleanText(input.subject.city ?? null)
  const whose = city ? `${city}'s` : "this city's"
  const up = moved.some((c) => (c.timeAdjustment ?? 0) > 0)
  const window = referenceWindow(ta)
  const to = window ? `the last three full months, ${window}` : 'the last three full months'
  if (pocket && !up) {
    const levels = pocketLevelsClause(ta)
    const covers = `That figure covers every home sale in ${city ?? 'the city'}${notOnlyHome(input.subject, false)}`
    const why = localFellSentence(gate, input.subject)
    return `Adjusted for date is how much ${whose} median price per square foot fell between the month a sale closed and ${to}. ${
      levels ? `${covers}, with each month read as a three-month median: ${levels}.` : `${covers}.`
    } No sale is moved up for date.${why ? ` ${why}` : ''}`
  }
  if (pocket || ta.basis === INDEX_BASIS) {
    return `Adjusted for date is how much ${whose} median price per square foot changed between the month a sale closed and ${to}.`
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
  // The same reader, and the same names, as every other place the letter
  // names its adjustments (lib/cma/adjustments-applied.ts). "story" was this
  // phrase's own word for the grid's "Adjusted for style" row.
  const parts = adjustmentNouns(adjustmentsApplied(comps))
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
  /** That first sentence, which the tail's "N more were added" follows. */
  searchHead?: string | null
  /** The subject is on the market today (lib/cma/subject-on-market.ts). */
  onMarket?: boolean
}): string[] {
  return [
    ...searchNote(input.subject, input.comps, input.searchTail, input.searchHead),
    ...dateNote(input.subject, input.comps, input.pricing),
    ...askShareNote(input.subject, input.pricing, input.onMarket === true),
  ].map((s) => sanitizeLetterEmDash(s))
}
