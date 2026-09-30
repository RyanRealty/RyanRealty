import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { gmail_v1 } from 'googleapis'
import type { MailStatus } from './mail-rules'
import { planDocumentsOffDeal, planDocumentsOnDeal, redecideArchiveReason, REDECIDE_ARCHIVE_PREFIX } from './mail-reconcile'
import {
  ANCHOR_VIEW_ERROR,
  REDECIDE_ACTOR,
  REDECIDE_LOCK_KEY,
  createProductionRedecideDeps,
  MessageStore,
  anchorEligible,
  anchorViewClient,
  backoffMs,
  classifyTransition,
  combineCopies,
  gmailWithRetry,
  isGoneErrorMessage,
  isTransientGmailError,
  newGmailStats,
  oldStateOf,
  protectionOf,
  refKey,
  runRedecide,
  selectCandidates,
  type AnchorSource,
  type CopyOutcome,
  type CopyRef,
  type DecidedCopy,
  type LedgerState,
  type MessageRow,
  type RedecideApplier,
  type RedecideDeps,
  type RedecideEvent,
  type ReviewRow,
} from './mail-redecide'

// ── pure rules ────────────────────────────────────────────────────────────

const S = (status: LedgerState['status'], dealId: string | null = null, cycleId: string | null = null): LedgerState => ({ status, dealId, cycleId })

describe('classifyTransition', () => {
  it('names every change from what the Vault holds to what the rules say now', () => {
    const cases: Array<[LedgerState, LedgerState, string]> = [
      [S('filed', 'A', 'a1'), S('filed', 'A', 'a1'), 'unchanged'],
      [S('filed', 'A', 'a1'), S('filed', 'B', 'b1'), 'move'],
      [S('filed', 'A', 'a1'), S('filed', 'A', 'a2'), 'move'],
      [S('filed', 'A', 'a1'), S('not_deal'), 'unfile'],
      [S('filed', 'A', 'a1'), S('bulk'), 'unfile'],
      [S('filed', 'A', 'a1'), S('ambiguous'), 'requeue'],
      [S('filed', 'A', 'a1'), S('unfiled_transaction'), 'requeue'],
      [S('bulk'), S('filed', 'B', 'b1'), 'file'],
      [S('not_deal'), S('filed', 'B', 'b1'), 'file'],
      [S('ambiguous'), S('filed', 'B', 'b1'), 'file'],
      [S('not_deal'), S('unfiled_transaction'), 'queue'],
      [S('bulk'), S('ambiguous'), 'queue'],
      [S('unfiled_transaction'), S('not_deal'), 'dequeue'],
      [S('ambiguous'), S('ambiguous'), 'unchanged'],
      [S('ambiguous'), S('unfiled_transaction'), 'relabel'],
      [S('not_deal'), S('bulk'), 'relabel'],
      [S('error'), S('not_deal'), 'relabel'],
      [S('not_deal'), S('not_deal'), 'unchanged'],
      [S('bulk'), S('bulk'), 'unchanged'],
    ]
    for (const [old, next, want] of cases) expect(classifyTransition({ old, next, protection: null }), `${old.status}→${next.status}`).toBe(want)
  })

  it('never re-decides a protected message, whatever the rules say', () => {
    for (const next of [S('not_deal'), S('filed', 'B', 'b1'), 'gone' as const, 'error' as const]) {
      expect(classifyTransition({ old: S('filed', 'A', 'a1'), next, protection: 'person' })).toBe('protected')
    }
  })

  it('keeps a model-queued message for a person unless the rules now file it', () => {
    expect(classifyTransition({ old: S('unfiled_transaction'), next: S('not_deal'), protection: null, modelQueued: true })).toBe('kept_model')
    expect(classifyTransition({ old: S('ambiguous'), next: S('ambiguous'), protection: null, modelQueued: true })).toBe('kept_model')
    expect(classifyTransition({ old: S('ambiguous'), next: S('filed', 'A', 'a1'), protection: null, modelQueued: true })).toBe('file')
  })

  it('leaves mail gone from every mailbox, and errors, for later', () => {
    expect(classifyTransition({ old: S('filed', 'A', 'a1'), next: 'gone', protection: null })).toBe('gone')
    expect(classifyTransition({ old: S('filed', 'A', 'a1'), next: 'error', protection: null })).toBe('error')
  })
})

describe('protectionOf (a broker’s decision wins)', () => {
  it('protects a person’s filing or dismissal, a queue answer, kept_manual, the model and the auto-open sweep', () => {
    expect(protectionOf({ decidedBy: 'paul@ryan-realty.com' }, [])).toBe('person')
    expect(protectionOf(null, [{ stage: 'person', status: 'filed' }])).toBe('person')
    expect(protectionOf({ decidedBy: 'system' }, [{ stage: 'person', status: 'filed' }])).toBe('person')
    expect(protectionOf(null, [{ stage: 'rules', status: 'kept_manual' }])).toBe('kept_manual')
    expect(protectionOf(null, [{ stage: 'rules', status: 'dismissed' }])).toBe('person')
    expect(protectionOf({ decidedBy: 'model' }, [])).toBe('model')
    expect(protectionOf({ decidedBy: 'system:mail-index' }, [])).toBe('auto_open')
    expect(protectionOf({ decidedBy: 'system:tc-alias-e2e' }, [])).toBe('manual')
    expect(protectionOf({ decidedBy: 'system' }, [{ stage: 'rules', status: 'filed' }, { stage: 'thread', status: 'not_deal' }])).toBeNull()
    expect(protectionOf(null, [{ stage: 'model', status: 'not_deal' }])).toBeNull()
  })
})

const copy = (ref: CopyRef, d: { key: string; status: MailStatus; dealId?: string | null; cycleId?: string | null; method?: string | null; threadKey?: string | null }): DecidedCopy => ({
  ...ref,
  messageKey: d.key,
  status: d.status,
  dealId: d.dealId ?? null,
  cycleId: d.cycleId ?? null,
  method: d.method ?? null,
  score: null,
  category: 'general',
  reasons: [`rule says ${d.status}${d.dealId ? ` on ${d.dealId}` : ''}`],
  candidates: [],
  subject: `subject ${d.key}`,
  threadId: `gt-${d.threadKey ?? d.key}`,
  threadKey: d.threadKey ?? null,
  internalAt: null,
  reviewReason: `${d.status}: rule`,
  reviewStage: d.method === 'thread' ? 'thread' : 'rules',
})

