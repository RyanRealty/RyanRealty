/**
 * Re-decide the Vault's mail history after a filing-rules change.
 * docs/TC_MAIL_FILING_RULES.md "Re-deciding history after a rules change".
 *
 * tc_mail_reviews holds one row per (mailbox, gmail_id) with the rules version
 * that decided it. When lib/tc/mail-rules.ts changes MAIL_RULES_VERSION, every
 * row decided under another version is decided again, oldest message first,
 * through the production decision (indexGmailMessage, read-only first), and
 * the difference is classified per message:
 *
 *   unchanged   same outcome (the review row is re-stamped with the new version)
 *   relabel     no filing change, another non-filed label (not_deal ↔ bulk, ambiguous ↔ unfiled_transaction)
 *   file        was bulk / not_deal / queued, now filed
 *   queue       was bulk / not_deal, now waits in the mail queue
 *   unfile      was filed, now not a deal
 *   requeue     was filed, now needs a person (mail queue)
 *   dequeue     was queued, now not a deal
 *   move        was filed on deal A, now on deal B (or another cycle of A)
 *   kept_model  queued by the model stage; the rules alone do not file it, so it stays for a person
 *   protected   a person decided it (or the model / the auto-open sweep filed it): never touched
 *   gone        the message is no longer in any mailbox: left alone
 *   error       Gmail or the decision failed after retries: left for the next run
 *
 * Safety:
 *  - Dry run (the default) writes nothing: every database handle it holds
 *    refuses writes, and it never takes the lock.
 *  - A message a person decided (tc_mail_messages.decided_by is not 'system',
 *    a review row with stage 'person', or status kept_manual / dismissed) is
 *    never re-decided, re-stamped, moved or unfiled. Re-checked against a fresh
 *    read right before every write.
 *  - Apply files through the live path (indexGmailMessage, not dry), so a new
 *    filing gets its documents and offers exactly as the 15-minute sync would.
 *    A message leaving a deal goes through lib/tc/mail-reconcile.ts: its own
 *    documents are archived only when no other filing uses them and no person
 *    relies on them; every move and unfile writes a tc_events row; offers are
 *    never deleted (named in the event for a person).
 *  - Thread anchors: a reply filed "same thread" follows a sibling only once
 *    that sibling has itself been re-decided (or a person / the model decided
 *    it), so a thread misfiled as a whole cannot hold itself in place.
 *  - One run at a time (a lock row in tc_mail_review_cursors); batches, a
 *    deadline, Gmail 429/5xx retry with backoff. Resumable and idempotent: a
 *    re-decided row carries the new rules version and is not selected again.
 */
import 'server-only'
import { randomUUID } from 'node:crypto'
import type { gmail_v1 } from 'googleapis'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'
import { CRM_MAILBOXES, getGmailFor } from '@/lib/crm/gmail'
import { MAIL_RULES_VERSION, type MailStatus } from '@/lib/tc/mail-rules'
import { indexGmailMessage, loadMailUniverse, reviewReasonFor, reviewStageFor, withoutNul, type IndexResult, type MailUniverse } from '@/lib/tc/mail-index'
import {
  REDECIDE_ARCHIVE_PREFIX,
  messageKeyFromDedupe,
  planDocumentsOffDeal,
  planDocumentsOnDeal,
  redecideArchiveReason,
  type DocumentsOffDealPlan,
  type MessageDocument,
} from '@/lib/tc/mail-reconcile'

export const REDECIDE_ACTOR = 'system:tc-mail-redecide'
/** The lock row's key in tc_mail_review_cursors (never a real mailbox, so the coverage view ignores it). */
export const REDECIDE_LOCK_KEY = 'lock:tc-mail-redecide'
const LOCK_STALE_MS = 20 * 60_000
const READONLY_SCOPE = ['https://www.googleapis.com/auth/gmail.readonly']

// ── shapes ─────────────────────────────────────────────────────────────────

export type CopyRef = { mailbox: string; gmailId: string }
export const refKey = (r: CopyRef): string => `${r.mailbox}|${r.gmailId}`

export type ReviewRow = CopyRef & {
  threadId: string | null
  internalAt: string | null
  status: string
  stage: string
  rulesVersion: string
  dealId: string | null
  messageKey: string | null
}

export type MessageRow = {
  id: string
  messageKey: string
  status: string
  decidedBy: string
  dealId: string | null
  cycleId: string | null
  rulesVersion: string
  gmailRefs: CopyRef[]
  threadKey: string | null
  gmailThreadIds: string[]
  sentAt: string | null
  matchMethod: string | null
  reasons: string[]
  subject: string | null
}

export type LedgerStatus = 'filed' | 'ambiguous' | 'unfiled_transaction' | 'not_deal' | 'bulk' | 'error'
export type LedgerState = { status: LedgerStatus; dealId: string | null; cycleId: string | null }

export type DecidedCopy = CopyRef & {
  messageKey: string
  status: MailStatus
  dealId: string | null
  cycleId: string | null
  method: string | null
  score: number | null
  category: string | null
  reasons: string[]
  candidates: unknown[]
  subject: string | null
  threadId: string | null
  /** RFC thread key, read off the decision's own thread-anchor query. */
  threadKey: string | null
  internalAt: string | null
  reviewReason: string
  reviewStage: 'rules' | 'thread' | 'model'
}

export type CopyOutcome =
  | { kind: 'decided'; copy: DecidedCopy }
  | { kind: 'gone' | 'error'; ref: CopyRef; error: string; messageKey: string | null }

export const TRANSITIONS = [
  'unchanged',
  'relabel',
  'file',
  'queue',
  'unfile',
  'requeue',
  'dequeue',
  'move',
  'kept_model',
  'protected',
  'gone',
  'error',
] as const
export type Transition = (typeof TRANSITIONS)[number]

export type Protection = 'person' | 'kept_manual' | 'model' | 'auto_open' | 'manual'

// ── pure rules of the re-decision ─────────────────────────────────────────

const QUEUED = new Set(['ambiguous', 'unfiled_transaction'])
const isQueued = (s: string | null | undefined): boolean => QUEUED.has(String(s))
const isStored = (s: string | null | undefined): boolean => s === 'filed' || isQueued(s)

/**
 * Who decided this message, when it was not the rules. A person's decision
 * (queue answer, dismissal, hand filing) wins forever; the model's filings and
 * the auto-open sweep's are kept the way the live index keeps them
 * (indexGmailMessage returns kept_manual for any decided_by other than 'system').
 */
export function protectionOf(
  message: Pick<MessageRow, 'decidedBy'> | null,
  reviews: ReadonlyArray<Pick<ReviewRow, 'stage' | 'status'>>,
): Protection | null {
  if (reviews.some((r) => r.stage === 'person' || r.status === 'dismissed')) return 'person'
  if (reviews.some((r) => r.status === 'kept_manual')) return 'kept_manual'
  if (message && message.decidedBy !== 'system') {
    if (message.decidedBy.includes('@')) return 'person'
    if (message.decidedBy === 'model') return 'model'
    if (message.decidedBy === 'system:mail-index') return 'auto_open'
    return 'manual'
  }
  return null
}

/** What the Vault holds for this message now: the index row when there is one, else the review row. */
export function oldStateOf(message: Pick<MessageRow, 'status' | 'dealId' | 'cycleId'> | null, review: Pick<ReviewRow, 'status'> | null): LedgerState {
  if (message?.status === 'filed') return { status: 'filed', dealId: message.dealId, cycleId: message.cycleId }
  if (message && isQueued(message.status)) return { status: message.status as LedgerStatus, dealId: message.dealId, cycleId: null }
  const s = review?.status
  if (s === 'bulk' || s === 'not_deal' || s === 'error') return { status: s, dealId: null, cycleId: null }
  // A review row that says filed/queued with no index row behind it (or a
  // system-dismissed row): nothing is on any deal.
  return { status: 'not_deal', dealId: null, cycleId: null }
}

/** The model queued it (its reason is on the row, or a review row came from the model stage). */
export function isModelQueued(
  message: Pick<MessageRow, 'status' | 'reasons'> | null,
  reviews: ReadonlyArray<Pick<ReviewRow, 'stage' | 'status'>>,
): boolean {
  if (!message || !isQueued(message.status)) return false
  return message.reasons.some((r) => /^model:/i.test(r)) || reviews.some((r) => r.stage === 'model' && isQueued(r.status))
}

export function classifyTransition(input: {
  old: LedgerState
  next: LedgerState | 'gone' | 'error'
  protection: Protection | null
  modelQueued?: boolean
}): Transition {
  if (input.protection) return 'protected'
  if (input.next === 'gone') return 'gone'
  if (input.next === 'error') return 'error'
  const { old, next } = input
  if (old.status === 'filed') {
    if (next.status === 'filed') return next.dealId === old.dealId && next.cycleId === old.cycleId ? 'unchanged' : 'move'
    return isQueued(next.status) ? 'requeue' : 'unfile'
  }
  if (isQueued(old.status)) {
    if (next.status === 'filed') return 'file'
    if (input.modelQueued) return 'kept_model'
    if (isQueued(next.status)) return next.status === old.status ? 'unchanged' : 'relabel'
    return 'dequeue'
  }
  if (next.status === 'filed') return 'file'
  if (isQueued(next.status)) return 'queue'
  return next.status === old.status ? 'unchanged' : 'relabel'
}

export function moveKindOf(old: LedgerState, next: LedgerState): 'deal' | 'cycle' | null {
  if (old.status !== 'filed' || next.status !== 'filed') return null
  if (old.dealId !== next.dealId) return 'deal'
  return old.cycleId !== next.cycleId ? 'cycle' : null
}

const RANK: Record<string, number> = { filed: 4, ambiguous: 3, unfiled_transaction: 3, not_deal: 2, bulk: 1 }

/**
 * One message, several mailbox copies: the message's outcome is its best
 * copy's (a copy filed by its own thread wins over one that is ordinary mail
 * in another inbox, as in the live index). Among filings, the one that keeps
 * the current deal wins. A copy that failed to decide blocks the message (it
 * might have been the filing one); a copy deleted from its mailbox does not vote.
 */
export function combineCopies(
  outcomes: readonly CopyOutcome[],
  prefer: { dealId: string | null; cycleId: string | null } | null,
): { kind: 'decided'; lead: DecidedCopy } | { kind: 'gone' } | { kind: 'error'; error: string } {
  const failed = outcomes.find((o) => o.kind === 'error')
  if (failed && failed.kind === 'error') return { kind: 'error', error: failed.error }
  const decided = outcomes.flatMap((o) => (o.kind === 'decided' ? [o.copy] : []))
  if (!decided.length) return { kind: 'gone' }
  const top = Math.max(...decided.map((c) => RANK[c.status] ?? 0))
  const best = decided.filter((c) => (RANK[c.status] ?? 0) === top)
  if (prefer && top === RANK.filed) {
    const same = best.find((c) => c.dealId === prefer.dealId && c.cycleId === prefer.cycleId) ?? best.find((c) => c.dealId === prefer.dealId)
    if (same) return { kind: 'decided', lead: same }
  }
  return { kind: 'decided', lead: best[0] }
}

export const stateOfCopy = (c: Pick<DecidedCopy, 'status' | 'dealId' | 'cycleId'>): LedgerState => ({
  status: c.status,
  dealId: c.status === 'filed' ? c.dealId : isQueued(c.status) ? c.dealId : null,
  cycleId: c.status === 'filed' ? c.cycleId : null,
})

