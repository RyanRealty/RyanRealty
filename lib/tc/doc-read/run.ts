/**
 * The document reader, end to end, against the Vault tables.
 *
 *   readStoredDocument   read one tc_documents PDF (or reuse the read of the
 *                        identical file), store the reading, write the
 *                        verdict onto the document's classification
 *   planCycleDocuments   what the file should look like: one copy per form
 *                        instance, only executed copies on the checklist
 *   applyCyclePlan       do it, with an audit event per change; a removal
 *                        justified only by "not fully executed" needs a second
 *                        model to agree first
 *
 * Callers: /api/cron/tc-document-read (new and unread documents, every 15
 * minutes) and scripts/tc-doc-read-backfill.ts (history).
 */
import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { GROK_MODELS } from '@/lib/grok/client'
import { matchChecklistItems } from '@/lib/tc/file-comms'
import type { ExecutionState } from '@/lib/tc/execution-state'
import { readDocumentBytes, readerModel } from './read-document'
import { READER_VERSION, type DocumentReading } from './vision-reading'
import { documentVerdict, verdictFor, VERDICT_LABEL, type DocumentVerdict, type FormVerdict } from './verdict'
import { planLineage, type LineageAction, type LineageDoc, type LineageItem, type LineagePlan } from './lineage'
import { learnForms, loadFormRegistry, releasesFromAnatomy, type FormRegistry } from './registry'
import { crossCheckForms, reconcileWithForm } from './cross-check'
import { CHECKER_VERSION, type FormCheck } from '@/lib/tc/form-match/check'

export const READER_ACTOR = 'vault-reader'

/** classification.source values for files the Vault itself produced. */
const VAULT_MADE: ReadonlySet<string> = new Set(['envelope_executed', 'envelope_our_side_signed', 'oref_fill', 'oref_sealed', 'cda', 'listing_duplicate'])

type DocRow = {
  id: string
  name: string
  cycle_id: string
  storage_path: string | null
  sha256: string | null
  page_count: number | null
  archived: boolean
  classification: Record<string, unknown> | null
}

type CycleContext = { cycleId: string; dealId: string; kind: string; stage: string }

async function cycleContext(sb: SupabaseClient, cycleId: string): Promise<CycleContext | null> {
  const { data: cycle } = await sb.from('tc_cycles').select('id, kind, deal_id, tc_deals(stage)').eq('id', cycleId).maybeSingle()
  if (!cycle) return null
  const deal = (cycle as unknown as { tc_deals: { stage: string } | null }).tc_deals
  return { cycleId, dealId: String(cycle.deal_id), kind: String(cycle.kind), stage: deal?.stage ?? 'unknown' }
}

/**
 * The legacy execution_state the rest of the Vault reads (deal page labels,
 * envelope return matching), from the reader's verdict. "Ours" is the listing
 * side on a listing cycle and the buyer side on a sale cycle.
 */
export function legacyExecutionState(v: DocumentVerdict, cycleKind: string): ExecutionState {
  switch (v.verdict) {
    case 'fully_executed':
      return 'fully_executed'
    case 'reference':
      return 'not_a_signature_form'
    case 'unsigned':
    case 'blank':
      return 'unsigned'
    case 'partially_executed': {
      const ours = cycleKind === 'listing' ? ['seller', 'seller_agent'] : ['buyer', 'buyer_agent']
      const missing = v.forms.flatMap((f) => f.signers.filter((s) => !s.signed))
      if (missing.length && missing.every((s) => ours.includes(s.party))) return 'needs_our_signatures'
      if (missing.length && missing.every((s) => !ours.includes(s.party))) return 'our_side_signed'
      return 'unknown'
    }
    default:
      return 'unknown'
  }
}

/** What the deal page and the portal show, stored on tc_documents.classification.reader. */
/**
 * The form check for a document (lib/tc/form-match), when the current
 * checker has run on it: the second, independent read cross-check.ts holds
 * the reader to.
 */
