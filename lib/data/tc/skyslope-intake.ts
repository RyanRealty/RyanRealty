/**
 * SkySlope → Vault daily intake — the I/O half.
 * reachability: /api/cron/skyslope-vault-intake (daily 06:50 UTC, after the
 * 06:20 mirror refresh) and scripts/tc-skyslope-intake.ts (plan | apply).
 *
 * Until the cutover, brokers still open and work files in SkySlope. Every day
 * this pulls their folders into the Vault: new cycles, new documents (binary
 * stored in the tc-documents bucket the way the 2026-06-10 migration did), new
 * checklist items, assignments and contacts, and field changes on cycles the
 * Vault has not edited. It never overwrites Vault work (Matt 2026-09-24). The
 * decisions are pure and live in lib/tc/skyslope-intake.ts; this file reads,
 * writes, and records one tc_events row (actor 'skyslope-intake') per write.
 *
 * SkySlope calls go through the read-only inbound client
 * (lib/tc/skyslope-inbound.ts): login, folder list, detail, document list,
 * document binary. Nothing here mutates SkySlope.
 *
 * Crash-safe ordering per property: deal → cycle rows and field updates →
 * deal stage → documents, items, assignments, contacts → drift record + raw
 * refresh last. The previous payload (tc_cycles.raw) is what "new in SkySlope"
 * is judged against, so it only moves forward once the adds it implies are
 * written; a run that stops at its deadline leaves the rest for the next run.
 */
import 'server-only'

import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'
import {
  fetchSkySlopeDocumentBinary,
  fetchSkySlopeFolderDetail,
  fetchSkySlopeFolderDocuments,
  hasSkySlopeInboundCreds,
  listSkySlopeFolders,
  loginSkySlopeInbound,
} from '@/lib/tc/skyslope-inbound'
import { skySlopePropertyKey, type SkySlopeFolderKind } from '@/lib/tc/skyslope-mirror-shape'
import {
  CYCLE_FIELD_SPECS,
  SKYSLOPE_INTAKE_ACTOR,
  SKYSLOPE_INTAKE_VERSION,
  cyclePlanIsEmpty,
  decideDealStage,
  deriveDealStage,
  describeCyclePlan,
  detailIsUsable,
  documentStoragePath,
  matchDealForProperty,
  planCycleIntake,
  propertyFromDetail,
  propertyPriority,
  skySlopeIntakeEnabled,
  stageFactsFromDetail,
  type CycleField,
  type CyclePlan,
  type SkySlopeDocument,
  type StageCycleFacts,
  type StageDecision,
  type VaultContactSnapshot,
  type VaultCycleSnapshot,
  type VaultDealForMatch,
} from '@/lib/tc/skyslope-intake'

const BUCKET = 'tc-documents'
const LEASE_NAME = 'skyslope-vault-intake'
const SKYSLOPE_PACE_MS = 150
/** Pre-signed document URLs live about five minutes; re-list before they lapse. */
const DOC_URL_TTL_MS = 240_000

type Obj = Record<string, unknown>
type SB = SupabaseClient

export type SkySlopeIntakeOptions = {
  /** false = plan only: read SkySlope and the Vault, decide, write nothing. */
  apply: boolean
  /** Only folders whose SkySlope address contains this text (case-insensitive). */
  only?: string | null
  /** Epoch ms; the run stops cleanly at the first checkpoint past it. */
  deadline?: number | null
  /** Pause between SkySlope calls (default 150ms, the mirror's pace). */
  paceMs?: number
  log?: (line: string) => void
}

export type IntakeDealResolution =
  | { kind: 'existing'; dealId: string; address: string; method: string }
  | { kind: 'create'; dealId: string | null; address: string; propertyKey: string }
  | { kind: 'ambiguous'; dealIds: string[] }

export type IntakePropertyReport = {
  propertyKey: string
  address: string
  deal: IntakeDealResolution | null
  cycles: Array<{ line: string; plan: CyclePlan }>
  /** Stage decisions that change or record something (a new deal's stage, an update, a kept drift). */
  stages: Array<{ dealId: string | null; decision: StageDecision | { kind: 'create'; stage: string; stageDetail: string } }>
  errors: string[]
  documentFailures: Array<{ guid: string; docId: string; name: string; error: string }>
  changed: boolean
}

export type IntakeTotals = {
  dealsAdded: number
  cyclesAdded: number
  cyclesUpdated: number
  fieldsUpdated: number
  driftKept: number
  rawRefreshed: number
  documentsAdded: number
  documentFailures: number
  itemsAdded: number
  assignmentsAdded: number
  contactsAdded: number
  stagesUpdated: number
  events: number
}

export type SkySlopeIntakeResult = {
  ok: boolean
  enabled: boolean
  mode: 'plan' | 'apply'
  error: string | null
  blocker: string | null
  folders: { sales: number; listings: number }
  propertiesTotal: number
  propertiesVisited: number
  /** False when the deadline stopped the run before every property was visited. */
  complete: boolean
  totals: IntakeTotals
  properties: IntakePropertyReport[]
  ms: number
}

