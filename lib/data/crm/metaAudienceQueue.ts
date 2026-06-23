/**
 * metaAudienceQueue -- the cron-side DAL for the Meta audience removal queue
 * (CONTACT360 Phase 5.6 / 8.4). Reads pending removal markers, resolves their
 * PII for hashing, and marks them processed after a drain.
 *
 * DAL boundary (G1): every raw .from() read/write lives here, inside lib/data/.
 * Service role (the cron has no user session). Each function fails soft (returns
 * an empty/neutral value on error) so the cron degrades to a no-op drain rather
 * than throwing -- the dry-run default means a missing queue table is harmless.
 *
 * NOTE: meta_audience_removal_queue ships as a FLAGGED migration (not applied in
 * this delivery). Until it exists every read returns [] (relation-missing is
 * swallowed), so the cron runs clean (drains nothing) before the table lands.
 */

import { createServiceClient } from '@/lib/supabase/service'
import type { AudienceRemovePerson } from '@/lib/meta/audienceRemove'

/** First string value out of a crm_people JSONB contact array (emails/phones). */
function valuesFromJsonbArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    if (typeof item === 'string') out.push(item)
    else if (item && typeof item === 'object') {
      const v = (item as { value?: unknown }).value
      if (typeof v === 'string') out.push(v)
    }
  }
  return out
}

/** Pending removal-queue rows: the person ids to remove + the queue row ids. */
export async function getPendingAudienceRemovals(
  limit = 5000,
): Promise<{ queueIds: number[]; personIds: number[] }> {
  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('meta_audience_removal_queue')
      .select('id,person_id')
      .eq('status', 'pending')
      .order('enqueued_at', { ascending: true })
      .limit(limit)
    if (error || !data) return { queueIds: [], personIds: [] }
    const queueIds: number[] = []
    const personIds: number[] = []
    for (const row of data) {
      if (typeof row.id === 'number') queueIds.push(row.id)
      if (typeof row.person_id === 'number') personIds.push(row.person_id)
    }
    return { queueIds, personIds: [...new Set(personIds)] }
  } catch {
    return { queueIds: [], personIds: [] }
  }
}

/**
 * Resolve crm_people ids to the PII rows removeFromCrmAudience needs. Shape it
 * exactly like AudienceRemovePerson (personId + emails/phones/first/last) so the
 * cron can hand this straight to removeFromCrmAudience({ resolvePeople }).
 */
export async function resolvePeopleForRemoval(
  personIds: number[],
): Promise<AudienceRemovePerson[]> {
  const ids = [...new Set((personIds ?? []).filter((n) => Number.isFinite(n)))]
  if (ids.length === 0) return []
  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('crm_people')
      .select('id,first_name,last_name,emails,phones')
      .in('id', ids)
    if (error || !data) return []
    return data.map((row) => ({
      personId: row.id as number,
      firstName: (row.first_name as string | null) ?? null,
      lastName: (row.last_name as string | null) ?? null,
      emails: valuesFromJsonbArray(row.emails),
      phones: valuesFromJsonbArray(row.phones),
    }))
  } catch {
    return []
  }
}

/** Mark queue rows processed after a (dry or live) drain. Fails soft. */
export async function markAudienceRemovalsProcessed(queueIds: number[]): Promise<void> {
  const ids = (queueIds ?? []).filter((n) => Number.isFinite(n))
  if (ids.length === 0) return
  try {
    const sb = createServiceClient()
    await sb
      .from('meta_audience_removal_queue')
      .update({ status: 'processed', processed_at: new Date().toISOString() })
      .in('id', ids)
  } catch {
    // swallow -- a failed mark just re-drains the same row next run (idempotent
    // remove), never breaks the cron.
  }
}
