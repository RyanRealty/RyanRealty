import 'server-only'
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * getCrmSuppressions — the paged read side of the compliance suppression list
 * (Wave 2 config, the Block List admin). The FUB "Block List" folds in here:
 * every consent record (do-not-text, do-not-call, unsubscribed, bounced, the
 * compliance hard-stops and litigator flags) lives in crm_suppressions, and
 * this reader is how the admin surface sees who is suppressed and why.
 *
 * Each row resolves the person it blocks (name + a contact value) so the admin
 * can read the list without a second query per row. crm_suppressions.person_id
 * is nullable (value-keyed rows exist before a person is matched), so a row may
 * have no person — `value` then carries the raw email/phone the row blocks.
 *
 * DAL boundary (G1): the raw .from() reads live here, inside lib/data/. Cached
 * briefly (60s) — the list changes on every manual add/lift, and the mutation
 * actions revalidate the tag so the cache + page refresh immediately.
 *
 * Fails SOFT (empty rows, count 0, unreadable:true) on an unreadable table so
 * the admin surface renders a red/zero state rather than crashing — and the
 * compliance chokepoint (lib/crm/suppressions.ts isSuppressed) is unaffected by
 * this read path; it always fails CLOSED on its own.
 */

export const CRM_SUPPRESSIONS_TAG = 'crm-suppressions' as const

export type CrmSuppressionChannel = 'all' | 'email' | 'sms' | 'call'

/** A suppression row as the admin list renders it. */
export type CrmSuppressionRow = {
  id: number
  personId: number | null
  personName: string | null
  /** The contact value this row blocks (email/phone), from the row or the person. */
  value: string | null
  channel: CrmSuppressionChannel
  reason: string
  source: string
  createdAt: string
  /** Whether lifting this row needs an explicit confirm (compliance/litigator). */
  isCompliance: boolean
}

export type CrmSuppressionsResult = {
  rows: CrmSuppressionRow[]
  /** Total matching the filter (for pagination), not the page length. */
  count: number
  unreadable: boolean
}

export type GetCrmSuppressionsParams = {
  channel?: CrmSuppressionChannel
  q?: string
  limit?: number
  offset?: number
}

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

/**
 * Reasons whose lift must be deliberate and single-record (per the TCPA memory:
 * a compliance hard-stop or a litigator flag is a legal liability — lifting it
 * is never casual and never bulk). Matched case-insensitively as a substring so
 * variant spellings (compliance:hard-stop, tcpa-hard-stop, litigator, etc.) all
 * trip the confirm requirement. PURE — exported so the action + the test share
 * one source of truth for what "compliance" means.
 */
export const COMPLIANCE_REASON_MARKERS: readonly string[] = [
  'hard-stop',
  'hard_stop',
  'litigator',
  'tcpa',
  'do-not-call',
  'do_not_call',
  'do-not-text',
  'do_not_text',
]

/** True when a reason marks a compliance/litigator suppression. PURE. */
export function isComplianceReason(reason: string | null | undefined): boolean {
  if (!reason) return false
  const r = reason.toLowerCase()
  return COMPLIANCE_REASON_MARKERS.some((m) => r.includes(m))
}

/** Coerce a raw channel string to a valid channel (default 'all'). PURE. */
export function normalizeSuppressionChannel(raw: unknown): CrmSuppressionChannel {
  const c = String(raw ?? '').trim().toLowerCase()
  if (c === 'email' || c === 'sms' || c === 'call') return c
  return 'all'
}

/** Clamp a requested page size into the allowed band. PURE. */
export function clampLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit) || (limit ?? 0) <= 0) return DEFAULT_LIMIT
  return Math.min(MAX_LIMIT, Math.floor(limit as number))
}

/** Clamp an offset to a non-negative integer. PURE. */
export function clampOffset(offset: number | undefined): number {
  if (!Number.isFinite(offset) || (offset ?? 0) <= 0) return 0
  return Math.floor(offset as number)
}

/**
 * Pick a human contact value for a person from the suppression row + person.
 * Prefers the row's own `value` (the exact address it blocks), then a primary
 * email, then a primary phone. PURE — exported for the test.
 */
export function resolveSuppressionValue(
  rowValue: string | null | undefined,
  emails: unknown,
  phones: unknown,
): string | null {
  const direct = typeof rowValue === 'string' ? rowValue.trim() : ''
  if (direct) return direct
  const pick = (arr: unknown): string | null => {
    if (!Array.isArray(arr)) return null
    const sorted = [...arr].sort(
      (a, b) => Number(!!(b as { isPrimary?: unknown })?.isPrimary) - Number(!!(a as { isPrimary?: unknown })?.isPrimary),
    )
    for (const e of sorted) {
      const v = (e as { value?: unknown })?.value
      if (typeof v === 'string' && v.trim()) return v.trim()
    }
    return null
  }
  return pick(emails) ?? pick(phones)
}

