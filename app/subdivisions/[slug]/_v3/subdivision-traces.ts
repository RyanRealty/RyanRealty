/**
 * The source traces this route publishes, in one file.
 *
 * CLAUDE.md section 0: one trace per query, one stamp per trace, never borrowed
 * across populations. Face copy lives in subdivision-face.ts so leftover
 * labels and plat language stay off the public HTML.
 */

import {
  subdivisionFaceClosedSalesTrace,
  subdivisionFaceCountsTrace,
  subdivisionFaceFieldTrace,
  subdivisionFaceHomesTrace,
  subdivisionFaceInventoryTrace,
  subdivisionFaceStatsTrace,
} from './subdivision-face'

/** The population an active count covers, by which resolution path found it. */
export type PlatScope =
  | { kind: 'boundary'; displayName: string }
  | { kind: 'registry'; subdivisionName: string; city: string }
  | { kind: 'pins'; displayName: string }

function scopePlace(scope: PlatScope): { placeName: string; cityName: string | null; hasBoundary: boolean } {
  if (scope.kind === 'registry') {
    return { placeName: scope.subdivisionName, cityName: scope.city, hasBoundary: false }
  }
  return { placeName: scope.displayName, cityName: null, hasBoundary: scope.kind === 'boundary' }
}

export function activeCountTrace(scope: PlatScope): string {
  return subdivisionFaceHomesTrace(scopePlace(scope).placeName, scopePlace(scope).cityName, scopePlace(scope).hasBoundary)
}

export function homesLedgerTrace(scope: PlatScope): string {
  const { placeName, cityName, hasBoundary } = scopePlace(scope)
  return subdivisionFaceHomesTrace(placeName, cityName, hasBoundary)
}

export function fieldTrace(scope: PlatScope): string {
  const { placeName, cityName, hasBoundary } = scopePlace(scope)
  return subdivisionFaceFieldTrace(placeName, cityName, hasBoundary)
}

export function platCountsTrace(displayName: string): string {
  return subdivisionFaceCountsTrace(displayName)
}

export function platStatsTrace(displayName: string, cityName: string, periodLabel: string): string {
  return subdivisionFaceStatsTrace(displayName, cityName, periodLabel)
}

export function platInventoryTrace(scope: PlatScope): string {
  const { placeName, cityName, hasBoundary } = scopePlace(scope)
  return subdivisionFaceInventoryTrace(placeName, cityName, hasBoundary)
}

export function salesHistoryTrace(displayName: string, priceMayPublish = false): string {
  return subdivisionFaceClosedSalesTrace(displayName, priceMayPublish)
}

/** The window label the stats cache row carries, spelled for a reader. */
export const PERIOD_LABEL: Record<
  'rolling_30d' | 'rolling_90d' | 'rolling_365d' | 'monthly' | 'ytd',
  string
> = {
  rolling_30d: 'Last 30 days',
  rolling_90d: 'Last 90 days',
  rolling_365d: 'Last 12 months',
  monthly: 'This month',
  ytd: 'Year to date',
}

/** How many closed years the Ledger prints. The KB table used the same ceiling. */
export const MAX_YEAR_ROWS = 40
