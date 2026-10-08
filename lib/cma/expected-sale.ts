/**
 * THE SALE WE EXPECT, BESIDE THE LIST WE RECOMMEND (Matt 2026-10-07).
 *
 * 2566 Keats: the five sales weigh out to $622,128 and the cover recommends
 * listing at $639,000, near the top of the adjusted range. Nothing on the page
 * joined the two numbers, so a seller saw a list price and no reason for it.
 * This module reads the one figure that joins them, ONCE, for the price
 * chapter and the net chapter, so the two can never print different sales.
 *
 * WHICH FIELD. `reconciliation.weightedPrice` is the weighted value of the
 * printed sales (lib/pricing/reconciliation.ts). `predictedClose` equals it on
 * a comps-path build. On an ask-path build it is the seller's own ask times
 * 0.98 (`reconcileAskAndComps` in lib/pricing/estimate.ts), which is not a
 * price the sales point to. So `predictedClose` is read only when it IS the
 * weighted price, and a row with no weighted price prints nothing new.
 *
 * WHEN IT PRINTS NOTHING
 *  - no weighted price on the row;
 *  - the figure is the list price or above it: a sale above the list is not an
 *    expectation this document can defend, and at the list it says nothing;
 *  - the printed grid cannot produce it: a weighted average sits inside the
 *    spread of what it averages, so a figure outside the printed adjusted
 *    prices did not come from them;
 *  - the letter took the city date move out of the grid (the flat-date story,
 *    lib/cma/flat-date-story.ts), which the stored weighted price still holds.
 *
 * Nothing here estimates. Every dollar is a stored field or the seller-net
 * formula (`sellerCostLines`, the same Oregon owner's-policy rate the list
 * column was written with) applied to a stored field.
 */

import { countWord, usd } from '@/lib/cma/render-blocks'
import { tableAdjustedBand, tableBandSales } from '@/lib/cma/cover-value'
import { isRecommendMark } from '@/lib/cma/recommend-once'
import { setAsideCompIndexes, trimsEachEnd } from '@/lib/cma/set-aside'
import {
  NET_BUYER_AGENT_FEE_PCT,
  NET_LISTING_FEE_PCT,
  printedAdjustedPrice,
  sellerCostLines,
} from '@/lib/pricing/seller-net'
import { weightedAdjustedPrice } from '@/lib/pricing/reconciliation'
import type { CmaAdjustedComp, CmaPricing } from '@/lib/cma/types'

export type ExpectedSale = {
  /** Whole dollars, exactly as stored. */
  price: number
  /** The render_args field the figure was read from (the §0 trace). */
  field: 'pricing.predictedClose' | 'pricing.reconciliation.weightedPrice'
  /** How many sales carry weight in it, or null when the row does not say. */
  sales: number | null
}

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v)
  return v != null && Number.isFinite(n) ? n : null
}

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

/**
 * How far the stored weighted price may sit from the same weights run over the
 * printed grid. The comps carry their raw weights to four decimals, so a
 * healthy row lands within a few dollars; a row whose grid moved after the
 * build (a date move taken out, a credit the stored price ignored) misses by
 * thousands.
 */
function gridTolerance(price: number): number {
  return Math.max(5, price * 0.0005)
}

/** The listing keys the reconciliation gave a weight above zero. */
function weightedKeys(pricing: CmaPricing): Set<string> {
  const recon = obj((pricing as unknown as { reconciliation?: unknown }).reconciliation)
  return new Set(
    (Array.isArray(recon?.weights) ? (recon!.weights as unknown[]) : [])
      .map((w) => obj(w))
      .filter((w) => {
        const share = num(w?.weight)
        return share != null && share > 0 && typeof w?.listingKey === 'string'
      })
      .map((w) => String(w!.listingKey)),
  )
}

/**
 * The printed sales that carry weight in the price, in grid order. Empty when
 * the row records no weights, so a caller never guesses which sales they are.
 */
