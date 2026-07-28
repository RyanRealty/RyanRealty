import 'server-only'

/**
 * ONE parameterized worklist reader over both prospect kinds (spec 07 §4.7 /
 * §7). Replaces lib/data/expired/dashboard.ts (208 lines) and
 * lib/data/fsbo/dashboard.ts (95% copy, 186 lines) with one function keyed by
 * `kind`.
 *
 * The base row set (~144-159 expired / ~155 fsbo rows today, per spec §0) is
 * small and bounded — reading and classifying all of it every call is what
 * makes the summary chips (spec §2) and the status filter accurate, and is
 * the same "full table, batch-joined in memory" shape lib/data/expired/
 * dashboard.ts already used. What §7 explicitly forbids scaling with row
 * count is the `listings` photo/lat/lng join and the engagement read — both
 * are scoped to the requested page only, never the full set.
 */

import { makeResilientCached } from '@/lib/data/cache/resilient'
import { createServiceClient } from '@/lib/supabase/service'
import {
  computeSendable,
  engagementKeyFor,
  fetchExpiredListingJoinBatch,
  finalizeRow,
  mapExpiredSkeleton,
  mapFsboSkeleton,
  markEmailOutreachColumnsAbsent,
  prospectSelect,
  prospectSelectLegacy,
  shouldRetryWithoutEmailColumns,
  type ExpiredListingJoin,
  type ProspectRowSkeleton,
} from './get'
import { resolveDocsBatch, resolveComplianceBatch } from './batch'
import { getProspectEngagement } from './engagement'
import { blockAllChannels } from './types'
import type { ProspectComplianceState, ProspectDocState, ProspectKind, ProspectListFilters, ProspectListResult, ProspectRow, ProspectSortKey, ProspectStatusFilter, ProspectSummary, SortDir } from './types'

type RawRow = Record<string, unknown>

// Fail-closed default when a per-row compliance entry is somehow missing.
const FAILSAFE_COMPLIANCE: ProspectComplianceState = {
  hardStop: true,
  flags: [],
  relisted: false,
  offMarket: false,
  suppressedSms: true,
  noPhone: true,
  noEmail: true,
  reasons: ['compliance unresolved'],
  channels: blockAllChannels('Compliance unresolved'),
  allChannelsBlocked: true,
}

const EMPTY_SUMMARY: ProspectSummary = {
  total: 0,
  sendable: 0,
  needsAudit: 0,
  sent: 0,
  excluded: 0,
  noPhone: 0,
}

/** Strip characters that would break an ilike/`.or()` filter expression. */
function sanitizeSearchTerm(term: string): string {
  return term.replace(/[%,()]/g, ' ').trim()
}

type BaseListFilters = Pick<ProspectListFilters, 'q' | 'city' | 'minPrice' | 'maxPrice' | 'dateAfter' | 'dateBefore'>

async function fetchRawProspectRows(kind: ProspectKind, filters: BaseListFilters): Promise<RawRow[]> {
  const sb = createServiceClient()
  const table = kind === 'expired' ? 'expired_listings' : 'fsbo_listings'
  const dateColumn = kind === 'expired' ? 'expired_at' : 'detected_at'

  const runQuery = async (select: string) => {
    let q = sb.from(table).select(select)

    const term = filters.q ? sanitizeSearchTerm(filters.q) : ''
    if (term) {
      q = q.or(`street_address.ilike.%${term}%,owner_name.ilike.%${term}%,full_address.ilike.%${term}%`)
    }
    if (filters.city?.trim()) q = q.eq('city', filters.city.trim())
    if (filters.minPrice != null) q = q.gte('list_price', filters.minPrice)
    if (filters.maxPrice != null) q = q.lte('list_price', filters.maxPrice)
    if (filters.dateAfter) q = q.gte(dateColumn, filters.dateAfter)
    if (filters.dateBefore) q = q.lte(dateColumn, filters.dateBefore)

    // The prospect universe is small (~150-160 rows/kind, spec §0) — this cap
    // documents the bound explicitly rather than relying on PostgREST's
    // implicit 1,000-row default (the old unbounded reads this replaces
    // silently truncated there, spec Defect 11).
    return q.order(dateColumn, { ascending: false, nullsFirst: false }).limit(1000)
  }

  let { data, error } = await runQuery(prospectSelect(kind))
  if (error && shouldRetryWithoutEmailColumns(error)) {
    // Migration 20260722010100 not applied yet — render pre-migration.
    markEmailOutreachColumnsAbsent()
    ;({ data, error } = await runQuery(prospectSelectLegacy(kind)))
  }
  // THROW on a transient DB error so makeResilientCached never caches an empty
  // result (poison-null gate G): an error must not masquerade as "no prospects".
  if (error) throw new Error(`prospecting base read failed: ${error.message}`)
  return (data ?? []) as unknown as RawRow[]
}

