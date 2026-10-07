/**
 * THE CMA queue — every origin in one list (Matt 2026-09-04).
 *
 * Before this, approving a CMA meant knowing which of four screens owned it:
 * /admin/cmas filtered `doc_type='cma'` and deliberately excluded expired
 * audits, /admin/prospecting owned expired + FSBO behind a different detail
 * page with a different set of buttons, /admin/valuations held the inbound
 * requests, and /cma-drafts was a dead prototype. Same engine underneath the
 * whole time — only the surfaces were split.
 *
 * This read returns them all, each row carrying the context its origin needs:
 * an expired row knows the last price they listed at, an FSBO row knows what
 * they are asking today, and a requested row knows who asked and when. The
 * caller never has to go to a second table to render a queue line.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { fetchPagedRows } from '@/lib/supabase/paginate'
import {
  classifyCmaOrigin,
  prospectKindForOrigin,
  sendModeForOrigin,
  theirPriceLabelFor,
  type CmaOrigin,
  type CmaSendMode,
} from '@/lib/cma/origin'
import { cmaQueueReachFromFacts, type CmaQueueReach, theirPriceFromBuildSummary } from '@/lib/cma/queue-view'
import { pickSendableCell, type IntakePhone } from '@/lib/prospecting/intake-gate'

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createServiceClient()
}

/**
 * Where the row sits in the one pipeline.
 *
 * The adversarial audit is the load-bearing signal here, not a footnote: on
 * 2026-09-04 it failed 212 of 418 live CMAs for real data-integrity defects
 * (fabricated comp counts, recommendations unsupported by the adjusted values).
 * A queue that collapsed those into a generic "needs review" would invite
 * exactly the send §0 forbids, so `audit-failed` is its own terminal state and
 * `unvetted` — the audit could not run at all — is kept distinct from it.
 */
export type CmaQueueState =
  | 'failed'       // build blew up — nothing to send
  | 'building'     // no document yet
  | 'audit-failed' // audit ran and failed — NOT sendable
  | 'unvetted'     // audit could not run — a human must read it before it goes
  | 'flagged'      // built, needs_review for some other reason
  | 'ready'        // built, audited, clean
  | 'queued'       // approved, waiting its turn in the cold drip
  | 'sent'
  | 'archived'

/** Whether the adversarial audit ran, and what it concluded. */
export type CmaAuditVerdict = 'pass' | 'fail' | 'review' | 'did-not-run'

/** The states from which an email may leave the building. */
const SENDABLE_STATES: ReadonlySet<CmaQueueState> = new Set<CmaQueueState>(['ready'])

/**
 * The ONE sendability rule, exported so the queue UI, the approve action and
 * any bot working this list all answer the question the same way.
 */
export function isSendableQueueState(state: CmaQueueState): boolean {
  return SENDABLE_STATES.has(state)
}

/**
 * Which table the row came from. Load-bearing, not cosmetic: a `bpo` row lives
 * in `broker_price_opinions`, its detail page is /admin/bpo, and the CMA
 * approve/send actions cannot operate on it.
 */
export type CmaDocKind = 'cma' | 'bpo'