export function priceSettingComps(
  pricing: CmaPricing | null | undefined,
  comps: readonly CmaAdjustedComp[] | null | undefined,
): CmaAdjustedComp[] {
  if (!pricing || !comps || comps.length === 0) return []
  const keys = weightedKeys(pricing)
  if (keys.size === 0) return []
  return comps.filter((c) => c.listingKey != null && keys.has(c.listingKey))
}

/**
 * The expected sale where the letter says "near": to the thousand. A weighted
 * average printed to the dollar ("near $522,219") claims a precision "near"
 * takes back (reader review 2026-10-07). The net column is figured on this
 * same number, so the header and the fees under it agree.
 */
export function expectedSaleNear(e: Pick<ExpectedSale, 'price'>): number {
  return Math.round(e.price / 1000) * 1000
}

/**
 * The expected sale, or null.
 *
 * `comps` is the grid the reader sees, and it is required: the figure prints
 * only when the reconciliation's own sales are all in that grid and the same
 * weights, run over the grid's printed adjusted prices (`printedAdjustedPrice`,
 * the "Sale price today" row, after any credit the seller gave), land on it.
 */
export function expectedSaleFor(input: {
  pricing: CmaPricing | null | undefined
  comps?: readonly CmaAdjustedComp[] | null
}): ExpectedSale | null {
  const p = input.pricing
  if (!p) return null
  const rec = num(p.recommended)
  if (rec == null || !(rec > 0)) return null
  const recon = obj((p as unknown as { reconciliation?: unknown }).reconciliation)
  const weighted = num(recon?.weightedPrice)
  if (weighted == null || !(weighted > 0)) return null
  const predicted = num(p.predictedClose)
  const usePredicted = predicted != null && predicted > 0 && Math.abs(predicted - weighted) < 1
  const price = Math.round(usePredicted ? predicted! : weighted)
  if (price >= rec || isRecommendMark(price, rec)) return null

  // THE GRID MUST PRODUCE IT.
  const comps = input.comps ?? []
  if (comps.length === 0) return null
  const keys = weightedKeys(p)
  if (keys.size === 0) return null
  const rows = comps.filter((c) => c.listingKey != null && keys.has(c.listingKey))
  if (rows.length !== keys.size) return null
  const fromGrid = weightedAdjustedPrice(
    rows.map((c) => ({ adjustedPrice: printedAdjustedPrice(c), weight: c.weight })),
  )
  if (fromGrid == null || Math.abs(fromGrid - price) > gridTolerance(price)) return null
  const band = tableAdjustedBand(comps, p)
  if (!band || price < band.low || price > band.high) return null
  return {
    price,
    field: usePredicted ? 'pricing.predictedClose' : 'pricing.reconciliation.weightedPrice',
    sales: rows.length,
  }
}

/**
 * The one sentence under the price chapter's heading.
 *
 * The cover owns the list dollars (lib/cma/recommend-once.ts), so the list is
 * "the price on the cover" here. It said "that price" with no price on the
 * page for it to point at (reader review 2026-10-07). The expected sale is a
 * different number and prints, to the thousand ("near").
 *
 * `setters` names the sales behind the figure when they are fewer than the
 * grid prints. "The three sales" under a heading that counts five, three of
 * them in the subdivision, read as those three; on 3037 Purcell only one of
 * the three that set the price was.
 */
export function expectedSaleSentence(
  e: ExpectedSale,
  opts?: { onMarket?: boolean; setters?: readonly string[] | null },
): string {
  const named = (opts?.setters ?? []).map((a) => a.trim()).filter(Boolean)
  const count = e.sales != null && e.sales > 1 ? `the ${countWord(e.sales)} sales` : 'the sales'
  const sales = (behind: string) =>
    named.length > 1 && (e.sales == null || e.sales === named.length)
      ? `the ${countWord(named.length)} sales ${behind}, ${joinAnd(named)},`
      : count
  const near = usd(expectedSaleNear(e))
  // A home on the market now is listed with a broker. "We'd list at that
  // price" asks for that listing, so the document says only what the sales
  // point to (the closing's non-solicitation rule, closingIsNonSoliciting).
  if (opts?.onMarket) {
    return `${capitalise(sales('that set this price'))} point to a sale near ${near} once each is weighted by how closely it matches your home.`
  }
  return `We'd list at the price on the cover and expect it to sell near ${near}, which is what ${sales('behind it')} point to once each is weighted by how closely it matches your home.`
}

