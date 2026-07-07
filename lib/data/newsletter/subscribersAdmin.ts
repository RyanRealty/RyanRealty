import 'server-only'
import { createServiceClient } from '@/lib/data/client'
import type { NewsletterSegment, NewsletterSubscriber, SubscriberStatus } from '@/lib/data/newsletter'

/**
 * Subscriber-management DAL (spec §9.4): the admin list with search + status +
 * segment + BROKER filters and a resolved broker column, row edit (name /
 * segment), row delete, broker reassignment (writes crm_people.assigned_broker,
 * the live branding source per decision #7), and the CSV export feed.
 *
 * Broker is NOT a subscriber column — it resolves live through
 * crm_people.assigned_broker via crm_person_id (null → matt, the default the
 * send path uses). Filtering by broker therefore resolves brokers for the
 * matching rows first, then filters; the working set is capped at 5,000 rows
 * per query which comfortably covers the current list.
 */

const SUBS = 'newsletter_subscribers'
const PEOPLE = 'crm_people'
const KNOWN_BROKERS = new Set(['matt', 'rebecca', 'paul'])
const WORKING_CAP = 5000

const SUB_COLS =
  'id, email, name, status, source, segment, crm_person_id, fub_person_id, unsubscribe_token, last_sent_at, created_at, updated_at'

export type SubscriberWithBroker = NewsletterSubscriber & { broker: string }

function normalizeBroker(slug: string | null | undefined): string {
  const s = (slug ?? '').trim().toLowerCase()
  return KNOWN_BROKERS.has(s) ? s : 'matt'
}

/** Batch crm_person_id → assigned_broker (soft-deleted people fall back to matt). */
async function resolveBrokers(personIds: number[]): Promise<Map<number, string>> {
  const map = new Map<number, string>()
  const ids = [...new Set(personIds.filter((n) => Number.isFinite(n)))]
  if (ids.length === 0) return map
  const sb = createServiceClient()
  const CHUNK = 1000
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data } = await sb
      .from(PEOPLE)
      .select('id, assigned_broker, deleted')
      .in('id', ids.slice(i, i + CHUNK))
    for (const row of data ?? []) {
      const r = row as { id: number; assigned_broker: string | null; deleted: boolean | null }
      if (r.deleted) continue
      if (r.assigned_broker) map.set(r.id, r.assigned_broker)
    }
  }
  return map
}

export type SubscriberAdminFilters = {
  status?: SubscriberStatus
  segment?: NewsletterSegment
  broker?: string
  q?: string
  page?: number
  pageSize?: number
}

/**
 * Filtered, paginated subscriber list with the broker column resolved. When a
 * broker filter is set, pagination happens after broker resolution (broker is
 * derived, not stored).
 */
export async function listSubscribersWithBroker(args: SubscriberAdminFilters): Promise<{
  rows: SubscriberWithBroker[]
  total: number
  page: number
  pageSize: number
}> {
  const sb = createServiceClient()
  const pageSize = Math.min(100, Math.max(10, args.pageSize ?? 50))
  const page = Math.max(1, args.page ?? 1)

  let query = sb.from(SUBS).select(SUB_COLS, { count: 'exact' })
  if (args.status) query = query.eq('status', args.status)
  if (args.segment) query = query.eq('segment', args.segment)
  const q = args.q?.trim()
  if (q) {
    const safe = q.replace(/[%,()]/g, '')
    if (safe) query = query.or(`email.ilike.%${safe}%,name.ilike.%${safe}%`)
  }
  query = query.order('created_at', { ascending: false })

  const brokerFilter = args.broker && KNOWN_BROKERS.has(args.broker) ? args.broker : null

  if (!brokerFilter) {
    const from = (page - 1) * pageSize
    const { data, count } = await query.range(from, from + pageSize - 1)
    const rows = (data ?? []) as NewsletterSubscriber[]
    const brokerMap = await resolveBrokers(rows.map((r) => r.crm_person_id).filter((n): n is number => n != null))
    return {
      rows: rows.map((r) => ({ ...r, broker: normalizeBroker(r.crm_person_id ? brokerMap.get(r.crm_person_id) : null) })),
      total: count ?? 0,
      page,
      pageSize,
    }
  }

  // Broker filter: resolve brokers for the whole (capped) matching set, then page.
  const { data } = await query.limit(WORKING_CAP)
  const all = (data ?? []) as NewsletterSubscriber[]
  const brokerMap = await resolveBrokers(all.map((r) => r.crm_person_id).filter((n): n is number => n != null))
  const matched = all
    .map((r) => ({ ...r, broker: normalizeBroker(r.crm_person_id ? brokerMap.get(r.crm_person_id) : null) }))
    .filter((r) => r.broker === brokerFilter)
  const from = (page - 1) * pageSize
  return { rows: matched.slice(from, from + pageSize), total: matched.length, page, pageSize }
}

