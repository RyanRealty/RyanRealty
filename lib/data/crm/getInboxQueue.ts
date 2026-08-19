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
import { isUnknownCaller } from '@/lib/crm/display-name'
import {
  getContactActivityFeed,
  buildSnippet,
  classifyTimelineKind,
  type ActivityFeedItem,
} from '@/lib/data/crm/getContactActivityFeed'
import { listDraftsByPerson } from '@/lib/data/crm/drafts'

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

/**
 * A folder the inbox page exposes as tabs. The CRM five-folder model
 * (spec §3.3) plus the working-set tabs the in-house inbox already shipped:
 *   - 'mine'     conversations in the acting broker's working set (existing)
 *   - 'assigned' explicitly assigned to the acting broker (assigned_broker = me)
 *   - 'drafts'   conversations with a started-but-unsent draft owned by me
 *   - 'unread'   status === 'unread' (existing)
 *   - 'all'      every non-closed conversation in scope (existing)
 *   - 'closed'   status === 'closed' (existing)
 */
export type InboxScope = 'mine' | 'assigned' | 'drafts' | 'all' | 'unread' | 'closed'

// ── CRM five-folder model (spec §08 §2–§3) ───────────────────────────────────
//
// The rebuilt inbox routes on scope (My Inbox vs Company) × folder (the five
// CRM folders). The legacy InboxScope above stays for the mobile branch + tests.

/** My Inbox (per-user) vs Company (shared, whole working set) — spec §3.2. */
export type InboxScopeKey = 'me' | 'company'

/** The CRM five folders — spec §3.3. */
export type InboxFolderKey = 'inbox' | 'assigned' | 'drafts' | 'sent' | 'closed'

export const INBOX_FOLDERS: readonly InboxFolderKey[] = ['inbox', 'assigned', 'drafts', 'sent', 'closed']

/** Channel classes for the thread-list Filter dropdown (spec §4.2). */
export type InboxChannel = 'email' | 'text' | 'call'

/** Pure: map a crm_timeline message kind to its filter channel. */
export function channelOfKind(kind: string): InboxChannel | null {
  if (kind === 'sms_in' || kind === 'sms_out') return 'text'
  if (kind === 'email_in' || kind === 'email_out' || kind === 'email') return 'email'
  if (kind === 'call' || kind === 'voicemail') return 'call'
  return null
}

