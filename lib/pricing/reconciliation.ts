/**
 * Reconciliation — which sale carried the price, and why.
 *
 * Appraisal practice (USPAP SR 1-6, and *The Appraisal of Real Estate* 15th
 * ed.) never averages the adjusted sales silently: it names the one that
 * carries the most weight on three axes — similarity, recency, and the
 * smallest total adjustment — and says so. RPR prints the same thing as a
 * "Comp Weighting" column. We already COMPUTED a weight per sale
 * (`adjustCompAlongMarket`: size proximity × recency) and printed none of it,
 * which is the gap the professional-practice research named as item 2
 * (docs/research/cma-professional-practice-2026-09-07.md).
 *
 * This module is the whole of that: normalize the weights the engine already
 * assigns, state a factual reason per sale, and write one sentence naming the
 * sale that mattered most. It is a pure module with no reads, and it is the
 * SAME function that produces the point value in `estimate.ts` — the sentence
 * the reader gets and the number on the cover cannot come apart.
 *
 * VOICE. The document never says comp, subject, band, kept, or set
 * (docs/plans/CMA_REIMAGINED_2026-09-07.md, "Words"). Every string this module
 * writes is a plain fact about a house: "60 square feet from yours", "sold two
 * months ago", "its price moved 2.1 percent when adjusted for date and size".
 * A superlative is written only when it is true of the printed sales.
 */

/** The two fields the weighted value itself needs. Every adjusted sale has them. */
export interface WeightedSale {
  adjustedPrice: number
  weight: number
}

/**
 * The value the printed sales support: each sale's adjusted price times its
 * share of the total weight. Sales with no usable weight are weighted equally
 * rather than dropped. Null when nothing is priceable.
 *
 * This is the ONE definition of the point value. `reconcileAdjustedSales`
 * calls it for the printed sentence and `lib/pricing/estimate.ts` calls it for
 * the recommendation, so the two cannot diverge (D10).
 */
export function weightedAdjustedPrice(sales: readonly WeightedSale[]): number | null {
  const usable = sales.filter((s) => Number.isFinite(s.adjustedPrice) && s.adjustedPrice > 0)
  if (usable.length === 0) return null
  const raw = (s: WeightedSale) => (Number.isFinite(s.weight) && s.weight > 0 ? s.weight : 0)
  const total = usable.reduce((sum, s) => sum + raw(s), 0)
  const share = (s: WeightedSale) => (total <= 0 ? 1 / usable.length : raw(s) / total)
  return Math.round(usable.reduce((sum, s) => sum + s.adjustedPrice * share(s), 0))
}

/** What the reconciliation needs off an adjusted sale. */
export interface ReconcilableSale {
  listingKey: string
  address: string
  sqft: number
  closePrice: number
  closeDate: string
  monthsSinceClose: number
  timeAdjustment: number
  sizeAdjustment: number
  storyAdjustment?: number
  adjustedPrice: number
  /** size proximity × recency, from adjustCompAlongMarket. Judge-weak sales come in halved. */
  weight: number
}

export interface ReconciliationWeight {
  listingKey: string
  address: string
  /** Share of the total weight, in percent, one decimal. The printed column. */
  weight: number
  /** The engine's raw weight, so a reviewer can re-derive the share. */
  weightRaw: number
  /** Sale price after the date, size and story adjustments. */
  adjustedPrice: number
  /** Every adjustment's size added up, as a percent of the sale price. */
  grossAdjustmentPct: number
  /** A short factual phrase: size gap, recency, how far the adjustments moved it. */
  reason: string
}