/** Edit a subscriber row (name / segment). Status changes go through setSubscriberStatus. */
export async function updateSubscriberFields(
  id: string,
  fields: { name?: string | null; segment?: NewsletterSegment },
): Promise<{ ok: boolean }> {
  const sb = createServiceClient()
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if ('name' in fields) patch.name = fields.name
  if (fields.segment) patch.segment = fields.segment
  const { error } = await sb.from(SUBS).update(patch).eq('id', id)
  return { ok: !error }
}

/** Read one subscriber row (drives the edit dialog + delete guard). */
export async function getSubscriberById(id: string): Promise<NewsletterSubscriber | null> {
  const sb = createServiceClient()
  const { data } = await sb.from(SUBS).select(SUB_COLS).eq('id', id).maybeSingle()
  return (data as NewsletterSubscriber | null) ?? null
}

/** Hard-delete a subscriber row. Callers own the opt-out-record warning (S-10). */
export async function deleteSubscriber(id: string): Promise<{ ok: boolean }> {
  const sb = createServiceClient()
  const { error } = await sb.from(SUBS).delete().eq('id', id)
  return { ok: !error }
}

/**
 * Reassign the linked CRM person's broker (decision #7: branding follows LIVE
 * crm_people.assigned_broker — the next issue re-brands; frozen analytics on
 * past issues do not move). Returns false when the subscriber has no linked
 * person (nothing to reassign).
 */
export async function reassignSubscriberBroker(subscriberId: string, broker: string): Promise<{ ok: boolean; error?: string }> {
  const target = normalizeBroker(broker)
  if (!KNOWN_BROKERS.has((broker ?? '').trim().toLowerCase())) return { ok: false, error: 'unknown_broker' }
  const sub = await getSubscriberById(subscriberId)
  if (!sub) return { ok: false, error: 'not_found' }
  if (!sub.crm_person_id) return { ok: false, error: 'no_crm_person' }
  const sb = createServiceClient()
  const { error } = await sb
    .from(PEOPLE)
    .update({ assigned_broker: target })
    .eq('id', sub.crm_person_id)
  if (error) return { ok: false, error: 'persist_failed' }
  return { ok: true }
}

/**
 * CSV export feed — the full (capped) filtered set with brokers resolved, in
 * created_at order. Suppression states are visible via the status column
 * (bounced / complained / unsubscribed rows are exported labeled, never as
 * mailable actives).
 */
export async function exportSubscribersWithBroker(args: Omit<SubscriberAdminFilters, 'page' | 'pageSize'>): Promise<SubscriberWithBroker[]> {
  const { rows } = await listSubscribersWithBroker({ ...args, page: 1, pageSize: 100 })
  if (rows.length < 100) return rows
  // More than one page: pull the capped working set directly.
  const sb = createServiceClient()
  let query = sb.from(SUBS).select(SUB_COLS)
  if (args.status) query = query.eq('status', args.status)
  if (args.segment) query = query.eq('segment', args.segment)
  const q = args.q?.trim()
  if (q) {
    const safe = q.replace(/[%,()]/g, '')
    if (safe) query = query.or(`email.ilike.%${safe}%,name.ilike.%${safe}%`)
  }
  const { data } = await query.order('created_at', { ascending: false }).limit(WORKING_CAP)
  const all = (data ?? []) as NewsletterSubscriber[]
  const brokerMap = await resolveBrokers(all.map((r) => r.crm_person_id).filter((n): n is number => n != null))
  const withBroker = all.map((r) => ({
    ...r,
    broker: normalizeBroker(r.crm_person_id ? brokerMap.get(r.crm_person_id) : null),
  }))
  const brokerFilter = args.broker && KNOWN_BROKERS.has(args.broker) ? args.broker : null
  return brokerFilter ? withBroker.filter((r) => r.broker === brokerFilter) : withBroker
}
