/**
 * The only read path for a Market Truth figure.
 * Shadow store: public.market_metric. /sell Bend (active, months of supply,
 * verdict) reads this. Other public surfaces stay on pulse until their recon.
 */
import { createServiceClient } from '@/lib/data/client'
import { DEFINITION_ID, STAT_BY_ID } from '@/lib/data/market-truth/registry'

export type GetMetricInput = {
  stat: string
  geoType: string
  geoSlug: string
  segment: string
  windowMonths?: number
  periodEnd?: string
  definitionId?: string
}

export type MetricProvenance = {
  sampleN: number
  method: string
  excludedN: number
  completeThrough: string
  windowMonths: number
  definitionId: string
  computedAt: string
  isFloor: boolean
  withheldReason: string | null
}

export type MetricResult = {
  statId: string
  geoType: string
  geoSlug: string
  segment: string
  value: number | null
  valueText: string | null
  isPublishable: boolean
  provenance: MetricProvenance
}

export class UnknownStatError extends Error {
  constructor(stat: string) {
    super(`Market Truth: stat '${stat}' is not in the registry`)
    this.name = 'UnknownStatError'
  }
}

/** Gate 7: a closed-window metric whose complete_through lags period_end is stale. */
export function staleReason(opts: {
  completeThrough: string
  periodEnd: string
  windowMonths: number
}): string | null {
  if (opts.windowMonths <= 0) return null
  const complete = Date.parse(opts.completeThrough.slice(0, 10))
  const end = Date.parse(opts.periodEnd.slice(0, 10))
  if (!Number.isFinite(complete) || !Number.isFinite(end)) return 'missing_complete_through'
  const slackMs = 2 * 86_400_000
  if (complete + slackMs < end) return 'stale_complete_through'
  return null
}

export async function getMetric(input: GetMetricInput): Promise<MetricResult | null> {
  const spec = STAT_BY_ID.get(input.stat)
  if (!spec) throw new UnknownStatError(input.stat)

  const sb = createServiceClient()
  let q = sb
    .from('market_metric')
    .select(
      'stat_id, geo_type, geo_slug, segment, period_end, window_months, definition_id, value, value_text, sample_n, method, excluded_n, complete_through, is_publishable, withheld_reason, is_floor, computed_at',
    )
    .eq('stat_id', input.stat)
    .eq('geo_type', input.geoType)
    .eq('geo_slug', input.geoSlug)
    .eq('segment', input.segment)
    .eq('definition_id', input.definitionId ?? DEFINITION_ID)
    .order('is_publishable', { ascending: false })
    .order('window_months', { ascending: true })
    .order('period_end', { ascending: false })
    .limit(1)

  if (input.windowMonths != null) q = q.eq('window_months', input.windowMonths)
  if (input.periodEnd) q = q.eq('period_end', input.periodEnd)

  const { data, error } = await q.maybeSingle()
  if (error) throw new Error(`getMetric(${input.stat}): ${error.message}`)
  if (!data) return null

  const row = data as Record<string, unknown>
  const windowMonths = Number(row.window_months)
  const stale = staleReason({
    completeThrough: String(row.complete_through ?? ''),
    periodEnd: String(row.period_end ?? ''),
    windowMonths,
  })
  const publishable = Boolean(row.is_publishable) && !stale
  return {
    statId: String(row.stat_id),
    geoType: String(row.geo_type),
    geoSlug: String(row.geo_slug),
    segment: String(row.segment),
    value: publishable && row.value != null ? Number(row.value) : null,
    valueText: publishable && row.value_text != null ? String(row.value_text) : null,
    isPublishable: publishable,
    provenance: {
      sampleN: Number(row.sample_n),
      method: String(row.method),
      excludedN: Number(row.excluded_n ?? 0),
      completeThrough: String(row.complete_through),
      windowMonths,
      definitionId: String(row.definition_id),
      computedAt: String(row.computed_at),
      isFloor: Boolean(row.is_floor),
      withheldReason: stale ?? (row.withheld_reason == null ? null : String(row.withheld_reason)),
    },
  }
}
