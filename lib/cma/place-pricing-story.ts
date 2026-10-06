/**
 * Parent-place pricing for the what-happened page.
 * Plain sentences from the fields on the story. No database. No regional tiles.
 */

import type { PlacePricingStory } from '@/lib/cma/place-pricing-types'
import { escapeHtml } from '@/lib/cma/render-blocks'

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

/**
 * The place story, or '' when there is nothing to count.
 * `doc` picks the source-line class the rest of that document already uses.
 */
export function placePricingStoryHtml(
  story: PlacePricingStory | null | undefined,
  doc: 'letter' | 'immersive',
): string {
  if (!story || !(story.listedHomes > 0)) return ''
  const lines: string[] = [
    `Here's what happened in ${story.placeName} over the last ${story.windowMonths} months.`,
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
  if (finite(held)) speed.push(`Homes that held the first ask had an offer in ${oneDecimal(held)} days.`)
  if (finite(cut)) speed.push(`Homes that cut the price took ${oneDecimal(cut)} days.`)
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