/**
 * The heading's subdivision count, squared with the sales that set the price.
 *
 * "Three of the five sales are in Silver Sage." is true of the five the grid
 * prints, and the next sentence says the price comes from three. On 3037
 * Purcell only one of those three is in Silver Sage, so the heading read as a
 * claim about the wrong set. When the priced sales are fewer than the printed
 * ones and the heading counts the printed ones inside the subdivision, the
 * same sentence also counts the priced ones.
 */
export function headingWithPriceSet(
  heading: string,
  input: {
    subdivision: string | null | undefined
    comps: readonly CmaAdjustedComp[]
    pricing: CmaPricing | null | undefined
  },
): string {
  const name = (input.subdivision ?? '').trim()
  if (!name || !heading.includes(name) || !/\bsales\b/i.test(heading)) return heading
  if (/set the price/i.test(heading)) return heading
  const setters = priceSettingComps(input.pricing, input.comps)
  if (setters.length === 0 || setters.length >= input.comps.length) return heading
  const inside = (c: CmaAdjustedComp) => (c.subdivision ?? '').trim().toLowerCase() === name.toLowerCase()
  const printedInside = input.comps.filter(inside).length
  if (printedInside === 0 || printedInside >= input.comps.length) return heading
  const k = setters.filter(inside).length
  const m = setters.length
  const clause =
    k === m
      ? m === 2
        ? 'both that set the price are'
        : `all ${countWord(m)} that set the price are`
      : k === 0
        ? `none of the ${countWord(m)} that set the price is`
        : `${countWord(k)} of the ${countWord(m)} that set the price ${k === 1 ? 'is' : 'are'}`
  return `${heading.trim().replace(/\.$/, '')}, and ${clause}.`
}

// ── the range line ──────────────────────────────────────────────────────────

/** Which adjustments the printed grid actually made, in reading order. */
function adjustedToWords(comps: readonly CmaAdjustedComp[]): string[] {
  const moved = (pick: (c: CmaAdjustedComp) => number | null | undefined) =>
    comps.some((c) => {
      const v = pick(c)
      // Same test as adjustmentsMade (opinion-pages.ts): any non-zero move.
      return v != null && Number.isFinite(v) && v !== 0
    })
  const words: string[] = []
  if (moved((c) => c.timeAdjustment)) words.push("today's market")
  if (moved((c) => c.sizeAdjustment)) words.push("your home's size")
  if (moved((c) => c.storyAdjustment)) words.push("your home's style")
  return words
}

