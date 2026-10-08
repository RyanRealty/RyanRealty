/**
 * Seller CMA letter copy. The generator refuses the shapes Matt named on
 * 2026-10-02. A letter must not print them, and a later edit that puts them
 * back fails the check in this file.
 *
 * No buyer or seller names belong in fixtures or in these sentences.
 */

import { sellerVisibleText } from '@/lib/cma/seller-text'
import { pacificDay } from '@/lib/cma/listing-status'

const COUNT = 'one|two|three|four|five|six|seven|eight|nine|\\d+'

/** Internal search-bucket ids. own-street-24mo is the one Matt named. */
export const INTERNAL_SEARCH_SLUG =
  /\b(?:own-street|subdivision|pocket|neighborhood|adjacent-sub(?:division)?|beyond|similar-sub|citywide|rural-county|competing-area|like-community|community|nearby|city|rural|gla-bracket|broker-selected)(?:-[a-z0-9]+)+\b/i

const THE_N_OF_THE_M = new RegExp(
  `\\bthe (${COUNT}) of the (${COUNT})\\b`,
  'i',
)

const UNFINISHED = /\bbefore saying what\b/i

/** A review verdict or the word "pass" left on the end of a banner. */
const REVIEW_TOKEN =
  /\breview pass\b|\bdid-not-run\b|(?:^|[.!?]\s+)(?:pass|fail)\s*$|\s\bpass\b\s*$/i

const SUPPORT_MORE =
  /sales support more than the price that already failed/i

export type SellerLetterDefectId =
  | 'internal-search-slug'
  | 'unfinished-sentence'
  | 'the-n-of-the-m'
  | 'review-token'
  | 'support-contradicts-recommendation'

export type SellerLetterDefect = { id: SellerLetterDefectId; excerpt: string }

function hit(id: SellerLetterDefectId, text: string, index: number): SellerLetterDefect {
  return { id, excerpt: text.slice(Math.max(0, index - 40), index + 80).trim() }
}

/**
 * Defects in text a seller can read. `recommended` and `failedAsk` are the
 * printed list and the ask that did not sell. When the list is not above that
 * ask, a sentence that says the sales support more than the failed ask is a
 * contradiction. With no numbers, that sentence is still refused.
 */
export function sellerLetterDefects(
  text: string,
  money?: { recommended?: number | null; failedAsk?: number | null },
): SellerLetterDefect[] {
  const defects: SellerLetterDefect[] = []
  const slug = INTERNAL_SEARCH_SLUG.exec(text)
  if (slug) defects.push(hit('internal-search-slug', text, slug.index))
  const unfinished = UNFINISHED.exec(text)
  if (unfinished) defects.push(hit('unfinished-sentence', text, unfinished.index))
  const counted = THE_N_OF_THE_M.exec(text)
  if (counted) defects.push(hit('the-n-of-the-m', text, counted.index))
  const token = REVIEW_TOKEN.exec(text.trim())
  if (token) defects.push(hit('review-token', text, token.index))
  const support = SUPPORT_MORE.exec(text)
  if (support) {
    const rec = money?.recommended
    const ask = money?.failedAsk
    const contradicts = rec == null || ask == null || rec <= ask
    if (contradicts) defects.push(hit('support-contradicts-recommendation', text, support.index))
  }
  return defects
}

/** Plain English for a rung id. Never the slug. */
export function plainSearchLabel(tier: string): string {
  if (tier.startsWith('own-street-')) return 'your own street'
  if (tier.startsWith('like-community-')) return 'communities like yours'
  if (tier.startsWith('community-')) return 'your community'
  return 'a wider search'
}

/**
 * The day a home came off, or null. A list date is not an off-market date.
 * When the only date on the row is the list date, the cell stays blank. Both
 * dates are read as the Pacific day they fell on: a list at 7:13 PM on Dec 1
 * is stamped 03:13 UTC on Dec 2 (reader review 2026-10-08).
 */
