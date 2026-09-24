import 'server-only'

/**
 * Deal terms, read from the contract and placed on the file (Matt
 * 2026-09-24). I/O around the pure pieces in lib/tc/terms:
 *
 *   1. pick the contract forms on a document (the document reader already
 *      identified each form, its pages and whether it is executed),
 *   2. read their terms twice, independently (lib/tc/terms/read.ts), and keep
 *      what agrees, stored on tc_documents.classification.terms,
 *   3. resolve the chain for the cycle (sale agreement, counters, executed
 *      addenda, escrow papers) and write it to tc_cycles, one tc_events row
 *      per write with the document and page it came from.
 *
 * Matt 2026-09-24: "Contract wins, unless a person typed it." An empty field
 * is filled; a different value a machine wrote (the SkySlope import, an email)
 * is replaced, the old value kept in tc_events; a different value a person
 * typed (tc_cycles.term_provenance, lib/tc/terms/provenance.ts) is never
 * overwritten: it is flagged for Matt, who uses the contract's value or keeps
 * the file's (app/actions/tc-deal-terms.ts).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'
import { getAdminContext } from '@/lib/auth/guards'
import { isFinishedFile } from '@/lib/tc/file-workspace'
import { dealVisibleToBroker } from '@/lib/tc/deal-scope'
import { READER_VERSION } from '@/lib/tc/doc-read/vision-reading'
import { TERM_COLUMN_LABEL, planTermsWrite, type CycleTermColumns, type TermColumn, type TermConflict, type TermsPlan, type TermWrite } from '@/lib/tc/terms/plan'
import { TERM_FIELD_LABEL, conflictKey, formIsThisCycles, groupReadings, orderTermsQueue, unsettledKey, type TermsReviewItem } from '@/lib/tc/terms/review'
import { parseProvenance, stampProvenance, type TermProvenance } from '@/lib/tc/terms/provenance'
import { readTermsTwice, readThird, type ReaderRun, type TermsForm, type TermsRead } from '@/lib/tc/terms/read'
import { TIEBREAK_FIELDS, TIEBREAK_VERSION, disputesToSettle, needsTiebreak, settleWithThird, type Settlement, type UnsettledDisagreement } from '@/lib/tc/terms/tiebreak'
import { resolveCycleTerms, type Instrument, type ResolvedTerms } from '@/lib/tc/terms/resolve'
import { TERMS_VERSION, instrumentKindForTitle, type InstrumentKind, type TermsDocumentReading, type TermsReading } from '@/lib/tc/terms/schema'

type Obj = Record<string, unknown>

/** A copy whose terms read failed this many times is left for a person. */
export const MAX_TERMS_ATTEMPTS = 3

/** Which reader verdicts are worth reading terms from, per instrument. */
const READ_WHEN: Record<InstrumentKind, ReadonlySet<string>> = {
  sale_agreement: new Set(['fully_executed', 'countered', 'needs_review']),
  counteroffer: new Set(['fully_executed', 'countered', 'partially_executed', 'needs_review']),
  addendum: new Set(['fully_executed']),
  earnest_money_receipt: new Set(['fully_executed', 'partially_executed', 'unsigned', 'reference', 'needs_review']),
  settlement_statement: new Set(['fully_executed', 'partially_executed', 'unsigned', 'reference', 'needs_review']),
}

export type TermsFormWithVerdict = TermsForm & { verdict: string }

/** What classification.terms holds. */
export type StoredTerms = {
  version: string
  status: 'read' | 'failed' | 'none'
  read_at: string
  attempts: number
  forms: TermsFormWithVerdict[]
  agreed: TermsReading[]
  form_indexes: number[]
  /** What the readers still read differently, after the third read. */
  disagreements: UnsettledDisagreement[]
  unmatched: number
  readers?: TermsRead['runs']
  raw?: { claude: unknown; grok: unknown }
  /** The third read (lib/tc/terms/tiebreak.ts): what it settled, and whether every disputed form got a reading. */
  tiebreak?: { version: string; at: string; attempts: number; complete: boolean; settled: Settlement[]; runs: ReaderRun[] }
  /** Terms Matt settled by hand in the review queue. */
  confirmed?: Array<{ instrument: number; field: string; value: unknown; by: string; at: string }>
  reused_from?: string
  error?: string | null
}

