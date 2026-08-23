/**
 * Public 12-month detached pace (Step 9 leftover). Does not replace pulse
 * "this week" / 30-day figures. Miss omits the stat. Neighborhood is not here.
 */
import { createServiceClient } from '@/lib/data/client'
import { DEFINITION_ID } from '@/lib/data/market-truth/registry'
import { staleReason } from '@/lib/data/market-truth/getMetric'

export const PUBLIC_PACE_WINDOW_MONTHS = 12

export const PUBLIC_PACE_STATS = [
  'median_days_to_contract',
  'median_days_to_close',
  'closed_count',
  'new_listings',
  'pct_with_price_cut',
] as const

export type PublicPaceStat = (typeof PUBLIC_PACE_STATS)[number]

export type PublicPaceRow = {
  daysToContract: number | null
  daysToClose: number | null
  closedCount: number | null
  newListings: number | null
  priceCutShare: number | null
}

export const EMPTY_PUBLIC_PACE: PublicPaceRow = {
  daysToContract: null,
  daysToClose: null,
  closedCount: null,
  newListings: null,
  priceCutShare: null,
}

function hyphenSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function asNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

type PaceCell = {
  stat_id: string
  value: number | string | null
  period_end: string
  computed_at: string
  complete_through: string
  window_months: number | string
  is_publishable: boolean
}

function prefer(next: PaceCell, prev: PaceCell): boolean {
  const peN = String(next.period_end)
  const peP = String(prev.period_end)
  if (peN !== peP) return peN > peP
  return String(next.computed_at) > String(prev.computed_at)
}

export function formatPaceShare(share: number): string {
  const pct = Math.round(share * 1000) / 10
  return `${pct.toFixed(1)}%`
}

export function publicPaceHasRow(row: PublicPaceRow): boolean {
  return (
    row.daysToContract != null ||
    row.daysToClose != null ||
    row.closedCount != null ||
    row.newListings != null ||
    row.priceCutShare != null
  )
}

export async function getPublicDetachedPace(opts: {
  geoType: 'city' | 'region'
  geoSlug: string
}): Promise<PublicPaceRow> {
  const geoSlug = hyphenSlug(opts.geoSlug)
  if (!geoSlug) return { ...EMPTY_PUBLIC_PACE }

  const sb = createServiceClient()
  const { data, error } = await sb
    .from('market_metric')
    .select('stat_id, value, period_end, computed_at, complete_through, window_months, is_publishable')
    .eq('definition_id', DEFINITION_ID)
    .eq('geo_type', opts.geoType)
    .eq('geo_slug', geoSlug)
    .eq('segment', 'detached')
    .eq('window_months', PUBLIC_PACE_WINDOW_MONTHS)
    .in('stat_id', [...PUBLIC_PACE_STATS])
    .eq('is_publishable', true)
    .not('value', 'is', null)

  if (error) throw new Error(`getPublicDetachedPace: ${error.message}`)

  const best = new Map<string, PaceCell>()
  for (const raw of (data ?? []) as PaceCell[]) {
    if (
      staleReason({
        completeThrough: String(raw.complete_through ?? ''),
        periodEnd: String(raw.period_end ?? ''),
        windowMonths: Number(raw.window_months),
      })
    ) {
      continue
    }
    const prev = best.get(raw.stat_id)
    if (!prev || prefer(raw, prev)) best.set(raw.stat_id, raw)
  }

  const daysToContract = asNumber(best.get('median_days_to_contract')?.value)
  const daysToClose = asNumber(best.get('median_days_to_close')?.value)
  const closedCount = asNumber(best.get('closed_count')?.value)
  const newListings = asNumber(best.get('new_listings')?.value)
  const priceCutShare = asNumber(best.get('pct_with_price_cut')?.value)

  return {
    daysToContract: daysToContract == null ? null : Math.round(daysToContract),
    daysToClose: daysToClose == null ? null : Math.round(daysToClose),
    closedCount: closedCount == null || closedCount <= 0 ? null : Math.round(closedCount),
    newListings: newListings == null || newListings <= 0 ? null : Math.round(newListings),
    priceCutShare: priceCutShare == null || priceCutShare <= 0 ? null : priceCutShare,
  }
}
