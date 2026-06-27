// brand-voice:exempt — factual market Q&A generated from verified live data, no marketing prose
import type { StatValue } from '@/lib/site/json-ld'
import { marketVerdict } from '@/lib/market/classify'
import { formatPrice } from '@/lib/format/money'

/**
 * Structural input — a full MarketPulse satisfies this, and a geo page can also
 * pass a verified fallback (e.g. a resort community's activeCount + medianPrice,
 * the same numbers the page lede already displays) when no pulse row exists.
 * Every field is optional + null-guarded so partial inputs are safe.
 *
 * Extended fields (all optional) enable community pages to add up to 4 extra
 * grounded questions beyond the 4 core market stats. Every field is §0-strict:
 * if the value is null/undefined, no question is emitted. Nothing is fabricated.
 */
export type MarketFaqInput = {
  activeCount?: number | null
  medianListPrice?: number | null
  monthsOfSupply?: number | null
  medianDaysToPending?: number | null
  refreshedAt?: string | null
  /** Median days on market from market_stats_cache (rolling 365d). Emits a DOM question
   *  when medianDaysToPending is null (community has no pulse row). If both are present,
   *  only medianDaysToPending is used so we don't show two nearly-identical questions. */
  medianDaysOnMarket?: number | null
  /** Homes sold in the last 12 months (market_stats_cache soldCount). */
  soldCount12mo?: number | null
  /** The alias subdivision names that make up this community (registry).
   *  Emits a "what areas/subdivisions" question when there are 2+ aliases. */
  subdivisionAliases?: string[] | null
  /** Annual HOA estimate for THIS community (top-level registry hoa_annual_estimate)
   *  OR the lowest sub-neighborhood estimate (sub_neighborhoods[*].hoa_annual_estimate).
   *  Only emit when the figure is a direct registry value — never estimated. */
  hoaAnnualEstimate?: number | null
}

/**
 * Market Q&A + dataset variables for a geography, generated from the SAME
 * verified MarketPulse the page renders. One source feeds three surfaces:
 *
 *   1. the visible FAQ section (direct-answer content — the first-30% citation lever)
 *   2. the FAQPage JSON-LD (proven +340% AI citation vs plain text)
 *   3. the Dataset JSON-LD variableMeasured (structured numeric claims)
 *
 * Because all three come from one function, the visible text and the markup
 * can never diverge — the single biggest cause of AI/Google discarding schema.
 *
 * Data accuracy (CLAUDE.md §0): every figure is null-guarded. A statistic that
 * is null or non-positive produces NO question, NO dataset variable, and NO
 * sentence. Numbers are never invented, estimated, or rounded in a way that
 * changes the narrative. Months-of-supply classification uses the canonical
 * thresholds: <= 4 seller's, 4 to 6 balanced, >= 6 buyer's.
 */

export type MarketFaqItem = { question: string; answer: string }