/** A third read that failed is tried again, up to this many times. */
export const MAX_TIEBREAK_ATTEMPTS = 3

/** A stored reading the third read has yet to settle. */
export function wantsTiebreak(t: Pick<StoredTerms, 'status' | 'disagreements' | 'tiebreak'> | null | undefined): boolean {
  if (!t || t.status !== 'read' || !needsTiebreak(t.disagreements)) return false
  if (!t.tiebreak || t.tiebreak.version !== TIEBREAK_VERSION) return true
  return !t.tiebreak.complete && t.tiebreak.attempts < MAX_TIEBREAK_ATTEMPTS
}

/** Run the third read on a stored two-reader reading and fold it in. */
async function withThirdRead(stored: StoredTerms, bytes: Uint8Array): Promise<StoredTerms> {
  const first = stored.raw?.claude as TermsDocumentReading | null | undefined
  const second = stored.raw?.grok as TermsDocumentReading | null | undefined
  if (!first || !second) return stored
  const disputes = disputesToSettle(stored.disagreements, stored.forms)
  if (!disputes.length) return stored
  const third = await readThird(bytes, disputes)
  const r = settleWithThird(stored, first, second, third.readings)
  const priorAttempts = stored.tiebreak?.version === TIEBREAK_VERSION ? stored.tiebreak.attempts : 0
  return {
    ...stored,
    agreed: r.agreed,
    disagreements: r.disagreements,
    tiebreak: {
      version: TIEBREAK_VERSION,
      at: new Date().toISOString(),
      attempts: priorAttempts + 1,
      complete: disputes.every((d) => third.readings.get(d.instrument) != null),
      settled: [...(stored.tiebreak?.settled ?? []), ...r.settled],
      runs: third.runs,
    },
  }
}

// ── 1. the contract forms on a document ─────────────────────────────────────

type ReaderRow = { anatomy: { segments?: Array<{ id: number; pages: number[] }> } | null; verdict: { forms?: Array<{ segment: number; formName: string; verdict: string }> } | null }

export async function termsFormsForDocument(sb: SupabaseClient, classification: Obj | null): Promise<TermsFormWithVerdict[]> {
  const reader = (classification?.reader ?? null) as { version?: string; reading_id?: string } | null
  if (!reader?.reading_id || reader.version !== READER_VERSION) return []
  const { data } = await sb.from('tc_document_readings').select('anatomy, verdict').eq('id', reader.reading_id).maybeSingle<ReaderRow>()
  const segments = new Map((data?.anatomy?.segments ?? []).map((s) => [s.id, s.pages]))
  const out: TermsFormWithVerdict[] = []
  for (const f of data?.verdict?.forms ?? []) {
    const kind = instrumentKindForTitle(f.formName)
    if (!kind || !READ_WHEN[kind].has(f.verdict)) continue
    const pages = segments.get(f.segment) ?? []
    if (pages.length) out.push({ kind, title: f.formName, pages, verdict: f.verdict })
  }
  return out
}

// ── 2. read one document ────────────────────────────────────────────────────

export type TermsReadResult = { documentId: string; status: StoredTerms['status'] | 'skipped'; forms: number; agreedTerms: number; disagreements: number; error?: string; stored?: StoredTerms }

function countTerms(r: TermsReading[]): number {
  let n = 0
  for (const i of r) for (const v of Object.values(i)) if (v && typeof v === 'object' && !Array.isArray(v) && 'value' in (v as object)) n++
  return n
}

/**
 * Read the terms of one document. `dry` reads and returns without storing.
 * A copy with the same bytes already read at this version is reused, not paid
 * for twice.
 */