describe('combineCopies (one message in several mailboxes)', () => {
  const m1 = { mailbox: 'matt@ryan-realty.com', gmailId: '1' }
  const m2 = { mailbox: 'paul@ryan-realty.com', gmailId: '2' }
  it('a filing copy wins over an ordinary copy, the current deal wins a tie, a failed copy blocks, a gone copy does not vote', () => {
    const filedA: CopyOutcome = { kind: 'decided', copy: copy(m1, { key: 'k', status: 'filed', dealId: 'A', cycleId: 'a1' }) }
    const filedB: CopyOutcome = { kind: 'decided', copy: copy(m2, { key: 'k', status: 'filed', dealId: 'B', cycleId: 'b1' }) }
    const plain: CopyOutcome = { kind: 'decided', copy: copy(m2, { key: 'k', status: 'not_deal' }) }
    const gone: CopyOutcome = { kind: 'gone', ref: m2, error: 'Requested entity was not found.', messageKey: null }
    const failed: CopyOutcome = { kind: 'error', ref: m2, error: 'Backend Error', messageKey: null }
    const lead = (r: ReturnType<typeof combineCopies>) => (r.kind === 'decided' ? r.lead.dealId ?? r.lead.status : r.kind)
    expect(lead(combineCopies([plain, filedA], null))).toBe('A')
    expect(lead(combineCopies([filedB, filedA], { dealId: 'A', cycleId: 'a1' }))).toBe('A')
    expect(lead(combineCopies([filedA, gone], null))).toBe('A')
    expect(lead(combineCopies([filedA, failed], null))).toBe('error')
    expect(lead(combineCopies([gone], null))).toBe('gone')
  })
})

describe('oldStateOf', () => {
  it('reads the index row first, the review row otherwise', () => {
    expect(oldStateOf({ status: 'filed', dealId: 'A', cycleId: 'a1' }, { status: 'not_deal' })).toEqual(S('filed', 'A', 'a1'))
    expect(oldStateOf({ status: 'ambiguous', dealId: null, cycleId: null }, { status: 'not_deal' })).toEqual(S('ambiguous'))
    expect(oldStateOf({ status: 'dismissed', dealId: null, cycleId: null }, { status: 'bulk' })).toEqual(S('bulk'))
    expect(oldStateOf(null, { status: 'filed' })).toEqual(S('not_deal'))
  })
})

describe('selectCandidates', () => {
  const r = (gmailId: string, over: Partial<ReviewRow> = {}): ReviewRow => ({
    mailbox: 'matt@ryan-realty.com',
    gmailId,
    threadId: null,
    internalAt: '2026-01-01T00:00:00Z',
    status: 'not_deal',
    stage: 'rules',
    rulesVersion: 'v3',
    dealId: null,
    messageKey: null,
    ...over,
  })
  it('takes rows under another rules version, filtered, oldest message first', () => {
    const rows = [
      r('new', { internalAt: '2026-03-01T00:00:00Z' }),
      r('old', { internalAt: '2025-01-01T00:00:00Z' }),
      r('done', { rulesVersion: 'v4' }),
      r('paul', { mailbox: 'paul@ryan-realty.com' }),
      r('bulk', { status: 'bulk', internalAt: '2025-06-01T00:00:00Z' }),
      r('undated', { internalAt: null }),
    ]
    expect(selectCandidates(rows, { currentVersion: 'v4' }).map((x) => x.gmailId)).toEqual(['old', 'bulk', 'paul', 'new', 'undated'])
    expect(selectCandidates(rows, { currentVersion: 'v4', mailboxes: ['paul@ryan-realty.com'] }).map((x) => x.gmailId)).toEqual(['paul'])
    expect(selectCandidates(rows, { currentVersion: 'v4', statuses: ['bulk'] }).map((x) => x.gmailId)).toEqual(['bulk'])
    expect(selectCandidates(rows, { currentVersion: 'v4', since: '2026-01-01' }).map((x) => x.gmailId)).toEqual(['paul', 'new'])
  })
})

describe('thread anchors', () => {
  const m = (key: string, over: Partial<MessageRow> = {}): MessageRow => ({
    id: `id-${key}`,
    messageKey: key,
    status: 'filed',
    decidedBy: 'system',
    dealId: 'A',
    cycleId: 'a1',
    rulesVersion: 'v3',
    gmailRefs: [{ mailbox: 'matt@ryan-realty.com', gmailId: key }],
    threadKey: 'T',
    gmailThreadIds: ['gT'],
    sentAt: '2026-01-01T00:00:00Z',
    matchMethod: 'address',
    reasons: [],
    subject: null,
    ...over,
  })
  it('a sibling this run has yet to re-decide cannot anchor; a re-decided, person-decided or out-of-scope one can', () => {
    const pending = new Set(['matt@ryan-realty.com|pending'])
    expect(anchorEligible(m('pending'), 'v4', pending)).toBe(false)
    expect(anchorEligible(m('pending', { rulesVersion: 'v4' }), 'v4', pending)).toBe(true)
    expect(anchorEligible(m('pending', { decidedBy: 'matt@ryan-realty.com' }), 'v4', pending)).toBe(true)
    expect(anchorEligible(m('outside'), 'v4', pending)).toBe(true)
  })
  it('answers the anchor query newest first, filed rows only', () => {
    const store = new MessageStore([
      m('old', { sentAt: '2026-01-01T00:00:00Z', dealId: 'A' }),
      m('new', { sentAt: '2026-02-01T00:00:00Z', dealId: 'B' }),
      m('queued', { status: 'ambiguous', sentAt: '2026-03-01T00:00:00Z' }),
    ])
    expect(store.anchorRows({ threadKey: 'T' }, () => true).map((r) => r.message_key)).toEqual(['new', 'old'])
    expect(store.anchorRows({ gmailThreadId: 'gT' }, (x) => x.messageKey !== 'new').map((r) => r.deal_id)).toEqual(['A'])
    expect(store.anchorRows({ threadKey: 'nope' }, () => true)).toEqual([])
  })
})

