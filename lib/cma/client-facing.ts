/**
 * Client-document hygiene for CMA print HTML and the immersive /cma/[slug]
 * view. Admin traces, audit findings, and model names stay on the row.
 * This module is the only place a seller-facing string is assembled from
 * those facts.
 */

import { formatMlsMultiSelect } from '@/lib/data/listings/mls-multiselect'
import { formatPriceExact } from '@/lib/format/money'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { formatDate } from '@/lib/format/date'
import { cleanText } from '@/lib/cma/render-blocks'
import type {
  CmaAdjustedComp,
  CmaCompKeepTier,
  CmaMarketContext,
  CmaPricing,
  CmaSubject,
} from '@/lib/cma/types'
import type { CmaEquityPosition } from '@/lib/cma/equity'
import type { ExpiredAuditData } from '@/lib/cma/expired-audit'


const usd = formatPriceExact

/**
 * The only seller-facing price sentence. List band and recommended list.
 * Expected close stays off the seller document unless a caller opts in
 * (admin / evidence board only).
 */
export function listPriceLead(
  p: CmaPricing,
  opts?: { perSqft?: string | null; includeExpectedClose?: boolean },
): string {
  const rec =
    opts?.perSqft != null && opts.perSqft
      ? `${usd(p.recommended)} (${opts.perSqft} per square foot)`
      : usd(p.recommended)
  const close =
    opts?.includeExpectedClose === true && p.predictedClose != null && p.predictedClose > 0
      ? ` Expected close ${usd(p.predictedClose)}.`
      : ''
  return `List ${usd(p.conservative)} to ${usd(p.highEnd)}. Recommended list ${rec}.${close}`
}

/** Pipeline / admin language that must never reach a seller page. */
const CLIENT_INTERNAL_LEAK =
  /adversarial|listing\s*key|supabase|claude-|sonnet-|opus-|gpt-4|needs_review|needs review|broker-selected|broker selected|accuracy audit|accuracy contract|comparability model|anthropic|build_summary|market_stats_cache|market_pulse_live|analytics_mart|verification trace|geo_slug|geo_type|methodology_version|rolling_365d/i

export function isClientInternalLeak(text: string | null | undefined): boolean {
  return Boolean(text && CLIENT_INTERNAL_LEAK.test(text))
}

/**
 * MLS view / amenity / flag field → human labels, or null.
 * JSON objects become the truthy keys. Placeholder sentinels disappear.
 */
export function formatClientMlsField(v: string | null | undefined): string | null {
  return cleanText(formatMlsMultiSelect(v))
}

/** Place line for a cover or flyer. Missing subdivision is omitted, never N/A. */
export function clientPlaceClause(
  subdivision: string | null | undefined,
  city?: string | null,
): string | null {
  return cleanText(subdivision) ?? cleanText(city)
}

export function clientFacingNotes(notes: readonly string[], pricing: CmaPricing): string[] {
  return notes
    .map((n) => n.trim())
    .filter(Boolean)
    .filter((n) => !isClientInternalLeak(n))
    .filter((n) => !/broker should confirm|verification trace|wide price-per-square-foot range/i.test(n))
    .filter((n) => {
      if (/method 3.*governs the recommendation/i.test(n) && pricing.recommended !== pricing.method3) {
        return false
      }
      if (/pricing-engine list|pricing engine/i.test(n)) {
        return false
      }
      if (/conservative tier|quick-sale|method\s*[123]\b/i.test(n)) {
        return false
      }
      if (/time adjustment follows|close estimate is|comparable review:|list band is \$/i.test(n)) {
        return false
      }
      return true
    })
}

/** Replace a leaked source string with a seller-safe line. */
export function clientSourceLine(raw: string | null | undefined, fallback: string): string {
  const t = (raw ?? '').trim()
  if (!t || isClientInternalLeak(t)) return fallback
  return t
}

export type WhyBullet = { label: string; text: string }

export type WhyThisListPrice = {
  heading: string
  coverSentence: string
  bullets: WhyBullet[]
  market: string | null
  ownership: string | null
  strategy: string | null
}

