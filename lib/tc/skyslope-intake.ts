/**
 * SkySlope → Vault daily intake: the pure half (mapping + decisions, no I/O).
 * The I/O half is lib/data/tc/skyslope-intake.ts; the rules in prose are
 * docs/TC_SYSTEM.md "SkySlope → Vault daily intake".
 *
 * Why it exists (Matt 2026-09-24): brokers still open and work files in
 * SkySlope until the cutover, so "until you cut over, the Vault pulls new files
 * and cycles from SkySlope every day — add only, never overwrite Vault work."
 * This is INGEST, not reconciliation: the Vault stays the system of record and
 * nothing here ever treats SkySlope as the truth about a Vault edit.
 *
 * The rules this file encodes:
 *   1. A SkySlope folder the Vault lacks (by tc_cycles.source_guid) is added to
 *      the deal that already holds the property; a deal is created only when
 *      no deal holds it.
 *   2. A field on an existing SkySlope cycle is updated only while the Vault
 *      value still equals what the previous import wrote (the previous payload
 *      is tc_cycles.raw, mapped with the migration's mapping). A Vault edit is
 *      kept; when SkySlope also changed, the difference is recorded as drift.
 *   3. Documents, checklist items, assignments and contacts are only ever
 *      added. "New" means new in SkySlope since the previous payload, so a row
 *      the Vault removed on purpose (the document reader drops assignments,
 *      brokers delete contacts) is never put back.
 *   4. Deal stage follows the newest cycle the way the migration derived it,
 *      and only while the Vault stage still equals the previous derivation.
 */
import { parseDealAddress } from './mail-rules'
import {
  brokerFromAgentGuid,
  date10,
  moneyOrNull,
  partyNames,
  skySlopePropertyKey,
  stageFromCycles,
  type SkySlopeFolderKind,
  type SkySlopeFolderSummary,
} from './skyslope-mirror-shape'

export const SKYSLOPE_INTAKE_ACTOR = 'skyslope-intake'
export const SKYSLOPE_INTAKE_VERSION = 'skyslope-intake-v1-2026-09-24'

/**
 * The cutover switch. Default on; set TC_SKYSLOPE_INTAKE_ENABLED=false (or 0 /
 * off / no) once brokers stop working files in SkySlope and the intake stops.
 */
export function skySlopeIntakeEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const v = (env.TC_SKYSLOPE_INTAKE_ENABLED ?? '').trim().toLowerCase()
  if (!v) return true
  return !['0', 'false', 'off', 'no', 'disabled'].includes(v)
}

type Obj = Record<string, unknown>

function asObj(v: unknown): Obj | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : null
}

function text(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s ? s : null
}