export type CmaQueueRow = {
  id: string
  slug: string
  docKind: CmaDocKind
  /** Where to open this document. Resolved here so no surface guesses. */
  detailHref: string
  docType: string | null
  /** Raw `cmas.status` (draft | finalized | delivered | archived). */
  status: string
  /** The one pipeline state the queue renders. */
  state: CmaQueueState
  origin: CmaOrigin
  /** 'now' | 'drip' | 'manual' — what Approve will do with the email. */
  sendMode: CmaSendMode

  address: string
  city: string | null
  subdivision: string | null
  /** MLS ListingKey of the subject. Null when the document has none. */
  subjectListingKey: string | null

  contactName: string | null
  contactEmail: string | null
  /**
   * Email wins. `text` only when a stored line type is mobile, wireless, or cell
   * and the number is not DNC. A phone with no line type is `unconfirmed-phone`.
   */
  contactReach?: CmaQueueReach
  brokerSlug: string | null

  recommendedList: number | null
  valueLow: number | null
  valueHigh: number | null
  compsCount: number | null

  /**
   * What THEY had it priced at — last list price for an expired, current ask
   * for an FSBO. Null for a requested valuation (there is no asking price).
   */
  theirPrice: number | null
  theirPriceLabel: string | null
  /** recommendedList vs theirPrice, as a signed fraction (0.12 = we're 12% over). */
  theirPriceDelta: number | null
  /** When the listing went off market (expired) or was first detected (FSBO). */
  offMarketAt: string | null

  hasDocument: boolean
  buildError: string | null
  needsReview: boolean
  auditVerdict: CmaAuditVerdict
  /** Why the row is flagged, verbatim from the build summary. */
  reviewReason: string | null
  /** The audit's own summary when it failed — what to fix on a rebuild. */
  auditSummary: string | null
  /** How many findings the audit raised as critical. */
  auditCriticalCount: number

  createdAt: string | null
  deliveredAt: string | null
  /** Set once approved into the cold drip; cleared on hard-skip. */
  queuedAt: string | null
  emailSentAt: string | null

  /** Set when this CMA is joined to a prospect row, so send can address it. */
  prospectKind: 'expired' | 'fsbo' | null
  prospectId: string | null
  /**
   * The build's own hold for Matt (SKILL.md rule 22): the last failed ask sat
   * inside the trimmed band. The state stays 'flagged'; this is what makes
   * the flag unacknowledgeable at every send gate.
   */
  holdKind: 'ask-in-band' | null
  /**
   * True when the build measured the last failed ask against the band and
   * decided (build_summary.hold_measured, or a stored hold kind). False on a
   * row built before the field and on a row whose build had no failed cycle,
   * no ask or no band to measure; the send gates run a live backstop on the
   * row's own ask and band there.
   */
  holdDecided: boolean
}

/** Only the one kind the build writes maps through; anything else is null. */
export function holdKindFromSummary(summary: CmaBuildSummary | null | undefined): 'ask-in-band' | null {
  return summary?.hold_kind === 'ask-in-band' ? 'ask-in-band' : null
}

/**
 * The build decided rule 22: it stored the hold, or it measured an ask against
 * a band and found none. The presence of the hold_kind key is not enough: every
 * build since 2026-10-07 wrote hold_kind null, including the ones that had no
 * failed cycle, no ask or no band to measure, and reading the key as a
 * decision skipped the live backstop on exactly those rows (review, 2026-10-07).
 */
export function holdDecidedFromSummary(summary: CmaBuildSummary | null | undefined): boolean {
  if (summary == null || typeof summary !== 'object') return false
  return summary.hold_kind === 'ask-in-band' || summary.hold_measured === true
}

type Row = Record<string, unknown>

const CMA_COLUMNS =
  'id, slug, doc_type, subject_address, subject_subdivision, subject_city, subject_listing_key, ' +
  'client_name, client_email, client_phone, person_id, broker_slug, value_low, value_high, recommended_list, ' +
  'comps_count, status, created_at, delivered_at, build_error, html_path, ' +
  'build_summary, request_source, archived_at'

function str(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : v == null ? '' : String(v)
  return s === '' ? null : s
}

function num(v: unknown): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * A document counts as real only when html_path is populated and is not a
 * `pending:` placeholder — the same rule getBuiltDocForProspect applies, so
 * the queue pill and the send guard cannot disagree.
 */
function hasRealDocument(htmlPath: unknown): boolean {
  const p = str(htmlPath)
  return !!p && !p.startsWith('pending:')
}