/** Review rows decided under another rules version, filtered, oldest message first. */
export function selectCandidates(
  rows: readonly ReviewRow[],
  f: { currentVersion: string; mailboxes?: readonly string[] | null; statuses?: readonly string[] | null; since?: string | null },
): ReviewRow[] {
  const mailboxes = f.mailboxes?.length ? new Set(f.mailboxes) : null
  const statuses = f.statuses?.length ? new Set(f.statuses) : null
  const since = f.since ? Date.parse(f.since) : null
  const at = (r: ReviewRow) => (r.internalAt ? Date.parse(r.internalAt) : Number.POSITIVE_INFINITY)
  return rows
    .filter((r) => r.rulesVersion !== f.currentVersion)
    .filter((r) => !mailboxes || mailboxes.has(r.mailbox))
    .filter((r) => !statuses || statuses.has(r.status))
    .filter((r) => since == null || (r.internalAt != null && Date.parse(r.internalAt) >= since))
    .sort((a, b) => at(a) - at(b) || a.mailbox.localeCompare(b.mailbox) || a.gmailId.localeCompare(b.gmailId))
}

// ── thread anchors ────────────────────────────────────────────────────────

export type AnchorQuery = { threadKey?: string; gmailThreadId?: string; limit?: number }
export type AnchorRow = { deal_id: string | null; match_method: string | null; message_key: string }
export type AnchorSource = (q: AnchorQuery) => AnchorRow[]

/** Every index row in memory, by message key, mailbox copy and thread; answers the thread-anchor query. */
export class MessageStore {
  private byKey = new Map<string, MessageRow>()
  private byRef = new Map<string, string>()
  private byThread = new Map<string, Set<string>>()

  constructor(rows: readonly MessageRow[] = []) {
    for (const r of rows) this.put(r)
  }

  get(messageKey: string | null | undefined): MessageRow | null {
    return messageKey ? (this.byKey.get(messageKey) ?? null) : null
  }

  byCopy(ref: CopyRef): MessageRow | null {
    return this.get(this.byRef.get(refKey(ref)))
  }

  put(row: MessageRow): void {
    this.byKey.set(row.messageKey, row)
    for (const ref of row.gmailRefs) this.byRef.set(refKey(ref), row.messageKey)
    const add = (k: string) => {
      const set = this.byThread.get(k) ?? new Set<string>()
      set.add(row.messageKey)
      this.byThread.set(k, set)
    }
    if (row.threadKey) add(`k:${row.threadKey}`)
    for (const t of row.gmailThreadIds) add(`g:${t}`)
  }

  /** Filed rows sharing this RFC thread or one of these Gmail threads, other than `messageKey`. */
  filedSiblings(messageKey: string, threadKey: string | null, gmailThreadIds: readonly string[]): MessageRow[] {
    const keys = new Set<string>()
    for (const k of threadKey ? (this.byThread.get(`k:${threadKey}`) ?? []) : []) keys.add(k)
    for (const t of gmailThreadIds) for (const k of this.byThread.get(`g:${t}`) ?? []) keys.add(k)
    keys.delete(messageKey)
    return [...keys].map((k) => this.byKey.get(k)).filter((m): m is MessageRow => !!m && m.status === 'filed' && !!m.dealId)
  }

  anchorRows(q: AnchorQuery, eligible: (m: MessageRow) => boolean): AnchorRow[] {
    const keys = q.threadKey ? this.byThread.get(`k:${q.threadKey}`) : q.gmailThreadId ? this.byThread.get(`g:${q.gmailThreadId}`) : undefined
    const rows = [...(keys ?? [])]
      .map((k) => this.byKey.get(k))
      .filter((m): m is MessageRow => !!m && m.status === 'filed' && !!m.dealId && eligible(m))
      .sort((a, b) => (Date.parse(b.sentAt ?? '') || 0) - (Date.parse(a.sentAt ?? '') || 0))
    return rows.slice(0, q.limit ?? 5).map((m) => ({ deal_id: m.dealId, match_method: m.matchMethod, message_key: m.messageKey }))
  }
}

/**
 * May this filed row anchor its thread for the message being re-decided? Yes
 * when a person, the model or the auto-open sweep decided it, when it was
 * decided under the current rules, or when this run will not re-decide it
 * (outside the run's scope, or already left alone as gone/error). A row this
 * run has yet to re-decide cannot hold its thread on its old deal.
 */
export function anchorEligible(m: Pick<MessageRow, 'decidedBy' | 'rulesVersion' | 'gmailRefs'>, currentVersion: string, pending: ReadonlySet<string>): boolean {
  if (m.decidedBy !== 'system') return true
  if (m.rulesVersion === currentVersion) return true
  return !m.gmailRefs.some((r) => pending.has(refKey(r)))
}

export const ANCHOR_VIEW_ERROR = 'mail re-decision anchor view:'
const ANCHOR_SELECT = 'deal_id, match_method, message_key'
const WRITE_METHODS = new Set(['insert', 'upsert', 'update', 'delete'])

/**
 * The Supabase handle the re-decision gives indexGmailMessage. It answers the
 * thread-anchor query (lib/tc/mail-index.ts threadAnchor: select
 * 'deal_id, match_method, message_key' from tc_mail_messages, status filed, by
 * thread_key or Gmail thread id) from `answer`, and passes every other call
 * through. `readOnly` refuses every write, RPC and storage call. Any change to
 * the anchor query's shape fails loudly (ANCHOR_VIEW_ERROR), never silently
 * falls back to unfiltered anchors.
 */
export function anchorViewClient(
  real: SupabaseClient,
  answer: AnchorSource | null,
  opts: { readOnly: boolean; onAnchorQuery?: (q: AnchorQuery) => void },
): SupabaseClient {
  const fail = (what: string) => new Error(`${ANCHOR_VIEW_ERROR} ${what}`)
  const anchorChain = () => {
    const q: AnchorQuery & { status?: string } = {}
    const chain: Record<string, unknown> = {
      eq(col: string, val: unknown) {
        if (col === 'status') q.status = String(val)
        else if (col === 'thread_key') q.threadKey = String(val)
        else throw fail(`unexpected eq(${col}) on the thread-anchor query; update lib/tc/mail-redecide.ts`)
        return proxy
      },
      contains(col: string, val: unknown) {
        if (col !== 'gmail_thread_ids' || !Array.isArray(val) || val.length !== 1) throw fail(`unexpected contains(${col}) on the thread-anchor query`)
        q.gmailThreadId = String(val[0])
        return proxy
      },
      order(col: string, o?: { ascending?: boolean }) {
        if (col !== 'sent_at' || o?.ascending !== false) throw fail(`unexpected order(${col}) on the thread-anchor query`)
        return proxy
      },
      limit(n: number) {
        q.limit = n
        return proxy
      },
      then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
        try {
          if (q.status !== 'filed' || (!q.threadKey && !q.gmailThreadId)) throw fail('the thread-anchor query lost its status/thread filter')
          opts.onAnchorQuery?.(q)
          return Promise.resolve({ data: answer ? answer(q) : [], error: null }).then(resolve, reject)
        } catch (err) {
          return Promise.reject(err).then(resolve, reject)
        }
      },
    }
    const proxy: unknown = new Proxy(chain, {
      get(target, prop) {
        if (typeof prop === 'symbol') return undefined
        if (prop in target) return target[prop]
        throw fail(`unexpected .${prop}() on the thread-anchor query; update lib/tc/mail-redecide.ts`)
      },
    })
    return proxy
  }
  const wrapBuilder = (table: string, builder: Record<string | symbol, unknown>) =>
    new Proxy(builder, {
      get(target, prop) {
        if (prop === 'select') {
          return (cols?: string, ...rest: unknown[]) => {
            if (answer && table === 'tc_mail_messages' && String(cols ?? '').replace(/\s+/g, ' ').trim() === ANCHOR_SELECT) return anchorChain()
            return (target.select as (...a: unknown[]) => unknown).call(target, cols, ...rest)
          }
        }
        if (opts.readOnly && typeof prop === 'string' && WRITE_METHODS.has(prop)) {
          return () => {
            throw fail(`dry run refused a write (${table}.${prop})`)
          }
        }
        const v = target[prop]
        return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(target) : v
      },
    })
  return new Proxy(real, {
    get(target, prop, receiver) {
      if (prop === 'from') {
        return (table: string) => wrapBuilder(table, target.from(table) as unknown as Record<string | symbol, unknown>)
      }
      if (opts.readOnly && (prop === 'rpc' || prop === 'storage' || prop === 'schema')) throw fail(`dry run refused ${String(prop)} access`)
      const v = Reflect.get(target, prop, receiver)
      return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(target) : v
    },
  }) as SupabaseClient
}

/** A database handle that refuses every write: the dry run's only handle. */
export function readOnlyClient(real: SupabaseClient): SupabaseClient {
  return anchorViewClient(real, null, { readOnly: true })
}

// ── Gmail: retry + counting ───────────────────────────────────────────────

export type GmailStats = { calls: Record<string, number>; retries: number; rateLimited: number; failures: number }

export function newGmailStats(): GmailStats {
  return { calls: {}, retries: 0, rateLimited: 0, failures: 0 }
}

function errStatus(err: unknown): number | null {
  const e = err as { code?: unknown; status?: unknown; response?: { status?: unknown } } | null
  for (const v of [e?.response?.status, e?.status, e?.code]) {
    const n = Number(v)
    if (Number.isFinite(n) && n >= 100 && n < 600) return n
  }
  return null
}

/** 429, 5xx, Gmail's 403 rate-limit reasons, and dropped connections. */
export function isTransientGmailError(err: unknown): boolean {
  const status = errStatus(err)
  const msg = err instanceof Error ? err.message : String(err ?? '')
  if (status === 429 || (status != null && status >= 500)) return true
  if (status === 403 && /rate ?limit|userRateLimitExceeded|backendError|quota/i.test(msg)) return true
  const code = String((err as { code?: unknown } | null)?.code ?? '')
  return /ECONNRESET|ETIMEDOUT|EAI_AGAIN|ECONNREFUSED|EPIPE|ENETUNREACH|socket hang up|network|timeout|premature close|invalid response body|other side closed/i.test(`${code} ${msg}`)
}

export function isTransientErrorMessage(msg: string): boolean {
  return /\b(429|500|502|503|504)\b|rate ?limit|quota|backend ?error|internal error|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|timeout|network|fetch failed|premature close|invalid response body|other side closed/i.test(
    msg,
  )
}

export function isGoneErrorMessage(msg: string): boolean {
  return /not found|\b404\b|Requested entity was not found/i.test(msg)
}

