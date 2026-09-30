/**
 * market-report-format — the pure display formatters for the market-report
 * email.
 *
 * Split out of market-report-email.ts (2026-07-29) so the renderer stays under
 * its size budget and the formatting rules live in one place with no imports
 * beyond a type. Every function here is pure and total.
 *
 * A MISSING VALUE IS NULL, NEVER A PLACEHOLDER (Matt 2026-09-29). These used to
 * return an em dash for an unavailable figure, so a neighborhood report printed
 * "Months of supply —" on every send (neighborhood months of supply is always
 * withheld) and the em dash reached a client's inbox, which Matt's 2026-09-20
 * no-em-dash lock forbids. Now a formatter returns null for a value it cannot
 * print, the type forces the caller to decide, and the renderer drops the row.
 * A figure that cannot be shown is left out, not filled (CLAUDE.md §0 rule 7).
 *
 * Brand-voice rules encoded here (CLAUDE.md §2): currency rounded to the
 * nearest thousand, days as an integer plus "days", percents at one decimal
 * with a signed arrow, sentence-case verdict phrases, no em dash anywhere.
 *
 * market-report-email.ts re-exports the public names, so existing importers
 * (app/actions/generate-market-report.ts, the test suite) keep working against
 * '@/lib/crm/market-report-email'.
 */

import type { MoSVerdict } from '@/lib/data/types/market'

function usable(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value)
}

/** Round to the nearest thousand and format as $XXX,000. Null when unavailable. */
export function formatCurrencyRounded(value: number | null | undefined): string | null {
  if (!usable(value)) return null
  const rounded = Math.round(value / 1000) * 1000
  return '$' + rounded.toLocaleString('en-US')
}

/** Integer + " days" (e.g. "38 days"). Null when unavailable. */
export function formatDays(value: number | null | undefined): string | null {
  if (!usable(value)) return null
  const n = Math.round(value)
  return `${n} ${n === 1 ? 'day' : 'days'}`
}

/** One-decimal signed-arrow YoY: "↑ 2.1% YoY" / "↓ 1.4% YoY" / "flat YoY". Null when unavailable. */
export function formatYoy(value: number | null | undefined): string | null {
  if (!usable(value)) return null
  const rounded = Math.round(value * 10) / 10
  if (rounded === 0) return 'flat YoY'
  const arrow = rounded > 0 ? '↑' : '↓'
  return `${arrow} ${Math.abs(rounded).toFixed(1)}% YoY`
}

/**
 * The same year-over-year move in words a seller reads without jargon:
 * "↑ 2.1% from a year ago", "flat from a year ago". Null when unavailable.
 */
export function formatYoyPlain(value: number | null | undefined): string | null {
  if (!usable(value)) return null
  const rounded = Math.round(value * 10) / 10
  if (rounded === 0) return 'flat from a year ago'
  const arrow = rounded > 0 ? '↑' : '↓'
  return `${arrow} ${Math.abs(rounded).toFixed(1)}% from a year ago`
}

/** One-decimal signed-arrow month change: "↑ 2.2% vs May" / "flat vs May". Null when unavailable. */
export function formatMomPct(value: number | null | undefined, prevMonth: string | null): string | null {
  if (!usable(value) || !prevMonth) return null
  const rounded = Math.round(value * 10) / 10
  if (rounded === 0) return `flat vs ${prevMonth}`
  const arrow = rounded > 0 ? '↑' : '↓'
  return `${arrow} ${Math.abs(rounded).toFixed(1)}% vs ${prevMonth}`
}

/** Months of supply + " months". One decimal, except within the narrow bands
 *  around the 4.0 / 6.0 verdict thresholds, where a second decimal is shown so
 *  the printed number can never appear to contradict the verdict pill (a true
 *  4.04 shows "4.04 months" next to "balanced market", not "4.0 months").
 *  Null when unavailable. */
export function formatMonths(value: number | null | undefined): string | null {
  if (!usable(value)) return null
  // INCLUSIVE band edges: a true 4.05 classifies balanced (4.05 > 4) but
  // (4.05).toFixed(1) floating-point-rounds DOWN to "4.0" — printing
  // "Balanced market · 4.0 months" is the exact verdict-vs-number
  // contradiction §0 rule 5 bans. Bend hit this live on 2026-07-16.
  const nearThreshold = (value >= 3.95 && value <= 4.05) || (value >= 5.95 && value <= 6.05)
  return `${value.toFixed(nearThreshold ? 2 : 1)} months`
}

/** Plain-language verdict phrase (sentence case, no hype). Null when unknown. */
export function verdictLabel(verdict: MoSVerdict | null | undefined): string | null {
  switch (verdict) {
    case 'sellers':
      return "Seller's market"
    case 'balanced':
      return 'Balanced market'
    case 'buyers':
      return "Buyer's market"
    default:
      return null
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

/** Whole number with comma separators. Null when unavailable. */
export function formatCount(value: number | null | undefined): string | null {
  if (!usable(value)) return null
  return Math.round(value).toLocaleString('en-US')
}
