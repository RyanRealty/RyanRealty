import { assertCompanyDomain, type CompanyImprovementDomain } from './domains'

export type ImprovementLedgerDraft = {
  domain: CompanyImprovementDomain
  changeClass: string
  surface: string
  description: string
  metric: string
  predictedDelta?: number | null
  baselineValue?: number | null
  windowDays?: number
  commitSha?: string | null
  notes?: string | null
}

export function assertLedgerDraft(input: {
  domain: string
  changeClass: string
  surface: string
  description: string
  metric: string
}): asserts input is ImprovementLedgerDraft {
  assertCompanyDomain(input.domain)
  if (!input.changeClass.trim()) throw new Error('changeClass is required')
  if (!input.surface.trim()) throw new Error('surface is required')
  if (!input.description.trim()) throw new Error('description is required')
  if (!input.metric.trim()) throw new Error('metric is required')
}

/** When the measurement window for a ledger row lapses. */
export function windowEndsAt(shippedAt: string, windowDays: number): Date {
  return new Date(Date.parse(shippedAt) + windowDays * 24 * 60 * 60 * 1000)
}

/**
 * A row is open until Learn writes a verdict. A measured row carries
 * actual_delta; an unmeasurable one carries a verdict with actual_delta NULL
 * (visibility audit 2026-09-22, gsc-trend-2: writing 0 for "no data" made
 * eight windows read as measured). Either closes it.
 */
export function isLedgerRowOpen(row: { actualDelta: number | null; verdict?: string | null }): boolean {
  return row.actualDelta == null && (row.verdict == null || row.verdict === '')
}

/**
 * A stranded row: the window lapsed and nobody closed it.
 * THE LOOP v1.3.0: a domain with stranded rows may not open a new class —
 * Learn closes the old hypothesis before the next one starts.
 */
export function isExpiredUnlearned(
  row: { shippedAt: string; windowDays: number; actualDelta: number | null; verdict?: string | null },
  now: Date = new Date(),
): boolean {
  if (!isLedgerRowOpen(row)) return false
  return now.getTime() > windowEndsAt(row.shippedAt, row.windowDays).getTime()
}