async function formChecksFor(sb: SupabaseClient, documentId: string): Promise<FormCheck[] | null> {
  const { data } = await sb.from('tc_document_checks').select('forms').eq('document_id', documentId).eq('checker_version', CHECKER_VERSION).is('error', null).maybeSingle()
  return (data?.forms as FormCheck[] | undefined) ?? null
}

/** The reader's verdict, held to the check against the printed form. */
export function verdictWithChecks(reading: DocumentReading, registry: FormRegistry, checks: FormCheck[] | null): DocumentVerdict {
  const reconciled = reading.forms.map((f) => reconcileWithForm(f, checks))
  const forms = reconciled.map(({ reading: f, dropped }) => {
    const v = verdictFor(f, registry)
    return dropped.length ? { ...v, reasons: [...v.reasons, `Not counted, per the printed form: ${dropped.join('; ')}.`] } : v
  })
  return documentVerdict(
    crossCheckForms(
      forms,
      reconciled.map((r) => r.reading),
      checks,
    ),
  )
}

export function readerSummary(v: DocumentVerdict, readingId: string, model: string) {
  return {
    version: READER_VERSION,
    reading_id: readingId,
    model,
    read_at: new Date().toISOString(),
    verdict: v.verdict,
    label: VERDICT_LABEL[v.verdict],
    summary: v.summary,
    forms: v.forms.map((f: FormVerdict) => ({
      form: f.formName,
      profile: f.profileKey,
      basis: f.basis,
      rule: f.rule,
      confidence: f.confidence,
      instance: f.instanceNumber,
      counter_by: f.counterBy,
      sale_agreement_number: f.saleAgreementNumber,
      verdict: f.verdict,
      outcome: f.outcome,
      signers: f.signers.map((s) => ({ party: s.party, name: s.name, signed: s.signed, signed_as: s.signedAs, date: s.date, method: s.method })),
      reasons: f.reasons,
      checked_against: (f as { checkedAgainst?: string | null }).checkedAgainst ?? null,
      check_issues: (f as { checkIssues?: string[] }).checkIssues ?? [],
    })),
  }
}

export type ReadResult =
  | { ok: true; documentId: string; readingId: string; verdict: DocumentVerdict; costUsd: number; reused: boolean }
  | { ok: false; documentId: string; error: string }

/**
 * Read one document. A file already read (same bytes, same reader version) on
 * any deal is not paid for twice: its transcription is reused and the
 * verdict recomputed by the current rules.
 */
