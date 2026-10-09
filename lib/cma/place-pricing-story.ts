/**
 * Parent-place pricing for the what-happened page.
 * Plain sentences from the fields on the story. No database. No regional tiles.
 */

import type { PlacePricingStory } from '@/lib/cma/place-pricing-types'
import { escapeHtml } from '@/lib/cma/render-blocks'
import { marketAreaName, resolveMarketArea } from '@/lib/cma/market-area'
import { pacificDay } from '@/lib/cma/listing-status'
import { realSubdivisionName } from '@/lib/pricing/classes'

const esc = escapeHtml

function finite(n: number | null | undefined): n is number {
  return typeof n === 'number' && Number.isFinite(n)
}

/** Whole numbers stay whole. Anything else keeps one decimal. No thousands mark on a fraction. */
function oneDecimal(n: number): string {
  const tenths = Math.round(n * 10) / 10
  const body = Number.isInteger(tenths) ? String(tenths) : tenths.toFixed(1)
  const [whole, frac] = body.split('.')
  const grouped = Number(whole).toLocaleString('en-US')
  return frac ? `${grouped}.${frac}` : grouped
}

function wholeDays(n: number): string {
  const d = Math.round(n)
  return `${d.toLocaleString('en-US')} ${d === 1 ? 'day' : 'days'}`
}

function count(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}

/** A share from 0 to 1, printed as a percent with one decimal only when it is needed. */
function sharePercent(share: number): string {
  return `${oneDecimal(share * 100)}%`
}

function paragraph(text: string): string {
  return `<p>${esc(text)}</p>`
}

/** The subject, as the place story needs it to say where the home sits. */
export type PlaceStoryHome = {
  subdivision?: string | null
  city?: string | null
  latitude?: number | null
  longitude?: number | null
  /** Its MLS status, and the days its own listing was listed, went on and came off the market. */
  status?: string | null
  listDate?: string | null
  onMarketDate?: string | null
  offMarketDate?: string | null
}

const FAILED = /^(expired|withdrawn|cancell?ed)/i

function shiftMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1 + months, d)).toISOString().slice(0, 10)
}

/**
 * Whether the home's own listing is one of the homes the story counts, and one
 * of those that came off without selling.
 *
 * The count (lib/cma/place-pricing-aggregate.ts rowsToPlacePricingStory) is
 * every address in the place whose listing was listed, went on the market,
 * came off it or closed inside the twelve months, the home itself included:
 * the read is the place's listings, and the home's listing is one of them
 * (1355 Jacksonville, withdrawn Sep 28 after listing Sep 23, is one of River
 * West's 139 and one of its 21; reader review 2026-10-09). Read here off the
 * same window and the same polygon test the lead uses, so the sentence can
 * say so. A home outside the place, or with no dated listing in the window,
 * is not counted and nothing is said.
 */
