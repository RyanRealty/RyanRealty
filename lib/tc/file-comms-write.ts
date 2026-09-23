/**
 * Write inbound mail/SMS onto a Vault deal log + matching checklist.
 * Fail-open: callers must catch. Brokers do not log this by hand.
 *
 * Two halves:
 *  - fileCommsToVault: the SMS / MMS path. Resolves the deal from the people on
 *    the message, then files.
 *  - fileOntoDeal: files onto a deal someone already chose. The mail index
 *    (lib/tc/mail-index.ts) decides the deal with lib/tc/mail-rules.ts and calls
 *    this; the SMS path calls it after its own resolution.
 */
import 'server-only'
import { createHash } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { getDealParties, getDealsForPerson } from '@/lib/data/tc/deal-people'
import {
  LIVE_DEAL_STAGES,
  commsHaystack,
  matchChecklistItems,
  pickDealForComms,
  scoreDealHaystack,
  shouldCompleteFromOtherSideReturn,
  fromOtherSideContact,
  pickWaitingEnvelopesForExecutedDocument,
  type ChecklistCommsItem,
} from '@/lib/tc/file-comms'
import {
  classifyFromFormAndText,
  executionHintFromMail,
  inboundNeedsOurSignatures,
  shouldFileAsFullyExecuted,
  type ExecutionState,
} from '@/lib/tc/execution-state'
import { readPdfPagesText, type PdfTextRead } from '@/lib/tc/pdf-page-text'
import { existingDocumentIdByHash } from '@/lib/tc/document-dedupe'
import { extractOrefNumbers, identifyFormFromName, identifyFormFromText } from '@/lib/tc/form-identity'
import { ourRoleForEnvelope } from '@/lib/tc/representation'
import { isHouseAddress, normalizeEmail } from '@/lib/tc/mail-rules'

export type FileCommsAttachment = {
  sourceDocId: string
  name: string
  bytes: Buffer
  contentType: string
  /** Text already read by the caller (the mail index reads to decide the deal). */
  preRead?: PdfTextRead | null
}

export type FileCommsInput = {
  personIds: number[]
  /** From/To/Cc so other-side agents file onto the deal without being our clients. */
  emails?: string[]
  /** From addresses only. Our outbound To the other agent is not a return. */
  fromEmails?: string[]
  fromPhones?: string[]
  channel: 'mail' | 'sms'
  actor: string
  title?: string | null
  body?: string | null
  filenames?: string[]
  attachments?: FileCommsAttachment[]
  dedupeKey: string
}

export type FileCommsResult = {
  filed: boolean
  dealId?: string
  cycleId?: string
  documentIds: string[]
  checklistItemIds: string[]
  /** Execution state per new or re-used document. */
  documentStates?: Record<string, ExecutionState>
  /** The attachment each document came from, by sourceDocId. */
  documentBySource?: Record<string, string>
  skipped?: string
}

export async function fileCommsToVault(input: FileCommsInput): Promise<FileCommsResult> {
  const personIds = [...new Set(input.personIds.filter((id) => Number.isFinite(id) && id > 0))]
  // Our own addresses never identify a deal: a house address on a deal contact
  // matched every email in the broker inbox (2026-08-23 → 2026-09-23 misfile).
  const emails = [
    ...new Set(
      (input.emails ?? [])
        .map((e) => normalizeEmail(e))
        .filter((e) => e.includes('@') && !isHouseAddress(e)),
    ),
  ]
  if (!personIds.length && !emails.length) {
    return { filed: false, documentIds: [], checklistItemIds: [], skipped: 'no-person' }
  }

  const deals = []
  for (const pid of personIds) {
    const links = await getDealsForPerson(pid)
    deals.push(...links)
  }
  const sb = createServiceClient()
  if (emails.length) {
    const { data: contactHits } = await sb
      .from('tc_deal_contacts')
      .select('deal_id, tc_deals(address, stage)')
      .in('email', emails)
    for (const row of contactHits ?? []) {
      const deal = (row as { tc_deals?: { address?: string; stage?: string } }).tc_deals
      if (!row.deal_id || !deal) continue
      deals.push({
        dealId: String(row.deal_id),
        address: String(deal.address ?? ''),
        stage: String(deal.stage ?? ''),
        cycleId: null,
      })
    }
  }
  const unique = new Map(deals.map((d) => [d.dealId, d]))
  const haystack = commsHaystack({
    title: input.title,
    body: input.body,
    filenames: input.filenames ?? input.attachments?.map((a) => a.name),
  })
  let picked = pickDealForComms([...unique.values()], haystack)
  if (!picked) {
    const { data: live } = await sb
      .from('tc_deals')
      .select('id, address, stage')
      .in('stage', [...LIVE_DEAL_STAGES])
    const byAddr = pickDealForComms(
      (live ?? []).map((d) => ({ dealId: String(d.id), address: String(d.address), stage: String(d.stage) })),
      haystack,
    )
    if (byAddr && scoreDealHaystack(byAddr.address, haystack) >= 2) picked = byAddr
  }
  if (!picked) return { filed: false, documentIds: [], checklistItemIds: [], skipped: 'no-deal' }

  const { data: cycles } = await sb
    .from('tc_cycles')
    .select('id, kind')
    .eq('deal_id', picked.dealId)
    .order('created_at', { ascending: false })
    .limit(1)
  const cycleId = cycles?.[0]?.id ? String(cycles[0].id) : null
  if (!cycleId) {
    return { filed: false, dealId: picked.dealId, documentIds: [], checklistItemIds: [], skipped: 'no-cycle' }
  }

  return fileOntoDeal({
    dealId: picked.dealId,
    cycleId,
    channel: input.channel,
    actor: input.actor,
    title: input.title ?? null,
    haystack,
    attachments: input.attachments ?? [],
    filenames: input.filenames ?? input.attachments?.map((a) => a.name) ?? [],
    dedupeKey: input.dedupeKey,
    fromEmails: input.fromEmails,
    fromPhones: input.fromPhones,
    personIds,
    // The document reader places documents on the checklist once it has read
    // them (only fully executed copies go on); filing a text never does.
    checklist: 'none',
  })
}

