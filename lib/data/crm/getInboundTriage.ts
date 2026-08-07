/**
 * getInboundTriage — the inbound-activity half of the broker "Needs your action"
 * queue (broker-dashboard).
 *
 * Problem this closes: the dashboard queue only surfaced sequence-enrolled
 * contacts (crm_sequence_enrollments awaiting_broker_next). A lead who REPLIED
 * about their CMA, opened the BPO twice, requested a showing, or is hot on the
 * site right now never reached the broker's action queue. This reader merges,
 * over the last 72 hours:
 *
 *   1. Unread inbound messages — crm_timeline sms_in/email_in layered with the
 *      crm_conversation_state unread overlay (same effective-status rule as
 *      getInboxQueue: no state row = unread).
 *   2. Doc-open engagement — email_events open/click rows whose send_type (or
 *      email_key prefix, the getEmailReporting recovery pattern) classifies as
 *      cma / bpo / market-report.
 *   3. Hot visitor escalations — visitor_sessions past the hot threshold
 *      (VISITOR_HOT_LEAD_THRESHOLD, default 100 — same knob as the
 *      visitor-hot-lead-escalation cron) AND identified to a crm_people row.
 *   4. Showing-request / new-lead call tasks due — open crm_tasks due inside the
 *      window whose name/type/origin marks them as a showing request or an
 *      lp-form / hot-lead call task.
 *
 * Each item carries the person, a plain-English signal ('Replied about the
 * CMA', 'Opened the BPO twice', 'On the site now'), the event timestamp, a deep
 * link, and a rank = signal weight x recency decay (reply > showing/task >
 * doc-open > visit). The ranking + merge with the sequence queue are PURE
 * functions, exported for unit tests.
 *
 * Dismissal model (no new tables):
 *   - reply items       -> mark the conversation read (crm_conversation_state)
 *   - task items        -> snooze the task (existing snoozeCrmTaskAction)
 *   - doc-open / visit  -> a "seen" watermark: the item is suppressed once the
 *     person's crm_conversation_state.updated_at is newer than the event, so
 *     the existing state-row touch IS the dismiss.
 *
 * Scope: brokerScope is the page's resolved slug (null = all brokers). Every
 * candidate is filtered through ONE crm_people fetch (deleted=false + optional
 * assigned_broker), so all four sources scope identically.
 *
 * DAL boundary (G1): every raw .from() read lives here, inside lib/data/.
 * Fails SOFT per source — a broken table never blanks the dashboard.
 */
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

// ── Types ────────────────────────────────────────────────────────────────────

export type TriageKind = 'reply' | 'task' | 'doc-open' | 'visit'

export type TriageDocType = 'cma' | 'bpo' | 'market-report'

export type TriageItem = {
  /** Stable id for list keys: reply:<pid> | doc:<type>:<pid> | visit:<pid> | task:<taskId>. */
  id: string
  kind: TriageKind
  personId: number
  personName: string | null
  /** Plain-English signal — 'Replied about the CMA', 'Opened the BPO twice', 'On the site now'. */
  signal: string
  /** ISO timestamp of the newest underlying event. */
  occurredAt: string
  /** Where the row opens — /admin/people/<id> (with #comms for replies). */
  deepLink: string
  /** recency x signal weight, stamped by rankTriageItems. */
  rank: number
  /** The crm_tasks id when kind === 'task' (drives the snooze dismiss). */
  taskId: number | null
}

/** One entry in the merged "Needs your action" list. Generic over the sequence
 *  item shape so this module never imports from app/actions. */
export type NeedsActionEntry<S> =
  | { kind: 'sequence'; rank: number; item: S }
  | { kind: 'triage'; rank: number; item: TriageItem }

// ── Ranking (pure) ───────────────────────────────────────────────────────────

/** Signal weights: reply > showing/task > doc-open > visit. */
export const TRIAGE_WEIGHTS: Record<TriageKind, number> = {
  reply: 100,
  task: 80,
  'doc-open': 60,
  visit: 40,
}

