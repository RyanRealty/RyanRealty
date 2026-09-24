/**
 * The Vault mail index: read a broker-mailbox message through the service
 * account, decide its deal with lib/tc/mail-rules.ts, keep a row for every
 * transaction email, file its documents, and record offers. Brokers never file
 * mail by hand; a person only answers the queue when the rules cannot decide.
 *
 * Entry points
 *  - indexGmailMessage: one message (the 15-minute CRM Gmail sync calls this).
 *  - sweepDealMail: search every mailbox for one deal's address, escrow and MLS
 *    numbers, all history. Catches mail that arrived before the deal existed.
 *  - sweepTransactionMail: search every mailbox for offer / counter / escrow
 *    mail by subject, so offers on properties with no file are still kept.
 *  - rematchQueuedMail: re-decide queued rows after deals or contacts change.
 *
 * Writes: tc_mail_messages, tc_documents (via fileOntoDeal), tc_events,
 * tc_offers. Fail-open per message: one bad message never stops a sweep.
 */
import 'server-only'
import { createHash } from 'node:crypto'
import type { gmail_v1 } from 'googleapis'
import { createServiceClient } from '@/lib/supabase/service'
import { CRM_MAILBOXES, getGmailFor } from '@/lib/crm/gmail'
import {
  MAIL_RULES_VERSION,
  dealOpenAt,
  decideMailFiling,
  filesToOpenFromQueue,
  mentionsDealAddress,
  isHouseAddress,
  isTransactionFormAttachment,
  normalizeEmail,
  offerFromMail,
  parseDealAddress,
  pickCycleForMail,
  type DealFacts,
  type MailAttachmentFacts,
  type MailDecision,
  type MailFacts,
  type ThreadAnchor,
} from '@/lib/tc/mail-rules'
import {
  applyModelStageDecision,
  askModelStage,
  candidateDealsForModel,
  worthModelStage,
} from '@/lib/tc/mail-model-stage'
import {
  INDEX_METADATA_HEADERS,
  bulkSignals,
  extractBody,
  header,
  looksMultipartMixed,
  messageKeyFor,
  parseAddressList,
  pdfParts,
  sentAtOf,
  threadKeyFor,
} from '@/lib/tc/gmail-message'
import { readPdfPagesText, type PdfTextRead } from '@/lib/tc/pdf-page-text'
import { identifyFormFromName, identifyFormFromText } from '@/lib/tc/form-identity'
import { classifyFromFormAndText } from '@/lib/tc/execution-state'
import { fileOntoDeal, type FileCommsAttachment } from '@/lib/tc/file-comms-write'
import { existingDocumentIdByHash } from '@/lib/tc/document-dedupe'
import { fileNameFromBrokerSlug } from '@/lib/tc/deal-scope'
import { parseCityFromAddress, propertyKeyForInhouseDeal } from '@/lib/tc/deal-people'
import { fileShapeForRepresentation } from '@/lib/tc/listing-actions'

type SB = ReturnType<typeof createServiceClient>

const READONLY = ['https://www.googleapis.com/auth/gmail.readonly']
const MAX_PDFS = 5
const MAX_PDF_BYTES = 20 * 1024 * 1024
const STORED: ReadonlySet<string> = new Set(['filed', 'ambiguous', 'unfiled_transaction'])

// ── the deal universe ─────────────────────────────────────────────────────

export type MailUniverse = {
  deals: DealFacts[]
  /** Deals where we represent the seller: offers get recorded here. */
  listingSide: Set<string>
  /** Seller client emails per deal: an outbound to one of these presents an offer. */
  sellerEmails: Map<string, Set<string>>
}

async function allRows<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await q(from, from + 999)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return out
}

/** Every deal, all stages: closed files still take their post-close mail. */
export async function loadMailUniverse(sb: SB = createServiceClient()): Promise<MailUniverse> {
  type DealRow = { id: string; address: string; city: string | null; stage: string }
  type CycleRow = {
    id: string
    deal_id: string
    kind: string
    status: string | null
    mls_number: string | null
    escrow_number: string | null
    listing_date: string | null
    contract_acceptance_date: string | null
    escrow_closing_date: string | null
    actual_closing_date: string | null
    dead_date: string | null
    created_at: string | null
  }
  const [deals, cycles, contacts, people] = await Promise.all([
    allRows<DealRow>((a, b) => sb.from('tc_deals').select('id, address, city, stage').order('id').range(a, b)),
    allRows<CycleRow>((a, b) =>
      sb
        .from('tc_cycles')
        .select(
          'id, deal_id, kind, status, mls_number, escrow_number, listing_date, contract_acceptance_date, escrow_closing_date, actual_closing_date, dead_date, created_at',
        )
        .order('id')
        .range(a, b),
    ),
    allRows<{ deal_id: string; email: string | null }>((a, b) =>
      sb.from('tc_deal_contacts').select('deal_id, email').not('email', 'is', null).order('id').range(a, b),
    ),
    allRows<{ deal_id: string; person_id: number; role: string }>((a, b) =>
      sb.from('tc_deal_people').select('deal_id, person_id, role').order('id').range(a, b),
    ),
  ])

  const personIds = [...new Set(people.map((p) => Number(p.person_id)))]
  const emailsByPerson = new Map<number, string[]>()
  for (let i = 0; i < personIds.length; i += 300) {
    const { data } = await sb
      .from('crm_contact_points')
      .select('person_id, value')
      .eq('kind', 'email')
      .in('person_id', personIds.slice(i, i + 300))
    for (const r of data ?? []) {
      const list = emailsByPerson.get(Number(r.person_id)) ?? []
      list.push(normalizeEmail(String(r.value)))
      emailsByPerson.set(Number(r.person_id), list)
    }
  }

  const cyclesByDeal = new Map<string, CycleRow[]>()
  for (const c of cycles) {
    const list = cyclesByDeal.get(c.deal_id) ?? []
    list.push(c)
    cyclesByDeal.set(c.deal_id, list)
  }
  const listingSide = new Set<string>()
  const sellerEmails = new Map<string, Set<string>>()
  const out: DealFacts[] = deals.map((d) => {
    const dealCycles = cyclesByDeal.get(d.id) ?? []
    if (dealCycles.some((c) => c.kind === 'listing')) listingSide.add(d.id)
    const partyEmails = new Set<string>()
    for (const p of people.filter((x) => x.deal_id === d.id)) {
      for (const e of emailsByPerson.get(Number(p.person_id)) ?? []) {
        if (isHouseAddress(e)) continue
        partyEmails.add(e)
        if (p.role === 'seller') {
          listingSide.add(d.id)
          const set = sellerEmails.get(d.id) ?? new Set<string>()
          set.add(e)
          sellerEmails.set(d.id, set)
        }
      }
    }
    const contactEmails = new Set(
      contacts
        .filter((c) => c.deal_id === d.id)
        .map((c) => normalizeEmail(c.email))
        // A house address never identifies a deal (the 2026-08-23 misfile).
        .filter((e) => e.includes('@') && !isHouseAddress(e)),
    )
    return {
      dealId: d.id,
      address: d.address,
      city: d.city,
      stage: d.stage,
      cycles: dealCycles.map((c) => ({
        id: c.id,
        kind: c.kind,
        status: c.status,
        mlsNumber: c.mls_number,
        escrowNumber: c.escrow_number,
        listingDate: c.listing_date,
        acceptanceDate: c.contract_acceptance_date,
        closeDate: c.actual_closing_date ?? c.escrow_closing_date,
        deadDate: c.dead_date,
        createdAt: c.created_at,
      })),
      partyEmails: [...partyEmails],
      contactEmails: [...contactEmails],
    }
  })
  return { deals: out, listingSide, sellerEmails }
}

// ── thread anchors ────────────────────────────────────────────────────────

async function threadAnchor(sb: SB, threadKey: string, gmailThreadId: string | null, messageKey: string): Promise<ThreadAnchor | null> {
  const pick = (rows: Array<{ deal_id: string | null; match_method: string | null; message_key: string }> | null) =>
    (rows ?? []).find((r) => r.deal_id && r.message_key !== messageKey) ?? null
  const byKey = await sb
    .from('tc_mail_messages')
    .select('deal_id, match_method, message_key')
    .eq('status', 'filed')
    .eq('thread_key', threadKey)
    .order('sent_at', { ascending: false })
    .limit(5)
  let hit = pick(byKey.data)
  if (!hit && gmailThreadId) {
    const byGmail = await sb
      .from('tc_mail_messages')
      .select('deal_id, match_method, message_key')
      .eq('status', 'filed')
      .contains('gmail_thread_ids', [gmailThreadId])
      .order('sent_at', { ascending: false })
      .limit(5)
    hit = pick(byGmail.data)
  }
  return hit?.deal_id ? { dealId: hit.deal_id, method: hit.match_method ?? 'thread' } : null
}