export async function readStoredDocument(
  sb: SupabaseClient,
  documentId: string,
  opts?: { model?: string; purpose?: 'read' | 'confirm'; force?: boolean },
): Promise<ReadResult> {
  const purpose = opts?.purpose ?? 'read'
  const model = opts?.model ?? readerModel()
  const { data: doc } = await sb
    .from('tc_documents')
    .select('id, name, cycle_id, storage_path, sha256, page_count, archived, classification')
    .eq('id', documentId)
    .maybeSingle<DocRow>()
  if (!doc?.storage_path) return { ok: false, documentId, error: 'no stored file' }
  const ctx = await cycleContext(sb, doc.cycle_id)
  if (!ctx) return { ok: false, documentId, error: 'cycle not found' }

  let sha = doc.sha256
  let reading: DocumentReading | null = null
  let anatomy: unknown = {}
  let pagesRead: number[] = []
  let pageCount: number | null = null
  let cost = 0
  let inputTokens: number | null = null
  let outputTokens: number | null = null
  let ms = 0
  let reusedModel: string | null = null

  if (sha && purpose === 'read' && !opts?.force) {
    const { data: prior } = await sb
      .from('tc_document_readings')
      .select('reading, anatomy, pages_read, page_count, model')
      .eq('sha256', sha)
      .eq('reader_version', READER_VERSION)
      .eq('status', 'read')
      .eq('purpose', 'read')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (prior) {
      reading = prior.reading as DocumentReading
      anatomy = prior.anatomy
      pagesRead = (prior.pages_read as number[]) ?? []
      pageCount = (prior.page_count as number | null) ?? null
      reusedModel = String(prior.model)
    }
  }

  if (!reading) {
    const { data: blob, error } = await sb.storage.from('tc-documents').download(doc.storage_path)
    if (error || !blob) return { ok: false, documentId, error: `download failed: ${error?.message ?? 'empty'}` }
    const bytes = new Uint8Array(await blob.arrayBuffer())
    if (!sha) sha = createHash('sha256').update(bytes).digest('hex')
    if (Buffer.from(bytes.subarray(0, 1024)).indexOf('%PDF') < 0) {
      // Recorded, so the queue stops handing this file back (MAX_READ_ATTEMPTS).
      await sb.from('tc_document_readings').insert({ document_id: documentId, sha256: sha, reader_version: READER_VERSION, model, purpose, status: 'failed', error: 'not a PDF' })
      return { ok: false, documentId, error: 'not a PDF' }
    }
    // A marker written BEFORE the read: if the read takes the process down
    // (a poster-size page ran the cron out of memory on 2026-09-24), nothing
    // after this line runs, and the marker is what counts the attempt.
    const { data: marker } = await sb
      .from('tc_document_readings')
      .insert({ document_id: documentId, sha256: sha, reader_version: READER_VERSION, model, purpose, status: 'failed', error: INTERRUPTED })
      .select('id')
      .single()
    const clearMarker = async () => {
      if (marker?.id) await sb.from('tc_document_readings').delete().eq('id', marker.id)
    }
    try {
      const read = await readDocumentBytes(bytes, { model })
      reading = read.reading
      anatomy = { segments: read.anatomy.segments, esign: read.anatomy.esign, scanned: read.anatomy.scanned, passes: read.passes }
      pagesRead = read.picks.map((p) => p.page)
      pageCount = read.anatomy.pageCount
      cost = read.costUsd
      inputTokens = read.passes.reduce((s, p) => s + (p.inputTokens ?? 0), 0)
      outputTokens = read.passes.reduce((s, p) => s + (p.outputTokens ?? 0), 0)
      ms = read.passes.reduce((s, p) => s + p.ms, 0)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      await sb.from('tc_document_readings').insert({
        document_id: documentId,
        sha256: sha,
        reader_version: READER_VERSION,
        model,
        purpose,
        status: 'failed',
        error: message.slice(0, 2000),
      })
      await clearMarker()
      return { ok: false, documentId, error: message }
    }
    await clearMarker()
  }

  // Every copy read teaches the registry who signs its forms (a new release
  // is learned the first time it arrives). The registry never blocks a read.
  if (purpose === 'read') {
    try {
      await learnForms(sb, { documentId, reading, releases: releasesFromAnatomy(anatomy) })
    } catch (e) {
      console.warn('[doc-read] registry', e instanceof Error ? e.message : e)
    }
  }
  const registry = await loadFormRegistry(sb)
  const verdict = verdictWithChecks(reading, registry, await formChecksFor(sb, documentId))
  const { data: row, error: insErr } = await sb
    .from('tc_document_readings')
    .insert({
      document_id: documentId,
      sha256: sha,
      reader_version: READER_VERSION,
      model: reusedModel ? `reuse:${reusedModel}` : model,
      purpose,
      status: 'read',
      page_count: pageCount,
      pages_read: pagesRead,
      anatomy,
      reading,
      verdict,
      cost_usd: cost,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      duration_ms: ms,
    })
    .select('id')
    .single()
  if (insErr || !row) return { ok: false, documentId, error: `store failed: ${insErr?.message}` }

  // A confirming read is evidence for a decision, not the document's record.
  if (purpose === 'read') {
    const first = verdict.forms[0]
    const classification = {
      ...(doc.classification ?? {}),
      execution_state: legacyExecutionState(verdict, ctx.kind),
      form_name: first?.formName ?? (doc.classification?.form_name as string | undefined) ?? null,
      reader: readerSummary(verdict, String(row.id), reusedModel ?? model),
    }
    const update: Record<string, unknown> = { classification }
    if (!doc.sha256 && sha) update.sha256 = sha
    if (pageCount && !doc.page_count) update.page_count = pageCount
    await sb.from('tc_documents').update(update).eq('id', documentId)
  }
  return { ok: true, documentId, readingId: String(row.id), verdict, costUsd: cost, reused: !!reusedModel }
}

