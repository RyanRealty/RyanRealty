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
import { theirPriceFromBuildSummary } from '@/lib/cma/queue-view'

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

export type CmaQueueRow = {
  id: string
  slug: string
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

  contactName: string | null
  contactEmail: string | null
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
}

type Row = Record<string, unknown>

const CMA_COLUMNS =
  'id, slug, doc_type, subject_address, subject_subdivision, subject_city, ' +
  'client_name, client_email, broker_slug, value_low, value_high, recommended_list, ' +
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

function resolveState(args: {
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

type BuildSummary = {
  needs_review?: boolean
  review_reason?: string | null
  audit?: {
    used_llm?: boolean
    verdict?: string | null
    summary?: string | null
    findings?: Array<{ severity?: string | null }> | null
  } | null
}

function readAudit(summary: BuildSummary | null): {
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
            'outreach_email_queued_at, outreach_email_sent_at, contact_email, owner_name',
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
            'outreach_email_queued_at, outreach_email_sent_at, contact_email, owner_name',
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
      ownerName: str(r.owner_name),
    })
  }
  return out
}

/**
 * Every CMA in one list, newest first, with its origin context resolved.
 *
 * `includeArchived` is off by default — an archived row is a decision already
 * made and does not belong in a work queue.
 */
export async function listCmaQueue(options: {
  limit?: number
  includeArchived?: boolean
} = {}): Promise<{ rows: CmaQueueRow[]; total: number }> {
  const sb = client()
  if (!sb) return { rows: [], total: 0 }
  // Clamped to PostgREST's response ceiling: a larger window would come back
  // short without saying so. 418 CMAs exist as of 2026-09-04, so one page is
  // the whole table — revisit with real paging when it approaches 1,000.
  const limit = Math.min(options.limit ?? 500, 1000)

  let q = sb.from('cmas').select(CMA_COLUMNS, { count: 'exact' })
  if (!options.includeArchived) q = q.is('archived_at', null)

  const { data, count, error } = await q
    .order('created_at', { ascending: false })
    .range(0, limit - 1)
  if (error) throw new Error(`cma queue read failed: ${error.message}`)

  const cmaRows = (data ?? []) as unknown as Row[]
  const context = await fetchProspectContext(sb)

  const rows: CmaQueueRow[] = cmaRows.map((r) => {
    const id = String(r.id)
    const docType = str(r.doc_type)
    const origin = classifyCmaOrigin(str(r.request_source), docType)
    const ctx = context.get(id) ?? null
    const summary = (r.build_summary ?? null) as BuildSummary | null
    const audit = readAudit(summary)
    const hasDocument = hasRealDocument(r.html_path)
    const status = String(r.status ?? 'draft')
    const recommendedList = num(r.recommended_list)
    const theirPrice = ctx?.theirPrice ?? theirPriceFromBuildSummary(summary, origin)
    const deliveredAt = str(r.delivered_at)
    const emailSentAt = ctx?.emailSentAt ?? null
    const queuedAt = ctx?.queuedAt ?? null

    return {
      id,
      slug: String(r.slug),
      docType,
      status,
      state: resolveState({
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

      // The prospect row is the better contact of record for cold origins —
      // it is what the send rail addresses — so it wins when both are set.
      contactName: ctx?.ownerName ?? str(r.client_name),
      contactEmail: ctx?.contactEmail ?? str(r.client_email),
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
    }
  })

  return { rows, total: count ?? rows.length }
}
