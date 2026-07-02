/**
 * getInboxThread — the inbox reading-pane readers (spec §08 §5–§6), split from
 * getInboxQueue.ts for the file-size budget:
 *   - getConversationThreadFull: the thread with UNTRUNCATED bodies so rich
 *     HTML emails render inline (AC-08).
 *   - getInboxContactCard: the DETAILS fields the contact sidebar renders.
 *
 * DAL boundary (G1): all raw .from() reads live here, inside lib/data/.
 */
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { toFeedItem, type ActivityFeedItem } from '@/lib/data/crm/getContactActivityFeed'

/** The condensed contact card for the inbox reading-pane sidebar (spec §6). */
export type InboxContactCard = {
  personId: number
  name: string | null
  stage: string
  assignedBroker: string | null
  lenderName: string | null
  source: string | null
  price: number | null
  timeframe: string | null
  tags: string[]
  email: string | null
  phone: string | null
  pictureUrl: string | null
}

/**
 * getInboxContactCard — the DETAILS fields the inbox contact sidebar renders
 * (Stage / Agent / Lender + phone/email + tags — spec §6.1–§6.3). One targeted
 * crm_people read; scope is enforced by the calling action (requirePersonInScope).
 */
export async function getInboxContactCard(personId: number): Promise<InboxContactCard | null> {
  if (!Number.isFinite(personId) || personId <= 0) return null
  const sb = createServiceClient()
  const { data } = await sb
    .from('crm_people')
    .select('id,name,stage,assigned_broker,lender_name,source,price,timeframe,tags,emails,phones,picture_url')
    .eq('id', personId)
    .eq('deleted', false)
    .maybeSingle()
  if (!data) return null
  const emails = Array.isArray(data.emails) ? (data.emails as Array<{ value?: string }>) : []
  const phones = Array.isArray(data.phones) ? (data.phones as Array<{ value?: string }>) : []
  return {
    personId: Number(data.id),
    name: (data.name as string | null) ?? null,
    stage: String(data.stage ?? 'Lead'),
    assignedBroker: (data.assigned_broker as string | null) ?? null,
    lenderName: (data.lender_name as string | null) ?? null,
    source: (data.source as string | null) ?? null,
    price: typeof data.price === 'number' ? data.price : data.price != null ? Number(data.price) : null,
    timeframe: (data.timeframe as string | null) ?? null,
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
    email: emails.find((e) => e.value)?.value ?? null,
    phone: phones.find((p) => p.value)?.value ?? null,
    pictureUrl: (data.picture_url as string | null) ?? null,
  }
}


/** A thread item carrying the FULL body + subject for rich rendering (AC-08). */
export type InboxThreadItemData = ActivityFeedItem & {
  /** Untruncated crm_timeline body — HTML for synced emails, text otherwise. */
  fullBody: string | null
  /** Email subject (crm_timeline.title) for email items. */
  subject: string | null
}

/**
 * getConversationThreadFull — the reading-pane thread with untruncated bodies so
 * rich HTML emails render inline (spec §5.2, AC-08). Same rows as
 * getConversationThread, plus the raw body/title. Render-side sanitization is
 * the caller's job (lib/sanitize).
 */
export async function getConversationThreadFull(personId: number, limit = 100): Promise<InboxThreadItemData[]> {
  if (!Number.isFinite(personId) || personId <= 0) return []
  const sb = createServiceClient()
  const { data } = await sb
    .from('crm_timeline')
    .select('id,ts,kind,title,body,payload,broker,source')
    .eq('person_id', personId)
    .order('ts', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 500))
  if (!data) return []
  return data.map((r) => {
    const row = r as Record<string, unknown>
    const item = toFeedItem(row)
    return {
      ...item,
      fullBody: typeof row.body === 'string' ? row.body : null,
      subject: typeof row.title === 'string' ? row.title : null,
    }
  })
}