export function resolveCmaQueueState(args: {
  status: string
  archivedAt: string | null
  buildError: string | null
  hasDocument: boolean
  needsReview: boolean
  auditVerdict: CmaAuditVerdict
  deliveredAt: string | null
  emailSentAt: string | null
  queuedAt: string | null
}): CmaQueueState {
  if (args.archivedAt || args.status === 'archived') return 'archived'
  if (args.deliveredAt || args.emailSentAt || args.status === 'delivered') return 'sent'
  if (args.queuedAt) return 'queued'
  if (args.buildError) return 'failed'
  if (!args.hasDocument) return 'building'
  // Audit outcome outranks the generic flag — "this one is wrong" and "nobody
  // checked this one" are different jobs for whoever is working the queue.
  if (args.auditVerdict === 'fail') return 'audit-failed'
  if (args.auditVerdict === 'did-not-run') return 'unvetted'
  if (args.needsReview || args.auditVerdict === 'review') return 'flagged'
  return 'ready'
}

export type CmaBuildSummary = {
  needs_review?: boolean
  review_reason?: string | null
  /** The build's own hold, when it recorded one (lib/cma/gap-hold.ts). */
  hold_kind?: string | null
  /** True when the build measured the last failed ask against the band (lib/cma/build-summary.ts). */
  hold_measured?: boolean
  audit?: {
    used_llm?: boolean
    verdict?: string | null
    summary?: string | null
    findings?: Array<{ severity?: string | null }> | null
  } | null
}

export function readCmaAuditVerdict(summary: CmaBuildSummary | null): {
  verdict: CmaAuditVerdict
  auditSummary: string | null
  criticalCount: number
} {
  const audit = summary?.audit ?? null
  if (!audit || audit.used_llm !== true) {
    return { verdict: 'did-not-run', auditSummary: null, criticalCount: 0 }
  }
  const raw = String(audit.verdict ?? '').toLowerCase()
  const verdict: CmaAuditVerdict = raw.includes('fail')
    ? 'fail'
    : raw.includes('review')
      ? 'review'
      : raw.includes('pass')
        ? 'pass'
        : 'review'
  const findings = Array.isArray(audit.findings) ? audit.findings : []
  const criticalCount = findings.filter((f) =>
    String(f?.severity ?? '').toLowerCase().includes('critical'),
  ).length
  return { verdict, auditSummary: str(audit.summary), criticalCount }
}

/**
 * Every prospect row that carries a cma_id, keyed by that id.
 *
 * Deliberately NOT an `.in(cmaIds)` filter: a few hundred uuids overflow the
 * PostgREST GET URL and the request dies as an opaque `fetch failed`. Both
 * prospect tables are small (hundreds of rows), so pulling the linked ones and
 * matching in memory is one bounded read instead of a chunked fan-out.
 */
