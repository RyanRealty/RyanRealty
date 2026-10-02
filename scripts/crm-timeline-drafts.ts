/**
 * One-time repair: CRM timeline rows the Gmail sync wrote for unsent drafts.
 * docs/TC_MAIL_FILING_RULES.md "v4.2: an unsent draft is not mail". The sync
 * listed drafts beside sent mail until v4.2 (lib/crm/gmail-drafts.ts), so a
 * draft to a client landed on that client's timeline as `email_out`: a broker
 * touch in the response clock, speed-to-lead and contact-attempt reports, for
 * an email nobody received.
 *
 *   npx tsx scripts/crm-timeline-drafts.ts            dry run (the default): reads Gmail and the
 *                                                     timeline, writes tmp/crm-timeline-drafts/<run>/,
 *                                                     changes nothing
 *   npx tsx scripts/crm-timeline-drafts.ts --apply    deletes the `draft` rows and repoints the
 *                                                     `moved` rows, after saving their before-image
 *
 * Every Gmail-sourced email row (crm_timeline source 'gmail', kind email_in /
 * email_out) is checked against its mailbox, one Gmail read per message:
 *
 *   ok       the message exists and is not a draft: left alone
 *   draft    Gmail still holds it as a draft: it reached no one. Deleted on --apply.
 *   moved    the id is gone, and its thread holds the same Message-ID as a message
 *            that is not a draft: the row was written from a draft autosave the send
 *            replaced (every autosave and the send get a new id). payload.gmailId is
 *            repointed to the surviving message on --apply.
 *   missing  the id is gone and nothing with its Message-ID is left in the thread
 *            (a discarded draft, or mail deleted for good): counted, left alone
 *   error    Gmail failed after retries: left alone
 *
 * Gmail is opened read-only. The July 2026 conversation backfill copied most of
 * these rows into crm_message (timeline_id): --apply deletes a draft's copy
 * with it, deletes a conversation left with no message (its participants
 * cascade), and recomputes the touched conversations' rollups the way
 * recompute_conversation_rollups() does. A copy another message replies to
 * stays, with its timeline row. Every row changed or removed is written whole
 * to before.json first.
 */
import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import Module from 'node:module'
import { createHash } from 'node:crypto'

const STUB = path.resolve(__dirname, '../test/server-only-stub.ts')
const resolveFilename = (Module as unknown as { _resolveFilename: (r: string, ...a: unknown[]) => string })._resolveFilename
;(Module as unknown as { _resolveFilename: unknown })._resolveFilename = function (this: unknown, request: string, ...args: unknown[]) {
  const req = request === 'server-only' || request === 'client-only' ? STUB : request
  return resolveFilename.call(this, req, ...args)
}

type Row = { id: number; person_id: number; kind: string; ts: string; broker: string | null; dedupe_key: string; payload: Record<string, unknown> | null }
type Verdict = 'ok' | 'draft' | 'moved' | 'missing' | 'error'
type Classified = { row: Row; mailbox: string | null; gmailId: string | null; verdict: Verdict; newGmailId?: string; newThreadId?: string; note?: string }

const apply = process.argv.includes('--apply')
const CONCURRENCY = 8

/** The CRM sync's message key: `rfc:` + sha1(Message-ID) prefix, as lib/crm/gmail.ts writes it. */
function rfcKey(messageId: string): string {
  return `rfc:${createHash('sha1').update(messageId.trim()).digest('hex').slice(0, 24)}`
}

/** Gmail's 404 ("Requested entity was not found"), however gaxios carries it. */
function isNotFound(err: unknown): boolean {
  const e = err as { code?: unknown; status?: unknown; response?: { status?: unknown }; message?: unknown }
  const status = Number(e?.response?.status ?? e?.status ?? e?.code)
  return status === 404 || /requested entity was not found|not found/i.test(String(e?.message ?? ''))
}

/** `gmail:<messageKey>:p<personId>` → messageKey. */
function messageKeyOf(dedupeKey: string): string | null {
  const m = /^gmail:(.+):p\d+$/.exec(dedupeKey)
  return m ? m[1] : null
}

async function pool<T>(items: readonly T[], n: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) await fn(items[next++])
    }),
  )
}