// ── one message ───────────────────────────────────────────────────────────

export type IndexResult = {
  messageKey: string
  status: MailDecision['status'] | 'kept_manual' | 'error'
  stored: boolean
  dealId: string | null
  documents: number
  offerId: string | null
  decision: MailDecision | null
  subject: string | null
  error?: string
  /** Gmail thread id (not the RFC thread_key) — recorded on the review row. */
  threadId?: string | null
  /** ISO. The message's own internalDate, recorded on the review row. */
  internalAt?: string | null
  /** Set when lib/tc/mail-model-stage.ts ran on this message; drives the review row's stage/reason. */
  modelStage?: { confidence: number; reason: string; filed: boolean } | null
}

type ReadAttachment = {
  ref: { filename: string; attachmentId: string }
  bytes: Buffer
  read: PdfTextRead | null
  facts: MailAttachmentFacts
}

function factsFromHeaders(msg: gmail_v1.Schema$Message, body: string, attachments: MailAttachmentFacts[]): MailFacts & { fromName: string | null } {
  const headers = msg.payload?.headers
  const from = parseAddressList(header(headers, 'From'))
  const { bulk, autoReply } = bulkSignals(headers)
  return {
    messageKey: messageKeyFor(header(headers, 'Message-ID'), String(msg.id)),
    sentAt: sentAtOf(msg),
    from: from.map((a) => a.email),
    fromName: from[0]?.name || null,
    to: parseAddressList(header(headers, 'To')).map((a) => a.email),
    cc: parseAddressList(header(headers, 'Cc')).map((a) => a.email),
    subject: header(headers, 'Subject') ?? '',
    body,
    attachments,
    bulkHeaders: bulk,
    autoReply,
  }
}

async function readAttachments(
  gmail: gmail_v1.Gmail,
  msg: gmail_v1.Schema$Message,
  wantAll: boolean,
): Promise<ReadAttachment[]> {
  const refs = pdfParts(msg.payload).filter((p) => p.size <= MAX_PDF_BYTES)
  const chosen = (wantAll ? refs : refs.filter((r) => isTransactionFormAttachment({ name: r.filename }))).slice(0, MAX_PDFS)
  const out: ReadAttachment[] = []
  for (const ref of chosen) {
    try {
      const att = await gmail.users.messages.attachments.get({ userId: 'me', messageId: String(msg.id), id: ref.attachmentId })
      if (!att.data.data) continue
      const bytes = Buffer.from(att.data.data, 'base64url')
      let read: PdfTextRead | null = null
      try {
        read = await readPdfPagesText(bytes)
      } catch (err) {
        console.warn('[mail-index] pdf read', ref.filename, err instanceof Error ? err.message : err)
      }
      const text = read?.text ?? ''
      const form = text ? identifyFormFromText(text) : identifyFormFromName(ref.filename)
      const executionState = text
        ? classifyFromFormAndText({
            form: { documentName: ref.filename, pageText: text },
            pageText: text,
            ourRole: 'unknown',
            textComplete: read?.complete ?? false,
          })
        : null
      out.push({
        ref,
        bytes,
        read,
        facts: {
          name: ref.filename,
          text: text.slice(0, 20_000),
          formName: form?.name ?? null,
          formNumber: form?.oref ?? null,
          executionState,
        },
      })
    } catch (err) {
      console.warn('[mail-index] attachment fetch', ref.filename, err instanceof Error ? err.message : err)
    }
  }
  return out
}

export type IndexInput = {
  gmail: gmail_v1.Gmail
  mailbox: string
  brokerSlug: string
  gmailId: string
  universe: MailUniverse
  meta?: gmail_v1.Schema$Message | null
  dryRun?: boolean
  /**
   * Ask lib/tc/mail-model-stage.ts about a leftover `not_deal` /
   * `unfiled_transaction` message before giving up on it. Off by default: it
   * is one paid Grok call per leftover message, so a caller opts in
   * deliberately (never on a dry run — the model stage does not run then).
   */
  modelStage?: boolean
  sb?: SB
}

/**
 * Index one broker-mailbox message. Cheap first: headers and the snippet
 * decide whether the full message is worth reading. Mail the rules call
 * ordinary is counted, not stored.
 */