export function homeInPlaceCount(
  story: Pick<PlacePricingStory, 'asOf' | 'placeName'>,
  home: PlaceStoryHome | null | undefined,
): { counted: boolean; didNotSell: boolean } {
  const none = { counted: false, didNotSell: false }
  if (!home || !homeInsidePlace(story, home)) return none
  const end = (story.asOf ?? '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) return none
  const start = shiftMonths(end, -12)
  const inWindow = [home.listDate, home.onMarketDate, home.offMarketDate].some((d) => {
    const day = pacificDay(d ?? null)
    return day != null && day >= start && day <= end
  })
  if (!inWindow) return none
  return { counted: true, didNotSell: FAILED.test((home.status ?? '').trim()) }
}

function homeInsidePlace(story: Pick<PlacePricingStory, 'placeName'>, home: PlaceStoryHome): boolean {
  const slug = resolveMarketArea(home.latitude ?? null, home.longitude ?? null)
  return slug != null && marketAreaName(slug)?.trim() === story.placeName.trim()
}

/** What the count is, as the source line under the story says it. */
export const PLACE_COUNT_WHAT = 'listed, sold or taken off the market'

/** The source line as rows built before 2026-10-09 stored it. */
const STORED_SOURCE_NOTE = /^(.+?) listed (.+?) through (.+?), ([\d,]+) (homes?)\.$/

/**
 * The source line under the story, in what it counts: "River West
 * single-family homes listed, sold or taken off the market between October
 * 8, 2025 and October 8, 2026: 139 homes, each address counted once." It
 * said "listed October 8, 2025 through October 8, 2026, 139 homes" over a
 * count that also holds homes listed before the window that sold or came off
 * inside it. A stored line in the old words is restated from its own figures;
 * any other prints as stored.
 */
export function placeSourceNote(note: string): string {
  const m = STORED_SOURCE_NOTE.exec(note.trim())
  if (!m) return note.trim()
  return `${m[1]} ${PLACE_COUNT_WHAT} between ${m[2]} and ${m[3]}: ${m[4]} ${m[5]}, each address counted once.`
}

function possessive(name: string): string {
  return /s$/i.test(name) ? `${name}'` : `${name}'s`
}

/**
 * The first line, which introduces the place before it tells its story.
 *
 * The story is about the mapped neighborhood or community around the home, a
 * different name from the subdivision the rest of the letter uses. "Here's
 * what happened in Summit West" on a letter that otherwise says Shevlin West
 * named a place the owner was never told they live in (reader review
 * 2026-10-08; Mountain View on 2382 Jackson in Holliday Park and 3037 Purcell
 * in Silver Sage). So the line says where the home sits first.
 *
 * MEMBERSHIP IS READ, NOT ASSUMED. The build resolved the place by putting the
 * subject's stored coordinates through the polygon mesh
 * (data/bend/bend-neighborhood-polygons.json, `resolveMarketArea`). The same
 * test runs here on the same stored coordinates, and the home is said to sit
 * in the place only when it lands in the polygon of that exact name. When it
 * does not, or the row has no coordinates, the line still names the place for
 * what it is and makes no claim about the home.
 */
export function placeStoryLead(story: PlacePricingStory, home?: PlaceStoryHome | null): string {
  const place = story.placeName.trim()
  const span = `over the last ${story.windowMonths} months`
  const kind = story.placeKind === 'community' ? 'community' : 'neighborhood'
  const slug = resolveMarketArea(home?.latitude ?? null, home?.longitude ?? null)
  const inside = slug != null && marketAreaName(slug)?.trim() === place
  if (!inside) return `Here's what happened in the ${place} ${kind} ${span}.`
  const city = (home?.city ?? '').trim()
  const where =
    kind === 'neighborhood' && city ? `${possessive(city)} ${place} neighborhood` : `the ${place} ${kind}`
  const sub = realSubdivisionName(home?.subdivision ?? null)
  // A subdivision that IS the place (Broken Top in Broken Top) needs no
  // introduction; the letter already uses the name.
  if (sub && sub.toLowerCase() === place.toLowerCase()) return `Here's what happened in ${place} ${span}.`
  const lead = sub ? `Your home in ${sub} is in ${where}.` : `Your home is in ${where}.`
  return `${lead} Here's what happened there ${span}.`
}

/**
 * The place story, or '' when there is nothing to count.
 * `doc` picks the source-line class the rest of that document already uses.
 * `home` lets the first line say where the home sits (`placeStoryLead`).
 */
export function placePricingStoryHtml(
  story: PlacePricingStory | null | undefined,
  doc: 'letter' | 'immersive',
  home?: PlaceStoryHome | null,
): string {
  if (!story || !(story.listedHomes > 0)) return ''
  // The words say what the count holds: every home listed, sold or taken off
  // the market in the window, and the reader's own home when it is one of
  // them (reader review 2026-10-09, 1355 Jacksonville: "139 homes were
  // listed" counted homes that sold or came off without being listed in the
  // window, and the home itself).
  const own = homeInPlaceCount(story, home)
  const listed = `${count(story.listedHomes)} ${story.listedHomes === 1 ? 'home was' : 'homes were'} ${PLACE_COUNT_WHAT}${
    own.counted ? ', yours among them' : ''
  }.`
  const unsold = `${count(story.didNotSell)} of them came off the market without selling${
    own.didNotSell && story.didNotSell > 0 ? ', yours included' : ''
  }.`
  const lines: string[] = [placeStoryLead(story, home), `${listed} ${unsold}`]
  if (story.droppedPrice > 0) {
    let line = `${count(story.droppedPrice)} dropped the price.`
    if (finite(story.typicalCutShare)) {
      line += ` The typical cut was ${sharePercent(story.typicalCutShare)} of the first ask.`
    }
    lines.push(line)
  }
  if (story.gaveConcessions > 0) {
    let line = `${count(story.gaveConcessions)} gave the buyer a concession at closing.`
    if (finite(story.typicalConcessionShare)) {
      line += ` The typical concession was ${sharePercent(story.typicalConcessionShare)} of the list price.`
    }
    lines.push(line)
  }
  const held = story.heldAskMedianDays
  const cut = story.cutPriceMedianDays
  const speed: string[] = []
  // Days are whole. A median of an even count can land on a half ("65.5
  // days", reader review 2026-10-07); a reader counts days, so it rounds.
  if (finite(held)) speed.push(`Homes that held the first ask had an offer in ${wholeDays(held)}.`)
  if (finite(cut)) speed.push(`Homes that cut the price took ${wholeDays(cut)}.`)
  if (speed.length > 0) lines.push(speed.join(' '))
  const cutIsSlower = finite(held) && finite(cut) && cut > held
  lines.push(
    cutIsSlower
      ? 'A home that starts high and then cuts sits longer.'
      : 'The homes that did not sell are the ones this report is measured against.',
  )
  const small = doc === 'letter' ? 'small' : 'small r'
  const note = placeSourceNote(story.sourceNote)
  return `<div class="keep-note">
  ${lines.map(paragraph).join('\n  ')}
  ${note ? `<p class="${small}">${esc(note)}</p>` : ''}
  </div>`
}
