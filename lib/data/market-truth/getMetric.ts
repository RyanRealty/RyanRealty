/**
 * The only read path for a Market Truth figure.
 * Shadow store: public.market_metric. /sell Bend (active, months of supply,
 * verdict) reads this. Other public surfaces stay on pulse until their recon.
 * getMetrics is the batch form — one round trip, same stale / publishable /
 * window pick as getMetric.
 */
import { cache } from 'react'
import { createServiceClient } from '@/lib/data/client'
import { unstable_cache } from '@/lib/data/cache/next-cache'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { dedupeInflight, withConcurrency } from '@/lib/data/cache/inflight'
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

/** PostgREST's per-response row cap; getMetrics pages in this size. */
const METRIC_PAGE = 1000

/**
 * Each compute rewrites every window and calendar month for a geo (Bend
 * median_close window=1: 36 period_ends, one computed_at). 14 days matches
 * the overlay lookback so a missed compute still has a week of slack.
 */
export const METRIC_LOOKBACK_DAYS = 14

/** Cap concurrent geo-slice reads when one getMetrics call names many geos. */
const SLICE_CONCURRENCY = 3
const runSlice = withConcurrency(SLICE_CONCURRENCY)

type MetricSliceKey = {
  definitionId: string
  geoType: string
  geoSlug: string
  segment: string
}

function sliceKeyOf(input: GetMetricInput): MetricSliceKey {
  return {
    definitionId: input.definitionId ?? DEFINITION_ID,
    geoType: input.geoType,
    geoSlug: input.geoSlug,
    segment: input.segment,
  }
}

function encodeSliceKey(key: MetricSliceKey): string {
  return JSON.stringify([key.definitionId, key.geoType, key.geoSlug, key.segment])
}

function lookbackSince(): string {
  return new Date(Date.now() - METRIC_LOOKBACK_DAYS * 86_400_000).toISOString()
}

/** market_metric's primary key, in order: the tiebreak that makes offset paging stable. */
export const METRIC_PRIMARY_KEY = [
  'stat_id',
  'geo_type',
  'geo_slug',
  'segment',
  'period_end',
  'window_months',
  'definition_id',
] as const

/** Appends the primary key to an ordered market_metric read so every page boundary is fixed. */
export function orderByPrimaryKey<Q extends { order: (column: string, options?: { ascending?: boolean }) => Q }>(
  query: Q,
): Q {
  let ordered = query
  for (const column of METRIC_PRIMARY_KEY) ordered = ordered.order(column, { ascending: true })
  return ordered
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
  if (input.periodEnd && String(row.period_end).slice(0, 10) !== String(input.periodEnd).slice(0, 10)) {
    return false
  }
  return true
}

function hasPublishedPayload(row: Record<string, unknown>): boolean {
  if (row.value != null && Number.isFinite(Number(row.value))) return true
  const text = row.value_text == null ? '' : String(row.value_text).trim()
  return text !== '' && text !== 'null' && text !== '{}'
}

function isFreshPublishable(row: Record<string, unknown>): boolean {
  if (!row.is_publishable || !hasPublishedPayload(row)) return false
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

async function fetchMetricSlice(key: MetricSliceKey): Promise<Record<string, unknown>[]> {
  const sb = createServiceClient()
  const rows: Record<string, unknown>[] = []
  const since = lookbackSince()
  for (let from = 0; ; from += METRIC_PAGE) {
    const query = sb
      .from('market_metric')
      .select(METRIC_COLUMNS)
      .eq('definition_id', key.definitionId)
      .eq('geo_type', key.geoType)
      .eq('geo_slug', key.geoSlug)
      .eq('segment', key.segment)
      .gte('computed_at', since)
    const { data, error } = await orderByPrimaryKey(query.order('computed_at', { ascending: false })).range(
      from,
      from + METRIC_PAGE - 1,
    )
    if (error) throw new Error(`getMetrics: ${error.message}`)
    const page = (data ?? []) as Record<string, unknown>[]
    rows.push(...page)
    if (page.length < METRIC_PAGE) break
  }
  return rows
}

const loadMetricSliceCached = unstable_cache(
  async (encoded: string) => fetchMetricSlice(JSON.parse(encoded) as MetricSliceKey),
  ['market-metric-slice-v1'],
  { revalidate: CACHE_WINDOWS.marketMetric, tags: [cacheTag.market] },
)

const loadMetricSliceDeduped = cache((encoded: string) =>
  dedupeInflight(`market-metric-slice:${encoded}`, () => loadMetricSliceCached(encoded)),
)

export async function getMetrics(inputs: GetMetricInput[]): Promise<(MetricResult | null)[]> {
  for (const input of inputs) {
    if (!STAT_BY_ID.get(input.stat)) throw new UnknownStatError(input.stat)
  }
  if (!inputs.length) return []

  // ONE SLICE PER GEO, CACHED ≥1h (2026-10-14). market_metric keeps every
  // daily computation (~1.5M rows). Uncached PostgREST pages of a geo were
  // 41–63% of DB time on 2026-10-14 (7,635 calls, 539ms mean) and pinned the
  // MEDIUM 4GB instance into swap. Each compute rewrites every window, so a
  // 14-day computed_at lookback still holds the 36-month leftover series.
  // pickRow still decides which row answers. Slices are keyed by
  // definition/geo/segment so pace, mix, monthly, and leftover callers on
  // the same community page share one read.
  const encoded = unique(inputs.map((input) => encodeSliceKey(sliceKeyOf(input))))
  const slices = await Promise.all(encoded.map((key) => runSlice(() => loadMetricSliceDeduped(key))))
  const rows = slices.flat()
  return inputs.map((input) => {
    const row = pickRow(rows, input)
    return row ? toMetricResult(row) : null
  })
}

export async function getMetric(input: GetMetricInput): Promise<MetricResult | null> {
  const [result] = await getMetrics([input])
  return result ?? null
}