export type MarketFaqResult = {
  faqs: MarketFaqItem[]
  datasetVariables: StatValue[]
  /** ISO date (YYYY-MM-DD) the underlying data was refreshed, or null. */
  asOfIso: string | null
  /** Human label e.g. "May 2026", or null when no refresh timestamp. */
  asOfLabel: string | null
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function resolveAsOf(refreshedAt: string | null | undefined): { iso: string | null; label: string | null } {
  if (!refreshedAt) return { iso: null, label: null }
  const d = new Date(refreshedAt)
  if (Number.isNaN(d.getTime())) return { iso: null, label: null }
  return {
    iso: d.toISOString().slice(0, 10),
    label: `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
  }
}

/** Months-of-supply -> market type, per the canonical CLAUDE.md thresholds. */
function marketType(mos: number): string {
  // Thresholds via lib/market/classify.ts (audit p0.4b); short form for FAQ prose.
  const SHORT = { sellers: "seller's", balanced: 'balanced', buyers: "buyer's", unknown: 'balanced' } as const
  return SHORT[marketVerdict(mos).kind]
}

export function buildMarketFaq(geoName: string, pulse: MarketFaqInput | null): MarketFaqResult {
  const faqs: MarketFaqItem[] = []
  const datasetVariables: StatValue[] = []
  const { iso, label } = resolveAsOf(pulse?.refreshedAt)
  const asOf = label ? ` as of ${label}` : ''

  if (!pulse) return { faqs, datasetVariables, asOfIso: iso, asOfLabel: label }

  // ── Core market stats (up to 4 questions) ──────────────────────────────────

  if (pulse.medianListPrice != null && pulse.medianListPrice > 0) {
    faqs.push({
      question: `What is the median home price in ${geoName}?`,
      answer: `The median list price for a single-family home in ${geoName} is ${formatPrice(pulse.medianListPrice)}${asOf}, based on live MLS data.`,
    })
    datasetVariables.push({ name: 'Median List Price', value: Math.round(pulse.medianListPrice), unitText: 'USD' })
  }

  if (pulse.activeCount != null && pulse.activeCount > 0) {
    faqs.push({
      question: `How many homes are for sale in ${geoName}?`,
      answer: `There are ${pulse.activeCount} active single-family listings in ${geoName}${asOf}.`,
    })
    datasetVariables.push({ name: 'Active Listings', value: pulse.activeCount })
  }

  if (pulse.monthsOfSupply != null && pulse.monthsOfSupply > 0) {
    const mos = Math.round(pulse.monthsOfSupply * 10) / 10
    faqs.push({
      question: `Is ${geoName} a buyer's or seller's market?`,
      answer: `${geoName} has ${mos} months of supply, which is a ${marketType(mos)} market. A balanced market runs 4 to 6 months. Under 4 months favors sellers, and 6 or more favors buyers.`,
    })
    datasetVariables.push({ name: 'Months of Supply', value: mos })
  }

  // Days question: prefer medianDaysToPending (pulse, days-to-pending) over
  // medianDaysOnMarket (stats cache, days-on-market). Only emit one so the FAQ
  // does not show two nearly-identical time-to-sell questions. (§0)
  if (pulse.medianDaysToPending != null && pulse.medianDaysToPending > 0) {
    faqs.push({
      question: `How long do homes take to sell in ${geoName}?`,
      answer: `Single-family homes in ${geoName} took a median of ${pulse.medianDaysToPending} days to go pending${asOf}.`,
    })
    datasetVariables.push({ name: 'Median Days to Pending', value: pulse.medianDaysToPending, unitText: 'days' })
  } else if (pulse.medianDaysOnMarket != null && pulse.medianDaysOnMarket > 0) {
    faqs.push({
      question: `How long do homes stay on the market in ${geoName}?`,
      answer: `Single-family homes in ${geoName} had a median of ${pulse.medianDaysOnMarket} days on market over the past 12 months${asOf}.`,
    })
    datasetVariables.push({ name: 'Median Days on Market', value: pulse.medianDaysOnMarket, unitText: 'days' })
  }

  // ── Extended community-specific questions (§0: only when data exists) ───────

  // Homes sold in the past 12 months — answered from market_stats_cache soldCount.
  if (pulse.soldCount12mo != null && pulse.soldCount12mo > 0) {
    faqs.push({
      question: `How many homes sold in ${geoName} in the last year?`,
      answer: `${pulse.soldCount12mo} single-family homes sold in ${geoName} over the past 12 months${asOf}.`,
    })
    datasetVariables.push({ name: 'Homes Sold (12 months)', value: pulse.soldCount12mo })
  }

  // Subdivisions / areas that make up this community — answered from the registry.
  // Only emit when there are 2+ distinct aliases (a single-alias community has
  // nothing interesting to list). Cap display at 6 so the answer stays readable.
  const aliases = (pulse.subdivisionAliases ?? []).filter(Boolean)
  if (aliases.length >= 2) {
    const display = aliases.slice(0, 6)
    const more = aliases.length > 6 ? ` and ${aliases.length - 6} more` : ''
    faqs.push({
      question: `What neighborhoods and subdivisions are in ${geoName}?`,
      answer: `${geoName} includes ${display.join(', ')}${more}. Homes across these subdivisions are marketed under the ${geoName} community umbrella on the MLS.`,
    })
  }

  // HOA estimate — only from direct registry data, never fabricated.
  if (pulse.hoaAnnualEstimate != null && pulse.hoaAnnualEstimate > 0) {
    faqs.push({
      question: `Does ${geoName} have an HOA?`,
      answer: `Yes. Estimated annual HOA fees in ${geoName} start around $${pulse.hoaAnnualEstimate.toLocaleString('en-US')}. Exact fees vary by lot, phase, and membership level. Verify current amounts with the HOA before any purchase.`,
    })
  }

  return { faqs, datasetVariables, asOfIso: iso, asOfLabel: label }
}
