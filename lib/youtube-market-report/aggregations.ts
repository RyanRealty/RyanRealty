/**
 * Pure aggregation helpers for YouTube market report data fetching.
 *
 * No Supabase, no I/O, no formatting that requires locale data — this module
 * is a deterministic numeric library so the data integrity gates in
 * skills/youtube-market-reports/query-rules.md can be enforced and tested
 * independently of the network layer.
 *
 * Hard rules encoded here:
 *   - Median is PERCENTILE_CONT(0.5) semantics (linear interpolation between
 *     the two middle values when n is even).
 *   - Months of Supply uses the Template 11 formula:
 *       active / (closed_lookback / lookback_days * 30)
 *     with the SFR filter assumed already applied at query time (UF3).
 *   - Verdict thresholds: <= 4.0 seller, 4.0–6.0 balanced, >= 6.0 buyer.
 *   - YoY % rounded to one decimal for display, but full precision returned.
 */

import type { Direction, MarketCondition } from '../../video/market-report/src/VideoProps';

// ---------------------------------------------------------------------------
// Median + percentile (PERCENTILE_CONT semantics)
// ---------------------------------------------------------------------------

/** Sort numbers ascending, dropping non-finite entries. */
function cleanSort(values: readonly number[]): number[] {
  const sorted: number[] = [];
  for (const v of values) {
    if (Number.isFinite(v)) sorted.push(v);
  }
  sorted.sort((a, b) => a - b);
  return sorted;
}

/**
 * PERCENTILE_CONT(p) — linear interpolation between adjacent values.
 * Matches Postgres's `PERCENTILE_CONT(p) WITHIN GROUP (ORDER BY x)`.
 *
 * @param values Numeric population.
 * @param p      Percentile in [0, 1]. 0.5 = median.
 * @returns NaN when the cleaned array is empty.
 */
export function percentileCont(values: readonly number[], p: number): number {
  if (p < 0 || p > 1 || !Number.isFinite(p)) {
    throw new RangeError(`percentileCont: p must be in [0, 1], got ${p}`);
  }
  const sorted = cleanSort(values);
  const n = sorted.length;
  if (n === 0) return NaN;
  if (n === 1) return sorted[0]!;

  const rank = p * (n - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) return sorted[lower]!;
  const fraction = rank - lower;
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * fraction;
}

/** Convenience wrapper for the median. */
export function median(values: readonly number[]): number {
  return percentileCont(values, 0.5);
}

// ---------------------------------------------------------------------------
// YoY + direction
// ---------------------------------------------------------------------------

/**
 * Year-over-year percent change. Returns a signed number (e.g. -7.3 for a 7.3%
 * drop). Rounded to one decimal place. Returns NaN if `prior` is 0 or non-finite.
 */
export function yoyPct(current: number, prior: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(prior) || prior === 0) return NaN;
  const raw = ((current - prior) / prior) * 100;
  return Math.round(raw * 10) / 10;
}

/** Decide direction token from a signed delta. The dead-band is +/- 0.05. */
export function direction(delta: number): Direction {
  if (!Number.isFinite(delta)) return 'flat';
  if (delta > 0.05) return 'up';
  if (delta < -0.05) return 'down';
  return 'flat';
}

// ---------------------------------------------------------------------------
// Months of Supply (Template 11)
// ---------------------------------------------------------------------------

export interface MonthsOfSupplyResult {
  /** Active SFR inventory at the snapshot. */
  active: number;
  /** Closed SFR sales over the lookback window. */
  closedLookback: number;
  /** Lookback window length in days (default 180). */
  lookbackDays: number;
  /** Closed sales per month over the lookback window. */
  monthlyCloseRate: number;
  /** Months of supply, rounded to two decimals. NaN if the close rate is 0. */
  monthsOfSupply: number;
  /** Verdict pill text — strictly derived from the rounded value. */
  marketCondition: MarketCondition;
}

/**
 * Months of Supply per Template 11. SFR filter must be applied at query time
 * on BOTH the active and closed CTEs (UF3) — this function trusts that.
 *
 * @throws If lookbackDays <= 0.
 */
export function monthsOfSupply(
  active: number,
  closedLookback: number,
  lookbackDays: number,
): MonthsOfSupplyResult {
  if (!Number.isInteger(lookbackDays) || lookbackDays <= 0) {
    throw new RangeError(`monthsOfSupply: lookbackDays must be a positive integer, got ${lookbackDays}`);
  }
  if (!Number.isFinite(active) || active < 0) {
    throw new RangeError(`monthsOfSupply: active must be a finite non-negative number, got ${active}`);
  }
  if (!Number.isFinite(closedLookback) || closedLookback < 0) {
    throw new RangeError(`monthsOfSupply: closedLookback must be a finite non-negative number, got ${closedLookback}`);
  }

  const monthlyRate = (closedLookback / lookbackDays) * 30;
  const mos = monthlyRate === 0 ? Number.NaN : active / monthlyRate;
  const rounded = Number.isNaN(mos) ? Number.NaN : Math.round(mos * 100) / 100;

  return {
    active,
    closedLookback,
    lookbackDays,
    monthlyCloseRate: Math.round(monthlyRate * 100) / 100,
    monthsOfSupply: rounded,
    marketCondition: classifyMarket(rounded),
  };
}

