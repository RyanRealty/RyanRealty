/**
 * Letter-consistency contract checks that run on the rendered HTML and the
 * pricing the letter prints. Gates, not prose: a hard fail refuses the letter.
 */

import { countedAddressesMissingFromDocument } from '@/lib/cma/counted-rows'
import { letterLinkTrackingCheck, type LetterLinkIdentity } from '@/lib/cma/letter-link-contract'
import { letterOwnerNameCheck, type LetterNameSource } from '@/lib/cma/letter-privacy'
import { letterProductNoun } from '@/lib/cma/market-area'
import { int } from '@/lib/cma/render-blocks'
import { namedSalesPlace } from '@/lib/pricing/comp-area'
import { printedAdjustedPrice } from '@/lib/pricing/seller-net'
import type { ContractCheck } from '@/lib/cma/contract'

const MILE_SENTENCE = /\bwithin\s+(?:[\d.]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+miles?\s+of your home/i
const EVERY_SALE_MOVES = /every sale below moves (?:down|up)/i
/** A date move under this is the grid saying the sale stayed put. */
const DATE_MOVE_STAYED_DOLLARS = 500
const WRONG_PRODUCT_LINE = /single-family homes in|single-family sales|single-family listings/i

export type LetterPlaceSource = {
  compArea?: { kind?: string | null; sentence?: string | null } | null
  propertySubType?: string | null
  listingMarket?: { place?: string | null; productNoun?: string | null } | null
  /** Ask-outcome group counts. A named place does not print these as "N listings". */
  citywideListingCounts?: readonly number[] | null
}

/**
 * The page the seller reads. A mile ring, a citywide count, or a
 * single-family line on a townhouse letter fails the save.
 */
export function letterPlaceChecks(html: string, place: LetterPlaceSource | null | undefined): ContractCheck[] {
  if (!place) return []
  const checks: ContractCheck[] = []
  const named = namedSalesPlace(place.compArea)
  if (named) {
    const mile = MILE_SENTENCE.test(html)
    checks.push({
      id: 'sales-place-not-a-mile-ring',
      severity: 'hard',
      pass: !mile,
      detail: mile
        ? 'The sales sit in a named place and the letter still says they are within a mile ring.'
        : 'The letter does not widen a named place out to a mile ring.',
    })
    const sentence = place.compArea?.sentence?.trim() ?? ''
    if (sentence) {
      const shown = html.includes(sentence)
      checks.push({
        id: 'sales-place-sentence',
        severity: 'hard',
        pass: shown,
        detail: shown
          ? 'The letter names the place the sales sit in.'
          : `The letter is missing the sales place: ${sentence}`,
      })
    }
    const leaked = (place.citywideListingCounts ?? []).filter((n) => n > 0 && html.includes(`${int(n)} listings`))
    checks.push({
      id: 'no-citywide-count',
      severity: 'hard',
      pass: leaked.length === 0,
      detail:
        leaked.length === 0
          ? 'The letter does not print a citywide listing count beside a named place.'
          : `Citywide count still on the page: ${leaked.map((n) => `${int(n)} listings`).join(', ')}.`,
    })
  }
  const noun = letterProductNoun(place.propertySubType)
  if (noun) {
    const wrong = WRONG_PRODUCT_LINE.test(html)
    checks.push({
      id: 'chart-matches-product',
      severity: 'hard',
      pass: !wrong,
      detail: wrong
        ? `This home is a ${noun} and the letter still charts single-family homes.`
        : `The letter does not chart single-family homes for a ${noun}.`,
    })
  }
  const marketPlace = place.listingMarket?.place?.trim() ?? ''
  if (marketPlace) {
    const shown = html.includes(marketPlace)
    checks.push({
      id: 'listing-chart-place',
      severity: 'hard',
      pass: shown,
      detail: shown
        ? `The listing chart names ${marketPlace}.`
        : `The listing chart is missing ${marketPlace}.`,
    })
  }
  const productNoun = place.listingMarket?.productNoun?.trim() ?? ''
  if (productNoun) {
    const shown = html.toLowerCase().includes(productNoun.toLowerCase())
    checks.push({
      id: 'listing-chart-product',
      severity: 'hard',
      pass: shown,
      detail: shown
        ? `The listing chart names the ${productNoun}.`
        : `The listing chart does not name the ${productNoun}.`,
    })
  }
  return checks
}

function money(n: unknown): number | null {
  const v = typeof n === 'number' ? n : Number(n)
  return Number.isFinite(v) && v > 0 ? v : null
}

function usdForms(n: number): string[] {
  const exact = Math.round(n)
  const r1k = Math.round(n / 1000) * 1000
  const forms = [
    `$${exact.toLocaleString('en-US')}`,
    `$${exact}`,
    `$${Math.round(exact / 1000)}k`,
    `$${Math.round(exact / 1000)}K`,
  ]
  if (r1k !== exact) forms.push(`$${r1k.toLocaleString('en-US')}`, `$${r1k}`)
  return [...new Set(forms)]
}

const LIST_REC_FRAME =
  /(?:recommend(?:ed|ing)?(?: listing)?(?: at)?|list(?:ing)? at|would support listing at|do not recommend going above)\s+\$[\d,]+/gi

/** Whole-home list prices in this market are five figures and up. $/sf is not. */
const WHOLE_HOME_MIN_USD = 10_000

/** Suffix after the first dollar: a per-foot unit, or a range that ends in one. */
const PER_FOOT_AFTER =
  /^(?:\s+to\s+\$[\d,]+)?\s*(?:a foot|\/sf|per sq\.?\s*ft|per square foot)\b/i

export function highEndAtOrBelowBandCheck(pricing: {
  highEnd?: number | null
  valueLow?: number | null
  valueHigh?: number | null
}): ContractCheck {
  const highEnd = money(pricing.highEnd)
  const low = money(pricing.valueLow)
  const high = money(pricing.valueHigh)
  const bandHigh = low != null && high != null ? Math.max(low, high) : high
  const pass = highEnd == null || bandHigh == null || highEnd <= bandHigh
  return {
    id: 'high-end-at-or-below-band',
    severity: 'hard',
    pass,
    detail: pass
      ? highEnd != null && bandHigh != null
        ? `High end $${highEnd.toLocaleString('en-US')} sits at or below the band top $${bandHigh.toLocaleString('en-US')}.`
        : 'High end or band top is not printed.'
      : `High end $${highEnd!.toLocaleString('en-US')} sits above the band top $${bandHigh!.toLocaleString('en-US')}.`,
  }
}

export function letterRecommendDollarsCheck(
  html: string,
  pricing: { recommended?: number | null; valueLow?: number | null; valueHigh?: number | null },
): ContractCheck {
  const rec = money(pricing.recommended)
  const low = money(pricing.valueLow)
  const high = money(pricing.valueHigh)
  const bandLow = low != null && high != null ? Math.min(low, high) : null
  const bandHigh = low != null && high != null ? Math.max(low, high) : null
  if (rec == null) {
    return {
      id: 'letter-one-recommend-price',
      severity: 'hard',
      pass: true,
      detail: 'No recommended list to grade.',
    }
  }
  const recForms = new Set(usdForms(rec).map((s) => s.toLowerCase()))
  const bad: string[] = []
  const frameRe = new RegExp(LIST_REC_FRAME.source, 'gi')
  let m: RegExpExecArray | null
  while ((m = frameRe.exec(html))) {
    const frame = m[0]
    const after = html.slice(m.index + frame.length)
    if (PER_FOOT_AFTER.test(after)) continue
    const dollar = frame.match(/\$[\d,]+/)?.[0]
    if (!dollar) continue
    const n = Number(dollar.replace(/[$,]/g, ''))
    if (!Number.isFinite(n) || n <= 0 || n < WHOLE_HOME_MIN_USD) continue
    const framedAsRec = /recommend|listing at|list at/i.test(frame)
    const framedAsRangeCap = /going above/i.test(frame)
    if (!framedAsRec && !framedAsRangeCap) continue
    const isRec = recForms.has(dollar.toLowerCase()) || Math.round(n / 1000) * 1000 === Math.round(rec / 1000) * 1000
    const inBand = bandLow != null && bandHigh != null && n >= bandLow && n <= bandHigh
    if (framedAsRangeCap && inBand) continue
    if (!isRec && !(framedAsRangeCap && inBand)) bad.push(frame.trim())
  }
  return {
    id: 'letter-one-recommend-price',
    severity: 'hard',
    pass: bad.length === 0,
    detail:
      bad.length === 0
        ? `Every list-recommendation dollar equals the rec $${rec.toLocaleString('en-US')} or sits inside the band as a range.`
        : `List-recommendation dollars that are not the rec and not inside the band: ${bad.join(' · ')}`,
  }
}

/**
 * The hero band must overlap the closed comps. A band that sits entirely
 * under every sale, or entirely over every sale, is not support (Marys Grace:
 * band $531k-$577k under comps at $610k-$665k).
 */
export function bandVersusClosedCompsCheck(
  pricing: { valueLow?: number | null; valueHigh?: number | null },
  comps: readonly {
    adjustedPrice?: number | null
    closePrice?: number | null
    weight?: number | null
    timeAdjustment?: number | null
    sizeAdjustment?: number | null
    storyAdjustment?: number | null
    concessionsAmount?: number | null
    concessionsYn?: string | null
  }[] | null | undefined,
): ContractCheck {
  const low = money(pricing.valueLow)
  const high = money(pricing.valueHigh)
  const bandLow = low != null && high != null ? Math.min(low, high) : null
  const bandHigh = low != null && high != null ? Math.max(low, high) : null
  const rows = comps ?? []
  const weighted = rows.filter((c) => typeof c.weight === 'number')
  const setters = weighted.filter((c) => (c.weight ?? 0) > 0)
  if (setters.length >= 3 && weighted.some((c) => (c.weight ?? 0) === 0)) {
    return {
      id: 'band-overlaps-closed-comps',
      severity: 'hard',
      pass: false,
      detail: 'A sale that does not set the price is still in the table.',
    }
  }
  if (setters.length > 0) {
    const ends = setters
      .map((c) =>
        printedAdjustedPrice({
          closePrice: c.closePrice ?? 0,
          adjustedPrice: c.adjustedPrice,
          timeAdjustment: c.timeAdjustment,
          sizeAdjustment: c.sizeAdjustment,
          storyAdjustment: c.storyAdjustment,
          concessionsAmount: c.concessionsAmount,
          concessionsYn: c.concessionsYn,
        }),
      )
      .filter((n) => Number.isFinite(n) && n > 0)
    if (ends.length > 0) {
      const min = Math.min(...ends)
      const max = Math.max(...ends)
      const pass =
        bandLow != null && bandHigh != null && Math.abs(bandLow - min) <= 1 && Math.abs(bandHigh - max) <= 1
      const band = `$${Math.round(bandLow ?? 0).toLocaleString('en-US')}-$${Math.round(bandHigh ?? 0).toLocaleString('en-US')}`
      const span = `$${Math.round(min).toLocaleString('en-US')}-$${Math.round(max).toLocaleString('en-US')}`
      return {
        id: 'band-overlaps-closed-comps',
        severity: 'hard',
        pass,
        detail: pass
          ? `Band ${band} is the adjusted sales that set the price ${span}.`
          : `Band ${band} is not the adjusted sales that set the price ${span}.`,
      }
    }
  }
  const prices = rows
    .map((c) => money(c.adjustedPrice) ?? money(c.closePrice))
    .filter((n): n is number => n != null)
  if (bandLow == null || bandHigh == null || prices.length === 0) {
    return {
      id: 'band-overlaps-closed-comps',
      severity: 'hard',
      pass: true,
      detail: 'No band or no closed comps to compare.',
    }
  }
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const entirelyBelow = bandHigh < min
  const entirelyAbove = bandLow > max
  const pass = !entirelyBelow && !entirelyAbove
  const band = `$${Math.round(bandLow).toLocaleString('en-US')}-$${Math.round(bandHigh).toLocaleString('en-US')}`
  const span = `$${Math.round(min).toLocaleString('en-US')}-$${Math.round(max).toLocaleString('en-US')}`
  return {
    id: 'band-overlaps-closed-comps',
    severity: 'hard',
    pass,
    detail: pass
      ? `Band ${band} overlaps the closed comps ${span}.`
      : entirelyBelow
        ? `Band ${band} sits entirely below every closed comp ${span}.`
        : `Band ${band} sits entirely above every closed comp ${span}.`,
  }
}


/**
 * Every sale and every expired listing the document counts has to be in the
 * document. A missing address fails the letter.
 */
/**
 * "Every sale below moves down" cannot sit next to a sale the grid did not
 * move. A sale that closed at today's level prints $0.
 */
export function dateSentenceMatchesGridCheck(
  html: string,
  comps: readonly { timeAdjustment?: number | null }[] | null | undefined,
): ContractCheck {
  const claimsEvery = EVERY_SALE_MOVES.test(html)
  const stayed = (comps ?? []).some((c) => {
    const move = c.timeAdjustment
    return move != null && Number.isFinite(move) && Math.abs(move) < DATE_MOVE_STAYED_DOLLARS
  })
  const pass = !(claimsEvery && stayed)
  return {
    id: 'date-sentence-matches-grid',
    severity: 'hard',
    pass,
    detail: pass
      ? 'The date sentence does not move a sale the grid left alone.'
      : 'The letter says every sale moved for its date, and a sale in the table did not.',
  }
}

const COMPETITION_HEADING = /Who you would compete with at this price/gi
const COMPETITION_COUNT =
  '(?:[1-9]\\d*|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)'
const COMPETITION_FOR_SALE = new RegExp(
  `\\b${COMPETITION_COUNT}\\s+homes?\\s+(?:is|are)\\s+for sale\\b`,
  'i',
)
const COMPETITION_UNDER_CONTRACT = new RegExp(
  `\\b${COMPETITION_COUNT}\\s+(?:is|are)\\s+under contract\\b`,
  'i',
)
const ACTIVE_MATRIX = /Active: asking in this range now/
const PENDING_MATRIX = /Pending: under contract in this range/

/**
 * The competition chapter may not count a home it does not draw.
 * A positive for-sale count needs the active matrix. A positive
 * under-contract count needs the pending matrix. A chapter that is
 * absent, or that says no home is for sale, passes.
 */
export function competitionHomesAreDrawnCheck(html: string): ContractCheck {
  const chapters: string[] = []
  const heading = new RegExp(COMPETITION_HEADING.source, 'gi')
  let match: RegExpExecArray | null
  while ((match = heading.exec(html))) {
    const rest = html.slice(match.index + match[0].length)
    const next = rest.search(/<h2\b/i)
    chapters.push(next === -1 ? rest : rest.slice(0, next))
  }
  const missing: string[] = []
  for (const chapter of chapters) {
    if (COMPETITION_FOR_SALE.test(chapter) && !ACTIVE_MATRIX.test(chapter)) {
      missing.push('a home for sale')
    }
    if (COMPETITION_UNDER_CONTRACT.test(chapter) && !PENDING_MATRIX.test(chapter)) {
      missing.push('a home under contract')
    }
  }
  const pass = missing.length === 0
  return {
    id: 'competition-homes-are-drawn',
    severity: 'hard',
    pass,
    detail: pass
      ? 'Every home the competition chapter counts is on the page.'
      : `The letter counts ${[...new Set(missing)].join(' and ')} and does not show it.`,
  }
}

export function countedRowsInDocumentCheck(args: {
  html: string
  sales?: readonly (string | null | undefined)[] | null
  expired?: readonly (string | null | undefined)[] | null
}): ContractCheck {
  const missing = countedAddressesMissingFromDocument(
    [...(args.sales ?? []), ...(args.expired ?? [])],
    args.html,
  )
  const pass = missing.length === 0
  return {
    id: 'counted-rows-in-table',
    severity: 'hard',
    pass,
    detail: pass
      ? 'Every counted sale and expired listing is in the document.'
      : `Counted but missing from the table: ${missing.join(', ')}.`,
  }
}

export function evaluateLetterConsistencyContract(args: {
  html: string
  names: LetterNameSource | null | undefined
  identity: LetterLinkIdentity | null | undefined
  pricing: {
    recommended?: number | null
    highEnd?: number | null
    valueLow?: number | null
    valueHigh?: number | null
  }
  closedComps?: readonly {
    adjustedPrice?: number | null
    closePrice?: number | null
    address?: string | null
    timeAdjustment?: number | null
  }[] | null
  /** Expired listings the letter counted. Each address has to be in the table. */
  expiredAddresses?: readonly (string | null | undefined)[] | null
  /** The addresses the letter prints (printedAddressesOf). Lets the owner-name check tell a street from a name. */
  printedAddresses?: readonly (string | null | undefined)[] | null
  /** Where the sales sit, and the chart. Absent on older callers, which skip these checks. */
  place?: LetterPlaceSource | null
}): { pass: boolean; checks: ContractCheck[] } {
  const checks: ContractCheck[] = [
    letterOwnerNameCheck(args.html, args.names, { printedAddresses: args.printedAddresses }),
    letterLinkTrackingCheck(args.html, args.identity),
    highEndAtOrBelowBandCheck(args.pricing),
    letterRecommendDollarsCheck(args.html, args.pricing),
    bandVersusClosedCompsCheck(args.pricing, args.closedComps),
    dateSentenceMatchesGridCheck(args.html, args.closedComps),
    countedRowsInDocumentCheck({
      html: args.html,
      sales: (args.closedComps ?? []).map((c) => c.address),
      expired: args.expiredAddresses,
    }),
    competitionHomesAreDrawnCheck(args.html),
    ...letterPlaceChecks(args.html, args.place),
  ]
  return { pass: checks.every((c) => c.pass), checks }
}
