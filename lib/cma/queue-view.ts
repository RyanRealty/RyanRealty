/**
 * Pure CMA queue presentation: filters, sort, and the money line.
 *
 * The DAL returns every origin in one list. This module is what the page
 * uses so a filter chip and a test cannot disagree on "what is work" or
 * "what the row says about price."
 */

import { formatPriceCompact, formatPriceExact } from '@/lib/format/money'
import { CMA_ORIGIN_LABEL, type CmaOrigin } from '@/lib/cma/origin'

/** Bare `/admin/cmas` opens the ready door, not the whole work pile. */
export const CMA_QUEUE_DEFAULT_STATE: CmaQueueViewState | 'all' | 'work' = 'ready'

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

/** Why a letter is held or failed. Ready, sent, and queued letters are `none`. */
export type CmaQueueWhy =
  | 'none'
  | 'wide-range'
  | 'failed-ask'
  | 'ask-in-band'
  | 'ask-below-band'
  | 'search-widened'
  | 'short-comps'
  | 'judge-unstable'
  | 'no-sales'
  | 'price-outside'
  | 'audit'
  | 'other'

/** How the queue may talk about reaching the owner. Email wins. A cell is text only when the line type says so. */
export type CmaQueueReach = 'email' | 'text' | 'unconfirmed-phone' | 'none'

export const CMA_QUEUE_PAGE_SIZE = 50

export const CMA_QUEUE_WHY_LABEL: Record<Exclude<CmaQueueWhy, 'none'>, string> = {
  'wide-range': 'Range is wide',
  'failed-ask': 'Ask did not sell',
  'ask-in-band': 'Ask inside the range',
  'ask-below-band': 'Price under the range',
  'search-widened': 'Search widened',
  'short-comps': 'Not enough sales',
  'judge-unstable': 'Comps did not agree',
  'no-sales': 'No closed sale nearby',
  'price-outside': 'Price outside the sales',
  audit: 'Audit failed',
  other: 'Other hold',
}

export type CmaQueueViewFilters = {
  q?: string
  city?: string
  origin?: CmaOrigin | 'all'
  state?: CmaQueueViewState | 'all' | 'work'
  why?: CmaQueueWhy | 'all'
  created?: CmaCreatedWindow
  rec?: CmaRecBand
  sort?: CmaQueueSort
  /** 1-based. Page 1 is omitted from the URL. */
  page?: number
}