function joinAnd(parts: readonly string[]): string {
  if (parts.length <= 1) return parts[0] ?? ''
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/** The sales the printed band is drawn from: the weighted ones less the set-aside rows, as tableAdjustedBand reads them. */
function bandSales(comps: readonly CmaAdjustedComp[], pricing?: CmaPricing | null): CmaAdjustedComp[] {
  return tableBandSales(comps, pricing).filter((c) => {
    const n = printedAdjustedPrice(c)
    return Number.isFinite(n) && n > 0
  })
}

/**
 * "The five sales, adjusted to today's market and your home's size, run from
 * $603,227 to $639,871."
 *
 * The same pair the hero prints (`tableAdjustedBand`), counted over the same
 * sales, so the count and the figures are the grid's own. Empty without a
 * grid: the caller keeps its own range sentence then.
 *
 * `afterExpected` lets the line lean on the sentence before it ("they")
 * when that sentence counted the same sales.
 */
export function adjustedRangeLine(
  comps: readonly CmaAdjustedComp[] | null | undefined,
  opts?: { afterExpected?: ExpectedSale | null; pricing?: CmaPricing | null },
): string {
  const rows = comps ?? []
  if (rows.length === 0) return ''
  const band = tableAdjustedBand(rows, opts?.pricing)
  if (!band || !(band.low > 0) || !(band.high > 0)) return ''
  const sales = bandSales(rows, opts?.pricing)
  const n = sales.length
  if (n === 0) return ''
  const words = adjustedToWords(rows)
  const adjusted = words.length > 0 ? `adjusted to ${joinAnd(words)}` : ''
  const one = n === 1
  const span =
    band.low === band.high
      ? `${one ? 'comes to' : 'all come to'} ${usd(band.low)}`
      : `run from ${usd(band.low)} to ${usd(band.high)}`
  // A sale the document sets aside cannot be counted among the sales the
  // range is drawn from (CMA rule 17). When the band still reaches one, the
  // line states the span without a count rather than a count the grid's own
  // "set aside" list contradicts.
  const aside = opts?.pricing ? setAsideCompIndexes(opts.pricing, rows) : new Set<number>()
  // The trim rule is the range's own rule, so the line says it (the stored
  // rangeRule.sentence used to, and set-aside rows name it as their reason).
  const trim =
    opts?.pricing && aside.size > 0 && trimsEachEnd(opts.pricing)
      ? ' The highest and the lowest sale are set aside, so the range runs between the rest.'
      : ''
  const countable = ![...aside].some((i) => sales.includes(rows[i]!))
  if (!countable) {
    return (adjusted ? `${capitalise(adjusted)}, the sales ${span}.` : `The sales ${span}.`) + trim
  }
  const sameSales = !one && opts?.afterExpected?.sales != null && opts.afterExpected.sales === n
  if (sameSales) {
    return (adjusted ? `${capitalise(adjusted)}, they ${span}.` : `They ${span}.`) + trim
  }
  const who = one ? 'The one sale' : `The ${countWord(n)} sales`
  return (adjusted ? `${who}, ${adjusted}, ${span}.` : `${who} ${span}.`) + trim
}

function capitalise(s: string): string {
  return s ? `${s.charAt(0).toUpperCase()}${s.slice(1)}` : s
}

// ── the net, at the expected sale ───────────────────────────────────────────

/** The cost lines this module can recompute at a second price. */
const ENGINE_LINES = ['Our fee', "Buyer's agent", 'Title insurance'] as const

export type NetColumnLine = { label: string; source: string; atList: number; atExpected: number }

/**
 * The buyer credits on the sales behind the expected sale, from
 * `sellerNet` (`buildSellerNet` writes the median over the sales that set
 * this price, zeros included: lib/cma/build.ts `attachSellerNet(p, set)`).
 */
export type NetCredits = {
  /** Sales whose credit is on record, given or not. */
  known: number
  /** Sales that gave one. */
  given: number
  /** `expectedConcessions`: the typical credit across the known sales. */
  typical: number | null
}

export type NetTwoColumns = {
  list: number
  expected: ExpectedSale
  lines: NetColumnLine[]
  netAtList: number
  netAtExpected: number
  credits: NetCredits | null
}

/** What a cost line is, without the price it was written at. */
function lineSource(label: string): string {
  if (label === 'Our fee') return `${NET_LISTING_FEE_PCT}% of the sale price`
  if (label === "Buyer's agent") return `${NET_BUYER_AGENT_FEE_PCT}% of the sale price, if you offer it`
  return "Oregon owner's policy rate"
}

/**
 * The stored sheet, and the same sheet at the expected sale.
 *
 * Only when the stored sheet IS the formula: every line is one of the three
 * engine lines and each amount equals `sellerCostLines(list)` to the dollar.
 * A hand-itemised sheet (a payoff, a negotiated fee) cannot be carried to a
 * second price by this module, so it gets one column, as before.
 *
 * NO SECOND CREDIT. The expected sale is the weighted "Sale price today" of
 * the printed sales, and that row is each sale AFTER the credit its seller
 * gave (lib/pricing/seller-net.ts `comparableAdjustedPrice`: the recorded
 * concession comes off the close first). On Keats 2542 Keats closed at
 * $605,000 with a $14,600 credit and prints $620,206 = 605,000 − 14,600 +
 * 29,806. Subtracting the typical $12,000 credit again from $622,128 would
 * count the same credit twice and understate the net by that much, so the
 * credits are reported beside the column (`credits`), never subtracted from
 * it.
 */
export function netAtExpectedSale(input: {
  pricing: CmaPricing | null | undefined
  comps?: readonly CmaAdjustedComp[] | null
  sheet: { list: number; net: number; lines: ReadonlyArray<{ label: string; amount: number }> } | null
}): NetTwoColumns | null {
  const sheet = input.sheet
  const p = input.pricing
  if (!sheet || !p) return null
  const expected = expectedSaleFor({ pricing: p, comps: input.comps })
  if (!expected) return null
  // The column header says "near" and prints the thousand; the fees under it
  // are figured on that same number.
  const near = expectedSaleNear(expected)
  if (!(near < sheet.list)) return null
  const formula = sellerCostLines(sheet.list)
  if (formula.length !== sheet.lines.length || formula.length !== ENGINE_LINES.length) return null
  for (let i = 0; i < formula.length; i++) {
    const stored = sheet.lines[i]!
    if (stored.label !== formula[i]!.label || Math.round(stored.amount) !== formula[i]!.amount) return null
  }
  const atExpected = sellerCostLines(near)
  if (atExpected.length !== formula.length) return null

  const sn = obj((p as unknown as { sellerNet?: unknown }).sellerNet)
  const known = num(sn?.knownCount)
  const given = num(sn?.givenCount)
  const typical = num(sn?.expectedConcessions)
  const credits: NetCredits | null =
    known != null && known > 0 && given != null && given >= 0 && given <= known
      ? { known, given, typical: typical != null && typical >= 0 ? Math.round(typical) : null }
      : null

  const lines: NetColumnLine[] = formula.map((l, i) => ({
    label: l.label,
    source: lineSource(l.label),
    atList: Math.round(sheet.lines[i]!.amount),
    atExpected: atExpected[i]!.amount,
  }))
  const costsAtExpected = atExpected.reduce((t, l) => t + l.amount, 0)
  return {
    list: sheet.list,
    expected,
    lines,
    netAtList: sheet.net,
    netAtExpected: Math.max(0, near - costsAtExpected),
    credits,
  }
}

/**
 * The line under the two columns about buyer credits, or ''.
 *
 * Only says what the row records: how many of the sales gave a credit, the
 * typical one, and that the expected sale is already counted after them.
 */
export function netCreditsSentence(t: NetTwoColumns): string {
  const c = t.credits
  // The credit counts are over the sales that set this price. When that is
  // not the same count as the sales behind the expected sale, the sentence
  // would name a count the reader cannot find, so it says nothing.
  if (!c || c.known !== t.expected.sales) return ''
  const n = countWord(c.known)
  const near = usd(expectedSaleNear(t.expected))
  if (c.given === 0) return `None of the ${n} sales behind ${near} gave the buyer a credit.`
  const gave =
    c.given === c.known
      ? `All ${n} gave one`
      : `${capitalise(countWord(c.given))} of the ${n} gave one`
  const typical =
    c.typical != null && c.typical > 0 ? `, and the typical credit across all ${n} was ${usd(c.typical)}` : ''
  // The fees in the column are figured on the expected sale itself. A deal
  // written higher with a credit back carries its fees on the higher price,
  // so the note says where the fees are figured instead of claiming the
  // column already covers a credit.
  return `The ${n} sales are counted after any credit their sellers gave the buyer. ${gave}${typical}. This column figures the fees on ${near}. If the sale is written higher with a credit back to the buyer, the fees are figured on the higher price.`
}
