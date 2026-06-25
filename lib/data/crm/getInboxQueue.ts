/**
 * getInboxQueue — the unified, triageable conversation queue for the CRM inbox
 * (Wave 7, Inbox triage).
 *
 * The inbox is a queue of conversations, one per contact, derived from the
 * existing crm_timeline message store and layered with the per-person triage
 * state in crm_conversation_state (unread/open/handled/closed). Each queue row
 * carries the contact, the latest message snippet, an unread flag, the triage
 * status, and the timestamps the UI sorts + the "needs reply" derivation reads.
 *
 * The thread (the message list for one conversation) is the existing
 * getContactActivityFeed reader — REUSED here as getConversationThread so the
 * inbox and the Contact-360 view share one timeline source.
 *
 * Scope: every read is broker-scoped via the caller-supplied brokerScope (the
 * result of scopeBroker(access) — null for a superuser sees ALL, a slug sees
 * only that broker's contacts). The DAL never resolves access itself; the action
 * passes the scoped slug, matching every other CRM dashboard read.
 *
 * DAL boundary (G1): all raw .from() reads live here, inside lib/data/.
 */
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { CRM_BROKERS, type CrmBrokerSlug } from '@/lib/crm/constants'
import {
  getContactActivityFeed,
  buildSnippet,
  classifyTimelineKind,
  type ActivityFeedItem,
} from '@/lib/data/crm/getContactActivityFeed'

/** The four triage buckets a conversation moves through. */
export type ConversationStatus = 'unread' | 'open' | 'handled' | 'closed'

/** The canonical list of triage statuses, the single source the validators read. */
export const CONVERSATION_STATUSES: readonly ConversationStatus[] = ['unread', 'open', 'handled', 'closed']

/**
 * Pure: validate a requested triage status. Lives here (a plain, server-only DAL
 * module that Vitest imports cleanly) and is re-exported from the 'use server'
 * action so the action never reaches the table with an invalid status. Pure +
 * unit-tested; the DB check constraint is the backstop.
 */
export function isValidConversationStatus(status: string): status is ConversationStatus {
  return (CONVERSATION_STATUSES as readonly string[]).includes(status)
}

/**
 * Pure: validate a broker slug for conversation assignment. Empty / null clears
 * the owner; any other value must be a known CRM broker slug. Pure + unit-tested;
 * re-exported from the action.
 */
export function isAssignableBroker(broker: string | null): broker is CrmBrokerSlug | null {
  if (broker === null || broker === '') return true
  return (CRM_BROKERS as readonly string[]).includes(broker)
}

/** A scope selector the inbox page exposes as tabs. */
export type InboxScope = 'mine' | 'all' | 'unread' | 'closed'

/** A single conversation row in the inbox queue. */
export type InboxConversation = {
  personId: number
  name: string | null
  pictureUrl: string | null
  assignedBroker: string | null
  /** Triage status (defaults to 'unread' when no state row exists yet). */
  status: ConversationStatus
  /** Latest message snippet from crm_timeline (any direction). */
  snippet: string | null
  /** Human label for the latest message kind ('Text received', 'Email sent', ...). */
  lastKindLabel: string
  /** 'in' | 'out' | null — direction of the latest message. */
  lastDirection: 'in' | 'out' | null
  lastMessageAt: string | null
  lastInboundAt: string | null
  lastOutboundAt: string | null
  /** True when the newest inbound is newer than the newest outbound (waiting on us). */
  needsReply: boolean
};

/** The inbox queue payload: the conversations plus the per-tab counts. */
export type InboxQueue = {
  conversations: InboxConversation[]
  counts: {
    mine: number
    all: number
    unread: number
    closed: number
  }
};

const MESSAGE_KINDS = ['sms_in', 'sms_out', 'email_in', 'email_out', 'email', 'call', 'voicemail'] as const
const INBOUND_KINDS = new Set(['sms_in', 'email_in', 'call', 'voicemail'])
const OUTBOUND_KINDS = new Set(['sms_out', 'email_out'])

/**
 * Pure: given a status row's status (or undefined when no row exists), resolve
 * the effective triage status. A conversation with messages but no state row is
 * 'unread' — the inbox default.
 */
export function effectiveStatus(status: string | null | undefined): ConversationStatus {
  if (status === 'open' || status === 'handled' || status === 'closed') return status
  return 'unread'
}

