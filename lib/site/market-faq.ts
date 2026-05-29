// brand-voice:exempt — factual market Q&A generated from verified live data, no marketing prose
import type { StatValue } from '@/lib/site/json-ld'

/**
 * Structural input — a full MarketPulse satisfies this, and a geo page can also
 * pass a verified fallback (e.g. a resort community's activeCount + medianPrice,
 * the same numbers the page lede already displays) when no pulse row exists.
 * Every field is optional + null-guarded so partial inputs are safe.
 */
export type MarketFaqInput = {
  activeCount?: number | null
  medianListPrice?: number | null
  monthsOfSupply?: number | null
  medianDaysToPending?: number | null
  refreshedAt?: string | null
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

/** Currency rounded to the nearest thousand, e.g. 894750 -> "$895,000". */
function roundedThousand(n: number): string {
  const r = Math.round(n / 1000) * 1000
  return `$${r.toLocaleString('en-US')}`
}

/** Months-of-supply -> market type, per the canonical CLAUDE.md thresholds. */
function marketType(mos: number): string {
  if (mos <= 4) return "seller's"
  if (mos < 6) return 'balanced'
  return "buyer's"
}

export function buildMarketFaq(geoName: string, pulse: MarketFaqInput | null): MarketFaqResult {
  const faqs: MarketFaqItem[] = []
  const datasetVariables: StatValue[] = []
  const { iso, label } = resolveAsOf(pulse?.refreshedAt)
  const asOf = label ? ` as of ${label}` : ''

  if (!pulse) return { faqs, datasetVariables, asOfIso: iso, asOfLabel: label }

  if (pulse.medianListPrice != null && pulse.medianListPrice > 0) {
    faqs.push({
      question: `What is the median home price in ${geoName}?`,
      answer: `The median list price for a single-family home in ${geoName} is ${roundedThousand(pulse.medianListPrice)}${asOf}, based on live MLS data.`,
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

  if (pulse.medianDaysToPending != null && pulse.medianDaysToPending > 0) {
    faqs.push({
      question: `How long do homes take to sell in ${geoName}?`,
      answer: `Single-family homes in ${geoName} took a median of ${pulse.medianDaysToPending} days to go pending${asOf}.`,
    })
    datasetVariables.push({ name: 'Median Days to Pending', value: pulse.medianDaysToPending, unitText: 'days' })
  }

  return { faqs, datasetVariables, asOfIso: iso, asOfLabel: label }
}