function emptyTotals(): IntakeTotals {
  return {
    dealsAdded: 0,
    cyclesAdded: 0,
    cyclesUpdated: 0,
    fieldsUpdated: 0,
    driftKept: 0,
    rawRefreshed: 0,
    documentsAdded: 0,
    documentFailures: 0,
    itemsAdded: 0,
    assignmentsAdded: 0,
    contactsAdded: 0,
    stagesUpdated: 0,
    events: 0,
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ── lease + run log (cron) ─────────────────────────────────────────────────

export async function tryTakeSkySlopeIntakeLease(seconds = 300): Promise<boolean> {
  const { data } = await createServiceClient().rpc('crm_try_cron_lease', { p_name: LEASE_NAME, p_lease_seconds: seconds })
  return data !== false
}

export async function releaseSkySlopeIntakeLease(): Promise<void> {
  await createServiceClient().rpc('crm_release_cron_lease', { p_name: LEASE_NAME })
}

export async function writeSkySlopeIntakeRunLog(input: {
  ok: boolean
  durationMs: number
  records: number
  error: string | null
  cycleId: string
}): Promise<void> {
  try {
    await createServiceClient().from('sync_logs').insert({
      endpoint: 'skyslope_vault_intake',
      method: 'GET',
      response_status: input.ok ? 200 : 503,
      records_returned: input.records,
      duration_ms: input.durationMs,
      sync_cycle_id: input.cycleId,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
      error_message: input.error,
      alert_sent: false,
    })
  } catch (err) {
    console.warn('[skyslope-vault-intake] sync_logs skip', err)
  }
}

// ── Vault reads ────────────────────────────────────────────────────────────

type VaultDealRow = { id: string; property_key: string; address: string; city: string | null; stage: string | null; stage_detail: string | null }

type VaultCycleRow = {
  id: string
  deal_id: string
  kind: string
  source_guid: string
  raw: Obj
  fields: Partial<Record<CycleField, unknown>>
}

const CYCLE_COLUMNS = ['id', 'deal_id', 'kind', 'source_guid', 'raw', ...CYCLE_FIELD_SPECS.map((s) => s.column)].join(', ')

async function pageAll<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await fetchPage(from, from + 999)
    if (error) throw new Error(error.message)
    out.push(...((data ?? []) as T[]))
    if (!data || data.length < 1000) break
  }
  return out
}

async function loadDeals(sb: SB): Promise<VaultDealRow[]> {
  const rows = await pageAll<Obj>((a, b) => sb.from('tc_deals').select('id, property_key, address, city, stage, stage_detail').order('id').range(a, b))
  return rows.map((r) => ({
    id: String(r.id),
    property_key: String(r.property_key),
    address: String(r.address ?? ''),
    city: (r.city as string | null) ?? null,
    stage: (r.stage as string | null) ?? null,
    stage_detail: (r.stage_detail as string | null) ?? null,
  }))
}

async function loadSkySlopeCycles(sb: SB): Promise<VaultCycleRow[]> {
  const rows = await pageAll<Obj>((a, b) => sb.from('tc_cycles').select(CYCLE_COLUMNS).eq('source', 'skyslope').order('id').range(a, b))
  return rows.map((r) => {
    const fields: Partial<Record<CycleField, unknown>> = {}
    for (const s of CYCLE_FIELD_SPECS) fields[s.column] = r[s.column] ?? null
    return {
      id: String(r.id),
      deal_id: String(r.deal_id),
      kind: String(r.kind),
      source_guid: String(r.source_guid),
      raw: (r.raw && typeof r.raw === 'object' ? r.raw : {}) as Obj,
      fields,
    }
  })
}

async function loadCycleSnapshot(sb: SB, cycle: VaultCycleRow): Promise<VaultCycleSnapshot> {
  const documents = await pageAll<Obj>((a, b) =>
    sb.from('tc_documents').select('id, source_doc_id, archived').eq('cycle_id', cycle.id).order('id').range(a, b),
  )
  const items = await pageAll<Obj>((a, b) =>
    sb.from('tc_checklist_items').select('id, source_activity_id').eq('cycle_id', cycle.id).order('id').range(a, b),
  )
  const itemIds = items.map((i) => String(i.id))
  const assignments: Array<{ itemId: string; documentId: string }> = []
  for (let i = 0; i < itemIds.length; i += 100) {
    const chunk = itemIds.slice(i, i + 100)
    const { data, error } = await sb.from('tc_checklist_assignments').select('item_id, document_id').in('item_id', chunk)
    if (error) throw new Error(`assignments ${cycle.source_guid.slice(0, 8)}: ${error.message}`)
    for (const a of data ?? []) assignments.push({ itemId: String(a.item_id), documentId: String(a.document_id) })
  }
  return {
    id: cycle.id,
    dealId: cycle.deal_id,
    fields: cycle.fields,
    raw: cycle.raw,
    documents: documents.map((d) => ({ id: String(d.id), sourceDocId: (d.source_doc_id as string | null) ?? null, archived: d.archived === true })),
    items: items.map((i) => ({ id: String(i.id), sourceActivityId: i.source_activity_id == null ? null : Number(i.source_activity_id) })),
    assignments,
  }
}