/** Recency half-life: a signal loses half its weight every 24 hours. */
export const TRIAGE_HALF_LIFE_HOURS = 24

/**
 * Fixed rank for a sequence-queue item in the merged list. Calibrated so a
 * fresh reply (100), fresh task (80), or fresh doc-open (60) outranks a
 * waiting sequence send, while day-old doc-opens and site visits fall below it.
 */
export const SEQUENCE_RANK = 30

/** Pure: rank one signal — weight decayed by age (half-life 24h). */
export function triageRank(kind: TriageKind, occurredAt: string, nowMs: number): number {
  const t = Date.parse(occurredAt)
  const ageHours = Number.isFinite(t) ? Math.max(0, (nowMs - t) / 3_600_000) : TRIAGE_HALF_LIFE_HOURS * 4
  return TRIAGE_WEIGHTS[kind] * Math.pow(0.5, ageHours / TRIAGE_HALF_LIFE_HOURS)
}

/** Pure: stamp ranks and sort descending (most urgent first). */
export function rankTriageItems(items: Array<Omit<TriageItem, 'rank'>>, nowMs: number): TriageItem[] {
  return items
    .map((it) => ({ ...it, rank: triageRank(it.kind, it.occurredAt, nowMs) }))
    .sort((a, b) => b.rank - a.rank)
}

/**
 * Pure: merge the sequence queue (already ordered oldest-waiting first) with
 * ranked triage items into ONE list, capped. Sequence items hold a fixed rank
 * (SEQUENCE_RANK) with a tiny descending epsilon so their existing order is
 * preserved; triage items sort by their own rank. Fresh inbound activity lands
 * above the sequence block, stale activity below it.
 */
export function mergeNeedsAction<S>(
  sequence: S[],
  rankedTriage: TriageItem[],
  cap = 15,
): NeedsActionEntry<S>[] {
  const entries: NeedsActionEntry<S>[] = [
    ...sequence.map((item, i) => ({ kind: 'sequence' as const, rank: SEQUENCE_RANK - i * 1e-6, item })),
    ...rankedTriage.map((item) => ({ kind: 'triage' as const, rank: item.rank, item })),
  ]
  return entries.sort((a, b) => b.rank - a.rank).slice(0, Math.max(1, cap))
}

// ── Signal builders (pure) ───────────────────────────────────────────────────

/** Pure: signal line for an unread inbound message. */
export function replySignal(kind: string, title: string | null): string {
  const t = (title ?? '').toLowerCase()
  if (/\bcma\b|market analysis|home value/.test(t)) return 'Replied about the CMA'
  if (/\bbpo\b|price opinion/.test(t)) return 'Replied about the BPO'
  if (/market report/.test(t)) return 'Replied about the market report'
  return kind === 'sms_in' ? 'Replied by text' : 'Replied by email'
}

/**
 * Pure: classify an email_events row as a tracked-document engagement. Concrete
 * send_type first, then the email_key prefix (the same recovery order
 * emailDelivery.streamForRow uses — webhook rows carry send_type 'other').
 */
export function classifyDocEvent(sendType: string | null, emailKey: string | null): TriageDocType | null {
  const st = (sendType ?? '').trim().toLowerCase()
  if (st === 'cma' || st === 'bpo' || st === 'market-report') return st
  const prefix = (emailKey ?? '').trim().toLowerCase().split(':')[0]
  if (prefix === 'cma') return 'cma'
  if (prefix === 'bpo') return 'bpo'
  if (prefix === 'market-report' || prefix === 'market' || prefix === 'report') return 'market-report'
  return null
}

const DOC_LABELS: Record<TriageDocType, string> = {
  cma: 'CMA',
  bpo: 'BPO',
  'market-report': 'market report',
}

