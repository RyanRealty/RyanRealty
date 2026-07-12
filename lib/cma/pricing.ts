/**
 * CMA pricing engine — the deterministic version of the producer skill's
 * step 9 methodology:
 *
 *   Market-conditions (time) adjustment on EVERY comp first, using the
 *   verified YoY rate from market_stats_cache (never estimated). Then:
 *
 *   Method 1 — tiered $/sqft: p25 / p50 / p75 of the comps' time-adjusted
 *              $/sqft applied to the subject's sqft.
 *   Method 2 — baseline + value-add: median adjusted price of the three
 *              size-closest comps, plus documented seller improvements at a
 *              65% recovery rate when provided. Null when fewer than 3 comps.
 *   Method 3 — similarity-weighted reconciliation of the fully adjusted comp
 *              prices (size proximity x recency weights).
 *
 * Size adjustment uses the appraisal convention of ~50% of the $/sqft rate on
 * the sqft delta (marginal square footage is worth less than average).
 * Beds / baths / lot / condition differences are NOT numerically adjusted —
 * a deterministic builder cannot defend paired-sales values for them, so they
 * are disclosed as comparability notes instead (skill step 9: "if you cannot
 * justify it from the data, do not make it").
 */

import type { CmaAdjustedComp, CmaComp, CmaMarketContext, CmaPricing, CmaSubject } from '@/lib/cma/types'

const MS_PER_MONTH = 30.44 * 86_400_000
const SIZE_ADJ_FACTOR = 0.5
const IMPROVEMENT_RECOVERY = 0.65
// Comparable-heterogeneity guard: coefficient of variation of the comps'
// adjusted $/sqft. Above this, the "comparables" span different quality or
// location tiers and the reconciled figure needs broker judgment before a
// client sees it (a coded stand-in for the judgment the retired LLM step
// provided). Tuned so a tight subdivision cluster (CV ~3-8%) passes and a
// mixed $218-414/sqft set (CV ~19%) flags.
const DISPERSION_CV_LIMIT = 0.18
// Safety rail on the linear time adjustment: a high YoY rate on an old comp
// (e.g. +15% YoY x 24 months = +30% on one line) can single-handedly distort
// the estimate. Cap each comp's market-conditions adjustment at 20% of its
// own close price in either direction. Conservative and backward-compatible
// (only clamps the extreme long-lever comps; the BPO engine shares this).
const TIME_ADJ_CAP_FRACTION = 0.2

/** Carries an internal cap flag alongside the public adjusted-comp shape. */
type AdjustedCompInternal = CmaAdjustedComp & { _timeAdjCapped?: boolean }

function round1000(n: number): number {
  return Math.round(n / 1000) * 1000
}

function round5000(n: number): number {
  return Math.round(n / 5000) * 5000
}

/** Interpolated percentile of a sorted-ascending numeric array. */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  if (sorted.length === 1) return sorted[0]!
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  const frac = idx - lo
  return sorted[lo]! * (1 - frac) + sorted[hi]! * frac
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return percentile(sorted, 0.5)
}

/** Apply time + size adjustments and similarity weights to every comp. */
export function adjustComps(
  subject: CmaSubject,
  comps: CmaComp[],
  market: CmaMarketContext | null,
): CmaAdjustedComp[] {
  const subjectSqft = subject.sqft ?? 0
  const yoyPct = market?.yoyMedianPriceDeltaPct ?? null
  const now = Date.now()
  return comps.map((comp) => {
    const monthsSinceClose = Math.max(0, (now - new Date(comp.closeDate).getTime()) / MS_PER_MONTH)
    const rawTimeAdjustment =
      yoyPct != null ? Math.round(comp.closePrice * (yoyPct / 100) * (monthsSinceClose / 12)) : 0
    const timeAdjCap = Math.round(comp.closePrice * TIME_ADJ_CAP_FRACTION)
    const timeAdjustment = Math.max(-timeAdjCap, Math.min(timeAdjCap, rawTimeAdjustment))
    const timeAdjustmentCapped = timeAdjustment !== rawTimeAdjustment
    const timeAdjustedPrice = comp.closePrice + timeAdjustment
    const ppsfTimeAdjusted = timeAdjustedPrice / comp.sqft
    const sizeAdjustment =
      subjectSqft > 0 ? Math.round((subjectSqft - comp.sqft) * ppsfTimeAdjusted * SIZE_ADJ_FACTOR) : 0
    const adjustedPrice = timeAdjustedPrice + sizeAdjustment
    const sizeProximity = subjectSqft > 0 ? 1 / (1 + Math.abs(subjectSqft - comp.sqft) / subjectSqft) : 1
    const recency = 1 / (1 + monthsSinceClose / 12)
    const out: AdjustedCompInternal = {
      ...comp,
      monthsSinceClose: +monthsSinceClose.toFixed(1),
      timeAdjustment,
      timeAdjustedPrice,
      ppsfTimeAdjusted: +ppsfTimeAdjusted.toFixed(2),
      sizeAdjustment,
      adjustedPrice,
      weight: +(sizeProximity * recency).toFixed(4),
      _timeAdjCapped: timeAdjustmentCapped,
    }
    return out
  })
}