async function fetchProspectContext(
  sb: ReturnType<typeof createServiceClient>,
): Promise<Map<string, {
  kind: 'expired' | 'fsbo'
  id: string
  theirPrice: number | null
  offMarketAt: string | null
  queuedAt: string | null
  emailSentAt: string | null
  contactEmail: string | null
  contactPhone: string | null
  ownerName: string | null
}>> {
  const out = new Map<string, {
    kind: 'expired' | 'fsbo'
    id: string
    theirPrice: number | null
    offMarketAt: string | null
    queuedAt: string | null
    emailSentAt: string | null
    contactEmail: string | null
    contactPhone: string | null
    ownerName: string | null
  }>()

  // Paged, not `.limit(2000)`: PostgREST caps a response at 1,000 rows and
  // drops the rest silently, so a cap above it reads as complete while being
  // short. Both builders carry a stable order on the primary key.
  const [expRes, fsboRes] = await Promise.all([
    fetchPagedRows<Row>((from, to) =>
      sb
        .from('expired_listings')
        .select(
          'cma_id, listing_key, list_price, original_list_price, expired_at, status_change_timestamp, ' +
            'outreach_email_queued_at, outreach_email_sent_at, contact_email, contact_phone, owner_name',
        )
        .not('cma_id', 'is', null)
        .order('listing_key', { ascending: true })
        .range(from, to),
    ),
    fetchPagedRows<Row>((from, to) =>
      sb
        .from('fsbo_listings')
        .select(
          'cma_id, fsbo_url, list_price, detected_at, ' +
            'outreach_email_queued_at, outreach_email_sent_at, contact_email, contact_phone, owner_name',
        )
        .not('cma_id', 'is', null)
        .order('fsbo_url', { ascending: true })
        .range(from, to),
    ),
  ])
  if (expRes.error) throw new Error(`cma queue: expired join failed: ${expRes.error.message}`)
  if (fsboRes.error) throw new Error(`cma queue: fsbo join failed: ${fsboRes.error.message}`)

  for (const r of expRes.rows) {
    const cmaId = str(r.cma_id)
    if (!cmaId) continue
    out.set(cmaId, {
      kind: 'expired',
      id: String(r.listing_key),
      // The price it actually died at, falling back to the original ask.
      theirPrice: num(r.list_price) ?? num(r.original_list_price),
      offMarketAt: str(r.expired_at) ?? str(r.status_change_timestamp),
      queuedAt: str(r.outreach_email_queued_at),
      emailSentAt: str(r.outreach_email_sent_at),
      contactEmail: str(r.contact_email),
      contactPhone: str(r.contact_phone),
      ownerName: str(r.owner_name),
    })
  }
  for (const r of fsboRes.rows) {
    const cmaId = str(r.cma_id)
    if (!cmaId || out.has(cmaId)) continue
    out.set(cmaId, {
      kind: 'fsbo',
      id: String(r.fsbo_url),
      theirPrice: num(r.list_price),
      offMarketAt: str(r.detected_at),
      queuedAt: str(r.outreach_email_queued_at),
      emailSentAt: str(r.outreach_email_sent_at),
      contactEmail: str(r.contact_email),
      contactPhone: str(r.contact_phone),
      ownerName: str(r.owner_name),
    })
  }
  return out
}


/**
 * Columns the queue needs off `broker_price_opinions`.
 *
 * This read lives here rather than in lib/data/bpo/reads.ts on purpose: that
 * file is the door for the BPO ENGINE (lib/bpo/**) and its worklist projection
 * carries neither `build_summary` nor `html_path`, which are exactly what the
 * queue state depends on. Both files sit inside lib/data/, so the DAL boundary
 * (G1) holds either way. Nothing here writes.
 */
const BPO_COLUMNS =
  'id, slug, subject_address, subject_subdivision, subject_city, subject_listing_key, opinion_value, value_low, ' +
  'value_high, comps_count, broker_slug, purpose, status, requested_by, person_id, ' +
  'last_sent_at, sent_count, created_at, finalized_at, archived_at, build_error, ' +
  'html_path, build_summary'

/**
 * One `broker_price_opinions` row as a queue line — PURE, so the shape is
 * testable without a database.
 *
 * Two deliberate nulls. `contactEmail` is null because the table has no client
 * email column at all: the only humans on a BPO are the broker who asked
 * (`requested_by`) and an optional CRM person link, and `sendBpoToLead` refuses
 * to run without that link. Leaving it null keeps every send guard in this
 * queue closed on a BPO — a BPO is sent from its own page, by a broker, after
 * they have read it. `theirPrice` is null because a broker price opinion has no
 * counter-price to argue with; inventing one from the subject's list price
 * would put a number on the row nobody quoted.
 */