export type FileOntoDealInput = {
  dealId: string
  cycleId: string
  channel: 'mail' | 'sms'
  actor: string
  title: string | null
  haystack: string
  attachments: FileCommsAttachment[]
  filenames: string[]
  dedupeKey: string
  fromEmails?: string[]
  fromPhones?: string[]
  personIds?: number[]
  /**
   * message_keyword: every attachment goes on every checklist row the message
   * text names (the SMS behaviour). identified: each attachment goes only on the
   * rows its own name, form and page-1 title identify. none: file the
   * documents, touch no checklist row (offers and counters not yet accepted).
   */
  checklist: 'message_keyword' | 'identified' | 'none'
  /** Stamped into the document classification and the event (mail index row id, category). */
  classificationExtra?: Record<string, unknown>
  eventExtra?: Record<string, unknown>
}

/**
 * The checklist rows ONE document satisfies, read from that document: its
 * name, the form its content identifies, and the title area of page 1 (where
 * "PRELIMINARY TITLE REPORT" or "EARNEST MONEY RECEIPT" is printed). Not the
 * email around it: one message about a disclosure used to put all three of its
 * attachments on the disclosure row. Signatures are not read here; stamped
 * signatures are image overlays with no text, and every assigned row still
 * goes through principal sign-off (OAR 863-015-0140), which checks them.
 */
function checklistHitsForDocument(
  items: readonly ChecklistCommsItem[],
  att: FileCommsAttachment,
  pageText: string,
): ChecklistCommsItem[] {
  const form = identifyFormFromText(pageText) ?? identifyFormFromName(att.name)
  const titleArea = pageText.replace(/<<<\s*Page\s+1\s*>>>/i, '').slice(0, 400)
  const hay = [att.name.replace(/[_.-]+/g, ' '), form?.name ?? '', form?.oref ? `OREF ${form.oref}` : '', titleArea].join(' ')
  return matchChecklistItems(items, hay)
}

