/**
 * Bend seller-concession stats from .concessions-spec/data/results.md.
 * Query q1_concessions.sql, run 2026-10-13. Bend TIGER city boundary.
 * Residential detached / townhome / condo, is_publishable.
 * Field: market_fact_sale.concession_amount. "With concession" = amount > 0.
 * A blank MLS field may be none or not entered, so every share is a lower bound.
 * Oct 2026 is partial and is not in this series.
 */

export const CONCESSION_QUERY_RUN = '2026-10-13'
export const CONCESSION_WINDOW_START = '2026-07-15'
export const CONCESSION_WINDOW_END = '2026-10-12'

export const LAST_90D = {
  sales: 538,
  withConcession: 269,
  sharePct: 50.0,
  medianDollars: 10_000,
  medianPctOfPrice: 1.3,
  medianClose: 695_850,
} as const

/** On-screen rounding from results.md: 1 in 2, $10,000, 1.3%, 38% to 48%. */
export const ON_SCREEN = {
  shareLabel: '1 in 2',
  typicalDollars: 10_000,
  typicalPctLabel: '1.3%',
  sep2025ShareRounded: 38,
  sep2026ShareRounded: 48,
} as const

export type MonthlyConcessionShare = {
  year: number
  month: number
  /** 1-indexed month as YYYY-MM. */
  period: string
  sharePct: number
  medianDollars: number
}

export const MONTHLY_SHARE: readonly MonthlyConcessionShare[] = [
  { year: 2024, month: 10, period: '2024-10', sharePct: 40.7, medianDollars: 6_500 },
  { year: 2024, month: 11, period: '2024-11', sharePct: 42.4, medianDollars: 7_500 },
  { year: 2024, month: 12, period: '2024-12', sharePct: 44.8, medianDollars: 10_000 },
  { year: 2025, month: 1, period: '2025-01', sharePct: 42.0, medianDollars: 8_000 },
  { year: 2025, month: 2, period: '2025-02', sharePct: 42.7, medianDollars: 7_250 },
  { year: 2025, month: 3, period: '2025-03', sharePct: 42.5, medianDollars: 9_000 },
  { year: 2025, month: 4, period: '2025-04', sharePct: 39.6, medianDollars: 9_350 },
  { year: 2025, month: 5, period: '2025-05', sharePct: 36.9, medianDollars: 7_500 },
  { year: 2025, month: 6, period: '2025-06', sharePct: 39.9, medianDollars: 8_000 },
  { year: 2025, month: 7, period: '2025-07', sharePct: 33.7, medianDollars: 7_175 },
  { year: 2025, month: 8, period: '2025-08', sharePct: 36.7, medianDollars: 7_000 },
  { year: 2025, month: 9, period: '2025-09', sharePct: 38.1, medianDollars: 9_050 },
  { year: 2025, month: 10, period: '2025-10', sharePct: 45.1, medianDollars: 10_000 },
  { year: 2025, month: 11, period: '2025-11', sharePct: 47.0, medianDollars: 10_000 },
  { year: 2025, month: 12, period: '2025-12', sharePct: 46.3, medianDollars: 12_096 },
  { year: 2026, month: 1, period: '2026-01', sharePct: 42.6, medianDollars: 10_000 },
  { year: 2026, month: 2, period: '2026-02', sharePct: 41.2, medianDollars: 8_406 },
  { year: 2026, month: 3, period: '2026-03', sharePct: 45.7, medianDollars: 10_000 },
  { year: 2026, month: 4, period: '2026-04', sharePct: 46.8, medianDollars: 6_000 },
  { year: 2026, month: 5, period: '2026-05', sharePct: 40.1, medianDollars: 8_000 },
  { year: 2026, month: 6, period: '2026-06', sharePct: 45.2, medianDollars: 7_000 },
  { year: 2026, month: 7, period: '2026-07', sharePct: 50.4, medianDollars: 9_000 },
  { year: 2026, month: 8, period: '2026-08', sharePct: 48.9, medianDollars: 8_150 },
  { year: 2026, month: 9, period: '2026-09', sharePct: 48.3, medianDollars: 10_000 },
]

export const CONCESSION_SOURCE =
  'Oregon Data Share closed residential sales inside the Bend city limits (TIGER), detached / townhome / condo, is_publishable. Concession = market_fact_sale.concession_amount > 0. Window 2026-07-15 to 2026-10-12: 269 of 538 sales. Query q1_concessions.sql, run 2026-10-13. A blank MLS field may undercount.'