/** 1 s, 2 s, 4 s … capped at 32 s, plus up to half a second of jitter. */
export function backoffMs(attempt: number, random: () => number = Math.random): number {
  return Math.min(32_000, 1000 * 2 ** attempt) + Math.floor(random() * 500)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** The two Gmail calls the index makes, with a longer retry than the client's own and a count per kind. */
export function gmailWithRetry(real: gmail_v1.Gmail, stats: GmailStats, maxAttempts = 6): gmail_v1.Gmail {
  const call = async <T>(kind: string, fn: () => Promise<T>): Promise<T> => {
    for (let attempt = 0; ; attempt++) {
      stats.calls[kind] = (stats.calls[kind] ?? 0) + 1
      try {
        return await fn()
      } catch (err) {
        if (!isTransientGmailError(err) || attempt + 1 >= maxAttempts) {
          stats.failures++
          throw err
        }
        stats.retries++
        if (errStatus(err) === 429 || /rate ?limit/i.test(err instanceof Error ? err.message : '')) stats.rateLimited++
        await sleep(backoffMs(attempt))
      }
    }
  }
  const messages = real.users.messages
  // New objects whose prototype is the real resource: the two calls the index
  // makes are overridden; anything else it may call later is inherited
  // (uncounted, client retry only). The client's own properties are
  // non-configurable, so a Proxy over them cannot substitute a value.
  const over = <T extends object>(proto: T, own: Record<string, unknown>): T => {
    const o = Object.create(proto) as T
    for (const [k, v] of Object.entries(own)) Object.defineProperty(o, k, { value: v, enumerable: true })
    return o
  }
  const attachments = over(messages.attachments, {
    get: (p: gmail_v1.Params$Resource$Users$Messages$Attachments$Get) => call('attachments.get', () => messages.attachments.get(p)),
  })
  const wrappedMessages = over(messages, {
    get: (p: gmail_v1.Params$Resource$Users$Messages$Get) => call(`messages.get:${p.format ?? 'full'}`, () => messages.get(p)),
    attachments,
  })
  return over(real, { users: over(real.users, { messages: wrappedMessages }) })
}

// ── the runner ────────────────────────────────────────────────────────────

export type OffDealResult = DocumentsOffDealPlan & {
  /** tc_offers rows this message recorded on the deal it leaves. Never deleted; named for a person. */
  offersLeft: Array<{ id: string; status: string; price: number | null; buyerAgent: string | null }>
}

export type OnDealResult = {
  restored: string[]
  moved: string[]
  duplicatesArchived: string[]
  kept: Array<{ id: string; reason: string }>
}

export type LiveOutcome = {
  status: IndexResult['status']
  dealId: string | null
  cycleId: string | null
  messageKey: string
  error?: string
}

export type StampRow = CopyRef & {
  threadId: string | null
  internalAt: string | null
  status: string
  dealId: string | null
  messageKey: string | null
  reason: string
  stage: string
  rulesVersion: string
}

export type RedecideEvent = { dealId: string; cycleId: string | null; action: 'mail_unfiled' | 'mail_moved' | 'mail_refiled'; detail: Record<string, unknown> }

/** The writes of an --apply run. Every method is guarded against a person's decision. */
export interface RedecideApplier {
  lock: { acquire(): Promise<void>; heartbeat(progress: { processed: number }): Promise<void>; release(): Promise<void> }
  /** Fresh index row by message key. */
  readMessage(messageKey: string): Promise<MessageRow | null>
  /** The live path (indexGmailMessage, not a dry run), anchored on `anchors`. Writes the review row itself. */
  indexLive(ref: CopyRef, anchors: AnchorSource): Promise<LiveOutcome>
  /** Upsert review rows; skips any row a person decided since it was read. */
  stampReviews(rows: readonly StampRow[]): Promise<{ written: number; skippedProtected: number }>
  /** Same filing, new rules version: refresh the index row's rules version and reasons. */
  touchMessage(message: MessageRow, copy: DecidedCopy): Promise<void>
  /** The rules no longer keep this message: status dismissed, off any deal, decided_by stays 'system'. */
  dismissMessage(message: MessageRow, info: { copy: DecidedCopy; transition: Transition; previous: LedgerState }): Promise<void>
  correctOffDeal(input: { message: MessageRow; from: LedgerState; toAddress: string | null; newStatus: string }): Promise<OffDealResult>
  settleOnDeal(input: { messageKey: string; messageId: string; dealId: string; cycleId: string }): Promise<OnDealResult>
  /**
   * Documents this index row filed (classification.mail_message_id) that sit
   * on a deal the row no longer names: left behind by an earlier move or
   * unfile (the live index never takes documents back, and a run that stopped
   * between filing and correcting leaves them too). Corrected like
   * correctOffDeal, one result per deal.
   */
  correctLeftovers(message: MessageRow): Promise<Array<{ dealId: string; off: OffDealResult }>>
  event(e: RedecideEvent): Promise<void>
}

export interface RedecideDeps {
  currentVersion: string
  loadReviews(): Promise<ReviewRow[]>
  loadMessages(): Promise<MessageRow[]>
  /** The production decision for one mailbox copy, read-only, thread anchors from `anchors`. */
  decide(ref: CopyRef, anchors: AnchorSource): Promise<CopyOutcome>
  dealAddress(dealId: string | null): string | null
  /** Read-only preview of correctOffDeal, for the dry-run report. */
  previewOffDeal?(input: { message: MessageRow; from: LedgerState }): Promise<OffDealResult>
  /** Read-only preview of correctLeftovers. */
  previewLeftovers?(message: MessageRow): Promise<Array<{ dealId: string; off: OffDealResult }>>
  applier?: RedecideApplier
  gmailStats?: () => GmailStats
}

export type RedecideOptions = {
  apply: boolean
  mailboxes?: readonly string[] | null
  statuses?: readonly string[] | null
  since?: string | null
  /** Candidate rows this run may take (a smoke-test cap). */
  limit?: number | null
  concurrency?: number
  batchSize?: number
  /** Epoch ms: stop between messages past it. */
  deadline?: number | null
  /** Checked between messages (a Ctrl-C): stop, flush and release the lock. */
  shouldStop?: () => boolean
  onBatch?: (p: RedecideProgress) => void
  /** Every row that is not unchanged, as it is decided (a caller streams these to a file). */
  onChange?: (row: ChangeRow) => void
}

export type RedecideProgress = { processedRows: number; selectedRows: number; elapsedMs: number; byTransition: Record<string, number> }

export type ChangeRow = {
  mailbox: string
  gmailId: string
  messageKey: string | null
  transition: Transition
  moveKind: 'deal' | 'cycle' | null
  oldStatus: string
  newStatus: string | null
  oldDealId: string | null
  newDealId: string | null
  oldDeal: string | null
  newDeal: string | null
  oldCycleId: string | null
  newCycleId: string | null
  protection: Protection | null
  subject: string | null
  reasons: string[]
  internalAt: string | null
  documents?: { archive: string[]; keep: Array<{ id: string; reason: string }>; offersLeft: number } | null
  note?: string
}

export type RedecideReport = {
  rulesVersion: string
  apply: boolean
  startedAt: string
  finishedAt: string
  elapsedMs: number
  /** Loading the review ledger and the index (before the first decision). */
  loadMs: number
  /** Review rows under another rules version before filters. */
  staleRows: number
  selectedRows: number
  processedRows: number
  /** False when a limit, the deadline or a stop left selected rows for the next run. */
  complete: boolean
  rowsByMailbox: Record<string, Record<string, number>>
  messagesByTransition: Record<string, number>
  moveKinds: { deal: number; cycle: number }
  protectedBy: Record<string, number>
  documents: {
    toArchive: number
    kept: number
    keptReasons: Record<string, number>
    alreadyArchived: number
    offersLeft: number
    restored: number
    moved: number
    duplicatesArchived: number
    /** Documents an index row filed on a deal it no longer names (see correctLeftovers). */
    leftovers: { messages: number; deals: number; toArchive: number; kept: number }
  }
  divergences: Array<{ messageKey: string; planned: Transition; actual: Transition }>
  errors: Array<{ mailbox: string; gmailId: string; error: string }>
  decide: { count: number; totalMs: number; meanMs: number; p50Ms: number; p90Ms: number; maxMs: number }
  gmail: GmailStats | null
  /** Messages whose apply goes through the live path (a second Gmail read): every filing change, and queued rows refreshed. */
  livePathMessages: number
  /** Messages held back until their thread's siblings were decided again (then decided at the end of the run). */
  deferred: number
  /** Held-back messages whose thread still waits on rows outside this run: left for the next run. */
  leftForNextRun: number
  samples: Record<string, ChangeRow[]>
  stamped: { written: number; skippedProtected: number }
}

class KeyedMutex {
  private tails = new Map<string, Promise<unknown>>()
  async run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.tails.get(key) ?? Promise.resolve()
    const run = prev.catch(() => undefined).then(fn)
    const tail = run.catch(() => undefined)
    this.tails.set(key, tail)
    try {
      return await run
    } finally {
      if (this.tails.get(key) === tail) this.tails.delete(key)
    }
  }
}

function uniqRefs(refs: readonly CopyRef[]): CopyRef[] {
  const seen = new Set<string>()
  const out: CopyRef[] = []
  for (const r of refs) {
    const k = refKey(r)
    if (seen.has(k)) continue
    seen.add(k)
    out.push({ mailbox: r.mailbox, gmailId: r.gmailId })
  }
  return out
}

function percentile(sorted: readonly number[], p: number): number {
  if (!sorted.length) return 0
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]
}

const SAMPLES_PER_CLASS = 10

/**
 * Re-decide every review row decided under another rules version. Dry run
 * unless `apply`. See the file header for the transitions and the safety rules.
 */