export async function readDocumentTerms(documentId: string, opts: { dry?: boolean; sb?: SupabaseClient } = {}): Promise<TermsReadResult> {
  const sb = opts.sb ?? createServiceClient()
  const { data: doc } = await sb.from('tc_documents').select('id, name, storage_path, sha256, archived, classification').eq('id', documentId).maybeSingle()
  if (!doc) return { documentId, status: 'skipped', forms: 0, agreedTerms: 0, disagreements: 0, error: 'not found' }
  const classification = (doc.classification ?? {}) as Obj
  const prior = classification.terms as StoredTerms | undefined
  const forms = await termsFormsForDocument(sb, classification)

  const store = async (stored: StoredTerms) => {
    if (opts.dry) return
    // Re-read just before writing: the reader and the form checker also write classification.
    const { data: fresh } = await sb.from('tc_documents').select('classification').eq('id', documentId).maybeSingle()
    await sb.from('tc_documents').update({ classification: { ...((fresh?.classification as Obj | null) ?? {}), terms: stored } }).eq('id', documentId)
  }
  const now = new Date().toISOString()
  const empty = { agreed: [], form_indexes: [], disagreements: [], unmatched: 0 }

  if (!forms.length) {
    const stored: StoredTerms = { version: TERMS_VERSION, status: 'none', read_at: now, attempts: 0, forms: [], ...empty }
    await store(stored)
    return { documentId, status: 'none', forms: 0, agreedTerms: 0, disagreements: 0, stored }
  }

  if (doc.sha256) {
    const { data: twins } = await sb.from('tc_documents').select('id, classification').eq('sha256', doc.sha256).neq('id', documentId).limit(10)
    const twin = (twins ?? []).find((t) => {
      const x = (t.classification as Obj | null)?.terms as StoredTerms | undefined
      return x?.version === TERMS_VERSION && x.status === 'read'
    })
    if (twin) {
      const stored = { ...((twin.classification as Obj).terms as StoredTerms), reused_from: String(twin.id), read_at: now }
      await store(stored)
      return { documentId, status: 'read', forms: stored.forms.length, agreedTerms: countTerms(stored.agreed), disagreements: stored.disagreements.length, stored }
    }
  }

  if (!doc.storage_path) return { documentId, status: 'skipped', forms: forms.length, agreedTerms: 0, disagreements: 0, error: 'no stored file' }
  const { data: blob, error } = await sb.storage.from('tc-documents').download(String(doc.storage_path))
  if (error || !blob) return { documentId, status: 'skipped', forms: forms.length, agreedTerms: 0, disagreements: 0, error: `download: ${error?.message ?? 'empty'}` }
  const bytes = new Uint8Array(await blob.arrayBuffer())

  // Read at this version already, with a dispute the third read has not settled: only the third read runs.
  if (prior?.version === TERMS_VERSION && wantsTiebreak(prior)) {
    const settled = await withThirdRead(prior, bytes)
    await store(settled)
    return { documentId, status: 'read', forms: settled.forms.length, agreedTerms: countTerms(settled.agreed), disagreements: settled.disagreements.length, stored: settled }
  }

  const read = await readTermsTwice(bytes, forms)
  const attempts = (prior?.version === TERMS_VERSION ? prior.attempts ?? 0 : 0) + 1
  if (!read.agreed) {
    const errorText = [read.runs.claude.error && `claude: ${read.runs.claude.error}`, read.runs.grok.error && `grok: ${read.runs.grok.error}`].filter(Boolean).join(' · ') || 'a reader returned nothing'
    const stored: StoredTerms = { version: TERMS_VERSION, status: 'failed', read_at: now, attempts, forms, ...empty, readers: read.runs, error: errorText }
    await store(stored)
    return { documentId, status: 'failed', forms: forms.length, agreedTerms: 0, disagreements: 0, error: errorText, stored }
  }
  const stored: StoredTerms = {
    version: TERMS_VERSION,
    status: 'read',
    read_at: now,
    attempts,
    forms,
    agreed: read.agreed.reading.instruments,
    form_indexes: read.agreed.formIndexes,
    disagreements: read.agreed.disagreements,
    unmatched: read.agreed.unmatched,
    readers: read.runs,
    raw: { claude: read.claude, grok: read.grok },
    error: null,
  }
  const final = wantsTiebreak(stored) ? await withThirdRead(stored, bytes) : stored
  await store(final)
  return { documentId, status: 'read', forms: forms.length, agreedTerms: countTerms(final.agreed), disagreements: final.disagreements.length, stored: final }
}

/**
 * Documents to read next: the current reader has read them, their terms are
 * not read at this version, and they have not failed MAX_TERMS_ATTEMPTS times.
 * Files on live deals first, then the newest.
 */