/** Pure: signal line for doc engagement — 'Opened the BPO twice'. */
export function docSignal(docType: TriageDocType, count: number): string {
  const label = DOC_LABELS[docType]
  if (count <= 1) return `Opened the ${label}`
  if (count === 2) return `Opened the ${label} twice`
  return `Opened the ${label} ${count} times`
}

/** Pure: signal line for a hot identified visitor. */
export function visitSignal(lastSeenAt: string, score: number, nowMs: number): string {
  const t = Date.parse(lastSeenAt)
  const ageMin = Number.isFinite(t) ? (nowMs - t) / 60_000 : Infinity
  if (ageMin <= 30) return 'On the site now'
  return `Hot on the site (score ${score})`
}

/**
 * Pure: is this open task a showing-request or new-lead call task? Matches the
 * real writers: LP-form call tasks (ensureNativeLead.createNativeTask stamps
 * origin 'lp-form'), the hot-lead escalation cron ('... Call within 5 min.'),
 * and any showing/tour-flavored name or type.
 */
export function isTriageTaskCandidate(t: {
  name: string | null
  type: string | null
  origin: string | null
}): boolean {
  const name = (t.name ?? '').toLowerCase()
  const type = (t.type ?? '').toLowerCase()
  if (/showing|tour/.test(name) || /showing|tour/.test(type)) return true
  if ((t.origin ?? '') === 'lp-form') return true
  if (/call within 5 min|hot .* lead|hot lead/.test(name)) return true
  return false
}

/** Pure: signal line for a due showing/new-lead task. */
export function taskSignal(t: { name: string | null; type: string | null }): string {
  const name = (t.name ?? '').toLowerCase()
  const type = (t.type ?? '').toLowerCase()
  if (/showing|tour/.test(name) || /showing|tour/.test(type)) return 'Requested a showing'
  if (/hot .* lead|hot lead|call within 5 min/.test(name)) return 'Hot lead call due'
  return 'New lead call due'
}

/** Pure: compact age label — '5m', '3h', '2d'. */
export function formatTriageAge(occurredAt: string, nowMs: number): string {
  const t = Date.parse(occurredAt)
  if (!Number.isFinite(t)) return ''
  const mins = Math.max(0, Math.round((nowMs - t) / 60_000))
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

/**
 * Pure: the doc-open / visit "seen" watermark. An item is suppressed when the
 * person's crm_conversation_state row was touched AFTER the event — any triage
 * action (mark read, dashboard dismiss, assignment) counts as the broker having
 * engaged with this person since the signal fired.
 */
export function isSuppressedByStateTouch(
  stateUpdatedAt: string | null | undefined,
  occurredAt: string,
): boolean {
  if (!stateUpdatedAt) return false
  const touched = Date.parse(stateUpdatedAt)
  const event = Date.parse(occurredAt)
  if (!Number.isFinite(touched) || !Number.isFinite(event)) return false
  return touched > event
}

/** Pure: unread per the inbox rule — no state row (undefined) or status 'unread'. */
export function isUnreadStatus(status: string | null | undefined): boolean {
  return status == null || status === 'unread'
}

// ── Reader ───────────────────────────────────────────────────────────────────

/** The look-back window for every source. */
export const TRIAGE_WINDOW_HOURS = 72

/** Hot-visitor threshold — same env knob as the escalation cron (default 100). */
function hotThreshold(): number {
  const raw = process.env.VISITOR_HOT_LEAD_THRESHOLD?.trim()
  const n = raw ? Number(raw) : 100
  return Number.isFinite(n) && n > 0 ? n : 100
}

const IN_CHUNK = 400

type Sb = ReturnType<typeof createServiceClient>

async function fetchPeople(
  sb: Sb,
  ids: number[],
  brokerScope: string | null,
): Promise<Map<number, { name: string | null }>> {
  const out = new Map<number, { name: string | null }>()
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    let q = sb
      .from('crm_people')
      .select('id,name,assigned_broker')
      .eq('deleted', false)
      .in('id', ids.slice(i, i + IN_CHUNK))
    if (brokerScope) q = q.eq('assigned_broker', brokerScope)
    const { data } = await q
    for (const p of data ?? []) out.set(p.id as number, { name: (p.name as string | null) ?? null })
  }
  return out
}