async function loadDealContacts(sb: SB, dealId: string): Promise<VaultContactSnapshot[]> {
  const { data, error } = await sb.from('tc_deal_contacts').select('role, email, name, source_contact_guid').eq('deal_id', dealId)
  if (error) throw new Error(`contacts ${dealId.slice(0, 8)}: ${error.message}`)
  return (data ?? []).map((c) => ({
    role: String(c.role),
    email: (c.email as string | null) ?? null,
    name: (c.name as string | null) ?? null,
    source_contact_guid: (c.source_contact_guid as string | null) ?? null,
  }))
}

// ── writes ─────────────────────────────────────────────────────────────────

type EventRow = { deal_id: string | null; cycle_id?: string | null; document_id?: string | null; action: string; detail: Obj }

async function recordEvent(sb: SB, totals: IntakeTotals, e: EventRow): Promise<void> {
  const { error } = await sb.from('tc_events').insert({
    deal_id: e.deal_id,
    cycle_id: e.cycle_id ?? null,
    document_id: e.document_id ?? null,
    actor: SKYSLOPE_INTAKE_ACTOR,
    action: e.action,
    detail: { ...e.detail, intake_version: SKYSLOPE_INTAKE_VERSION },
  })
  if (error) console.error('[skyslope-intake] tc_events insert failed', e.action, error.message)
  else totals.events++
}

function looksLikePdf(buf: Buffer): boolean {
  return buf.length > 4 && buf.subarray(0, 5).toString('latin1') === '%PDF-'
}

async function storeDocument(input: {
  sb: SB
  session: string
  kind: SkySlopeFolderKind
  guid: string
  cycleId: string
  doc: SkySlopeDocument
  url: string | null
}): Promise<{ id: string; storagePath: string; sha256: string; bytes: number } | { error: string }> {
  const { sb, doc } = input
  let fetched: Awaited<ReturnType<typeof fetchSkySlopeDocumentBinary>>
  try {
    fetched = await fetchSkySlopeDocumentBinary(input.session, input.kind, input.guid, doc.docId, input.url)
  } catch (err) {
    return { error: `download: ${err instanceof Error ? err.message : String(err)}` }
  }
  if (!fetched.ok || !fetched.buf.length) return { error: `download HTTP ${fetched.status}` }
  if (/text\/html|application\/json/.test(fetched.contentType) && !looksLikePdf(fetched.buf)) {
    return { error: `download returned ${fetched.contentType}, not a document` }
  }
  const sha256 = createHash('sha256').update(fetched.buf).digest('hex')
  const contentType = looksLikePdf(fetched.buf) ? 'application/pdf' : fetched.contentType || 'application/octet-stream'
  const storagePath = documentStoragePath(input.guid, doc.docId, doc.fileName)
  const first = await sb.storage.from(BUCKET).upload(storagePath, fetched.buf, { contentType, upsert: false })
  if (first.error) {
    if (!/exist|duplicate/i.test(first.error.message)) return { error: `storage: ${first.error.message}` }
    // An earlier run stored this binary and stopped before its row: replace it
    // only when no document row points at that path.
    const { data: holder } = await sb.from('tc_documents').select('id').eq('storage_path', storagePath).limit(1)
    if (holder?.length) return { error: `storage path already held by document ${holder[0].id}` }
    const again = await sb.storage.from(BUCKET).upload(storagePath, fetched.buf, { contentType, upsert: true })
    if (again.error) return { error: `storage: ${again.error.message}` }
  }
  const { data: row, error } = await sb
    .from('tc_documents')
    .insert({
      cycle_id: input.cycleId,
      source_doc_id: doc.docId,
      name: doc.fileName,
      original_name: doc.fileName,
      storage_path: storagePath,
      sha256,
      bytes: fetched.buf.length,
      content_type: contentType,
      page_count: doc.pages,
      source_uploaded_at: doc.uploadDate,
      archived: doc.archived,
      archived_reason: doc.archivedReason,
      archived_at: doc.archived ? new Date().toISOString() : null,
      is_broker_notes: doc.isBrokerNotes,
    })
    .select('id')
    .single()
  if (error || !row) return { error: `tc_documents insert: ${error?.message ?? 'no row'}` }
  return { id: String(row.id), storagePath, sha256, bytes: fetched.buf.length }
}

// ── the run ────────────────────────────────────────────────────────────────

type Folder = { kind: SkySlopeFolderKind; guid: string; listAddress: string | null; status: string | null }

type FetchedFolder = Folder & {
  detail: Obj
  documents: unknown[] | null
  documentsAt: number
  vault: VaultCycleRow | null
  snapshot: VaultCycleSnapshot | null
}

function folderFromRow(kind: SkySlopeFolderKind, row: Obj): Folder | null {
  const guid = String((kind === 'listings' ? row.listingGuid : row.saleGuid) ?? '').trim()
  if (!guid) return null
  return {
    kind,
    guid,
    listAddress: (row.propertyAddress as string | null) ?? (row.address as string | null) ?? null,
    status: (row.status as string | null) ?? null,
  }
}

function pastDeadline(deadline: number | null | undefined): boolean {
  return !!deadline && Date.now() > deadline
}

/**
 * One pass of the intake. `apply: false` is the dry run: it reads SkySlope and
 * the Vault and returns the full plan without writing anything.
 */