describe('anchorViewClient', () => {
  // A stand-in for supabase-js: records what reaches the real client.
  function realClient() {
    const seen: string[] = []
    const builder = (table: string) => ({
      select: (cols: string) => {
        seen.push(`${table}.select(${cols})`)
        const chain = {
          eq: () => chain,
          then: (res: (v: unknown) => unknown) => Promise.resolve({ data: [{ real: true }], error: null }).then(res),
        }
        return chain
      },
      update: (row: unknown) => {
        seen.push(`${table}.update`)
        return { eq: () => Promise.resolve({ data: null, error: null }), row }
      },
    })
    return { client: { from: builder, storage: {}, rpc: () => null } as unknown as SupabaseClient, seen }
  }

  it('answers the thread-anchor query from the re-decision’s view and passes everything else through', async () => {
    const { client, seen } = realClient()
    const asked: unknown[] = []
    const view = anchorViewClient(client, (q) => (asked.push(q), [{ deal_id: 'B', match_method: 'address', message_key: 'k1' }]), { readOnly: false })
    const anchor = await view.from('tc_mail_messages').select('deal_id, match_method, message_key').eq('status', 'filed').eq('thread_key', 'thr:1').order('sent_at', { ascending: false }).limit(5)
    expect(anchor.data).toEqual([{ deal_id: 'B', match_method: 'address', message_key: 'k1' }])
    expect(asked).toEqual([{ status: 'filed', threadKey: 'thr:1', limit: 5 }])
    const other = await view.from('tc_mail_messages').select('id, decided_by').eq('message_key', 'x')
    expect(other.data).toEqual([{ real: true }])
    expect(seen).toEqual(['tc_mail_messages.select(id, decided_by)'])
  })

  it('fails loudly when the anchor query changes shape, instead of falling back to unfiltered anchors', async () => {
    const { client } = realClient()
    const view = anchorViewClient(client, () => [], { readOnly: true })
    const q = view.from('tc_mail_messages').select('deal_id, match_method, message_key') as unknown as Record<string, (...a: unknown[]) => unknown>
    expect(() => q.eq('deal_id', 'x')).toThrow(ANCHOR_VIEW_ERROR)
    expect(() => (q as unknown as { gt: unknown }).gt).toThrow(ANCHOR_VIEW_ERROR)
  })

  it('a dry run cannot write: every write, RPC and storage call is refused', () => {
    const { client, seen } = realClient()
    const view = anchorViewClient(client, null, { readOnly: true })
    expect(() => view.from('tc_documents').update({ archived: true })).toThrow(/dry run refused a write/)
    expect(() => view.rpc('x')).toThrow(/dry run refused/)
    expect(() => view.storage).toThrow(/dry run refused/)
    expect(seen).toEqual([])
  })
})

describe('Gmail retry', () => {
  it('retries 429 and 5xx with backoff, never a 404, and counts every call', async () => {
    const stats = newGmailStats()
    let calls = 0
    const real = {
      users: {
        messages: {
          get: async () => {
            calls++
            if (calls === 1) throw Object.assign(new Error('Rate Limit Exceeded'), { code: 429 })
            return { data: { id: 'm' } }
          },
          attachments: { get: async () => Promise.reject(Object.assign(new Error('Requested entity was not found.'), { code: 404 })) },
          list: async () => ({ data: { messages: [] } }),
        },
      },
    } as unknown as gmail_v1.Gmail
    const g = gmailWithRetry(real, stats)
    const got = await g.users.messages.get({ userId: 'me', id: 'm', format: 'metadata' })
    expect(got.data).toEqual({ id: 'm' })
    expect(stats.calls['messages.get:metadata']).toBe(2)
    expect(stats.retries).toBe(1)
    expect(stats.rateLimited).toBe(1)
    await expect(g.users.messages.attachments.get({ userId: 'me', messageId: 'm', id: 'a' })).rejects.toThrow(/not found/)
    expect(stats.calls['attachments.get']).toBe(1)
    // Calls the wrapper does not count still reach the client.
    await expect(g.users.messages.list({ userId: 'me' })).resolves.toEqual({ data: { messages: [] } })
  }, 10_000)

  it('classifies errors', () => {
    expect(isTransientGmailError(Object.assign(new Error('x'), { code: 503 }))).toBe(true)
    expect(isTransientGmailError(Object.assign(new Error('User Rate Limit Exceeded'), { code: 403 }))).toBe(true)
    expect(isTransientGmailError(Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }))).toBe(true)
    expect(isTransientGmailError(Object.assign(new Error('Requested entity was not found.'), { code: 404 }))).toBe(false)
    expect(isTransientGmailError(Object.assign(new Error('Insufficient Permission'), { code: 403 }))).toBe(false)
    expect(isGoneErrorMessage('Requested entity was not found.')).toBe(true)
    expect(backoffMs(0, () => 0)).toBe(1000)
    expect(backoffMs(10, () => 0)).toBe(32_000)
  })
})

// ── the runner, against an in-memory Vault ────────────────────────────────

type Doc = { id: string; dealId: string; cycleId: string; sourceDocId: string; sha256: string; archived: boolean; archivedReason: string | null; personSignals: string[] }
type Rule = (ref: CopyRef, anchors: AnchorSource) => Parameters<typeof copy>[1]

const MB = 'matt@ryan-realty.com'
const CYCLE: Record<string, string> = { A: 'a1', B: 'b1' }

/**
 * A Vault in memory: review rows, index rows, documents, events. `rules` is
 * what the mail rules decide per mailbox copy (they may read thread anchors);
 * the applier plays the live path the way lib/tc/mail-index.ts does (a
 * person-decided row comes back kept_manual, filing onto a deal is once per
 * deal, the review row is written with the current version).
 */
class FakeVault {
  version = 'v4'
  reviews = new Map<string, ReviewRow>()
  messages = new Map<string, MessageRow>()
  docs = new Map<string, Doc>()
  events: RedecideEvent[] = []
  filings = new Set<string>()
  rules = new Map<string, Rule>()
  decided: string[] = []
  writes: string[] = []

  addReview(gmailId: string, over: Partial<ReviewRow> = {}) {
    this.reviews.set(refKey({ mailbox: MB, gmailId }), {
      mailbox: MB,
      gmailId,
      threadId: `gt-${gmailId}`,
      internalAt: `2026-01-${String(this.reviews.size + 1).padStart(2, '0')}T00:00:00Z`,
      status: 'not_deal',
      stage: 'rules',
      rulesVersion: 'v3',
      dealId: null,
      messageKey: null,
      ...over,
    })
  }

  addFiled(gmailId: string, key: string, dealId: string, over: Partial<MessageRow> = {}, reviewOver: Partial<ReviewRow> = {}) {
    this.addReview(gmailId, { status: 'filed', dealId, messageKey: key, ...reviewOver })
    this.messages.set(key, {
      id: `row-${key}`,
      messageKey: key,
      status: 'filed',
      decidedBy: 'system',
      dealId,
      cycleId: CYCLE[dealId],
      rulesVersion: 'v3',
      gmailRefs: [{ mailbox: MB, gmailId }],
      threadKey: null,
      gmailThreadIds: [`gt-${gmailId}`],
      sentAt: this.reviews.get(refKey({ mailbox: MB, gmailId }))!.internalAt,
      matchMethod: 'address',
      reasons: ['old rules'],
      subject: `subject ${key}`,
      ...over,
    })
    this.fileDoc(key, dealId)
  }

  fileDoc(key: string, dealId: string) {
    if (this.filings.has(`${dealId}|${key}`)) return
    this.filings.add(`${dealId}|${key}`)
    const id = `doc-${key}-${dealId}`
    this.docs.set(id, { id, dealId, cycleId: CYCLE[dealId], sourceDocId: `gmail:${key}:ATT`, sha256: `sha-${key}`, archived: false, archivedReason: null, personSignals: [] })
  }