/**
 * Verdict pill thresholds per skills/youtube-market-reports/query-rules.md C3.
 * <= 4.0 seller, 4.0–6.0 balanced, >= 6.0 buyer. NaN -> Balanced fallback.
 */
export function classifyMarket(mos: number): MarketCondition {
  if (!Number.isFinite(mos)) return 'Balanced Market';
  if (mos <= 4.0) return "Seller's Market";
  if (mos < 6.0) return 'Balanced Market';
  return "Buyer's Market";
}

// ---------------------------------------------------------------------------
// Display formatting
// ---------------------------------------------------------------------------

/**
 * Compact currency for on-screen display, e.g. 725000 -> "$725K", 1075000 ->
 * "$1.075M". Below $10K returns "—" since UF1 forbids those values from
 * reaching display layers anyway.
 */
export function formatPriceCompact(n: number): string {
  if (!Number.isFinite(n) || n < 10000) return '—';
  if (n >= 1_000_000) {
    const millions = n / 1_000_000;
    const rounded = Math.round(millions * 1000) / 1000;
    return `$${stripTrailingZeros(rounded)}M`;
  }
  if (n >= 1_000) {
    return `$${Math.round(n / 1000)}K`;
  }
  return `$${Math.round(n)}`;
}

function stripTrailingZeros(n: number): string {
  return n.toFixed(3).replace(/\.?0+$/, '');
}

/** Always-positive count formatted as integer + "days". */
export function formatDays(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return `${Math.round(n)} days`;
}

/**
 * Signed percent for display. Includes arrow glyph and one decimal place.
 * Pass `arrow: false` to omit the arrow (useful inline in narration).
 */
export function formatPercent(
  pct: number,
  options: { decimals?: number; arrow?: boolean } = {},
): string {
  if (!Number.isFinite(pct)) return '—';
  const decimals = options.decimals ?? 1;
  const arrow = options.arrow ?? true;
  const abs = Math.abs(pct).toFixed(decimals);
  const dir = direction(pct);
  if (!arrow) return `${pct >= 0 ? '+' : '-'}${abs}%`;
  const glyph = dir === 'up' ? '↑' : dir === 'down' ? '↓' : '→';
  return `${glyph} ${abs}%`;
}

// ---------------------------------------------------------------------------
// Cohort + price-band helpers
// ---------------------------------------------------------------------------

export type PriceBand =
  | 'Under $400K'
  | 'Under $500K'
  | '$400K-$500K'
  | '$500K-$600K'
  | '$500K-$700K'
  | '$600K-$750K'
  | '$700K-$1M'
  | '$750K-$1M'
  | '$1M+'
  | '$1M-$1.5M'
  | '$1.5M+';

/**
 * 4-band split used by Scene 5 (Days to Pending). Matches query-rules.md
 * Template 7 verbatim: <500K, 500–700K, 700K–1M, 1M+.
 */
export function bandForScene5(price: number): PriceBand | null {
  if (!Number.isFinite(price) || price < 10000) return null;
  if (price < 500_000) return 'Under $500K';
  if (price < 700_000) return '$500K-$700K';
  if (price < 1_000_000) return '$700K-$1M';
  return '$1M+';
}

/**
 * 6-band split used by data stories #2, #15, #16: <400K, 400–500, 500–600,
 * 600–750, 750K–1M, 1M+. Matches data-stories.md.
 */
export function bandForStories(price: number): PriceBand | null {
  if (!Number.isFinite(price) || price < 10000) return null;
  if (price < 400_000) return 'Under $400K';
  if (price < 500_000) return '$400K-$500K';
  if (price < 600_000) return '$500K-$600K';
  if (price < 750_000) return '$600K-$750K';
  if (price < 1_000_000) return '$750K-$1M';
  return '$1M+';
}

/** Group an array by a key function, returning Map preserving insertion order. */
export function groupBy<T, K>(items: readonly T[], key: (item: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const bucket = out.get(k);
    if (bucket) {
      bucket.push(item);
    } else {
      out.set(k, [item]);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Sale-to-list ratio bounds (UF2)
// ---------------------------------------------------------------------------

/** UF2 lower bound for sale_to_*_list_ratio. */
export const SALE_TO_LIST_MIN = 0.5;
/** UF2 upper bound for sale_to_*_list_ratio. */
export const SALE_TO_LIST_MAX = 1.5;

/** True when a ratio passes UF2. NaN/non-finite returns false. */
export function passesUf2(ratio: number): boolean {
  return Number.isFinite(ratio) && ratio >= SALE_TO_LIST_MIN && ratio <= SALE_TO_LIST_MAX;
}

/** UF1 floor for residential ClosePrice / ListPrice. */
export const RESIDENTIAL_PRICE_FLOOR = 10_000;

/** True when a price passes UF1. */
export function passesUf1(price: number): boolean {
  return Number.isFinite(price) && price >= RESIDENTIAL_PRICE_FLOOR;
}