export async function runSkySlopeVaultIntake(opts: SkySlopeIntakeOptions): Promise<SkySlopeIntakeResult> {
  const t0 = Date.now()
  const log = opts.log ?? (() => {})
  const mode = opts.apply ? 'apply' : 'plan'
  const base: SkySlopeIntakeResult = {
    ok: false,
    enabled: skySlopeIntakeEnabled(),
    mode,
    error: null,
    blocker: null,
    folders: { sales: 0, listings: 0 },
    propertiesTotal: 0,
    propertiesVisited: 0,
    complete: false,
    totals: emptyTotals(),
    properties: [],
    ms: 0,
  }
  if (!base.enabled && opts.apply) {
    return { ...base, ok: true, complete: true, blocker: 'TC_SKYSLOPE_INTAKE_ENABLED is off: the Vault has cut over from SkySlope.', ms: Date.now() - t0 }
  }
  if (!hasSkySlopeInboundCreds()) {
    return {
      ...base,
      error: 'SKYSLOPE inbound keys missing',
      blocker: 'SKYSLOPE_ACCESS_KEY / SKYSLOPE_ACCESS_SECRET / SKYSLOPE_CLIENT_ID / SKYSLOPE_CLIENT_SECRET are not set in this environment.',
      ms: Date.now() - t0,
    }
  }

  let sb: SB
  let session: string
  let folders: Folder[]
  let deals: VaultDealRow[]
  let cycles: VaultCycleRow[]
  try {
    sb = createServiceClient()
    session = await loginSkySlopeInbound()
    const sales = await listSkySlopeFolders(session, 'sales')
    const listings = await listSkySlopeFolders(session, 'listings')
    base.folders = { sales: sales.length, listings: listings.length }
    folders = [
      ...sales.map((r) => folderFromRow('sales', r)),
      ...listings.map((r) => folderFromRow('listings', r)),
    ].filter((f): f is Folder => !!f)
    const only = opts.only?.trim().toLowerCase()
    if (only) folders = folders.filter((f) => (f.listAddress ?? '').toLowerCase().includes(only))
    deals = await loadDeals(sb)
    cycles = await loadSkySlopeCycles(sb)
  } catch (err) {
    return { ...base, error: err instanceof Error ? err.message : String(err), ms: Date.now() - t0 }
  }

  const cycleByGuid = new Map(cycles.map((c) => [c.source_guid.toLowerCase(), c]))
  const groups = new Map<string, Folder[]>()
  for (const f of folders) {
    const key = skySlopePropertyKey(f.listAddress, f.guid)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(f)
  }
  const ordered = [...groups.entries()].sort(
    (a, b) =>
      propertyPriority(a[1].map((f) => ({ inVault: cycleByGuid.has(f.guid.toLowerCase()), status: f.status }))) -
      propertyPriority(b[1].map((f) => ({ inVault: cycleByGuid.has(f.guid.toLowerCase()), status: f.status }))),
  )
  base.propertiesTotal = ordered.length

  const ctx = { sb, session, deals, cycles, cycleByGuid, opts, log, totals: base.totals, paceMs: opts.paceMs ?? SKYSLOPE_PACE_MS }
  let stopped = false
  for (const [key, group] of ordered) {
    if (pastDeadline(opts.deadline)) {
      stopped = true
      break
    }
    let report: Awaited<ReturnType<typeof intakeProperty>>
    try {
      report = await intakeProperty(ctx, key, group)
    } catch (err) {
      // One property's failure never stops the others.
      report = {
        propertyKey: key,
        address: group[0]?.listAddress ?? key,
        deal: null,
        cycles: [],
        stages: [],
        errors: [`unexpected: ${err instanceof Error ? err.message : String(err)}`],
        documentFailures: [],
        changed: false,
        stoppedAtDeadline: false,
      }
    }
    base.propertiesVisited++
    if (report.changed || report.errors.length || report.documentFailures.length) base.properties.push(report)
    if (report.stoppedAtDeadline) {
      stopped = true
      break
    }
  }
  return { ...base, ok: true, complete: !stopped, ms: Date.now() - t0 }
}

type Ctx = {
  sb: SB
  session: string
  deals: VaultDealRow[]
  cycles: VaultCycleRow[]
  cycleByGuid: Map<string, VaultCycleRow>
  opts: SkySlopeIntakeOptions
  log: (line: string) => void
  totals: IntakeTotals
  paceMs: number
}