async function computeIndexResult(input: IndexInput): Promise<IndexResult> {
  const sb = input.sb ?? createServiceClient()
  const { gmail, universe } = input
  let messageKey = `gmail:${input.gmailId}`
  let threadId: string | null = null
  let internalAt: string | null = null
  try {
    const meta =
      input.meta?.payload?.headers?.length
        ? input.meta
        : (
            await gmail.users.messages.get({
              userId: 'me',
              id: input.gmailId,
              format: 'metadata',
              metadataHeaders: [...INDEX_METADATA_HEADERS],
            })
          ).data
    threadId = meta.threadId ?? null
    const headers = meta.payload?.headers
    const base = factsFromHeaders(meta, meta.snippet ?? '', [])
    messageKey = base.messageKey
    internalAt = base.sentAt
    const threadKey = threadKeyFor(headers, meta.threadId)
    const anchor = await threadAnchor(sb, threadKey, meta.threadId ?? null, messageKey)
    const empty = (decision: MailDecision | null, status: IndexResult['status'], modelStage: IndexResult['modelStage'] = null): IndexResult => ({
      messageKey,
      status,
      stored: false,
      dealId: null,
      documents: 0,
      offerId: null,
      decision,
      subject: base.subject,
      threadId,
      internalAt,
      modelStage,
    })

    // Pass 1: headers + snippet. Bulk mail stops here.
    const d1 = decideMailFiling({ facts: base, deals: universe.deals, thread: anchor })
    if (d1.status === 'bulk') return empty(d1, 'bulk')
    const worthReading =
      d1.status !== 'not_deal' || d1.candidates.length > 0 || d1.category !== 'general' || looksMultipartMixed(headers)
    if (!worthReading) return empty(d1, 'not_deal')

    // Pass 2: full body + attachment names.
    const full = (await gmail.users.messages.get({ userId: 'me', id: input.gmailId, format: 'full' })).data
    threadId = full.threadId ?? threadId
    const body = extractBody(full.payload)
    const names = pdfParts(full.payload).map((p) => ({ name: p.filename }))
    const f2 = factsFromHeaders(full, body, names)
    const d2 = decideMailFiling({ facts: f2, deals: universe.deals, thread: anchor })
    const transactionNames = names.some((n) => isTransactionFormAttachment(n))
    if (!STORED.has(d2.status) && !transactionNames) return empty(d2, d2.status)

    // Pass 3: read the PDFs. Their text can carry the address or escrow number
    // the subject left out, and it says whether a form is fully executed.
    const read = names.length ? await readAttachments(gmail, full, STORED.has(d2.status)) : []
    const f3: MailFacts = { ...f2, attachments: names.map((n) => read.find((r) => r.ref.filename === n.name)?.facts ?? n) }
    internalAt = f3.sentAt
    let decision = decideMailFiling({ facts: f3, deals: universe.deals, thread: anchor })
    if (input.dryRun) {
      return { ...empty(decision, decision.status), dealId: decision.dealId }
    }

    // Model stage: a leftover not_deal/unfiled_transaction that still looks
    // transactional gets one structured call before it is finally left or
    // queued. Never runs on a dry run (above) and never files on its own
    // word below 0.9 confidence — it only ever files or queues, never dismisses.
    let modelStage: IndexResult['modelStage'] = null
    let decidedBy: 'system' | 'model' = 'system'
    const choosing = decision.status === 'ambiguous'
    if (
      input.modelStage &&
      worthModelStage({
        status: decision.status,
        category: decision.category,
        attachments: f3.attachments,
        propertyHint: decision.propertyHint,
        candidateCount: decision.candidates.length,
      })
    ) {
      try {
        // Ambiguous: the rules narrowed it to the deals the sender is on; the
        // model reads the message and picks one of those, or none.
        const tied = new Set(decision.candidates.map((c) => c.dealId))
        const candidates = choosing
          ? candidateDealsForModel(universe.deals.filter((d) => tied.has(d.dealId)), f3.sentAt, () => true)
          : candidateDealsForModel(universe.deals, f3.sentAt, dealOpenAt)
        const modelDecision = await askModelStage({ facts: f3, candidates, mode: choosing ? 'choose' : 'open' })
        let applied = applyModelStageDecision(modelDecision)
        // Choosing never opens a new transaction and never leaves the tied set.
        if (choosing && (applied.action !== 'file' || !tied.has(applied.dealId))) applied = { action: 'leave' }
        modelStage = { confidence: modelDecision.confidence, reason: modelDecision.reason, filed: false }
        if (choosing && applied.action === 'leave') {
          decision = { ...decision, reasons: [...decision.reasons, `model: ${modelDecision.reason}`] }
        }
        if (applied.action === 'file') {
          const deal = universe.deals.find((d) => d.dealId === applied.dealId)
          const cycleId = deal ? pickCycleForMail(deal.cycles, f3.sentAt, decision.category) : null
          if (deal && cycleId) {
            decision = { ...decision, status: 'filed', dealId: applied.dealId, cycleId, method: null, reasons: [...decision.reasons, `model: ${modelDecision.reason}`] }
            decidedBy = 'model'
            modelStage = { ...modelStage, filed: true }
          }
        } else if (applied.action === 'queue') {
          decision = {
            ...decision,
            status: applied.status,
            dealId: applied.dealId ?? decision.dealId,
            reasons: [...decision.reasons, `model: ${modelDecision.reason}`],
          }
        }
      } catch (err) {
        console.warn('[mail-index] model stage failed (fail-open)', err instanceof Error ? err.message : err)
      }
    }
    if (!STORED.has(decision.status)) return empty(decision, decision.status, modelStage)

    // ── keep the row ──
    const ref = { mailbox: input.mailbox, broker: input.brokerSlug, gmail_id: input.gmailId, thread_id: full.threadId ?? null }
    const { data: existing } = await sb
      .from('tc_mail_messages')
      .select('id, decided_by, status, deal_id, gmail_refs, gmail_thread_ids, offer_id')
      .eq('message_key', messageKey)
      .maybeSingle()
    const refs = [...((existing?.gmail_refs as unknown[] | null) ?? [])] as Array<Record<string, unknown>>
    if (!refs.some((r) => r.mailbox === ref.mailbox && r.gmail_id === ref.gmail_id)) refs.push(ref)
    const threadIds = [...new Set([...((existing?.gmail_thread_ids as string[] | null) ?? []), ...(full.threadId ? [full.threadId] : [])])]
    if (existing && existing.decided_by !== 'system') {
      await sb.from('tc_mail_messages').update({ gmail_refs: refs, gmail_thread_ids: threadIds, updated_at: new Date().toISOString() }).eq('id', existing.id)
      return { ...empty(decision, 'kept_manual', modelStage), stored: true, dealId: existing.deal_id ?? null }
    }
    const attachmentsJson = read.map((r) => ({
      name: r.facts.name,
      bytes: r.bytes.byteLength,
      form_number: r.facts.formNumber ?? null,
      form_name: r.facts.formName ?? null,
      execution_state: r.facts.executionState ?? null,
      text_head: (r.facts.text ?? '').slice(0, 2000),
      document_id: null as string | null,
    }))
    for (const n of names) {
      if (!read.some((r) => r.ref.filename === n.name)) attachmentsJson.push({ name: n.name, bytes: 0, form_number: null, form_name: null, execution_state: null, text_head: '', document_id: null })
    }
    const row = {
      message_key: messageKey,
      rfc_message_id: header(full.payload?.headers, 'Message-ID'),
      thread_key: threadKey,
      gmail_refs: refs,
      gmail_thread_ids: threadIds,
      direction: decision.direction,
      sent_at: f3.sentAt,
      from_email: f3.from[0] ?? null,
      from_name: f2.fromName,
      to_emails: f3.to,
      cc_emails: f3.cc,
      subject: f3.subject || null,
      snippet: full.snippet ?? null,
      body_excerpt: body.slice(0, 8000),
      attachments: attachmentsJson,
      category: decision.category,
      status: decision.status,
      deal_id: decision.dealId,
      cycle_id: decision.cycleId,
      match_method: decision.method,
      match_score: decision.score,
      match_detail: { reasons: decision.reasons, candidates: decision.candidates, anchor },
      property_hint: decision.propertyHint,
      rules_version: MAIL_RULES_VERSION,
      decided_by: decidedBy,
      decided_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    const { data: saved, error: saveErr } = await sb
      .from('tc_mail_messages')
      .upsert(withoutNul(row), { onConflict: 'message_key' })
      .select('id')
      .single()
    if (saveErr || !saved) throw new Error(`index row: ${saveErr?.message ?? 'no row'}`)
    const rowId = String(saved.id)

    if (decision.status !== 'filed' || !decision.dealId || !decision.cycleId) {
      return { ...empty(decision, decision.status, modelStage), stored: true }
    }

    // ── file it ──
    const filed = await fileMessageDocuments({
      sb,
      rowId,
      decision,
      facts: f3,
      read,
      mailbox: input.mailbox,
      brokerSlug: input.brokerSlug,
      threadKey,
      universe,
      fromName: f2.fromName,
      attachmentsJson,
    })
    return {
      messageKey,
      status: 'filed',
      stored: true,
      dealId: decision.dealId,
      documents: filed.documents,
      offerId: filed.offerId,
      decision,
      subject: f3.subject,
      threadId,
      internalAt,
      modelStage,
    }
  } catch (err) {
    return {
      messageKey,
      status: 'error',
      stored: false,
      dealId: null,
      documents: 0,
      offerId: null,
      decision: null,
      subject: null,
      error: err instanceof Error ? err.message : String(err),
      threadId,
      internalAt,
      modelStage: null,
    }
  }
}

/**
 * Postgres text and jsonb reject U+0000, which PDF text layers and some mail
 * bodies carry ("unsupported Unicode escape sequence"). Strip it from every
 * string in a row before it is written.
 */
export function withoutNul<T>(value: T): T {
  if (typeof value === 'string') return value.replace(/\u0000/g, '') as T
  if (Array.isArray(value)) return value.map((v) => withoutNul(v)) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, withoutNul(v)])) as T
  }
  return value
}

/**
 * A short, sanitized reason for tc_mail_reviews. A not_deal/bulk row never
 * quotes the subject or body: `decideMailFiling` always pushes a generic,
 * count-only reason as the LAST entry before a not_deal/bulk return (see
 * lib/tc/mail-rules.ts), so taking the tail of `reasons` is safe by
 * construction — never join the whole array, which can carry an earlier,
 * subject-derived entry for a message that turned out transactional instead.
 */
export function reviewReasonFor(input: { status: IndexResult['status']; decision: MailDecision | null; error?: string; deals: readonly DealFacts[] }): string {
  const { status, decision, error, deals } = input
  if (status === 'error') return `error: ${(error ?? 'unknown error').slice(0, 280)}`
  const base = decision?.reasons.at(-1) ?? 'no reason recorded'
  if (status === 'filed' || status === 'kept_manual') {
    const deal = decision?.dealId ? deals.find((d) => d.dealId === decision.dealId) : undefined
    return `${status}: ${base}${deal ? ` on ${deal.address}` : ''}`.slice(0, 400)
  }
  return `${status}: ${base}`.slice(0, 400)
}

/** Which part of the pipeline decided this outcome. */
export function reviewStageFor(decision: MailDecision | null, modelStage: IndexResult['modelStage'] | undefined): 'rules' | 'thread' | 'model' {
  if (modelStage) return 'model'
  if (decision?.method === 'thread') return 'thread'
  return 'rules'
}

export type ReviewStage = 'rules' | 'thread' | 'model' | 'person'

/**
 * Record a review row for every outcome `indexGmailMessage` returns — the
 * "someone reviewed this" ledger an OREA audit needs. Fail-open and cheap:
 * one upsert, never blocks the caller. `stage` overrides the automatic
 * rules/thread/model inference — callers that file a message a PERSON chose
 * (fileIndexedMessageToDeal) always pass `'person'`, since that message's
 * `decision.method` may itself read 'thread' from the rules pass underneath.
 */
async function writeMailReview(input: {
  sb: SB
  mailbox: string
  gmailId: string
  universe: MailUniverse
  result: IndexResult
  stage?: ReviewStage
  reason?: string
}): Promise<void> {
  const { sb, result } = input
  const row = {
    mailbox: input.mailbox,
    gmail_id: input.gmailId,
    thread_id: result.threadId ?? null,
    internal_at: result.internalAt ?? null,
    status: result.status,
    deal_id: result.dealId,
    message_key: result.stored ? result.messageKey : null,
    reason: input.reason ?? reviewReasonFor({ status: result.status, decision: result.decision, error: result.error, deals: input.universe.deals }),
    stage: input.stage ?? reviewStageFor(result.decision, result.modelStage),
    rules_version: MAIL_RULES_VERSION,
    reviewed_at: new Date().toISOString(),
  }
  const { error } = await sb.from('tc_mail_reviews').upsert(withoutNul(row), { onConflict: 'mailbox,gmail_id' })
  if (error) throw new Error(error.message)
}

