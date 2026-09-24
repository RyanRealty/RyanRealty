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
 *      addenda, escrow papers) and fill every EMPTY term field on tc_cycles,
 *      one tc_events row per write with the document and page it came from.
 *
 * A field that already holds a different value is never overwritten; the file
 * shows the contract's value beside it and a person settles it
 * (app/actions/tc-deal-terms.ts).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'
import { dealVisibleToBroker } from '@/lib/tc/deal-scope'
import { READER_VERSION } from '@/lib/tc/doc-read/vision-reading'
import type { Disagreement } from '@/lib/tc/terms/agree'
import { planTermsWrite, type CycleTermColumns, type TermColumn, type TermsPlan } from '@/lib/tc/terms/plan'
import { readTermsTwice, type TermsForm, type TermsRead } from '@/lib/tc/terms/read'
import { resolveCycleTerms, type Instrument, type ResolvedTerms } from '@/lib/tc/terms/resolve'
import { TERMS_VERSION, instrumentKindForTitle, type InstrumentKind, type TermsReading } from '@/lib/tc/terms/schema'

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
  disagreements: Disagreement[]
  unmatched: number
  readers?: TermsRead['runs']
  raw?: { claude: unknown; grok: unknown }
  reused_from?: string
  error?: string | null
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
  await store(stored)
  return { documentId, status: 'read', forms: forms.length, agreedTerms: countTerms(stored.agreed), disagreements: stored.disagreements.length, stored }
}

/**
 * Documents to read next: the current reader has read them, their terms are
 * not read at this version, and they have not failed MAX_TERMS_ATTEMPTS times.
 * Files on live deals first, then the newest.
 */
export async function pendingTermsDocuments(limit: number, sb: SupabaseClient = createServiceClient()): Promise<string[]> {
  const rows: Array<{ id: string; cycle_id: string; ingested_at: string; reader_version: string | null; forms: Array<{ form?: string; verdict?: string }> | null; terms_version: string | null; terms_status: string | null; terms_attempts: string | null }> = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from('tc_documents')
      .select('id, cycle_id, ingested_at, reader_version:classification->reader->>version, forms:classification->reader->forms, terms_version:classification->terms->>version, terms_status:classification->terms->>status, terms_attempts:classification->terms->>attempts')
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

const CYCLE_TERM_SELECT = 'id, deal_id, kind, status, updated_at, sale_price, earnest_money, contract_acceptance_date, escrow_closing_date, inspection_days, financing_days, escrow_company, escrow_number, buyers, sellers'

export type CycleTerms = {
  cycleId: string
  terms: ResolvedTerms
  plan: TermsPlan
  /** Terms the two readers read differently, per document: for a person. */
  disagreements: Array<Disagreement & { documentId: string; documentName: string }>
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

/** The standing terms of one cycle and what they would change. Reads only. */
export async function getCycleTerms(cycleId: string, sb: SupabaseClient = createServiceClient()): Promise<CycleTerms | null> {
  const { data: cycle } = await sb.from('tc_cycles').select(CYCLE_TERM_SELECT).eq('id', cycleId).maybeSingle()
  if (!cycle || cycle.kind !== 'sale') return null
  const { data: docs } = await sb
    .from('tc_documents')
    .select('id, name, terms:classification->terms, reader_version:classification->reader->>version, forms:classification->reader->forms')
    .eq('cycle_id', cycleId)
    .eq('archived', false)
  const instruments: Instrument[] = []
  const disagreements: CycleTerms['disagreements'] = []
  let unread = 0
  let failed = 0
  for (const d of (docs ?? []) as Array<{ id: string; name: string; terms: StoredTerms | null; reader_version: string | null; forms: Array<{ form?: string; verdict?: string }> | null }>) {
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
  const columns = asColumns(cycle as Obj)
  const terms = resolveCycleTerms(instruments, { buyers: columns.buyers ?? [], contractAcceptanceDate: columns.contract_acceptance_date })
  return { cycleId, terms, plan: planTermsWrite(terms, columns), disagreements, unread, failed }
}

export type ApplyTermsResult = { cycleId: string; filled: Array<{ column: TermColumn; display: string }>; conflicts: number; skipped?: string }

/**
 * Fill the empty term fields of one cycle from its executed agreement. The
 * update only lands if the cycle row has not changed since it was read.
 */
export async function applyCycleTerms(cycleId: string, sb: SupabaseClient = createServiceClient()): Promise<ApplyTermsResult> {
  const state = await getCycleTerms(cycleId, sb)
  if (!state) return { cycleId, filled: [], conflicts: 0, skipped: 'not a sale cycle' }
  if (!state.plan.fills.length) return { cycleId, filled: [], conflicts: state.plan.conflicts.length }
  const { data: row } = await sb.from('tc_cycles').select('deal_id, updated_at').eq('id', cycleId).maybeSingle()
  if (!row) return { cycleId, filled: [], conflicts: 0, skipped: 'cycle gone' }
  const patch: Obj = { updated_at: new Date().toISOString() }
  for (const f of state.plan.fills) patch[f.column] = f.value
  const { data: updated, error } = await sb.from('tc_cycles').update(patch).eq('id', cycleId).eq('updated_at', row.updated_at).select('id')
  if (error) throw new Error(`applyCycleTerms: ${error.message}`)
  if (!updated?.length) return { cycleId, filled: [], conflicts: state.plan.conflicts.length, skipped: 'the cycle changed while reading; next run' }
  await sb.from('tc_events').insert({
    deal_id: row.deal_id,
    cycle_id: cycleId,
    actor: 'deal-terms-reader',
    action: 'deal_terms_filled',
    detail: {
      version: TERMS_VERSION,
      fields: state.plan.fills.map((f) => ({ column: f.column, value: f.display, document: f.source?.documentName ?? null, instrument: f.source?.instrument ?? null, page: f.source?.page ?? null, quote: f.source?.quote ?? null })),
      note: 'Filled from the executed agreement; two independent readers agreed on every value.',
    },
  })
  return { cycleId, filled: state.plan.fills.map((f) => ({ column: f.column, display: f.display })), conflicts: state.plan.conflicts.length }
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
  const conflict = state?.plan.conflicts.find((c) => c.column === column)
  if (!state || !conflict) return { ok: false, error: 'That value no longer differs from the contract.' }
  const { error } = await sb.from('tc_cycles').update({ [column]: conflict.value, updated_at: new Date().toISOString() }).eq('id', cycleId)
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
