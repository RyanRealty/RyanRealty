/**
 * One-time repair: CRM timeline rows the Gmail sync wrote for email that was
 * not our brokers writing to that person.
 *
 *  1. Unsent drafts (docs/TC_MAIL_FILING_RULES.md "v4.2: an unsent draft is not
 *     mail"). The sync listed drafts beside sent mail, so a draft to a client sat
 *     on that client's timeline as `email_out` for an email nobody received.
 *  2. Copied-on mail (Matt 2026-10-02: "Copied on an email"). The sync wrote every
 *     person on To/Cc as `email_out` whoever sent the message, so a title
 *     company's closing email copying our client read as a broker writing to them.
 *
 * Both counted as a broker touching the person (lib/crm/response-clock.ts), in
 * speed-to-lead, contact attempts and the first-broker-action stamp.
 *
 *   npx tsx scripts/crm-timeline-mail-repair.ts           dry run (the default): reads Gmail and
 *                                                         the CRM, writes tmp/crm-timeline-mail-repair/<run>/,
 *                                                         changes nothing
 *   npx tsx scripts/crm-timeline-mail-repair.ts --apply   writes, after saving a before-image
 *
 * Every Gmail-sourced email row (crm_timeline source 'gmail', kind email_in /
 * email_out) is checked against its mailbox, one Gmail read per message:
 *
 *   ok       the message exists, is not a draft, and its kind is right: left alone
 *   draft    Gmail still holds it as a draft: it reached no one. Deleted.
 *   copied   an `email_out` row whose message none of our brokers sent (not SENT in
 *            the mailbox, From not ours: lib/crm/gmail-timeline-kind.ts). Becomes
 *            `email_cc`, with the sender in payload.from.
 *   moved    the id is gone, and its thread holds the same Message-ID as a message
 *            that is not a draft (an autosave id the send replaced): payload.gmailId
 *            is repointed to the surviving message.
 *   missing  the id is gone and nothing with its Message-ID is left in its thread (a
 *            discarded draft, or mail deleted for good: not provable): left alone
 *   error    Gmail failed after retries: left alone
 *
 * The conversation model: the July 2026 backfill (migration 20260716210000) copied
 * the timeline into crm_message, so most of these rows also sit in the CRM inbox as
 * our outbound email. A `draft` or `copied` row's copy is deleted (neither is a
 * message between us and the person); a conversation left with no message is
 * deleted (its participants cascade); the touched conversations' rollups are
 * recomputed the way recompute_conversation_rollups() does
 * (lib/crm/conversation-rollups.ts), and no other conversation is touched. A copy
 * another message replies to stays, with its timeline row unchanged.
 *
 * The first-broker-action stamp (crm_people.custom.first_broker_action_at) of a
 * person whose stamp came from a `draft` or `copied` row is recomputed from the
 * rows left, through isHumanTouch, the one definition of a human touch; cleared
 * when nothing is left. A journey stage that stamp advanced is not moved back
 * (later events may have moved it): counted in the summary.
 *
 * Gmail is opened read-only. Every row --apply changes or removes is written whole
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

type Row = { id: number; person_id: number; kind: string; ts: string; broker: string | null; source: string; dedupe_key: string; payload: Record<string, unknown> | null }
type Verdict = 'ok' | 'draft' | 'copied' | 'moved' | 'missing' | 'error'
type Classified = { row: Row; mailbox: string | null; gmailId: string | null; verdict: Verdict; from?: string | null; newGmailId?: string; newThreadId?: string; note?: string }

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

/** First address in a From header. */
function firstAddress(header: string | null | undefined): string | null {
  const h = String(header ?? '')
  const m = /<([^>]+)>/.exec(h)
  const a = (m ? m[1] : h.split(',')[0] ?? '').trim().toLowerCase()
  return a.includes('@') ? a : null
}

async function pool<T>(items: readonly T[], n: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) await fn(items[next++])
    }),
  )
}

