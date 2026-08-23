/**
 * The only read path for a Market Truth figure.
 * Shadow store: public.market_metric. Nothing public is repointed yet (D3).
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
  return {
    statId: String(row.stat_id),
    geoType: String(row.geo_type),
    geoSlug: String(row.geo_slug),
    segment: String(row.segment),
    value: row.value == null ? null : Number(row.value),
    valueText: row.value_text == null ? null : String(row.value_text),
    isPublishable: Boolean(row.is_publishable),
    provenance: {
      sampleN: Number(row.sample_n),
      method: String(row.method),
      excludedN: Number(row.excluded_n ?? 0),
      completeThrough: String(row.complete_through),
      windowMonths: Number(row.window_months),
      definitionId: String(row.definition_id),
      computedAt: String(row.computed_at),
      isFloor: Boolean(row.is_floor),
      withheldReason: row.withheld_reason == null ? null : String(row.withheld_reason),
    },
  }
}