export async function pendingTermsDocuments(limit: number, sb: SupabaseClient = createServiceClient()): Promise<string[]> {
  const rows: Array<{
    id: string
    cycle_id: string
    ingested_at: string
    reader_version: string | null
    forms: Array<{ form?: string; verdict?: string }> | null
    terms_version: string | null
    terms_status: string | null
    terms_attempts: string | null
    terms_disagreements: StoredTerms['disagreements'] | null
    terms_tiebreak: StoredTerms['tiebreak'] | null
  }> = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from('tc_documents')
      .select('id, cycle_id, ingested_at, reader_version:classification->reader->>version, forms:classification->reader->forms, terms_version:classification->terms->>version, terms_status:classification->terms->>status, terms_attempts:classification->terms->>attempts, terms_disagreements:classification->terms->disagreements, terms_tiebreak:classification->terms->tiebreak')
      .eq('archived', false)
      .not('storage_path', 'is', null)
      .order('id')
      .range(from, from + 999)
    if (error) throw new Error(`pendingTermsDocuments: ${error.message}`)
    rows.push(...((data ?? []) as unknown as typeof rows))
    if (!data || data.length < 1000) break
  }
  const candidates = rows.filter((r) => {
    if (r.reader_version !== READER_VERSION) return false
    if (!(r.forms ?? []).some((f) => instrumentKindForTitle(f.form) && READ_WHEN[instrumentKindForTitle(f.form)!].has(String(f.verdict)))) return false
    if (r.terms_version !== TERMS_VERSION) return true
    if (r.terms_status === 'read') return wantsTiebreak({ status: 'read', disagreements: r.terms_disagreements ?? [], tiebreak: r.terms_tiebreak ?? undefined })
    return r.terms_status === 'failed' && Number(r.terms_attempts ?? 0) < MAX_TERMS_ATTEMPTS
  })
  if (!candidates.length) return []
  const cycleIds = Array.from(new Set(candidates.map((c) => c.cycle_id)))
  const live = new Set<string>()
  for (let i = 0; i < cycleIds.length; i += 200) {
    const { data } = await sb.from('tc_cycles').select('id, tc_deals!inner(stage)').in('id', cycleIds.slice(i, i + 200))
    for (const c of (data ?? []) as Array<{ id: string; tc_deals: { stage: string } | Array<{ stage: string }> }>) {
      const stage = Array.isArray(c.tc_deals) ? c.tc_deals[0]?.stage : c.tc_deals?.stage
      if (stage && stage !== 'closed' && stage !== 'dead') live.add(String(c.id))
    }
  }
  return candidates
    .sort((a, b) => Number(live.has(b.cycle_id)) - Number(live.has(a.cycle_id)) || String(b.ingested_at).localeCompare(String(a.ingested_at)))
    .slice(0, limit)
    .map((c) => c.id)
}

// ── 3. the cycle ────────────────────────────────────────────────────────────

const CYCLE_TERM_SELECT = 'id, deal_id, kind, status, updated_at, sale_price, earnest_money, contract_acceptance_date, escrow_closing_date, inspection_days, financing_days, escrow_company, escrow_number, buyers, sellers, term_provenance'

export type CycleTerms = {
  cycleId: string
  terms: ResolvedTerms
  plan: TermsPlan
  provenance: TermProvenance
  /** Terms the readers still read differently after the third read, per document: for Matt. */
  disagreements: Array<UnsettledDisagreement & { documentId: string; documentName: string }>
  /** Contract documents whose terms are not read yet, or failed. */
  unread: number
  failed: number
}

function asColumns(c: Obj): CycleTermColumns {
  const arr = (v: unknown) => (Array.isArray(v) ? v.map(String) : [])
  return {
    sale_price: c.sale_price == null ? null : Number(c.sale_price),
    earnest_money: c.earnest_money ?? null,
    contract_acceptance_date: (c.contract_acceptance_date as string | null) ?? null,
    escrow_closing_date: (c.escrow_closing_date as string | null) ?? null,
    inspection_days: c.inspection_days == null ? null : Number(c.inspection_days),
    financing_days: c.financing_days == null ? null : Number(c.financing_days),
    escrow_company: (c.escrow_company as string | null) ?? null,
    escrow_number: (c.escrow_number as string | null) ?? null,
    buyers: arr(c.buyers),
    sellers: arr(c.sellers),
  }
}

type TermsDocRow = { id: string; name: string; terms: StoredTerms | null; reader_version: string | null; forms: Array<{ form?: string; verdict?: string }> | null }
const TERMS_DOC_SELECT = 'id, cycle_id, name, terms:classification->terms, reader_version:classification->reader->>version, forms:classification->reader->forms'