type RawSuppressionRow = {
  id: number
  person_id: number | null
  channel: string
  value: string | null
  reason: string
  source: string
  created_at: string
}

type RawPersonRow = { id: number; name: string | null; emails: unknown; phones: unknown }

/** Build the final CrmSuppressionRow set from raw rows + a person lookup. PURE. */
export function buildSuppressionRows(
  rows: RawSuppressionRow[],
  people: Map<number, RawPersonRow>,
): CrmSuppressionRow[] {
  return rows.map((r) => {
    const person = r.person_id != null ? people.get(r.person_id) ?? null : null
    return {
      id: Number(r.id),
      personId: r.person_id != null ? Number(r.person_id) : null,
      personName: person?.name ?? null,
      value: resolveSuppressionValue(r.value, person?.emails, person?.phones),
      channel: normalizeSuppressionChannel(r.channel),
      reason: String(r.reason ?? ''),
      source: String(r.source ?? 'import'),
      createdAt: String(r.created_at),
      isCompliance: isComplianceReason(r.reason),
    }
  })
}

async function read(params: GetCrmSuppressionsParams): Promise<CrmSuppressionsResult> {
  const sb = createServiceClient()
  const limit = clampLimit(params.limit)
  const offset = clampOffset(params.offset)
  const q = params.q?.trim().toLowerCase() ?? ''

  // When a search term is present, resolve it to a set of candidate person ids
  // (name/email/phone) FIRST, then constrain the suppression read. A bare
  // value-keyed suppression row (no person) is also matched by its own `value`
  // column via an OR, so searching an email finds both the row-level block and
  // any person-linked block.
  let personIdFilter: number[] | null = null
  if (q) {
    const { data: pts } = await sb
      .from('crm_contact_points')
      .select('person_id')
      .ilike('value', `%${q}%`)
      .limit(500)
    const ptIds = (pts ?? []).map((p) => Number(p.person_id)).filter((n) => Number.isFinite(n))
    const { data: byName } = await sb
      .from('crm_people')
      .select('id')
      .ilike('name', `%${q}%`)
      .limit(500)
    const nameIds = (byName ?? []).map((p) => Number(p.id)).filter((n) => Number.isFinite(n))
    personIdFilter = Array.from(new Set([...ptIds, ...nameIds]))
  }

  let query = sb
    .from('crm_suppressions')
    .select('id,person_id,channel,value,reason,source,created_at', { count: 'exact' })

  if (params.channel) query = query.eq('channel', params.channel)

  if (q) {
    const ids = personIdFilter ?? []
    // Match a person-linked row (person_id in the candidate set) OR a row whose
    // own value column contains the term. Empty id list still matches value rows.
    const idClause = ids.length ? `person_id.in.(${ids.join(',')})` : 'person_id.is.null'
    query = query.or(`${idClause},value.ilike.%${q}%`)
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error || !data) {
    if (error) console.error('[getCrmSuppressions]', error.message)
    return { rows: [], count: 0, unreadable: true }
  }

  const raw = data as RawSuppressionRow[]
  const personIds = Array.from(
    new Set(raw.map((r) => r.person_id).filter((v): v is number => v != null)),
  )
  const people = new Map<number, RawPersonRow>()
  if (personIds.length) {
    const { data: pData } = await sb
      .from('crm_people')
      .select('id,name,emails,phones')
      .in('id', personIds)
    for (const p of (pData ?? []) as RawPersonRow[]) people.set(Number(p.id), p)
  }

  return { rows: buildSuppressionRows(raw, people), count: count ?? 0, unreadable: false }
}

/**
 * Cached entry point. Cache key folds in the filter so distinct filters get
 * distinct cache entries; the mutation actions revalidate the tag on every
 * add/lift so the whole list refreshes.
 */
export async function getCrmSuppressions(
  params: GetCrmSuppressionsParams = {},
): Promise<CrmSuppressionsResult> {
  const channel = params.channel ?? 'any'
  const q = params.q?.trim().toLowerCase() ?? ''
  const limit = clampLimit(params.limit)
  const offset = clampOffset(params.offset)
  const cached = unstable_cache(
    () => read(params),
    ['crm-suppressions', channel, q, String(limit), String(offset)],
    { tags: [CRM_SUPPRESSIONS_TAG], revalidate: 60 },
  )
  return cached()
}