// Short-TTL cache on the base row set only (spec §7: "the base list can be
// short-TTL cached"). makeResilientCached serves the last good value (or the []
// fallback) on a transient error instead of caching the empty. Classification
// (doc/compliance) + engagement are cached separately at their own layers.
const cachedFetchExpiredRows = makeResilientCached(
  (filters: BaseListFilters) => fetchRawProspectRows('expired', filters),
  ['prospecting-list-expired-v1'],
  { revalidate: 30, tags: ['prospecting:list:expired'] },
  [] as RawRow[],
)
const cachedFetchFsboRows = makeResilientCached(
  (filters: BaseListFilters) => fetchRawProspectRows('fsbo', filters),
  ['prospecting-list-fsbo-v1'],
  { revalidate: 30, tags: ['prospecting:list:fsbo'] },
  [] as RawRow[],
)

type Bucket = 'sendable' | 'needs-audit' | 'sent' | 'excluded' | 'no-phone'

function classify(doc: ProspectDocState, compliance: ProspectRowSkeleton['compliance'], sendable: boolean): Bucket {
  if (doc.state === 'sent') return 'sent'
  if (doc.state !== 'ready') return 'needs-audit'
  // doc is ready and not yet sent.
  const blockedOnlyByPhone =
    compliance.noPhone && !compliance.hardStop && !compliance.relisted && !compliance.offMarket && !compliance.suppressedSms
  if (blockedOnlyByPhone) return 'no-phone'
  return sendable ? 'sendable' : 'excluded'
}

function computeSummary(classified: Array<{ bucket: Bucket }>): ProspectSummary {
  const summary: ProspectSummary = { ...EMPTY_SUMMARY, total: classified.length }
  for (const { bucket } of classified) {
    if (bucket === 'sendable') summary.sendable++
    else if (bucket === 'needs-audit') summary.needsAudit++
    else if (bucket === 'sent') summary.sent++
    else if (bucket === 'excluded') summary.excluded++
    else if (bucket === 'no-phone') summary.noPhone++
  }
  return summary
}

/** Doc states ranked so "audit" sorts as progress: none < building < failed < ready < sent. */
const DOC_RANK: Record<ProspectDocState['state'], number> = {
  none: 0,
  building: 1,
  failed: 2,
  ready: 3,
  sent: 4,
}

type Classified = { skeleton: ProspectRowSkeleton; sendable: boolean; bucket: Bucket }

/**
 * In-memory sort over the classified set. Nulls always sink to the bottom
 * regardless of direction — a row with no price or no audit is the least useful
 * thing to look at, so it should never win the first screen just because the
 * sort flipped. Ties break on the kind's own date so the order is stable.
 */
function sortClassified(rows: Classified[], key: ProspectSortKey, dir: SortDir): void {
  const mul = dir === 'asc' ? 1 : -1
  const dateOf = (s: ProspectRowSkeleton) => (s.kind === 'expired' ? s.expiredAt : s.detectedAt) ?? ''
  const textOf = (s: ProspectRowSkeleton): string | null => {
    if (key === 'owner') return s.ownerName
    if (key === 'city') return s.city
    return s.fullAddress ?? s.streetAddress
  }
  const numOf = (c: Classified): number | null => {
    if (key === 'price') return c.skeleton.listPrice
    if (key === 'recommended') {
      const d = c.skeleton.doc
      return d.state === 'ready' || d.state === 'sent' ? d.recommendedList : null
    }
    if (key === 'audit') return DOC_RANK[c.skeleton.doc.state]
    return null
  }

  rows.sort((a, b) => {
    let cmp = 0
    if (key === 'date') {
      cmp = dateOf(a.skeleton).localeCompare(dateOf(b.skeleton))
    } else if (key === 'owner' || key === 'city' || key === 'address') {
      const av = textOf(a.skeleton)
      const bv = textOf(b.skeleton)
      if (!av && !bv) cmp = 0
      else if (!av) return 1
      else if (!bv) return -1
      else cmp = av.localeCompare(bv, 'en-US', { sensitivity: 'base', numeric: true })
    } else {
      const av = numOf(a)
      const bv = numOf(b)
      if (av == null && bv == null) cmp = 0
      else if (av == null) return 1
      else if (bv == null) return -1
      else cmp = av - bv
    }
    if (cmp !== 0) return cmp * mul
    return dateOf(b.skeleton).localeCompare(dateOf(a.skeleton))
  })
}