  decide(ref: CopyRef, anchors: AnchorSource): CopyOutcome {
    const rule = this.rules.get(refKey(ref))
    if (!rule) return { kind: 'gone', ref, error: 'Requested entity was not found.', messageKey: null }
    const d = rule(ref, anchors)
    return { kind: 'decided', copy: { ...copy(ref, d), internalAt: this.reviews.get(refKey(ref))?.internalAt ?? null } }
  }

  deps(): RedecideDeps {
    return vaultDeps(this)
  }
}

/** The applier plays the live path against the in-memory Vault. */
function vaultDeps(v: FakeVault): RedecideDeps {
  const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T
  const applier: RedecideApplier = {
    lock: { acquire: async () => void v.writes.push('lock'), heartbeat: async () => undefined, release: async () => void v.writes.push('unlock') },
    readMessage: async (key) => (v.messages.has(key) ? clone(v.messages.get(key)!) : null),
    indexLive: async (ref, anchors) => {
      const o = v.decide(ref, anchors)
      if (o.kind !== 'decided') return { status: 'error', dealId: null, cycleId: null, messageKey: `gmail:${ref.gmailId}`, error: o.error }
      const c = o.copy
      const existing = v.messages.get(c.messageKey)
      if (existing && existing.decidedBy !== 'system') return { status: 'kept_manual', dealId: existing.dealId, cycleId: existing.cycleId, messageKey: c.messageKey }
      if (c.status === 'filed' || c.status === 'ambiguous' || c.status === 'unfiled_transaction') {
        v.writes.push(`index ${c.messageKey} ${c.status} ${c.dealId ?? ''}`)
        v.messages.set(c.messageKey, {
          id: existing?.id ?? `row-${c.messageKey}`,
          messageKey: c.messageKey,
          status: c.status,
          decidedBy: 'system',
          dealId: c.dealId,
          cycleId: c.status === 'filed' ? c.cycleId : null,
          rulesVersion: v.version,
          gmailRefs: [...(existing?.gmailRefs ?? []).filter((r) => refKey(r) !== refKey(ref)), ref],
          threadKey: c.threadKey ?? existing?.threadKey ?? null,
          gmailThreadIds: [...new Set([...(existing?.gmailThreadIds ?? []), `gt-${ref.gmailId}`])],
          sentAt: existing?.sentAt ?? c.internalAt,
          matchMethod: c.method,
          reasons: c.reasons,
          subject: existing?.subject ?? c.subject,
        })
        if (c.status === 'filed' && c.dealId) v.fileDoc(c.messageKey, c.dealId)
      }
      v.reviews.set(refKey(ref), { ...v.reviews.get(refKey(ref))!, status: c.status, rulesVersion: v.version, dealId: c.status === 'filed' ? c.dealId : null })
      return { status: c.status, dealId: c.dealId, cycleId: c.cycleId, messageKey: c.messageKey }
    },
    stampReviews: async (rows) => {
      let written = 0
      let skippedProtected = 0
      for (const r of rows) {
        const cur = v.reviews.get(refKey(r))
        if (cur && (cur.stage === 'person' || cur.status === 'kept_manual' || cur.status === 'dismissed')) {
          skippedProtected++
          continue
        }
        v.writes.push(`stamp ${r.gmailId} ${r.status}`)
        v.reviews.set(refKey(r), { ...(cur ?? { threadId: null, internalAt: null }), mailbox: r.mailbox, gmailId: r.gmailId, status: r.status, stage: r.stage, rulesVersion: r.rulesVersion, dealId: r.dealId, messageKey: r.messageKey } as ReviewRow)
        written++
      }
      return { written, skippedProtected }
    },
    touchMessage: async (m) => {
      v.writes.push(`touch ${m.messageKey}`)
      v.messages.get(m.messageKey)!.rulesVersion = v.version
    },
    dismissMessage: async (m) => {
      v.writes.push(`dismiss ${m.messageKey}`)
      Object.assign(v.messages.get(m.messageKey)!, { status: 'dismissed', dealId: null, cycleId: null, rulesVersion: v.version })
    },
    correctOffDeal: async ({ message, from, toAddress, newStatus }) => {
      const docs = [...v.docs.values()].filter((d) => d.dealId === from.dealId && d.sourceDocId.startsWith(`gmail:${message.messageKey}:`))
      const plan = planDocumentsOffDeal({ messageKey: message.messageKey, documents: docs.map((d) => ({ ...d, archivedReason: d.archivedReason, otherFilings: [] })) })
      for (const id of plan.archive) {
        v.writes.push(`archive ${id}`)
        Object.assign(v.docs.get(id)!, { archived: true, archivedReason: redecideArchiveReason({ fromAddress: from.dealId!, toAddress, newStatus, rulesVersion: v.version }) })
      }
      return { ...plan, offersLeft: [] }
    },
    correctLeftovers: async (message) => {
      const keep = message.status === 'filed' ? message.dealId : null
      const left = [...v.docs.values()].filter((d) => !d.archived && d.dealId !== keep && d.sourceDocId.startsWith(`gmail:${message.messageKey}:`))
      const out: Array<{ dealId: string; off: Awaited<ReturnType<RedecideApplier['correctOffDeal']>> }> = []
      for (const dealId of new Set(left.map((d) => d.dealId))) {
        const docs = left.filter((d) => d.dealId === dealId)
        const plan = planDocumentsOffDeal({ messageKey: message.messageKey, documents: docs.map((d) => ({ ...d, otherFilings: [] })) })
        for (const id of plan.archive) {
          v.writes.push(`archive ${id}`)
          Object.assign(v.docs.get(id)!, { archived: true, archivedReason: `${REDECIDE_ARCHIVE_PREFIX} left behind` })
        }
        out.push({ dealId, off: { ...plan, offersLeft: [] } })
      }
      return out
    },
    settleOnDeal: async ({ messageKey, dealId, cycleId }) => {
      const docs = [...v.docs.values()].filter((d) => d.dealId === dealId && d.sourceDocId.startsWith(`gmail:${messageKey}:`))
      const plan = planDocumentsOnDeal({ messageKey, targetCycleId: cycleId, documents: docs.map((d) => ({ ...d, otherFilings: [] })), targetCycleHashes: new Map() })
      for (const id of plan.restore) {
        v.writes.push(`restore ${id}`)
        Object.assign(v.docs.get(id)!, { archived: false, archivedReason: null })
      }
      return { restored: plan.restore, moved: [], duplicatesArchived: [], kept: plan.keep }
    },
    event: async (e) => {
      v.writes.push(`event ${e.action} ${e.dealId}`)
      v.events.push(e)
    },
  }
  return {
    currentVersion: v.version,
    loadReviews: async () => clone([...v.reviews.values()]),
    loadMessages: async () => clone([...v.messages.values()]),
    decide: async (ref, anchors) => {
      v.decided.push(ref.gmailId)
      return v.decide(ref, anchors)
    },
    dealAddress: (id) => (id ? `${id} Street` : null),
    previewOffDeal: async ({ message, from }) => {
      const docs = [...v.docs.values()].filter((d) => d.dealId === from.dealId && d.sourceDocId.startsWith(`gmail:${message.messageKey}:`))
      return { ...planDocumentsOffDeal({ messageKey: message.messageKey, documents: docs.map((d) => ({ ...d, otherFilings: [] })) }), offersLeft: [] }
    },
    applier,
  }
}

