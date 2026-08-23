/**
 * The only read path for a Market Truth figure.
 * Shadow store: public.market_metric. /sell Bend (active, months of supply,
 * verdict) reads this. Other public surfaces stay on pulse until their recon.
 * getMetrics is the batch form — one round trip, same stale / publishable /
 * window pick as getMetric.
 */
import { createServiceClient } from '@/lib/data/client'
import {
  preferSegmentCell,
  type RawSegmentCell,
} from '@/lib/data/market-truth/city-segment-collapse'
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

const METRIC_COLUMNS =
  'stat_id, geo_type, geo_slug, segment, period_end, window_months, definition_id, value, value_text, sample_n, method, excluded_n, complete_through, is_publishable, withheld_reason, is_floor, computed_at'

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

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

function asRawCell(row: Record<string, unknown>): RawSegmentCell {
  return {
    segment: String(row.segment),
    stat_id: String(row.stat_id),
    value: row.value as RawSegmentCell['value'],
    value_text: row.value_text == null ? null : String(row.value_text),
    sample_n: row.sample_n as RawSegmentCell['sample_n'],
    window_months: row.window_months as RawSegmentCell['window_months'],
    period_end: String(row.period_end ?? ''),
    computed_at: String(row.computed_at ?? ''),
    complete_through: String(row.complete_through ?? ''),
    is_publishable: Boolean(row.is_publishable),
  }
}

function matchesInput(row: Record<string, unknown>, input: GetMetricInput): boolean {
  if (String(row.stat_id) !== input.stat) return false
  if (String(row.geo_type) !== input.geoType) return false
  if (String(row.geo_slug) !== input.geoSlug) return false
  if (String(row.segment) !== input.segment) return false
  if (String(row.definition_id) !== (input.definitionId ?? DEFINITION_ID)) return false
  if (input.windowMonths != null && Number(row.window_months) !== input.windowMonths) return false
  if (input.periodEnd && String(row.period_end) !== input.periodEnd) return false
  return true
}

function isFreshPublishable(row: Record<string, unknown>): boolean {
  if (!row.is_publishable || row.value == null) return false
  return !staleReason({
    completeThrough: String(row.complete_through ?? ''),
    periodEnd: String(row.period_end ?? ''),
    windowMonths: Number(row.window_months),
  })
}

function pickRow(
  rows: Record<string, unknown>[],
  input: GetMetricInput,
): Record<string, unknown> | null {
  const candidates = rows.filter((row) => matchesInput(row, input) && isFreshPublishable(row))
  if (!candidates.length) return null
  let best = candidates[0]!
  for (let i = 1; i < candidates.length; i++) {
    const next = candidates[i]!
    if (preferSegmentCell(asRawCell(next), asRawCell(best))) best = next
  }
  return best
}

function toMetricResult(row: Record<string, unknown>): MetricResult {
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

export async function getMetrics(inputs: GetMetricInput[]): Promise<(MetricResult | null)[]> {
  for (const input of inputs) {
    if (!STAT_BY_ID.get(input.stat)) throw new UnknownStatError(input.stat)
  }
  if (!inputs.length) return []

  const sb = createServiceClient()
  const { data, error } = await sb
    .from('market_metric')
    .select(METRIC_COLUMNS)
    .in('stat_id', unique(inputs.map((input) => input.stat)))
    .in('geo_type', unique(inputs.map((input) => input.geoType)))
    .in('geo_slug', unique(inputs.map((input) => input.geoSlug)))
    .in('segment', unique(inputs.map((input) => input.segment)))
    .in(
      'definition_id',
      unique(inputs.map((input) => input.definitionId ?? DEFINITION_ID)),
    )

  if (error) throw new Error(`getMetrics: ${error.message}`)
  const rows = (data ?? []) as Record<string, unknown>[]
  return inputs.map((input) => {
    const row = pickRow(rows, input)
    return row ? toMetricResult(row) : null
  })
}

export async function getMetric(input: GetMetricInput): Promise<MetricResult | null> {
  const [result] = await getMetrics([input])
  return result ?? null
}