/**
 * Index one broker-mailbox message and record a review row for the outcome
 * (docs/TC_MAIL_FILING_RULES.md "Every message reviewed"): whatever the
 * result — filed, queued, kept_manual, not_deal, bulk, or an error — the
 * (mailbox, gmail_id) gets a tc_mail_reviews row, so an audit can see the
 * message was looked at even when it left no other trace. Dry runs never
 * write a review (nothing was decided for real).
 */
export async function indexGmailMessage(input: IndexInput): Promise<IndexResult> {
  const sb = input.sb ?? createServiceClient()
  const result = await computeIndexResult({ ...input, sb })
  if (!input.dryRun) {
    try {
      await writeMailReview({ sb, mailbox: input.mailbox, gmailId: input.gmailId, universe: input.universe, result })
    } catch (err) {
      console.warn('[mail-index] review write failed (fail-open)', err instanceof Error ? err.message : err)
    }
  }
  return result
}

async function fileMessageDocuments(input: {
  sb: SB
  rowId: string
  decision: MailDecision
  facts: MailFacts
  read: ReadAttachment[]
  mailbox: string
  brokerSlug: string
  threadKey: string
  universe: MailUniverse
  fromName: string | null
  attachmentsJson: Array<{ name: string; document_id: string | null }>
}): Promise<{ documents: number; offerId: string | null }> {
  const { sb, decision, facts } = input
  const dealId = decision.dealId!
  const cycleId = decision.cycleId!
  const attachments: FileCommsAttachment[] = input.read.map((r) => ({
    sourceDocId: `gmail:${facts.messageKey}:${r.ref.attachmentId}`.slice(0, 180),
    name: r.ref.filename,
    bytes: r.bytes,
    contentType: 'application/pdf',
    preRead: r.read,
  }))
  const result = await fileOntoDeal({
    dealId,
    cycleId,
    channel: 'mail',
    actor: `gmail:${input.brokerSlug}`,
    title: facts.subject || null,
    haystack: `${facts.subject}\n${facts.body}\n${facts.attachments.map((a) => a.name).join(' ')}`.slice(0, 12_000),
    attachments,
    filenames: facts.attachments.map((a) => a.name),
    dedupeKey: `mail:${facts.messageKey}`,
    fromEmails: facts.from,
    // Filing never puts a document on the checklist: the document reader
    // (lib/tc/doc-read) reads it first and places only a fully executed copy.
    checklist: 'none',
    classificationExtra: { mail_message_id: input.rowId, mail_category: decision.category },
    eventExtra: {
      mail_message_id: input.rowId,
      method: decision.method,
      category: decision.category,
      direction: decision.direction,
      rules_version: MAIL_RULES_VERSION,
    },
  })
  // Remember which document each attachment became. A message filed before
  // (fileOntoDeal is idempotent per message) maps by its bytes instead.
  const bySource: Record<string, string> = { ...(result.documentBySource ?? {}) }
  if (result.skipped === 'duplicate') {
    for (const r of input.read) {
      const src = `gmail:${facts.messageKey}:${r.ref.attachmentId}`.slice(0, 180)
      if (bySource[src]) continue
      const id = await existingDocumentIdByHash(sb, cycleId, createHash('sha256').update(r.bytes).digest('hex'))
      if (id) bySource[src] = id
    }
  }
  const withIds = input.attachmentsJson.map((a) => {
    const r = input.read.find((x) => x.ref.filename === a.name)
    const src = r ? `gmail:${facts.messageKey}:${r.ref.attachmentId}`.slice(0, 180) : null
    return { ...a, document_id: (src && bySource[src]) || a.document_id }
  })
  await sb.from('tc_mail_messages').update({ attachments: withIds }).eq('id', input.rowId)

  const offerId = await recordOfferActivity({
    sb,
    rowId: input.rowId,
    decision,
    facts,
    fromName: input.fromName,
    threadKey: input.threadKey,
    universe: input.universe,
    firstDocumentId: withIds.find((a) => a.document_id)?.document_id ?? null,
  })
  return { documents: result.documentIds.length, offerId }
}

// ── offers ────────────────────────────────────────────────────────────────

