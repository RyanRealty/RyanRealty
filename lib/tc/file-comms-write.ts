/**
 * Write inbound mail/SMS onto a Vault deal log + matching checklist.
 * Fail-open: callers must catch. Brokers do not log this by hand.
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
  pickWaitingEnvelopesForReturn,
} from '@/lib/tc/file-comms'
import {
  classifyFromFormAndText,
  executionHintFromMail,
  inboundNeedsOurSignatures,
  shouldFileAsFullyExecuted,
  type ExecutionState,
} from '@/lib/tc/execution-state'
import { extractPdfPagesText } from '@/lib/tc/pdf-page-text'
import { ourRoleForEnvelope } from '@/lib/tc/representation'

export type FileCommsAttachment = {
  sourceDocId: string
  name: string
  bytes: Buffer
  contentType: string
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
  skipped?: string
}

export async function fileCommsToVault(input: FileCommsInput): Promise<FileCommsResult> {
  const personIds = [...new Set(input.personIds.filter((id) => Number.isFinite(id) && id > 0))]
  const emails = [...new Set((input.emails ?? []).map((e) => e.trim().toLowerCase()).filter((e) => e.includes('@')))]
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
  const action = input.channel === 'mail' ? 'mail_filed' : 'sms_filed'
  const { data: existing } = await sb
    .from('tc_events')
    .select('id')
    .eq('action', action)
    .eq('deal_id', picked.dealId)
    .filter('detail->>dedupe', 'eq', input.dedupeKey)
    .limit(1)
  if (existing?.length) {
    return { filed: false, dealId: picked.dealId, documentIds: [], checklistItemIds: [], skipped: 'duplicate' }
  }

  const { data: cycles } = await sb
    .from('tc_cycles')
    .select('id, kind')
    .eq('deal_id', picked.dealId)
    .order('created_at', { ascending: false })
    .limit(1)
  const cycleId = cycles?.[0]?.id ? String(cycles[0].id) : null
  const cycleKind = cycles?.[0]?.kind == null ? null : String(cycles[0].kind)
  const ourRole = ourRoleForEnvelope({
    cycleKind,
    ourPeopleRoles: (await getDealParties(picked.dealId)).map((p) => p.role),
  })
  if (!cycleId) {
    return { filed: false, dealId: picked.dealId, documentIds: [], checklistItemIds: [], skipped: 'no-cycle' }
  }

  const { data: items } = await sb
    .from('tc_checklist_items')
    .select('id, name, type_name')
    .eq('cycle_id', cycleId)
  const hits = matchChecklistItems(items ?? [], haystack)
  const checklistItemIds = hits.map((h) => h.id)

  const documentIds: string[] = []
  const executionByDoc: Record<string, ExecutionState> = {}
  for (const att of input.attachments ?? []) {
    if (!att.bytes?.length) continue
    const sha256 = createHash('sha256').update(att.bytes).digest('hex')
    const sourceDocId = att.sourceDocId.slice(0, 180)
    const safeName = att.name.replace(/[^\w.\- ()]+/g, '_').slice(0, 120) || 'attachment.pdf'
    const path = `inbox/${cycleId}/${sourceDocId}__${safeName}`
    let pageText = ''
    let executionState: ExecutionState = 'unknown'
    try {
      if ((att.contentType || '').includes('pdf') || /\.pdf$/i.test(att.name)) {
        pageText = await extractPdfPagesText(att.bytes, 8)
        executionState = classifyFromFormAndText({
          form: { documentName: att.name, pageText },
          pageText,
          ourRole,
        })
      }
    } catch (err) {
      console.warn('[fileCommsToVault] pdf classify', err instanceof Error ? err.message : err)
    }
    const up = await sb.storage.from('tc-documents').upload(path, att.bytes, {
      contentType: att.contentType || 'application/pdf',
      upsert: true,
    })
    if (up.error) {
      console.warn('[fileCommsToVault] storage', up.error.message)
      continue
    }
    const { data: doc, error: docErr } = await sb
      .from('tc_documents')
      .insert({
        cycle_id: cycleId,
        source_doc_id: sourceDocId,
        name: safeName,
        original_name: att.name,
        storage_path: path,
        sha256,
        bytes: att.bytes.byteLength,
        content_type: att.contentType || 'application/pdf',
        classification: {
          source: input.channel === 'mail' ? 'gmail_auto_file' : 'twilio_auto_file',
          execution_state: executionState,
        },
      })
      .select('id')
      .maybeSingle()
    if (docErr) {
      if (!/duplicate|unique/i.test(docErr.message)) console.warn('[fileCommsToVault] document', docErr.message)
      continue
    }
    if (doc?.id) {
      documentIds.push(String(doc.id))
      executionByDoc[String(doc.id)] = executionState
      if (checklistItemIds.length) {
        await sb.from('tc_checklist_assignments').upsert(
          checklistItemIds.map((item_id) => ({ item_id, document_id: doc.id })),
          { onConflict: 'item_id,document_id', ignoreDuplicates: true },
        )
      }
    }
  }

  await sb.from('tc_events').insert({
    deal_id: picked.dealId,
    cycle_id: cycleId,
    document_id: documentIds[0] ?? null,
    actor: input.actor,
    action,
    detail: {
      dedupe: input.dedupeKey,
      channel: input.channel,
      title: input.title ?? null,
      personIds,
      checklistItemIds,
      documentIds,
      filenames: input.filenames ?? input.attachments?.map((a) => a.name) ?? [],
    },
  })

  const { data: otherContacts } = await sb
    .from('tc_deal_contacts')
    .select('email, phone, role')
    .eq('deal_id', picked.dealId)
    .in('role', ['other_agent', 'other_party'])
  const otherEmails = new Set(
    (otherContacts ?? [])
      .map((c) => String(c.email ?? '').trim().toLowerCase())
      .filter((e) => e.includes('@')),
  )
  const otherPhones = new Set(
    (otherContacts ?? [])
      .map((c) => String(c.phone ?? '').replace(/\D/g, '').slice(-10))
      .filter((p) => p.length === 10),
  )
  const fromEmails = (input.fromEmails ?? []).map((e) => e.trim().toLowerCase()).filter((e) => e.includes('@'))
  const fromPhones = (input.fromPhones ?? []).map((p) => p.replace(/\D/g, '').slice(-10)).filter((p) => p.length === 10)
  const fromOtherSide =
    fromOtherSideContact(fromEmails, otherEmails) || fromPhones.some((p) => otherPhones.has(p))
  const hint = executionHintFromMail(haystack, fromOtherSide)
  const states = Object.values(executionByDoc)
  const anyFullyExecuted = states.some((s) => shouldFileAsFullyExecuted(s))
  const anyNeedsOurs = states.some((s) => inboundNeedsOurSignatures(s, hint))
  if (anyNeedsOurs) {
    await sb.from('tc_events').insert({
      deal_id: picked.dealId,
      cycle_id: cycleId,
      document_id: documentIds[0] ?? null,
      actor: input.actor,
      action: 'document_needs_our_signatures',
      detail: { title: input.title ?? null, execution: states, channel: input.channel },
    })
  }
  if (
    shouldCompleteFromOtherSideReturn({
      haystack,
      hasPdf: documentIds.length > 0,
      fromOtherSide,
      executionState: anyFullyExecuted ? 'fully_executed' : states[0] ?? 'unknown',
    })
  ) {
    const { data: waiting } = await sb
      .from('tc_envelopes')
      .select('id, name')
      .eq('cycle_id', cycleId)
      .eq('status', 'awaiting_other_side')
    const returnedId = documentIds.find((id) => shouldFileAsFullyExecuted(executionByDoc[id] ?? 'unknown')) ?? documentIds[0]
    const now = new Date().toISOString()
    const targets = pickWaitingEnvelopesForReturn(waiting ?? [], haystack)
    for (const env of targets) {
      await sb
        .from('tc_envelopes')
        .update({
          status: 'completed',
          completed_at: now,
          executed_document_id: returnedId,
        })
        .eq('id', env.id)
      await sb.from('tc_events').insert({
        deal_id: picked.dealId,
        cycle_id: cycleId,
        document_id: returnedId,
        actor: input.actor,
        action: 'envelope_completed_from_return',
        detail: { envelope: env.name, channel: input.channel, title: input.title ?? null },
      })
    }
  }

  return {
    filed: true,
    dealId: picked.dealId,
    cycleId,
    documentIds,
    checklistItemIds,
  }
}