/** Documents on a cycle, their current verdicts, and what a person already decided. */
export async function planCycleDocuments(sb: SupabaseClient, cycleId: string): Promise<{ plan: LineagePlan; ctx: CycleContext; docs: LineageDoc[] } | null> {
  const ctx = await cycleContext(sb, cycleId)
  if (!ctx) return null
  const { data: docs } = await sb
    .from('tc_documents')
    .select('id, name, content_type, bytes, sha256, ingested_at, classification')
    .eq('cycle_id', cycleId)
    .eq('archived', false)
    // Broker Notes are our own audit summaries, not transaction documents.
    .eq('is_broker_notes', false)
  const ids = (docs ?? []).map((d) => String(d.id))
  const { data: items } = await sb.from('tc_checklist_items').select('id, name, type_name, status').eq('cycle_id', cycleId)
  const itemIds = (items ?? []).map((i) => String(i.id))
  const { data: assigns } = itemIds.length
    ? await sb.from('tc_checklist_assignments').select('item_id, document_id').in('item_id', itemIds)
    : { data: [] as Array<{ item_id: string; document_id: string }> }
  const { data: decisions } = ids.length
    ? await sb
        .from('tc_events')
        .select('document_id, actor')
        .in('document_id', ids)
        .in('action', ['document_archived', 'document_unarchived'])
    : { data: [] as Array<{ document_id: string; actor: string }> }
  const { data: envDocs } = ids.length
    ? await sb.from('tc_envelope_documents').select('document_id').in('document_id', ids)
    : { data: [] as Array<{ document_id: string }> }
  const inEnvelope = new Set((envDocs ?? []).map((e) => String(e.document_id)))
  const personDecided = new Set(
    (decisions ?? [])
      .filter((e) => !String(e.actor).startsWith('system') && e.actor !== READER_ACTOR)
      .map((e) => String(e.document_id)),
  )

  const registry = await loadFormRegistry(sb)
  const lineageDocs: LineageDoc[] = []
  for (const d of docs ?? []) {
    const reader = (d.classification as { reader?: { reading_id?: string; version?: string } } | null)?.reader
    // The transcription is the fact; the verdict is derived, so it is
    // recomputed here by the current rules rather than trusted from the row.
    let verdict: DocumentVerdict | null = null
    if (reader?.reading_id && reader.version === READER_VERSION) {
      const { data: r } = await sb.from('tc_document_readings').select('reading').eq('id', reader.reading_id).maybeSingle()
      const reading = r?.reading as DocumentReading | undefined
      if (reading?.forms) verdict = verdictWithChecks(reading, registry, await formChecksFor(sb, String(d.id)))
    }
    lineageDocs.push({
      id: String(d.id),
      name: String(d.name),
      contentType: (d.content_type as string | null) ?? null,
      bytes: (d.bytes as number | null) ?? null,
      sha256: (d.sha256 as string | null) ?? null,
      ingestedAt: String(d.ingested_at),
      linkedItemIds: (assigns ?? []).filter((a) => String(a.document_id) === String(d.id)).map((a) => String(a.item_id)),
      personDecided: personDecided.has(String(d.id)),
      inEnvelope: inEnvelope.has(String(d.id)),
      generated: VAULT_MADE.has(String((d.classification as { source?: string } | null)?.source ?? '')),
      verdict,
    })
  }
  const lineageItems: LineageItem[] = (items ?? []).map((i) => ({
    id: String(i.id),
    name: String(i.name),
    typeName: (i.type_name as string | null) ?? null,
    locked: i.status === 'completed',
  }))
  const plan = planLineage({
    stage: ctx.stage,
    docs: lineageDocs,
    items: lineageItems,
    match: (its, hay) => matchChecklistItems(its.map((i) => ({ id: i.id, name: i.name, type_name: i.typeName })), hay).map((m) => its.find((i) => i.id === m.id)!),
  })
  return { plan, ctx, docs: lineageDocs }
}