async function recordOfferActivity(input: {
  sb: SB
  rowId: string
  decision: MailDecision
  facts: MailFacts
  fromName: string | null
  threadKey: string
  universe: MailUniverse
  firstDocumentId: string | null
}): Promise<string | null> {
  const { sb, decision, facts } = input
  const dealId = decision.dealId!
  const listingSide = input.universe.listingSide.has(dealId)
  const sentDate = facts.sentAt.slice(0, 10)

  // Any outbound reply in an offer's thread is a reply; an outbound to our
  // seller that talks about the offer is the offer presented (OAR 863-015-0135(2)).
  if (decision.direction === 'outbound') {
    const outside = [...facts.to, ...facts.cc].map(normalizeEmail).filter((e) => !isHouseAddress(e))
    if (outside.length) {
      await sb
        .from('tc_offers')
        .update({ replied_at: facts.sentAt, updated_at: new Date().toISOString() })
        .eq('deal_id', dealId)
        .eq('thread_key', input.threadKey)
        .is('replied_at', null)
    }
    const sellers = input.universe.sellerEmails.get(dealId)
    const toSeller = !!sellers && outside.some((e) => sellers.has(e))
    if (toSeller && /\boffers?\b|counter/i.test(`${facts.subject}\n${facts.body.slice(0, 2000)}`)) {
      await sb
        .from('tc_offers')
        .update({ presented_to_seller_at: facts.sentAt, updated_at: new Date().toISOString() })
        .eq('deal_id', dealId)
        .is('presented_to_seller_at', null)
        .lte('submitted_at', sentDate)
    }
  }

  const capture = offerFromMail({ decision, facts, fromName: input.fromName, listingSide })
  if (!capture) return null
  const { data: current } = await sb
    .from('tc_offers')
    .select('id, status, price, earnest_money')
    .eq('deal_id', dealId)
    .eq('thread_key', input.threadKey)
    .maybeSingle()

  if (capture.kind === 'counter_out') {
    if (!current) return null
    if (current.status === 'accepted' || current.status === 'rejected') return String(current.id)
    await sb
      .from('tc_offers')
      .update({ status: 'countered', last_counter_at: facts.sentAt, updated_at: new Date().toISOString() })
      .eq('id', current.id)
    await sb.from('tc_mail_messages').update({ offer_id: current.id }).eq('id', input.rowId)
    await sb.from('tc_events').insert({
      deal_id: dealId,
      cycle_id: decision.cycleId,
      actor: 'system:mail-index',
      action: 'offer_updated',
      detail: { offer_id: current.id, status: 'countered', title: facts.subject, source: 'mail', mail_message_id: input.rowId },
    })
    return String(current.id)
  }

  if (current) {
    if (current.status === 'accepted' || current.status === 'rejected') return String(current.id)
    // The buyer's side answered our counter: new terms, back in our court.
    await sb
      .from('tc_offers')
      .update({
        status: 'received',
        price: capture.price ?? current.price,
        earnest_money: capture.earnestMoney ?? current.earnest_money,
        last_counter_at: facts.sentAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', current.id)
    await sb.from('tc_mail_messages').update({ offer_id: current.id }).eq('id', input.rowId)
    return String(current.id)
  }

  const agent = capture.agentName ?? capture.agentEmail
  const { data: inserted, error } = await sb
    .from('tc_offers')
    .insert({
      deal_id: dealId,
      buyer_name: agent ? `Buyer (via ${agent})` : 'Buyer (via agent)',
      buyer_agent: agent,
      buyer_agent_email: capture.agentEmail,
      price: capture.price,
      earnest_money: capture.earnestMoney,
      financing_type: capture.financing,
      status: 'received',
      submitted_at: sentDate,
      source: 'mail',
      source_message_id: input.rowId,
      document_id: input.firstDocumentId,
      thread_key: input.threadKey,
    })
    .select('id')
    .single()
  if (error || !inserted) {
    console.warn('[mail-index] offer insert', error?.message)
    return null
  }
  await sb.from('tc_mail_messages').update({ offer_id: inserted.id }).eq('id', input.rowId)
  await backfillOfferFollowUps({
    sb,
    offerId: String(inserted.id),
    dealId,
    threadKey: input.threadKey,
    sentAt: facts.sentAt,
    sellers: input.universe.sellerEmails.get(dealId) ?? new Set(),
  })
  await sb.from('tc_events').insert({
    deal_id: dealId,
    cycle_id: decision.cycleId,
    document_id: input.firstDocumentId,
    actor: 'system:mail-index',
    action: 'offer_received',
    detail: {
      offer_id: inserted.id,
      source: 'mail',
      title: facts.subject,
      buyer_agent: agent,
      price: capture.price,
      mail_message_id: input.rowId,
    },
  })
  return String(inserted.id)
}

/**
 * A history sweep reads newest first, so our reply can be indexed before the
 * offer it answers. When an offer is recorded, look back through what is
 * already indexed for the reply and for the forward to our seller.
 */
async function backfillOfferFollowUps(input: {
  sb: SB
  offerId: string
  dealId: string
  threadKey: string
  sentAt: string
  sellers: ReadonlySet<string>
}): Promise<void> {
  const { sb } = input
  const { data: later } = await sb
    .from('tc_mail_messages')
    .select('sent_at, thread_key, to_emails, cc_emails, subject, body_excerpt, category')
    .eq('deal_id', input.dealId)
    .eq('status', 'filed')
    .eq('direction', 'outbound')
    .gt('sent_at', input.sentAt)
    .order('sent_at', { ascending: true })
    .limit(200)
  let replied: string | null = null
  let presented: string | null = null
  let countered: string | null = null
  for (const m of later ?? []) {
    const outside = [...((m.to_emails as string[]) ?? []), ...((m.cc_emails as string[]) ?? [])]
      .map(normalizeEmail)
      .filter((e) => !isHouseAddress(e))
    if (!replied && m.thread_key === input.threadKey && outside.length) replied = String(m.sent_at)
    if (!countered && m.thread_key === input.threadKey && m.category === 'counter') countered = String(m.sent_at)
    if (
      !presented &&
      outside.some((e) => input.sellers.has(e)) &&
      /\boffers?\b|counter/i.test(`${m.subject ?? ''}\n${String(m.body_excerpt ?? '').slice(0, 2000)}`)
    ) {
      presented = String(m.sent_at)
    }
  }
  const patch: Record<string, unknown> = {}
  if (replied) patch.replied_at = replied
  if (presented) patch.presented_to_seller_at = presented
  if (countered) {
    patch.status = 'countered'
    patch.last_counter_at = countered
  }
  if (Object.keys(patch).length) {
    await sb.from('tc_offers').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', input.offerId)
  }
}

// ── sweeps ────────────────────────────────────────────────────────────────

export type SweepMailbox = { email: string; slug: string }

export type SweepResult = {
  query: string
  mailboxes: number
  seen: number
  /** Already in the index for that mailbox: not fetched again (see `reindex`). */
  skipped: number
  filed: number
  queued: number
  ignored: number
  errors: number
  offers: number
  /** False when the deadline stopped the sweep: the caller must not record it as done. */
  complete: boolean
  samples: Array<{ mailbox: string; subject: string | null; status: string; dealId: string | null }>
}

function gmailDate(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, '/')
}

/** Messages indexed at once within one mailbox. Gmail allows 250 quota units/s per user; one message is ~3 reads of 5. */
const SWEEP_CONCURRENCY = 4

function hasUnfiledPdf(attachments: unknown): boolean {
  return ((attachments as Array<{ bytes?: number; document_id?: string | null }> | null) ?? []).some(
    (a) => (a.bytes ?? 0) > 0 && !a.document_id,
  )
}

/**
 * The Gmail ids in this page that the index already holds for this mailbox.
 * Narrowed by thread id (GIN-indexed; every writer stores a ref and its thread
 * together), then matched exactly on mailbox + Gmail id.
 */
export async function indexedGmailIds(
  sb: SB,
  mailbox: string,
  page: ReadonlyArray<{ id: string; threadId?: string | null }>,
): Promise<Set<string>> {
  const out = new Set<string>()
  const threads = [...new Set(page.map((m) => m.threadId).filter((t): t is string => !!t && /^[A-Za-z0-9_-]+$/.test(t)))]
  if (!threads.length) return out
  const ids = new Set(page.map((m) => m.id))
  const { data, error } = await sb.from('tc_mail_messages').select('gmail_refs, status, attachments').overlaps('gmail_thread_ids', threads)
  if (error) throw new Error(`indexed gmail ids: ${error.message}`)
  for (const row of data ?? []) {
    // A filed message with a PDF that never became a document (a filing that
    // stopped part way) is indexed again; filing is idempotent per message.
    if (row.status === 'filed' && hasUnfiledPdf(row.attachments)) continue
    for (const r of (row.gmail_refs as Array<{ mailbox?: string; gmail_id?: string }> | null) ?? []) {
      if (r.mailbox === mailbox && r.gmail_id && ids.has(r.gmail_id)) out.add(r.gmail_id)
    }
  }
  return out
}

/**
 * Index every message a Gmail search finds, mailbox by mailbox. A message the
 * index already holds for that mailbox is skipped unless `reindex` (a rules
 * change): the live stream and earlier sweeps decided it, and a queued one is
 * re-decided by rematchQueuedMail. Past `deadline` it stops between messages
 * and reports complete: false, so a large first sweep resumes on the next run
 * (everything it stored is skipped then) instead of timing out whole.
 */
export async function sweepQuery(input: {
  query: string
  universe: MailUniverse
  mailboxes?: readonly SweepMailbox[]
  maxPerMailbox?: number
  dryRun?: boolean
  reindex?: boolean
  /** Epoch ms. */
  deadline?: number
  sb?: SB
  /** Tests inject these. */
  gmailFor?: (email: string) => gmail_v1.Gmail | null
  index?: typeof indexGmailMessage
  indexed?: typeof indexedGmailIds
}): Promise<SweepResult> {
  const sb = input.sb ?? createServiceClient()
  const mailboxes = input.mailboxes ?? CRM_MAILBOXES
  const max = input.maxPerMailbox ?? 2000
  const gmailFor = input.gmailFor ?? ((email: string) => getGmailFor(email, READONLY))
  const index = input.index ?? indexGmailMessage
  const indexed = input.indexed ?? indexedGmailIds
  const res: SweepResult = {
    query: input.query,
    mailboxes: 0,
    seen: 0,
    skipped: 0,
    filed: 0,
    queued: 0,
    ignored: 0,
    errors: 0,
    offers: 0,
    complete: true,
    samples: [],
  }
  const seenKeys = new Set<string>()
  const late = () => input.deadline != null && Date.now() > input.deadline
  const tally = (mailbox: string, r: IndexResult) => {
    if (seenKeys.has(r.messageKey)) return
    seenKeys.add(r.messageKey)
    res.seen++
    if (r.status === 'error') res.errors++
    else if (r.status === 'filed' || (r.decision?.status === 'filed' && input.dryRun)) res.filed++
    else if (r.status === 'ambiguous' || r.status === 'unfiled_transaction') res.queued++
    else res.ignored++
    if (r.offerId) res.offers++
    if (res.samples.length < 40 && r.status !== 'not_deal' && r.status !== 'bulk') {
      res.samples.push({ mailbox, subject: r.subject, status: r.decision?.status ?? r.status, dealId: r.dealId ?? r.decision?.dealId ?? null })
    }
  }
  for (const mb of mailboxes) {
    const gmail = gmailFor(mb.email)
    if (!gmail) continue
    res.mailboxes++
    let pageToken: string | undefined
    let count = 0
    do {
      if (late()) {
        res.complete = false
        return res
      }
      const list = await gmail.users.messages.list({ userId: 'me', q: input.query, maxResults: 100, pageToken })
      const page = (list.data.messages ?? [])
        .filter((m): m is gmail_v1.Schema$Message & { id: string } => !!m.id)
        .slice(0, Math.max(0, max - count))
      count += page.length
      const known = input.reindex ? new Set<string>() : await indexed(sb, mb.email, page)
      const todo = page.filter((m) => !known.has(m.id))
      res.skipped += page.length - todo.length
      let next = 0
      const worker = async () => {
        while (next < todo.length) {
          if (late()) {
            res.complete = false
            return
          }
          const m = todo[next++]
          const r = await index({
            gmail,
            mailbox: mb.email,
            brokerSlug: mb.slug,
            gmailId: m.id,
            universe: input.universe,
            dryRun: input.dryRun,
            sb,
          })
          tally(mb.email, r)
        }
      }
      await Promise.all(Array.from({ length: Math.min(SWEEP_CONCURRENCY, todo.length) }, worker))
      if (!res.complete) return res
      pageToken = list.data.nextPageToken ?? undefined
    } while (pageToken && count < max)
  }
  return res
}

// ── every message reviewed ───────────────────────────────────────────────

/** The Gmail ids in this page the review ledger already has for this mailbox. */
export async function indexedReviewIds(sb: SB, mailbox: string, ids: readonly string[]): Promise<Set<string>> {
  const out = new Set<string>()
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500)
    if (!chunk.length) continue
    const { data, error } = await sb.from('tc_mail_reviews').select('gmail_id').eq('mailbox', mailbox).in('gmail_id', chunk)
    if (error) {
      // Before the migration lands (or is refreshed into PostgREST's schema
      // cache), the table reads as "does not exist" — nothing is known yet,
      // which is the same as an empty set, not a reason to stop the walk.
      if (/does not exist|schema cache/i.test(error.message)) continue
      throw new Error(`indexed review ids: ${error.message}`)
    }
    for (const r of data ?? []) out.add(String(r.gmail_id))
  }
  return out
}