/** A single conversation row in the inbox queue. */
export type InboxConversation = {
  /** The conversation this row represents (RC1 model). The React list keys on this,
   *  so a contact's 1:1 thread and a group they're in are DISTINCT rows. A draft with
   *  no messages yet gets a synthetic `draft:<personId>` id. */
  conversationId: string
  /** True when the thread has 2+ participants (a real group text). Drives the badge. */
  isGroup: boolean
  /** Participant count (contacts + raw numbers; the broker line is not counted). */
  participantCount: number
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
  /** True when the acting broker has a started-but-unsent draft on this conversation. */
  hasDraft: boolean
  /** Channel classes present in the conversation (drives the Filter dropdown). */
  channels: InboxChannel[]
  /** Explicit thread assignment from crm_conversation_state (the Assigned folder). */
  explicitAssignee: string | null
  /** Brokers who have sent an outbound message in this conversation (Sent folder). */
  outboundBrokers: string[]
  /** True when the contact is still an unidentified inbound caller (Company-only per §3.2). */
  isUnknown: boolean
  /** Duration of the latest call/voicemail, when the latest message is one (row label). */
  lastCallDurationSec: number | null
  /** Message count within the recent working-set window (§26 row " N" label).
   *  Derived from the loaded window, so very old threads may undercount — the
   *  label is a thread-size signal, not an audited total. */
  messageCount: number
  /** Channel of the LATEST message — drives the §26 row channel icon + which
   *  thread presentation (email detail vs SMS bubbles) a tap opens. */
  lastChannel: InboxChannel | null
  /** Subject (crm_timeline.title) of the newest email in the thread (§26 row line 2). */
  lastEmailSubject: string | null
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
 * Pure: does a conversation belong in the given folder?
 *   - 'all'      every non-closed conversation in the broker's scope
 *   - 'mine'     conversations assigned to the scoped broker (or, for a superuser
 *                with no slug, every non-closed conversation — same as 'all')
 *   - 'assigned' non-closed conversations whose assigned_broker is the acting
 *                broker (CRM "Assigned" folder). Unlike 'mine', a superuser sees
 *                only conversations assigned to their OWN slug here, so it is a
 *                real filter for the owner too. Falls back to brokerScope when no
 *                acting broker is supplied.
 *   - 'drafts'   conversations carrying a started-but-unsent draft owned by me
 *   - 'unread'   status === 'unread'
 *   - 'closed'   status === 'closed'
 * 'closed' conversations are hidden from 'all', 'mine', and 'assigned' (an inbox
 * shows the working set, not the archive).
 */
export function matchesScope(
  scope: InboxScope,
  conv: { status: ConversationStatus; assignedBroker: string | null; hasDraft?: boolean },
  brokerScope: string | null,
  actingBroker?: string | null,
): boolean {
  switch (scope) {
    case 'closed':
      return conv.status === 'closed'
    case 'unread':
      return conv.status === 'unread'
    case 'drafts':
      return conv.hasDraft === true
    case 'assigned': {
      if (conv.status === 'closed') return false
      // "Assigned to me" keys on the acting broker's own slug; fall back to the
      // scope slug for a restricted broker (same value) and match nothing when
      // neither identifies a broker.
      const me = actingBroker ?? brokerScope
      if (!me) return false
      return conv.assignedBroker === me
    }
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
  /** Broker stamp on the timeline row (drives the Sent folder). Optional for tests. */
  broker?: string | null
  /** Timeline payload (recording duration for call rows). Optional for tests. */
  payload?: unknown
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
  channels: InboxChannel[]
  outboundBrokers: string[]
  lastCallDurationSec: number | null
  messageCount: number
  lastChannel: InboxChannel | null
  lastEmailSubject: string | null
} {
  let lastInboundAt: string | null = null
  let lastOutboundAt: string | null = null
  let lastEmailSubject: string | null = null
  const channels = new Set<InboxChannel>()
  const outboundBrokers = new Set<string>()
  // rows arrive newest-first; the first row is the latest message.
  const latest = rows[0] ?? null
  for (const r of rows) {
    if (INBOUND_KINDS.has(r.kind) && (!lastInboundAt || r.ts > lastInboundAt)) lastInboundAt = r.ts
    if (OUTBOUND_KINDS.has(r.kind) && (!lastOutboundAt || r.ts > lastOutboundAt)) lastOutboundAt = r.ts
    const ch = channelOfKind(r.kind)
    if (ch) channels.add(ch)
    if (ch === 'email' && lastEmailSubject === null && r.title) lastEmailSubject = r.title
    if (OUTBOUND_KINDS.has(r.kind) && r.broker) outboundBrokers.add(r.broker)
  }
  const meta = latest ? classifyTimelineKind(latest.kind) : null
  // Duration label for a call/voicemail latest row (spec §4.1 — e.g. 00:28).
  let lastCallDurationSec: number | null = null
  if (latest && (latest.kind === 'call' || latest.kind === 'voicemail')) {
    const p = (latest.payload ?? {}) as Record<string, unknown>
    const d = p.recordingDurationSec
    if (typeof d === 'number' && Number.isFinite(d)) lastCallDurationSec = d
  }
  return {
    snippet: latest ? buildSnippet({ title: latest.title, body: latest.body }) : null,
    lastKindLabel: meta?.label ?? '',
    lastDirection: meta?.direction ?? null,
    lastMessageAt: latest?.ts ?? null,
    lastInboundAt,
    lastOutboundAt,
    channels: [...channels],
    outboundBrokers: [...outboundBrokers],
    lastCallDurationSec,
    messageCount: rows.length,
    lastChannel: latest ? channelOfKind(latest.kind) : null,
    lastEmailSubject,
  }
}

/**
 * Pure: does a conversation belong in the given CRM scope × folder (spec §3)?
 *
 *   scope 'me'      the acting broker's own working set (assigned to me).
 *                   Unknown callers appear in Company only (§3.2). Drafts and
 *                   Sent key on OWNERSHIP of the draft / outbound message, not
 *                   contact assignment (a superuser's reply on another broker's
 *                   contact still lands in their own Sent).
 *   scope 'company' the whole scoped working set (shared inbox).
 *
 *   folder 'inbox'    active (non-closed) conversations
 *   folder 'assigned' non-closed conversations explicitly routed via
 *                     crm_conversation_state.assigned_broker
 *   folder 'drafts'   conversations carrying my started-but-unsent draft
 *   folder 'sent'     conversations with an outbound message (mine for scope me)
 *   folder 'closed'   resolved conversations
 */
export function matchesFolder(
  scopeKey: InboxScopeKey,
  folder: InboxFolderKey,
  conv: {
    status: ConversationStatus
    assignedBroker: string | null
    explicitAssignee?: string | null
    hasDraft?: boolean
    outboundBrokers?: string[]
    isUnknown?: boolean
  },
  brokerScope: string | null,
  actingBroker?: string | null,
): boolean {
  const me = actingBroker ?? brokerScope
  // Ownership folders — scoped by the draft/message owner, not the contact.
  if (folder === 'drafts') return conv.hasDraft === true
  if (folder === 'sent') {
    const outs = conv.outboundBrokers ?? []
    if (scopeKey === 'me') return me ? outs.includes(me) : false
    return outs.length > 0
  }
  // Contact-assignment folders.
  if (scopeKey === 'me') {
    if (!me) return false
    if (conv.isUnknown) return false
    if (conv.assignedBroker !== me) return false
  }
  switch (folder) {
    case 'inbox':
      return conv.status !== 'closed'
    case 'assigned': {
      if (conv.status === 'closed') return false
      const a = conv.explicitAssignee ?? null
      if (!a) return false
      return scopeKey === 'company' ? true : a === me
    }
    case 'closed':
      return conv.status === 'closed'
    default:
      return false
  }
}

/** Per-folder counts for one inbox scope (the folder-rail badges, spec §3.1). */
export type InboxFolderCounts = Record<InboxFolderKey, number>

/** The CRM folder-queue payload: conversations + rail counts + global unread. */
export type InboxFolderQueue = {
  conversations: InboxConversation[]
  counts: { me: InboxFolderCounts; company: InboxFolderCounts; unreadTotal: number }
}

/**
 * getInboxFolderQueue — the CRM scope × folder queue (spec §08 rebuild).
 * Shares the working-set builder with the legacy tab queue; filters via
 * matchesFolder, overlays the All/Unread view toggle, and returns the per-folder
 * counts for BOTH scopes so the folder rail renders every badge live.
 */
export async function getInboxFolderQueue(params: {
  scopeKey: InboxScopeKey
  folder: InboxFolderKey
  /** The All/Unread toggle (spec §4.2). */
  view?: 'all' | 'unread'
  brokerScope: string | null
  actingBroker?: string | null
  limit?: number
  offset?: number
}): Promise<InboxFolderQueue> {
  const { scopeKey, folder, brokerScope } = params
  const actingBroker = params.actingBroker ?? null
  const view = params.view ?? 'all'
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 200)
  const offset = Math.max(params.offset ?? 0, 0)
  const all = await buildInboxWorkingSet(brokerScope, actingBroker)

  const countFor = (s: InboxScopeKey): InboxFolderCounts => {
    const out = { inbox: 0, assigned: 0, drafts: 0, sent: 0, closed: 0 }
    for (const f of INBOX_FOLDERS) {
      out[f] = all.filter((c) => matchesFolder(s, f, c, brokerScope, actingBroker)).length
    }
    return out
  }
  const counts = {
    me: countFor('me'),
    company: countFor('company'),
    // Global "N Unread Messages" header — unread across the whole scoped set.
    unreadTotal: all.filter((c) => c.status === 'unread').length,
  }

  const filtered = all
    .filter((c) => matchesFolder(scopeKey, folder, c, brokerScope, actingBroker))
    .filter((c) => (view === 'unread' ? c.status === 'unread' : true))
    .sort((a, b) =>
      folder === 'sent'
        ? (b.lastOutboundAt ?? '').localeCompare(a.lastOutboundAt ?? '')
        : (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''),
    )
  return { conversations: filtered.slice(offset, offset + limit), counts }
}

/** Model channel value → the inbox's coarse channel class. */
function channelClassOf(channel: string | null): InboxChannel | null {
  if (channel === 'sms' || channel === 'mms') return 'text'
  if (channel === 'email') return 'email'
  if (channel === 'call' || channel === 'voicemail') return 'call'
  return null
}

/** Model (channel, direction) → the row's human label ("Text received", ...). */
function labelForMessage(channel: string | null, direction: string | null): string {
  if (channel === 'call') return 'Call'
  if (channel === 'voicemail') return 'Voicemail'
  const isEmail = channel === 'email'
  if (direction === 'out') return isEmail ? 'Email sent' : 'Text sent'
  if (direction === 'in') return isEmail ? 'Email received' : 'Text received'
  return ''
}

/**
 * buildInboxWorkingSet — the shared conversation builder both queue readers use.
 * Reads the RC1 conversation model (crm_conversation, with per-row fields the
 * message trigger precomputes), overlays the person-keyed triage state + drafts,
 * and returns ONE row per conversation. This replaced the path that re-derived
 * person-collapsed conversations from a 2000-row crm_timeline window on every load
 * (slow, and its message_count "may undercount"): the model carries an EXACT
 * message_count, an order-independent needs_reply, and real group-ness, so a group
 * thread is now its own row instead of collapsing onto a contact.
 */
async function buildInboxWorkingSet(
  brokerScope: string | null,
  actingBroker: string | null,
): Promise<InboxConversation[]> {
  const sb = createServiceClient()

  type PersonEmbed =
    | { name: string | null; picture_url: string | null; assigned_broker: string | null; deleted: boolean }
    | Array<{ name: string | null; picture_url: string | null; assigned_broker: string | null; deleted: boolean }>
    | null
  type ConvRow = {
    id: string
    primary_person_id: number | null
    is_group: boolean
    participant_count: number
    state: string
    assigned_broker: string | null
    needs_reply: boolean
    last_message_at: string | null
    last_inbound_at: string | null
    last_outbound_at: string | null
    channel_set: string[] | null
    message_count: number
    last_snippet: string | null
    last_direction: string | null
    last_channel: string | null
    last_subject: string | null
    last_call_duration_sec: number | null
    outbound_brokers: string[] | null
    crm_people: PersonEmbed
  }

  const SELECT =
    'id,primary_person_id,is_group,participant_count,state,assigned_broker,needs_reply,' +
    'last_message_at,last_inbound_at,last_outbound_at,channel_set,message_count,' +
    'last_snippet,last_direction,last_channel,last_subject,last_call_duration_sec,outbound_brokers,' +
    'crm_people!inner(name,picture_url,assigned_broker,deleted)'

  type StateRow = { person_id: number; status: string | null; assigned_broker: string | null; last_inbound_at: string | null; last_outbound_at: string | null }
  const fetchState = async (ids: number[]): Promise<Map<number, StateRow>> => {
    const m = new Map<number, StateRow>()
    if (ids.length === 0) return m
    const { data } = await sb
      .from('crm_conversation_state')
      .select('person_id,status,assigned_broker,last_inbound_at,last_outbound_at')
      .in('person_id', ids)
    for (const s of (data ?? []) as StateRow[]) m.set(s.person_id, s)
    return m
  }

  // Active working set: conversations touched in the last ACTIVE_DAYS, PLUS any
  // thread still waiting on a reply (so nothing actionable is ever hidden by the
  // recency floor). This mirrors the old inbox, which pulled the 2000 most-recent
  // messages (~140 contacts over ~3 months) — without it, the model would surface
  // all ~8.4k historical threads (mostly a one-time email import) and flood the
  // untriaged-defaults-to-unread count. Newest-first, range-paged past the 1000-row
  // PostgREST cap. Scoped by the primary contact's assigned broker (superuser = all).
  const ACTIVE_DAYS = 120
  const cutoff = new Date(Date.now() - ACTIVE_DAYS * 86_400_000).toISOString()
  const WINDOW = 4000
  const PAGE = 1000
  const fetchConvWindow = async (): Promise<ConvRow[]> => {
    const rows: ConvRow[] = []
    for (let from = 0; from < WINDOW; from += PAGE) {
      let q = sb
        .from('crm_conversation')
        .select(SELECT)
        .or(`last_message_at.gte.${cutoff},needs_reply.eq.true`)
        .order('last_message_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, from + PAGE - 1)
      if (brokerScope) q = q.eq('crm_people.assigned_broker', brokerScope)
      const { data } = await q
      rows.push(...((data ?? []) as unknown as ConvRow[]))
      if (!data || data.length < PAGE) break
    }
    return rows
  }

  const [convRows, draftsByPerson] = await Promise.all([
    fetchConvWindow(),
    listDraftsByPerson(actingBroker),
  ])

  // Triage status stays in the person-keyed crm_conversation_state overlay (the
  // mark read/handled/closed/assign actions write it); the model supplies every
  // message-derived field. Keyed by primary_person_id.
  const personIds = Array.from(
    new Set(convRows.map((c) => c.primary_person_id).filter((x): x is number => x != null)),
  )
  const stateByPerson = await fetchState(personIds)

  const all: InboxConversation[] = []
  // 1) conversation rows from the model
  for (const conv of convRows) {
    const person = Array.isArray(conv.crm_people) ? conv.crm_people[0] : conv.crm_people
    if (!person || person.deleted) continue
    const pid = conv.primary_person_id
    if (pid == null) continue
    const state = stateByPerson.get(pid)
    const status = effectiveStatus(state?.status)
    const lastInboundAt = state?.last_inbound_at ?? conv.last_inbound_at
    const lastOutboundAt = state?.last_outbound_at ?? conv.last_outbound_at
    const channels = Array.from(
      new Set(
        (conv.channel_set ?? [])
          .map((ch) => channelClassOf(ch))
          .filter((x): x is InboxChannel => x != null),
      ),
    )
    all.push({
      conversationId: conv.id,
      isGroup: conv.is_group,
      participantCount: conv.participant_count,
      personId: pid,
      name: person.name,
      pictureUrl: person.picture_url,
      assignedBroker: state?.assigned_broker ?? conv.assigned_broker ?? person.assigned_broker,
      status,
      snippet: buildSnippet({ title: conv.last_subject, body: conv.last_snippet }),
      lastKindLabel: labelForMessage(conv.last_channel, conv.last_direction),
      lastDirection: conv.last_direction === 'in' || conv.last_direction === 'out' ? conv.last_direction : null,
      lastMessageAt: conv.last_message_at,
      lastInboundAt,
      lastOutboundAt,
      needsReply: needsReply(status, lastInboundAt, lastOutboundAt),
      hasDraft: draftsByPerson.has(pid),
      channels,
      explicitAssignee: state?.assigned_broker ?? null,
      outboundBrokers: conv.outbound_brokers ?? [],
      isUnknown: isUnknownCaller(person.name),
      lastCallDurationSec: conv.last_call_duration_sec,
      messageCount: conv.message_count,
      lastChannel: channelClassOf(conv.last_channel),
      lastEmailSubject: conv.last_channel === 'email' ? conv.last_subject : null,
    })
  }

  // 2) draft-only conversations (a reply started in a brand-new thread with no
  //    message/conversation yet). These carry a synthetic conversationId.
  const convPersonIds = new Set(all.map((c) => c.personId))
  const draftOnlyIds = [...draftsByPerson.keys()].filter((id) => !convPersonIds.has(id))
  if (draftOnlyIds.length > 0) {
    const [{ data: people }, dState] = await Promise.all([
      sb.from('crm_people').select('id,name,picture_url,assigned_broker,deleted').in('id', draftOnlyIds),
      fetchState(draftOnlyIds),
    ])
    for (const p of (people ?? []) as Array<{ id: number; name: string | null; picture_url: string | null; assigned_broker: string | null; deleted: boolean }>) {
      if (p.deleted) continue
      const state = dState.get(p.id)
      const status = effectiveStatus(state?.status)
      const summary = draftsByPerson.get(p.id)
      all.push({
        conversationId: `draft:${p.id}`,
        isGroup: false,
        participantCount: 1,
        personId: p.id,
        name: p.name,
        pictureUrl: p.picture_url,
        assignedBroker: state?.assigned_broker ?? p.assigned_broker,
        status,
        snippet: 'Draft, not sent',
        lastKindLabel: 'Draft',
        lastDirection: null,
        lastMessageAt: summary?.updatedAt ?? null,
        lastInboundAt: state?.last_inbound_at ?? null,
        lastOutboundAt: state?.last_outbound_at ?? null,
        needsReply: false,
        hasDraft: true,
        channels: [],
        explicitAssignee: state?.assigned_broker ?? null,
        outboundBrokers: [],
        isUnknown: isUnknownCaller(p.name),
        lastCallDurationSec: null,
        messageCount: 0,
        lastChannel: null,
        lastEmailSubject: null,
      })
    }
  }

  return all
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