export function computePricing(
  subject: CmaSubject,
  adjusted: CmaAdjustedComp[],
  market: CmaMarketContext | null,
  opts: { sellerImprovementsTotal?: number | null; priceOverride?: number | null } = {},
): CmaPricing | null {
  const subjectSqft = subject.sqft ?? 0
  if (adjusted.length === 0 || subjectSqft <= 0) return null
  const notes: string[] = []

  // Surface the time-adjustment safety rail in the audit trail: when a comp's
  // market-conditions adjustment was clamped to 20% of its sale price, say so,
  // so the capped figure in the citations blob is explained rather than silent.
  const cappedCount = adjusted.filter((c) => (c as AdjustedCompInternal)._timeAdjCapped).length
  if (cappedCount > 0) {
    notes.push(
      `${cappedCount} comp${cappedCount > 1 ? 's had their' : ' had its'} market-conditions (time) adjustment capped at ${Math.round(
        TIME_ADJ_CAP_FRACTION * 100,
      )}% of the sale price, so no single older sale can over-drive the estimate.`,
    )
  }

  // Method 1 — tiered $/sqft on time-adjusted comps.
  const ppsfSorted = adjusted.map((c) => c.ppsfTimeAdjusted).sort((a, b) => a - b)
  const method1Low = round1000(percentile(ppsfSorted, 0.25) * subjectSqft)
  const method1Mid = round1000(percentile(ppsfSorted, 0.5) * subjectSqft)
  const method1High = round1000(percentile(ppsfSorted, 0.75) * subjectSqft)

  // Method 2 — baseline (3 size-closest comps, fully adjusted) + improvements value-add.
  let method2: number | null = null
  let improvementsValueAdd: number | null = null
  if (adjusted.length >= 3) {
    const bySize = [...adjusted].sort(
      (a, b) => Math.abs(a.sqft - subjectSqft) - Math.abs(b.sqft - subjectSqft),
    )
    const baseline = median(bySize.slice(0, 3).map((c) => c.adjustedPrice))
    const spend = opts.sellerImprovementsTotal ?? null
    if (spend != null && spend > 0) {
      improvementsValueAdd = Math.round(spend * IMPROVEMENT_RECOVERY)
      notes.push(
        `Method 2 credits the seller's reported improvement spend at a ${Math.round(IMPROVEMENT_RECOVERY * 100)}% recovery rate (Remodeling Magazine Cost-vs-Value, Pacific region convention).`,
      )
    }
    method2 = round1000(baseline + (improvementsValueAdd ?? 0))
  }

  // Method 3 — similarity-weighted reconciliation.
  const totalWeight = adjusted.reduce((a, c) => a + c.weight, 0)
  const method3 = round1000(
    adjusted.reduce((a, c) => a + c.adjustedPrice * c.weight, 0) / (totalWeight || 1),
  )

  // Convergence across the available methods.
  const candidates = [method1Mid, method3, ...(method2 != null ? [method2] : [])]
  const cMin = Math.min(...candidates)
  const cMax = Math.max(...candidates)
  const cMed = median(candidates)
  const convergenceSpreadPct = cMed > 0 ? +(((cMax - cMin) / cMed) * 100).toFixed(1) : null
  const converged = convergenceSpreadPct != null && convergenceSpreadPct <= 5
  if (!converged && convergenceSpreadPct != null) {
    notes.push(
      `The methods land ${convergenceSpreadPct}% apart, wider than the 5% convergence tolerance. Method 3 (the adjusted-comp reconciliation) governs the recommendation because it carries both the time and size corrections. Confidence is reduced accordingly.`,
    )
  }

  let recommended = round5000(method3)
  let conservative = round5000(Math.min(method1Low, cMin))
  let highEnd = round5000(Math.min(Math.max(method1High, cMax), recommended * 1.08))

  // Market-verdict check on the ceiling (skill step 9): a buyer's market does
  // not support an aggressive High End.
  if (market?.marketVerdict === 'buyer' && highEnd > recommended * 1.04) {
    highEnd = round5000(recommended * 1.04)
    notes.push(
      `${market.geoLabel} is carrying ${market.monthsOfSupply} months of supply (buyer's market), so the High End tier is pulled in to 4% above the recommended list.`,
    )
  }

  // Broker override re-anchors the tier grid proportionally.
  const priceOverride = opts.priceOverride ?? null
  if (priceOverride != null && priceOverride > 0 && recommended > 0) {
    const ratio = priceOverride / recommended
    recommended = round5000(priceOverride)
    conservative = round5000(conservative * ratio)
    highEnd = round5000(highEnd * ratio)
    notes.push(
      'The recommended list price reflects a broker adjustment applied on review. The underlying data-derived reconciliation is preserved in the verification trace.',
    )
  }

  if (conservative > recommended) conservative = recommended
  if (highEnd < recommended) highEnd = recommended

  // Confidence per skill step 9: comp count, dispersion, recency, convergence.
  const medianCompAgeMonths = median(adjusted.map((c) => c.monthsSinceClose))

  // Comparable-heterogeneity guard. The tiers below weigh count, recency and
  // method convergence, but a set can converge on the math while mixing
  // genuinely different homes ($218 vs $414 /sqft). Measure the spread of the
  // adjusted $/sqft directly — a wide spread means the "comps" are not one
  // market and the recommendation needs broker judgment.
  const ppsfVals = adjusted.map((c) => c.ppsfTimeAdjusted).filter((v) => v > 0)
  const ppsfMean = ppsfVals.reduce((a, b) => a + b, 0) / (ppsfVals.length || 1)
  const ppsfSd = Math.sqrt(
    ppsfVals.reduce((a, b) => a + (b - ppsfMean) ** 2, 0) / (ppsfVals.length || 1),
  )
  const compPpsfCv = ppsfMean > 0 ? +(ppsfSd / ppsfMean).toFixed(3) : 0
  const highDispersion = compPpsfCv > DISPERSION_CV_LIMIT

  let confidence: CmaPricing['confidence'] = 'High'
  const reasons: string[] = []
  if (adjusted.length < 5) {
    confidence = 'Moderate'
    reasons.push(`${adjusted.length} comps (5+ preferred)`)
  }
  if (medianCompAgeMonths > 9) {
    confidence = 'Moderate'
    reasons.push(`median comp age ${medianCompAgeMonths.toFixed(0)} months`)
  }
  if (!converged) {
    confidence = confidence === 'Moderate' ? 'Supportable' : 'Moderate'
    reasons.push(`method spread ${convergenceSpreadPct}%`)
  }
  if (adjusted.length < 4) {
    confidence = 'Supportable'
    reasons.push('thin comp set')
  }

  // The dispersion guard: floor confidence and flag for broker review.
  let needsReview = false
  let reviewReason: string | null = null
  if (highDispersion) {
    confidence = 'Supportable'
    needsReview = true
    const lo = Math.round(Math.min(...ppsfVals))
    const hi = Math.round(Math.max(...ppsfVals))
    reviewReason = `Comparable sales span a wide price-per-square-foot range ($${lo} to $${hi}/sqft, ${Math.round(
      compPpsfCv * 100,
    )}% variation). The set mixes different quality or location tiers, so a broker should confirm the comp selection before this goes to a client.`
    reasons.push(`wide comp dispersion (${Math.round(compPpsfCv * 100)}%)`)
    notes.push(reviewReason)
  }

  const confidenceReason =
    reasons.length > 0
      ? `Capped by ${reasons.join(', ')}.`
      : `${adjusted.length} closed comps, methods within ${convergenceSpreadPct ?? 0}%, median comp age ${medianCompAgeMonths.toFixed(0)} months.`

  return {
    method1Low,
    method1Mid,
    method1High,
    method2,
    method3,
    convergenceSpreadPct,
    converged,
    conservative,
    recommended,
    highEnd,
    valueLow: conservative,
    valueHigh: highEnd,
    confidence,
    confidenceReason,
    needsReview,
    reviewReason,
    compPpsfCv,
    priceOverride,
    improvementsValueAdd,
    notes,
  }
}