export type ReviewMailboxResult = {
  mailbox: string
  /** Messages `users.messages.list` has returned for this mailbox's walk so far, cumulative across resumed runs. */
  listed: number
  /** Messages actually indexed for this mailbox's walk so far, cumulative across resumed runs (already-reviewed ids are skipped, not re-counted). */
  reviewed: number
  /** Already-reviewed ids skipped THIS run. */
  skipped: number
  byStatus: Record<string, number>
  errors: number
  /** False when the deadline stopped the walk mid-page: the caller must not treat it as finished. */
  complete: boolean
  /** True once `users.messages.list` is exhausted for this mailbox — the whole history has a review row. */
  finished: boolean
}

/**
 * Walk EVERY message in one mailbox — no query except `-in:chats`, no spam or
 * trash excluded beyond Gmail's own defaults — and record a
 * `tc_mail_reviews` row for each one via `indexGmailMessage`. Resumes from
 * `tc_mail_review_cursors`; a message already in the ledger for this mailbox
 * is skipped (batch-checked 500 ids at a time, the same page size
 * `users.messages.list` returns). Stops at `deadline` and saves the cursor;
 * `finished_at` is set only once the listing itself runs out of pages.
 */
export async function reviewMailbox(input: {
  mailbox: string
  deadline?: number
  concurrency?: number
  modelStage?: boolean
  /** Stop after indexing this many messages this run (a smoke-test cap; a dry run never persists a cursor). */
  limit?: number
  /** READ-ONLY: decide every message but write nothing — no tc_mail_messages row, no tc_mail_reviews row, no cursor progress. */
  dryRun?: boolean
  /** Called after each page of up to 500 messages, cumulative counts so far — a caller's progress log. */
  onPage?: (progress: { mailbox: string; listed: number; reviewed: number; skipped: number; errors: number }) => void
  sb?: SB
  gmailFor?: (email: string) => gmail_v1.Gmail | null
  index?: typeof indexGmailMessage
  indexed?: typeof indexedReviewIds
  universe?: MailUniverse
}): Promise<ReviewMailboxResult> {
  const sb = input.sb ?? createServiceClient()
  const gmailFor = input.gmailFor ?? ((email: string) => getGmailFor(email, READONLY))
  const index = input.index ?? indexGmailMessage
  const indexed = input.indexed ?? indexedReviewIds
  const concurrency = input.concurrency ?? SWEEP_CONCURRENCY
  const res: ReviewMailboxResult = { mailbox: input.mailbox, listed: 0, reviewed: 0, skipped: 0, byStatus: {}, errors: 0, complete: true, finished: false }
  const gmail = gmailFor(input.mailbox)
  if (!gmail) return res
  let processedThisRun = 0

  const { data: cursorRow } = await sb
    .from('tc_mail_review_cursors')
    .select('page_token, listed, reviewed, started_at, finished_at')
    .eq('mailbox', input.mailbox)
    .maybeSingle()
  if (cursorRow?.finished_at) {
    res.finished = true
    res.listed = Number(cursorRow.listed ?? 0)
    res.reviewed = Number(cursorRow.reviewed ?? 0)
    return res
  }

  const universe = input.universe ?? (await loadMailUniverse(sb))
  const brokerSlug = CRM_MAILBOXES.find((m) => m.email === input.mailbox)?.slug ?? 'matt'
  const late = () => (input.deadline != null && Date.now() > input.deadline) || (input.limit != null && processedThisRun >= input.limit)
  let listed = Number(cursorRow?.listed ?? 0)
  let reviewed = Number(cursorRow?.reviewed ?? 0)
  const startedAt = cursorRow?.started_at ?? new Date().toISOString()
  let pageToken: string | undefined = cursorRow?.page_token ?? undefined
  let exhausted = false

  const saveCursor = async (finished: boolean) =>
    sb.from('tc_mail_review_cursors').upsert(
      {
        mailbox: input.mailbox,
        page_token: finished ? null : (pageToken ?? null),
        listed,
        reviewed,
        started_at: startedAt,
        finished_at: finished ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'mailbox' },
    )

  do {
    if (late()) {
      res.complete = false
      break
    }
    const list = await gmail.users.messages.list({ userId: 'me', q: '-in:chats', includeSpamTrash: false, maxResults: 500, pageToken })
    const page = (list.data.messages ?? []).filter((m): m is gmail_v1.Schema$Message & { id: string } => !!m.id)
    listed += page.length
    const known = await indexed(sb, input.mailbox, page.map((m) => m.id))
    const todo = page.filter((m) => !known.has(m.id))
    res.skipped += page.length - todo.length

    let next = 0
    const worker = async () => {
      while (next < todo.length) {
        if (late()) {
          res.complete = false
          return
        }
        const m = todo[next++]
        processedThisRun++
        try {
          const r = await index({ gmail, mailbox: input.mailbox, brokerSlug, gmailId: m.id, universe, modelStage: input.modelStage, dryRun: input.dryRun, sb })
          reviewed++
          res.byStatus[r.status] = (res.byStatus[r.status] ?? 0) + 1
        } catch (err) {
          res.errors++
          console.warn('[reviewMailbox] index error', m.id, err instanceof Error ? err.message : err)
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, todo.length) }, worker))
    if (!res.complete) {
      res.listed = listed
      res.reviewed = reviewed
      if (!input.dryRun) await saveCursor(false)
      return res
    }
    pageToken = list.data.nextPageToken ?? undefined
    if (!pageToken) exhausted = true
    if (!input.dryRun) await saveCursor(exhausted)
    input.onPage?.({ mailbox: input.mailbox, listed, reviewed, skipped: res.skipped, errors: res.errors })
  } while (pageToken)

  res.listed = listed
  res.reviewed = reviewed
  res.finished = exhausted
  return res
}

/** Gmail search terms for one deal: address variants, escrow and MLS numbers. */
export function dealSearchTerms(deal: DealFacts): string[] {
  const terms = new Set<string>()
  const p = parseDealAddress(deal.address, deal.city)
  if (p) {
    terms.add(`"${p.number} ${p.street}"`)
    if (p.directional) terms.add(`"${p.number} ${p.directional} ${p.street}"`)
  }
  for (const c of deal.cycles) {
    if (c.escrowNumber && c.escrowNumber.replace(/[^A-Za-z0-9]/g, '').length >= 6) terms.add(`"${c.escrowNumber}"`)
    if (c.mlsNumber && /^\d{8,}$/.test(c.mlsNumber)) terms.add(c.mlsNumber)
  }
  return [...terms]
}

/** Every mailbox, all history (or since a date), for one deal's identifiers. */
export async function sweepDealMail(input: {
  dealId: string
  since?: string | null
  universe?: MailUniverse
  dryRun?: boolean
  reindex?: boolean
  /** Epoch ms: past it the sweep stops and the deal is not marked swept, so the next run resumes it. */
  deadline?: number
  sb?: SB
}): Promise<SweepResult | null> {
  const sb = input.sb ?? createServiceClient()
  const universe = input.universe ?? (await loadMailUniverse(sb))
  const deal = universe.deals.find((d) => d.dealId === input.dealId)
  if (!deal) return null
  const terms = dealSearchTerms(deal)
  if (!terms.length) return null
  const since = input.since ? ` after:${gmailDate(input.since)}` : ''
  const res = await sweepQuery({
    query: `(${terms.join(' OR ')}) -in:spam -in:trash${since}`,
    universe,
    dryRun: input.dryRun,
    reindex: input.reindex,
    deadline: input.deadline,
    sb,
  })
  if (!input.dryRun && res.complete) {
    await sb.from('tc_deals').update({ mail_swept_at: new Date().toISOString() }).eq('id', input.dealId)
  }
  return res
}