/** The standing terms of one cycle from its row and its documents. */
function cycleTermsFrom(cycle: Obj, docs: TermsDocRow[]): CycleTerms {
  const instruments: Instrument[] = []
  const disagreements: CycleTerms['disagreements'] = []
  let unread = 0
  let failed = 0
  for (const d of docs) {
    const isContract = (d.forms ?? []).some((f) => instrumentKindForTitle(f.form) && READ_WHEN[instrumentKindForTitle(f.form)!].has(String(f.verdict)))
    const t = d.terms
    if (!t || t.version !== TERMS_VERSION) {
      if (isContract) unread++
      continue
    }
    if (t.status === 'failed') failed++
    if (t.status !== 'read') continue
    t.agreed.forEach((reading, k) => {
      const form = t.forms[t.form_indexes[k]]
      if (form) instruments.push({ documentId: d.id, documentName: d.name, verdict: form.verdict, reading })
    })
    for (const x of t.disagreements) disagreements.push({ ...x, documentId: d.id, documentName: d.name })
  }
  const columns = asColumns(cycle)
  const provenance = parseProvenance(cycle.term_provenance)
  const terms = resolveCycleTerms(instruments, { buyers: columns.buyers ?? [], contractAcceptanceDate: columns.contract_acceptance_date })
  return { cycleId: String(cycle.id), terms, plan: planTermsWrite(terms, columns, provenance), provenance, disagreements, unread, failed }
}

/** The standing terms of one cycle and what they would change. Reads only. */
export async function getCycleTerms(cycleId: string, sb: SupabaseClient = createServiceClient()): Promise<CycleTerms | null> {
  const { data: cycle } = await sb.from('tc_cycles').select(CYCLE_TERM_SELECT).eq('id', cycleId).maybeSingle()
  if (!cycle || cycle.kind !== 'sale') return null
  const { data: docs } = await sb.from('tc_documents').select(TERMS_DOC_SELECT).eq('cycle_id', cycleId).eq('archived', false)
  return cycleTermsFrom(cycle as Obj, (docs ?? []) as unknown as TermsDocRow[])
}

export type ApplyTermsResult = {
  cycleId: string
  filled: Array<{ column: TermColumn; display: string }>
  replaced: Array<{ column: TermColumn; from: string; to: string }>
  conflicts: number
  skipped?: string
}

/** Each written column stamped as the contract's, with the document and page it came from. */
function contractStamp(current: unknown, writes: Array<TermWrite | TermConflict>, at: string): TermProvenance {
  let p = parseProvenance(current)
  for (const w of writes) {
    p = stampProvenance(p, { [w.column]: w.value }, 'contract', { at, actor: 'deal-terms-reader', document: w.source?.documentName ?? null, page: w.source?.page ?? null })
  }
  return p
}

const sourceOf = (w: TermWrite | TermConflict) => ({ document: w.source?.documentName ?? null, instrument: w.source?.instrument ?? null, page: w.source?.page ?? null, quote: w.source?.quote ?? null })

/**
 * Write the executed agreement to one cycle: fill empty fields, replace the
 * ones a machine wrote. The update only lands if the cycle row has not
 * changed since it was read.
 */
