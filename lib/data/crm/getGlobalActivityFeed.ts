/**
 * getGlobalActivityFeed — the CRM-wide activity stream (FUB "Activity" tab parity).
 *
 * Where getContactActivityFeed reads one person's crm_timeline, this reads the
 * timeline across ALL contacts, joins each row to its contact's name, and lets
 * the Activity page filter by what FUB surfaces: Email, Website, and New Leads
 * (plus All). Newest-first, cursor-paginated on `ts` so "load more" is stable.
 *
 * No drop-off: every row is a real crm_timeline event already associated to a
 * crm_people lead (person_id is NOT NULL). New-lead events are first-class
 * timeline rows (kind='lead_created'), so the feed is one uniform, indexed query
 * rather than a UNION across tables.
 */
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { toFeedItem, type ActivityFeedItem } from './getContactActivityFeed'

export type GlobalActivityFilter = 'all' | 'email' | 'website' | 'new_leads'

export type GlobalActivityItem = ActivityFeedItem & {
  personId: number
  personName: string
  /** Deep link to the contact's CRM record. */
  href: string
}

// Kind sets per filter tab. `all` is an explicit allow-list of human-meaningful
// activity (it excludes internal 'system' automation logs — sequence ticks,
// auto-enroll, broker alerts — which are noise in an activity feed).
const EMAIL = ['email_in', 'email_out', 'email_open', 'email_click', 'email']
const WEBSITE = ['web_event', 'parsed_intent']
const NEW_LEADS = ['lead_created']
const MESSAGE = ['sms_in', 'sms_out']
const CALL = ['call', 'voicemail']
const MILESTONE = ['stage_change', 'home_valuation', 'subscribe_report']
const NOTE = ['note']
const ALL = [...EMAIL, ...WEBSITE, ...NEW_LEADS, ...MESSAGE, ...CALL, ...MILESTONE, ...NOTE]

const KIND_SET: Record<GlobalActivityFilter, string[]> = {
  all: ALL,
  email: EMAIL,
  website: WEBSITE,
  new_leads: NEW_LEADS,
}

export type GlobalActivityResult = { items: GlobalActivityItem[]; nextCursor: string | null }

export async function getGlobalActivityFeed(opts: {
  filter?: GlobalActivityFilter
  limit?: number
  /** ISO timestamp cursor — return rows strictly older than this (for "load more"). */
  before?: string | null
} = {}): Promise<GlobalActivityResult> {
  const safeFilter: GlobalActivityFilter = opts.filter && opts.filter in KIND_SET ? opts.filter : 'all'
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200)
  const sb = createServiceClient()

  let q = sb
    .from('crm_timeline')
    .select('id,ts,kind,title,body,payload,broker,source,person_id')
    .in('kind', KIND_SET[safeFilter])
    .order('ts', { ascending: false })
    .limit(limit + 1)
  if (opts.before) q = q.lt('ts', opts.before)

  const { data, error } = await q
  if (error || !data) return { items: [], nextCursor: null }

  const hasMore = data.length > limit
  const page = (data as Array<Record<string, unknown>>).slice(0, limit)

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