async function intakeProperty(
  ctx: Ctx,
  propertyKey: string,
  group: Folder[],
): Promise<IntakePropertyReport & { stoppedAtDeadline: boolean }> {
  const { sb, session, opts, totals } = ctx
  const report: IntakePropertyReport & { stoppedAtDeadline: boolean } = {
    propertyKey,
    address: group.map((f) => f.listAddress ?? '').sort((a, b) => b.length - a.length)[0] || '(blank)',
    deal: null,
    cycles: [],
    stages: [],
    errors: [],
    documentFailures: [],
    changed: false,
    stoppedAtDeadline: false,
  }

  // 1. read every folder fresh from SkySlope
  const fetched: FetchedFolder[] = []
  for (const f of group) {
    const vault = ctx.cycleByGuid.get(f.guid.toLowerCase()) ?? null
    let detail: Obj
    try {
      detail = (await fetchSkySlopeFolderDetail(session, f.kind, f.guid)) as Obj
    } catch (err) {
      report.errors.push(`${f.guid.slice(0, 8)} detail: ${err instanceof Error ? err.message : String(err)}`)
      continue
    }
    if (!detailIsUsable(f.kind, f.guid, detail)) {
      report.errors.push(`${f.guid.slice(0, 8)} detail unusable (${JSON.stringify(detail).slice(0, 80)})`)
      continue
    }
    await sleep(ctx.paceMs)
    let documents: unknown[] | null = null
    try {
      documents = await fetchSkySlopeFolderDocuments(session, f.kind, f.guid)
    } catch (err) {
      report.errors.push(`${f.guid.slice(0, 8)} documents: ${err instanceof Error ? err.message : String(err)}`)
      // A folder the Vault lacks is added whole or not at all; an existing one
      // still takes its field changes and waits for the document list.
      if (!vault) continue
    }
    const documentsAt = Date.now()
    await sleep(ctx.paceMs)
    let snapshot: VaultCycleSnapshot | null = null
    if (vault) {
      try {
        snapshot = await loadCycleSnapshot(sb, vault)
      } catch (err) {
        report.errors.push(`${f.guid.slice(0, 8)} vault read: ${err instanceof Error ? err.message : String(err)}`)
        continue
      }
    }
    fetched.push({ ...f, detail, documents, documentsAt, vault, snapshot })
  }
  if (!fetched.length) return report

  // 2. which deal holds this property
  const newestFirst = [...fetched].sort((a, b) => String(b.detail.createdOn ?? '').localeCompare(String(a.detail.createdOn ?? '')))
  const property = propertyFromDetail(newestFirst[0].detail, newestFirst[0].listAddress, newestFirst[0].guid)
  report.address = property.address
  const siblingDealIds = fetched.filter((f) => f.vault).map((f) => f.vault!.deal_id)
  const needsDeal = fetched.some((f) => !f.vault)
  const dealsForMatch: VaultDealForMatch[] = ctx.deals.map((d) => ({ id: d.id, propertyKey: d.property_key, address: d.address, city: d.city }))
  const match = matchDealForProperty(property, dealsForMatch, siblingDealIds)
  let targetDealId: string | null = null
  if (match.kind === 'matched') {
    const d = ctx.deals.find((x) => x.id === match.dealId)!
    targetDealId = d.id
    report.deal = { kind: 'existing', dealId: d.id, address: d.address, method: match.method }
  } else if (match.kind === 'ambiguous') {
    report.deal = { kind: 'ambiguous', dealIds: match.dealIds }
    if (needsDeal) report.errors.push(`property matches ${match.dealIds.length} Vault deals (${match.dealIds.map((i) => i.slice(0, 8)).join(', ')}): new folders not added`)
  } else if (needsDeal) {
    report.deal = { kind: 'create', dealId: null, address: property.address, propertyKey: property.propertyKey }
  }

  // 3. plan every folder
  // One contact list per deal, grown as each folder is planned, so two new
  // folders on the same deal never add the same party twice.
  const contactsByDeal = new Map<string, VaultContactSnapshot[]>()
  const contactsFor = async (dealId: string | null): Promise<VaultContactSnapshot[]> => {
    const key = dealId ?? '(new deal)'
    if (!contactsByDeal.has(key)) contactsByDeal.set(key, dealId ? await loadDealContacts(sb, dealId) : [])
    return contactsByDeal.get(key)!
  }
  const plans: Array<{ folder: FetchedFolder; plan: CyclePlan; dealId: string | null }> = []
  for (const f of fetched) {
    if (!f.vault && report.deal?.kind === 'ambiguous') continue
    const dealId = f.vault ? f.vault.deal_id : targetDealId
    let dealContacts: VaultContactSnapshot[] = []
    try {
      dealContacts = await contactsFor(dealId)
    } catch (err) {
      report.errors.push(err instanceof Error ? err.message : String(err))
      continue
    }
    const plan = planCycleIntake({
      skyslopeKind: f.kind,
      guid: f.guid,
      detail: f.detail,
      documents: f.documents ?? [],
      vault: f.snapshot,
      dealContacts,
    })
    dealContacts.push(...plan.contactsToAdd.map((c) => ({ role: c.role, email: c.email, name: c.name, source_contact_guid: c.source_contact_guid })))
    plans.push({ folder: f, plan, dealId })
    report.cycles.push({ line: describeCyclePlan(plan), plan })
  }

  // 4. deal stage for every deal this property touches, decided from the
  //    previous payloads before any of them is replaced
  const freshByGuid = new Map(plans.map((p) => [p.plan.guid.toLowerCase(), p.plan]))
  const stageDecisions: Array<{ dealId: string; decision: StageDecision }> = []
  let createStage: { stage: string; stageDetail: string } | null = null
  if (report.deal?.kind === 'create') {
    createStage = deriveDealStage(plans.filter((p) => p.plan.mode === 'add').map((p) => p.plan.stageFacts))
    if (createStage) report.stages.push({ dealId: null, decision: { kind: 'create', ...createStage } })
  }
  const touchedDeals = [...new Set([...siblingDealIds, ...(targetDealId ? [targetDealId] : [])])]
  for (const dealId of touchedDeals) {
    const deal = ctx.deals.find((d) => d.id === dealId)
    if (!deal) continue
    const kindOf = (c: VaultCycleRow): SkySlopeFolderKind => (c.kind === 'listing' ? 'listings' : 'sales')
    const onDeal = ctx.cycles.filter((c) => c.deal_id === dealId)
    const before: StageCycleFacts[] = onDeal.map((c) => stageFactsFromDetail(kindOf(c), c.source_guid, c.raw))
    const now: StageCycleFacts[] = onDeal.map(
      (c) => freshByGuid.get(c.source_guid.toLowerCase())?.stageFacts ?? stageFactsFromDetail(kindOf(c), c.source_guid, c.raw),
    )
    for (const p of plans) if (p.plan.mode === 'add' && p.dealId === dealId) now.push(p.plan.stageFacts)
    const decision = decideDealStage({ vaultStage: deal.stage, vaultStageDetail: deal.stage_detail, before, now })
    stageDecisions.push({ dealId, decision })
    if (decision.kind === 'update' || decision.kind === 'drift') report.stages.push({ dealId, decision })
  }

  report.changed = report.deal?.kind === 'create' || report.stages.length > 0 || plans.some((p) => !cyclePlanIsEmpty(p.plan))
  for (const p of plans) if (!cyclePlanIsEmpty(p.plan)) ctx.log(`  ${describeCyclePlan(p.plan)}`)
  if (!opts.apply || !report.changed) return report

  // ── apply ────────────────────────────────────────────────────────────────

  // a. the deal
  if (report.deal?.kind === 'create') {
    const broker = plans.map((p) => p.plan.insertFields?.broker_name ?? null).find(Boolean) ?? null
    const stage = createStage ?? { stage: 'pre_contract', stageDetail: 'Pre-contract' }
    const { data: dealRow, error } = await sb
      .from('tc_deals')
      .insert({
        property_key: property.propertyKey,
        address: property.address,
        city: property.city,
        state: property.state,
        zip: property.zip,
        broker_name: broker,
        stage: stage.stage,
        stage_detail: stage.stageDetail,
      })
      .select('id')
      .single()
    if (error || !dealRow) {
      report.errors.push(`tc_deals insert: ${error?.message ?? 'no row'}`)
      return report
    }
    targetDealId = String(dealRow.id)
    report.deal = { ...report.deal, dealId: targetDealId }
    ctx.deals.push({ id: targetDealId, property_key: property.propertyKey, address: property.address, city: property.city, stage: stage.stage, stage_detail: stage.stageDetail })
    totals.dealsAdded++
    await recordEvent(sb, totals, {
      deal_id: targetDealId,
      action: 'skyslope_deal_added',
      detail: { property_key: property.propertyKey, address: property.address, stage: stage.stage, stage_detail: stage.stageDetail, source_guids: plans.filter((p) => p.plan.mode === 'add').map((p) => p.plan.guid) },
    })
    for (const p of plans) if (p.plan.mode === 'add') p.dealId = targetDealId
  }

  // Any failed write keeps that cycle's previous payload (raw) where it is, so
  // the next run still sees the change as new and retries it. A failed stage
  // write holds back every cycle on that deal for the same reason.
  const holdRaw = new Set<string>()
  const holdDeal = new Set<string>()

  // b. cycle rows: insert new ones (raw left empty until their adds land), update unedited fields
  const cycleIdByGuid = new Map<string, string>()
  for (const p of plans) {
    const { plan, folder } = p
    if (plan.mode === 'add') {
      if (!p.dealId) continue
      const { data: row, error } = await sb
        .from('tc_cycles')
        .insert({
          deal_id: p.dealId,
          kind: plan.kind,
          source: 'skyslope',
          source_guid: plan.guid,
          ...plan.insertFields,
          raw: {},
        })
        .select('id')
        .single()
      if (error || !row) {
        report.errors.push(`${plan.guid.slice(0, 8)} tc_cycles insert: ${error?.message ?? 'no row'}`)
        continue
      }
      const cycleId = String(row.id)
      cycleIdByGuid.set(plan.guid, cycleId)
      totals.cyclesAdded++
      await recordEvent(sb, totals, {
        deal_id: p.dealId,
        cycle_id: cycleId,
        action: 'skyslope_cycle_added',
        detail: {
          source_guid: plan.guid,
          kind: plan.kind,
          status: plan.status,
          documents_in_folder: skyslopeDocCount(folder),
          checklist_activities: plan.itemsToAdd.length,
          fields: plan.insertFields,
        },
      })
    } else {
      const cycleId = folder.vault!.id
      cycleIdByGuid.set(plan.guid, cycleId)
      if (!plan.fieldUpdates.length) continue
      const patch: Obj = { updated_at: new Date().toISOString() }
      for (const u of plan.fieldUpdates) patch[u.field] = u.to
      // Guarded: each field changes only if it still holds the value we read.
      let q = sb.from('tc_cycles').update(patch).eq('id', cycleId)
      for (const u of plan.fieldUpdates) {
        const spec = CYCLE_FIELD_SPECS.find((s) => s.column === u.field)!
        if (spec.type === 'names') continue
        q = u.from == null ? q.is(u.field, null) : q.eq(u.field, u.from as string | number)
      }
      const { data: updated, error } = await q.select('id')
      if (error) {
        report.errors.push(`${plan.guid.slice(0, 8)} field update: ${error.message}`)
        holdRaw.add(plan.guid)
        continue
      }
      if (!updated?.length) {
        report.errors.push(`${plan.guid.slice(0, 8)} field update skipped: the Vault row changed while the intake ran`)
        holdRaw.add(plan.guid)
        continue
      }
      totals.cyclesUpdated++
      totals.fieldsUpdated += plan.fieldUpdates.length
      await recordEvent(sb, totals, {
        deal_id: p.dealId,
        cycle_id: cycleId,
        action: 'skyslope_field_updated',
        detail: { table: 'tc_cycles', source_guid: plan.guid, fields: plan.fieldUpdates },
      })
    }
  }

  // c. deal stage (before any previous payload is replaced)
  for (const { dealId: stageDealId, decision: stageDecision } of stageDecisions) {
    if (stageDecision.kind !== 'update' && stageDecision.kind !== 'drift') continue
    const deal = ctx.deals.find((d) => d.id === stageDealId)!
    if (stageDecision.kind === 'update') {
      let q = sb
        .from('tc_deals')
        .update({ stage: stageDecision.to.stage, stage_detail: stageDecision.to.stageDetail, updated_at: new Date().toISOString() })
        .eq('id', stageDealId)
        .eq('stage', deal.stage ?? '')
      q = deal.stage_detail == null ? q.is('stage_detail', null) : q.eq('stage_detail', deal.stage_detail)
      const { data: updated, error } = await q.select('id')
      if (error) {
        report.errors.push(`stage update: ${error.message}`)
        holdDeal.add(stageDealId)
      } else if (!updated?.length) {
        report.errors.push('stage update skipped: the Vault deal changed while the intake ran')
        holdDeal.add(stageDealId)
      } else {
        totals.stagesUpdated++
        deal.stage = stageDecision.to.stage
        deal.stage_detail = stageDecision.to.stageDetail
        await recordEvent(sb, totals, {
          deal_id: stageDealId,
          action: 'skyslope_stage_updated',
          detail: { from: stageDecision.from, to: stageDecision.to },
        })
      }
    } else {
      totals.driftKept++
      await recordEvent(sb, totals, {
        deal_id: stageDealId,
        action: 'skyslope_drift_kept',
        detail: {
          table: 'tc_deals',
          fields: [{ field: 'stage', vault: stageDecision.vault, skyslopeBefore: stageDecision.skyslopeBefore, skyslopeNow: stageDecision.skyslopeNow }],
          note: 'The Vault stage was set in the Vault; SkySlope-derived stage recorded, Vault kept.',
        },
      })
    }
  }

  // d. documents, checklist items, assignments, contacts
  for (const p of plans) {
    const { plan, folder } = p
    const cycleId = cycleIdByGuid.get(plan.guid)
    if (!cycleId || !p.dealId) continue
    const dealId = p.dealId

    const docRowByKey = new Map<string, { id: string; archived: boolean }>()
    for (const d of folder.snapshot?.documents ?? []) if (d.sourceDocId) docRowByKey.set(d.sourceDocId.toLowerCase(), { id: d.id, archived: d.archived })

    let urls = new Map(plan.documentsToAdd.map((d) => [d.key, d.url]))
    let urlsAt = folder.documentsAt
    for (const doc of plan.documentsToAdd) {
      if (pastDeadline(opts.deadline)) {
        report.stoppedAtDeadline = true
        break
      }
      if (Date.now() - urlsAt > DOC_URL_TTL_MS) {
        try {
          const relisted = await fetchSkySlopeFolderDocuments(session, folder.kind, folder.guid)
          urls = new Map(relisted.map((r) => [String((r as Obj).id ?? '').toLowerCase(), ((r as Obj).url as string | null) ?? null]))
          urlsAt = Date.now()
        } catch {
          /* fall back to the binary endpoint below */
        }
      }
      const stored = await storeDocument({ sb, session, kind: folder.kind, guid: folder.guid, cycleId, doc, url: urls.get(doc.key) ?? null })
      await sleep(ctx.paceMs)
      if ('error' in stored) {
        totals.documentFailures++
        report.documentFailures.push({ guid: plan.guid, docId: doc.docId, name: doc.fileName, error: stored.error })
        continue
      }
      docRowByKey.set(doc.key, { id: stored.id, archived: doc.archived })
      totals.documentsAdded++
      await recordEvent(sb, totals, {
        deal_id: dealId,
        cycle_id: cycleId,
        document_id: stored.id,
        action: 'skyslope_document_added',
        detail: {
          source_guid: plan.guid,
          source_doc_id: doc.docId,
          name: doc.fileName,
          archived: doc.archived,
          storage_path: stored.storagePath,
          sha256: stored.sha256,
          bytes: stored.bytes,
          source_uploaded_at: doc.uploadDate,
        },
      })
    }

    // checklist items
    const itemIdByActivity = new Map<number, string>()
    for (const it of folder.snapshot?.items ?? []) if (it.sourceActivityId != null) itemIdByActivity.set(Number(it.sourceActivityId), it.id)
    if (plan.itemsToAdd.length) {
      const { data: rows, error } = await sb
        .from('tc_checklist_items')
        .upsert(
          plan.itemsToAdd.map((a) => ({
            cycle_id: cycleId,
            source_activity_id: a.activityId,
            name: a.name,
            type_name: a.typeName,
            status: a.status,
            sort_order: a.sortOrder,
          })),
          { onConflict: 'cycle_id,source_activity_id', ignoreDuplicates: true },
        )
        .select('id, source_activity_id')
      if (error) {
        report.errors.push(`${plan.guid.slice(0, 8)} checklist items: ${error.message}`)
        holdRaw.add(plan.guid)
      } else {
        for (const r of rows ?? []) itemIdByActivity.set(Number(r.source_activity_id), String(r.id))
        totals.itemsAdded += rows?.length ?? 0
        if (rows?.length) {
          await recordEvent(sb, totals, {
            deal_id: dealId,
            cycle_id: cycleId,
            action: 'skyslope_checklist_items_added',
            detail: { source_guid: plan.guid, items: plan.itemsToAdd.map((a) => ({ activity_id: a.activityId, name: a.name, status: a.status })) },
          })
        }
      }
    }

    // assignments (only where both the item and the document exist now)
    const pairs: Array<{ item_id: string; document_id: string }> = []
    const pairLabels: Array<{ activity_id: number; source_doc_id: string }> = []
    for (const a of plan.assignmentsToAdd) {
      const itemId = itemIdByActivity.get(a.activityId)
      const doc = docRowByKey.get(a.docKey)
      if (!itemId || !doc) continue
      pairs.push({ item_id: itemId, document_id: doc.id })
      pairLabels.push({ activity_id: a.activityId, source_doc_id: a.docKey })
    }
    if (pairs.length) {
      const { error } = await sb.from('tc_checklist_assignments').upsert(pairs, { onConflict: 'item_id,document_id', ignoreDuplicates: true })
      if (error) {
        report.errors.push(`${plan.guid.slice(0, 8)} assignments: ${error.message}`)
        holdRaw.add(plan.guid)
      } else {
        totals.assignmentsAdded += pairs.length
        await recordEvent(sb, totals, {
          deal_id: dealId,
          cycle_id: cycleId,
          action: 'skyslope_checklist_assignments_added',
          detail: { source_guid: plan.guid, assignments: pairLabels },
        })
      }
    }

    // contacts
    if (plan.contactsToAdd.length) {
      const { error } = await sb.from('tc_deal_contacts').upsert(
        plan.contactsToAdd.map((c) => ({ ...c, deal_id: dealId, cycle_id: cycleId })),
        { onConflict: 'deal_id,role,source_contact_guid', ignoreDuplicates: true },
      )
      if (error) {
        report.errors.push(`${plan.guid.slice(0, 8)} contacts: ${error.message}`)
        holdRaw.add(plan.guid)
      } else {
        totals.contactsAdded += plan.contactsToAdd.length
        await recordEvent(sb, totals, {
          deal_id: dealId,
          cycle_id: cycleId,
          action: 'skyslope_contacts_added',
          detail: { source_guid: plan.guid, contacts: plan.contactsToAdd.map((c) => ({ role: c.role, name: c.name, company: c.company, email: c.email })) },
        })
      }
    }

    if (report.stoppedAtDeadline || holdRaw.has(plan.guid) || holdDeal.has(dealId)) continue

    // e. drift record, then the previous payload moves forward (last)
    if (plan.drift.length || plan.assignmentsOnVaultArchived.length) {
      totals.driftKept += plan.drift.length + plan.assignmentsOnVaultArchived.length
      await recordEvent(sb, totals, {
        deal_id: dealId,
        cycle_id: cycleId,
        action: 'skyslope_drift_kept',
        detail: {
          table: 'tc_cycles',
          source_guid: plan.guid,
          fields: plan.drift,
          assignments_on_vault_archived_documents: plan.assignmentsOnVaultArchived,
          note: 'Edited in the Vault and changed in SkySlope: the Vault value is kept.',
        },
      })
    }
    if (plan.rawChanged) {
      const { error } = await sb.from('tc_cycles').update({ raw: folder.detail, updated_at: new Date().toISOString() }).eq('id', cycleId)
      if (error) report.errors.push(`${plan.guid.slice(0, 8)} raw refresh: ${error.message}`)
      else {
        totals.rawRefreshed++
        await recordEvent(sb, totals, {
          deal_id: dealId,
          cycle_id: cycleId,
          action: 'skyslope_raw_refreshed',
          detail: { source_guid: plan.guid, changed_keys: plan.mode === 'add' ? ['(first payload)'] : plan.rawChangedKeys },
        })
      }
    }
  }
  return report
}

function skyslopeDocCount(f: FetchedFolder): number {
  const seen = new Set<string>()
  for (const d of f.documents ?? []) {
    const o = d as Obj
    if (o && o.fileSize !== -1 && o.id) seen.add(String(o.id).toLowerCase())
  }
  return seen.size
}