export function mapBpoQueueRow(r: Record<string, unknown>): CmaQueueRow {
  const slug = String(r.slug)
  const summary = (r.build_summary ?? null) as CmaBuildSummary | null
  const audit = readCmaAuditVerdict(summary)
  const hasDocument = hasRealDocument(r.html_path)
  const status = String(r.status ?? 'draft')
  const sentAt = str(r.last_sent_at) ?? ((num(r.sent_count) ?? 0) > 0 ? str(r.created_at) : null)

  return {
    id: String(r.id),
    slug,
    docKind: 'bpo',
    detailHref: `/admin/bpo/${slug}`,
    docType: 'bpo',
    status,
    state: resolveCmaQueueState({
      status,
      archivedAt: str(r.archived_at),
      buildError: str(r.build_error),
      hasDocument,
      needsReview: summary?.needs_review === true,
      auditVerdict: audit.verdict,
      deliveredAt: null,
      emailSentAt: sentAt,
      // A BPO has no cold drip to wait in.
      queuedAt: null,
    }),
    origin: 'bpo',
    sendMode: sendModeForOrigin('bpo'),

    address: String(r.subject_address ?? ''),
    city: str(r.subject_city),
    subdivision: str(r.subject_subdivision),
    subjectListingKey: str(r.subject_listing_key),

    contactName: str(r.requested_by),
    contactEmail: null,
    contactReach: 'none',
    brokerSlug: str(r.broker_slug),

    recommendedList: num(r.opinion_value),
    valueLow: num(r.value_low),
    valueHigh: num(r.value_high),
    compsCount: num(r.comps_count),

    theirPrice: null,
    theirPriceLabel: null,
    theirPriceDelta: null,
    offMarketAt: null,

    hasDocument,
    buildError: str(r.build_error),
    needsReview: summary?.needs_review === true,
    auditVerdict: audit.verdict,
    reviewReason: str(summary?.review_reason ?? null),
    auditSummary: audit.auditSummary,
    auditCriticalCount: audit.criticalCount,

    createdAt: str(r.created_at),
    deliveredAt: null,
    queuedAt: null,
    emailSentAt: sentAt,

    prospectKind: null,
    prospectId: null,
    holdKind: holdKindFromSummary(summary),
    holdDecided: holdDecidedFromSummary(summary),
  }
}

/** Every BPO as a queue row. Throws rather than returning [] — an empty read
 *  would silently drop a whole lane out of the list (no-poison-null). */
async function fetchBpoQueueRows(
  sb: ReturnType<typeof createServiceClient>,
  includeArchived: boolean,
): Promise<CmaQueueRow[]> {
  let q = sb.from('broker_price_opinions').select(BPO_COLUMNS)
  if (!includeArchived) q = q.is('archived_at', null)
  const { data, error } = await q.order('created_at', { ascending: false }).limit(1000)
  if (error) throw new Error(`cma queue: bpo read failed: ${error.message}`)
  return ((data ?? []) as unknown as Row[]).map(mapBpoQueueRow)
}

/**
 * Every CMA in one list, newest first, with its origin context resolved.
 *
 * `includeArchived` is off by default — an archived row is a decision already
 * made and does not belong in a work queue.
 *
 * BPOs are unioned in (Matt 2026-09-07: "expireds/fsbo/seller valuation/and
 * BPOs all using the same engine but with their own nuances"). They are the one
 * lane that does not live in `cmas`, so their rows are read from
 * `broker_price_opinions` and mapped to the same shape. No data moves, and each
 * row carries `docKind` + `detailHref` so a caller can never send a BPO down a
 * CMA path.
 */
/** How many CMA rows the admin queue asks for. The read pages under PostgREST's 1,000-row ceiling. */
export const CMA_QUEUE_READ_LIMIT = 5000

function nationalPhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return digits
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
  return null
}

function phoneValues(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    if (typeof item === 'string' && item.trim()) out.push(item)
    else if (item && typeof item === 'object' && 'value' in item) {
      const value = (item as { value?: unknown }).value
      if (typeof value === 'string' && value.trim()) out.push(value)
    }
  }
  return out
}

/**
 * Email wins. A cell is `text` only when crm_phone_dnc_checks says the line
 * is mobile, wireless, or cell and the number is not DNC. An untyped phone
 * stays unconfirmed. The phone number itself is not copied onto the row.
 */