/** File a message onto a deal someone already chose. Idempotent per (deal, dedupeKey). */
export async function fileOntoDeal(input: FileOntoDealInput): Promise<FileCommsResult> {
  const sb = createServiceClient()
  const action = input.channel === 'mail' ? 'mail_filed' : 'sms_filed'
  const { data: existing } = await sb
    .from('tc_events')
    .select('id')
    .eq('action', action)
    .eq('deal_id', input.dealId)
    .filter('detail->>dedupe', 'eq', input.dedupeKey)
    .limit(1)
  if (existing?.length) {
    return { filed: false, dealId: input.dealId, cycleId: input.cycleId, documentIds: [], checklistItemIds: [], skipped: 'duplicate' }
  }

  const { data: cycleRow } = await sb.from('tc_cycles').select('id, kind').eq('id', input.cycleId).maybeSingle()
  const cycleKind = cycleRow?.kind == null ? null : String(cycleRow.kind)
  const ourRole = ourRoleForEnvelope({
    cycleKind,
    ourPeopleRoles: (await getDealParties(input.dealId)).map((p) => p.role),
  })

  const { data: items } = await sb
    .from('tc_checklist_items')
    .select('id, name, type_name')
    .eq('cycle_id', input.cycleId)
  const messageHits = input.checklist === 'message_keyword' ? matchChecklistItems(items ?? [], input.haystack) : []
  const checklistItemIds = new Set(messageHits.map((h) => h.id))

  const documentIds: string[] = []
  const executionByDoc: Record<string, ExecutionState> = {}
  const nameByDoc: Record<string, string> = {}
  const formNumbersByDoc: Record<string, string[]> = {}
  const documentBySource: Record<string, string> = {}
  for (const att of input.attachments) {
    if (!att.bytes?.length) continue
    const sha256 = createHash('sha256').update(att.bytes).digest('hex')
    const sourceDocId = att.sourceDocId.slice(0, 180)
    const safeName = att.name.replace(/[^\w.\- ()]+/g, '_').slice(0, 120) || 'attachment.pdf'
    const path = `inbox/${input.cycleId}/${sourceDocId}__${safeName}`
    let pageText = ''
    let executionState: ExecutionState = 'unknown'
    let pageCount: number | null = null
    let pagesRead: number | null = null
    let readComplete = false
    try {
      if ((att.contentType || '').includes('pdf') || /\.pdf$/i.test(att.name)) {
        // Read every page. Signatures sit on the last pages of an OREF form, so a
        // capped read cannot tell "unsigned" from "not read that far".
        const read = att.preRead ?? (await readPdfPagesText(att.bytes))
        pageText = read.text
        pageCount = read.pageCount
        pagesRead = read.pagesRead
        readComplete = read.complete
        executionState = classifyFromFormAndText({
          form: { documentName: att.name, pageText },
          pageText,
          ourRole,
          textComplete: read.complete,
        })
      }
    } catch (err) {
      console.warn('[fileOntoDeal] pdf classify', err instanceof Error ? err.message : err)
    }
    const docHits =
      input.checklist === 'identified'
        ? checklistHitsForDocument(items ?? [], att, pageText)
        : input.checklist === 'none'
          ? []
          : messageHits
    // The same signed PDF reaches the file from the seal, our completion copy,
    // Gmail sync, and the other side's reply. Same bytes on this cycle is the
    // same document, whatever attachment id it arrived under.
    const alreadyFiled = await existingDocumentIdByHash(sb, input.cycleId, sha256)
    if (alreadyFiled) {
      if (!documentIds.includes(alreadyFiled)) documentIds.push(alreadyFiled)
      documentBySource[att.sourceDocId] = alreadyFiled
      executionByDoc[alreadyFiled] = executionState
      if (docHits.length) {
        await sb.from('tc_checklist_assignments').upsert(
          docHits.map((h) => ({ item_id: h.id, document_id: alreadyFiled })),
          { onConflict: 'item_id,document_id', ignoreDuplicates: true },
        )
        for (const h of docHits) checklistItemIds.add(h.id)
      }
      continue
    }
    const up = await sb.storage.from('tc-documents').upload(path, att.bytes, {
      contentType: att.contentType || 'application/pdf',
      upsert: true,
    })
    if (up.error) {
      console.warn('[fileOntoDeal] storage', up.error.message)
      continue
    }
    const form = pageText ? identifyFormFromText(pageText) : identifyFormFromName(att.name)
    const { data: doc, error: docErr } = await sb
      .from('tc_documents')
      .insert({
        cycle_id: input.cycleId,
        source_doc_id: sourceDocId,
        name: safeName,
        original_name: att.name,
        storage_path: path,
        sha256,
        bytes: att.bytes.byteLength,
        content_type: att.contentType || 'application/pdf',
        page_count: pageCount,
        classification: {
          source: input.channel === 'mail' ? 'gmail_auto_file' : 'twilio_auto_file',
          execution_state: executionState,
          form_number: form?.oref ?? null,
          form_name: form?.name ?? null,
          // The read that produced execution_state, so an auditor can see whether
          // the whole document was scanned.
          pages_read: pagesRead,
          page_count: pageCount,
          read_complete: readComplete,
          ...(input.classificationExtra ?? {}),
        },
      })
      .select('id')
      .maybeSingle()
    if (docErr) {
      if (!/duplicate|unique/i.test(docErr.message)) console.warn('[fileOntoDeal] document', docErr.message)
      continue
    }
    if (doc?.id) {
      const id = String(doc.id)
      documentIds.push(id)
      documentBySource[att.sourceDocId] = id
      executionByDoc[id] = executionState
      nameByDoc[id] = att.name
      formNumbersByDoc[id] = readComplete ? extractOrefNumbers(pageText) : []
      if (docHits.length) {
        await sb.from('tc_checklist_assignments').upsert(
          docHits.map((h) => ({ item_id: h.id, document_id: id })),
          { onConflict: 'item_id,document_id', ignoreDuplicates: true },
        )
        for (const h of docHits) checklistItemIds.add(h.id)
      }
    }
  }

  await sb.from('tc_events').insert({
    deal_id: input.dealId,
    cycle_id: input.cycleId,
    document_id: documentIds[0] ?? null,
    actor: input.actor,
    action,
    detail: {
      dedupe: input.dedupeKey,
      channel: input.channel,
      title: input.title ?? null,
      personIds: input.personIds ?? [],
      checklistItemIds: [...checklistItemIds],
      documentIds,
      filenames: input.filenames,
      ...(input.eventExtra ?? {}),
    },
  })

  const { data: otherContacts } = await sb
    .from('tc_deal_contacts')
    .select('email, phone, role')
    .eq('deal_id', input.dealId)
    .in('role', ['other_agent', 'other_party'])
  const otherEmails = new Set(
    (otherContacts ?? [])
      .map((c) => normalizeEmail(String(c.email ?? '')))
      .filter((e) => e.includes('@') && !isHouseAddress(e)),
  )
  const otherPhones = new Set(
    (otherContacts ?? [])
      .map((c) => String(c.phone ?? '').replace(/\D/g, '').slice(-10))
      .filter((p) => p.length === 10),
  )
  const fromEmails = (input.fromEmails ?? []).map((e) => normalizeEmail(e)).filter((e) => e.includes('@'))
  const fromPhones = (input.fromPhones ?? []).map((p) => p.replace(/\D/g, '').slice(-10)).filter((p) => p.length === 10)
  const fromOtherSide =
    fromOtherSideContact(fromEmails, otherEmails) || fromPhones.some((p) => otherPhones.has(p))
  const hint = executionHintFromMail(input.haystack, fromOtherSide)
  const states = Object.values(executionByDoc)
  // Only a document that is itself fully executed can close an envelope. Rolling
  // "any attachment executed" up to the whole message marked unsigned forms as
  // executed and attached the wrong PDF as the executed copy.
  const executedDocIds = documentIds.filter((id) => shouldFileAsFullyExecuted(executionByDoc[id] ?? 'unknown'))
  const anyNeedsOurs = states.some((s) => inboundNeedsOurSignatures(s, hint))
  if (anyNeedsOurs) {
    await sb.from('tc_events').insert({
      deal_id: input.dealId,
      cycle_id: input.cycleId,
      document_id: documentIds[0] ?? null,
      actor: input.actor,
      action: 'document_needs_our_signatures',
      detail: { title: input.title ?? null, execution: states, channel: input.channel, dedupe: input.dedupeKey },
    })
  }
  if (
    executedDocIds.length &&
    shouldCompleteFromOtherSideReturn({
      haystack: input.haystack,
      hasPdf: true,
      fromOtherSide,
      executionState: 'fully_executed',
    })
  ) {
    const { data: waiting } = await sb
      .from('tc_envelopes')
      .select('id, name')
      .eq('cycle_id', input.cycleId)
      .eq('status', 'awaiting_other_side')
    const now = new Date().toISOString()
    const claimed = new Set<string>()
    for (const returnedId of executedDocIds) {
      const targets = pickWaitingEnvelopesForExecutedDocument({
        waiting: waiting ?? [],
        haystack: input.haystack,
        documentName: nameByDoc[returnedId] ?? '',
        formNumbers: formNumbersByDoc[returnedId] ?? [],
      })
      for (const env of targets) {
        if (claimed.has(env.id)) continue
        claimed.add(env.id)
        await sb
          .from('tc_envelopes')
          .update({
            status: 'completed',
            completed_at: now,
            executed_document_id: returnedId,
          })
          .eq('id', env.id)
        await sb.from('tc_events').insert({
          deal_id: input.dealId,
          cycle_id: input.cycleId,
          document_id: returnedId,
          actor: input.actor,
          action: 'envelope_completed_from_return',
          detail: {
            envelope: env.name,
            channel: input.channel,
            title: input.title ?? null,
            matchedForms: formNumbersByDoc[returnedId] ?? [],
          },
        })
      }
    }
  }

  return {
    filed: true,
    dealId: input.dealId,
    cycleId: input.cycleId,
    documentIds,
    checklistItemIds: [...checklistItemIds],
    documentStates: executionByDoc,
    documentBySource,
  }
}