export interface CmaReconciliation {
  weights: ReconciliationWeight[]
  /** ListingKey of the sale carrying the most weight. Null on an empty set. */
  mostWeighted: string | null
  /** The weighted value the printed sales support, before any list-price step. */
  weightedPrice: number | null
  /** One sentence, seller language, naming that sale and why it leads. */
  sentence: string | null
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/** Total adjustment movement as a share of the sale price. */
export function grossAdjustmentPct(sale: ReconcilableSale): number {
  if (!(sale.closePrice > 0)) return 0
  const gross =
    Math.abs(sale.timeAdjustment) + Math.abs(sale.sizeAdjustment) + Math.abs(sale.storyAdjustment ?? 0)
  return round1((gross / sale.closePrice) * 100)
}

/** "the same size as yours" · "60 square feet smaller than yours". */
function sizePhrase(sale: ReconcilableSale, subjectSqft: number): string {
  if (!(subjectSqft > 0) || !(sale.sqft > 0)) return 'the same layout as yours'
  const delta = Math.round(sale.sqft - subjectSqft)
  if (delta === 0) return 'the same size as yours'
  const n = Math.abs(delta).toLocaleString('en-US')
  return `${n} square ${Math.abs(delta) === 1 ? 'foot' : 'feet'} ${delta > 0 ? 'larger' : 'smaller'} than yours`
}

/** "sold this month" · "sold a month ago" · "sold 7 months ago". */
function recencyPhrase(sale: ReconcilableSale): string {
  const months = Math.round(sale.monthsSinceClose)
  if (months <= 0) return 'sold this month'
  if (months === 1) return 'sold a month ago'
  return `sold ${months} months ago`
}

/** "its price moved 2.1 percent" · "its price did not move". */
function movementPhrase(pct: number): string {
  if (pct <= 0) return 'its price did not move when adjusted for date and size'
  return `its price moved ${pct} percent when adjusted for date and size`
}

/**
 * The weights, the leader, the weighted value, and the sentence.
 *
 * Weight shares are the engine's own weights over their total, so they sum to
 * 100 by construction. A sale with a non-positive weight cannot pull the value
 * and is dropped from the reconciliation; when every weight is missing the
 * sales are weighted equally rather than silently ignored, and the value is
 * then their plain mean.
 */
export function reconcileAdjustedSales(args: {
  sales: readonly ReconcilableSale[]
  subjectSqft: number
}): CmaReconciliation {
  const usable = args.sales.filter((s) => Number.isFinite(s.adjustedPrice) && s.adjustedPrice > 0)
  if (usable.length === 0) {
    return { weights: [], mostWeighted: null, weightedPrice: null, sentence: null }
  }
  const rawOf = (s: ReconcilableSale) =>
    Number.isFinite(s.weight) && s.weight > 0 ? s.weight : 0
  const total = usable.reduce((sum, s) => sum + rawOf(s), 0)
  const equalWeighted = total <= 0
  const share = (s: ReconcilableSale) => (equalWeighted ? 1 / usable.length : rawOf(s) / total)

  const weightedPrice = weightedAdjustedPrice(usable)

  const smallestGross = Math.min(...usable.map(grossAdjustmentPct))
  const closestSize =
    args.subjectSqft > 0 ? Math.min(...usable.map((s) => Math.abs(s.sqft - args.subjectSqft))) : null
  const mostRecent = Math.min(...usable.map((s) => s.monthsSinceClose))

  const weights: ReconciliationWeight[] = usable.map((s) => {
    const gross = grossAdjustmentPct(s)
    const parts = [sizePhrase(s, args.subjectSqft), recencyPhrase(s), movementPhrase(gross)]
    const leads: string[] = []
    // "closest in size to yours" adds nothing beside "the same size as yours",
    // and printing both reads as padding.
    if (closestSize != null && closestSize > 0 && Math.abs(s.sqft - args.subjectSqft) === closestSize) {
      leads.push('closest in size to yours')
    }
    if (s.monthsSinceClose === mostRecent) leads.push('the most recent sale')
    if (gross === smallestGross) leads.push('the smallest adjustment of any sale here')
    return {
      listingKey: s.listingKey,
      address: s.address,
      weight: round1(share(s) * 100),
      weightRaw: +rawOf(s).toFixed(4),
      adjustedPrice: Math.round(s.adjustedPrice),
      grossAdjustmentPct: gross,
      reason: [...leads, ...parts].join(', '),
    }
  })

  const leader = [...weights].sort(
    (a, b) => b.weight - a.weight || a.listingKey.localeCompare(b.listingKey),
  )[0]!
  const leaderSale = usable.find((s) => s.listingKey === leader.listingKey)!
  const why = [
    sizePhrase(leaderSale, args.subjectSqft),
    recencyPhrase(leaderSale),
    ...(leader.grossAdjustmentPct === smallestGross && usable.length > 1
      ? ['it needed the smallest adjustment of any sale here']
      : [movementPhrase(leader.grossAdjustmentPct)]),
  ]
  const sentence = `${leader.address} carries the most weight in this price at ${leader.weight} percent: it is ${why[0]}, it ${why[1]}, and ${why[2]}.`

  return { weights, mostWeighted: leader.listingKey, weightedPrice, sentence }
}
