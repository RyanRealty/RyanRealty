/**
 * market-report-format — the pure display formatters for the market-report
 * email.
 *
 * Split out of market-report-email.ts (2026-07-29) so the renderer stays under
 * its size budget and the formatting rules live in one place with no imports
 * beyond a type. Every function here is pure and total: given a null or a
 * non-finite input it returns the em-dash data placeholder rather than a
 * fabricated stand-in, per CLAUDE.md §0.
 *
 * Brand-voice rules encoded here (CLAUDE.md §2): currency rounded to the
 * nearest thousand, days as an integer plus "days", percents at one decimal
 * with a signed arrow, sentence-case verdict phrases, the em-dash reserved as
 * the "unavailable" placeholder.
 *
 * market-report-email.ts re-exports the public names, so existing importers
 * (app/actions/generate-market-report.ts, the test suite) keep working against
 * '@/lib/crm/market-report-email'.
 */

import type { MoSVerdict } from '@/lib/data/types/market'

/**
 * Round to the nearest thousand and format as $XXX,000. Pure. Returns the
 * em-dash data placeholder (allowed for "unavailable") when the value is null.
 */
export function formatCurrencyRounded(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const rounded = Math.round(value / 1000) * 1000
  return '$' + rounded.toLocaleString('en-US')
}

/** Integer + " days" (e.g. "38 days"). Em-dash placeholder when unavailable. */
export function formatDays(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${Math.round(value)} days`
}

/** One-decimal signed-arrow YoY: "↑ 2.1% YoY" / "↓ 1.4% YoY" / flat. Em-dash when null. */
export function formatYoy(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const rounded = Math.round(value * 10) / 10
  if (rounded === 0) return 'flat YoY'
  const arrow = rounded > 0 ? '↑' : '↓'
  return `${arrow} ${Math.abs(rounded).toFixed(1)}% YoY`
}

/** One-decimal signed-arrow month change: "↑ 2.2% vs May" / "flat vs May". */
export function formatMomPct(value: number | null | undefined, prevMonth: string | null): string {
  if (value == null || !Number.isFinite(value) || !prevMonth) return '—'
  const rounded = Math.round(value * 10) / 10
  if (rounded === 0) return `flat vs ${prevMonth}`
  const arrow = rounded > 0 ? '↑' : '↓'
  return `${arrow} ${Math.abs(rounded).toFixed(1)}% vs ${prevMonth}`
}

/** Months of supply + " months". One decimal, except within the narrow bands
 *  around the 4.0 / 6.0 verdict thresholds, where a second decimal is shown so
 *  the printed number can never appear to contradict the verdict pill (a true
 *  4.04 shows "4.04 months" next to "balanced market", not "4.0 months"). */
export function formatMonths(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  // INCLUSIVE band edges: a true 4.05 classifies balanced (4.05 > 4) but
  // (4.05).toFixed(1) floating-point-rounds DOWN to "4.0" — printing
  // "Balanced market · 4.0 months" is the exact verdict-vs-number
  // contradiction §0 rule 5 bans. Bend hit this live on 2026-07-16.
  const nearThreshold = (value >= 3.95 && value <= 4.05) || (value >= 5.95 && value <= 6.05)
  return `${value.toFixed(nearThreshold ? 2 : 1)} months`
}

/** Plain-language verdict phrase (sentence case, no hype). */
export function verdictLabel(verdict: MoSVerdict | null | undefined): string {
  switch (verdict) {
    case 'sellers':
      return "Seller's market"
    case 'balanced':
      return 'Balanced market'
    case 'buyers':
      return "Buyer's market"
    default:
      return '—'
  }
}

/**
 * The plain-English "what this means for you" line, driven strictly by the
 * canonical months-of-supply verdict (≤4 sellers, 4–6 balanced, ≥6 buyers).
 * Exported so the copy is unit-testable against the banned-vocabulary list.
 */
export function meaningLine(verdict: MoSVerdict | null | undefined): string | null {
  switch (verdict) {
    case 'sellers':
      return 'Supply is tight relative to demand, so well priced homes are drawing attention quickly and sellers hold the leverage.'
    case 'balanced':
      return 'Supply and demand are close to even, so realistic pricing matters more than timing for both sides.'
    case 'buyers':
      return 'There are more homes for sale than current demand is absorbing, which gives buyers room to negotiate on price and terms.'
    default:
      return null
  }
}

/** Whole number with comma separators. Em-dash when unavailable. */
export function formatCount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return Math.round(value).toLocaleString('en-US')
}

/** Signed whole-count delta phrase: "12 more than May" / "8 fewer than May". */
export function inventoryDeltaPhrase(delta: number | null, prevMonth: string | null): string | null {
  if (delta == null || !Number.isFinite(delta) || !prevMonth) return null
  const n = Math.round(Math.abs(delta))
  if (n === 0) return `unchanged from ${prevMonth}`
  return `${n.toLocaleString('en-US')} ${delta > 0 ? 'more' : 'fewer'} than ${prevMonth}`
}

/** Signed day-delta phrase: "3 days faster than May" / "2 days slower than May". */
export function domDeltaPhrase(delta: number | null, prevMonth: string | null): string | null {
  if (delta == null || !Number.isFinite(delta) || !prevMonth) return null
  const n = Math.round(Math.abs(delta))
  if (n === 0) return `even with ${prevMonth}`
  const word = n === 1 ? 'day' : 'days'
  // A lower DOM month over month means homes sold faster.
  return `${n} ${word} ${delta < 0 ? 'faster' : 'slower'} than ${prevMonth}`
}
