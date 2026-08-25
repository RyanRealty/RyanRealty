import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { normalizeLast10, STALE_AFTER_DAYS, type DncScrubResult } from '@/lib/crm/dnc-scrub'

/**
 * Read/write side of crm_phone_dnc_checks.
 *
 * DAL boundary (G1): the raw .from('crm_phone_dnc_checks') calls live here.
 *
 * The contract every caller depends on: a number with NO row is UNKNOWN, never
 * clean. Three states, and the send surfaces must be able to tell them apart —
 * that ambiguity is the whole reason the table exists.
 */

export type DncStatus =
  | { state: 'unchecked' }
  | { state: 'clean'; checkedAt: string; stale: boolean }
  | { state: 'flagged'; checkedAt: string; stale: boolean; onDnc: boolean; isLitigator: boolean }

type Row = {
  phone_last10: string
  on_dnc: boolean
  is_litigator: boolean
  checked_at: string
}

function isStale(checkedAt: string): boolean {
  const ageMs = Date.now() - Date.parse(checkedAt)
  return ageMs > STALE_AFTER_DAYS * 24 * 60 * 60 * 1000
}

function toStatus(row: Row | undefined): DncStatus {
  if (!row) return { state: 'unchecked' }
  const stale = isStale(row.checked_at)
  if (row.on_dnc || row.is_litigator) {
    return { state: 'flagged', checkedAt: row.checked_at, stale, onDnc: row.on_dnc, isLitigator: row.is_litigator }
  }
  return { state: 'clean', checkedAt: row.checked_at, stale }
}

/** Status for one number. An unparseable number is 'unchecked', never clean. */
export async function getDncStatus(phone: string): Promise<DncStatus> {
  const last10 = normalizeLast10(phone)
  if (!last10) return { state: 'unchecked' }
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_phone_dnc_checks')
    .select('phone_last10,on_dnc,is_litigator,checked_at')
    .eq('phone_last10', last10)
    .maybeSingle()
  // Fail to UNKNOWN, not to clean: an unreadable compliance table must never
  // read as permission.
  if (error) return { state: 'unchecked' }
  return toStatus((data as Row | null) ?? undefined)
}

/** Status for many numbers in one query, keyed by last-10. */
export async function getDncStatuses(phones: string[]): Promise<Map<string, DncStatus>> {
  const last10s = [...new Set(phones.map(normalizeLast10).filter((p): p is string => !!p))]
  const out = new Map<string, DncStatus>()
  for (const p of last10s) out.set(p, { state: 'unchecked' })
  if (last10s.length === 0) return out
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_phone_dnc_checks')
    .select('phone_last10,on_dnc,is_litigator,checked_at')
    .in('phone_last10', last10s)
  if (error) return out
  for (const row of (data ?? []) as Row[]) out.set(row.phone_last10, toStatus(row))
  return out
}

/** Persist scrub results. Upsert by number — a re-check refreshes checked_at. */
export async function recordDncChecks(
  results: DncScrubResult[],
): Promise<{ ok: true; written: number } | { ok: false; error: string }> {
  if (results.length === 0) return { ok: true, written: 0 }
  const sb = createServiceClient()
  const rows = results.map((r) => ({
    phone_last10: r.phoneLast10,
    on_dnc: r.onDnc,
    is_litigator: r.isLitigator,
    line_type: r.lineType,
    carrier: r.carrier,
    source: 'batchdata',
    checked_at: new Date().toISOString(),
    raw: r.raw,
  }))
  const { error } = await sb.from('crm_phone_dnc_checks').upsert(rows, { onConflict: 'phone_last10' })
  if (error) return { ok: false, error: error.message }
  return { ok: true, written: rows.length }
}

/**
 * Phones on live contacts that have never been checked (or whose check went
 * stale), newest contacts first. The backlog a scrub run works through.
 */
export async function listUncheckedPhones(limit: number): Promise<string[]> {
  const sb = createServiceClient()
  const { data, error } = await sb.rpc('crm_unchecked_dnc_phones', { p_limit: limit })
  if (error) throw new Error(`listUncheckedPhones: ${error.message}`)
  return ((data ?? []) as Array<{ phone_last10: string }>).map((r) => r.phone_last10)
}