/**
 * Only a removal whose sole ground is "not fully executed" needs a second
 * opinion: archiving an unfinished document on a closed deal, or taking an
 * unfinished document off the checklist. A copy superseded by an executed one
 * loses nothing, so it needs none.
 */
export function needsConfirmation(a: LineageAction): boolean {
  // A blank form is a judgment about the page too; only an identical file or
  // an email's inline image needs no second look.
  if (a.kind === 'archive') return a.supersededBy === null && !/^Duplicate of|^Not a transaction document/.test(a.reason)
  if (a.kind === 'unlink') return /^Not fully executed/.test(a.reason)
  return false
}

export type ApplyResult = { archived: number; linked: number; unlinked: number; flagged: number; confirmedDisagreed: number; costUsd: number }

export async function applyCyclePlan(
  sb: SupabaseClient,
  input: { plan: LineagePlan; ctx: CycleContext; docs: readonly LineageDoc[] },
  opts?: { confirmModel?: string; dryRun?: boolean },
): Promise<ApplyResult> {
  const { plan, ctx } = input
  const res: ApplyResult = { archived: 0, linked: 0, unlinked: 0, flagged: 0, confirmedDisagreed: 0, costUsd: 0 }
  const confirmModel = opts?.confirmModel ?? GROK_MODELS.documentsConfirm
  const confirmed = new Map<string, boolean>()
  const disagreed = new Set<string>()
  const now = new Date().toISOString()

  // The second reader must also find it unfinished (or blank): an executed,
  // reference or unsure reading stops the removal.
  const AGREES = ['partially_executed', 'unsigned', 'blank']
  async function secondOpinionAgrees(docId: string): Promise<boolean> {
    if (confirmed.has(docId)) return confirmed.get(docId)!
    // One confirmation per document per reader version: a disagreement stays a
    // disagreement (and a flag) instead of being paid for every run.
    const { data: prior } = await sb
      .from('tc_document_readings')
      .select('verdict')
      .eq('document_id', docId)
      .eq('purpose', 'confirm')
      .eq('reader_version', READER_VERSION)
      .eq('status', 'read')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    let agrees = false
    if (prior) {
      agrees = AGREES.includes(String((prior.verdict as { verdict?: string } | null)?.verdict ?? ''))
    } else {
      const r = await readStoredDocument(sb, docId, { model: confirmModel, purpose: 'confirm', force: true })
      if (r.ok) {
        res.costUsd += r.costUsd
        agrees = AGREES.includes(r.verdict.verdict)
      }
    }
    confirmed.set(docId, agrees)
    if (!agrees) {
      res.confirmedDisagreed += 1
      disagreed.add(docId)
    }
    return agrees
  }

  const event = (docId: string, action: string, detail: Record<string, unknown>) =>
    sb.from('tc_events').insert({ deal_id: ctx.dealId, cycle_id: ctx.cycleId, document_id: docId, actor: READER_ACTOR, action, detail })

  /**
   * One flag per document and reason. Not raised again while it is open, nor
   * after a person answered it; raised again only if the reader itself had
   * closed it as stale and the condition came back.
   */
  async function flagOnce(docId: string, reason: string, extra: Record<string, unknown> = {}) {
    const { data: history } = await sb
      .from('tc_events')
      .select('action, actor, detail, created_at')
      .eq('document_id', docId)
      .in('action', ['document_needs_review', 'document_review_resolved'])
      .order('created_at', { ascending: true })
    let raised = false
    for (const e of history ?? []) {
      const r = (e.detail as { reason?: string } | null)?.reason
      if (e.action === 'document_needs_review' && r === reason) raised = true
      else if (e.action === 'document_review_resolved' && e.actor === READER_ACTOR) raised = false
    }
    if (!raised) await event(docId, 'document_needs_review', { reason, ...extra })
  }

  for (const a of plan.actions) {
    if (a.kind !== 'flag' && needsConfirmation(a) && !(await secondOpinionAgrees(a.docId))) {
      res.flagged += 1
      if (!opts?.dryRun) {
        await flagOnce(a.docId, 'Two readers disagree on whether this document is fully executed. A person decides.', { proposed: a.kind })
      }
      continue
    }
    if (opts?.dryRun) {
      if (a.kind === 'archive') res.archived += 1
      else if (a.kind === 'link') res.linked += 1
      else if (a.kind === 'unlink') res.unlinked += 1
      else res.flagged += 1
      continue
    }
    if (a.kind === 'archive') {
      const { data: links } = await sb.from('tc_checklist_assignments').select('item_id').eq('document_id', a.docId)
      await sb
        .from('tc_documents')
        .update({ archived: true, archived_reason: a.reason, archived_at: now, superseded_by: a.supersededBy })
        .eq('id', a.docId)
        .eq('archived', false)
      if (links?.length) await sb.from('tc_checklist_assignments').delete().eq('document_id', a.docId)
      await event(a.docId, 'document_archived', {
        reason: a.reason,
        superseded_by: a.supersededBy,
        unlinked_items: (links ?? []).map((l) => l.item_id),
        reader_version: READER_VERSION,
      })
      res.archived += 1
    } else if (a.kind === 'unlink') {
      await sb.from('tc_checklist_assignments').delete().eq('document_id', a.docId).eq('item_id', a.itemId)
      await event(a.docId, 'document_unlinked_by_reader', { item_id: a.itemId, reason: a.reason })
      res.unlinked += 1
    } else if (a.kind === 'link') {
      await sb
        .from('tc_checklist_assignments')
        .upsert({ item_id: a.itemId, document_id: a.docId }, { onConflict: 'item_id,document_id', ignoreDuplicates: true })
      await event(a.docId, 'document_linked_by_reader', { item_id: a.itemId, reason: a.reason })
      res.linked += 1
    } else {
      await flagOnce(a.docId, a.reason)
      res.flagged += 1
    }
  }
  if (!opts?.dryRun) await closeStaleFlags(sb, input, plan, disagreed)
  return res
}