function saleToListPct(ratio: number | null | undefined): string | null {
  if (ratio == null || !Number.isFinite(ratio) || ratio <= 0) return null
  const pct = ratio <= 2 ? ratio * 100 : ratio
  return pct.toFixed(1)
}

function failedAskOnRow(input: {
  subject: CmaSubject
  pricing: CmaPricing
  expiredAudit?: ExpiredAuditData | null
}): number | null {
  const ask = input.subject.lastListPrice
  if (ask == null || !Number.isFinite(ask) || ask <= 0) return null
  const reason = input.pricing.reviewReason ?? ''
  const notes = input.pricing.notes.join(' ')
  if (/asking that just failed/i.test(reason) || /your last listing asked/i.test(notes)) return ask
  if (input.expiredAudit && input.pricing.recommended < ask) return ask
  return null
}

function pickComps(comps: readonly CmaAdjustedComp[]): {
  ceiling: CmaAdjustedComp | null
  floor: CmaAdjustedComp | null
  best: CmaAdjustedComp | null
} {
  if (comps.length === 0) return { ceiling: null, floor: null, best: null }
  const byAdj = [...comps].sort((a, b) => a.adjustedPrice - b.adjustedPrice)
  const floor = byAdj[0] ?? null
  const ceiling = byAdj[byAdj.length - 1] ?? null
  const best = [...comps].sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight
    return Math.abs(a.sizeAdjustment) - Math.abs(b.sizeAdjustment)
  })[0] ?? null
  return { ceiling, floor, best }
}

function coverSentence(input: { pricing: CmaPricing }): string {
  return listPriceLead(input.pricing)
}

function strategyLine(input: {
  pricing: CmaPricing
  failedAsk: number | null
}): string | null {
  const p = input.pricing
  if (input.failedAsk != null && p.recommended < input.failedAsk) {
    return `Your last listing asked ${usd(input.failedAsk)} and did not sell. This list stays under that ask.`
  }
  if (p.priceOverride != null && p.priceOverride > 0 && p.recommended > p.method3) {
    return `The adjusted sales land at ${usd(p.method3)}. The recommended list is ${usd(p.recommended)}.`
  }
  if (p.priceOverride != null && p.priceOverride > 0 && p.recommended < p.method3) {
    return `The adjusted sales land at ${usd(p.method3)}. The recommended list is ${usd(p.recommended)}.`
  }
  return null
}

function marketLine(market: CmaMarketContext | null): string | null {
  if (!market) return null
  const bits: string[] = []
  const stl = saleToListPct(market.saleToListRatio)
  if (stl) bits.push(`${market.geoLabel} sales have been closing at ${stl}% of list.`)
  if (market.monthsOfSupply != null && Number.isFinite(market.monthsOfSupply)) {
    bits.push(`${market.geoLabel} is carrying ${formatMonthsOfSupply(market.monthsOfSupply)} months of supply.`)
  }
  return bits.length ? bits.join(' ') : null
}

function ownershipLine(equity: CmaEquityPosition | null | undefined): string | null {
  if (!equity) return null
  const when = formatDate(equity.purchaseDate, { month: 'long', day: undefined, year: 'numeric' })
  if (!when || when === '—') return `You bought this home at ${usd(equity.purchasePrice)}.`
  return `You bought this home in ${when} at ${usd(equity.purchasePrice)}.`
}

/**
 * "Why this list price" from facts already on the row. No invented comps,
 * no invented market, no silent gap when an override sits above Method 3.
 */