function numberOrNull(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** JSON with sorted keys, so a jsonb round trip (which reorders keys) compares equal. */
export function stableStringify(v: unknown): string {
  if (v === undefined) return 'null'
  if (v === null || typeof v !== 'object') return JSON.stringify(v)
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`
  const o = v as Obj
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
    .join(',')}}`
}

// ── cycle fields ────────────────────────────────────────────────────────────

export type CycleField =
  | 'status'
  | 'mls_number'
  | 'escrow_number'
  | 'escrow_company'
  | 'sellers'
  | 'buyers'
  | 'listing_price'
  | 'sale_price'
  | 'office_gross'
  | 'commission_percent'
  | 'listing_date'
  | 'contract_acceptance_date'
  | 'escrow_closing_date'
  | 'actual_closing_date'
  | 'expiration_date'
  | 'dead_date'
  | 'source_created_on'
  | 'portal_email'
  | 'checklist_type'
  | 'broker_name'

type FieldType = 'text' | 'money' | 'number' | 'date' | 'names'

export type CycleFieldSpec = {
  column: CycleField
  type: FieldType
  /**
   * False for the four columns scripts/tc-migrate-from-skyslope.mjs tried to
   * write but master.json never carried, so the migration wrote null on every
   * cycle. For those, "what the previous import wrote" includes null.
   */
  migrationCarried: boolean
}

/**
 * Every tc_cycles column the migration mapped from a SkySlope folder.
 * earnest_money is deliberately absent: the migration wrote null on every
 * cycle, and the Vault owns it (offers write `{ amount }`, which form fill
 * reads). SkySlope's earnest-money object stays in `raw`.
 */
export const CYCLE_FIELD_SPECS: readonly CycleFieldSpec[] = [
  { column: 'status', type: 'text', migrationCarried: true },
  { column: 'mls_number', type: 'text', migrationCarried: true },
  { column: 'escrow_number', type: 'text', migrationCarried: true },
  { column: 'escrow_company', type: 'text', migrationCarried: true },
  { column: 'sellers', type: 'names', migrationCarried: true },
  { column: 'buyers', type: 'names', migrationCarried: true },
  { column: 'listing_price', type: 'money', migrationCarried: true },
  { column: 'sale_price', type: 'money', migrationCarried: true },
  { column: 'office_gross', type: 'money', migrationCarried: true },
  { column: 'commission_percent', type: 'number', migrationCarried: true },
  { column: 'listing_date', type: 'date', migrationCarried: false },
  { column: 'contract_acceptance_date', type: 'date', migrationCarried: true },
  { column: 'escrow_closing_date', type: 'date', migrationCarried: true },
  { column: 'actual_closing_date', type: 'date', migrationCarried: true },
  { column: 'expiration_date', type: 'date', migrationCarried: true },
  { column: 'dead_date', type: 'date', migrationCarried: true },
  { column: 'source_created_on', type: 'date', migrationCarried: true },
  { column: 'portal_email', type: 'text', migrationCarried: false },
  { column: 'checklist_type', type: 'text', migrationCarried: false },
  { column: 'broker_name', type: 'text', migrationCarried: true },
]

export type CycleFieldValues = Record<CycleField, string | number | string[] | null>

/**
 * A SkySlope folder detail → tc_cycles columns, the migration's mapping
 * (scripts/skyslope-master-analyze.mjs → skyslope-master-file.mjs →
 * tc-migrate-from-skyslope.mjs), applied straight to the detail payload.
 */
export function cycleFieldsFromDetail(detail: Obj): CycleFieldValues {
  const commission = asObj(detail.commission)
  const escrowContact = asObj(detail.escrowContact)
  const escrow = text(detail.escrowNumber)
  return {
    status: text(detail.status),
    mls_number: text(detail.mlsNumber),
    escrow_number: escrow && escrow !== '0' ? escrow : null,
    escrow_company: text(escrowContact?.company),
    sellers: partyNames(detail.sellers),
    buyers: partyNames(detail.buyers),
    listing_price: moneyOrNull(detail.listingPrice),
    sale_price: moneyOrNull(detail.salePrice),
    office_gross: moneyOrNull(commission?.officeGrossCommissionOnSale),
    commission_percent: numberOrNull(commission?.saleCommissionPercent),
    listing_date: date10(detail.listingDate),
    contract_acceptance_date: date10(detail.contractAcceptanceDate),
    escrow_closing_date: date10(detail.escrowClosingDate),
    actual_closing_date: date10(detail.actualClosingDate),
    expiration_date: date10(detail.expirationDate),
    dead_date: date10(detail.deadDate),
    source_created_on: date10(detail.createdOn),
    portal_email: text(detail.portalEmail),
    checklist_type: text(detail.checklistType),
    broker_name: brokerFromAgentGuid(detail.agentGuid),
  }
}

function normalizeField(type: FieldType, v: unknown): string {
  switch (type) {
    case 'text':
      return text(v) ?? ''
    case 'money': {
      const n = moneyOrNull(v)
      return n == null ? '' : String(n)
    }
    case 'number': {
      const n = numberOrNull(v)
      return n == null ? '' : String(n)
    }
    case 'date':
      return date10(v) ?? ''
    case 'names': {
      const arr = Array.isArray(v) ? v : []
      return stableStringify(arr.map((x) => (typeof x === 'string' ? x.trim() : x)).filter((x) => x !== ''))
    }
  }
}

export function sameFieldValue(type: FieldType, a: unknown, b: unknown): boolean {
  return normalizeField(type, a) === normalizeField(type, b)
}

export type FieldDecision =
  /** The Vault already holds SkySlope's value. */
  | { kind: 'same' }
  /** The Vault still holds what the previous import wrote: take SkySlope's value. */
  | { kind: 'update'; from: unknown; to: unknown }
  /** Edited in the Vault AND changed in SkySlope: keep the Vault value, record it. */
  | { kind: 'drift'; vault: unknown; skyslopeBefore: unknown; skyslopeNow: unknown }
  /** Edited in the Vault, SkySlope unchanged since the previous import: nothing to do. */
  | { kind: 'vault_edit' }

/**
 * The never-overwrite rule for one field. `before` is the field mapped from
 * the previous payload (tc_cycles.raw).
 */
export function decideField(
  spec: CycleFieldSpec,
  input: { vault: unknown; before: unknown; now: unknown },
): FieldDecision {
  const { vault, before, now } = input
  if (sameFieldValue(spec.type, vault, now)) return { kind: 'same' }
  const lastWritten: unknown[] = [before]
  if (!spec.migrationCarried) lastWritten.push(null)
  if (lastWritten.some((w) => sameFieldValue(spec.type, vault, w))) return { kind: 'update', from: vault, to: now }
  if (sameFieldValue(spec.type, before, now)) return { kind: 'vault_edit' }
  return { kind: 'drift', vault, skyslopeBefore: before, skyslopeNow: now }
}

// ── raw payload comparison ─────────────────────────────────────────────────

const PRESIGNED = /[?&]X-Amz-(?:Expires|Signature|Security-Token|Credential|Date)=/i

/**
 * The payload without the pre-signed document URLs SkySlope mints on every
 * read (checklist.activities[].checklistDocs[].url). Without this every run
 * would see every folder as changed and rewrite every raw.
 */
export function withoutPresignedUrls(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(withoutPresignedUrls)
  const o = asObj(v)
  if (!o) return v
  const out: Obj = {}
  for (const [k, val] of Object.entries(o)) {
    if (typeof val === 'string' && PRESIGNED.test(val)) continue
    out[k] = withoutPresignedUrls(val)
  }
  return out
}

export function sameRaw(a: unknown, b: unknown): boolean {
  return stableStringify(withoutPresignedUrls(a ?? {})) === stableStringify(withoutPresignedUrls(b ?? {}))
}

export function changedRawKeys(before: unknown, now: unknown): string[] {
  const a = asObj(withoutPresignedUrls(before ?? {})) ?? {}
  const b = asObj(withoutPresignedUrls(now ?? {})) ?? {}
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  return [...keys].filter((k) => stableStringify(a[k]) !== stableStringify(b[k])).sort()
}

/** A detail the intake may use: the folder it asked for, not an error stub. */
export function detailIsUsable(kind: SkySlopeFolderKind, guid: string, detail: unknown): detail is Obj {
  const d = asObj(detail)
  if (!d || '__error' in d) return false
  const id = String((kind === 'listings' ? d.listingGuid : d.saleGuid) ?? '').toLowerCase()
  return id === guid.toLowerCase()
}

// ── property + deal matching ────────────────────────────────────────────────

export type SkySlopeProperty = {
  address: string
  city: string | null
  state: string | null
  zip: string | null
  propertyKey: string
}

/**
 * The folder's property, in the migration's address format
 * ("3480 SW 45th Street, Redmond, OR, 97756"). The migration read a
 * `streetDirection` key SkySlope does not send; the directional arrives as
 * `direction`, so it is added here unless the street already carries it. The
 * property key is unaffected either way (normalizeSkySlopeAddress drops
 * directionals).
 */
export function propertyFromDetail(detail: Obj, fallbackAddress: string | null, guid: string): SkySlopeProperty {
  const p = asObj(detail.property)
  const number = text(p?.streetNumber)
  const street = text(p?.streetAddress)
  if (p && (number || street)) {
    const dir = text(p.direction ?? p.streetDirection)
    const dirPart = dir && !(street ?? '').toLowerCase().startsWith(`${dir.toLowerCase()} `) ? dir : null
    const line1 = [number, dirPart, street].filter(Boolean).join(' ')
    const city = text(p.city)
    const state = text(p.state)
    const zip = text(p.zip)
    const address = [line1, city, state, zip].filter(Boolean).join(', ')
    return { address, city, state, zip, propertyKey: skySlopePropertyKey(address, guid) }
  }
  const fallback = text(fallbackAddress)
  const address = fallback && /[a-z0-9]/i.test(fallback) ? fallback : '(blank)'
  const parts = address.split(',').map((s) => s.trim())
  return {
    address,
    city: parts[1] || null,
    state: parts[2]?.split(/\s+/)[0] || null,
    zip: parts[2]?.split(/\s+/)[1] || parts[3] || null,
    propertyKey: skySlopePropertyKey(address === '(blank)' ? null : address, guid),
  }
}

export type VaultDealForMatch = { id: string; propertyKey: string; address: string; city: string | null }

export type DealMatch =
  | { kind: 'matched'; dealId: string; method: 'cycle' | 'property_key' | 'address' }
  | { kind: 'none' }
  | { kind: 'ambiguous'; dealIds: string[] }

function cityKey(c: string | null | undefined): string {
  return (c ?? '').toLowerCase().replace(/\s+\d{5}(?:-\d{4})?$/, '').replace(/\s+county$/, '').trim()
}

/**
 * Which Vault deal holds this property. In order: the deal that already holds
 * this property's other SkySlope folders; the deal with the same property key
 * (the migration's grouping); a deal whose address names the same house number
 * and street, city agreeing when both are known (an in-house file the mail
 * sweep opened reads "909 NW Delaware Ave" under an `inhouse-…` key). Two
 * address matches is ambiguous: the intake adds nothing rather than guess.
 */
export function matchDealForProperty(
  property: Pick<SkySlopeProperty, 'propertyKey' | 'address' | 'city'>,
  deals: readonly VaultDealForMatch[],
  siblingDealIds: readonly string[] = [],
): DealMatch {
  const siblings = [...new Set(siblingDealIds)]
  if (siblings.length === 1) return { kind: 'matched', dealId: siblings[0], method: 'cycle' }
  const byKey = deals.find((d) => d.propertyKey === property.propertyKey)
  if (byKey) return { kind: 'matched', dealId: byKey.id, method: 'property_key' }
  if (siblings.length > 1) return { kind: 'ambiguous', dealIds: siblings }
  const mine = parseDealAddress(property.address, property.city)
  if (!mine) return { kind: 'none' }
  const hits = deals.filter((d) => {
    const theirs = parseDealAddress(d.address, d.city)
    if (!theirs) return false
    if (theirs.number !== mine.number || theirs.street !== mine.street) return false
    const a = cityKey(mine.city)
    const b = cityKey(theirs.city)
    return !a || !b || a === b
  })
  if (hits.length === 1) return { kind: 'matched', dealId: hits[0].id, method: 'address' }
  if (hits.length > 1) return { kind: 'ambiguous', dealIds: hits.map((d) => d.id) }
  return { kind: 'none' }
}

// ── deal stage ──────────────────────────────────────────────────────────────

export type StageCycleFacts = {
  kind: SkySlopeFolderKind
  guid: string
  status: string | null
  createdOn: string | null
  escrowClosingDate: string | null
  actualClosingDate: string | null
  expirationDate: string | null
}

export function stageFactsFromDetail(kind: SkySlopeFolderKind, guid: string, detail: Obj): StageCycleFacts {
  return {
    kind,
    guid,
    status: text(detail.status),
    createdOn: text(detail.createdOn),
    escrowClosingDate: date10(detail.escrowClosingDate),
    actualClosingDate: date10(detail.actualClosingDate),
    expirationDate: date10(detail.expirationDate),
  }
}

function summaryForStage(f: StageCycleFacts): SkySlopeFolderSummary {
  return {
    kind: f.kind,
    guid: f.guid,
    guid8: f.guid.slice(0, 8),
    status: f.status,
    address: null,
    broker: null,
    mlsNumber: null,
    salePrice: null,
    listingPrice: null,
    officeGross: null,
    commissionPercent: null,
    escrowNumber: null,
    sellers: [],
    buyers: [],
    contractAcceptanceDate: null,
    escrowClosingDate: f.escrowClosingDate,
    actualClosingDate: f.actualClosingDate,
    expirationDate: f.expirationDate,
    createdOn: f.createdOn,
    requiredOpen: [],
    activityCount: 0,
    filledCount: 0,
  }
}

export type DealStage = { stage: string; stageDetail: string }

/**
 * The migration's stage derivation (skyslope-master-file.mjs, shared as
 * stageFromCycles), with the newest folder first so two closed sales read as
 * the latest close ("follows the newest cycle"). `oldest_first` exists only to
 * recognize a stage the migration wrote when it happened to list the older
 * folder first.
 */
export function deriveDealStage(
  cycles: readonly StageCycleFacts[],
  order: 'newest_first' | 'oldest_first' = 'newest_first',
): DealStage | null {
  if (!cycles.length) return null
  const sorted = [...cycles].sort((a, b) => {
    const c = (b.createdOn ?? '').localeCompare(a.createdOn ?? '') || b.guid.localeCompare(a.guid)
    return order === 'newest_first' ? c : -c
  })
  const s = stageFromCycles(sorted.map(summaryForStage))
  return { stage: s.stage, stageDetail: s.stageDetail }
}

function sameStage(a: DealStage | null, vault: { stage: string | null; stageDetail: string | null }): boolean {
  return !!a && a.stage === (vault.stage ?? '') && a.stageDetail === (vault.stageDetail ?? '')
}

export type StageDecision =
  | { kind: 'same' }
  | { kind: 'update'; from: DealStage; to: DealStage }
  | { kind: 'drift'; vault: DealStage; skyslopeBefore: DealStage | null; skyslopeNow: DealStage }
  | { kind: 'vault_edit' }

/**
 * Deal stage under the never-overwrite rule. `before` holds the deal's SkySlope
 * folders as the previous import saw them (their raw payloads); `now` holds
 * them as SkySlope shows them today, plus any folder this run adds.
 */
export function decideDealStage(input: {
  vaultStage: string | null
  vaultStageDetail: string | null
  before: readonly StageCycleFacts[]
  now: readonly StageCycleFacts[]
}): StageDecision {
  const vault = { stage: input.vaultStage, stageDetail: input.vaultStageDetail }
  const vaultStage: DealStage = { stage: input.vaultStage ?? '', stageDetail: input.vaultStageDetail ?? '' }
  const next = deriveDealStage(input.now)
  if (!next || sameStage(next, vault)) return { kind: 'same' }
  const previous = deriveDealStage(input.before)
  const previousAlt = deriveDealStage(input.before, 'oldest_first')
  if (sameStage(previous, vault) || sameStage(previousAlt, vault)) return { kind: 'update', from: vaultStage, to: next }
  if (previous && previous.stage === next.stage && previous.stageDetail === next.stageDetail) return { kind: 'vault_edit' }
  return { kind: 'drift', vault: vaultStage, skyslopeBefore: previous, skyslopeNow: next }
}

// ── documents ───────────────────────────────────────────────────────────────

export type SkySlopeDocument = {
  docId: string
  /** Lower-cased docId: the identity with the cycle (the migration's upsert key). */
  key: string
  fileName: string
  url: string | null
  pages: number | null
  uploadDate: string | null
  archived: boolean
  archivedReason: string | null
  isBrokerNotes: boolean
}

/** The migration's parseArchive: ARCHIVE-prefixed names are archived with the tail as reason. */
export function parseArchiveName(name: string | null | undefined): { archived: boolean; reason: string | null } {
  if (!/^ARCHIVE/i.test(name || '')) return { archived: false, reason: null }
  const m = String(name).match(/^ARCHIVE[\s_-]*(.*)$/i)
  return { archived: true, reason: m?.[1]?.trim()?.slice(0, 500) || 'archived in SkySlope' }
}

function sanitizeStorageName(s: string): string {
  return String(s).replace(/[/\\:*?"<>|#%{}]/g, '_').slice(0, 180)
}

/** Same Storage layout as the migration: tc/<source_guid>/<docId8>__<name>. */
export function documentStoragePath(guid: string, docId: string, fileName: string): string {
  return `tc/${guid}/${docId.slice(0, 8)}__${sanitizeStorageName(fileName)}`
}

/**
 * The folder's real documents, one per id (the /documents list repeats rows and
 * carries fileSize -1 placeholders; the migration dropped both).
 */
export function skySlopeDocumentsForIntake(docs: readonly unknown[]): SkySlopeDocument[] {
  const seen = new Set<string>()
  const out: SkySlopeDocument[] = []
  for (const raw of docs) {
    const d = asObj(raw)
    if (!d || d.fileSize === -1) continue
    const docId = text(d.id) ?? text(d.documentGuid)
    if (!docId) continue
    const key = docId.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const fileName = text(d.fileName) ?? text(d.name) ?? `doc_${docId}`
    const { archived, reason } = parseArchiveName(fileName)
    out.push({
      docId,
      key,
      fileName,
      url: text(d.url),
      pages: numberOrNull(d.pages),
      uploadDate: text(d.uploadDate),
      archived,
      archivedReason: reason,
      isBrokerNotes: /broker.?notes/i.test(fileName),
    })
  }
  return out
}

// ── checklist ───────────────────────────────────────────────────────────────

export const CHECKLIST_STATUS_MAP: Record<string, string> = {
  Required: 'required',
  Optional: 'optional',
  'In Review': 'in_review',
  Completed: 'completed',
  'N/A': 'na',
}

export type SkySlopeActivity = {
  activityId: number
  name: string
  typeName: string | null
  status: string
  sortOrder: number | null
  /** Lower-cased document ids assigned in SkySlope (checklistDocs ids arrive upper-case). */
  docKeys: string[]
}

export function checklistActivitiesFromDetail(detail: Obj | null | undefined): SkySlopeActivity[] {
  const checklist = asObj(detail?.checklist)
  const acts = Array.isArray(checklist?.activities) ? (checklist!.activities as unknown[]) : []
  const out: SkySlopeActivity[] = []
  for (const raw of acts) {
    const a = asObj(raw)
    const id = numberOrNull(a?.activityId)
    if (!a || id == null) continue
    const docs = Array.isArray(a.checklistDocs) ? a.checklistDocs : []
    out.push({
      activityId: id,
      name: String(a.activityName ?? '').trim(),
      typeName: text(a.typeName),
      status: CHECKLIST_STATUS_MAP[String(a.status ?? '')] ?? 'optional',
      sortOrder: numberOrNull(a.order),
      docKeys: docs.map((cd) => String(asObj(cd)?.id ?? '').toLowerCase()).filter(Boolean),
    })
  }
  return out
}

function pairKey(activityId: number, docKey: string): string {
  return `${activityId}|${docKey}`
}

// ── contacts ────────────────────────────────────────────────────────────────

export type SkySlopeContact = {
  role: string
  name: string | null
  company: string | null
  email: string | null
  phone: string | null
  alternate_phone: string | null
  notes: string | null
  source: 'skyslope_raw'
  source_contact_guid: string | null
}

/** Same field → role map as scripts/tc-backfill-contacts.mjs. */
const SINGLE_CONTACTS: Record<string, string> = {
  escrowContact: 'escrow',
  titleContact: 'title',
  lenderContact: 'lender',
  otherSideAgentContact: 'other_agent',
  homeWarrantyContact: 'home_warranty',
  attorneyContact: 'attorney',
  miscContact: 'misc',
}
const LIST_CONTACTS: Record<string, string> = {
  transactionCoordinators: 'transaction_coordinator',
  coAgents: 'co_agent',
}

function toContact(raw: unknown, role: string): SkySlopeContact | null {
  const c = asObj(raw)
  if (!c) return null
  const name = [c.firstName, c.lastName].map((s) => String(s ?? '').trim()).filter(Boolean).join(' ') || null
  const email = text(c.email)
  const company = text(c.company)
  if (!name && !email && !company) return null
  return {
    role,
    name,
    company,
    email,
    phone: text(c.phoneNumber),
    alternate_phone: text(c.alternatePhone),
    notes: text(c.notes),
    source: 'skyslope_raw',
    source_contact_guid: text(c.contactGuid),
  }
}

export function contactsFromDetail(detail: Obj | null | undefined): SkySlopeContact[] {
  if (!detail) return []
  const out: SkySlopeContact[] = []
  for (const [field, role] of Object.entries(SINGLE_CONTACTS)) {
    const v = detail[field]
    for (const item of Array.isArray(v) ? v : [v]) {
      const c = toContact(item, role)
      if (c) out.push(c)
    }
  }
  for (const [field, role] of Object.entries(LIST_CONTACTS)) {
    const v = detail[field]
    for (const item of Array.isArray(v) ? v : []) {
      const c = toContact(item, role)
      if (c) out.push(c)
    }
  }
  return out
}

/** The backfill's in-deal dedupe key: the same party under a different guid on another cycle. */
export function contactDedupeKey(c: { role: string; email: string | null; source_contact_guid: string | null; name: string | null }): string {
  return `${c.role}|${(c.email || c.source_contact_guid || c.name || '').toLowerCase()}`
}

function contactGuidKey(c: { role: string; source_contact_guid: string | null }): string | null {
  return c.source_contact_guid ? `${c.role}|${c.source_contact_guid.toLowerCase()}` : null
}

// ── one folder's plan ───────────────────────────────────────────────────────

export type VaultCycleSnapshot = {
  id: string
  dealId: string
  fields: Partial<Record<CycleField, unknown>>
  raw: Obj
  documents: ReadonlyArray<{ id: string; sourceDocId: string | null; archived: boolean }>
  items: ReadonlyArray<{ id: string; sourceActivityId: number | null }>
  assignments: ReadonlyArray<{ itemId: string; documentId: string }>
}

export type VaultContactSnapshot = {
  role: string
  email: string | null
  name: string | null
  source_contact_guid: string | null
}

export type FieldChange = { field: CycleField; from: unknown; to: unknown }
export type FieldDrift = { field: string; vault: unknown; skyslopeBefore: unknown; skyslopeNow: unknown }
export type AssignmentRef = { activityId: number; docKey: string }

export type CyclePlan = {
  guid: string
  skyslopeKind: SkySlopeFolderKind
  kind: 'sale' | 'listing'
  status: string | null
  mode: 'add' | 'existing'
  /** Columns for a new tc_cycles row (mode add). */
  insertFields: CycleFieldValues | null
  fieldUpdates: FieldChange[]
  drift: FieldDrift[]
  /** Vault edits SkySlope has not touched since: kept, nothing recorded. */
  vaultEdits: CycleField[]
  rawChanged: boolean
  rawChangedKeys: string[]
  documentsToAdd: SkySlopeDocument[]
  /** Existing Vault documents SkySlope now names ARCHIVE…: left exactly as the Vault has them. */
  archivedInSkySlopeOnly: string[]
  itemsToAdd: SkySlopeActivity[]
  /** Activities the previous import brought in that the Vault no longer has: not put back. */
  itemsRemovedInVault: number
  assignmentsToAdd: AssignmentRef[]
  /** Assignments the previous import brought in that the Vault removed: not put back. */
  assignmentsRemovedInVault: number
  /** New in SkySlope, but the Vault archived the document: not assigned, recorded as drift. */
  assignmentsOnVaultArchived: AssignmentRef[]
  /** Assignments naming a document or activity the Vault cannot link. */
  assignmentsUnlinked: number
  contactsToAdd: SkySlopeContact[]
  contactsRemovedInVault: number
  stageFacts: StageCycleFacts
  stageFactsBefore: StageCycleFacts | null
}

/**
 * Everything the intake would do for one SkySlope folder, decided from the
 * fresh folder (detail + document list) and the Vault's current rows. Pure:
 * the DAL turns this into writes.
 */
export function planCycleIntake(input: {
  skyslopeKind: SkySlopeFolderKind
  guid: string
  detail: Obj
  documents: readonly unknown[]
  vault: VaultCycleSnapshot | null
  dealContacts: readonly VaultContactSnapshot[]
}): CyclePlan {
  const { skyslopeKind, guid, detail, vault } = input
  const now = cycleFieldsFromDetail(detail)
  const docs = skySlopeDocumentsForIntake(input.documents)
  const activities = checklistActivitiesFromDetail(detail)
  const stageFacts = stageFactsFromDetail(skyslopeKind, guid, detail)

  const plan: CyclePlan = {
    guid,
    skyslopeKind,
    kind: skyslopeKind === 'listings' ? 'listing' : 'sale',
    status: now.status as string | null,
    mode: vault ? 'existing' : 'add',
    insertFields: vault ? null : now,
    fieldUpdates: [],
    drift: [],
    vaultEdits: [],
    rawChanged: vault ? !sameRaw(vault.raw, detail) : true,
    rawChangedKeys: vault ? changedRawKeys(vault.raw, detail) : [],
    documentsToAdd: [],
    archivedInSkySlopeOnly: [],
    itemsToAdd: [],
    itemsRemovedInVault: 0,
    assignmentsToAdd: [],
    assignmentsRemovedInVault: 0,
    assignmentsOnVaultArchived: [],
    assignmentsUnlinked: 0,
    contactsToAdd: [],
    contactsRemovedInVault: 0,
    stageFacts,
    stageFactsBefore: vault ? stageFactsFromDetail(skyslopeKind, guid, vault.raw) : null,
  }

  // fields: only an existing cycle has a Vault value to protect
  if (vault) {
    const before = cycleFieldsFromDetail(vault.raw)
    for (const spec of CYCLE_FIELD_SPECS) {
      const d = decideField(spec, { vault: vault.fields[spec.column] ?? null, before: before[spec.column], now: now[spec.column] })
      if (d.kind === 'update') plan.fieldUpdates.push({ field: spec.column, from: d.from ?? null, to: d.to ?? null })
      else if (d.kind === 'drift')
        plan.drift.push({ field: spec.column, vault: d.vault ?? null, skyslopeBefore: d.skyslopeBefore ?? null, skyslopeNow: d.skyslopeNow ?? null })
      else if (d.kind === 'vault_edit') plan.vaultEdits.push(spec.column)
    }
  }

  // documents: identity is (cycle, SkySlope document id), exactly the migration's
  const vaultDocs = new Map<string, { id: string; archived: boolean }>()
  for (const d of vault?.documents ?? []) {
    if (d.sourceDocId) vaultDocs.set(d.sourceDocId.toLowerCase(), { id: d.id, archived: d.archived })
  }
  for (const d of docs) {
    const existing = vaultDocs.get(d.key)
    if (!existing) plan.documentsToAdd.push(d)
    else if (d.archived && !existing.archived) plan.archivedInSkySlopeOnly.push(d.fileName)
  }
  const newDocKeys = new Set(plan.documentsToAdd.map((d) => d.key))

  // checklist items: new in SkySlope since the previous payload
  const vaultItems = new Map<number, string>()
  for (const it of vault?.items ?? []) if (it.sourceActivityId != null) vaultItems.set(Number(it.sourceActivityId), it.id)
  const previousActivities = vault ? checklistActivitiesFromDetail(vault.raw) : []
  const previousActivityIds = new Set(previousActivities.map((a) => a.activityId))
  for (const a of activities) {
    if (vaultItems.has(a.activityId)) continue
    if (vault && previousActivityIds.has(a.activityId)) {
      plan.itemsRemovedInVault++
      continue
    }
    plan.itemsToAdd.push(a)
  }
  const newActivityIds = new Set(plan.itemsToAdd.map((a) => a.activityId))

  // assignments: new in SkySlope since the previous payload, both ends linkable
  const previousPairs = new Set(previousActivities.flatMap((a) => a.docKeys.map((k) => pairKey(a.activityId, k))))
  const vaultPairs = new Set((vault?.assignments ?? []).map((a) => `${a.itemId}|${a.documentId}`))
  const seenPairs = new Set<string>()
  for (const a of activities) {
    for (const docKey of a.docKeys) {
      const pk = pairKey(a.activityId, docKey)
      if (seenPairs.has(pk)) continue
      seenPairs.add(pk)
      const itemId = vaultItems.get(a.activityId)
      const itemNew = newActivityIds.has(a.activityId)
      const vaultDoc = vaultDocs.get(docKey)
      const docNew = newDocKeys.has(docKey)
      if ((!itemId && !itemNew) || (!vaultDoc && !docNew)) {
        plan.assignmentsUnlinked++
        continue
      }
      if (itemNew || docNew) {
        plan.assignmentsToAdd.push({ activityId: a.activityId, docKey })
        continue
      }
      if (vaultPairs.has(`${itemId}|${vaultDoc!.id}`)) continue
      if (previousPairs.has(pk)) {
        plan.assignmentsRemovedInVault++
        continue
      }
      if (vaultDoc!.archived) {
        plan.assignmentsOnVaultArchived.push({ activityId: a.activityId, docKey })
        continue
      }
      plan.assignmentsToAdd.push({ activityId: a.activityId, docKey })
    }
  }

  // contacts: new in SkySlope since the previous payload, not already on the deal
  const onDealGuids = new Set(input.dealContacts.map(contactGuidKey).filter((k): k is string => !!k))
  const onDealKeys = new Set(input.dealContacts.map(contactDedupeKey))
  const previousContacts = new Set(
    (vault ? contactsFromDetail(vault.raw) : []).map((c) => contactGuidKey(c) ?? contactDedupeKey(c)),
  )
  for (const c of contactsFromDetail(detail)) {
    const gk = contactGuidKey(c)
    const dk = contactDedupeKey(c)
    if ((gk && onDealGuids.has(gk)) || onDealKeys.has(dk)) continue
    if (previousContacts.has(gk ?? dk)) {
      plan.contactsRemovedInVault++
      continue
    }
    plan.contactsToAdd.push(c)
    if (gk) onDealGuids.add(gk)
    onDealKeys.add(dk)
  }

  return plan
}

/** True when applying the plan would write nothing. */
export function cyclePlanIsEmpty(p: CyclePlan): boolean {
  return (
    p.mode === 'existing' &&
    !p.fieldUpdates.length &&
    !p.drift.length &&
    !p.rawChanged &&
    !p.documentsToAdd.length &&
    !p.itemsToAdd.length &&
    !p.assignmentsToAdd.length &&
    !p.assignmentsOnVaultArchived.length &&
    !p.contactsToAdd.length
  )
}

/** One line per folder for the CLI plan and the cron response. */
export function describeCyclePlan(p: CyclePlan): string {
  const bits: string[] = []
  if (p.mode === 'add') bits.push(`ADD ${p.kind} ${p.status ?? '?'}`)
  if (p.fieldUpdates.length) bits.push(`update ${p.fieldUpdates.map((f) => `${f.field} ${fmt(f.from)}→${fmt(f.to)}`).join(', ')}`)
  if (p.drift.length) bits.push(`drift kept ${p.drift.map((f) => `${f.field} (vault ${fmt(f.vault)}, skyslope ${fmt(f.skyslopeBefore)}→${fmt(f.skyslopeNow)})`).join(', ')}`)
  if (p.mode === 'existing' && p.rawChanged && !p.fieldUpdates.length && !p.drift.length) bits.push(`raw refresh (${p.rawChangedKeys.slice(0, 6).join(', ')}${p.rawChangedKeys.length > 6 ? ', …' : ''})`)
  if (p.documentsToAdd.length) bits.push(`+${p.documentsToAdd.length} docs`)
  if (p.itemsToAdd.length) bits.push(`+${p.itemsToAdd.length} checklist items`)
  if (p.assignmentsToAdd.length) bits.push(`+${p.assignmentsToAdd.length} assignments`)
  if (p.contactsToAdd.length) bits.push(`+${p.contactsToAdd.length} contacts`)
  if (p.assignmentsOnVaultArchived.length) bits.push(`${p.assignmentsOnVaultArchived.length} assignment(s) on Vault-archived docs kept off`)
  if (p.archivedInSkySlopeOnly.length) bits.push(`${p.archivedInSkySlopeOnly.length} doc(s) archived in SkySlope only (Vault untouched)`)
  if (p.itemsRemovedInVault || p.assignmentsRemovedInVault || p.contactsRemovedInVault)
    bits.push(`Vault removals kept: ${p.itemsRemovedInVault} items, ${p.assignmentsRemovedInVault} assignments, ${p.contactsRemovedInVault} contacts`)
  if (p.mode === 'existing' && p.vaultEdits.length) bits.push(`Vault edits kept: ${p.vaultEdits.join(', ')}`)
  return `${p.skyslopeKind === 'listings' ? 'LST ' : 'SALE'} ${p.guid.slice(0, 8)} ${bits.length ? bits.join(' · ') : 'no change'}`
}

function fmt(v: unknown): string {
  if (v == null || v === '') return '∅'
  if (Array.isArray(v)) return `[${v.join(', ')}]`
  return String(v)
}

/**
 * Order to visit properties in, so a run that stops at its deadline has
 * already done the work that matters: folders the Vault lacks first, then open
 * files (under contract, pre-contract, on market), then everything else.
 */
export function propertyPriority(folders: ReadonlyArray<{ inVault: boolean; status: string | null }>): number {
  if (folders.some((f) => !f.inVault)) return 0
  if (folders.some((f) => ['Pending', 'Pre-Contract', 'Active'].includes(f.status ?? ''))) return 1
  return 2
}