/**
 * Pure: decide whether a conversation is waiting on a broker reply. True when an
 * inbound message exists and is newer than the newest outbound (or no outbound
 * has happened yet). A closed conversation never "needs reply".
 */
export function needsReply(
  status: ConversationStatus,
  lastInboundAt: string | null,
  lastOutboundAt: string | null,
): boolean {
  if (status === 'closed') return false
  if (!lastInboundAt) return false
  if (!lastOutboundAt) return true
  return new Date(lastInboundAt).getTime() > new Date(lastOutboundAt).getTime()
}

/**
 * Pure: does a conversation belong in the given scope tab?
 *   - 'all'    every non-closed conversation in the broker's scope
 *   - 'mine'   conversations assigned to the scoped broker (or, for a superuser
 *              with no slug, every non-closed conversation — same as 'all')
 *   - 'unread' status === 'unread'
 *   - 'closed' status === 'closed'
 * 'closed' conversations are hidden from 'all' and 'mine' (an inbox shows the
 * working set, not the archive).
 */
export function matchesScope(
  scope: InboxScope,
  conv: { status: ConversationStatus; assignedBroker: string | null },
  brokerScope: string | null,
): boolean {
  switch (scope) {
    case 'closed':
      return conv.status === 'closed'
    case 'unread':
      return conv.status === 'unread'
    case 'mine':
      if (conv.status === 'closed') return false
      // A superuser (no slug) has no "mine" distinction — everything is theirs.
      if (!brokerScope) return true
      return conv.assignedBroker === brokerScope
    case 'all':
    default:
      return conv.status !== 'closed'
  }
}

/** Raw shape of the latest-message rows we fold per person. */
type RawMessageRow = {
  person_id: number
  ts: string
  kind: string
  title: string | null
  body: string | null
}

/**
 * Pure: fold a person's message rows (newest-first) into the per-conversation
 * derived fields — latest snippet/kind/direction + the inbound/outbound clocks.
 * Exported for unit testing the derivation without Supabase.
 */
export function deriveConversationFromMessages(rows: RawMessageRow[]): {
  snippet: string | null
  lastKindLabel: string
  lastDirection: 'in' | 'out' | null
  lastMessageAt: string | null
  lastInboundAt: string | null
  lastOutboundAt: string | null
} {
  let lastInboundAt: string | null = null
  let lastOutboundAt: string | null = null
  // rows arrive newest-first; the first row is the latest message.
  const latest = rows[0] ?? null
  for (const r of rows) {
    if (INBOUND_KINDS.has(r.kind) && (!lastInboundAt || r.ts > lastInboundAt)) lastInboundAt = r.ts
    if (OUTBOUND_KINDS.has(r.kind) && (!lastOutboundAt || r.ts > lastOutboundAt)) lastOutboundAt = r.ts
  }
  const meta = latest ? classifyTimelineKind(latest.kind) : null
  return {
    snippet: latest ? buildSnippet({ title: latest.title, body: latest.body }) : null,
    lastKindLabel: meta?.label ?? '',
    lastDirection: meta?.direction ?? null,
    lastMessageAt: latest?.ts ?? null,
    lastInboundAt,
    lastOutboundAt,
  }
}

type QueueParams = {
  scope: InboxScope
  /** scopeBroker(access) — null = superuser (all brokers), a slug = that broker only. */
  brokerScope: string | null
  limit?: number
  offset?: number
}

/**
 * getInboxQueue — the triageable conversation queue + per-tab counts.
 *
 * Strategy: pull the most recent message rows (broker-scoped via the joined
 * crm_people.assigned_broker), group by person to one conversation each, overlay
 * the triage state, derive the snippet + needs-reply, then filter to the tab and
 * page. The counts run across the same scoped working set.
 */
