import type { SupabaseClient } from '@supabase/supabase-js'

// Replaced by buildTerminalScopedStatusOr() below which adds date-range scoping
// const TERMINAL_STATUS_OR = 'StandardStatus.ilike.%Closed%,...'

function buildTerminalScopedStatusOr(params: {
  fromIso: string
  toIsoExclusive: string
}): string {
  const { fromIso, toIsoExclusive } = params
  const modRangeOps = `gte.${fromIso},ModificationTimestamp.lt.${toIsoExclusive}`
  const listRangeOps = `gte.${fromIso},ListDate.lt.${toIsoExclusive}`
  const onMarketRangeOps = `gte.${fromIso},OnMarketDate.lt.${toIsoExclusive}`
  const closeRangeOps = `gte.${fromIso},CloseDate.lt.${toIsoExclusive}`
  const nonClosedTerms = (status: 'Expired' | 'Withdrawn' | 'Cancel') => [
    `and(StandardStatus.ilike.%${status}%,ListDate.${listRangeOps})`,
    `and(StandardStatus.ilike.%${status}%,ListDate.is.null,OnMarketDate.${onMarketRangeOps})`,
    `and(StandardStatus.ilike.%${status}%,ListDate.is.null,OnMarketDate.is.null,ModificationTimestamp.${modRangeOps})`,
  ]
  return [
    `and(StandardStatus.ilike.%Closed%,CloseDate.${closeRangeOps})`,
    `and(StandardStatus.ilike.%Closed%,CloseDate.is.null,ModificationTimestamp.${modRangeOps})`,
    ...nonClosedTerms('Expired'),
    ...nonClosedTerms('Withdrawn'),
    ...nonClosedTerms('Cancel'),
  ].join(',')
}

export type YearRow = {
  year: number
  total: number
  finalized: number
  remaining: number
}

export type ScopeTotals = {
  total: number
  finalized: number
  remaining: number
}

export type GetTerminalScopeCountsResult = {
  rowsByYear: YearRow[]
  scopeTotals: ScopeTotals
}

export type GetTerminalScopeCountsMeta = {
  yearsTotal: number
  yearsFullyFailed: number
  catastrophicTimeout: boolean
}

async function countYear(
  supabase: SupabaseClient,
  year: number
): Promise<{ total: number; finalized: number; error?: string }> {
  const fromIso = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0)).toISOString()
  const toIsoExclusive = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0)).toISOString()
  const statusOr = buildTerminalScopedStatusOr({ fromIso, toIsoExclusive })

  try {
    void supabase
    const { countListingsByStatusOr, countListingsByStatusOrAndFinalized } = await import('@/lib/data')
    const [totalRes, finalizedRes] = await Promise.all([
      countListingsByStatusOr(statusOr),
      countListingsByStatusOrAndFinalized(statusOr),
    ])

    const total = totalRes.count
    const finalized = finalizedRes.count
    const error = totalRes.error ?? finalizedRes.error ?? undefined
    return { total, finalized, error }
  } catch (err) {
    return {
      total: 0,
      finalized: 0,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Compute terminal listing counts by year for the given scope.
 * Closed uses CloseDate when available (fallback ModificationTimestamp).
 * Expired/withdrawn/canceled use ListDate first, then OnMarketDate, then ModificationTimestamp.
 */
export async function getTerminalScopeCounts(
  supabase: SupabaseClient,
  scope: { fromYear: number; toYear: number },
  fallbackRowsByYear?: YearRow[] | null
): Promise<{
  result: GetTerminalScopeCountsResult
  warnings: string[]
  meta: GetTerminalScopeCountsMeta
}> {
  const { fromYear, toYear } = scope
  const years: number[] = []
  for (let y = fromYear; y <= toYear; y++) {
    years.push(y)
  }
  const yearsTotal = years.length

  const results = await Promise.all(
    years.map((year) => countYear(supabase, year))
  )

  const rowsByYear: YearRow[] = []
  const warnings: string[] = []
  let yearsFullyFailed = 0

  for (let i = 0; i < years.length; i++) {
    const year = years[i]
    const r = results[i]
    if (r.error) {
      yearsFullyFailed++
      warnings.push(`Year ${year}: ${r.error}`)
      const fallback = fallbackRowsByYear?.find((row) => row.year === year)
      if (fallback) {
        rowsByYear.push(fallback)
      } else {
        rowsByYear.push({ year, total: 0, finalized: 0, remaining: 0 })
      }
    } else {
      rowsByYear.push({
        year,
        total: r.total,
        finalized: r.finalized,
        remaining: Math.max(0, r.total - r.finalized),
      })
    }
  }

  const scopeTotals: ScopeTotals = rowsByYear.reduce(
    (acc, row) => ({
      total: acc.total + row.total,
      finalized: acc.finalized + row.finalized,
      remaining: acc.remaining + row.remaining,
    }),
    { total: 0, finalized: 0, remaining: 0 }
  )

  const catastrophicTimeout = yearsFullyFailed >= yearsTotal

  if (catastrophicTimeout && fallbackRowsByYear && fallbackRowsByYear.length > 0) {
    const fallbackTotals = fallbackRowsByYear.reduce(
      (acc, row) => ({
        total: acc.total + row.total,
        finalized: acc.finalized + row.finalized,
        remaining: acc.remaining + row.remaining,
      }),
      { total: 0, finalized: 0, remaining: 0 }
    )
    return {
      result: { rowsByYear: fallbackRowsByYear, scopeTotals: fallbackTotals },
      warnings,
      meta: {
        yearsTotal,
        yearsFullyFailed,
        catastrophicTimeout: true,
      },
    }
  }

  return {
    result: { rowsByYear, scopeTotals },
    warnings,
    meta: {
      yearsTotal,
      yearsFullyFailed,
      catastrophicTimeout,
    },
  }
}