const STATUS_TO_BUCKET: Partial<Record<ProspectStatusFilter, Bucket>> = {
  sendable: 'sendable',
  'needs-audit': 'needs-audit',
  sent: 'sent',
  excluded: 'excluded',
  'no-phone': 'no-phone',
}

/**
 * The prospecting worklist read (spec §4.7/§7). Bounded, parameterized over
 * `kind`, applies server-side filters, computes summary counts + the
 * distinct-cities list from the full (small) matching set, then scopes the
 * expensive per-row reads (listings photo/lat/lng join, engagement) to only
 * the requested page.
 */
export async function listProspects(filters: ProspectListFilters): Promise<ProspectListResult> {
  const kind = filters.kind
  const page = Math.max(1, Math.floor(filters.page ?? 1))
  const pageSize = Math.min(Math.max(Math.floor(filters.pageSize ?? 25), 1), 100)

  const baseFilters: BaseListFilters = {
    q: filters.q,
    city: filters.city,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    dateAfter: filters.dateAfter,
    dateBefore: filters.dateBefore,
  }

  let rawRows: RawRow[]
  try {
    rawRows = kind === 'expired' ? await cachedFetchExpiredRows(baseFilters) : await cachedFetchFsboRows(baseFilters)
  } catch (e) {
    console.error('[prospecting] listProspects cache read threw:', e instanceof Error ? e.message : e)
    rawRows = []
  }

  // Batch the doc + compliance resolution for the WHOLE matching set (spec §7):
  // ~4 queries total instead of ~3 per row. The per-row builders (get.ts) are
  // kept for the single-row getProspect path only.
  const idKey = kind === 'expired' ? 'listing_key' : 'fsbo_url'
  const [docMap, complianceMap] = await Promise.all([
    resolveDocsBatch(kind, rawRows),
    resolveComplianceBatch(kind, rawRows),
  ])
  const skeletons: ProspectRowSkeleton[] = rawRows.map((r) => {
    const id = String(r[idKey])
    const doc: ProspectDocState = docMap.get(id) ?? { state: 'none' }
    const compliance = complianceMap.get(id) ?? FAILSAFE_COMPLIANCE
    return kind === 'expired' ? mapExpiredSkeleton(r, doc, compliance, null) : mapFsboSkeleton(r, doc, compliance)
  })

  const classified = skeletons.map((skeleton) => {
    const sendable = computeSendable(skeleton.doc, skeleton.compliance)
    return { skeleton, sendable, bucket: classify(skeleton.doc, skeleton.compliance, sendable) }
  })

  const summary = computeSummary(classified)
  const cities = [
    ...new Set(
      rawRows
        .map((r) => (r.city as string | null | undefined))
        .filter((c): c is string => !!c && c.trim().length > 0)
        .map((c) => c.trim()),
    ),
  ].sort((a, b) => a.localeCompare(b))

  const wantBucket = filters.status ? STATUS_TO_BUCKET[filters.status] : undefined
  const filtered = wantBucket ? classified.filter((c) => c.bucket === wantBucket) : classified

  sortClassified(filtered, filters.sort ?? 'date', filters.dir ?? 'desc')

  const total = filtered.length
  const from = (page - 1) * pageSize
  const pageSlice = filtered.slice(from, from + pageSize)

  // Scope the listings photo/lat/lng join to the visible page only (spec §7).
  const sb = createServiceClient()
  const listingsByKey: Map<string, ExpiredListingJoin> =
    kind === 'expired'
      ? await fetchExpiredListingJoinBatch(sb, pageSlice.map((c) => c.skeleton.id))
      : new Map()

  // Batch the engagement read for the page's docs — never per-row (spec §7).
  const engagementKeys = pageSlice.map((c) => engagementKeyFor(c.skeleton))
  const engagementMap = await getProspectEngagement(kind, engagementKeys)

  const rows: ProspectRow[] = pageSlice.map(({ skeleton }) => {
    const listing = listingsByKey.get(skeleton.id)
    const patched: ProspectRowSkeleton = listing
      ? { ...skeleton, photoUrl: listing.photoUrl, latitude: listing.latitude, longitude: listing.longitude, listedAt: listing.listDate }
      : skeleton
    return finalizeRow(patched, engagementMap[skeleton.id])
  })

  return { rows, total, summary, page, pageSize, cities }
}