export type CmaQueueViewRow = {
  id: string
  slug: string
  address: string
  city: string | null
  origin: CmaOrigin
  state: CmaQueueViewState
  why: CmaQueueWhy
  recommendedList: number | null
  valueLow: number | null
  valueHigh: number | null
  theirPrice: number | null
  theirPriceLabel: string | null
  theirPriceDelta: number | null
  contactName: string | null
  contactEmail: string | null
  contactReach?: CmaQueueReach
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

const VIEW_STATES = new Set<string>([...STATE_ORDER, 'archived', 'all', 'work'])
const SORTS = new Set<string>(['work', 'newest', 'price-asc', 'price-desc', 'city'])

function one(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v
  const t = s?.trim()
  return t || undefined
}

/** The ask-in-band hold's sentences, as lib/cma/gap-hold.ts writes them (with dollars or plain). */
const ASK_IN_BAND_START = /The last ask\b[^.]*?inside the sales range/
/** The ask-below-band hold's first sentence (askBelowBandReason, or the plain reason). */
const ASK_BELOW_BAND_START = /The recommended price\b[^.]*?under the sales range/
const HELD_START = new RegExp(`${ASK_IN_BAND_START.source}|${ASK_BELOW_BAND_START.source}`)
const ASK_IN_BAND_END = 'It was not queued and it was not sent.'

/**
 * The review reason with the ask-in-band hold first. The build appends the
 * hold after whatever was already on the row, and on an expired home that is
 * the failed-ask clamp sentence, so a cut line showed the clamp and lost the
 * hold (review, 2026-10-07). Other reasons keep their order.
 */
export function heldReasonFirst(reason: string): string {
  const at = reason.search(HELD_START)
  if (at <= 0) return reason
  const endAt = reason.indexOf(ASK_IN_BAND_END, at)
  const stop = endAt === -1 ? reason.length : endAt + ASK_IN_BAND_END.length
  const hold = reason.slice(at, stop).trim()
  const rest = `${reason.slice(0, at)} ${reason.slice(stop)}`.replace(/\s+/g, ' ').trim()
  return rest ? `${hold} ${rest}` : hold
}

/** How much of a flagged row's reason the queue list prints. */
export const CMA_QUEUE_LIST_REASON_CHARS = 140

/**
 * The one line under a flagged row in the queue list, cut to
 * CMA_QUEUE_LIST_REASON_CHARS. A held row leads with the hold, so the cut
 * never takes the reason Matt has to act on.
 */
export function cmaQueueListReason(
  r: { reviewReason?: string | null; holdKind?: string | null; state: CmaQueueViewState },
  max: number = CMA_QUEUE_LIST_REASON_CHARS,
): string {
  const reason = (r.reviewReason ?? '').trim()
  const why = cmaQueueWhy(r)
  if (why !== 'ask-in-band' && why !== 'ask-below-band') return reason ? reason.slice(0, max) : 'Flagged for review.'
  const led = heldReasonFirst(reason)
  const start = why === 'ask-in-band' ? ASK_IN_BAND_START : ASK_BELOW_BAND_START
  const line = start.test(led) ? led : `${CMA_QUEUE_WHY_LABEL[why]}. ${led}`.trim()
  return line.slice(0, max)
}

/**
 * The sentence on the letter itself. The queue row already names the bucket.
 * A ready, sent, or queued letter has nothing to hold it, so this is null.
 * A failed build keeps its own error line. This covers the holds that used
 * to vanish once you opened the letter.
 */
export function cmaQueueHoldLine(r: {
  state: CmaQueueViewState
  reviewReason?: string | null
  buildError?: string | null
  auditSummary?: string | null
  auditCriticalCount?: number | null
  holdKind?: string | null
}): string | null {
  const why = cmaQueueWhy(r)
  if (r.state === 'flagged') {
    const label = why === 'none' ? 'Flagged' : CMA_QUEUE_WHY_LABEL[why]
    const raw = (r.reviewReason ?? '').trim()
    const reason = why === 'ask-in-band' || why === 'ask-below-band' ? heldReasonFirst(raw) : raw
    if (!reason) return `${label}.`
    if (reason.toLowerCase().startsWith(label.toLowerCase())) return reason
    return `${label}. ${reason}`
  }
  if (r.state === 'audit-failed') {
    const n = r.auditCriticalCount ?? 0
    const head = n > 0 ? `Audit failed. ${n} critical.` : 'Audit failed.'
    const extra = (r.auditSummary ?? '').trim()
    return extra ? `${head} ${extra}` : head
  }
  if (r.state === 'unvetted') return 'Audit did not run. Nothing has checked this one.'
  return null
}

export function cmaQueueWhy(r: {
  state: CmaQueueViewState
  reviewReason?: string | null
  buildError?: string | null
  /** The build's stored hold (lib/data/cma/unified-queue.ts holdKind). */
  holdKind?: string | null
}): CmaQueueWhy {
  if (r.state === 'audit-failed') return 'audit'
  if (r.state === 'failed') {
    const err = (r.buildError ?? '').toLowerCase()
    if (err.includes('judge_unstable') || err.includes('did not agree')) return 'judge-unstable'
    if (err.includes('no closed sale')) return 'no-sales'
    if (err.includes('outside the sales')) return 'price-outside'
    // Every comp-shortage sentence the build writes: brokerCompRefusal, the
    // review keep, the product wall, pricingFailureMessage, and the walk.
    // brokerCompRefusal leads with the best path's count since 2026-10-08:
    // "The search in River West found 3 price-setting sales (...); 5 are needed."
    if (
      err.includes('not enough comparable') ||
      err.includes('closed sales this home needs') ||
      (err.includes('price-setting sale') && err.includes('are needed')) ||
      err.includes('set the price, and this home needs') ||
      err.includes('same product type') ||
      err.includes('comp shortage')
    ) {
      return 'short-comps'
    }
    return 'other'
  }
  if (r.state === 'flagged') {
    const reason = (r.reviewReason ?? '').toLowerCase()
    // Rule 22 first: the stored kind, then the phrase for rows built before
    // the field landed.
    if (r.holdKind === 'ask-in-band' || reason.includes('inside the sales range')) return 'ask-in-band'
    // The failed-ask ceiling under every sale that set the price: a hold, read
    // before the failed-ask bucket so the hold is the bucket Matt sees.
    if (r.holdKind === 'ask-below-band' || reason.includes('under the sales range')) return 'ask-below-band'
    if (reason.includes('wider than 8%')) return 'wide-range'
    if (
      reason.includes('just failed') ||
      reason.includes('failed to sell') ||
      reason.includes('under that ask') ||
      reason.includes('asking that')
    ) {
      return 'failed-ask'
    }
    if (reason.includes('widened one more') || reason.includes('bounded search')) return 'search-widened'
    return 'other'
  }
  return 'none'
}

export function cmaQueueReachFromFacts(args: {
  email: string | null
  hasConfirmedCell: boolean
  hasAnyPhone: boolean
}): CmaQueueReach {
  if ((args.email ?? '').trim()) return 'email'
  if (args.hasConfirmedCell) return 'text'
  if (args.hasAnyPhone) return 'unconfirmed-phone'
  return 'none'
}

/** Words on the row. Email needs none. A number is not called a cell unless the line type says so. */
export function cmaQueueReachNote(reach: CmaQueueReach | null | undefined): string | null {
  if (reach === 'text') return 'text'
  if (reach === 'unconfirmed-phone') return 'phone on file, not a confirmed cell'
  if (reach === 'none') return 'no email'
  return null
}

export function toCmaQueueViewRow(r: {
  id: string
  slug: string
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
  contactReach?: CmaQueueReach
  createdAt: string | null
  reviewReason?: string | null
  buildError?: string | null
  holdKind?: string | null
}): CmaQueueViewRow {
  return {
    id: r.id,
    slug: r.slug,
    address: r.address,
    city: r.city,
    origin: r.origin,
    state: r.state,
    why: cmaQueueWhy(r),
    recommendedList: r.recommendedList,
    valueLow: r.valueLow,
    valueHigh: r.valueHigh,
    theirPrice: r.theirPrice,
    theirPriceLabel: r.theirPriceLabel,
    theirPriceDelta: r.theirPriceDelta,
    contactName: r.contactName,
    contactEmail: r.contactEmail,
    contactReach: r.contactReach,
    createdAt: r.createdAt,
  }
}

export function sliceCmaQueuePage<T>(
  rows: readonly T[],
  page: number | undefined,
  size: number = CMA_QUEUE_PAGE_SIZE,
): { page: number; pages: number; start: number; end: number; rows: T[] } {
  const pages = rows.length === 0 ? 0 : Math.ceil(rows.length / size)
  const current = pages === 0 ? 1 : Math.min(Math.max(page ?? 1, 1), pages)
  const startIndex = rows.length === 0 ? 0 : (current - 1) * size
  const slice = rows.slice(startIndex, startIndex + size)
  return {
    page: current,
    pages,
    start: rows.length === 0 ? 0 : startIndex + 1,
    end: startIndex + slice.length,
    rows: [...slice],
  }
}

export function cmaQueueWalk(
  slugs: readonly string[],
  slug: string,
  pageSize: number = CMA_QUEUE_PAGE_SIZE,
): { index: number; prev: string | null; next: string | null; page: number; total: number } {
  const index = slugs.findIndex((s) => s === slug)
  if (index < 0) return { index: -1, prev: null, next: null, page: 1, total: slugs.length }
  return {
    index,
    prev: index > 0 ? slugs[index - 1]! : null,
    next: index < slugs.length - 1 ? slugs[index + 1]! : null,
    page: Math.floor(index / pageSize) + 1,
    total: slugs.length,
  }
}

export function cmaQueueFiltersFromSearch(
  sp: Record<string, string | string[] | undefined>,
): CmaQueueViewFilters {
  const filters: CmaQueueViewFilters = {}
  const q = one(sp.q)
  const city = one(sp.city)
  const state = one(sp.state)
  const why = one(sp.why)
  const origin = one(sp.origin)
  const created = one(sp.created)
  const rec = one(sp.rec)
  const sort = one(sp.sort)
  const page = Number(one(sp.page))
  if (q) filters.q = q
  if (city) filters.city = city
  if (origin && (origin === 'all' || origin in CMA_ORIGIN_LABEL)) filters.origin = origin as CmaOrigin | 'all'
  if (state && VIEW_STATES.has(state)) filters.state = state as CmaQueueViewState | 'all' | 'work'
  if (why && why in CMA_QUEUE_WHY_LABEL) filters.why = why as CmaQueueWhy
  if (created && created !== 'all' && created in CREATED_MS) filters.created = created as CmaCreatedWindow
  if (rec && rec !== 'all' && rec in REC_BANDS) filters.rec = rec as CmaRecBand
  if (sort && sort !== 'work' && SORTS.has(sort)) filters.sort = sort as CmaQueueSort
  if (Number.isInteger(page) && page > 1) filters.page = page
  return filters
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
  const state = filters.state ?? CMA_QUEUE_DEFAULT_STATE

  return rows.filter((r) => {
    if (q && !haystack(r).includes(q)) return false
    if (city && (r.city ?? '').toLowerCase() !== city) return false
    if (origin && r.origin !== origin) return false
    if (filters.why && filters.why !== 'all' && r.why !== filters.why) return false
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
  const rec = `Rec ${formatPriceCompact(r.recommendedList)}`
  const range =
    r.valueLow != null && r.valueHigh != null
      ? `${formatPriceCompact(r.valueLow)}-${formatPriceCompact(r.valueHigh)}`
      : null
  const head = range ? `${rec} · ${range}` : rec
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

export function cmaQueueWhoLine(
  r: Pick<CmaQueueViewRow, 'address' | 'city' | 'contactName' | 'contactEmail'>,
): string {
  const who = r.contactName ?? r.contactEmail ?? 'no contact on file'
  const city = (r.city ?? '').trim()
  if (!city) return who
  if ((r.address ?? '').toLowerCase().includes(city.toLowerCase())) return who
  return `${city} · ${who}`
}

export function cmaQueueHref(filters: CmaQueueViewFilters): string {
  const p = new URLSearchParams()
  if (filters.q) p.set('q', filters.q)
  if (filters.city) p.set('city', filters.city)
  if (filters.origin && filters.origin !== 'all') p.set('origin', filters.origin)
  if (filters.state && filters.state !== CMA_QUEUE_DEFAULT_STATE) p.set('state', filters.state)
  if (filters.why && filters.why !== 'all' && filters.why !== 'none') p.set('why', filters.why)
  if (filters.page && filters.page > 1) p.set('page', String(filters.page))
  if (filters.created && filters.created !== 'all') p.set('created', filters.created)
  if (filters.rec && filters.rec !== 'all') p.set('rec', filters.rec)
  if (filters.sort && filters.sort !== 'work') p.set('sort', filters.sort)
  const q = p.toString()
  return q ? `/admin/cmas?${q}` : '/admin/cmas'
}

export function cmaReviewHref(slug: string, filters: CmaQueueViewFilters): string {
  const list = cmaQueueHref(filters)
  const qs = list.includes('?') ? list.slice(list.indexOf('?')) : ''
  return `/admin/cmas/${slug}${qs}`
}

export function theirPriceFromBuildSummary(summary: unknown, origin: CmaOrigin): number | null {
  if (origin !== 'expired' && origin !== 'fsbo') return null
  const sub = (summary as { subject?: { last_list_price?: unknown } } | null)?.subject
  const n = typeof sub?.last_list_price === 'number' ? sub.last_list_price : Number(sub?.last_list_price)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Prospect row wins (queue already does this). Summary is the fallback. */
export function resolveTheirPrice(
  origin: CmaOrigin,
  summary: unknown,
  prospectAsk: number | null | undefined,
): number | null {
  if (origin !== 'expired' && origin !== 'fsbo') return null
  if (typeof prospectAsk === 'number' && Number.isFinite(prospectAsk) && prospectAsk > 0) {
    return prospectAsk
  }
  return theirPriceFromBuildSummary(summary, origin)
}