export async function applyCycleTerms(cycleId: string, sb: SupabaseClient = createServiceClient()): Promise<ApplyTermsResult> {
  const state = await getCycleTerms(cycleId, sb)
  const none = { cycleId, filled: [], replaced: [] }
  if (!state) return { ...none, conflicts: 0, skipped: 'not a sale cycle' }
  const { fills, replaces, conflicts } = state.plan
  if (!fills.length && !replaces.length) return { ...none, conflicts: conflicts.length }
  const { data: row } = await sb.from('tc_cycles').select('deal_id, updated_at, term_provenance').eq('id', cycleId).maybeSingle()
  if (!row) return { ...none, conflicts: 0, skipped: 'cycle gone' }
  const at = new Date().toISOString()
  const patch: Obj = { updated_at: at, term_provenance: contractStamp(row.term_provenance, [...fills, ...replaces], at) }
  for (const f of fills) patch[f.column] = f.value
  for (const r of replaces) patch[r.column] = r.value
  const { data: updated, error } = await sb.from('tc_cycles').update(patch).eq('id', cycleId).eq('updated_at', row.updated_at).select('id')
  if (error) throw new Error(`applyCycleTerms: ${error.message}`)
  if (!updated?.length) return { ...none, conflicts: conflicts.length, skipped: 'the cycle changed while reading; next run' }
  const events: Obj[] = []
  if (fills.length) {
    events.push({
      deal_id: row.deal_id,
      cycle_id: cycleId,
      actor: 'deal-terms-reader',
      action: 'deal_terms_filled',
      detail: {
        version: TERMS_VERSION,
        fields: fills.map((f) => ({ column: f.column, value: f.display, ...sourceOf(f) })),
        note: 'Filled from the executed agreement; the readers agreed on every value.',
      },
    })
  }
  if (replaces.length) {
    events.push({
      deal_id: row.deal_id,
      cycle_id: cycleId,
      actor: 'deal-terms-reader',
      action: 'deal_terms_replaced',
      detail: {
        version: TERMS_VERSION,
        fields: replaces.map((r) => ({ column: r.column, from: r.current, to: r.contract, previously_by: state.provenance[r.column]?.by ?? 'import', ...sourceOf(r) })),
        note: 'The executed agreement replaced values a machine wrote (import or email); a value a person typed is never replaced.',
      },
    })
  }
  await sb.from('tc_events').insert(events)
  return {
    cycleId,
    filled: fills.map((f) => ({ column: f.column, display: f.display })),
    replaced: replaces.map((r) => ({ column: r.column, from: r.current, to: r.contract })),
    conflicts: conflicts.length,
  }
}

/**
 * A person settles one conflict: the contract's value replaces the file's.
 * The caller checks the capability; this records who did it.
 */
export async function acceptContractValue(
  cycleId: string,
  column: TermColumn,
  who: { email: string; role: string; brokerSlug: string | null },
  sb: SupabaseClient = createServiceClient(),
): Promise<{ ok: boolean; error?: string; propertyKey?: string }> {
  const { data: row } = await sb.from('tc_cycles').select('deal_id, tc_deals(property_key, broker_name)').eq('id', cycleId).maybeSingle()
  const deal = (Array.isArray(row?.tc_deals) ? row?.tc_deals[0] : row?.tc_deals) as { property_key?: string; broker_name?: string | null } | undefined
  if (!row || !dealVisibleToBroker({ role: who.role, brokerSlug: who.brokerSlug, dealBrokerName: deal?.broker_name ?? null })) {
    return { ok: false, error: 'This file is not yours to change.' }
  }
  const state = await getCycleTerms(cycleId, sb)
  const conflict = state?.plan.conflicts.find((c) => c.column === column) ?? state?.plan.replaces.find((c) => c.column === column)
  if (!state || !conflict) return { ok: false, error: 'That value no longer differs from the contract.' }
  const at = new Date().toISOString()
  const term_provenance = stampProvenance(state.provenance, { [column]: conflict.value }, 'contract', { at, actor: who.email, document: conflict.source?.documentName ?? null, page: conflict.source?.page ?? null })
  const { error } = await sb.from('tc_cycles').update({ [column]: conflict.value, term_provenance, updated_at: at }).eq('id', cycleId)
  if (error) return { ok: false, error: error.message }
  await sb.from('tc_events').insert({
    deal_id: row.deal_id ?? null,
    cycle_id: cycleId,
    actor: who.email,
    action: 'deal_terms_accepted',
    detail: { column, from: conflict.current, to: conflict.contract, document: conflict.source?.documentName ?? null, page: conflict.source?.page ?? null },
  })
  return { ok: true, propertyKey: deal?.property_key }
}

/**
 * Matt keeps the file's value against the contract's. The typed value stays;
 * this contract value is not flagged again (a different one would be). The
 * caller checks that the actor is the principal broker.
 */