/** The rules follow the thread when an eligible sibling is filed, else say what `fallback` says. */
const threadRule =
  (key: string, threadKey: string, fallback: Parameters<typeof copy>[1]): Rule =>
  (_ref, anchors) => {
    const a = anchors({ threadKey, limit: 5 }).find((r) => r.message_key !== key && r.deal_id)
    return a ? { key, status: 'filed', dealId: a.deal_id, cycleId: CYCLE[a.deal_id!], method: 'thread', threadKey } : { ...fallback, key, threadKey }
  }

function scenario(): FakeVault {
  const v = new FakeVault()
  // 1. Bulk under v3, a real title email under v4: newly filed on B.
  v.addReview('bulk', { status: 'bulk' })
  v.rules.set(`${MB}|bulk`, () => ({ key: 'rfc:k-bulk', status: 'filed', dealId: 'B', cycleId: 'b1', method: 'escrow' }))
  // 2. A broker's mail-merge the old rules filed on A: now not a deal.
  v.addFiled('merge', 'rfc:k-merge', 'A')
  v.rules.set(`${MB}|merge`, () => ({ key: 'rfc:k-merge', status: 'not_deal' }))
  // 3. A person filed this on A by hand. The rules now disagree. Never touched.
  v.addFiled('hand', 'rfc:k-hand', 'A', { decidedBy: 'paul@ryan-realty.com' }, { stage: 'person' })
  v.rules.set(`${MB}|hand`, () => ({ key: 'rfc:k-hand', status: 'not_deal' }))
  // 4. kept_manual review row (a person's row upstream). Never touched.
  v.addReview('kept', { status: 'kept_manual', messageKey: 'rfc:k-kept' })
  v.rules.set(`${MB}|kept`, () => ({ key: 'rfc:k-kept', status: 'not_deal' }))
  // 5. A CMA filed on the wrong deal: moves A → B.
  v.addFiled('cma', 'rfc:k-cma', 'A')
  v.rules.set(`${MB}|cma`, () => ({ key: 'rfc:k-cma', status: 'filed', dealId: 'B', cycleId: 'b1', method: 'address' }))
  // 6. Ordinary mail, still ordinary.
  v.addReview('plain')
  v.rules.set(`${MB}|plain`, () => ({ key: 'rfc:k-plain', status: 'not_deal' }))
  // 7. A vendor thread the old rules filed on A as a whole (opener + reply
  //    holding each other up by "same thread"). Neither names a deal.
  v.addFiled('vendor-1', 'rfc:k-v1', 'A', { threadKey: 'TV' })
  v.addFiled('vendor-2', 'rfc:k-v2', 'A', { threadKey: 'TV', matchMethod: 'thread' })
  v.rules.set(`${MB}|vendor-1`, threadRule('rfc:k-v1', 'TV', { key: 'rfc:k-v1', status: 'not_deal' }))
  v.rules.set(`${MB}|vendor-2`, threadRule('rfc:k-v2', 'TV', { key: 'rfc:k-v2', status: 'not_deal' }))
  // 8. A real deal thread: opener names B's address; the reply follows it there.
  v.addFiled('deal-1', 'rfc:k-d1', 'A', { threadKey: 'TD' })
  v.addFiled('deal-2', 'rfc:k-d2', 'A', { threadKey: 'TD', matchMethod: 'thread' })
  v.rules.set(`${MB}|deal-1`, () => ({ key: 'rfc:k-d1', status: 'filed', dealId: 'B', cycleId: 'b1', method: 'address', threadKey: 'TD' }))
  v.rules.set(`${MB}|deal-2`, threadRule('rfc:k-d2', 'TD', { key: 'rfc:k-d2', status: 'not_deal' }))
  return v
}

const transitionsOf = (rep: Awaited<ReturnType<typeof runRedecide>>) =>
  Object.fromEntries(Object.entries(rep.rowsByMailbox[MB] ?? {}).sort(([a], [b]) => a.localeCompare(b)))