export async function runRedecide(opts: RedecideOptions, deps: RedecideDeps): Promise<RedecideReport> {
  const t0 = Date.now()
  const current = deps.currentVersion
  const applier = opts.apply ? deps.applier : undefined
  if (opts.apply && !applier) throw new Error('mail re-decision: --apply needs an applier')
  const concurrency = Math.max(1, opts.concurrency ?? 4)
  const batchSize = Math.max(1, opts.batchSize ?? 200)

  const [allReviews, messages] = await Promise.all([deps.loadReviews(), deps.loadMessages()])
  const loadMs = Date.now() - t0
  const reviewByRef = new Map(allReviews.map((r) => [refKey(r), r]))
  const stale = allReviews.filter((r) => r.rulesVersion !== current).length
  const candidates = selectCandidates(allReviews, { currentVersion: current, mailboxes: opts.mailboxes, statuses: opts.statuses, since: opts.since })
  const todo = opts.limit != null ? candidates.slice(0, Math.max(0, opts.limit)) : candidates
  const store = new MessageStore(messages)
  const pending = new Set(candidates.map(refKey))
  const done = new Set<string>()

  const report: RedecideReport = {
    rulesVersion: current,
    apply: !!applier,
    startedAt: new Date(t0).toISOString(),
    finishedAt: '',
    elapsedMs: 0,
    loadMs,
    staleRows: stale,
    selectedRows: candidates.length,
    processedRows: 0,
    complete: true,
    rowsByMailbox: {},
    messagesByTransition: {},
    moveKinds: { deal: 0, cycle: 0 },
    protectedBy: {},
    documents: {
      toArchive: 0,
      kept: 0,
      keptReasons: {},
      alreadyArchived: 0,
      offersLeft: 0,
      restored: 0,
      moved: 0,
      duplicatesArchived: 0,
      leftovers: { messages: 0, deals: 0, toArchive: 0, kept: 0 },
    },
    divergences: [],
    errors: [],
    decide: { count: 0, totalMs: 0, meanMs: 0, p50Ms: 0, p90Ms: 0, maxMs: 0 },
    gmail: null,
    livePathMessages: 0,
    deferred: 0,
    leftForNextRun: 0,
    samples: {},
    stamped: { written: 0, skippedProtected: 0 },
  }
  const byTransitionRows: Record<string, number> = {}
  const decideMs: number[] = []

  const eligible = (m: MessageRow) => anchorEligible(m, current, pending)
  const anchors: AnchorSource = (q) => store.anchorRows(q, eligible)
  const decisions = new Map<string, Promise<CopyOutcome>>()
  const decideOnce = (ref: CopyRef): Promise<CopyOutcome> => {
    const k = refKey(ref)
    let p = decisions.get(k)
    if (!p) {
      const started = Date.now()
      p = deps.decide(ref, anchors).then((o) => {
        decideMs.push(Date.now() - started)
        return o
      })
      decisions.set(k, p)
    }
    return p
  }
  const locks = new KeyedMutex()
  const late = () => (opts.deadline != null && Date.now() > opts.deadline) || !!opts.shouldStop?.()
  let stamps: StampRow[] = []
  const flushStamps = async () => {
    if (!applier || !stamps.length) return
    const rows = stamps
    stamps = []
    const res = await applier.stampReviews(rows)
    report.stamped.written += res.written
    report.stamped.skippedProtected += res.skippedProtected
  }
  const stampOf = (c: DecidedCopy, over: Partial<StampRow> = {}): StampRow => ({
    mailbox: c.mailbox,
    gmailId: c.gmailId,
    threadId: c.threadId,
    internalAt: c.internalAt,
    status: c.status,
    dealId: c.status === 'filed' ? c.dealId : null,
    messageKey: isStored(c.status) ? c.messageKey : null,
    reason: c.reviewReason,
    stage: c.reviewStage,
    rulesVersion: current,
    ...over,
  })

  const record = (rows: ChangeRow[], transition: Transition, protection: Protection | null) => {
    report.messagesByTransition[transition] = (report.messagesByTransition[transition] ?? 0) + 1
    if (protection) report.protectedBy[protection] = (report.protectedBy[protection] ?? 0) + 1
    for (const row of rows) {
      report.processedRows++
      const mb = (report.rowsByMailbox[row.mailbox] ??= {})
      mb[transition] = (mb[transition] ?? 0) + 1
      byTransitionRows[transition] = (byTransitionRows[transition] ?? 0) + 1
      if (transition !== 'unchanged') {
        opts.onChange?.(row)
        const s = (report.samples[transition] ??= [])
        if (s.length < SAMPLES_PER_CLASS) s.push(row)
      }
    }
  }

  const noteDocuments = (off: OffDealResult | null) => {
    if (!off) return
    report.documents.toArchive += off.archive.length
    report.documents.kept += off.keep.length
    report.documents.alreadyArchived += off.alreadyArchived.length
    report.documents.offersLeft += off.offersLeft.length
    for (const k of off.keep) {
      const cls = k.reason.split(':')[0]
      report.documents.keptReasons[cls] = (report.documents.keptReasons[cls] ?? 0) + 1
    }
  }

  const noteLeftovers = (left: ReadonlyArray<{ dealId: string; off: OffDealResult }>) => {
    const real = left.filter((l) => l.off.archive.length || l.off.keep.length)
    if (!real.length) return
    const lo = report.documents.leftovers
    lo.messages++
    lo.deals += real.length
    for (const l of real) {
      lo.toArchive += l.off.archive.length
      lo.kept += l.off.keep.length
    }
  }

  const deferred: ReviewRow[] = []
  const deferredKeys = new Set<string>()

  async function processRow(row: ReviewRow, final = false): Promise<void> {
    // A message a person decided is never re-decided: not even read from Gmail.
    const known = store.byCopy(row) ?? store.get(row.messageKey)
    const knownReviews = uniqRefs([row, ...(known?.gmailRefs ?? [])])
      .map((r) => reviewByRef.get(refKey(r)))
      .filter((r): r is ReviewRow => !!r)
    const quick = protectionOf(known, knownReviews)
    if (quick) {
      await locks.run(known?.messageKey ?? refKey(row), async () => {
        if (done.has(refKey(row))) return
        const refs = uniqRefs([row, ...(known?.gmailRefs ?? [])])
        const unitRows = refs.filter((r) => pending.has(refKey(r)) && !done.has(refKey(r)))
        if (!unitRows.some((r) => refKey(r) === refKey(row))) unitRows.unshift(row)
        for (const r of refs) {
          done.add(refKey(r))
          pending.delete(refKey(r))
        }
        const old = oldStateOf(known, reviewByRef.get(refKey(row)) ?? row)
        record(
          unitRows.map((r) => ({
            mailbox: r.mailbox,
            gmailId: r.gmailId,
            messageKey: known?.messageKey ?? reviewByRef.get(refKey(r))?.messageKey ?? null,
            transition: 'protected' as const,
            moveKind: null,
            oldStatus: known && (known.status === 'filed' || isQueued(known.status) || known.status === 'dismissed') ? known.status : String(reviewByRef.get(refKey(r))?.status ?? old.status),
            newStatus: null,
            oldDealId: old.dealId,
            newDealId: null,
            oldDeal: deps.dealAddress(old.dealId),
            newDeal: null,
            oldCycleId: old.cycleId,
            newCycleId: null,
            protection: quick,
            subject: known?.subject ?? null,
            reasons: [`decided by ${known?.decidedBy ?? 'a person'}${known && known.decidedBy !== 'system' ? '' : ' (review row)'}`],
            internalAt: reviewByRef.get(refKey(r))?.internalAt ?? null,
            documents: null,
          })),
          'protected',
          quick,
        )
      })
      return
    }
    const first = await decideOnce(row)
    const decidedKey = first.kind === 'decided' ? first.copy.messageKey : first.messageKey
    const message0 = store.get(decidedKey) ?? store.byCopy(row) ?? store.get(row.messageKey)
    const lockKey = message0?.messageKey ?? decidedKey ?? refKey(row)
    await locks.run(lockKey, async () => {
      if (done.has(refKey(row))) return
      const message = store.get(message0?.messageKey) ?? store.get(decidedKey) ?? store.byCopy(row) ?? store.get(row.messageKey)
      const refs = uniqRefs([row, ...(message?.gmailRefs ?? [])])
      const outcomes = await Promise.all(refs.map(decideOnce))
      const reviews = refs.map((r) => reviewByRef.get(refKey(r))).filter((r): r is ReviewRow => !!r)
      const protection = protectionOf(message, reviews)
      const leadReview = reviewByRef.get(refKey(row)) ?? row
      const old = oldStateOf(message, leadReview)
      const combined = combineCopies(outcomes, old.status === 'filed' ? old : null)
      const modelQueued = isModelQueued(message, reviews)
      const next: LedgerState | 'gone' | 'error' = combined.kind === 'decided' ? stateOfCopy(combined.lead) : combined.kind
      let transition = classifyTransition({ old, next, protection, modelQueued })
      const lead = combined.kind === 'decided' ? combined.lead : null
      // Rule 2 follows ANY filed sibling, a later one included. A message about
      // to leave its file while a sibling in its thread still waits to be
      // decided again is decided at the end of the run instead, once that
      // sibling has settled (it may be the one this message follows).
      if (!final && message && (transition === 'unfile' || transition === 'requeue')) {
        const threadIds = [...new Set([...message.gmailThreadIds, ...(lead?.threadId ? [lead.threadId] : [])])]
        const waiting = store.filedSiblings(message.messageKey, message.threadKey ?? lead?.threadKey ?? null, threadIds).filter((s) => !anchorEligible(s, current, pending))
        if (waiting.length) {
          deferred.push(row)
          deferredKeys.add(message.messageKey)
          report.deferred++
          for (const r of refs) decisions.delete(refKey(r))
          return
        }
      }
      const unitRows = refs.filter((r) => pending.has(refKey(r)) && !done.has(refKey(r)))
      if (!unitRows.some((r) => refKey(r) === refKey(row))) unitRows.unshift(row)

      let offPreview: OffDealResult | null = null
      let note: string | undefined
      let actualNext: LedgerState | null = null
      if (combined.kind === 'error') {
        if (report.errors.length < 200) report.errors.push({ mailbox: row.mailbox, gmailId: row.gmailId, error: combined.error })
      }

      if (!applier) {
        // Dry run: preview what the correction would do, then play the outcome
        // into the in-memory index so later messages anchor on it.
        // Previews are reads; one that fails is recorded, not fatal to a long read-only run.
        const previewFailed = (err: unknown) => {
          note = `preview failed: ${err instanceof Error ? err.message : String(err)}`.slice(0, 300)
          if (report.errors.length < 200) report.errors.push({ mailbox: row.mailbox, gmailId: row.gmailId, error: note })
        }
        const leaving = message && old.status === 'filed' && (transition === 'unfile' || transition === 'requeue' || (transition === 'move' && lead?.dealId !== old.dealId))
        if (leaving && deps.previewOffDeal) offPreview = await deps.previewOffDeal({ message, from: old }).catch((err) => (previewFailed(err), null))
        simulate({ store, message, lead, transition, current, unitRefs: refs })
        const after = message ? store.get(message.messageKey) : null
        if (!leaving && after && deps.previewLeftovers && transition !== 'protected' && transition !== 'gone' && transition !== 'error') {
          noteLeftovers(await deps.previewLeftovers(after).catch((err) => (previewFailed(err), [])))
        }
      } else if (transition !== 'protected' && transition !== 'gone' && transition !== 'error' && lead) {
        const res = await applyUnit({ message, lead, old, planned: transition, outcomes, refs, modelQueued })
        if (res.transition !== transition) note = [`planned ${transition}`, res.note].filter(Boolean).join('; ')
        else note = res.note
        transition = res.transition
        offPreview = res.off
        actualNext = res.next ?? null
        // Ordinary mail with no index row before or after has nothing to re-read.
        const touchedRow = !!message || isStored(lead.status) || (actualNext != null && isStored(actualNext.status))
        const fresh = touchedRow ? await applier.readMessage(res.messageKey ?? lead.messageKey) : null
        if (fresh) {
          store.put(fresh)
          // Anything this row filed on a deal it no longer names (an earlier
          // run that stopped part way, or the live index moving it) is corrected now.
          if (transition !== 'protected' && transition !== 'error' && fresh.decidedBy === 'system') {
            const left = await applier.correctLeftovers(fresh)
            noteLeftovers(left)
            for (const l of left) {
              if (!l.off.archive.length) continue
              await applier.event({
                dealId: l.dealId,
                cycleId: null,
                action: 'mail_unfiled',
                detail: {
                  title: fresh.subject,
                  message_key: fresh.messageKey,
                  mail_message_id: fresh.id,
                  rules_version: current,
                  now: fresh.status,
                  now_deal_id: fresh.status === 'filed' ? fresh.dealId : null,
                  note: 'documents this email filed here earlier, left behind when it moved or was unfiled',
                  archived_document_ids: l.off.archive,
                  kept_documents: l.off.keep,
                  offers_left_for_review: l.off.offersLeft,
                },
              })
            }
          }
        }
      }
      noteDocuments(offPreview)
      const nextState = actualNext ?? (next === 'gone' || next === 'error' ? null : next)
      if (
        ['file', 'queue', 'move', 'requeue', 'unfile', 'dequeue'].includes(transition) ||
        ((transition === 'unchanged' || transition === 'relabel') && isQueued(old.status) && isQueued(nextState?.status))
      ) {
        report.livePathMessages++
      }
      if (transition === 'move' && nextState) {
        const kind = moveKindOf(old, nextState)
        if (kind) report.moveKinds[kind]++
      }

      for (const r of refs) {
        done.add(refKey(r))
        pending.delete(refKey(r))
      }
      const rows: ChangeRow[] = unitRows.map((r) => {
        const own = outcomes[refs.findIndex((x) => refKey(x) === refKey(r))]
        const ownCopy = own?.kind === 'decided' ? own.copy : null
        return {
          mailbox: r.mailbox,
          gmailId: r.gmailId,
          messageKey: lead?.messageKey ?? message?.messageKey ?? (own && own.kind !== 'decided' ? own.messageKey : null),
          transition,
          moveKind: nextState ? moveKindOf(old, nextState) : null,
          oldStatus: message?.status === 'filed' || isQueued(message?.status) ? String(message?.status) : String(reviewByRef.get(refKey(r))?.status ?? old.status),
          newStatus: nextState?.status ?? (next === 'gone' ? 'gone' : 'error'),
          oldDealId: old.dealId,
          newDealId: nextState?.dealId ?? null,
          oldDeal: deps.dealAddress(old.dealId),
          newDeal: deps.dealAddress(nextState?.dealId ?? null),
          oldCycleId: old.cycleId,
          newCycleId: nextState?.cycleId ?? null,
          protection,
          subject: lead?.subject ?? ownCopy?.subject ?? message?.subject ?? null,
          reasons: (lead ?? ownCopy)?.reasons ?? (own && own.kind !== 'decided' ? [own.error] : []),
          internalAt: ownCopy?.internalAt ?? reviewByRef.get(refKey(r))?.internalAt ?? null,
          documents: offPreview ? { archive: offPreview.archive, keep: offPreview.keep, offersLeft: offPreview.offersLeft.length } : null,
          note,
        } satisfies ChangeRow
      })
      record(rows, transition, protection)
    })
  }

  /** Apply one message's transition through the live path; returns what actually happened. */
  async function applyUnit(input: {
    message: MessageRow | null
    lead: DecidedCopy
    old: LedgerState
    planned: Transition
    outcomes: readonly CopyOutcome[]
    refs: readonly CopyRef[]
    modelQueued: boolean
  }): Promise<{ transition: Transition; off: OffDealResult | null; note?: string; messageKey: string | null; next?: LedgerState }> {
    const a = applier!
    const { lead } = input
    const others = input.outcomes.flatMap((o) => (o.kind === 'decided' && refKey(o.copy) !== refKey(lead) && !done.has(refKey(o.copy)) ? [o.copy] : []))
    // Fresh read: a person may have answered the queue since the run started.
    // Ordinary mail with no index row at load and none decided now skips it
    // (its only write, the review stamp, is itself guarded against a person's row).
    const fresh = input.message
      ? await a.readMessage(input.message.messageKey)
      : isStored(lead.status)
        ? await a.readMessage(lead.messageKey)
        : null
    const freshReviews = input.refs.map((r) => reviewByRef.get(refKey(r))).filter((r): r is ReviewRow => !!r)
    const freshProtection = protectionOf(fresh, freshReviews)
    if (freshProtection) return { transition: 'protected', off: null, note: 'decided by a person during the run', messageKey: fresh?.messageKey ?? null }
    const leadReview = reviewByRef.get(refKey(input.refs[0])) ?? null
    const old = oldStateOf(fresh, leadReview)
    const planned = classifyTransition({ old, next: stateOfCopy(lead), protection: null, modelQueued: isModelQueued(fresh, freshReviews) })

    // No filing change: re-stamp the review rows; a queued row is refreshed by the live path (as the daily rematch does).
    if (planned === 'unchanged' || planned === 'relabel' || planned === 'kept_model') {
      if (planned === 'kept_model' && fresh) {
        const reason = `${fresh.status}: kept in the mail queue for a person (the model flagged it); ${current} alone says ${lead.status}`.slice(0, 400)
        for (const c of [lead, ...others]) stamps.push(stampOf(c, { status: fresh.status, dealId: null, messageKey: fresh.messageKey, reason, stage: 'model' }))
        return { transition: planned, off: null, messageKey: fresh.messageKey }
      }
      if (fresh && isQueued(fresh.status) && isQueued(lead.status)) {
        const live = await a.indexLive(lead, anchors)
        if (live.status === 'kept_manual') return { transition: 'protected', off: null, note: 'kept_manual on the live path', messageKey: live.messageKey }
        if (live.status === 'error') return liveError(lead, live)
        for (const c of others) stamps.push(stampOf(c))
        return { transition: planned, off: null, messageKey: live.messageKey }
      }
      if (fresh && fresh.status === 'filed' && lead.status === 'filed') await a.touchMessage(fresh, lead)
      for (const c of [lead, ...others]) stamps.push(stampOf(c))
      return { transition: planned, off: null, messageKey: fresh?.messageKey ?? null }
    }

    // A filing change: the live path decides and writes, then the old deal is corrected.
    const live = await a.indexLive(lead, anchors)
    if (live.status === 'kept_manual') return { transition: 'protected', off: null, note: 'kept_manual on the live path', messageKey: live.messageKey }
    if (live.status === 'error') {
      // The live path can fail after it moved the index row (a document upload
      // failing mid-filing). The row no longer names the old deal, so correct
      // the old deal now; the next run retries this copy.
      const after = await a.readMessage(live.messageKey.startsWith('gmail:') ? lead.messageKey : live.messageKey)
      let off: OffDealResult | null = null
      if (old.status === 'filed' && old.dealId && after && after.decidedBy === 'system' && (after.status !== 'filed' || after.dealId !== old.dealId)) {
        off = await a.correctOffDeal({ message: after, from: old, toAddress: deps.dealAddress(after.dealId), newStatus: after.status })
        await a.event({
          dealId: old.dealId,
          cycleId: old.cycleId,
          action: after.status === 'filed' ? 'mail_moved' : 'mail_unfiled',
          detail: {
            title: after.subject ?? lead.subject,
            message_key: after.messageKey,
            mail_message_id: after.id,
            rules_version: current,
            direction: 'out',
            to_deal_id: after.dealId,
            to_address: deps.dealAddress(after.dealId),
            now: after.status,
            note: 'the live filing stopped part way after the email left this file; the next re-decision run finishes it',
            archived_document_ids: off.archive,
            kept_documents: off.keep,
            offers_left_for_review: off.offersLeft,
          },
        })
      }
      return { ...liveError(lead, live), off }
    }
    const actualNext: LedgerState = {
      status: live.status as LedgerStatus,
      dealId: live.status === 'filed' || isQueued(live.status) ? live.dealId : null,
      cycleId: live.status === 'filed' ? live.cycleId : null,
    }
    const actual = classifyTransition({ old, next: actualNext, protection: null, modelQueued: isModelQueued(fresh, freshReviews) })
    if (actual !== input.planned) report.divergences.push({ messageKey: live.messageKey, planned: input.planned, actual })
    // The other mailbox copies: a stored decision goes through the live path too (it adds the copy to the row); the rest are stamped.
    for (const c of others) {
      if (isStored(c.status) && isStored(actualNext.status)) {
        const r = await a.indexLive(c, anchors)
        if (r.status === 'error') stamps.push(stampOf(c, { status: 'error', reason: `error: ${String(r.error).slice(0, 280)} (re-decision retries)`, rulesVersion: reviewByRef.get(refKey(c))?.rulesVersion ?? current }))
      } else stamps.push(stampOf(c))
    }

    let off: OffDealResult | null = null
    const leavesDeal = old.status === 'filed' && !!old.dealId && (actualNext.status !== 'filed' || actualNext.dealId !== old.dealId)
    const base = fresh ?? (await a.readMessage(live.messageKey))
    const toAddress = actualNext.status === 'filed' ? deps.dealAddress(actualNext.dealId) : null
    const common = {
      title: base?.subject ?? lead.subject,
      message_key: live.messageKey,
      mail_message_id: base?.id ?? null,
      sent_at: lead.internalAt,
      rules_version: current,
      previous_rules_version: fresh?.rulesVersion ?? leadReview?.rulesVersion ?? null,
      reasons: lead.reasons.slice(0, 12),
    }
    if (leavesDeal && base) {
      off = await a.correctOffDeal({ message: base, from: old, toAddress, newStatus: actualNext.status })
      const docs = {
        archived_document_ids: off.archive,
        kept_documents: off.keep,
        offers_left_for_review: off.offersLeft,
      }
      if (actual === 'move') {
        await a.event({
          dealId: old.dealId!,
          cycleId: old.cycleId,
          action: 'mail_moved',
          detail: { ...common, direction: 'out', to_deal_id: actualNext.dealId, to_address: toAddress, to_cycle_id: actualNext.cycleId, ...docs },
        })
      } else {
        await a.event({
          dealId: old.dealId!,
          cycleId: old.cycleId,
          action: 'mail_unfiled',
          detail: { ...common, now: actualNext.status, ...docs },
        })
      }
    }
    if (actualNext.status === 'filed' && actualNext.dealId && actualNext.cycleId) {
      const on = await a.settleOnDeal({ messageKey: live.messageKey, messageId: base?.id ?? '', dealId: actualNext.dealId, cycleId: actualNext.cycleId })
      report.documents.restored += on.restored.length
      report.documents.moved += on.moved.length
      report.documents.duplicatesArchived += on.duplicatesArchived.length
      const docs = { restored_document_ids: on.restored, moved_document_ids: on.moved, duplicate_archived_ids: on.duplicatesArchived, kept_documents: on.kept }
      if (actual === 'move' && old.dealId && old.dealId !== actualNext.dealId) {
        await a.event({
          dealId: actualNext.dealId,
          cycleId: actualNext.cycleId,
          action: 'mail_moved',
          detail: { ...common, direction: 'in', from_deal_id: old.dealId, from_address: deps.dealAddress(old.dealId), from_cycle_id: old.cycleId, ...docs },
        })
      } else if (actual === 'move') {
        await a.event({
          dealId: actualNext.dealId,
          cycleId: actualNext.cycleId,
          action: 'mail_moved',
          detail: { ...common, direction: 'cycle', from_cycle_id: old.cycleId, to_cycle_id: actualNext.cycleId, ...docs },
        })
      } else if (on.restored.length || on.moved.length || on.duplicatesArchived.length) {
        await a.event({ dealId: actualNext.dealId, cycleId: actualNext.cycleId, action: 'mail_refiled', detail: { ...common, ...docs } })
      }
    }
    if (!isStored(actualNext.status) && base && isStored(base.status) && base.decidedBy === 'system') {
      await a.dismissMessage(base, { copy: lead, transition: actual, previous: old })
      const was = old.status === 'filed' ? ` (was filed on ${deps.dealAddress(old.dealId) ?? 'a deal'}; taken off by the mail re-decision)` : ' (was in the mail queue; taken off by the mail re-decision)'
      stamps.push(stampOf(lead, { reason: `${lead.reviewReason}${was}`.slice(0, 400) }))
    }
    return { transition: actual, off, messageKey: live.messageKey, next: actualNext }
  }

  function liveError(lead: DecidedCopy, live: LiveOutcome): { transition: Transition; off: OffDealResult | null; note: string; messageKey: string } {
    // The live path stamped the review row 'error' under the new version: put
    // the old version back so the next run selects it again.
    const prev = reviewByRef.get(refKey(lead))
    stamps.push(
      stampOf(lead, { status: 'error', dealId: null, messageKey: null, reason: `error: ${String(live.error ?? 'unknown').slice(0, 280)} (re-decision retries)`, rulesVersion: prev?.rulesVersion ?? 'redecide-retry' }),
    )
    if (report.errors.length < 200) report.errors.push({ mailbox: lead.mailbox, gmailId: lead.gmailId, error: String(live.error) })
    return { transition: 'error', off: null, note: 'live path error', messageKey: live.messageKey }
  }

  if (applier) await applier.lock.acquire()
  try {
    for (let i = 0; i < todo.length; i += batchSize) {
      if (late()) {
        report.complete = false
        break
      }
      const batch = todo.slice(i, i + batchSize)
      const queue = threadGroups(batch, store)
      let next = 0
      const worker = async () => {
        while (next < queue.length) {
          const g = queue[next++]
          for (const r of g) {
            if (late()) {
              report.complete = false
              return
            }
            if (!done.has(refKey(r))) await processRow(r)
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker))
      if (applier) {
        await flushStamps()
        await applier.lock.heartbeat({ processed: report.processedRows })
      }
      opts.onBatch?.({ processedRows: report.processedRows, selectedRows: todo.length, elapsedMs: Date.now() - t0, byTransition: { ...byTransitionRows } })
    }

    // Messages held back until their thread settled, oldest first. A sibling
    // still waiting on something outside this run (past a limit or a deadline)
    // leaves the message for the next run rather than deciding it early.
    let sinceBeat = 0
    for (const row of deferred) {
      if (late()) {
        report.complete = false
        break
      }
      if (done.has(refKey(row))) continue
      const m = store.byCopy(row) ?? store.get(row.messageKey)
      const blocked =
        !!m &&
        store
          .filedSiblings(m.messageKey, m.threadKey, m.gmailThreadIds)
          .some((s) => !anchorEligible(s, current, pending) && !deferredKeys.has(s.messageKey))
      if (blocked) {
        report.leftForNextRun++
        report.complete = false
        continue
      }
      await processRow(row, true)
      if (applier && ++sinceBeat >= 50) {
        sinceBeat = 0
        await flushStamps()
        await applier.lock.heartbeat({ processed: report.processedRows })
      }
    }
    if (deferred.length) opts.onBatch?.({ processedRows: report.processedRows, selectedRows: todo.length, elapsedMs: Date.now() - t0, byTransition: { ...byTransitionRows } })
    if (todo.length < candidates.length) report.complete = false
  } finally {
    if (applier) {
      try {
        await flushStamps()
      } finally {
        await applier.lock.release()
      }
    }
  }

  const sorted = [...decideMs].sort((x, y) => x - y)
  const total = decideMs.reduce((s, x) => s + x, 0)
  report.decide = {
    count: decideMs.length,
    totalMs: total,
    meanMs: decideMs.length ? Math.round(total / decideMs.length) : 0,
    p50Ms: percentile(sorted, 50),
    p90Ms: percentile(sorted, 90),
    maxMs: sorted.at(-1) ?? 0,
  }
  report.gmail = deps.gmailStats?.() ?? null
  report.finishedAt = new Date().toISOString()
  report.elapsedMs = Date.now() - t0
  return report
}

/**
 * Split a batch into groups that must run in order: rows of one Gmail thread,
 * of one RFC thread (a reply anchors on its opener, across mailboxes when the
 * index knows the thread), and copies of one message. Groups run in parallel;
 * each keeps the batch's oldest-first order.
 */
export function threadGroups(batch: readonly ReviewRow[], store: MessageStore): ReviewRow[][] {
  const parent = new Map<string, string>()
  const find = (x: string): string => {
    let root = x
    while (parent.get(root) !== root) root = parent.get(root)!
    let cur = x
    while (parent.get(cur) !== root) {
      const next = parent.get(cur)!
      parent.set(cur, root)
      cur = next
    }
    return root
  }
  const add = (x: string) => {
    if (!parent.has(x)) parent.set(x, x)
  }
  const union = (a: string, b: string) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(rb, ra)
  }
  const first = new Map<ReviewRow, string>()
  for (const r of batch) {
    const keys = [`g:${r.mailbox}|${r.threadId ?? r.gmailId}`]
    const m = store.byCopy(r) ?? store.get(r.messageKey)
    if (m?.threadKey) keys.push(`k:${m.threadKey}`)
    if (m) keys.push(`m:${m.messageKey}`)
    for (const k of keys) add(k)
    for (const k of keys.slice(1)) union(keys[0], k)
    first.set(r, keys[0])
  }
  const groups = new Map<string, ReviewRow[]>()
  for (const r of batch) {
    const root = find(first.get(r)!)
    const g = groups.get(root) ?? []
    g.push(r)
    groups.set(root, g)
  }
  return [...groups.values()]
}

