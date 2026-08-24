/**
 * Public detached mix and feature floors (Step 9, D12/D16).
 * 12-month closed cells through getMetrics. Feature flags other than
 * garage publish as "at least" floors. Garage is a true three-state share.
 * A 0% floor is not a figure. Miss omits the row.
 */
import { getMetrics, type MetricResult } from '@/lib/data/market-truth/getMetric'
import { formatPaceShare } from '@/lib/data/market-truth/public-pace'

export const PUBLIC_MIX_STATS = [
  'financing_mix',
  'feature_share',
  'bedroom_distribution',
] as const

export const PUBLIC_MIX_WINDOW_MONTHS = 12

const MIN_SHARE = 0.05

const FEATURE_LABEL: Record<string, string> = {
  garage_yn: 'garage',
  fireplace_yn: 'fireplace',
  waterfront_yn: 'waterfront',
  pool_yn: 'pool',
  cooling_yn: 'cooling',
  association_yn: 'HOA',
  irrigation_water_rights_yn: 'irrigation rights',
  horse_yn: 'horse property',
  new_construction_yn: 'new construction',
  senior_community_yn: '55+',
  basement_yn: 'basement',
}

const FINANCE_LABEL: Record<string, string> = {
  cash: 'cash',
  conventional: 'conventional',
  fha: 'FHA',
  va: 'VA',
  usda: 'USDA',
  'fha 203(k)': 'FHA 203(k)',
  'fha 203(b)': 'FHA 203(b)',
  'seller financing': 'seller financing',
  private: 'private',
  contract: 'contract',
  assumed: 'assumed',
  other: 'other',
}

const BED_LABEL: Record<string, string> = {
  '0': 'studio',
  '1': '1-bed',
  '2': '2-bed',
  '3': '3-bed',
  '4': '4-bed',
  '5': '5-bed',
  '6plus': '6+ bed',
}

export type PublicMixShare = {
  key: string
  share: number
  floor: boolean
}

export type PublicMixRow = {
  financing: PublicMixShare[]
  features: PublicMixShare[]
  bedrooms: PublicMixShare[]
}

export const EMPTY_PUBLIC_MIX: PublicMixRow = {
  financing: [],
  features: [],
  bedrooms: [],
}

export type PublicMixItem = { key: string; value: string; label: string }

function hyphenSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function parseShareMap(text: string | null | undefined): Record<string, number> {
  if (text == null || text.trim() === '') return {}
  try {
    const raw = JSON.parse(text) as unknown
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
    const out: Record<string, number> = {}
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      const n = typeof value === 'number' ? value : Number(value)
      if (!Number.isFinite(n) || n <= 0) continue
      out[key] = n
    }
    return out
  } catch {
    return {}
  }
}

function rankedShares(
  map: Record<string, number>,
  labels: Record<string, string>,
  opts: { floors?: boolean; garageTrueShare?: boolean; asCounts?: boolean },
): PublicMixShare[] {
  const entries = Object.entries(map)
  const total = opts.asCounts ? entries.reduce((sum, [, n]) => sum + n, 0) : 1
  if (opts.asCounts && total <= 0) return []
  const out: PublicMixShare[] = []
  for (const [key, raw] of entries) {
    if (!labels[key]) continue
    if (key === 'unknown') continue
    const share = opts.asCounts ? raw / total : raw
    if (!Number.isFinite(share) || share < MIN_SHARE) continue
    const floor = Boolean(opts.floors) && !(opts.garageTrueShare && key === 'garage_yn')
    out.push({ key, share, floor })
  }
  out.sort((a, b) => b.share - a.share)
  return out.slice(0, 8)
}

export function publicMixHasRow(row: PublicMixRow): boolean {
  return row.financing.length > 0 || row.features.length > 0 || row.bedrooms.length > 0
}

export function publicMixItems(row: PublicMixRow): PublicMixItem[] {
  const items: PublicMixItem[] = []
  for (const bit of row.features) {
    const name = FEATURE_LABEL[bit.key] ?? bit.key
    const pct = formatPaceShare(bit.share)
    items.push({
      key: `feat:${bit.key}`,
      value: bit.floor ? `at least ${pct}` : pct,
      label: `${name} · 12 months`,
    })
  }
  for (const bit of row.financing) {
    const name = FINANCE_LABEL[bit.key] ?? bit.key
    items.push({
      key: `fin:${bit.key}`,
      value: formatPaceShare(bit.share),
      label: `${name} closes · 12 months`,
    })
  }
  for (const bit of row.bedrooms) {
    const name = BED_LABEL[bit.key] ?? bit.key
    items.push({
      key: `bed:${bit.key}`,
      value: formatPaceShare(bit.share),
      label: `${name} closes · 12 months`,
    })
  }
  return items
}

function pickText(cell: MetricResult | null | undefined): string | null {
  if (!cell?.isPublishable) return null
  const text = cell.valueText?.trim()
  return text ? text : null
}

export async function getPublicDetachedMix(opts: {
  geoType: 'city' | 'region' | 'zip' | 'neighborhood'
  geoSlug: string
}): Promise<PublicMixRow> {
  const geoSlug = hyphenSlug(opts.geoSlug)
  if (!geoSlug) return { financing: [], features: [], bedrooms: [] }

  const inputs = PUBLIC_MIX_STATS.map((stat) => ({
    stat,
    geoType: opts.geoType,
    geoSlug,
    segment: 'detached',
    windowMonths: PUBLIC_MIX_WINDOW_MONTHS,
  }))
  const results = await getMetrics(inputs)
  const byStat = new Map<string, MetricResult>()
  PUBLIC_MIX_STATS.forEach((stat, i) => {
    const result = results[i]
    if (result) byStat.set(stat, result)
  })

  const featureCell = byStat.get('feature_share')
  const featureMap = parseShareMap(pickText(featureCell))
  const financingMap = parseShareMap(pickText(byStat.get('financing_mix')))
  const bedroomMap = parseShareMap(pickText(byStat.get('bedroom_distribution')))

  return {
    features: rankedShares(featureMap, FEATURE_LABEL, {
      floors: Boolean(featureCell?.provenance.isFloor),
      garageTrueShare: true,
    }),
    financing: rankedShares(financingMap, FINANCE_LABEL, {}),
    bedrooms: rankedShares(bedroomMap, BED_LABEL, { asCounts: true }),
  }
}
