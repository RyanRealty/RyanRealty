/**
 * Write inbound mail/SMS onto a Vault deal log + matching checklist.
 * Fail-open: callers must catch. Brokers do not log this by hand.
 */
import 'server-only'
import { createHash } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { getDealsForPerson } from '@/lib/data/tc/deal-people'
import {
  LIVE_DEAL_STAGES,
  commsHaystack,
  matchChecklistItems,
  pickDealForComms,
  scoreDealHaystack,
} from '@/lib/tc/file-comms'

export type FileCommsAttachment = {
  sourceDocId: string
  name: string
  bytes: Buffer
  contentType: string
}

export type FileCommsInput = {
  personIds: number[]
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
  if (!personIds.length) return { filed: false, documentIds: [], checklistItemIds: [], skipped: 'no-person' }

  const deals = []
  for (const pid of personIds) {
    const links = await getDealsForPerson(pid)
    deals.push(...links)
  }
  const unique = new Map(deals.map((d) => [d.dealId, d]))
  const haystack = commsHaystack({
    title: input.title,
    body: input.body,
    filenames: input.filenames ?? input.attachments?.map((a) => a.name),
  })
  let picked = pickDealForComms([...unique.values()], haystack)
  const sb = createServiceClient()
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
    .select('id')
    .eq('deal_id', picked.dealId)
    .order('created_at', { ascending: false })
    .limit(1)
  const cycleId = cycles?.[0]?.id ? String(cycles[0].id) : null
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
  for (const att of input.attachments ?? []) {
    if (!att.bytes?.length) continue
    const sha256 = createHash('sha256').update(att.bytes).digest('hex')
    const sourceDocId = att.sourceDocId.slice(0, 180)
    const safeName = att.name.replace(/[^\w.\- ()]+/g, '_').slice(0, 120) || 'attachment.pdf'
    const path = `inbox/${cycleId}/${sourceDocId}__${safeName}`
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
        classification: { source: input.channel === 'mail' ? 'gmail_auto_file' : 'twilio_auto_file' },
      })
      .select('id')
      .maybeSingle()
    if (docErr) {
      if (!/duplicate|unique/i.test(docErr.message)) console.warn('[fileCommsToVault] document', docErr.message)
      continue
    }
    if (doc?.id) {
      documentIds.push(String(doc.id))
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

  return {
    filed: true,
    dealId: picked.dealId,
    cycleId,
    documentIds,
    checklistItemIds,
  }
}