/** Dry run: play a message's new outcome into the in-memory index, as apply would leave the database. */
function simulate(input: {
  store: MessageStore
  message: MessageRow | null
  lead: DecidedCopy | null
  transition: Transition
  current: string
  unitRefs: readonly CopyRef[]
}): void {
  const { store, message, lead, transition, current } = input
  if (!lead || transition === 'protected' || transition === 'gone' || transition === 'error' || transition === 'kept_model') return
  if (transition === 'unfile' || transition === 'dequeue') {
    if (message) store.put({ ...message, status: 'dismissed', dealId: null, cycleId: null, rulesVersion: current })
    return
  }
  if (!isStored(lead.status)) return
  store.put({
    id: message?.id ?? `dry-run:${lead.messageKey}`,
    messageKey: lead.messageKey,
    status: lead.status,
    decidedBy: 'system',
    dealId: lead.dealId,
    cycleId: lead.status === 'filed' ? lead.cycleId : null,
    rulesVersion: current,
    gmailRefs: uniqRefs([...(message?.gmailRefs ?? []), ...input.unitRefs.filter((r) => refKey(r) === refKey(lead))]),
    threadKey: message?.threadKey ?? lead.threadKey,
    gmailThreadIds: [...new Set([...(message?.gmailThreadIds ?? []), ...(lead.threadId ? [lead.threadId] : [])])],
    sentAt: message?.sentAt ?? lead.internalAt,
    matchMethod: lead.method,
    reasons: lead.reasons,
    subject: message?.subject ?? lead.subject,
  })
}

