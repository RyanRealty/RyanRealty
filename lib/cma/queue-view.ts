/**
 * Pure CMA queue presentation: filters, sort, and the money line.
 *
 * The DAL returns every origin in one list. This module is what the page
 * uses so a filter chip and a test cannot disagree on "what is work" or
 * "what the row says about price."
 */

import { formatPriceExact } from '@/lib/format/money'
import type { CmaOrigin } from '@/lib/cma/origin'

export type CmaQueueViewState =
  | 'failed'
  | 'building'
  | 'audit-failed'
  | 'unvetted'
  | 'flagged'
  | 'ready'
  | 'queued'
  | 'sent'
  | 'archived'

export type CmaCreatedWindow = '7d' | '30d' | '90d' | 'all'
export type CmaRecBand = 'lt400' | '400-600' | '600-800' | '800-1m' | 'gt1m' | 'all'
export type CmaQueueSort = 'work' | 'newest' | 'price-asc' | 'price-desc' | 'city'

export type CmaQueueViewFilters = {
  q?: string
  city?: string
  origin?: CmaOrigin | 'all'
  state?: CmaQueueViewState | 'all' | 'work'
  created?: CmaCreatedWindow
  rec?: CmaRecBand
  sort?: CmaQueueSort
}

export type CmaQueueViewRow = {
  id: string
  address: string
  city: string | null
  origin: CmaOrigin
  state: CmaQueueViewState
  recommendedList: number | null
  valueLow: number | null
  valueHigh: number | null
  theirPrice: number | null
  theirPriceLabel: string | null
  theirPriceDelta: number | null
  contactName: string | null
  contactEmail: string | null
  createdAt: string | null
}

const WORK_STATES: ReadonlySet<CmaQueueViewState> = new Set([
  'ready',
  'unvetted',
  'flagged',
  'audit-failed',
  'failed',
  'building',
  'queued',
])

const STATE_ORDER: CmaQueueViewState[] = [
  'ready',
  'unvetted',
  'flagged',
  'audit-failed',
  'failed',
  'building',
  'queued',
  'sent',
]

const REC_BANDS: Record<Exclude<CmaRecBand, 'all'>, { min: number; max: number }> = {
  lt400: { min: 0, max: 400_000 },
  '400-600': { min: 400_000, max: 600_000 },
  '600-800': { min: 600_000, max: 800_000 },
  '800-1m': { min: 800_000, max: 1_000_000 },
  gt1m: { min: 1_000_000, max: Number.POSITIVE_INFINITY },
}

const CREATED_MS: Record<Exclude<CmaCreatedWindow, 'all'>, number> = {
  '7d': 7 * 86_400_000,
  '30d': 30 * 86_400_000,
  '90d': 90 * 86_400_000,
}

function haystack(r: CmaQueueViewRow): string {
  return [r.address, r.city, r.contactName, r.contactEmail].filter(Boolean).join(' ').toLowerCase()
}

function inRecBand(n: number | null, band: CmaRecBand | undefined): boolean {
  if (!band || band === 'all') return true
  if (n == null) return false
  const { min, max } = REC_BANDS[band]
  return n >= min && n < max
}

function inCreatedWindow(iso: string | null, window: CmaCreatedWindow | undefined, nowMs: number): boolean {
  if (!window || window === 'all') return true
  if (!iso) return false
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return false
  return nowMs - t <= CREATED_MS[window]
}

export function filterCmaQueueRows(
  rows: CmaQueueViewRow[],
  filters: CmaQueueViewFilters,
  nowMs: number = Date.now(),
): CmaQueueViewRow[] {
  const q = (filters.q ?? '').trim().toLowerCase()
  const city = (filters.city ?? '').trim().toLowerCase()
  const origin = filters.origin && filters.origin !== 'all' ? filters.origin : null
  const state = filters.state ?? 'work'

  return rows.filter((r) => {
    if (q && !haystack(r).includes(q)) return false
    if (city && (r.city ?? '').toLowerCase() !== city) return false
    if (origin && r.origin !== origin) return false
    if (state === 'work') {
      if (!WORK_STATES.has(r.state)) return false
    } else if (state !== 'all' && r.state !== state) return false
    if (!inRecBand(r.recommendedList, filters.rec)) return false
    if (!inCreatedWindow(r.createdAt, filters.created, nowMs)) return false
    return true
  })
}

export function sortCmaQueueRows(rows: CmaQueueViewRow[], sort: CmaQueueSort | undefined): CmaQueueViewRow[] {
  const mode = sort ?? 'work'
  const copy = [...rows]
  copy.sort((a, b) => {
    if (mode === 'price-asc' || mode === 'price-desc') {
      const av = a.recommendedList
      const bv = b.recommendedList
      if (av == null && bv == null) return (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
      if (av == null) return 1
      if (bv == null) return -1
      return mode === 'price-asc' ? av - bv : bv - av
    }
    if (mode === 'city') {
      const c = (a.city ?? '').localeCompare(b.city ?? '')
      if (c !== 0) return c
      return (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
    }
    if (mode === 'newest') {
      return (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
    }
    const ai = STATE_ORDER.indexOf(a.state)
    const bi = STATE_ORDER.indexOf(b.state)
    if (ai !== bi) return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi)
    return (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
  })
  return copy
}

export function cmaQueueMoneyLine(r: Pick<
  CmaQueueViewRow,
  'valueLow' | 'valueHigh' | 'recommendedList' | 'theirPrice' | 'theirPriceLabel' | 'theirPriceDelta'
>): string {
  const rec = formatPriceExact(r.recommendedList)
  const range =
    r.valueLow != null && r.valueHigh != null
      ? `${formatPriceExact(r.valueLow)}-${formatPriceExact(r.valueHigh)}`
      : null
  const head = range ? `${range} · rec ${rec}` : `Rec ${rec}`
  if (r.theirPrice != null && r.theirPriceLabel) {
    const delta =
      r.theirPriceDelta == null
        ? null
        : Math.round(r.theirPriceDelta * 100) === 0
          ? 'same'
          : `${r.theirPriceDelta > 0 ? '+' : ''}${Math.round(r.theirPriceDelta * 100)}%`
    return `${head} · ${r.theirPriceLabel} ${formatPriceExact(r.theirPrice)}${delta ? ` (${delta})` : ''}`
  }
  return head
}

export function theirPriceFromBuildSummary(summary: unknown, origin: CmaOrigin): number | null {
  if (origin !== 'expired' && origin !== 'fsbo') return null
  const sub = (summary as { subject?: { last_list_price?: unknown } } | null)?.subject
  const n = typeof sub?.last_list_price === 'number' ? sub.last_list_price : Number(sub?.last_list_price)
  return Number.isFinite(n) && n > 0 ? n : null
}