export function sellerOffMarketDate(args: {
  listDate: string | null | undefined
  offMarketDate: string | null | undefined
  days: number | null | undefined
}): string | null {
  const list = pacificDay(args.listDate ?? null) ?? ''
  const listOk = /^\d{4}-\d{2}-\d{2}$/.test(list)
  const off = pacificDay(args.offMarketDate ?? null) ?? ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(off) && (!listOk || off !== list)) return off
  const days = args.days
  if (!listOk || days == null || !(days > 0)) return null
  const start = Date.parse(`${list}T00:00:00.000Z`)
  if (Number.isNaN(start)) return null
  const derived = new Date(start + Math.round(days) * 86_400_000).toISOString().slice(0, 10)
  return derived !== list ? derived : null
}

/** Under one percent of the weight does not set the price. */
export const NEGLIGIBLE_WEIGHT_PERCENT = 1

export function withoutNegligibleWeight<T extends { listingKey?: string | null }>(
  comps: readonly T[],
  weights: ReadonlyMap<string, { weight: number | null }>,
): { comps: T[]; note: string | null } {
  // The price counted these sales. The table shows the same list. A weight
  // under one percent does not take a sale out of the grid, or the letter
  // would say five and print four.
  let light = 0
  for (const c of comps) {
    const key = c.listingKey ?? ''
    const weight = key ? weights.get(key)?.weight : null
    if (weight != null && weight < NEGLIGIBLE_WEIGHT_PERCENT) light += 1
  }
  if (light === 0) return { comps: [...comps], note: null }
  const note =
    light === 1
      ? 'One sale in this table is under one percent of the weight, so it barely moves the price.'
      : `${light} sales in this table are under one percent of the weight, so they barely move the price.`
  return { comps: [...comps], note }
}

export type SellerLetterMoney = { recommended?: number | null; failedAsk?: number | null }

/** Last-line refuse. Known bad shapes are rewritten so they cannot render. */
export function scrubSellerLetterHtml(html: string, money?: SellerLetterMoney): string {
  let out = html
  out = out.replace(/\bown-street-[a-z0-9-]+\b/gi, 'your own street')
  out = out.replace(
    /\b(?:subdivision|pocket|neighborhood|adjacent-sub(?:division)?|beyond|similar-sub|citywide|rural-county|competing-area|like-community|community|nearby|city|rural)-[a-z0-9-]*\d+mo\b/gi,
    'a wider search',
  )
  out = out.replace(/\bgla-bracket\b/gi, 'a wider search')
  out = out.replace(/\bbroker-selected\b/gi, 'chosen by your broker')
  out = out.replace(new RegExp(`\\bthe (${COUNT}) of the (${COUNT})\\b`, 'gi'), '$1 of the $2')
  out = out.replace(/\bbefore saying what\b/gi, 'before saying more')
  out = out.replace(/\s+\b(?:pass|fail|did-not-run)\b(?=\s*[.<])/gi, '')
  out = out.replace(/\breview pass\b/gi, 'review')
  const visible = sellerVisibleText(out)
  if (sellerLetterDefects(visible, money).some((d) => d.id === 'support-contradicts-recommendation')) {
    out = out.replace(
      /The sales support more than the price that already failed to sell, so a broker confirms the asking price before this goes out\./g,
      'A broker confirms the asking price before this goes out.',
    )
  }
  return out
}

/** Room cell: say the difference, or nothing. Never "$0 (1 bed)". */
export function roomAdjustmentWords(notes: readonly ('beds' | 'baths')[] | null | undefined): string {
  if (!notes || notes.length === 0) return '-'
  const parts = notes.map((n) => (n === 'beds' ? 'bedroom' : 'bathroom'))
  const list = parts.length === 1 ? `one ${parts[0]}` : `one ${parts[0]} and one ${parts[1]}`
  return `${list.charAt(0).toUpperCase()}${list.slice(1)} off yours. No dollar adjustment.`
}

export function sellerLetterStillDirty(html: string, money?: SellerLetterMoney): SellerLetterDefect[] {
  return sellerLetterDefects(sellerVisibleText(scrubSellerLetterHtml(html, money)), money)
}