async function fillQueueReach(
  sb: NonNullable<ReturnType<typeof client>>,
  rows: CmaQueueRow[],
  scratch: Map<string, { phones: string[]; personId: number | null }>,
): Promise<void> {
  const needPerson: number[] = []
  for (const row of rows) {
    if ((row.contactEmail ?? '').trim()) {
      row.contactReach = 'email'
      continue
    }
    const bag = scratch.get(row.id)
    const hasDirect = (bag?.phones ?? []).some((phone) => nationalPhone(phone))
    if (!hasDirect && bag?.personId) needPerson.push(bag.personId)
  }

  const personPhones = new Map<number, string[]>()
  const personIds = [...new Set(needPerson)]
  for (let i = 0; i < personIds.length; i += 80) {
    const chunk = personIds.slice(i, i + 80)
    const { data, error } = await sb.from('crm_people').select('id, phones').in('id', chunk)
    if (error) {
      console.warn('[cma queue] person phone read failed:', error.message)
      break
    }
    for (const person of data ?? []) personPhones.set(Number(person.id), phoneValues(person.phones))
  }

  const numbersFor = new Map<string, string[]>()
  const keys = new Set<string>()
  for (const row of rows) {
    if ((row.contactEmail ?? '').trim()) continue
    const bag = scratch.get(row.id)
    const nums = [...(bag?.phones ?? [])]
    if (bag?.personId) nums.push(...(personPhones.get(bag.personId) ?? []))
    numbersFor.set(row.id, nums)
    for (const phone of nums) {
      const key = nationalPhone(phone)
      if (key) keys.add(key)
    }
  }

  const lines = new Map<string, { type: string | null; dnc: boolean }>()
  const keyList = [...keys]
  for (let i = 0; i < keyList.length; i += 80) {
    const chunk = keyList.slice(i, i + 80)
    const { data, error } = await sb
      .from('crm_phone_dnc_checks')
      .select('phone_last10, line_type, on_dnc')
      .in('phone_last10', chunk)
    if (error) {
      console.warn('[cma queue] line type read failed:', error.message)
      break
    }
    for (const check of data ?? []) {
      lines.set(String(check.phone_last10), { type: str(check.line_type), dnc: check.on_dnc === true })
    }
  }

  for (const row of rows) {
    if ((row.contactEmail ?? '').trim()) continue
    const intake: IntakePhone[] = []
    let hasAnyPhone = false
    for (const phone of numbersFor.get(row.id) ?? []) {
      const key = nationalPhone(phone)
      if (!key) continue
      hasAnyPhone = true
      const line = lines.get(key)
      intake.push({ number: key, type: line?.type ?? null, dnc: line?.dnc === true })
    }
    row.contactReach = cmaQueueReachFromFacts({
      email: row.contactEmail,
      hasConfirmedCell: pickSendableCell(intake) != null,
      hasAnyPhone,
    })
  }
}