export async function getInboxQueue(params: QueueParams): Promise<InboxQueue> {
  const { scope, brokerScope } = params
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 200)
  const offset = Math.max(params.offset ?? 0, 0)
  const sb = createServiceClient()

  // Pull a generous window of recent messages with the joined contact, scoped to
  // the broker. We group to one conversation per person in memory — the volume
  // of recent inbound/outbound is small relative to the full timeline.
  let q = sb
    .from('crm_timeline')
    .select('person_id,ts,kind,title,body,crm_people!inner(name,picture_url,assigned_broker,deleted)')
    .in('kind', MESSAGE_KINDS as unknown as string[])
    .order('ts', { ascending: false })
    .limit(2000)
  // brokerScope null = superuser, no filter.
  if (brokerScope) q = q.eq('crm_people.assigned_broker', brokerScope)
  const { data: msgRows } = await q

  type Joined = RawMessageRow & {
    crm_people:
      | { name: string | null; picture_url: string | null; assigned_broker: string | null; deleted: boolean }
      | Array<{ name: string | null; picture_url: string | null; assigned_broker: string | null; deleted: boolean }>
      | null
  }

  // Group rows by person, preserving newest-first order.
  const byPerson = new Map<number, { person: { name: string | null; pictureUrl: string | null; assignedBroker: string | null }; rows: RawMessageRow[] }>()
  for (const raw of (msgRows ?? []) as unknown as Joined[]) {
    const p = Array.isArray(raw.crm_people) ? raw.crm_people[0] : raw.crm_people
    if (!p || p.deleted) continue
    const existing = byPerson.get(raw.person_id)
    const row: RawMessageRow = { person_id: raw.person_id, ts: raw.ts, kind: raw.kind, title: raw.title ?? null, body: raw.body ?? null }
    if (existing) {
      existing.rows.push(row)
    } else {
      byPerson.set(raw.person_id, {
        person: { name: p.name, pictureUrl: p.picture_url, assignedBroker: p.assigned_broker },
        rows: [row],
      })
    }
  }

  const personIds = [...byPerson.keys()]
  if (personIds.length === 0) {
    return { conversations: [], counts: { mine: 0, all: 0, unread: 0, closed: 0 } }
  }

  // Overlay the triage state for every conversation in the working set.
  const { data: stateRows } = await sb
    .from('crm_conversation_state')
    .select('person_id,status,assigned_broker,last_inbound_at,last_outbound_at')
    .in('person_id', personIds)
  const stateByPerson = new Map<number, { status: string | null; assigned_broker: string | null; last_inbound_at: string | null; last_outbound_at: string | null }>()
  for (const s of (stateRows ?? []) as Array<{ person_id: number; status: string | null; assigned_broker: string | null; last_inbound_at: string | null; last_outbound_at: string | null }>) {
    stateByPerson.set(s.person_id, s)
  }

  // Build the full conversation list (pre-filter), then scope + page.
  const all: InboxConversation[] = []
  for (const [personId, { person, rows }] of byPerson) {
    const derived = deriveConversationFromMessages(rows)
    const state = stateByPerson.get(personId)
    const status = effectiveStatus(state?.status)
    // The state row may have explicit clocks; fall back to the derived ones.
    const lastInboundAt = state?.last_inbound_at ?? derived.lastInboundAt
    const lastOutboundAt = state?.last_outbound_at ?? derived.lastOutboundAt
    const assignedBroker = state?.assigned_broker ?? person.assignedBroker
    all.push({
      personId,
      name: person.name,
      pictureUrl: person.pictureUrl,
      assignedBroker,
      status,
      snippet: derived.snippet,
      lastKindLabel: derived.lastKindLabel,
      lastDirection: derived.lastDirection,
      lastMessageAt: derived.lastMessageAt,
      lastInboundAt,
      lastOutboundAt,
      needsReply: needsReply(status, lastInboundAt, lastOutboundAt),
    })
  }

  // Per-tab counts across the full scoped working set.
  const counts = {
    mine: all.filter((c) => matchesScope('mine', c, brokerScope)).length,
    all: all.filter((c) => matchesScope('all', c, brokerScope)).length,
    unread: all.filter((c) => matchesScope('unread', c, brokerScope)).length,
    closed: all.filter((c) => matchesScope('closed', c, brokerScope)).length,
  }

  // Filter to the requested tab, sort newest message first, then page.
  const filtered = all
    .filter((c) => matchesScope(scope, c, brokerScope))
    .sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''))
  const conversations = filtered.slice(offset, offset + limit)

  return { conversations, counts }
}

/**
 * getConversationThread — the message list for one conversation. This is the
 * existing Contact-360 activity feed, REUSED so the inbox thread and the contact
 * timeline render from one source. Caller is responsible for scope (the action
 * runs requirePersonInScope before opening a thread).
 */
export async function getConversationThread(personId: number, limit = 100): Promise<ActivityFeedItem[]> {
  return getContactActivityFeed(personId, limit)
}
