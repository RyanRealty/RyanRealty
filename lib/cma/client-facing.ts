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
import type { ListingPlan, ListingPlanItem } from '@/lib/cma/listing-plan'

const usd = formatPriceExact

/** Pipeline / admin language that must never reach a seller page. */
const CLIENT_INTERNAL_LEAK =
  /adversarial|listing\s*key|supabase|claude-|sonnet-|opus-|gpt-4|needs_review|needs review|broker-selected|broker selected|accuracy audit|accuracy contract|comparability model|anthropic|build_summary|market_stats_cache|market_pulse_live|analytics_mart|verification trace|geo_slug|geo_type|methodology_version|rolling_365d|propertytype\s*=|pulled at build time|closedate\s*[≥>=]|listings where |standardstatus|days_to_pending|listprice \d+\.\./i

/** Query / method footnotes that read as SQL, not seller copy. */
const CLIENT_METHOD_SENTENCE =
  /supabase|propertytype\s*=|pulled at build time|closedate\s*[≥>=]|listing\s*key|listings where |standardstatus|days_to_pending|listprice \d+\.\.|\b(?:City|PropertyType|SubdivisionName|StandardStatus|CloseDate|ListPrice|ClosePrice)\s*=|^\s*seasonality \w+ median \d|^\s*price band \d+ active vs/i

export function isClientInternalLeak(text: string | null | undefined): boolean {
  return Boolean(text && CLIENT_INTERNAL_LEAK.test(text))
}

/** Drop query/method sentences. Keep the seller meaning if one remains. */
export function stripClientMethodTrace(text: string | null | undefined): string | null {
  const raw = (text ?? '').trim()
  if (!raw) return null
  const kept = raw
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !isClientInternalLeak(s) && !CLIENT_METHOD_SENTENCE.test(s))
  const out = kept.join(' ').replace(/\s+/g, ' ').trim()
  return out || null
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
    .map((n) => stripClientMethodTrace(n) ?? '')
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
      return true
    })
}

/** Replace a leaked source string with a seller-safe line. */
export function clientSourceLine(raw: string | null | undefined, fallback: string): string {
  const stripped = stripClientMethodTrace(raw)
  if (!stripped || isClientInternalLeak(stripped)) return fallback
  return stripped
}

export function clientFacingPlanItem(item: ListingPlanItem): ListingPlanItem | null {
  const trigger = stripClientMethodTrace(item.trigger)
  const action = stripClientMethodTrace(item.action)
  if (!trigger || !action) return null
  return {
    trigger,
    action,
    basis: stripClientMethodTrace(item.basis) ?? '',
  }
}

/** Render-time plan hygiene so a stored draft cannot leak a query footnote. */
export function clientFacingListingPlan(plan: ListingPlan | null | undefined): ListingPlan | null {
  if (!plan) return null
  const items = plan.items
    .map(clientFacingPlanItem)
    .filter((i): i is ListingPlanItem => i != null)
  if (items.length === 0) return null
  return {
    items,
    source: clientSourceLine(plan.source, 'Figures already computed in this report.'),
  }
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

function coverSentence(input: {
  pricing: CmaPricing
  failedAsk: number | null
  hasBest: boolean
}): string {
  const p = input.pricing
  if (input.failedAsk != null && p.recommended < input.failedAsk) {
    return `Capped under the ${usd(input.failedAsk)} ask that did not sell.`
  }
  if (p.priceOverride != null && p.priceOverride > 0 && p.recommended > p.method3) {
    return `A strategic list above the ${usd(p.method3)} adjusted-sales number, with room to negotiate.`
  }
  if (p.priceOverride != null && p.priceOverride > 0 && p.recommended < p.method3) {
    return `Brought to ${usd(p.recommended)} on review, under the ${usd(p.method3)} adjusted-sales number.`
  }
  if (!p.converged && Math.abs(p.recommended - p.method3) <= 5000) {
    return `The adjusted sales land at ${usd(p.method3)}. That is the number.`
  }
  return input.hasBest
    ? 'The closed sales around this home and the best match land at this number.'
    : 'The closed sales around this home land at this number.'
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
    return `The adjusted sales land at ${usd(p.method3)}. The recommended list is ${usd(p.recommended)}, a strategic list with room to negotiate.`
  }
  if (p.priceOverride != null && p.priceOverride > 0 && p.recommended < p.method3) {
    return `The adjusted sales land at ${usd(p.method3)}. The recommended list is ${usd(p.recommended)} after review.`
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
      text: `Sold at ${usd(ceiling.closePrice)}, adjusts to ${usd(ceiling.adjustedPrice)}. That is the top of this set.`,
    })
    if (best && best !== ceiling && best !== floor) {
      bullets.push({
        label: best.address,
        text: `The closest match. Adjusted to ${usd(best.adjustedPrice)}.`,
      })
    }
    bullets.push({
      label: floor.address,
      text: `Sold at ${usd(floor.closePrice)}, adjusts to ${usd(floor.adjustedPrice)}. That is the floor of this set.`,
    })
  } else if (best) {
    bullets.push({
      label: best.address,
      text: `Sold at ${usd(best.closePrice)}, adjusts to ${usd(best.adjustedPrice)}.`,
    })
  }

  return {
    heading: `Why ${usd(input.pricing.recommended)}`,
    coverSentence: coverSentence({
      pricing: input.pricing,
      failedAsk,
      hasBest: Boolean(best && ceiling && floor && best !== ceiling && best !== floor),
    }),
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
      sentence: `Kept as a competing-area sale${comp.proximity ? `, ${comp.proximity} from the subject` : ''} to bracket the range.`,
    }
  }
  if (comp.proximity) {
    return { tier, sentence: `Kept as a closed sale ${comp.proximity} from the subject.` }
  }
  return { tier, sentence: 'Kept as a closed sale in this comparable set.' }
}