export async function listCmaQueue(options: {
  limit?: number
  includeArchived?: boolean
} = {}): Promise<{ rows: CmaQueueRow[]; total: number; truncated: boolean }> {
  const sb = client()
  if (!sb) return { rows: [], total: 0, truncated: false }
  // Page under the PostgREST ceiling. A caller that asks for 500 still gets
  // 500. The admin queue asks for CMA_QUEUE_READ_LIMIT so the screen is the
  // whole non-archived table, and `truncated` is true when the cap still cut it.
  const limit = options.limit != null && options.limit > 0 ? options.limit : 500
  const includeArchived = options.includeArchived === true

  const countQuery = sb.from('cmas').select('id', { count: 'exact', head: true })
  const counted = includeArchived ? countQuery : countQuery.is('archived_at', null)

  const [countRes, pageRes, context, bpoRows] = await Promise.all([
    counted,
    fetchPagedRows<Row>((from, to) => {
      let q = sb
        .from('cmas')
        .select(CMA_COLUMNS)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
      if (!includeArchived) q = q.is('archived_at', null)
      return q.range(from, to)
    }, limit),
    fetchProspectContext(sb),
    fetchBpoQueueRows(sb, includeArchived),
  ])
  if (countRes.error) throw new Error(`cma queue read failed: ${countRes.error.message}`)
  if (pageRes.error) throw new Error(`cma queue read failed: ${pageRes.error.message}`)

  const cmaRows = pageRes.rows
  const count = countRes.count

  const phoneScratch = new Map<string, { phones: string[]; personId: number | null }>()
  const rows: CmaQueueRow[] = cmaRows.map((r) => {
    const id = String(r.id)
    const docType = str(r.doc_type)
    const origin = classifyCmaOrigin(str(r.request_source), docType)
    const ctx = context.get(id) ?? null
    const summary = (r.build_summary ?? null) as CmaBuildSummary | null
    const audit = readCmaAuditVerdict(summary)
    const hasDocument = hasRealDocument(r.html_path)
    const status = String(r.status ?? 'draft')
    const recommendedList = num(r.recommended_list)
    const theirPrice = ctx?.theirPrice ?? theirPriceFromBuildSummary(summary, origin)
    const deliveredAt = str(r.delivered_at)
    const emailSentAt = ctx?.emailSentAt ?? null
    const queuedAt = ctx?.queuedAt ?? null
    const contactEmail = ctx?.contactEmail ?? str(r.client_email)
    phoneScratch.set(id, {
      phones: [ctx?.contactPhone ?? null, str(r.client_phone)].filter((phone): phone is string => !!phone),
      personId: num(r.person_id),
    })

    return {
      id,
      slug: String(r.slug),
      docKind: 'cma',
      detailHref: `/admin/cmas/${String(r.slug)}`,
      docType,
      status,
      state: resolveCmaQueueState({
        status,
        archivedAt: str(r.archived_at),
        buildError: str(r.build_error),
        hasDocument,
        needsReview: summary?.needs_review === true,
        auditVerdict: audit.verdict,
        deliveredAt,
        emailSentAt,
        queuedAt,
      }),
      origin,
      sendMode: sendModeForOrigin(origin),

      address: String(r.subject_address ?? ''),
      city: str(r.subject_city),
      subdivision: str(r.subject_subdivision),
      subjectListingKey: str(r.subject_listing_key),

      // The prospect row is the better contact of record for cold origins —
      // it is what the send rail addresses — so it wins when both are set.
      contactName: ctx?.ownerName ?? str(r.client_name),
      contactEmail,
      contactReach: cmaQueueReachFromFacts({
        email: contactEmail,
        hasConfirmedCell: false,
        hasAnyPhone: false,
      }),
      brokerSlug: str(r.broker_slug),

      recommendedList,
      valueLow: num(r.value_low),
      valueHigh: num(r.value_high),
      compsCount: num(r.comps_count),

      theirPrice,
      theirPriceLabel: theirPrice == null ? null : theirPriceLabelFor(origin),
      theirPriceDelta:
        recommendedList != null && theirPrice != null && theirPrice > 0
          ? (recommendedList - theirPrice) / theirPrice
          : null,
      offMarketAt: ctx?.offMarketAt ?? null,

      hasDocument,
      buildError: str(r.build_error),
      needsReview: summary?.needs_review === true,
      auditVerdict: audit.verdict,
      reviewReason: str(summary?.review_reason ?? null),
      auditSummary: audit.auditSummary,
      auditCriticalCount: audit.criticalCount,

      createdAt: str(r.created_at),
      deliveredAt,
      queuedAt,
      emailSentAt,

      prospectKind: ctx?.kind ?? prospectKindForOrigin(origin),
      prospectId: ctx?.id ?? null,
      holdKind: holdKindFromSummary(summary),
      holdDecided: holdDecidedFromSummary(summary),
    }
  })

  await fillQueueReach(sb, rows, phoneScratch)

  // Newest first across both tables, so the union reads as one list.
  const all = [...rows, ...bpoRows].sort((a, b) =>
    (b.createdAt ?? '').localeCompare(a.createdAt ?? ''),
  )
  const cmaTotal = count ?? rows.length
  return {
    rows: all,
    total: cmaTotal + bpoRows.length,
    truncated: cmaTotal > rows.length,
  }
}