describe('runRedecide', () => {
  it('dry run: classifies every row and writes nothing', async () => {
    const v = scenario()
    const before = JSON.stringify([...v.messages.values(), ...v.reviews.values(), ...v.docs.values()])
    const rep = await runRedecide({ apply: false }, v.deps())
    expect(transitionsOf(rep)).toEqual({ file: 1, move: 3, protected: 2, unchanged: 1, unfile: 3 })
    expect(v.writes).toEqual([])
    expect(JSON.stringify([...v.messages.values(), ...v.reviews.values(), ...v.docs.values()])).toBe(before)
    // The dry run previews the documents a correction would archive.
    expect(rep.documents.toArchive).toBe(6)
    expect(rep.samples.unfile?.map((s) => s.gmailId).sort()).toEqual(['merge', 'vendor-1', 'vendor-2'])
  })

  it('a thread misfiled as a whole cannot hold itself on the old deal; a real thread follows its opener', async () => {
    const v = scenario()
    const rep = await runRedecide({ apply: false }, v.deps())
    const t = Object.fromEntries(Object.values(rep.samples).flat().map((s) => [s.gmailId, `${s.transition}${s.newDealId ? ` ${s.newDealId}` : ''}`]))
    expect(t['vendor-1']).toBe('unfile')
    expect(t['vendor-2']).toBe('unfile')
    expect(t['deal-1']).toBe('move B')
    expect(t['deal-2']).toBe('move B')
  })

  it('never touches a person’s decision: not read from Gmail, not stamped, not moved', async () => {
    const v = scenario()
    const hand = JSON.stringify(v.messages.get('rfc:k-hand'))
    const handReview = JSON.stringify(v.reviews.get(`${MB}|hand`))
    const keptReview = JSON.stringify(v.reviews.get(`${MB}|kept`))
    const rep = await runRedecide({ apply: true }, v.deps())
    expect(rep.protectedBy).toEqual({ person: 1, kept_manual: 1 })
    expect(v.decided).not.toContain('hand')
    expect(v.decided).not.toContain('kept')
    expect(JSON.stringify(v.messages.get('rfc:k-hand'))).toBe(hand)
    expect(JSON.stringify(v.reviews.get(`${MB}|hand`))).toBe(handReview)
    expect(JSON.stringify(v.reviews.get(`${MB}|kept`))).toBe(keptReview)
    expect(v.docs.get('doc-rfc:k-hand-A')!.archived).toBe(false)
    expect(v.writes.filter((w) => /k-hand|hand$|kept/.test(w))).toEqual([])
  })

  it('apply: files, moves and unfiles through the live path, archives only the message’s own documents, writes an event for each', async () => {
    const v = scenario()
    const rep = await runRedecide({ apply: true }, v.deps())
    expect(transitionsOf(rep)).toEqual({ file: 1, move: 3, protected: 2, unchanged: 1, unfile: 3 })
    expect(rep.divergences).toEqual([])
    // New filing on B, with its document.
    expect(v.messages.get('rfc:k-bulk')).toMatchObject({ status: 'filed', dealId: 'B', rulesVersion: 'v4' })
    expect(v.docs.get('doc-rfc:k-bulk-B')!.archived).toBe(false)
    // Unfiled: the row is dismissed by the rules (decided_by stays system), its document archived with the re-decision's reason.
    expect(v.messages.get('rfc:k-merge')).toMatchObject({ status: 'dismissed', decidedBy: 'system', dealId: null })
    expect(v.docs.get('doc-rfc:k-merge-A')).toMatchObject({ archived: true })
    expect(v.docs.get('doc-rfc:k-merge-A')!.archivedReason!.startsWith(REDECIDE_ARCHIVE_PREFIX)).toBe(true)
    // Moved: off A (archived), onto B (filed), an event on each side.
    expect(v.messages.get('rfc:k-cma')).toMatchObject({ status: 'filed', dealId: 'B' })
    expect(v.docs.get('doc-rfc:k-cma-A')!.archived).toBe(true)
    expect(v.docs.get('doc-rfc:k-cma-B')!.archived).toBe(false)
    const ev = v.events.map((e) => `${e.action} ${e.dealId} ${(e.detail as { direction?: string }).direction ?? ''}`.trim())
    expect(ev.filter((e) => e.startsWith('mail_moved')).sort()).toEqual([
      'mail_moved A out',
      'mail_moved A out',
      'mail_moved A out',
      'mail_moved B in',
      'mail_moved B in',
      'mail_moved B in',
    ])
    expect(ev.filter((e) => e.startsWith('mail_unfiled'))).toEqual(['mail_unfiled A', 'mail_unfiled A', 'mail_unfiled A'])
    // Every non-protected row now carries v4; the protected ones keep what a person gave them.
    const versions = [...v.reviews.values()].map((r) => `${r.gmailId}:${r.rulesVersion}`).sort()
    expect(versions).toEqual(['bulk:v4', 'cma:v4', 'deal-1:v4', 'deal-2:v4', 'hand:v3', 'kept:v3', 'merge:v4', 'plain:v4', 'vendor-1:v4', 'vendor-2:v4'])
    expect(v.writes[0]).toBe('lock')
    expect(v.writes.at(-1)).toBe('unlock')
  })

  it('is idempotent: a second run changes nothing, and a forced re-run finds every row unchanged', async () => {
    const v = scenario()
    await runRedecide({ apply: true }, v.deps())
    const snapshot = () => JSON.stringify({ m: [...v.messages.values()], d: [...v.docs.values()], e: v.events.length })
    const after1 = snapshot()
    v.writes = []
    const rep2 = await runRedecide({ apply: true }, v.deps())
    expect(rep2.selectedRows).toBe(2) // only the two a person owns stay on the old version
    expect(transitionsOf(rep2)).toEqual({ protected: 2 })
    expect(v.writes).toEqual(['lock', 'unlock'])
    expect(snapshot()).toBe(after1)
    // Force every row back to the old version: the same rules decide the same outcome.
    for (const r of v.reviews.values()) if (r.stage !== 'person' && r.status !== 'kept_manual') r.rulesVersion = 'v3'
    v.writes = []
    const rep3 = await runRedecide({ apply: true }, v.deps())
    expect(transitionsOf(rep3)).toEqual({ protected: 2, unchanged: 8 })
    expect(v.writes.filter((w) => /^(archive|restore|event|index|dismiss)/.test(w))).toEqual([])
    expect(snapshot()).toBe(after1)
  })

  it('is reversible: a later rules version that files a message back restores the documents this one archived', async () => {
    const v = scenario()
    await runRedecide({ apply: true }, v.deps())
    expect(v.docs.get('doc-rfc:k-cma-A')!.archived).toBe(true)
    v.version = 'v5'
    v.rules.set(`${MB}|cma`, () => ({ key: 'rfc:k-cma', status: 'filed', dealId: 'A', cycleId: 'a1', method: 'address' }))
    const rep = await runRedecide({ apply: true, statuses: ['filed'] }, v.deps())
    expect(rep.samples.move?.map((s) => s.gmailId)).toContain('cma')
    expect(v.docs.get('doc-rfc:k-cma-A')).toMatchObject({ archived: false, archivedReason: null })
    expect(v.docs.get('doc-rfc:k-cma-B')!.archived).toBe(true)
  })

  it('a reply that follows a LATER sibling keeps its filing (rule 2 has no time order)', async () => {
    const make = () => {
      const v = new FakeVault()
      // The reply came first and says nothing of the property; the next email names it.
      v.addFiled('reply', 'rfc:k-reply', 'A', { threadKey: 'TL', matchMethod: 'thread' })
      v.addFiled('later', 'rfc:k-later', 'A', { threadKey: 'TL' })
      v.rules.set(`${MB}|reply`, threadRule('rfc:k-reply', 'TL', { key: 'rfc:k-reply', status: 'not_deal' }))
      v.rules.set(`${MB}|later`, () => ({ key: 'rfc:k-later', status: 'filed', dealId: 'A', cycleId: 'a1', method: 'address', threadKey: 'TL' }))
      return v
    }
    const dry = make()
    const rep = await runRedecide({ apply: false }, dry.deps())
    expect(transitionsOf(rep)).toEqual({ unchanged: 2 })
    expect(rep.deferred).toBe(1)
    const v = make()
    const applied = await runRedecide({ apply: true }, v.deps())
    expect(transitionsOf(applied)).toEqual({ unchanged: 2 })
    expect(v.messages.get('rfc:k-reply')).toMatchObject({ status: 'filed', dealId: 'A' })
    expect(v.docs.get('doc-rfc:k-reply-A')!.archived).toBe(false)
    expect(v.events).toEqual([])
    // A run that stops before the later sibling leaves the reply for the next run instead of unfiling it.
    const w = make()
    const first = await runRedecide({ apply: true, limit: 1 }, w.deps())
    expect(first.leftForNextRun).toBe(1)
    expect(first.processedRows).toBe(0)
    expect(w.reviews.get(`${MB}|reply`)!.rulesVersion).toBe('v3')
    expect(w.messages.get('rfc:k-reply')!.status).toBe('filed')
    const rest = await runRedecide({ apply: true }, w.deps())
    expect(transitionsOf(rest)).toEqual({ unchanged: 2 })
  })

  it('cleans documents an earlier, interrupted move left on the old deal, once', async () => {
    const v = new FakeVault()
    // The live path already moved this email to B (row and documents), then the run stopped before correcting A.
    v.addFiled('moved', 'rfc:k-moved', 'B')
    v.fileDoc('rfc:k-moved', 'A')
    v.rules.set(`${MB}|moved`, () => ({ key: 'rfc:k-moved', status: 'filed', dealId: 'B', cycleId: 'b1', method: 'address' }))
    const rep = await runRedecide({ apply: true }, v.deps())
    expect(transitionsOf(rep)).toEqual({ unchanged: 1 })
    expect(rep.documents.leftovers).toEqual({ messages: 1, deals: 1, toArchive: 1, kept: 0 })
    expect(v.docs.get('doc-rfc:k-moved-A')!.archived).toBe(true)
    expect(v.docs.get('doc-rfc:k-moved-B')!.archived).toBe(false)
    expect(v.events.map((e) => `${e.action} ${e.dealId}`)).toEqual(['mail_unfiled A'])
    // Forced again: nothing left behind, no second event.
    for (const r of v.reviews.values()) r.rulesVersion = 'v3'
    const again = await runRedecide({ apply: true }, v.deps())
    expect(again.documents.leftovers.messages).toBe(0)
    expect(v.events).toHaveLength(1)
  })

  it('the dry run counts leftovers without touching them', async () => {
    const v = new FakeVault()
    v.addFiled('moved', 'rfc:k-moved', 'B')
    v.fileDoc('rfc:k-moved', 'A')
    v.rules.set(`${MB}|moved`, () => ({ key: 'rfc:k-moved', status: 'filed', dealId: 'B', cycleId: 'b1', method: 'address' }))
    const deps = v.deps()
    deps.previewLeftovers = async (m) => [{ dealId: 'A', off: { ...planDocumentsOffDeal({ messageKey: m.messageKey, documents: [{ ...v.docs.get('doc-rfc:k-moved-A')!, otherFilings: [] }] }), offersLeft: [] } }]
    const rep = await runRedecide({ apply: false }, deps)
    expect(rep.documents.leftovers).toEqual({ messages: 1, deals: 1, toArchive: 1, kept: 0 })
    expect(v.docs.get('doc-rfc:k-moved-A')!.archived).toBe(false)
    expect(v.writes).toEqual([])
  })

  it('stops at the deadline and resumes where it left off', async () => {
    const v = scenario()
    const rep1 = await runRedecide({ apply: true, limit: 3, concurrency: 1 }, v.deps())
    expect(rep1.complete).toBe(false)
    const rep2 = await runRedecide({ apply: true }, v.deps())
    expect(rep1.processedRows).toBe(3)
    expect(rep2.complete).toBe(true)
    // Everything a person does not own now carries v4; the second run took only what the first left.
    expect([...v.reviews.values()].filter((r) => r.rulesVersion !== 'v4').map((r) => r.gmailId).sort()).toEqual(['hand', 'kept'])
    expect(rep2.processedRows).toBe(8)
    expect(v.messages.get('rfc:k-merge')!.status).toBe('dismissed')
    const past = await runRedecide({ apply: true, deadline: Date.now() - 1 }, v.deps())
    expect(past.processedRows).toBe(0)
  })

  it('a person answering the queue during the run wins over the plan', async () => {
    const v = scenario()
    const deps = v.deps()
    const readMessage = deps.applier!.readMessage
    deps.applier!.readMessage = async (key) => {
      if (key === 'rfc:k-merge') v.messages.get('rfc:k-merge')!.decidedBy = 'rebeccapeterson@ryan-realty.com'
      return readMessage(key)
    }
    const rep = await runRedecide({ apply: true }, deps)
    expect(v.messages.get('rfc:k-merge')).toMatchObject({ status: 'filed', dealId: 'A', decidedBy: 'rebeccapeterson@ryan-realty.com' })
    expect(v.docs.get('doc-rfc:k-merge-A')!.archived).toBe(false)
    expect(rep.samples.protected?.some((s) => s.gmailId === 'merge' && /during the run/.test(s.note ?? ''))).toBe(true)
  })
})