// ── production wiring ─────────────────────────────────────────────────────

type SB = SupabaseClient

async function pageAll<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await q(from, from + 999)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return out
}

type RawMessage = {
  id: string
  message_key: string
  status: string
  decided_by: string
  deal_id: string | null
  cycle_id: string | null
  rules_version: string
  gmail_refs: Array<{ mailbox?: string; gmail_id?: string }> | null
  thread_key: string | null
  gmail_thread_ids: string[] | null
  sent_at: string | null
  match_method: string | null
  reasons?: unknown
  match_detail?: { reasons?: unknown } | null
  subject: string | null
}

const MESSAGE_COLUMNS = 'id, message_key, status, decided_by, deal_id, cycle_id, rules_version, gmail_refs, thread_key, gmail_thread_ids, sent_at, match_method, subject'

function toMessageRow(r: RawMessage): MessageRow {
  const reasons = (Array.isArray(r.reasons) ? r.reasons : Array.isArray(r.match_detail?.reasons) ? r.match_detail?.reasons : []) as unknown[]
  return {
    id: String(r.id),
    messageKey: String(r.message_key),
    status: String(r.status),
    decidedBy: String(r.decided_by ?? 'system'),
    dealId: r.deal_id ?? null,
    cycleId: r.cycle_id ?? null,
    rulesVersion: String(r.rules_version ?? ''),
    gmailRefs: (r.gmail_refs ?? []).filter((g) => g.mailbox && g.gmail_id).map((g) => ({ mailbox: String(g.mailbox), gmailId: String(g.gmail_id) })),
    threadKey: r.thread_key ?? null,
    gmailThreadIds: r.gmail_thread_ids ?? [],
    sentAt: r.sent_at ?? null,
    matchMethod: r.match_method ?? null,
    reasons: reasons.map(String),
    subject: r.subject ?? null,
  }
}

function toDecidedCopy(ref: CopyRef, r: IndexResult, threadKey: string | null, universe: MailUniverse): DecidedCopy {
  const d = r.decision!
  return {
    mailbox: ref.mailbox,
    gmailId: ref.gmailId,
    messageKey: r.messageKey,
    status: d.status,
    dealId: d.dealId,
    cycleId: d.cycleId,
    method: d.method,
    score: d.score ?? null,
    category: d.category,
    reasons: d.reasons,
    candidates: d.candidates,
    subject: r.subject,
    threadId: r.threadId ?? null,
    threadKey,
    internalAt: r.internalAt ?? null,
    reviewReason: reviewReasonFor({ status: d.status, decision: d, deals: universe.deals }),
    reviewStage: reviewStageFor(d, null),
  }
}

export type ProductionDeps = RedecideDeps & { universe: MailUniverse }

/**
 * The real database, the real mailboxes (read-only Gmail scope), the real
 * decision. Without `apply` every database handle refuses writes and no
 * applier exists.
 */
export async function createProductionRedecideDeps(input: { apply: boolean; sb?: SB }): Promise<ProductionDeps> {
  const base = input.sb ?? createServiceClient()
  const sb = input.apply ? base : readOnlyClient(base)
  const universe = await loadMailUniverse(sb)
  const addressOf = new Map(universe.deals.map((d) => [d.dealId, d.address]))
  const cyclesOf = new Map(universe.deals.map((d) => [d.dealId, d.cycles.map((c) => c.id)]))
  const dealOfCycle = new Map(universe.deals.flatMap((d) => d.cycles.map((c) => [c.id, d.dealId] as [string, string])))
  const stats = newGmailStats()
  const gmailByMailbox = new Map<string, gmail_v1.Gmail | null>()
  const gmailFor = (mailbox: string) => {
    if (!gmailByMailbox.has(mailbox)) {
      const real = getGmailFor(mailbox, READONLY_SCOPE)
      gmailByMailbox.set(mailbox, real ? gmailWithRetry(real, stats) : null)
    }
    return gmailByMailbox.get(mailbox) ?? null
  }
  const slugOf = (mailbox: string) => CRM_MAILBOXES.find((m) => m.email === mailbox)?.slug ?? 'matt'

  async function run(ref: CopyRef, anchors: AnchorSource, dryRun: boolean): Promise<{ result: IndexResult; threadKey: string | null } | { fatal: string } | { unreachable: true }> {
    const gmail = gmailFor(ref.mailbox)
    if (!gmail) return { unreachable: true }
    for (let attempt = 0; ; attempt++) {
      let queries = 0
      let threadKey: string | null = null
      const view = anchorViewClient(sb, anchors, {
        readOnly: dryRun || !input.apply,
        onAnchorQuery: (q) => {
          queries++
          if (q.threadKey) threadKey = q.threadKey
        },
      })
      const result = await indexGmailMessage({ gmail, mailbox: ref.mailbox, brokerSlug: slugOf(ref.mailbox), gmailId: ref.gmailId, universe, dryRun, sb: view })
      if (result.status === 'error') {
        const msg = result.error ?? 'unknown error'
        if (msg.includes(ANCHOR_VIEW_ERROR)) return { fatal: msg }
        if (!isGoneErrorMessage(msg) && isTransientErrorMessage(msg) && attempt < 3) {
          await sleep(backoffMs(attempt + 2))
          continue
        }
        return { result, threadKey }
      }
      if (!queries && result.status !== 'kept_manual') {
        return { fatal: `${ANCHOR_VIEW_ERROR} indexGmailMessage decided ${ref.mailbox} ${ref.gmailId} without the thread-anchor query this view answers; lib/tc/mail-index.ts changed its anchor query, update lib/tc/mail-redecide.ts` }
      }
      return { result, threadKey }
    }
  }

  const deps: ProductionDeps = {
    universe,
    currentVersion: MAIL_RULES_VERSION,
    gmailStats: () => JSON.parse(JSON.stringify(stats)) as GmailStats,
    dealAddress: (id) => (id ? (addressOf.get(id) ?? id) : null),
    async loadReviews() {
      type Raw = { mailbox: string; gmail_id: string; thread_id: string | null; internal_at: string | null; status: string; stage: string; rules_version: string; deal_id: string | null; message_key: string | null }
      const rows = await pageAll<Raw>((a, b) =>
        sb
          .from('tc_mail_reviews')
          .select('mailbox, gmail_id, thread_id, internal_at, status, stage, rules_version, deal_id, message_key')
          .order('mailbox')
          .order('gmail_id')
          .range(a, b),
      )
      return rows.map((r) => ({
        mailbox: r.mailbox,
        gmailId: r.gmail_id,
        threadId: r.thread_id,
        internalAt: r.internal_at,
        status: r.status,
        stage: r.stage,
        rulesVersion: r.rules_version,
        dealId: r.deal_id,
        messageKey: r.message_key,
      }))
    },
    async loadMessages() {
      const rows = await pageAll<RawMessage>((a, b) => sb.from('tc_mail_messages').select(`${MESSAGE_COLUMNS}, reasons:match_detail->reasons`).order('id').range(a, b))
      return rows.map(toMessageRow)
    },
    async decide(ref, anchors) {
      const out = await run(ref, anchors, true)
      if ('unreachable' in out) return { kind: 'error', ref, error: `mailbox ${ref.mailbox} is not reachable`, messageKey: null }
      if ('fatal' in out) throw new Error(out.fatal)
      const r = out.result
      if (r.status === 'error' || !r.decision) {
        const msg = r.error ?? 'no decision'
        return { kind: isGoneErrorMessage(msg) ? 'gone' : 'error', ref, error: msg, messageKey: r.messageKey.startsWith('gmail:') ? null : r.messageKey }
      }
      return { kind: 'decided', copy: toDecidedCopy(ref, r, out.threadKey, universe) }
    },
    previewOffDeal: async ({ message, from }) => planOffDeal(sb, { message, from, cyclesOf }),
    previewLeftovers: async (message) => (message.id.startsWith('dry-run:') ? [] : planLeftovers(sb, message, dealOfCycle)),
  }
  if (input.apply) deps.applier = productionApplier({ sb: base, universe, cyclesOf, dealOfCycle, addressOf, run })
  return deps
}

// ── documents: what a message's filing left on a deal, and who relies on it ──

type RawDoc = {
  id: string
  cycle_id: string
  source_doc_id: string | null
  sha256: string | null
  archived: boolean
  archived_reason: string | null
  client_visible: boolean | null
  original_name: string | null
}

const DOC_COLUMNS = 'id, cycle_id, source_doc_id, sha256, archived, archived_reason, client_visible, original_name'