const chunks = <T,>(xs: readonly T[], n = 200): T[][] => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n))

async function main() {
  const { createServiceClient } = await import('@/lib/supabase/service')
  const { getGmailFor } = await import('@/lib/crm/gmail')
  const { isUnsentDraft } = await import('@/lib/crm/gmail-drafts')
  const { sentByUs } = await import('@/lib/crm/gmail-timeline-kind')
  const { conversationRollups } = await import('@/lib/crm/conversation-rollups')
  const { HUMAN_TOUCH_KINDS, firstHumanTouchRow } = await import('@/lib/crm/response-clock')
  const sb = createServiceClient()

  const rows: Row[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from('crm_timeline')
      .select('id, person_id, kind, ts, broker, source, dedupe_key, payload')
      .eq('source', 'gmail')
      .in('kind', ['email_in', 'email_out'])
      .order('id', { ascending: true })
      .range(from, from + 999)
    if (error) throw new Error(`crm_timeline read: ${error.message}`)
    rows.push(...((data ?? []) as Row[]))
    if (!data || data.length < 1000) break
  }
  console.log(`[timeline-mail] ${rows.length} Gmail email rows on the CRM timeline`)

  const gmailByBox = new Map<string, ReturnType<typeof getGmailFor>>()
  const gmail = (box: string) => {
    if (!gmailByBox.has(box)) gmailByBox.set(box, getGmailFor(box, ['https://www.googleapis.com/auth/gmail.readonly']))
    return gmailByBox.get(box)!
  }
  type MessageState = { state: 'present' | 'gone' | 'error'; draft?: boolean; ours?: boolean; from?: string | null; note?: string }
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
            const m = await g.users.messages.get({ userId: 'me', id, format: 'metadata', metadataHeaders: ['From'] })
            const fromHeader = m.data.payload?.headers?.find((h) => h.name?.toLowerCase() === 'from')?.value
            const from = firstAddress(fromHeader)
            return {
              state: 'present',
              draft: isUnsentDraft(m.data.labelIds),
              ours: sentByUs({ labelIds: m.data.labelIds, from: from ? [from] : [] }),
              from,
            }
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
      if (s.state === 'error') c = { row, mailbox, gmailId, verdict: 'error', note: s.note }
      else if (s.state === 'present') {
        if (s.draft) c = { row, mailbox, gmailId, verdict: 'draft' }
        else if (row.kind === 'email_out' && !s.ours) c = { row, mailbox, gmailId, verdict: 'copied', from: s.from ?? null }
        else c = { row, mailbox, gmailId, verdict: 'ok' }
      } else {
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
    if (++done % 2000 === 0) console.log(`[timeline-mail] ${done}/${rows.length}`)
  })

  const tally = (xs: readonly Classified[], pick: (c: Classified) => string) =>
    xs.reduce<Record<string, number>>((m, c) => ((m[pick(c)] = (m[pick(c)] ?? 0) + 1), m), {})
  const drafts = out.filter((c) => c.verdict === 'draft')
  const copied = out.filter((c) => c.verdict === 'copied')
  const moved = out.filter((c) => c.verdict === 'moved')
  const fixed = [...drafts, ...copied]
  const summary: Record<string, unknown> = {
    mode: apply ? 'apply' : 'dry-run',
    rows: rows.length,
    gmailMessagesRead: messageCache.size,
    threadsRead: threadCache.size,
    byVerdict: tally(out, (c) => c.verdict),
    byVerdictKind: tally(out, (c) => `${c.verdict}/${c.row.kind}`),
    byMailbox: tally(out, (c) => `${c.verdict}/${c.mailbox}`),
    draftPeople: new Set(drafts.map((c) => c.row.person_id)).size,
    copiedPeople: new Set(copied.map((c) => c.row.person_id)).size,
    copiedSenderDomains: Object.fromEntries(
      Object.entries(tally(copied, (c) => (c.from ?? '?').split('@')[1] ?? '?'))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15),
    ),
  }

  // ── the conversation model ─────────────────────────────────────────────
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
  const fixedIds = fixed.map((c) => c.row.id)
  const msgCopies: Msg[] = []
  for (const chunk of chunks(fixedIds)) {
    const { data, error } = await sb.from('crm_message').select(MSG_COLS).in('timeline_id', chunk).limit(1000)
    if (error) throw new Error(`crm_message read: ${error.message}`)
    // 200 timeline ids, at most a few copies each: far under the cap, and checked.
    if ((data ?? []).length >= 1000) throw new Error('crm_message read hit the 1,000-row cap; narrow the chunk')
    msgCopies.push(...((data ?? []) as Msg[]))
  }
  const repliedTo = new Set<string>()
  for (const chunk of chunks(msgCopies.map((m) => m.id))) {
    const { data, error } = await sb.from('crm_message').select('in_reply_to_id').in('in_reply_to_id', chunk).limit(1000)
    if (error) throw new Error(`crm_message reply read: ${error.message}`)
    if ((data ?? []).length >= 1000) throw new Error('crm_message reply read hit the 1,000-row cap; narrow the chunk')
    for (const r of data ?? []) repliedTo.add(String(r.in_reply_to_id))
  }
  const goMessages = msgCopies.filter((m) => !repliedTo.has(m.id))
  const goMessageIds = new Set(goMessages.map((m) => m.id))
  const heldTimeline = new Set(msgCopies.filter((m) => repliedTo.has(m.id)).map((m) => Number(m.timeline_id)))
  const deleteTimeline = drafts.map((c) => c.row.id).filter((id) => !heldTimeline.has(id))
  const recastTimeline = copied.filter((c) => !heldTimeline.has(c.row.id))
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

  // ── first-broker-action stamps taken from a row this run fixes ───────────
  type Person = { id: number; custom: Record<string, unknown> | null }
  const fixedByPerson = new Map<number, Classified[]>()
  for (const c of fixed) fixedByPerson.set(c.row.person_id, [...(fixedByPerson.get(c.row.person_id) ?? []), c])
  const people: Person[] = []
  for (const chunk of chunks([...fixedByPerson.keys()])) {
    const { data, error } = await sb.from('crm_people').select('id, custom').in('id', chunk)
    if (error) throw new Error(`crm_people read: ${error.message}`)
    people.push(...((data ?? []) as Person[]))
  }
  const stampedFromFixed = people.filter((p) => {
    const at = (p.custom ?? {}).first_broker_action_at
    if (typeof at !== 'string' || !at) return false
    return (fixedByPerson.get(p.id) ?? []).some((c) => Date.parse(c.row.ts) === Date.parse(at))
  })

  Object.assign(summary, {
    conversationModel: {
      copies: msgCopies.length,
      heldBecauseRepliedTo: msgCopies.length - goMessages.length,
      conversationsTouched: conversationIds.length,
      conversationsLeftEmpty: emptied.length,
    },
    firstBrokerActionStampsFromFixedRows: stampedFromFixed.length,
  })

  const runId = new Date().toISOString().replace(/[:.]/g, '-')
  const dir = path.join('tmp/crm-timeline-mail-repair', `${apply ? 'apply' : 'dry-run'}-${runId}`)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(
    path.join(dir, 'rows.jsonl'),
    out
      .filter((c) => c.verdict !== 'ok')
      .map((c) =>
        JSON.stringify({ id: c.row.id, person: c.row.person_id, kind: c.row.kind, ts: c.row.ts, mailbox: c.mailbox, gmailId: c.gmailId, verdict: c.verdict, from: c.from ?? null, newGmailId: c.newGmailId ?? null, note: c.note ?? null }),
      )
      .join('\n') + '\n',
  )

  if (apply && (fixed.length || moved.length)) {
    // Before-image first: every row this run changes or removes, whole.
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
      JSON.stringify({
        crm_timeline: [...fixed, ...moved].map((c) => c.row),
        crm_message: fullCopies,
        crm_conversation: conversations,
        crm_conversation_participant: participants,
        crm_people_custom: stampedFromFixed,
      }),
    )

    let messagesDeleted = 0
    for (const chunk of chunks([...goMessageIds])) {
      const { error, count } = await sb.from('crm_message').delete({ count: 'exact' }).in('id', chunk)
      if (error) throw new Error(`crm_message delete: ${error.message}`)
      messagesDeleted += count ?? 0
    }
    let deleted = 0
    for (const chunk of chunks(deleteTimeline)) {
      const { error, count } = await sb.from('crm_timeline').delete({ count: 'exact' }).eq('source', 'gmail').in('id', chunk)
      if (error) throw new Error(`crm_timeline delete: ${error.message}`)
      deleted += count ?? 0
    }
    let recast = 0
    for (const c of recastTimeline) {
      const payload = { ...(c.row.payload ?? {}), from: c.from ?? null }
      const { error } = await sb.from('crm_timeline').update({ kind: 'email_cc', payload }).eq('id', c.row.id).eq('source', 'gmail').eq('kind', 'email_out')
      if (error) throw new Error(`crm_timeline recast ${c.row.id}: ${error.message}`)
      recast++
    }
    let conversationsDeleted = 0
    for (const chunk of chunks(emptied, 100)) {
      const { error, count } = await sb.from('crm_conversation').delete({ count: 'exact' }).in('id', chunk)
      if (error) throw new Error(`crm_conversation delete: ${error.message}`)
      conversationsDeleted += count ?? 0
    }
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
    // Stamps: recomputed from the rows left, oldest first, paged.
    let restamped = 0
    let cleared = 0
    for (const p of stampedFromFixed) {
      type TouchRow = { kind: string; ts: string; broker: string | null; source: string | null; payload: Record<string, unknown> | null }
      let touch: TouchRow | null = null
      for (let offset = 0; offset < 4000 && !touch; offset += 200) {
        const { data, error } = await sb
          .from('crm_timeline')
          .select('kind, ts, broker, source, payload')
          .eq('person_id', p.id)
          .in('kind', [...HUMAN_TOUCH_KINDS])
          .order('ts', { ascending: true })
          .range(offset, offset + 199)
        if (error) throw new Error(`crm_timeline touch read ${p.id}: ${error.message}`)
        touch = firstHumanTouchRow((data ?? []) as TouchRow[])
        if (!data || data.length < 200) break
      }
      const custom = { ...(p.custom ?? {}) }
      if (touch) {
        custom.first_broker_action_at = touch.ts
        custom.first_broker_action_kind = touch.kind
        if (touch.broker) custom.first_broker_action_broker = touch.broker
        else delete custom.first_broker_action_broker
        restamped++
      } else {
        delete custom.first_broker_action_at
        delete custom.first_broker_action_kind
        delete custom.first_broker_action_broker
        cleared++
      }
      const { error } = await sb.from('crm_people').update({ custom, updated_at: new Date().toISOString() }).eq('id', p.id)
      if (error) throw new Error(`crm_people stamp ${p.id}: ${error.message}`)
    }
    Object.assign(summary, {
      applied: {
        timelineDeleted: deleted,
        timelineRecastToEmailCc: recast,
        heldBecauseRepliedTo: heldTimeline.size,
        conversationMessagesDeleted: messagesDeleted,
        conversationsDeleted,
        conversationsRecomputed: recomputed,
        repointed,
        stampsRecomputed: restamped,
        stampsCleared: cleared,
      },
    })
  }

  fs.writeFileSync(path.join(dir, 'summary.json'), JSON.stringify(summary, null, 2))
  console.log(JSON.stringify(summary, null, 2))
  console.log(`[timeline-mail] wrote ${dir}`)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