// ── the production applier, against a recording database ─────────────────

type Call = { table: string; ops: Array<[string, unknown[]]> }

/** Every chain is recorded; `respond` answers when it is awaited. */
function recordingDb(respond: (c: Call) => { data: unknown; error: { message: string } | null }) {
  const calls: Call[] = []
  const from = (table: string) => {
    const call: Call = { table, ops: [] }
    calls.push(call)
    const chain: unknown = new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === 'then') return (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(respond(call)).then(res, rej)
          return (...args: unknown[]) => {
            call.ops.push([String(prop), args])
            return chain
          }
        },
      },
    )
    return chain
  }
  return { sb: { from } as unknown as SupabaseClient, calls }
}
const op = (c: Call, name: string) => c.ops.filter(([n]) => n === name).map(([, a]) => a)
const has = (c: Call, name: string) => c.ops.some(([n]) => n === name)

describe('production applier (recorded, no network)', () => {
  const message: MessageRow = {
    id: 'row-1',
    messageKey: 'rfc:aaaaaaaaaaaaaaaaaaaaaaaa',
    status: 'filed',
    decidedBy: 'system',
    dealId: 'deal-a',
    cycleId: 'cyc-a',
    rulesVersion: 'v3',
    gmailRefs: [{ mailbox: MB, gmailId: 'g1' }],
    threadKey: 'thr:1',
    gmailThreadIds: ['t1'],
    sentAt: '2026-09-01T00:00:00Z',
    matchMethod: 'address',
    reasons: [],
    subject: 'Mail merge',
  }

  it('takes the lock, refuses a fresh one held by another run, takes over a stale one', async () => {
    let held: { page_token: string; started_at: string; updated_at: string } | null = null
    const { sb, calls } = recordingDb((c) => {
      if (c.table !== 'tc_mail_review_cursors') return { data: [], error: null }
      if (has(c, 'insert')) {
        if (held) return { data: null, error: { message: 'duplicate key value violates unique constraint' } }
        held = { ...(op(c, 'insert')[0][0] as { page_token: string; started_at: string; updated_at: string }) }
        return { data: null, error: null }
      }
      if (has(c, 'maybeSingle')) return { data: held, error: null }
      if (has(c, 'delete')) {
        held = null
        return { data: null, error: null }
      }
      if (has(c, 'update')) return { data: [{ mailbox: REDECIDE_LOCK_KEY }], error: null }
      return { data: [], error: null }
    })
    const a = (await createProductionRedecideDeps({ apply: true, sb })).applier!
    await a.lock.acquire()
    expect(held).not.toBeNull()
    const b = (await createProductionRedecideDeps({ apply: true, sb })).applier!
    await expect(b.lock.acquire()).rejects.toThrow(/holds the lock/)
    const stolenFrom = held!.page_token
    held!.updated_at = new Date(Date.now() - 21 * 60_000).toISOString()
    await b.lock.acquire()
    expect(held!.page_token).not.toBe(stolenFrom)
    const takeover = calls.find((c) => c.table === 'tc_mail_review_cursors' && has(c, 'delete'))!
    expect(op(takeover, 'eq')).toContainEqual(['page_token', stolenFrom])
    await b.lock.heartbeat({ processed: 10 })
    await b.lock.release()
    expect(held).toBeNull()
  })

  it('stamps review rows with the new version, skipping any a person owns by now', async () => {
    const { sb, calls } = recordingDb((c) => {
      if (c.table === 'tc_mail_reviews' && has(c, 'select') && !has(c, 'upsert')) return { data: [{ gmail_id: 'g2', stage: 'person', status: 'filed' }], error: null }
      return { data: [], error: null }
    })
    const a = (await createProductionRedecideDeps({ apply: true, sb })).applier!
    const row = (gmailId: string) => ({ mailbox: MB, gmailId, threadId: 't', internalAt: null, status: 'not_deal', dealId: null, messageKey: null, reason: 'not_deal: rule', stage: 'rules', rulesVersion: 'v9' })
    const res = await a.stampReviews([row('g1'), row('g2')])
    expect(res).toEqual({ written: 1, skippedProtected: 1 })
    const up = calls.find((c) => c.table === 'tc_mail_reviews' && has(c, 'upsert'))!
    const written = op(up, 'upsert')[0][0] as Array<{ gmail_id: string; rules_version: string }>
    expect(written.map((w) => [w.gmail_id, w.rules_version])).toEqual([['g1', 'v9']])
  })

  it('dismisses an unfiled index row only while the rules still own it', async () => {
    const { sb, calls } = recordingDb(() => ({ data: null, error: null }))
    const a = (await createProductionRedecideDeps({ apply: true, sb })).applier!
    await a.dismissMessage(message, {
      copy: copy({ mailbox: MB, gmailId: 'g1' }, { key: message.messageKey, status: 'not_deal' }),
      transition: 'unfile',
      previous: S('filed', 'deal-a', 'cyc-a'),
    })
    const upd = calls.find((c) => c.table === 'tc_mail_messages' && has(c, 'update'))!
    expect(op(upd, 'update')[0][0]).toMatchObject({ status: 'dismissed', deal_id: null, cycle_id: null })
    expect(op(upd, 'eq')).toContainEqual(['decided_by', 'system'])
  })

  it('archives only the email’s own unused document on the file it leaves, with an event per document; offers untouched', async () => {
    const docs = [
      { id: 'own', cycle_id: 'cyc-a', source_doc_id: `gmail:${message.messageKey}:ATT1`, sha256: 's1', archived: false, archived_reason: null, client_visible: false, original_name: 'a.pdf' },
      { id: 'uploaded', cycle_id: 'cyc-a', source_doc_id: `gmail:${message.messageKey}:ATT2`, sha256: 's2', archived: false, archived_reason: null, client_visible: false, original_name: 'b.pdf' },
      { id: 'shared', cycle_id: 'cyc-a', source_doc_id: `gmail:${message.messageKey}:ATT3`, sha256: 's3', archived: false, archived_reason: null, client_visible: true, original_name: 'c.pdf' },
    ]
    const { sb, calls } = recordingDb((c) => {
      if (c.table === 'tc_documents' && has(c, 'update')) return { data: [{ id: 'own', cycle_id: 'cyc-a', name: 'a.pdf' }], error: null }
      if (c.table === 'tc_documents' && has(c, 'like')) return { data: docs, error: null }
      if (c.table === 'tc_mail_messages' && has(c, 'maybeSingle')) return { data: { attachments: [] }, error: null }
      if (c.table === 'tc_events' && op(c, 'in').some(([col]) => col === 'document_id')) {
        return { data: [{ document_id: 'uploaded', actor: 'paul@ryan-realty.com', action: 'document_review_resolved', detail: {} }], error: null }
      }
      if (c.table === 'tc_offers' && op(c, 'eq').some(([col]) => col === 'source_message_id')) {
        return { data: [{ id: 'offer-1', status: 'received', price: 500000, buyer_agent: 'X' }], error: null }
      }
      return { data: [], error: null }
    })
    const deps = await createProductionRedecideDeps({ apply: true, sb })
    const res = await deps.applier!.correctOffDeal({ message, from: S('filed', 'deal-a', 'cyc-a'), toAddress: null, newStatus: 'not_deal' })
    expect(res.archive).toEqual(['own'])
    expect(res.keep.map((k) => k.id).sort()).toEqual(['shared', 'uploaded'])
    expect(res.offersLeft).toEqual([{ id: 'offer-1', status: 'received', price: 500000, buyerAgent: 'X' }])
    const archive = calls.find((c) => c.table === 'tc_documents' && has(c, 'update'))!
    expect(op(archive, 'in')).toEqual([['id', ['own']]])
    expect((op(archive, 'update')[0][0] as { archived_reason: string }).archived_reason.startsWith(REDECIDE_ARCHIVE_PREFIX)).toBe(true)
    const events = calls
      .filter((c) => c.table === 'tc_events' && has(c, 'insert'))
      .flatMap((c) => op(c, 'insert')[0][0] as Array<{ document_id: string; action: string; actor: string }>)
    expect(events.map((e) => [e.document_id, e.action, e.actor])).toEqual([['own', 'document_archived', REDECIDE_ACTOR]])
    expect(calls.some((c) => c.table === 'tc_offers' && (has(c, 'delete') || has(c, 'update')))).toBe(false)
  })

  it('a dry-run deps object has no applier, and its database handle refuses writes', async () => {
    const { sb, calls } = recordingDb(() => ({ data: [], error: null }))
    const deps = await createProductionRedecideDeps({ apply: false, sb })
    expect(deps.applier).toBeUndefined()
    await deps.loadReviews()
    await deps.loadMessages()
    expect(calls.every((c) => !c.ops.some(([n]) => ['insert', 'update', 'upsert', 'delete'].includes(n)))).toBe(true)
  })
})
