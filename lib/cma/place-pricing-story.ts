/**
 * Parent-place pricing for the what-happened page.
 * Plain sentences from the fields on the story. No database. No regional tiles.
 */

import type { PlacePricingStory } from '@/lib/cma/place-pricing-types'
import { escapeHtml } from '@/lib/cma/render-blocks'
import { marketAreaName, resolveMarketArea } from '@/lib/cma/market-area'
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
  const lines: string[] = [
    placeStoryLead(story, home),
    `${count(story.listedHomes)} homes were listed. ${count(story.didNotSell)} of them came off the market without selling.`,
  ]
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
  const note = story.sourceNote.trim()
  return `<div class="keep-note">
  ${lines.map(paragraph).join('\n  ')}
  ${note ? `<p class="${small}">${esc(note)}</p>` : ''}
  </div>`
}