/**
 * Offer, counter, escrow and closing mail by subject, with a PDF, across every
 * mailbox. This is how an offer on a property with no file (or a lowball we
 * never answered) still becomes a record.
 */
export const TRANSACTION_SUBJECT_QUERY =
  '{subject:offer subject:offers subject:counteroffer subject:counter subject:"sale agreement" subject:"purchase agreement" subject:"purchase and sale" subject:escrow subject:"earnest money" subject:addendum subject:"preliminary title" subject:prelim subject:"settlement statement" subject:closing subject:inspection subject:repair subject:disclosure subject:disclosures} has:attachment -in:spam -in:trash'

export async function sweepTransactionMail(input: {
  since?: string | null
  universe?: MailUniverse
  dryRun?: boolean
  maxPerMailbox?: number
  reindex?: boolean
  deadline?: number
  sb?: SB
}): Promise<SweepResult> {
  const sb = input.sb ?? createServiceClient()
  const universe = input.universe ?? (await loadMailUniverse(sb))
  const since = input.since ? ` after:${gmailDate(input.since)}` : ''
  return sweepQuery({
    query: `${TRANSACTION_SUBJECT_QUERY}${since}`,
    universe,
    dryRun: input.dryRun,
    maxPerMailbox: input.maxPerMailbox,
    reindex: input.reindex,
    deadline: input.deadline,
    sb,
  })
}

/**
 * Re-decide queued mail (ambiguous, unfiled) against today's deals: a file
 * opened this morning collects the offers that arrived last week. Oldest
 * decision first, so a run that stops at its deadline leaves the rest for the
 * next one (re-deciding a row stamps decided_at).
 */
export async function rematchQueuedMail(
  input: { universe?: MailUniverse; limit?: number; deadline?: number; sb?: SB; modelStage?: boolean } = {},
): Promise<{
  checked: number
  filed: number
  stillQueued: number
  errors: number
  complete: boolean
}> {
  const sb = input.sb ?? createServiceClient()
  const universe = input.universe ?? (await loadMailUniverse(sb))
  const { data: rows } = await sb
    .from('tc_mail_messages')
    .select('id, gmail_refs')
    .in('status', ['ambiguous', 'unfiled_transaction'])
    .eq('decided_by', 'system')
    .order('decided_at', { ascending: true })
    .limit(input.limit ?? 500)
  const out = { checked: 0, filed: 0, stillQueued: 0, errors: 0, complete: true }
  const todo = (rows ?? [])
    .map((row) => ((row.gmail_refs as Array<{ mailbox?: string; broker?: string; gmail_id?: string }> | null) ?? [])[0])
    .filter((ref): ref is { mailbox: string; broker?: string; gmail_id: string } => !!ref?.mailbox && !!ref.gmail_id)
  // The model reads a queued message once; after that only the rules re-decide
  // it (a new deal or contact), so a daily rematch does not re-ask the same question.
  const asked = new Set<string>()
  if (input.modelStage) {
    for (const mailbox of new Set(todo.map((r) => r.mailbox))) {
      const ids = todo.filter((r) => r.mailbox === mailbox).map((r) => r.gmail_id)
      for (let i = 0; i < ids.length; i += 200) {
        const { data } = await sb.from('tc_mail_reviews').select('gmail_id').eq('mailbox', mailbox).eq('stage', 'model').in('gmail_id', ids.slice(i, i + 200))
        for (const r of data ?? []) asked.add(`${mailbox}:${r.gmail_id}`)
      }
    }
  }
  let next = 0
  const worker = async () => {
    while (next < todo.length) {
      if (input.deadline != null && Date.now() > input.deadline) {
        out.complete = false
        return
      }
      const ref = todo[next++]
      const gmail = getGmailFor(ref.mailbox, READONLY)
      if (!gmail) continue
      out.checked++
      const modelStage = !!input.modelStage && !asked.has(`${ref.mailbox}:${ref.gmail_id}`)
      const r = await indexGmailMessage({ gmail, mailbox: ref.mailbox, brokerSlug: ref.broker ?? 'matt', gmailId: ref.gmail_id, universe, sb, modelStage })
      if (r.status === 'filed') out.filed++
      else if (r.status === 'error') out.errors++
      else out.stillQueued++
    }
  }
  await Promise.all(Array.from({ length: Math.min(SWEEP_CONCURRENCY, todo.length) }, worker))
  return out
}

/**
 * Mail decided before its thread was filed. The history walk and the live
 * stream decide each message once, so a reply with no address from someone
 * on several files, decided before the first message of its thread filed, was
 * left as ordinary mail ("Re: Jacklight Bill of Sale"). Once any message in a
 * thread files, its siblings decided earlier are decided again, and rule 2
 * (same thread) files them unless they name another file's property. A row
 * decided again carries a newer reviewed_at, so it is not picked twice unless
 * more of its thread files later.
 */
export async function refileThreadSiblings(input: { universe?: MailUniverse; deadline?: number; sb?: SB; limit?: number } = {}): Promise<{
  candidates: number
  checked: number
  filed: number
  complete: boolean
}> {
  const sb = input.sb ?? createServiceClient()
  const universe = input.universe ?? (await loadMailUniverse(sb))
  const filed = await allRows<{ gmail_thread_ids: string[] | null; decided_at: string }>((a, b) =>
    sb.from('tc_mail_messages').select('gmail_thread_ids, decided_at').eq('status', 'filed').order('id').range(a, b),
  )
  const latest = new Map<string, string>()
  for (const f of filed) {
    for (const t of f.gmail_thread_ids ?? []) if ((latest.get(t) ?? '') < f.decided_at) latest.set(t, f.decided_at)
  }
  const threadIds = [...latest.keys()]
  const todo: Array<{ mailbox: string; gmail_id: string }> = []
  for (let i = 0; i < threadIds.length; i += 150) {
    const { data } = await sb
      .from('tc_mail_reviews')
      .select('mailbox, gmail_id, thread_id, reviewed_at')
      .in('thread_id', threadIds.slice(i, i + 150))
      .in('status', ['not_deal', 'ambiguous', 'unfiled_transaction'])
    for (const r of data ?? []) {
      if (r.thread_id && String(r.reviewed_at) < (latest.get(String(r.thread_id)) ?? '')) todo.push({ mailbox: String(r.mailbox), gmail_id: String(r.gmail_id) })
    }
  }
  const out = { candidates: todo.length, checked: 0, filed: 0, complete: true }
  const work = todo.slice(0, input.limit ?? todo.length)
  if (work.length < todo.length) out.complete = false
  let next = 0
  const worker = async () => {
    while (next < work.length) {
      if (input.deadline != null && Date.now() > input.deadline) {
        out.complete = false
        return
      }
      const ref = work[next++]
      const gmail = getGmailFor(ref.mailbox, READONLY)
      if (!gmail) continue
      const brokerSlug = CRM_MAILBOXES.find((m) => m.email === ref.mailbox)?.slug ?? 'matt'
      out.checked++
      const r = await indexGmailMessage({ gmail, mailbox: ref.mailbox, brokerSlug, gmailId: ref.gmail_id, universe, sb })
      if (r.status === 'filed') out.filed++
    }
  }
  await Promise.all(Array.from({ length: Math.min(SWEEP_CONCURRENCY, work.length) }, worker))
  return out
}