/**
 * Flags the reader raised earlier that its current rules no longer raise
 * (a rule was fixed, or the file changed) are closed by the reader itself,
 * so the review list only holds what is still true.
 */
async function closeStaleFlags(
  sb: SupabaseClient,
  input: { ctx: CycleContext; docs: readonly LineageDoc[] },
  plan: LineagePlan,
  disagreed: ReadonlySet<string>,
) {
  const ids = input.docs.map((d) => d.id)
  if (!ids.length) return
  const current = new Set([...plan.actions.filter((a) => a.kind === 'flag').map((a) => a.docId), ...disagreed])
  const { data: events } = await sb
    .from('tc_events')
    .select('document_id, action, actor, created_at')
    .in('document_id', ids)
    .in('action', ['document_needs_review', 'document_review_resolved'])
    .order('created_at', { ascending: true })
  const open = new Set<string>()
  for (const e of events ?? []) {
    const id = String(e.document_id)
    if (e.action === 'document_needs_review' && e.actor === READER_ACTOR) open.add(id)
    else if (e.action === 'document_review_resolved') open.delete(id)
  }
  const stale = [...open].filter((id) => !current.has(id))
  if (!stale.length) return
  await sb.from('tc_events').insert(
    stale.map((id) => ({
      deal_id: input.ctx.dealId,
      cycle_id: input.ctx.cycleId,
      document_id: id,
      actor: READER_ACTOR,
      action: 'document_review_resolved',
      detail: { note: 'No longer flagged by the current reader rules.', reader_version: READER_VERSION },
    })),
  )
}