async function main() {
  const { createServiceClient } = await import('@/lib/supabase/service')
  const { getGmailFor } = await import('@/lib/crm/gmail')
  const { isUnsentDraft } = await import('@/lib/crm/gmail-drafts')
  const { conversationRollups } = await import('@/lib/crm/conversation-rollups')
  const sb = createServiceClient()

  const rows: Row[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from('crm_timeline')
      .select('id, person_id, kind, ts, broker, dedupe_key, payload')
      .eq('source', 'gmail')
      .in('kind', ['email_in', 'email_out'])
      .order('id', { ascending: true })
      .range(from, from + 999)
    if (error) throw new Error(`crm_timeline read: ${error.message}`)
    rows.push(...((data ?? []) as Row[]))
    if (!data || data.length < 1000) break
  }
  console.log(`[timeline-drafts] ${rows.length} Gmail email rows on the CRM timeline`)

  const gmailByBox = new Map<string, ReturnType<typeof getGmailFor>>()
  const gmail = (box: string) => {
    if (!gmailByBox.has(box)) gmailByBox.set(box, getGmailFor(box, ['https://www.googleapis.com/auth/gmail.readonly']))
    return gmailByBox.get(box)!
  }
  type MessageState = { state: 'draft' | 'present' | 'gone' | 'error'; note?: string }
  const messageCache = new Map<string, Promise<MessageState>>()
  const messageState = (box: string, id: string): Promise<MessageState> => {
    const k = `${box}|${id}`
    if (!messageCache.has(k)) {
      messageCache.set(
        k,
        (async () => {
          const g = gmail(box)
          if (!g) return { state: 'error', note: 'mailbox not reachable' }
          try {
            const m = await g.users.messages.get({ userId: 'me', id, format: 'minimal' })
            return { state: isUnsentDraft(m.data.labelIds) ? 'draft' : 'present' }
          } catch (err) {
            if (isNotFound(err)) return { state: 'gone' }
            return { state: 'error', note: err instanceof Error ? err.message.slice(0, 160) : String(err) }
          }
        })(),
      )
    }
    return messageCache.get(k)!
  }
  type ThreadCopy = { id: string; key: string | null; draft: boolean }
  const threadCache = new Map<string, Promise<ThreadCopy[] | null>>()
  const threadCopies = (box: string, threadId: string): Promise<ThreadCopy[] | null> => {
    const k = `${box}|${threadId}`
    if (!threadCache.has(k)) {
      threadCache.set(
        k,
        (async () => {
          const g = gmail(box)
          if (!g) return null
          try {
            const t = await g.users.threads.get({ userId: 'me', id: threadId, format: 'metadata', metadataHeaders: ['Message-ID'] })
            return (t.data.messages ?? []).map((m) => {
              const mid = m.payload?.headers?.find((h) => h.name?.toLowerCase() === 'message-id')?.value
              return { id: String(m.id), key: mid ? rfcKey(mid) : null, draft: isUnsentDraft(m.labelIds) }
            })
          } catch (err) {
            return isNotFound(err) ? [] : null
          }
        })(),
      )
    }
    return threadCache.get(k)!
  }

  const out: Classified[] = []
  let done = 0
  await pool(rows, CONCURRENCY, async (row) => {
    const p = (row.payload ?? {}) as { mailbox?: string; gmailId?: string; threadId?: string }
    const mailbox = p.mailbox ?? null
    const gmailId = p.gmailId ?? null
    let c: Classified
    if (!mailbox || !gmailId) {
      c = { row, mailbox, gmailId, verdict: 'error', note: 'no mailbox or gmailId on the row' }
    } else {
      const s = await messageState(mailbox, gmailId)
      if (s.state === 'present') c = { row, mailbox, gmailId, verdict: 'ok' }
      else if (s.state === 'draft') c = { row, mailbox, gmailId, verdict: 'draft' }
      else if (s.state === 'error') c = { row, mailbox, gmailId, verdict: 'error', note: s.note }
      else {
        const key = messageKeyOf(row.dedupe_key)
        const copies = p.threadId && key?.startsWith('rfc:') ? await threadCopies(mailbox, p.threadId) : []
        if (copies === null) c = { row, mailbox, gmailId, verdict: 'error', note: 'thread read failed' }
        else {
          const same = copies.filter((x) => x.key === key)
          const kept = same.find((x) => !x.draft)
          if (kept) c = { row, mailbox, gmailId, verdict: 'moved', newGmailId: kept.id, newThreadId: p.threadId }
          else if (same.length) c = { row, mailbox, gmailId, verdict: 'draft', newGmailId: same[0].id, note: 'a later autosave is still a draft' }
          else c = { row, mailbox, gmailId, verdict: 'missing' }
        }
      }
    }
    out.push(c)
    if (++done % 2000 === 0) console.log(`[timeline-drafts] ${done}/${rows.length}`)
  })

  const tally = (pick: (c: Classified) => string) =>
    out.reduce<Record<string, number>>((m, c) => ((m[pick(c)] = (m[pick(c)] ?? 0) + 1), m), {})
  const byVerdict = tally((c) => c.verdict)
  const byVerdictKind = tally((c) => `${c.verdict}/${c.row.kind}`)
  const drafts = out.filter((c) => c.verdict === 'draft')
  const moved = out.filter((c) => c.verdict === 'moved')
  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    rows: rows.length,
    gmailMessagesRead: messageCache.size,
    threadsRead: threadCache.size,
    byVerdict,
    byVerdictKind,
    draftPeople: new Set(drafts.map((c) => c.row.person_id)).size,
    byMailbox: tally((c) => `${c.verdict}/${c.mailbox}`),
  }

  const runId = new Date().toISOString().replace(/[:.]/g, '-')
  const dir = path.join('tmp/crm-timeline-drafts', `${apply ? 'apply' : 'dry-run'}-${runId}`)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(
    path.join(dir, 'rows.jsonl'),
    out
      .filter((c) => c.verdict !== 'ok')
      .map((c) =>
        JSON.stringify({ id: c.row.id, person: c.row.person_id, kind: c.row.kind, ts: c.row.ts, mailbox: c.mailbox, gmailId: c.gmailId, verdict: c.verdict, newGmailId: c.newGmailId ?? null, note: c.note ?? null }),
      )
      .join('\n') + '\n',
  )

  // The conversation model holds a copy of most of these rows: the July 2026
  // backfill (migration 20260716210000) copied the timeline into crm_message.
  // A draft's copy goes with it, and a conversation left with no message goes
  // too. A copy another message replies to stays, with its timeline row.
  type Msg = {
    id: string
    conversation_id: string
    timeline_id: number | null
    direction: string
    channel: string
    body: string | null
    subject: string | null
    meta: Record<string, unknown> | null
    sent_by: string | null
    created_at: string
  }
  const MSG_COLS = 'id, conversation_id, timeline_id, direction, channel, body, subject, meta, sent_by, created_at'
  const chunks = <T,>(xs: readonly T[], n = 200): T[][] => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n))
  const draftIds = drafts.map((c) => c.row.id)
  const copies: Msg[] = []
  for (const chunk of chunks(draftIds)) {
    const { data, error } = await sb.from('crm_message').select(MSG_COLS).in('timeline_id', chunk).limit(1000)
    if (error) throw new Error(`crm_message read: ${error.message}`)
    // 200 timeline ids, at most a few copies each: far under the cap, and checked.
    if ((data ?? []).length >= 1000) throw new Error('crm_message read hit the 1,000-row cap; narrow the chunk')
    copies.push(...((data ?? []) as Msg[]))
  }
  const repliedTo = new Set<string>()
  for (const chunk of chunks(copies.map((m) => m.id))) {
    const { data, error } = await sb.from('crm_message').select('in_reply_to_id').in('in_reply_to_id', chunk).limit(1000)
    if (error) throw new Error(`crm_message reply read: ${error.message}`)
    if ((data ?? []).length >= 1000) throw new Error('crm_message reply read hit the 1,000-row cap; narrow the chunk')
    for (const r of data ?? []) repliedTo.add(String(r.in_reply_to_id))
  }
  const goMessages = copies.filter((m) => !repliedTo.has(m.id))
  const heldTimeline = new Set(copies.filter((m) => repliedTo.has(m.id)).map((m) => Number(m.timeline_id)))
  const goTimeline = draftIds.filter((id) => !heldTimeline.has(id))
  const goMessageIds = new Set(goMessages.map((m) => m.id))
  const conversationIds = [...new Set(goMessages.map((m) => m.conversation_id))]
  // Every message of every touched conversation, paged: PostgREST caps a read
  // at 1,000 rows, and a short read here would delete a conversation that
  // still has messages (they cascade).
  const remaining = new Map<string, Msg[]>()
  for (const chunk of chunks(conversationIds, 50)) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from('crm_message').select(MSG_COLS).in('conversation_id', chunk).order('id', { ascending: true }).range(from, from + 999)
      if (error) throw new Error(`crm_message conversation read: ${error.message}`)
      for (const m of (data ?? []) as Msg[]) {
        if (goMessageIds.has(m.id)) continue
        remaining.set(m.conversation_id, [...(remaining.get(m.conversation_id) ?? []), m])
      }
      if (!data || data.length < 1000) break
    }
  }
  const emptied = conversationIds.filter((id) => !remaining.get(id)?.length)
  Object.assign(summary, {
    conversationModel: {
      draftCopies: copies.length,
      heldBecauseRepliedTo: copies.length - goMessages.length,
      conversationsTouched: conversationIds.length,
      conversationsLeftEmpty: emptied.length,
    },
  })

  if (apply && (drafts.length || moved.length)) {
    // Before-image first: every row this run changes or removes, whole, so it can be put back.
    const conversations: unknown[] = []
    const participants: unknown[] = []
    for (const chunk of chunks(conversationIds, 100)) {
      const c = await sb.from('crm_conversation').select('*').in('id', chunk)
      if (c.error) throw new Error(`crm_conversation read: ${c.error.message}`)
      conversations.push(...(c.data ?? []))
    }
    for (const chunk of chunks(emptied, 100)) {
      const p = await sb.from('crm_conversation_participant').select('*').in('conversation_id', chunk)
      if (p.error) throw new Error(`crm_conversation_participant read: ${p.error.message}`)
      participants.push(...(p.data ?? []))
    }
    const fullCopies: unknown[] = []
    for (const chunk of chunks([...goMessageIds])) {
      const m = await sb.from('crm_message').select('*').in('id', chunk)
      if (m.error) throw new Error(`crm_message read: ${m.error.message}`)
      fullCopies.push(...(m.data ?? []))
    }
    fs.writeFileSync(
      path.join(dir, 'before.json'),
      JSON.stringify({ crm_timeline: [...drafts, ...moved].map((c) => c.row), crm_message: fullCopies, crm_conversation: conversations, crm_conversation_participant: participants }),
    )

    let messagesDeleted = 0
    for (const chunk of chunks([...goMessageIds])) {
      const { error, count } = await sb.from('crm_message').delete({ count: 'exact' }).in('id', chunk)
      if (error) throw new Error(`crm_message delete: ${error.message}`)
      messagesDeleted += count ?? 0
    }
    let deleted = 0
    for (const chunk of chunks(goTimeline)) {
      const { error, count } = await sb.from('crm_timeline').delete({ count: 'exact' }).eq('source', 'gmail').in('id', chunk)
      if (error) throw new Error(`crm_timeline delete: ${error.message}`)
      deleted += count ?? 0
    }
    let conversationsDeleted = 0
    for (const chunk of chunks(emptied, 100)) {
      const { error, count } = await sb.from('crm_conversation').delete({ count: 'exact' }).in('id', chunk)
      if (error) throw new Error(`crm_conversation delete: ${error.message}`)
      conversationsDeleted += count ?? 0
    }
    // The rollups recompute_conversation_rollups() keeps, for the touched
    // conversations only (lib/crm/conversation-rollups.ts).
    let recomputed = 0
    for (const id of conversationIds) {
      const rollups = conversationRollups(remaining.get(id) ?? [])
      if (!rollups) continue
      const { error } = await sb.from('crm_conversation').update({ ...rollups, updated_at: new Date().toISOString() }).eq('id', id)
      if (error) throw new Error(`crm_conversation recompute ${id}: ${error.message}`)
      recomputed++
    }
    let repointed = 0
    for (const c of moved) {
      const payload = { ...(c.row.payload ?? {}), gmailId: c.newGmailId, threadId: c.newThreadId ?? (c.row.payload as { threadId?: string })?.threadId }
      const { error } = await sb.from('crm_timeline').update({ payload }).eq('id', c.row.id).eq('source', 'gmail')
      if (error) throw new Error(`crm_timeline repoint ${c.row.id}: ${error.message}`)
      repointed++
    }
    Object.assign(summary, { deleted, heldByReply: heldTimeline.size, messagesDeleted, conversationsDeleted, recomputed, repointed })
  }

  fs.writeFileSync(path.join(dir, 'summary.json'), JSON.stringify(summary, null, 2))
  console.log(JSON.stringify(summary, null, 2))
  console.log(`[timeline-drafts] wrote ${dir}`)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