/** This message's documents on these cycles (created by it) plus any document its index row points at there. */
async function messageDocuments(sb: SB, messageKey: string, messageId: string | null, cycleIds: readonly string[]): Promise<RawDoc[]> {
  if (!cycleIds.length) return []
  const { data: own, error } = await sb.from('tc_documents').select(DOC_COLUMNS).in('cycle_id', [...cycleIds]).like('source_doc_id', `gmail:${messageKey}:%`)
  if (error) throw new Error(`documents: ${error.message}`)
  const out = new Map<string, RawDoc>((own ?? []).map((d) => [String(d.id), d as RawDoc]))
  if (messageId) {
    const { data: row } = await sb.from('tc_mail_messages').select('attachments').eq('id', messageId).maybeSingle()
    const ids = ((row?.attachments as Array<{ document_id?: string | null }> | null) ?? []).map((a) => a.document_id).filter((x): x is string => !!x && !out.has(x))
    if (ids.length) {
      const { data: reused } = await sb.from('tc_documents').select(DOC_COLUMNS).in('id', ids).in('cycle_id', [...cycleIds])
      for (const d of reused ?? []) out.set(String(d.id), d as RawDoc)
    }
  }
  return [...out.values()]
}

/** Who relies on each document (a person, an envelope, an offer, the checklist), and which other filings use it. */
async function documentFacts(sb: SB, docs: readonly RawDoc[], ctx: { dealId: string; messageId: string | null; messageKey: string }): Promise<MessageDocument[]> {
  const ids = docs.map((d) => d.id)
  if (!ids.length) return []
  const [events, reviews, envDocs, envs, offers, links, corrected] = await Promise.all([
    sb.from('tc_events').select('document_id, actor, action, detail').in('document_id', ids),
    sb.from('tc_principal_reviews').select('document_ids').eq('deal_id', ctx.dealId),
    sb.from('tc_envelope_documents').select('document_id').in('document_id', ids),
    sb.from('tc_envelopes').select('executed_document_id').in('executed_document_id', ids),
    sb.from('tc_offers').select('id, document_id').in('document_id', ids),
    sb.from('tc_checklist_assignments').select('document_id, item_id').in('document_id', ids),
    sb.from('tc_events').select('detail').eq('deal_id', ctx.dealId).eq('action', 'mail_misfile_corrected'),
  ])
  for (const r of [events, reviews, envDocs, envs, offers, links, corrected]) if (r.error) throw new Error(`document facts: ${r.error.message}`)
  const correctedLegacy = new Set<number>()
  for (const c of corrected.data ?? []) for (const id of ((c.detail as { legacy_event_ids?: number[] } | null)?.legacy_event_ids ?? [])) correctedLegacy.add(Number(id))

  const out: MessageDocument[] = []
  for (const d of docs) {
    const signals: string[] = []
    const mine = (events.data ?? []).filter((e) => e.document_id === d.id)
    for (const e of mine) {
      if (String(e.actor).includes('@')) signals.push(`${e.action} by ${e.actor}`)
    }
    if ((reviews.data ?? []).some((r) => ((r.document_ids as unknown[] | null) ?? []).map(String).includes(d.id))) signals.push('principal review')
    if (d.client_visible) signals.push('shared with the client')
    if ((envDocs.data ?? []).some((e) => e.document_id === d.id) || (envs.data ?? []).some((e) => e.executed_document_id === d.id)) signals.push('in a signing envelope')
    if ((offers.data ?? []).some((o) => o.document_id === d.id)) signals.push('linked to an offer')
    const readerLinked = new Set(mine.filter((e) => e.action === 'document_linked_by_reader').map((e) => String((e.detail as { item_id?: string } | null)?.item_id ?? '')))
    const handLinks = (links.data ?? []).filter((l) => l.document_id === d.id && !readerLinked.has(String(l.item_id)))
    if (handLinks.length) signals.push('on the checklist (not placed by the document reader)')

    // Other filings that use this document: another filed email on this deal, a text, or an uncorrected legacy filing.
    const other: string[] = []
    const q = sb.from('tc_mail_messages').select('id, message_key').eq('status', 'filed').eq('deal_id', ctx.dealId).filter('attachments', 'cs', JSON.stringify([{ document_id: d.id }]))
    const { data: filedHits, error: fhErr } = ctx.messageId ? await q.neq('id', ctx.messageId) : await q
    if (fhErr) throw new Error(`document filings: ${fhErr.message}`)
    for (const h of filedHits ?? []) other.push(`email ${h.message_key}`)
    const { data: evHits, error: evErr } = await sb
      .from('tc_events')
      .select('id, action, detail')
      .eq('deal_id', ctx.dealId)
      .in('action', ['mail_filed', 'sms_filed'])
      .filter('detail->documentIds', 'cs', JSON.stringify([d.id]))
    if (evErr) throw new Error(`document events: ${evErr.message}`)
    const keys: string[] = []
    for (const e of evHits ?? []) {
      if (e.action === 'sms_filed') {
        other.push('a text filed here')
        continue
      }
      const k = messageKeyFromDedupe(String((e.detail as { dedupe?: string } | null)?.dedupe ?? ''))
      if (!k || k === ctx.messageKey) continue
      keys.push(k)
      if (!correctedLegacy.has(Number(e.id))) other.push(`__legacy:${k}:${e.id}`)
    }
    // A filing whose email has an index row still uses the document while that
    // row is filed on this deal; a legacy filing with no row counts unless an
    // earlier reconcile corrected it.
    if (keys.length) {
      const { data: indexed, error: ixErr } = await sb.from('tc_mail_messages').select('message_key, status, deal_id').in('message_key', [...new Set(keys)])
      if (ixErr) throw new Error(`document filings: ${ixErr.message}`)
      const row = new Map((indexed ?? []).map((r) => [String(r.message_key), r]))
      for (let i = other.length - 1; i >= 0; i--) {
        const m = other[i].match(/^__legacy:(.+):(\d+)$/)
        if (!m) continue
        const r = row.get(m[1])
        if (!r) other[i] = `an earlier filing (event ${m[2]})`
        else if (r.status === 'filed' && r.deal_id === ctx.dealId) other[i] = `email ${m[1]}`
        else other.splice(i, 1)
      }
      for (const k of keys) {
        const r = row.get(k)
        if (r && r.status === 'filed' && r.deal_id === ctx.dealId && !other.includes(`email ${k}`)) other.push(`email ${k}`)
      }
    }
    out.push({
      id: d.id,
      cycleId: d.cycle_id,
      sourceDocId: d.source_doc_id,
      sha256: d.sha256,
      archived: !!d.archived,
      archivedReason: d.archived_reason,
      personSignals: [...new Set(signals)],
      otherFilings: [...new Set(other)],
    })
  }
  return out
}

/** Read-only: documents this index row filed on deals it no longer names, and what correcting each deal would do. */
async function planLeftovers(sb: SB, message: MessageRow, dealOfCycle: ReadonlyMap<string, string>): Promise<Array<{ dealId: string; off: OffDealResult }>> {
  const { data, error } = await sb
    .from('tc_documents')
    .select(DOC_COLUMNS)
    .like('source_doc_id', `gmail:${message.messageKey}:%`)
    .eq('classification->>mail_message_id', message.id)
    .eq('archived', false)
  if (error) throw new Error(`leftover documents: ${error.message}`)
  const keepDeal = message.status === 'filed' ? message.dealId : null
  const byDeal = new Map<string, RawDoc[]>()
  for (const d of (data ?? []) as RawDoc[]) {
    const dealId = dealOfCycle.get(d.cycle_id)
    if (!dealId || dealId === keepDeal) continue
    byDeal.set(dealId, [...(byDeal.get(dealId) ?? []), d])
  }
  const out: Array<{ dealId: string; off: OffDealResult }> = []
  for (const [dealId, docs] of byDeal) {
    const facts = await documentFacts(sb, docs, { dealId, messageId: message.id, messageKey: message.messageKey })
    const plan = planDocumentsOffDeal({ messageKey: message.messageKey, documents: facts })
    out.push({ dealId, off: { ...plan, offersLeft: await offersFrom(sb, dealId, message.id) } })
  }
  return out
}

async function offersFrom(sb: SB, dealId: string, messageId: string): Promise<OffDealResult['offersLeft']> {
  const { data, error } = await sb.from('tc_offers').select('id, status, price, buyer_agent').eq('deal_id', dealId).eq('source_message_id', messageId)
  if (error) throw new Error(`offers: ${error.message}`)
  return (data ?? []).map((o) => ({ id: String(o.id), status: String(o.status), price: o.price == null ? null : Number(o.price), buyerAgent: (o.buyer_agent as string | null) ?? null }))
}

/** Read-only: what taking this message off its deal would do. */
async function planOffDeal(sb: SB, input: { message: MessageRow; from: LedgerState; cyclesOf: ReadonlyMap<string, string[]> }): Promise<OffDealResult> {
  const dealId = input.from.dealId!
  const docs = await messageDocuments(sb, input.message.messageKey, input.message.id, input.cyclesOf.get(dealId) ?? (input.from.cycleId ? [input.from.cycleId] : []))
  const facts = await documentFacts(sb, docs, { dealId, messageId: input.message.id, messageKey: input.message.messageKey })
  const plan = planDocumentsOffDeal({ messageKey: input.message.messageKey, documents: facts })
  return { ...plan, offersLeft: await offersFrom(sb, dealId, input.message.id) }
}