/**
 * Re-derive a read document's verdict with the current rules and write it back
 * to its classification (no model call). Run after a rule change.
 */
export async function refreshVerdict(sb: SupabaseClient, documentId: string): Promise<DocumentVerdict | null> {
  const { data: doc } = await sb.from('tc_documents').select('id, cycle_id, classification').eq('id', documentId).maybeSingle()
  const reader = (doc?.classification as { reader?: { reading_id?: string; version?: string; model?: string } } | null)?.reader
  if (!doc || !reader?.reading_id || reader.version !== READER_VERSION) return null
  const { data: r } = await sb.from('tc_document_readings').select('reading').eq('id', reader.reading_id).maybeSingle()
  const reading = r?.reading as DocumentReading | undefined
  if (!reading?.forms) return null
  const ctx = await cycleContext(sb, String(doc.cycle_id))
  if (!ctx) return null
  const registry = await loadFormRegistry(sb)
  const verdict = verdictWithChecks(reading, registry, await formChecksFor(sb, documentId))
  const classification = {
    ...(doc.classification as Record<string, unknown>),
    execution_state: legacyExecutionState(verdict, ctx.kind),
    reader: readerSummary(verdict, reader.reading_id, reader.model ?? 'unknown'),
  }
  await sb.from('tc_documents').update({ classification }).eq('id', documentId)
  return verdict
}

/** What a read that never finished leaves behind (see readStoredDocument). */
export const INTERRUPTED = 'interrupted: the run stopped while reading this copy'

/**
 * A copy that failed this many times at the current reader version is left
 * for a person. Without the cap one bad file at the head of the queue (oldest
 * first) is handed back to every run, and a file that kills the process kills
 * every run: the cron read nothing from 09:35 to 16:00 UTC on 2026-09-24.
 */
export const MAX_READ_ATTEMPTS = 3

async function failedReadCounts(sb: SupabaseClient): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  for (let from = 0; ; from += 1000) {
    const { data } = await sb
      .from('tc_document_readings')
      .select('document_id')
      .eq('reader_version', READER_VERSION)
      .eq('purpose', 'read')
      .eq('status', 'failed')
      .order('id')
      .range(from, from + 999)
    for (const r of data ?? []) counts.set(String(r.document_id), (counts.get(String(r.document_id)) ?? 0) + 1)
    if (!data || data.length < 1000) break
  }
  return counts
}

/** Documents with no read by the current reader version, oldest first, skipping copies that keep failing. */
export async function unreadDocumentIds(sb: SupabaseClient, limit: number): Promise<string[]> {
  const failures = await failedReadCounts(sb)
  const out: string[] = []
  let from = 0
  while (out.length < limit) {
    const { data } = await sb
      .from('tc_documents')
      .select('id, classification')
      .eq('archived', false)
      .eq('is_broker_notes', false)
      // The reader reads PDFs; images and mail files are not forms.
      .or('content_type.eq.application/pdf,content_type.is.null')
      .not('storage_path', 'is', null)
      .order('ingested_at', { ascending: true })
      .range(from, from + 999)
    if (!data?.length) break
    for (const d of data) {
      const reader = (d.classification as { reader?: { version?: string } } | null)?.reader
      if (reader?.version !== READER_VERSION && (failures.get(String(d.id)) ?? 0) < MAX_READ_ATTEMPTS) out.push(String(d.id))
      if (out.length >= limit) break
    }
    if (data.length < 1000) break
    from += 1000
  }
  return out
}
