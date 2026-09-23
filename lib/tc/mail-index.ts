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
import type { gmail_v1 } from 'googleapis'
import { createServiceClient } from '@/lib/supabase/service'
import { CRM_MAILBOXES, getGmailFor } from '@/lib/crm/gmail'
import {
  MAIL_RULES_VERSION,
  decideMailFiling,
  filesToOpenFromQueue,
  mentionsDealAddress,
  isHouseAddress,
  isTransactionFormAttachment,
  normalizeEmail,
  offerFromMail,
  parseDealAddress,
  type DealFacts,
  type MailAttachmentFacts,
  type MailDecision,
  type MailFacts,
  type ThreadAnchor,
} from '@/lib/tc/mail-rules'
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

/**
 * Index one broker-mailbox message. Cheap first: headers and the snippet
 * decide whether the full message is worth reading. Mail the rules call
 * ordinary is counted, not stored.
 */
export async function indexGmailMessage(input: {
  gmail: gmail_v1.Gmail
  mailbox: string
  brokerSlug: string
  gmailId: string
  universe: MailUniverse
  meta?: gmail_v1.Schema$Message | null
  dryRun?: boolean
  sb?: SB
}): Promise<IndexResult> {
  const sb = input.sb ?? createServiceClient()
  const { gmail, universe } = input
  let messageKey = `gmail:${input.gmailId}`
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
    const headers = meta.payload?.headers
    const base = factsFromHeaders(meta, meta.snippet ?? '', [])
    messageKey = base.messageKey
    const threadKey = threadKeyFor(headers, meta.threadId)
    const anchor = await threadAnchor(sb, threadKey, meta.threadId ?? null, messageKey)
    const empty = (decision: MailDecision | null, status: IndexResult['status']): IndexResult => ({
      messageKey,
      status,
      stored: false,
      dealId: null,
      documents: 0,
      offerId: null,
      decision,
      subject: base.subject,
    })

    // Pass 1: headers + snippet. Bulk mail stops here.
    const d1 = decideMailFiling({ facts: base, deals: universe.deals, thread: anchor })
    if (d1.status === 'bulk') return empty(d1, 'bulk')
    const worthReading =
      d1.status !== 'not_deal' || d1.candidates.length > 0 || d1.category !== 'general' || looksMultipartMixed(headers)
    if (!worthReading) return empty(d1, 'not_deal')

    // Pass 2: full body + attachment names.
    const full = (await gmail.users.messages.get({ userId: 'me', id: input.gmailId, format: 'full' })).data
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
    const decision = decideMailFiling({ facts: f3, deals: universe.deals, thread: anchor })
    if (input.dryRun) {
      return { ...empty(decision, decision.status), dealId: decision.dealId }
    }
    if (!STORED.has(decision.status)) return empty(decision, decision.status)

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
      return { ...empty(decision, 'kept_manual'), stored: true, dealId: existing.deal_id ?? null }
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
      decided_by: 'system',
      decided_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    const { data: saved, error: saveErr } = await sb
      .from('tc_mail_messages')
      .upsert(row, { onConflict: 'message_key' })
      .select('id')
      .single()
    if (saveErr || !saved) throw new Error(`index row: ${saveErr?.message ?? 'no row'}`)
    const rowId = String(saved.id)

    if (decision.status !== 'filed' || !decision.dealId || !decision.cycleId) {
      return { ...empty(decision, decision.status), stored: true }
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
    }
  }
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
  // Remember which document each attachment became.
  const bySource = result.documentBySource ?? {}
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
  filed: number
  queued: number
  ignored: number
  errors: number
  offers: number
  samples: Array<{ mailbox: string; subject: string | null; status: string; dealId: string | null }>
}

function gmailDate(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, '/')
}