async function fetchStates(
  sb: Sb,
  ids: number[],
): Promise<Map<number, { status: string | null; updatedAt: string | null }>> {
  const out = new Map<number, { status: string | null; updatedAt: string | null }>()
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const { data } = await sb
      .from('crm_conversation_state')
      .select('person_id,status,updated_at')
      .in('person_id', ids.slice(i, i + IN_CHUNK))
    for (const s of data ?? []) {
      out.set(s.person_id as number, {
        status: (s.status as string | null) ?? null,
        updatedAt: (s.updated_at as string | null) ?? null,
      })
    }
  }
  return out
}

/**
 * The ranked inbound-triage list for the dashboard. brokerScope null = all
 * brokers (superuser Everyone view); a slug pins every source to that broker's
 * contacts. Returns ranked items, most urgent first.
 */
export async function getInboundTriage(brokerScope: string | null): Promise<TriageItem[]> {
  const sb = createServiceClient()
  const nowMs = Date.now()
  const cutoffIso = new Date(nowMs - TRIAGE_WINDOW_HOURS * 3_600_000).toISOString()
  const nowIso = new Date(nowMs).toISOString()

  type InboundRow = { person_id: number; ts: string; kind: string; title: string | null }
  type DocRow = {
    person_id: number
    event: string
    send_type: string | null
    email_key: string | null
    occurred_at: string
  }
  type VisitRow = { crm_person_id: number; last_seen_at: string; engagement_score: number }
  type TaskRow = {
    id: number
    person_id: number
    name: string | null
    type: string | null
    origin: string | null
    due_at: string
  }

  // Fail-soft row fetch: a broken source never blanks the queue. The Supabase
  // builder is a thenable (PromiseLike), so wrap in a real try/catch.
  const safeRows = async <T,>(q: PromiseLike<{ data: unknown }>): Promise<T[]> => {
    try {
      const { data } = await q
      return (data ?? []) as T[]
    } catch {
      return []
    }
  }

  // Four source reads in one flight, each fail-soft.
  const [inboundRows, docRows, visitRows, taskRows] = await Promise.all([
    safeRows<InboundRow>(
      sb
        .from('crm_timeline')
        .select('person_id,ts,kind,title')
        .in('kind', ['sms_in', 'email_in'])
        .gte('ts', cutoffIso)
        .order('ts', { ascending: false })
        .limit(500),
    ),
    safeRows<DocRow>(
      sb
        .from('email_events')
        .select('person_id,event,send_type,email_key,occurred_at')
        .in('event', ['open', 'click'])
        .gte('occurred_at', cutoffIso)
        .not('person_id', 'is', null)
        .order('occurred_at', { ascending: false })
        .limit(1000),
    ),
    safeRows<VisitRow>(
      sb
        .from('visitor_sessions')
        .select('crm_person_id,last_seen_at,engagement_score')
        .gte('last_seen_at', cutoffIso)
        .gte('engagement_score', hotThreshold())
        .not('crm_person_id', 'is', null)
        .order('last_seen_at', { ascending: false })
        .limit(200),
    ),
    safeRows<TaskRow>(
      sb
        .from('crm_tasks')
        .select('id,person_id,name,type,origin,due_at')
        .is('completed_at', null)
        .not('person_id', 'is', null)
        .gte('due_at', cutoffIso)
        .lte('due_at', nowIso)
        .order('due_at', { ascending: false })
        .limit(300),
    ),
  ])

  const triageTasks = taskRows.filter((t) => isTriageTaskCandidate(t))
  const docEvents = docRows
    .map((r) => ({ ...r, docType: classifyDocEvent(r.send_type, r.email_key) }))
    .filter((r): r is DocRow & { docType: TriageDocType } => r.docType != null)

  const candidateIds = Array.from(
    new Set<number>([
      ...inboundRows.map((r) => r.person_id),
      ...docEvents.map((r) => r.person_id),
      ...visitRows.map((r) => r.crm_person_id),
      ...triageTasks.map((r) => r.person_id),
    ]),
  ).filter((id) => Number.isFinite(id) && id > 0)
  if (candidateIds.length === 0) return []

  // ONE person fetch scopes all four sources identically (deleted + broker).
  const people = await fetchPeople(sb, candidateIds, brokerScope).catch(
    () => new Map<number, { name: string | null }>(),
  )
  if (people.size === 0) return []
  const scopedIds = [...people.keys()]
  const states = await fetchStates(sb, scopedIds).catch(
    () => new Map<number, { status: string | null; updatedAt: string | null }>(),
  )

  const items: Array<Omit<TriageItem, 'rank'>> = []

  // 1) Unread inbound replies — newest inbound per person, unread overlay only.
  const seenReply = new Set<number>()
  for (const r of inboundRows) {
    const person = people.get(r.person_id)
    if (!person || seenReply.has(r.person_id)) continue
    seenReply.add(r.person_id)
    if (!isUnreadStatus(states.get(r.person_id)?.status)) continue
    items.push({
      id: `reply:${r.person_id}`,
      kind: 'reply',
      personId: r.person_id,
      personName: person.name,
      signal: replySignal(r.kind, r.title),
      occurredAt: r.ts,
      deepLink: `/admin/people/${r.person_id}#comms`,
      taskId: null,
    })
  }

  // 2) Doc opens — grouped per person + doc type, suppressed by the seen watermark.
  const docGroups = new Map<string, { personId: number; docType: TriageDocType; count: number; newest: string }>()
  for (const r of docEvents) {
    if (!people.has(r.person_id)) continue
    const key = `${r.person_id}:${r.docType}`
    const g = docGroups.get(key)
    if (g) {
      g.count += 1
      if (r.occurred_at > g.newest) g.newest = r.occurred_at
    } else {
      docGroups.set(key, { personId: r.person_id, docType: r.docType, count: 1, newest: r.occurred_at })
    }
  }
  for (const g of docGroups.values()) {
    if (isSuppressedByStateTouch(states.get(g.personId)?.updatedAt, g.newest)) continue
    items.push({
      id: `doc:${g.docType}:${g.personId}`,
      kind: 'doc-open',
      personId: g.personId,
      personName: people.get(g.personId)?.name ?? null,
      signal: docSignal(g.docType, g.count),
      occurredAt: g.newest,
      deepLink: `/admin/people/${g.personId}`,
      taskId: null,
    })
  }

  // 3) Hot identified visitors — newest session per person, watermark-suppressed.
  const seenVisit = new Set<number>()
  for (const r of visitRows) {
    const pid = r.crm_person_id
    if (!people.has(pid) || seenVisit.has(pid)) continue
    seenVisit.add(pid)
    if (isSuppressedByStateTouch(states.get(pid)?.updatedAt, r.last_seen_at)) continue
    items.push({
      id: `visit:${pid}`,
      kind: 'visit',
      personId: pid,
      personName: people.get(pid)?.name ?? null,
      signal: visitSignal(r.last_seen_at, r.engagement_score, nowMs),
      occurredAt: r.last_seen_at,
      deepLink: `/admin/people/${pid}`,
      taskId: null,
    })
  }

  // 4) Showing-request / new-lead tasks due — one item per task (dismiss = snooze).
  for (const t of triageTasks) {
    if (!people.has(t.person_id)) continue
    items.push({
      id: `task:${t.id}`,
      kind: 'task',
      personId: t.person_id,
      personName: people.get(t.person_id)?.name ?? null,
      signal: taskSignal(t),
      occurredAt: t.due_at,
      deepLink: `/admin/people/${t.person_id}`,
      taskId: t.id,
    })
  }

  return rankTriageItems(items, nowMs)
}
