/**
 * Detached snapshot from Market Truth (D1, MLS City text / region).
 * /sell, CMA city grain, and city/region pulse overlays share this so they
 * cannot disagree. A publishable snapshot overlays as today. A miss or throw
 * withholds active / months of supply / verdict / median — it does not ship
 * pulse 488 / 3.54 / seller as detached. Days to pending, new this week, and
 * sold 30d stay on the pulse series. /sell never falls back.
 */
import { createServiceClient } from '@/lib/data/client'
import { DEFINITION_ID } from '@/lib/data/market-truth/registry'
import { staleReason } from '@/lib/data/market-truth/getMetric'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { marketVerdict, type MarketKind } from '@/lib/market/classify'

export function cityDetachedSlug(geoSlug: string): string {
  return geoSlug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export type SellBendMarket = {
  activeCount: number
  monthsOfSupply: number
  mosLabel: string
  verdictKind: MarketKind
  verdictLabel: string
  medianListPrice: number | null
  computedAt: string
  completeThrough: string
}

function storedVerdictKind(valueText: string | null): MarketKind {
  if (valueText === 'seller') return 'sellers'
  if (valueText === 'buyer') return 'buyers'
  if (valueText === 'balanced') return 'balanced'
  return 'unknown'
}

const OVERLAY_STATS = [
  'active_count',
  'months_of_supply',
  'market_verdict',
  'median_list_active',
] as const

type MetricRow = {
  stat_id: string
  geo_type: string
  geo_slug: string
  value: number | null
  value_text: string | null
  is_publishable: boolean
  complete_through: string
  period_end: string
  window_months: number
  computed_at: string
}

function metricKey(geoType: string, geoSlug: string, statId: string): string {
  return `${geoType}:${geoSlug}:${statId}`
}

function publishable(row: MetricRow | undefined): boolean {
  if (!row?.is_publishable || row.value == null) return false
  return !staleReason({
    completeThrough: row.complete_through,
    periodEnd: row.period_end,
    windowMonths: Number(row.window_months),
  })
}

function assemble(geoType: string, geoSlug: string, byKey: Map<string, MetricRow>): SellBendMarket | null {
  const active = byKey.get(metricKey(geoType, geoSlug, 'active_count'))
  const mos = byKey.get(metricKey(geoType, geoSlug, 'months_of_supply'))
  const verdict = byKey.get(metricKey(geoType, geoSlug, 'market_verdict'))
  const medianList = byKey.get(metricKey(geoType, geoSlug, 'median_list_active'))
  if (!publishable(active) || !publishable(mos) || !publishable(verdict)) return null
  const classified = marketVerdict(Number(mos!.value))
  if (classified.kind === 'unknown') return null
  if (storedVerdictKind(verdict!.value_text) !== classified.kind) return null
  return {
    activeCount: Math.round(Number(active!.value)),
    monthsOfSupply: Number(mos!.value),
    mosLabel: formatMonthsOfSupply(Number(mos!.value)),
    verdictKind: classified.kind,
    verdictLabel: classified.label,
    medianListPrice: publishable(medianList) ? Number(medianList!.value) : null,
    computedAt: mos!.computed_at,
    completeThrough: mos!.complete_through,
  }
}

export async function getDetachedMarkets(
  keys: ReadonlyArray<{ geoType: 'city' | 'region'; geoSlug: string }>,
): Promise<Map<string, SellBendMarket>> {
  const out = new Map<string, SellBendMarket>()
  const normalized = keys
    .map((k) => ({
      geoType: k.geoType,
      geoSlug: k.geoType === 'city' ? cityDetachedSlug(k.geoSlug) : k.geoSlug.trim().toLowerCase(),
    }))
    .filter((k) => k.geoSlug)
  if (!normalized.length) return out

  const sb = createServiceClient()
  const { data, error } = await sb
    .from('market_metric')
    .select(
      'stat_id, geo_type, geo_slug, value, value_text, is_publishable, complete_through, period_end, window_months, computed_at',
    )
    .eq('definition_id', DEFINITION_ID)
    .eq('segment', 'detached')
    .in(
      'geo_type',
      [...new Set(normalized.map((k) => k.geoType))],
    )
    .in(
      'geo_slug',
      [...new Set(normalized.map((k) => k.geoSlug))],
    )
    .in('stat_id', [...OVERLAY_STATS])
  if (error) throw new Error(`getDetachedMarkets: ${error.message}`)

  const latest = new Map<string, MetricRow>()
  for (const raw of data ?? []) {
    const row = raw as MetricRow
    const key = metricKey(row.geo_type, row.geo_slug, row.stat_id)
    const prev = latest.get(key)
    if (!prev || String(row.computed_at) > String(prev.computed_at)) latest.set(key, row)
  }

  for (const k of normalized) {
    const assembled = assemble(k.geoType, k.geoSlug, latest)
    if (assembled) out.set(`${k.geoType}:${k.geoSlug}`, assembled)
  }
  return out
}

export async function getDetachedMarket(
  geoType: 'city' | 'region',
  geoSlug: string,
): Promise<SellBendMarket | null> {
  const map = await getDetachedMarkets([{ geoType, geoSlug }])
  const slug = geoType === 'city' ? cityDetachedSlug(geoSlug) : geoSlug.trim().toLowerCase()
  return map.get(`${geoType}:${slug}`) ?? null
}

export async function getCityDetachedMarket(geoSlug: string): Promise<SellBendMarket | null> {
  return getDetachedMarket('city', geoSlug)
}

export async function getSellBendMarket(): Promise<SellBendMarket | null> {
  return getCityDetachedMarket('bend')
}

type OverlayRow = {
  activeCount?: number
  active_count?: number
  monthsOfSupply?: number | null
  months_of_supply?: number | null
  medianListPrice?: number | null
  median_list_price?: number | null
  marketHealthLabel?: string | null
  market_health_label?: string | null
  refreshedAt?: string
  updated_at?: string | null
  updatedAt?: string
}

export function applyDetachedOverlay<T extends OverlayRow>(row: T, mt: SellBendMarket): T {
  const next = { ...row }
  if ('activeCount' in next) next.activeCount = mt.activeCount
  if ('active_count' in next) next.active_count = mt.activeCount
  if ('monthsOfSupply' in next) next.monthsOfSupply = mt.monthsOfSupply
  if ('months_of_supply' in next) next.months_of_supply = mt.monthsOfSupply
  if ('medianListPrice' in next && mt.medianListPrice != null) next.medianListPrice = mt.medianListPrice
  if ('median_list_price' in next && mt.medianListPrice != null) next.median_list_price = mt.medianListPrice
  if ('marketHealthLabel' in next) next.marketHealthLabel = mt.verdictLabel
  if ('market_health_label' in next) next.market_health_label = mt.verdictLabel
  if ('refreshedAt' in next) next.refreshedAt = mt.computedAt as T['refreshedAt']
  if ('updated_at' in next) next.updated_at = mt.computedAt
  if ('updatedAt' in next) next.updatedAt = mt.computedAt
  return next
}

/**
 * Strip the overlay fields so a city/region miss cannot publish pulse
 * 488 / 3.54 / seller as detached. Active stays a number (0) because
 * MarketPulse / snapshot types are non-nullable; display paths that
 * check `> 0` omit it. Days to pending, new this week, sold 30d, and
 * the pulse clock are not overlay fields — leave them.
 */
export function withholdDetachedHeadlines<T extends OverlayRow>(row: T): T {
  const next = { ...row }
  if ('activeCount' in next) next.activeCount = 0 as T['activeCount']
  if ('active_count' in next) next.active_count = 0 as T['active_count']
  if ('monthsOfSupply' in next) next.monthsOfSupply = null as T['monthsOfSupply']
  if ('months_of_supply' in next) next.months_of_supply = null as T['months_of_supply']
  if ('medianListPrice' in next) next.medianListPrice = null as T['medianListPrice']
  if ('median_list_price' in next) next.median_list_price = null as T['median_list_price']
  if ('marketHealthLabel' in next) next.marketHealthLabel = null as T['marketHealthLabel']
  if ('market_health_label' in next) next.market_health_label = null as T['market_health_label']
  return next
}

export function overlayDetachedMarket<T extends OverlayRow>(
  row: T,
  mt: SellBendMarket | null | undefined,
): T {
  return mt ? applyDetachedOverlay(row, mt) : withholdDetachedHeadlines(row)
}
