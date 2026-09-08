/**
 * lib/sticky-ask.ts — the two things V3StickyAsk is NOT allowed to work out
 * for itself: what the verdict tail says, and when the control is on screen.
 *
 * WHY THIS IS NOT IN THE COMPONENT. The barrel's contract (components/site/v3/
 * index.ts) is that no primitive "fetches, formats, rounds, or parses a date" —
 * every figure arrives as a string the caller already formatted, so the number
 * on screen is the number the caller's §0 source trace covers. And G68
 * (ci:market-formula) says no public surface may round or reclassify a
 * months-of-supply value itself: the boundaries live in marketVerdict() and the
 * boundary-safe digits in formatMonthsOfSupply(). Both rules point the same
 * way — the SERVER builds the verdict here, once, and hands the primitive four
 * finished strings.
 *
 * WHY IT IS ONE HELPER AND NOT FOUR CALL SITES. The control mounts on /sell and
 * on three place templates, each owned by a different session. Four callers
 * deriving "3.9 months" from `pulse.monthsOfSupply` is four chances to write
 * `.toFixed(1)` and publish a figure the page's own verdict contradicts — the
 * exact defect G68's check 3 was added for. There is one derivation, it is
 * tested, and it is the only one a caller may use.
 */
import { marketVerdict, type MarketKind } from '@/lib/market/classify'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { formatDate } from '@/lib/format/date'

/**
 * The finished verdict, ready to render. Every field is a STRING the primitive
 * prints as-is; `kind` is the classification for anything that needs to branch.
 */
export type StickyAskVerdict = {
  /** From marketVerdict() — never computed from the number a second time. */
  kind: MarketKind
  /** From marketVerdict() — "seller's market" / "balanced market" / "buyer's market". */
  label: string
  /** From formatMonthsOfSupply() — boundary-safe digits, e.g. "3.9". */
  monthsOfSupply: string
  /** The day the row was refreshed, formatted for display, e.g. "Sep 7". */
  readAt: string
  /**
   * The table or series the figure actually came from, for the §0 trace. The
   * CALLER states it, because the same control is fed from two different reads:
   * a place page hands it a `market_pulse_live` row through getMarketPulse,
   * while /sell hands it Market Truth DETACHED figures off `market_metric`
   * (app/sell/page.tsx never reads the pulse table at all — that is the rule
   * that stops /sell publishing the mixed-type bucket as the detached market).
   * Hardcoding one of them named the wrong table on the other, which shipped:
   * production /sell printed "Source: market_pulse_live" for a `market_metric`
   * figure on 2026-09-08. A source line that names a table the number did not
   * come from is the §0 failure, not a wording nit.
   */
  source: string
}

/**
 * The row shape this reads: a months-of-supply figure and the day it was read.
 * `getMarketPulse` returns one directly; /sell shapes one out of Market Truth
 * with `applyDetachedOverlay`. Either way the caller names its own source.
 */
export type StickyAskPulse = {
  monthsOfSupply: number | null | undefined
  refreshedAt: string | null | undefined
}

/**
 * Build the verdict tail's parts from a pulse row, or null when the row cannot
 * support one. NULL IS A REAL ANSWER (§0): a place with no months-of-supply
 * figure, or a row with no refresh stamp, ships the control with NO tail rather
 * than an invented or stale one. The caller passes the null straight through.
 */
export function stickyAskVerdict(
  pulse: StickyAskPulse | null | undefined,
  source: string,
): StickyAskVerdict | null {
  if (!pulse) return null
  // No source, no trace, no publish (§0): a figure whose origin the caller
  // cannot name does not reach a public surface.
  if (!source.trim()) return null
  const mos = pulse.monthsOfSupply
  if (mos == null || !Number.isFinite(mos)) return null

  const verdict = marketVerdict(mos)
  if (verdict.kind === 'unknown') return null

  // A figure with no read date cannot carry its own trace, so it does not ship.
  // `year: undefined` is deliberate: formatDate's defaults include the year, and
  // a pulse row read this week does not need one on a control this small.
  const readAt = pulse.refreshedAt
    ? formatDate(pulse.refreshedAt, { month: 'short', day: 'numeric', year: undefined })
    : ''
  if (!readAt || readAt === '—') return null

  return {
    kind: verdict.kind,
    label: verdict.label,
    monthsOfSupply: formatMonthsOfSupply(mos),
    readAt,
    source: source.trim(),
  }
}

/**
 * The one line of quiet type beside the ask:
 *   "Bend · seller's market · 3.9 months · as of Sep 7"
 * Assembly only — every part arrived formatted. Returns null with no verdict,
 * and the control then prints the label alone.
 */
export function stickyAskTail(place: string, verdict: StickyAskVerdict | null | undefined): string | null {
  const name = place.trim()
  if (!verdict || !name) return null
  return `${name} · ${verdict.label} · ${verdict.monthsOfSupply} months · as of ${verdict.readAt}`
}

/**
 * The §0 trace the tail carries, as a title attribute and a visually-hidden
 * line: which table the figure came from and when it was read. A figure on a
 * public surface without its source named is the thing §0 forbids, and a
 * control small enough to have no room for a source line is not exempt — it
 * gets one a screen reader and a hover can both reach.
 */
export function stickyAskSourceLine(verdict: StickyAskVerdict | null | undefined): string | null {
  if (!verdict) return null
  return `Source: ${verdict.source}, months of supply ${verdict.monthsOfSupply}, read ${verdict.readAt}.`
}

/** Everything the control knows about whether it belongs on screen. */
export type StickyAskState = {
  /** The sentinel (hero / on-page ask) has scrolled fully above the viewport. */
  passedSentinel: boolean
  /** The ask this control points at is currently in view. */
  targetVisible: boolean
  /** The visitor closed it this session. */
  dismissed: boolean
}

/**
 * THE VISIBILITY RULE, as one testable expression.
 *
 * The chrome already carries a secondary "Value my home" and the page body
 * carries the primary ask (PUBLIC_UI §1: one primary action per VISIBLE set of
 * controls). A control fixed to the viewport is therefore a THIRD ask unless it
 * retires whenever the ask it points at is on screen — which is the middle
 * clause here, and the reason this is a rule and not a scroll threshold.
 */
export function stickyAskShown(state: StickyAskState): boolean {
  return state.passedSentinel && !state.targetVisible && !state.dismissed
}
