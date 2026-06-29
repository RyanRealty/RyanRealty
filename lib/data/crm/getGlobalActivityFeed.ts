/**
 * getGlobalActivityFeed — the CRM-wide activity stream (FUB "Activity" tab parity).
 *
 * Reads the timeline across ALL contacts, joins each row to its contact's name,
 * and lets the Activity page include/exclude activity TYPES (emails, texts,
 * website visits, calls, notes, new leads, updates) as independent toggles.
 * Newest-first, cursor-paginated on `ts` so "load more" is stable.
 *
 * No drop-off: every row is a real crm_timeline event already associated to a
 * crm_people lead (person_id is NOT NULL). New-lead events are first-class
 * timeline rows (kind='lead_created'), so the feed is one uniform, indexed query.
 */
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { toFeedItem, type ActivityFeedItem } from './getContactActivityFeed'

/**
 * The toggleable activity types shown on the Activity tab. Each maps to the set
 * of crm_timeline `kind`s it covers. The union of the selected types' kinds is
 * what the feed query filters on. Order = display order of the toggle chips.
 */
export const ACTIVITY_TYPES = [
  { key: 'email', label: 'Emails', kinds: ['email_in', 'email_out', 'email_open', 'email_click', 'email'] },
  { key: 'sms', label: 'Texts', kinds: ['sms_in', 'sms_out'] },
  { key: 'call', label: 'Calls', kinds: ['call', 'voicemail'] },
  { key: 'note', label: 'Notes', kinds: ['note'] },
  { key: 'website', label: 'Website', kinds: ['web_event', 'parsed_intent'] },
  { key: 'new_leads', label: 'New leads', kinds: ['lead_created'] },
  { key: 'updates', label: 'Updates', kinds: ['stage_change', 'home_valuation', 'subscribe_report'] },
] as const

export type ActivityTypeKey = (typeof ACTIVITY_TYPES)[number]['key']
export const ALL_ACTIVITY_TYPE_KEYS: ActivityTypeKey[] = ACTIVITY_TYPES.map((t) => t.key)

const KINDS_BY_TYPE = new Map<string, readonly string[]>(ACTIVITY_TYPES.map((t) => [t.key, t.kinds]))

/** Resolve a set of selected type keys to the union of crm_timeline kinds. */
export function kindsForTypes(types: readonly string[]): string[] {
  const out = new Set<string>()
  for (const t of types) for (const k of KINDS_BY_TYPE.get(t) ?? []) out.add(k)
  return [...out]
}

export type GlobalActivityItem = ActivityFeedItem & {
  personId: number
  personName: string
  /** Deep link to the contact's CRM record. */
  href: string
}

export type GlobalActivityResult = { items: GlobalActivityItem[]; nextCursor: string | null }

export async function getGlobalActivityFeed(opts: {
  /** Selected type keys. Omitted = all types. Empty array = nothing selected. */
  types?: readonly string[]
  limit?: number
  /** ISO timestamp cursor — return rows strictly older than this (for "load more"). */
  before?: string | null
  /**
   * Restrict to activity on contacts assigned to this broker slug (the lead's
   * `crm_people.assigned_broker`). Null/undefined = all brokers. Mirrors
   * listCrmDeals' person-scope so the Activity feed honors broker ownership.
   */
  brokerScope?: string | null
} = {}): Promise<GlobalActivityResult> {
  const selected = opts.types ?? ALL_ACTIVITY_TYPE_KEYS
  const kinds = kindsForTypes(selected)
  // Nothing selected → nothing to show (the UI prompts to pick at least one type).
  if (kinds.length === 0) return { items: [], nextCursor: null }

  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200)
  const sb = createServiceClient()

  // When scoped, an inner embed on crm_people filters timeline rows to the
  // broker's contacts; unscoped (owner) keeps the lean no-embed query.
  const scope = opts.brokerScope ?? null
  const select = scope
    ? 'id,ts,kind,title,body,payload,broker,source,person_id,crm_people!inner(assigned_broker)'
    : 'id,ts,kind,title,body,payload,broker,source,person_id'

  let q = sb
    .from('crm_timeline')
    .select(select)
    .in('kind', kinds)
    .order('ts', { ascending: false })
    .limit(limit + 1)
  if (scope) q = q.eq('crm_people.assigned_broker', scope)
  if (opts.before) q = q.lt('ts', opts.before)

  const { data, error } = await q
  if (error || !data) return { items: [], nextCursor: null }

  const rows = data as unknown as Array<Record<string, unknown>>
  const hasMore = rows.length > limit
  const page = rows.slice(0, limit)

  // Batch-resolve contact names (no N+1, no FK-embed dependency).
  const personIds = [...new Set(page.map((r) => Number(r.person_id)).filter((n) => Number.isFinite(n) && n > 0))]
  const nameById = new Map<number, string>()
  if (personIds.length) {
    const { data: people } = await sb
      .from('crm_people')
      .select('id,name,first_name,last_name')
      .in('id', personIds)
    for (const p of (people ?? []) as Array<Record<string, unknown>>) {
      const name =
        (typeof p.name === 'string' && p.name.trim()) ||
        [p.first_name, p.last_name].filter(Boolean).join(' ').trim() ||
        'Unknown contact'
      nameById.set(Number(p.id), name)
    }
  }

  const items: GlobalActivityItem[] = page.map((r) => {
    const base = toFeedItem(r)
    const personId = Number(r.person_id)
    return {
      ...base,
      personId,
      personName: nameById.get(personId) ?? 'Unknown contact',
      href: `/admin/crm/${personId}`,
    }
  })

  const nextCursor = hasMore && page.length ? String(page[page.length - 1]!.ts) : null
  return { items, nextCursor }
}