export function whyThisListPrice(input: {
  subject: CmaSubject
  comps: readonly CmaAdjustedComp[]
  market: CmaMarketContext | null
  pricing: CmaPricing
  equity?: CmaEquityPosition | null
  expiredAudit?: ExpiredAuditData | null
}): WhyThisListPrice {
  const failedAsk = failedAskOnRow(input)
  const { ceiling, floor, best } = pickComps(input.comps)
  const bullets: WhyBullet[] = []
  if (ceiling && floor && ceiling !== floor) {
    bullets.push({
      label: ceiling.address,
      text: `Sold at ${usd(ceiling.closePrice)}. Adjusted close ${usd(ceiling.adjustedPrice)}. Highest in this set.`,
    })
    if (best && best !== ceiling && best !== floor) {
      bullets.push({
        label: best.address,
        text: `Adjusted close ${usd(best.adjustedPrice)}.`,
      })
    }
    bullets.push({
      label: floor.address,
      text: `Sold at ${usd(floor.closePrice)}. Adjusted close ${usd(floor.adjustedPrice)}. Lowest in this set.`,
    })
  } else if (best) {
    bullets.push({
      label: best.address,
      text: `Sold at ${usd(best.closePrice)}. Adjusted close ${usd(best.adjustedPrice)}.`,
    })
  }

  return {
    heading: `Why ${usd(input.pricing.recommended)}`,
    coverSentence: coverSentence({ pricing: input.pricing }),
    bullets,
    market: marketLine(input.market),
    ownership: ownershipLine(input.equity),
    strategy: strategyLine({ pricing: input.pricing, failedAsk }),
  }
}

export function applyCompVerdicts(
  comps: readonly CmaAdjustedComp[],
  verdicts: readonly { listingKey?: string; tier?: string; reason?: string }[],
): CmaAdjustedComp[] {
  const byKey = new Map<string, { tier: CmaCompKeepTier; reason: string }>()
  for (const v of verdicts) {
    if (!v.listingKey || (v.tier !== 'strong' && v.tier !== 'weak')) continue
    byKey.set(v.listingKey, { tier: v.tier, reason: (v.reason ?? '').trim() })
  }
  return comps.map((c) => {
    const hit = byKey.get(c.listingKey)
    if (!hit) return { ...c }
    return { ...c, keepTier: hit.tier, keepReason: hit.reason }
  })
}

export function verdictsFromBuildSummary(summary: unknown): Array<{
  listingKey: string
  tier: string
  reason: string
}> {
  if (!summary || typeof summary !== 'object') return []
  const judgment = (summary as Record<string, unknown>).judgment
  if (!judgment || typeof judgment !== 'object') return []
  const raw = (judgment as Record<string, unknown>).verdicts
  if (!Array.isArray(raw)) return []
  return raw
    .map((row) => {
      if (!row || typeof row !== 'object') return null
      const v = row as Record<string, unknown>
      const listingKey = typeof v.listingKey === 'string' ? v.listingKey : ''
      const tier = typeof v.tier === 'string' ? v.tier : ''
      const reason = typeof v.reason === 'string' ? v.reason : ''
      if (!listingKey) return null
      return { listingKey, tier, reason }
    })
    .filter((v): v is { listingKey: string; tier: string; reason: string } => v != null)
}

function clientKeepReason(raw: string | null | undefined): string | null {
  const t = cleanText(raw)
  if (!t || isClientInternalLeak(t)) return null
  if (/\bListingKey\b|[0-9]{20,}/i.test(t)) return null
  return t.replace(/\s+/g, ' ').trim()
}

/** One sentence: strong/weak + judge reason, or a fact fallback. Never N/A. */
export function whyWeKeptComp(comp: CmaAdjustedComp): {
  tier: CmaCompKeepTier | null
  sentence: string
} {
  const tier = comp.keepTier === 'strong' || comp.keepTier === 'weak' ? comp.keepTier : null
  const reason = clientKeepReason(comp.keepReason)
  if (tier && reason) {
    const label = tier === 'strong' ? 'Strong' : 'Weak'
    const body = /[.!?]$/.test(reason) ? reason : `${reason}.`
    return { tier, sentence: `${label}. ${body}` }
  }
  if (comp.competingArea) {
    return {
      tier,
      sentence: `Kept as a competing-area sale${comp.proximity ? `, ${comp.proximity} from the subject` : ''}.`,
    }
  }
  if (comp.proximity) {
    return { tier, sentence: `Kept as a closed sale ${comp.proximity} from the subject.` }
  }
  return { tier, sentence: 'Kept as a closed sale in this comparable set.' }
}