export async function keepFileValue(
  cycleId: string,
  column: TermColumn,
  who: { email: string },
  sb: SupabaseClient = createServiceClient(),
): Promise<{ ok: boolean; error?: string; propertyKey?: string }> {
  const state = await getCycleTerms(cycleId, sb)
  const conflict = state?.plan.conflicts.find((c) => c.column === column)
  if (!state || !conflict) return { ok: false, error: 'That value no longer differs from the contract.' }
  const current = state.provenance[column]
  if (!current) return { ok: false, error: 'Only a value a person typed can be kept against the contract.' }
  const term_provenance: TermProvenance = { ...state.provenance, [column]: { ...current, keptAgainst: conflict.contract } }
  const { data: row, error } = await sb
    .from('tc_cycles')
    .update({ term_provenance })
    .eq('id', cycleId)
    .select('deal_id, tc_deals(property_key)')
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  const deal = (Array.isArray(row?.tc_deals) ? row?.tc_deals[0] : row?.tc_deals) as { property_key?: string } | undefined
  await sb.from('tc_events').insert({
    deal_id: row?.deal_id ?? null,
    cycle_id: cycleId,
    actor: who.email,
    action: 'deal_terms_kept',
    detail: { column, kept: conflict.current, contract: conflict.contract, document: conflict.source?.documentName ?? null, page: conflict.source?.page ?? null },
  })
  return { ok: true, propertyKey: deal?.property_key }
}

// ── Matt's contract-terms review queue ─────────────────────────────────────

export type TermsReviewQueue = { authorized: boolean; items: TermsReviewItem[] }

/**
 * Every live file's contract terms that need Matt: a typed value the
 * contract disagrees with, or a term the readers still read differently
 * after the third read (lib/tc/terms/review.ts). Principal broker only.
 */
export async function getTermsReviewQueue(sb: SupabaseClient = createServiceClient()): Promise<TermsReviewQueue> {
  const ctx = await getAdminContext()
  if (ctx?.role !== 'superuser') return { authorized: false, items: [] }

  const cycles: Obj[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from('tc_cycles')
      .select(`${CYCLE_TERM_SELECT}, actual_closing_date, tc_deals!inner(property_key, address, stage, broker_name)`)
      .eq('kind', 'sale')
      .not('tc_deals.stage', 'in', '(closed,dead)')
      .order('id')
      .range(from, from + 999)
    if (error) throw new Error(`getTermsReviewQueue: ${error.message}`)
    cycles.push(...((data ?? []) as Obj[]))
    if (!data || data.length < 1000) break
  }
  const deal = (c: Obj) => (Array.isArray(c.tc_deals) ? c.tc_deals[0] : c.tc_deals) as { property_key: string; address: string; stage: string; broker_name: string | null }
  const live = cycles.filter((c) => !isFinishedFile(deal(c).stage, c as unknown as Parameters<typeof isFinishedFile>[1]))
  if (!live.length) return { authorized: true, items: [] }

  const docsByCycle = new Map<string, Array<TermsDocRow & { cycle_id: string }>>()
  const ids = live.map((c) => String(c.id))
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await sb
      .from('tc_documents')
      .select(TERMS_DOC_SELECT)
      .in('cycle_id', ids.slice(i, i + 200))
      .eq('archived', false)
      .not('classification->terms', 'is', null)
    if (error) throw new Error(`getTermsReviewQueue docs: ${error.message}`)
    for (const d of (data ?? []) as unknown as Array<TermsDocRow & { cycle_id: string }>) {
      const list = docsByCycle.get(d.cycle_id) ?? []
      list.push(d)
      docsByCycle.set(d.cycle_id, list)
    }
  }

  const items: TermsReviewItem[] = []
  for (const c of live) {
    const docs = docsByCycle.get(String(c.id)) ?? []
    if (!docs.length) continue
    const state = cycleTermsFrom(c, docs)
    const d = deal(c)
    const where = { cycleId: String(c.id), propertyKey: d.property_key, address: d.address, broker: d.broker_name, closing: (c.escrow_closing_date as string | null) ?? null }
    for (const x of state.plan.conflicts) {
      const p = state.provenance[x.column]
      items.push({ ...where, kind: 'conflict', key: conflictKey(where.cycleId, x.column), column: x.column, label: TERM_COLUMN_LABEL[x.column], current: x.current, contract: x.contract, typedBy: p?.actor ?? null, typedAt: p?.at ?? null, source: x.source })
    }
    const cycleBuyers = asColumns(c).buyers ?? []
    for (const doc of docs) {
      const t = doc.terms
      if (!t || t.version !== TERMS_VERSION || t.status !== 'read') continue
      const first = t.raw?.claude as TermsDocumentReading | null | undefined
      const second = t.raw?.grok as TermsDocumentReading | null | undefined
      for (const x of t.disagreements) {
        if (!TIEBREAK_FIELDS.has(x.field)) continue
        const formBuyers = [...(first?.instruments[x.instrument]?.buyers ?? []), ...(second?.instruments[x.instrument]?.buyers ?? [])]
        if (!formIsThisCycles(formBuyers, cycleBuyers)) continue
        items.push({
          ...where,
          kind: 'unsettled',
          key: unsettledKey(doc.id, x.instrument, x.field),
          documentId: doc.id,
          documentName: doc.name,
          instrument: x.instrument,
          title: x.title,
          field: x.field,
          label: TERM_FIELD_LABEL[x.field] ?? x.field,
          page: x.page,
          readings: groupReadings(x.field, x.first, x.second, 'third' in x ? x.third : undefined),
        })
      }
    }
  }
  return { authorized: true, items: orderTermsQueue(items) }
}