/** File one indexed message onto a deal a person chose. Re-reads it from Gmail. */
export async function fileIndexedMessageToDeal(input: {
  messageId: string
  dealId: string
  actor: string
  sb?: SB
}): Promise<{ ok: boolean; error?: string; documents?: number }> {
  const sb = input.sb ?? createServiceClient()
  const { data: row } = await sb
    .from('tc_mail_messages')
    .select('id, message_key, gmail_refs, thread_key')
    .eq('id', input.messageId)
    .maybeSingle()
  if (!row) return { ok: false, error: 'Message not found.' }
  const universe = await loadMailUniverse(sb)
  const deal = universe.deals.find((d) => d.dealId === input.dealId)
  if (!deal) return { ok: false, error: 'Deal not found.' }
  const ref = ((row.gmail_refs as Array<{ mailbox?: string; broker?: string; gmail_id?: string }> | null) ?? [])[0]
  const gmail = ref?.mailbox ? getGmailFor(ref.mailbox, READONLY) : null
  if (!gmail || !ref?.gmail_id) return { ok: false, error: 'Mailbox not reachable.' }
  const full = (await gmail.users.messages.get({ userId: 'me', id: ref.gmail_id, format: 'full' })).data
  const body = extractBody(full.payload)
  const names = pdfParts(full.payload).map((p) => ({ name: p.filename }))
  const read = names.length ? await readAttachments(gmail, full, true) : []
  const facts = factsFromHeaders(full, body, names.map((n) => read.find((r) => r.ref.filename === n.name)?.facts ?? n))
  // The person chose the deal; the rules still pick the cycle and category.
  const auto = decideMailFiling({ facts, deals: [deal], thread: { dealId: deal.dealId, method: 'manual' } })
  const decision: MailDecision = {
    ...auto,
    status: 'filed',
    dealId: deal.dealId,
    cycleId: auto.cycleId ?? deal.cycles[0]?.id ?? null,
    method: auto.method ?? 'thread',
    reasons: [...auto.reasons, `filed by ${input.actor}`],
  }
  if (!decision.cycleId) return { ok: false, error: 'That deal has no cycle to file onto.' }
  const attachmentsJson = read.map((r) => ({
    name: r.facts.name,
    bytes: r.bytes.byteLength,
    form_number: r.facts.formNumber ?? null,
    form_name: r.facts.formName ?? null,
    execution_state: r.facts.executionState ?? null,
    text_head: (r.facts.text ?? '').slice(0, 2000),
    document_id: null as string | null,
  }))
  await sb
    .from('tc_mail_messages')
    .update({
      status: 'filed',
      deal_id: deal.dealId,
      cycle_id: decision.cycleId,
      match_method: 'manual',
      category: decision.category,
      decided_by: input.actor,
      decided_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      attachments: attachmentsJson,
    })
    .eq('id', row.id)
  const filed = await fileMessageDocuments({
    sb,
    rowId: String(row.id),
    decision,
    facts,
    read,
    mailbox: ref.mailbox!,
    brokerSlug: ref.broker ?? 'matt',
    threadKey: String(row.thread_key),
    universe,
    fromName: parseAddressList(header(full.payload?.headers, 'From'))[0]?.name || null,
    attachmentsJson,
  })
  // A person answering the queue (or the auto-open-from-mail sweep, whose
  // actor is system:mail-index) is its own review stage: this message was
  // already reviewed by the rules once, and this row records the final call.
  try {
    await writeMailReview({
      sb,
      mailbox: ref.mailbox!,
      gmailId: ref.gmail_id,
      universe,
      stage: input.actor.startsWith('system:') ? 'rules' : 'person',
      reason: `filed: ${decision.reasons.at(-1) ?? `by ${input.actor}`} on ${deal.address}`.slice(0, 400),
      result: {
        messageKey: String(row.message_key),
        status: 'filed',
        stored: true,
        dealId: deal.dealId,
        documents: filed.documents,
        offerId: null,
        decision,
        subject: facts.subject,
        threadId: full.threadId ?? null,
        internalAt: facts.sentAt,
        modelStage: null,
      },
    })
  } catch (err) {
    console.warn('[mail-index] review write failed (fail-open)', err instanceof Error ? err.message : err)
  }
  return { ok: true, documents: filed.documents }
}

// ── opening files from mail ───────────────────────────────────────────────

/**
 * Open a file for a property that so far exists only in email. It starts
 * before contract; the broker confirms the side, stage and clients on the deal
 * page. Used by the mail queue's "Open a file" and by autoOpenFilesFromMail.
 */
export async function openInboundFile(input: {
  address: string
  brokerName: string
  representation: 'seller' | 'buyer' | null
  actor: string
  reason: string
  mailIds: string[]
  sb?: SB
}): Promise<{ dealId: string; propertyKey: string; cycleId: string } | { error: string }> {
  const sb = input.sb ?? createServiceClient()
  const dealId = crypto.randomUUID()
  const cycleId = crypto.randomUUID()
  const propertyKey = propertyKeyForInhouseDeal(input.address, dealId)
  const shape = fileShapeForRepresentation(input.representation ?? 'buyer')
  const { error: dealErr } = await sb.from('tc_deals').insert({
    id: dealId,
    property_key: propertyKey,
    address: input.address,
    city: parseCityFromAddress(input.address),
    state: 'OR',
    broker_name: input.brokerName,
    // Nothing on file says where it stands yet: every file opened from email
    // starts before contract until the broker confirms.
    stage: 'pre_contract',
    stage_detail: input.representation ? 'Opened from email' : 'Opened from email: confirm side and stage',
  })
  if (dealErr) return { error: 'Could not open the file.' }
  const { error: cycleErr } = await sb.from('tc_cycles').insert({
    id: cycleId,
    deal_id: dealId,
    kind: input.representation ? shape.kind : 'sale',
    source: 'inhouse',
    source_guid: `inhouse:${cycleId}`,
    status: 'Pre-Contract',
    broker_name: input.brokerName,
    checklist_type: input.representation ? shape.checklistType : null,
  })
  if (cycleErr) {
    await sb.from('tc_deals').delete().eq('id', dealId)
    return { error: 'Could not open the file.' }
  }
  await sb.from('tc_events').insert({
    deal_id: dealId,
    cycle_id: cycleId,
    actor: input.actor,
    action: 'deal_opened_from_mail',
    detail: { address: input.address, representation: input.representation, reason: input.reason, mail_message_ids: input.mailIds },
  })
  return { dealId, propertyKey, cycleId }
}

/**
 * The automatic half of the queue: transaction mail proving a deal is under
 * way for a property with no file opens that file and files the mail onto it.
 */
export async function autoOpenFilesFromMail(input: { sb?: SB } = {}): Promise<Array<{ address: string; dealId: string; filed: number; reason: string }>> {
  const sb = input.sb ?? createServiceClient()
  const rows = await allRows<{ id: string; property_hint: string | null; subject: string | null; category: string; gmail_refs: unknown; sent_at: string }>(
    (a, b) =>
      sb
        .from('tc_mail_messages')
        .select('id, property_hint, subject, category, gmail_refs, sent_at')
        .eq('status', 'unfiled_transaction')
        .eq('decided_by', 'system')
        .not('property_hint', 'is', null)
        .order('id')
        .range(a, b),
  )
  const queued = rows.map((r) => ({
    id: String(r.id),
    propertyHint: (r.property_hint as string | null) ?? null,
    subject: (r.subject as string | null) ?? null,
    category: String(r.category),
    broker: (((r.gmail_refs as Array<{ broker?: string }> | null) ?? [])[0]?.broker as string | undefined) ?? null,
    sentAt: String(r.sent_at),
  }))
  const universe = await loadMailUniverse(sb)
  const out: Array<{ address: string; dealId: string; filed: number; reason: string }> = []
  for (const f of filesToOpenFromQueue(queued)) {
    const parsed = parseDealAddress(f.address)
    // A file for this property already exists: the rematch files the mail there.
    if (parsed && universe.deals.some((d) => mentionsDealAddress(d.address, parsed))) continue
    const opened = await openInboundFile({
      address: f.address,
      brokerName: fileNameFromBrokerSlug(f.broker) ?? 'Matt Ryan',
      representation: null,
      actor: 'system:mail-index',
      reason: f.reason,
      mailIds: f.rowIds,
      sb,
    })
    if ('error' in opened) continue
    let filed = 0
    for (const id of f.rowIds) {
      const r = await fileIndexedMessageToDeal({ messageId: id, dealId: opened.dealId, actor: 'system:mail-index', sb })
      if (r.ok) filed++
    }
    out.push({ address: f.address, dealId: opened.dealId, filed, reason: f.reason })
  }
  return out
}

/**
 * Index again every message whose review ended in an error (a transient
 * Gmail or storage failure, or a since-fixed bug). The full-history walk moves
 * forward and never revisits a reviewed id, so errors are retried here.
 */
export async function retryReviewErrors(input: { deadline?: number; sb?: SB; modelStage?: boolean } = {}): Promise<{ retried: number; fixed: number; stillErrors: number }> {
  const sb = input.sb ?? createServiceClient()
  const universe = await loadMailUniverse(sb)
  const { data } = await sb.from('tc_mail_reviews').select('mailbox, gmail_id').eq('status', 'error').order('reviewed_at', { ascending: true }).limit(500)
  const res = { retried: 0, fixed: 0, stillErrors: 0 }
  for (const r of data ?? []) {
    if (input.deadline && Date.now() > input.deadline) break
    const gmail = getGmailFor(String(r.mailbox), READONLY)
    if (!gmail) continue
    const brokerSlug = CRM_MAILBOXES.find((m) => m.email === r.mailbox)?.slug ?? 'matt'
    const out = await indexGmailMessage({ gmail, mailbox: String(r.mailbox), brokerSlug, gmailId: String(r.gmail_id), universe, sb, modelStage: input.modelStage })
    res.retried++
    if (out.status === 'error') res.stillErrors++
    else res.fixed++
  }
  return res
}