async function sweepQuery(input: {
  query: string
  universe: MailUniverse
  mailboxes?: readonly SweepMailbox[]
  maxPerMailbox?: number
  dryRun?: boolean
  sb?: SB
}): Promise<SweepResult> {
  const sb = input.sb ?? createServiceClient()
  const mailboxes = input.mailboxes ?? CRM_MAILBOXES
  const res: SweepResult = { query: input.query, mailboxes: 0, seen: 0, filed: 0, queued: 0, ignored: 0, errors: 0, offers: 0, samples: [] }
  const seenKeys = new Set<string>()
  for (const mb of mailboxes) {
    const gmail = getGmailFor(mb.email, READONLY)
    if (!gmail) continue
    res.mailboxes++
    let pageToken: string | undefined
    let count = 0
    do {
      const list = await gmail.users.messages.list({ userId: 'me', q: input.query, maxResults: 100, pageToken })
      for (const m of list.data.messages ?? []) {
        if (!m.id) continue
        if (count++ >= (input.maxPerMailbox ?? 2000)) break
        const r = await indexGmailMessage({
          gmail,
          mailbox: mb.email,
          brokerSlug: mb.slug,
          gmailId: m.id,
          universe: input.universe,
          dryRun: input.dryRun,
          sb,
        })
        if (seenKeys.has(r.messageKey)) continue
        seenKeys.add(r.messageKey)
        res.seen++
        if (r.status === 'error') res.errors++
        else if (r.status === 'filed' || (r.decision?.status === 'filed' && input.dryRun)) res.filed++
        else if (r.status === 'ambiguous' || r.status === 'unfiled_transaction') res.queued++
        else res.ignored++
        if (r.offerId) res.offers++
        if (res.samples.length < 40 && (r.status !== 'not_deal' && r.status !== 'bulk')) {
          res.samples.push({ mailbox: mb.email, subject: r.subject, status: r.decision?.status ?? r.status, dealId: r.dealId ?? r.decision?.dealId ?? null })
        }
      }
      pageToken = list.data.nextPageToken ?? undefined
    } while (pageToken && count < (input.maxPerMailbox ?? 2000))
  }
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
  sb?: SB
}): Promise<SweepResult | null> {
  const sb = input.sb ?? createServiceClient()
  const universe = input.universe ?? (await loadMailUniverse(sb))
  const deal = universe.deals.find((d) => d.dealId === input.dealId)
  if (!deal) return null
  const terms = dealSearchTerms(deal)
  if (!terms.length) return null
  const since = input.since ? ` after:${gmailDate(input.since)}` : ''
  const res = await sweepQuery({ query: `(${terms.join(' OR ')}) -in:spam -in:trash${since}`, universe, dryRun: input.dryRun, sb })
  if (!input.dryRun) {
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
  sb?: SB
}): Promise<SweepResult> {
  const sb = input.sb ?? createServiceClient()
  const universe = input.universe ?? (await loadMailUniverse(sb))
  const since = input.since ? ` after:${gmailDate(input.since)}` : ''
  return sweepQuery({ query: `${TRANSACTION_SUBJECT_QUERY}${since}`, universe, dryRun: input.dryRun, maxPerMailbox: input.maxPerMailbox, sb })
}

/**
 * Re-decide queued mail (ambiguous, unfiled) against today's deals: a file
 * opened this morning collects the offers that arrived last week.
 */
export async function rematchQueuedMail(input: { universe?: MailUniverse; limit?: number; sb?: SB } = {}): Promise<{
  checked: number
  filed: number
  stillQueued: number
  errors: number
}> {
  const sb = input.sb ?? createServiceClient()
  const universe = input.universe ?? (await loadMailUniverse(sb))
  const { data: rows } = await sb
    .from('tc_mail_messages')
    .select('id, gmail_refs')
    .in('status', ['ambiguous', 'unfiled_transaction'])
    .eq('decided_by', 'system')
    .order('sent_at', { ascending: false })
    .limit(input.limit ?? 500)
  const out = { checked: 0, filed: 0, stillQueued: 0, errors: 0 }
  for (const row of rows ?? []) {
    const ref = ((row.gmail_refs as Array<{ mailbox?: string; broker?: string; gmail_id?: string }> | null) ?? [])[0]
    if (!ref?.mailbox || !ref.gmail_id) continue
    const gmail = getGmailFor(ref.mailbox, READONLY)
    if (!gmail) continue
    out.checked++
    const r = await indexGmailMessage({ gmail, mailbox: ref.mailbox, brokerSlug: ref.broker ?? 'matt', gmailId: ref.gmail_id, universe, sb })
    if (r.status === 'filed') out.filed++
    else if (r.status === 'error') out.errors++
    else out.stillQueued++
  }
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