/**
 * Matt picks the reading that is right for a term the readers split on. The
 * pick becomes the agreed reading of that form (with its page), the dispute
 * is closed, and the cycle's terms are written again. Principal broker only;
 * the caller checks.
 */
export async function confirmTermReading(
  input: { documentId: string; instrument: number; field: string; value: unknown; by: string },
  sb: SupabaseClient = createServiceClient(),
): Promise<{ ok: boolean; error?: string; propertyKey?: string; applied?: ApplyTermsResult }> {
  if (!TIEBREAK_FIELDS.has(input.field)) return { ok: false, error: 'That term cannot be settled here.' }
  const { data: doc } = await sb.from('tc_documents').select('id, cycle_id, classification, tc_cycles(tc_deals(property_key))').eq('id', input.documentId).maybeSingle()
  const classification = (doc?.classification ?? {}) as Obj
  const t = classification.terms as StoredTerms | undefined
  if (!doc || !t || t.status !== 'read') return { ok: false, error: 'That document has no reading to settle.' }
  const d = t.disagreements.find((x) => x.instrument === input.instrument && x.field === input.field)
  if (!d) return { ok: false, error: 'That term is already settled.' }
  const offered = [d.first, d.second, 'third' in d ? d.third : undefined].filter((v) => v !== undefined)
  const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
  if (!offered.some((v) => same(v, input.value))) return { ok: false, error: 'Pick one of the readings shown.' }
  const k = t.form_indexes.indexOf(input.instrument)
  const agreed = t.agreed.map((r) => ({ ...r }))
  if (k >= 0) {
    const out = agreed[k] as Record<string, unknown>
    if (input.field === 'lastSignatureDate') out[input.field] = input.value ?? null
    else out[input.field] = input.value == null ? null : { value: input.value, page: d.page, quote: null }
  }
  const at = new Date().toISOString()
  const next: StoredTerms = {
    ...t,
    agreed,
    disagreements: t.disagreements.filter((x) => x !== d),
    confirmed: [...(t.confirmed ?? []), { instrument: input.instrument, field: input.field, value: input.value ?? null, by: input.by, at }],
  }
  const { data: fresh } = await sb.from('tc_documents').select('classification').eq('id', input.documentId).maybeSingle()
  const { error } = await sb.from('tc_documents').update({ classification: { ...((fresh?.classification as Obj | null) ?? {}), terms: next } }).eq('id', input.documentId)
  if (error) return { ok: false, error: error.message }
  const cycleId = String(doc.cycle_id)
  const cyc = (Array.isArray(doc.tc_cycles) ? doc.tc_cycles[0] : doc.tc_cycles) as { tc_deals?: { property_key?: string } | Array<{ property_key?: string }> } | null
  const dl = Array.isArray(cyc?.tc_deals) ? cyc?.tc_deals[0] : cyc?.tc_deals
  const { data: row } = await sb.from('tc_cycles').select('deal_id').eq('id', cycleId).maybeSingle()
  await sb.from('tc_events').insert({
    deal_id: row?.deal_id ?? null,
    cycle_id: cycleId,
    document_id: input.documentId,
    actor: input.by,
    action: 'deal_terms_reading_confirmed',
    detail: { form: d.title, field: input.field, value: input.value ?? null, readings: { first: d.first, second: d.second, third: 'third' in d ? d.third : null }, page: d.page },
  })
  const applied = await applyCycleTerms(cycleId, sb).catch(() => undefined)
  return { ok: true, propertyKey: dl?.property_key, applied }
}