function productionApplier(input: {
  sb: SB
  universe: MailUniverse
  cyclesOf: ReadonlyMap<string, string[]>
  dealOfCycle: ReadonlyMap<string, string>
  addressOf: ReadonlyMap<string, string>
  run: (ref: CopyRef, anchors: AnchorSource, dryRun: boolean) => Promise<{ result: IndexResult; threadKey: string | null } | { fatal: string } | { unreachable: true }>
}): RedecideApplier {
  const { sb, cyclesOf } = input
  let token: string | null = null
  const now = () => new Date().toISOString()

  /** Archive with a reason, drop the (reader-made) checklist rows, and write a document_archived event per document. */
  async function archiveDocuments(ids: readonly string[], ctx: { dealId: string; reason: string; message: MessageRow }): Promise<void> {
    if (!ids.length) return
    const { data: archived, error } = await sb
      .from('tc_documents')
      .update({ archived: true, archived_at: now(), archived_reason: ctx.reason })
      .in('id', [...ids])
      .eq('archived', false)
      .select('id, cycle_id, name')
    if (error) throw new Error(`archive: ${error.message}`)
    // Only reader-made checklist rows remain on these (a hand-placed one keeps the document).
    const { data: links } = await sb.from('tc_checklist_assignments').select('document_id, item_id').in('document_id', [...ids])
    const { error: aErr } = await sb.from('tc_checklist_assignments').delete().in('document_id', [...ids])
    if (aErr) throw new Error(`checklist rows: ${aErr.message}`)
    // Each document's own history says what happened to it, as the reader's archives do.
    if (!archived?.length) return
    const { error: evErr } = await sb.from('tc_events').insert(
      archived.map((d) =>
        withoutNul({
          deal_id: ctx.dealId,
          cycle_id: d.cycle_id,
          document_id: d.id,
          actor: REDECIDE_ACTOR,
          action: 'document_archived',
          detail: {
            name: d.name,
            reason: ctx.reason,
            message_key: ctx.message.messageKey,
            mail_message_id: ctx.message.id,
            rules_version: MAIL_RULES_VERSION,
            unlinked_items: (links ?? []).filter((l) => l.document_id === d.id).map((l) => l.item_id),
          },
        }),
      ),
    )
    if (evErr) throw new Error(`document events: ${evErr.message}`)
  }

  return {
    lock: {
      async acquire() {
        const mine = randomUUID()
        const row = { mailbox: REDECIDE_LOCK_KEY, page_token: mine, listed: 0, reviewed: 0, started_at: now(), updated_at: now(), finished_at: null }
        let ins = await sb.from('tc_mail_review_cursors').insert(row)
        if (ins.error && /duplicate|unique/i.test(ins.error.message)) {
          const { data: held } = await sb.from('tc_mail_review_cursors').select('page_token, started_at, updated_at').eq('mailbox', REDECIDE_LOCK_KEY).maybeSingle()
          if (held && Date.now() - Date.parse(String(held.updated_at)) < LOCK_STALE_MS) {
            throw new Error(`another mail re-decision run holds the lock (started ${held.started_at}, last heartbeat ${held.updated_at})`)
          }
          // Stale (no heartbeat for 20 minutes): take it over, compare-and-delete on the old owner.
          if (held) await sb.from('tc_mail_review_cursors').delete().eq('mailbox', REDECIDE_LOCK_KEY).eq('page_token', held.page_token)
          ins = await sb.from('tc_mail_review_cursors').insert(row)
        }
        if (ins.error) throw new Error(`mail re-decision lock: ${ins.error.message}`)
        token = mine
      },
      async heartbeat(progress) {
        if (!token) throw new Error('mail re-decision lock: not held')
        const { data, error } = await sb
          .from('tc_mail_review_cursors')
          .update({ updated_at: now(), reviewed: progress.processed })
          .eq('mailbox', REDECIDE_LOCK_KEY)
          .eq('page_token', token)
          .select('mailbox')
        if (error) throw new Error(`mail re-decision lock: ${error.message}`)
        if (!data?.length) throw new Error('mail re-decision lock: lost (another run took it over); stopping')
      },
      async release() {
        if (!token) return
        await sb.from('tc_mail_review_cursors').delete().eq('mailbox', REDECIDE_LOCK_KEY).eq('page_token', token)
        token = null
      },
    },

    async readMessage(messageKey) {
      const { data, error } = await sb.from('tc_mail_messages').select(`${MESSAGE_COLUMNS}, match_detail`).eq('message_key', messageKey).maybeSingle()
      if (error) throw new Error(`read message: ${error.message}`)
      return data ? toMessageRow(data as RawMessage) : null
    },

    async indexLive(ref, anchors) {
      const out = await input.run(ref, anchors, false)
      if ('unreachable' in out) return { status: 'error', dealId: null, cycleId: null, messageKey: `gmail:${ref.gmailId}`, error: 'mailbox not reachable' }
      if ('fatal' in out) throw new Error(out.fatal)
      const r = out.result
      return { status: r.status, dealId: r.dealId ?? r.decision?.dealId ?? null, cycleId: r.decision?.cycleId ?? null, messageKey: r.messageKey, error: r.error }
    },

    async stampReviews(rows) {
      let written = 0
      let skippedProtected = 0
      const byMailbox = new Map<string, StampRow[]>()
      for (const r of rows) byMailbox.set(r.mailbox, [...(byMailbox.get(r.mailbox) ?? []), r])
      for (const [mailbox, list] of byMailbox) {
        for (let i = 0; i < list.length; i += 400) {
          const chunk = list.slice(i, i + 400)
          const { data: freshRows, error } = await sb
            .from('tc_mail_reviews')
            .select('gmail_id, stage, status')
            .eq('mailbox', mailbox)
            .in('gmail_id', chunk.map((r) => r.gmailId))
          if (error) throw new Error(`stamp read: ${error.message}`)
          const guarded = new Set((freshRows ?? []).filter((r) => r.stage === 'person' || r.status === 'kept_manual' || r.status === 'dismissed').map((r) => String(r.gmail_id)))
          const write = chunk.filter((r) => !guarded.has(r.gmailId))
          skippedProtected += chunk.length - write.length
          if (!write.length) continue
          const { error: upErr } = await sb.from('tc_mail_reviews').upsert(
            write.map((r) =>
              withoutNul({
                mailbox: r.mailbox,
                gmail_id: r.gmailId,
                thread_id: r.threadId,
                internal_at: r.internalAt,
                status: r.status,
                deal_id: r.dealId,
                message_key: r.messageKey,
                reason: r.reason.slice(0, 400),
                stage: r.stage,
                rules_version: r.rulesVersion,
                reviewed_at: now(),
              }),
            ),
            { onConflict: 'mailbox,gmail_id' },
          )
          if (upErr) throw new Error(`stamp: ${upErr.message}`)
          written += write.length
        }
      }
      return { written, skippedProtected }
    },

    async touchMessage(message, copy) {
      const { data } = await sb.from('tc_mail_messages').select('match_detail').eq('id', message.id).maybeSingle()
      const detail = { ...((data?.match_detail as Record<string, unknown> | null) ?? {}), reasons: copy.reasons, candidates: copy.candidates }
      const { error } = await sb
        .from('tc_mail_messages')
        .update(withoutNul({ rules_version: MAIL_RULES_VERSION, match_method: copy.method, match_score: copy.score, match_detail: detail, updated_at: now() }))
        .eq('id', message.id)
        .eq('decided_by', 'system')
      if (error) throw new Error(`touch message: ${error.message}`)
    },

    async dismissMessage(message, info) {
      const { data } = await sb.from('tc_mail_messages').select('match_detail').eq('id', message.id).maybeSingle()
      const old = (data?.match_detail as Record<string, unknown> | null) ?? {}
      const detail = {
        ...old,
        reasons: info.copy.reasons,
        candidates: info.copy.candidates,
        redecided: {
          at: now(),
          rules_version: MAIL_RULES_VERSION,
          transition: info.transition,
          now: info.copy.status,
          previous: { status: message.status, deal_id: info.previous.dealId, cycle_id: info.previous.cycleId, rules_version: message.rulesVersion, reasons: old.reasons ?? null },
        },
      }
      const { error } = await sb
        .from('tc_mail_messages')
        .update(
          withoutNul({
            status: 'dismissed',
            deal_id: null,
            cycle_id: null,
            match_method: info.copy.method,
            match_score: info.copy.score,
            match_detail: detail,
            rules_version: MAIL_RULES_VERSION,
            decided_at: now(),
            updated_at: now(),
          }),
        )
        .eq('id', message.id)
        .eq('decided_by', 'system')
      if (error) throw new Error(`dismiss message: ${error.message}`)
    },

    async correctOffDeal({ message, from, toAddress, newStatus }) {
      const plan = await planOffDeal(sb, { message, from, cyclesOf })
      const reason = redecideArchiveReason({ fromAddress: input.addressOf.get(from.dealId!) ?? 'this file', toAddress, newStatus, rulesVersion: MAIL_RULES_VERSION })
      await archiveDocuments(plan.archive, { dealId: from.dealId!, reason, message })
      return plan
    },

    async correctLeftovers(message) {
      const left = await planLeftovers(sb, message, input.dealOfCycle)
      const toAddress = message.status === 'filed' ? (input.addressOf.get(message.dealId ?? '') ?? null) : null
      for (const l of left) {
        const reason = redecideArchiveReason({ fromAddress: input.addressOf.get(l.dealId) ?? 'this file', toAddress, newStatus: message.status === 'dismissed' ? 'not_deal' : message.status, rulesVersion: MAIL_RULES_VERSION })
        await archiveDocuments(l.off.archive, { dealId: l.dealId, reason, message })
      }
      return left
    },

    async settleOnDeal({ messageKey, messageId, dealId, cycleId }) {
      const res: OnDealResult = { restored: [], moved: [], duplicatesArchived: [], kept: [] }
      const docs = await messageDocuments(sb, messageKey, null, cyclesOf.get(dealId) ?? [cycleId])
      if (!docs.length) return res
      const facts = await documentFacts(sb, docs, { dealId, messageId: messageId || null, messageKey })
      const hashes = [...new Set(docs.map((d) => d.sha256).filter((h): h is string => !!h))]
      const targetHashes = new Map<string, string>()
      if (hashes.length) {
        const { data } = await sb.from('tc_documents').select('id, sha256').eq('cycle_id', cycleId).eq('archived', false).in('sha256', hashes)
        for (const d of data ?? []) if (d.sha256) targetHashes.set(String(d.sha256), String(d.id))
      }
      const plan = planDocumentsOnDeal({ messageKey, targetCycleId: cycleId, documents: facts, targetCycleHashes: targetHashes })
      res.kept = plan.keep
      if (plan.restore.length) {
        const { error } = await sb
          .from('tc_documents')
          .update({ archived: false, archived_at: null, archived_reason: null })
          .in('id', plan.restore)
          .like('archived_reason', `${REDECIDE_ARCHIVE_PREFIX}%`)
        if (error) throw new Error(`restore: ${error.message}`)
        res.restored = plan.restore
      }
      for (const m of plan.move) {
        const patch: Record<string, unknown> = { cycle_id: m.toCycleId }
        if (m.restore) Object.assign(patch, { archived: false, archived_at: null, archived_reason: null })
        const { error } = await sb.from('tc_documents').update(patch).eq('id', m.id)
        if (error) throw new Error(`move document: ${error.message}`)
        // Its checklist rows belong to the old cycle's items; the reader places it again on the new cycle.
        await sb.from('tc_checklist_assignments').delete().eq('document_id', m.id)
        res.moved.push(m.id)
      }
      for (const dup of plan.archiveDuplicate) {
        const { error } = await sb
          .from('tc_documents')
          .update({ archived: true, archived_at: now(), archived_reason: `${REDECIDE_ARCHIVE_PREFIX} the same file is already on this deal's cycle (${dup.duplicateOf}).` })
          .eq('id', dup.id)
          .eq('archived', false)
        if (error) throw new Error(`archive duplicate: ${error.message}`)
        await sb.from('tc_checklist_assignments').delete().eq('document_id', dup.id)
        res.duplicatesArchived.push(dup.id)
      }
      const changed = [
        ...res.restored.map((id) => ({ id, action: 'document_unarchived', note: 'the rules file its email here again' })),
        ...plan.move.map((m) => ({ id: m.id, action: m.restore ? 'document_unarchived' : 'document_moved', note: `moved to this deal's cycle ${m.toCycleId} with its email` })),
        ...plan.archiveDuplicate.map((d) => ({ id: d.id, action: 'document_archived', note: `the same file is already on cycle ${cycleId} (${d.duplicateOf})` })),
      ]
      if (changed.length) {
        const cycleOfDoc = new Map(docs.map((d) => [d.id, d.cycle_id]))
        const { error: evErr } = await sb.from('tc_events').insert(
          changed.map((c) =>
            withoutNul({
              deal_id: dealId,
              cycle_id: c.action === 'document_archived' ? cycleOfDoc.get(c.id) : cycleId,
              document_id: c.id,
              actor: REDECIDE_ACTOR,
              action: c.action,
              detail: { reason: `${REDECIDE_ARCHIVE_PREFIX} ${c.note}`, message_key: messageKey, mail_message_id: messageId || null, rules_version: MAIL_RULES_VERSION },
            }),
          ),
        )
        if (evErr) throw new Error(`document events: ${evErr.message}`)
      }
      // The index row's attachment list points at the documents where they now are.
      if (messageId && (res.moved.length || res.duplicatesArchived.length || res.restored.length)) {
        const byName = new Map(docs.map((d) => [String(d.original_name ?? ''), d.id]))
        const twin = new Map(plan.archiveDuplicate.map((d) => [d.id, d.duplicateOf]))
        const { data: row } = await sb.from('tc_mail_messages').select('attachments').eq('id', messageId).maybeSingle()
        const atts = ((row?.attachments as Array<Record<string, unknown>> | null) ?? []).map((a) => {
          const id = (a.document_id as string | null) ?? byName.get(String(a.name ?? '')) ?? null
          return { ...a, document_id: id ? (twin.get(id) ?? id) : null }
        })
        await sb.from('tc_mail_messages').update({ attachments: atts }).eq('id', messageId)
      }
      return res
    },

    async event(e) {
      const { error } = await sb.from('tc_events').insert(withoutNul({ deal_id: e.dealId, cycle_id: e.cycleId, actor: REDECIDE_ACTOR, action: e.action, detail: e.detail }))
      if (error) throw new Error(`event: ${error.message}`)
    },
  }
}
