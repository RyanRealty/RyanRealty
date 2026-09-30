import 'server-only'

/**
 * market-report-bulk — BULK market-report delivery, routed through the newsletter
 * delivery ledger (W8.6).
 *
 * The market-report product has two send shapes and they are deliberately NOT the
 * same code path:
 *
 *   INDIVIDUAL (cadence)  lib/crm/market-report-send + /api/cron/crm-market-report-send
 *                         Walks crm_report_subscriptions and mails ONE contact on
 *                         their own weekly/monthly/quarterly window, personalized
 *                         to that contact's subscribed areas. Untouched by this file.
 *
 *   BULK (this file)      One issue, one body, many recipients, chosen by an
 *                         AUDIENCE SELECTOR. Delivery does NOT get its own sender
 *                         loop. It is handed to the newsletter queue, which is the
 *                         delivery ledger of record.
 *
 * Why reuse instead of a second blast loop: the newsletter queue already owns every
 * rail a bulk email must clear, and each one is enforced per recipient at drain
 * time, not once at enqueue:
 *
 *   - opt-out is never resurrected      enqueueNewsletterToEmails excludes any address
 *                                       whose subscriber row is not 'active' BEFORE
 *                                       enrolling it (S-10)
 *   - suppression, fail-closed           drainNewsletter calls isSuppressedByEmail on
 *                                       every claimed row immediately before sendEmail
 *   - unsubscribe, RFC 8058              every recipient gets a real subscriber row and
 *                                       therefore an unsubscribe_token; the drain sets
 *                                       List-Unsubscribe + List-Unsubscribe-Post
 *   - late unsubscribe during a send     the drain re-reads subscriber status per row
 *   - reputation                         deliverabilityVerdict blocks a large send on a
 *                                       LOW/BAD Gmail reputation; the circuit breaker
 *                                       auto-pauses on bounce >2% / complaint >0.1%
 *   - warm-up + tranching                computeSchedule spreads a large audience across
 *                                       days by engagement tier
 *   - per-recipient ledger               newsletter_recipients rows carry delivery status,
 *                                       opens, clicks, and the frozen broker attribution
 *
 * This module therefore contains NO send call. It renders, it writes a draft, and it
 * hands the draft to one of the queue's two enqueue functions. scripts/check-market-report-bulk-ledger.mjs
 * fails the build if a direct send call ever appears here, or if an audience kind
 * is added without a resolver + a ledger route.
 *
 * Approval: routing a real audience is a per-action approval class (CLAUDE.md
 * "Approval Model" — publishing / outbound to real people). mode 'preview' is the
 * dry run and writes NOTHING; mode 'queue' refuses without an explicit approver.
 *
 * The same rails as the scheduled report (review 2026-09-30):
 *   - §0 Spark gate: before anything is queued, every figure the issue prints
 *     (each area's months of supply, which places its meter, and the verdict
 *     read from it; the median the intro names) is rebuilt from Spark by the
 *     sender's own gate (lib/crm/market-report-spark-gate.ts), strict 1% rule.
 *     A STOP, a figure it cannot rebuild, or a gate that cannot run HOLDS the
 *     whole issue: no draft, nothing queued, and Matt is paged with both values.
 *   - The 'report-subscribers' audience skips a deleted contact and a
 *     subscription still waiting on its first-send approval, the same people
 *     the scheduled path never mails.
 */

import {
  MAX_LIST_RECIPIENTS,
  describeMarketReportAudience,
  ledgerRouteFor,
  newsletterAudienceValue,
  nextEmailSendWindow,
  outsideEmailSendWindow,
  parseMarketReportAudience,
  type LedgerRoute,
  type MarketReportAudience,
} from './market-report-audience'
import {
  decodeEntitiesForText,
  marketCitiesFromBlocks,
  marketIntroLine,
  marketSection,
} from './produce-draft'
import { enqueueNewsletter, enqueueNewsletterToEmails } from './send-queue'
import { getMarketReportData } from '@/lib/data/crm/getMarketReportData'
import { getActiveMarketReportSubscriptions } from '@/lib/data/crm/getMarketReportSubscribers'
import { getPersonPrimaryEmail } from '@/lib/data/crm/getPersonPrimaryEmail'
import { getAudienceEligiblePeople } from '@/lib/data/crm/getAudienceEligiblePeople'
import { getActiveSubscribersForSend } from '@/lib/data/newsletter'
import { createNewsletterDraft, setNewsletterCitations, type NewsletterCitationEntry } from '@/lib/data'
import { htmlToPlainText } from '@/lib/email/prepare'
import type { MarketReportAreaBlock } from '@/lib/data/crm/getMarketReportData'
import type { ReportFigure } from '@/lib/crm/market-report-email'
import { formatMonths } from '@/lib/crm/market-report-format'
import { describeSparkGate, runSparkGate, SPARK_GATE_RULE, type SparkGateResult } from '@/lib/crm/market-report-spark-gate'
import { queueBrokerHealthAlert } from '@/lib/crm/broker-alerts'

// ── audience resolution ───────────────────────────────────────────────────────

/** The readers the resolver depends on. Production wires the real DAL functions. */
export interface AudienceDeps {
  fetchReportSubscribers: typeof getActiveMarketReportSubscriptions
  resolvePersonEmail: typeof getPersonPrimaryEmail
  fetchSegmentSubscribers: typeof getActiveSubscribersForSend
  fetchTaggedPeople: typeof getAudienceEligiblePeople
}

const REAL_AUDIENCE_DEPS: AudienceDeps = {
  fetchReportSubscribers: getActiveMarketReportSubscriptions,
  resolvePersonEmail: getPersonPrimaryEmail,
  fetchSegmentSubscribers: getActiveSubscribersForSend,
  fetchTaggedPeople: getAudienceEligiblePeople,
}

export type ResolvedAudience = {
  kind: MarketReportAudience['kind']
  label: string
  route: LedgerRoute
  /**
   * The resolved addresses. For the 'audience-segment' route these are
   * INFORMATIONAL (the count the admin confirms against): enqueueNewsletter
   * re-resolves the segment from newsletters.audience through the same reader, so
   * the queue is never handed a stale list.
   */
  emails: string[]
  /** How the list was produced, for the confirm dialog and the audit trail. */
  trace: string
}

function normalizeEmail(v: string | null | undefined): string | null {
  const e = (v ?? '').trim().toLowerCase()
  return e.includes('@') ? e : null
}

/**
 * Resolve an audience descriptor to its recipient set. Every kind in
 * MARKET_REPORT_AUDIENCE_KINDS has a case here; the switch is exhaustive over the
 * union, so a new kind fails `tsc` until it is resolved.
 */
export async function resolveMarketReportAudience(
  audience: MarketReportAudience,
  deps: Partial<AudienceDeps> = {},
): Promise<ResolvedAudience> {
  const d: AudienceDeps = { ...REAL_AUDIENCE_DEPS, ...deps }
  const label = describeMarketReportAudience(audience)
  const route = ledgerRouteFor(audience.kind)
  const seen = new Set<string>()
  const emails: string[] = []
  const push = (v: string | null | undefined) => {
    const e = normalizeEmail(v)
    if (!e || seen.has(e)) return
    seen.add(e)
    emails.push(e)
  }

  switch (audience.kind) {
    case 'report-subscribers': {
      const subs = await d.fetchReportSubscribers(MAX_LIST_RECIPIENTS)
      let matched = 0
      let deleted = 0
      let unapproved = 0
      for (const s of subs) {
        if (audience.cadence !== 'any' && s.frequency !== audience.cadence) continue
        if (audience.areaSlug && !s.areas.includes(audience.areaSlug)) continue
        // The people the scheduled path never mails (review 2026-09-30): a
        // deleted contact, and a subscription no broker has approved yet.
        if (s.personDeleted) {
          deleted += 1
          continue
        }
        if (!s.firstSendApprovedAt) {
          unapproved += 1
          continue
        }
        matched += 1
        push(await d.resolvePersonEmail(s.personId))
      }
      return {
        kind: audience.kind,
        label,
        route,
        emails,
        trace:
          `crm_report_subscriptions is_active=true · ${matched} matched the filter · ${emails.length} had an email on file · ` +
          `${deleted} deleted contact${deleted === 1 ? '' : 's'} skipped · ${unapproved} awaiting first-send approval skipped`,
      }
    }
    case 'newsletter-segment': {
      const subs = await d.fetchSegmentSubscribers({ segment: audience.segment })
      for (const s of subs) push(s.email)
      return {
        kind: audience.kind,
        label,
        route,
        emails,
        trace: `newsletter_subscribers status=active segment=${audience.segment} · ${emails.length} addresses`,
      }
    }
    case 'crm-tag': {
      const { people, excludedSuppressed, excludedRealtors } = await d.fetchTaggedPeople({ tag: audience.tag })
      for (const p of people) push(p.emails?.[0] ?? p.email ?? null)
      return {
        kind: audience.kind,
        label,
        route,
        emails,
        trace:
          `crm_people tag=${audience.tag} via getAudienceEligiblePeople · ${emails.length} with an email · ` +
          `${excludedSuppressed} suppressed and ${excludedRealtors} realtor rows already excluded by the reader`,
      }
    }
    case 'explicit': {
      for (const e of audience.emails) push(e)
      return {
        kind: audience.kind,
        label,
        route,
        emails,
        trace: `pasted list · ${emails.length} valid, de-duped addresses`,
      }
    }
  }
}

// ── the bulk router ───────────────────────────────────────────────────────────

export type BulkMode = 'preview' | 'queue'

export type BulkError =
  | 'invalid_audience'
  | 'no_areas'
  | 'no_recipients'
  | 'no_market_data'
  | 'too_many_recipients'
  | 'count_changed'
  | 'approval_required'
  | 'outside_send_window'
  | 'draft_failed'
  | 'enqueue_failed'
  /** The §0 Spark gate did not pass every printed figure: nothing was queued. */
  | 'spark_hold'

export type BulkPreviewResult = {
  ok: true
  mode: 'preview'
  audienceLabel: string
  audienceTrace: string
  route: LedgerRoute
  recipientCount: number
  /** First few addresses so the admin can eyeball who this actually reaches. */
  sample: string[]
  subject: string
  bodyHtml: string
  bodyText: string
  citations: NewsletterCitationEntry[]
  renderedAreas: string[]
  omittedAreas: string[]
  /** null when a queue action would run now; ISO when the send window is shut. */
  windowOpensAt: string | null
}

export type BulkQueuedResult = {
  ok: true
  mode: 'queue'
  newsletterId: string
  audienceLabel: string
  route: LedgerRoute
  recipientCount: number
  queued: number
}

export type BulkFailure = { ok: false; error: BulkError; detail?: string }
export type BulkResult = BulkPreviewResult | BulkQueuedResult | BulkFailure

/** The writers the router depends on. Production wires the real implementations. */
export interface BulkDeps extends AudienceDeps {
  fetchAreas: typeof getMarketReportData
  createDraft: typeof createNewsletterDraft
  setCitations: typeof setNewsletterCitations
  enqueueAudience: typeof enqueueNewsletter
  enqueueList: typeof enqueueNewsletterToEmails
  sparkGate: typeof runSparkGate
  alert: typeof queueBrokerHealthAlert
}

const REAL_BULK_DEPS: BulkDeps = {
  ...REAL_AUDIENCE_DEPS,
  fetchAreas: getMarketReportData,
  createDraft: createNewsletterDraft,
  setCitations: setNewsletterCitations,
  enqueueAudience: enqueueNewsletter,
  enqueueList: enqueueNewsletterToEmails,
  sparkGate: runSparkGate,
  alert: queueBrokerHealthAlert,
}

/**
 * Every figure the bulk issue prints, in the trace shape the §0 Spark gate
 * checks (lib/crm/market-report-spark-check.ts reads the label): each area's
 * months of supply (its meter's position) and the verdict read from it, and
 * the twelve-month median the intro names (the single area's, or Bend's in a
 * multi-area issue; marketIntroLine in lib/newsletter/produce-draft.ts).
 * Pure.
 */
export function bulkIssueFigures(
  cities: ReadonlyArray<{ slug: string; areaLabel: string; monthsOfSupply: number; verdict: string; medianPrice: number | null }>,
  fetchedAt: string,
): ReportFigure[] {
  const out: ReportFigure[] = []
  for (const c of cities) {
    out.push({
      area: c.slug,
      areaLabel: c.areaLabel,
      label: 'months of supply',
      value: c.monthsOfSupply,
      display: `meter at ${formatMonths(c.monthsOfSupply) ?? 'n/a'}`,
      source: 'getMarketReportData (the bulk issue meter)',
      filter: `${c.slug} months_of_supply=${c.monthsOfSupply}`,
      as_of: fetchedAt,
      n: null,
    })
    out.push({
      area: c.slug,
      areaLabel: c.areaLabel,
      label: 'market verdict',
      value: null,
      display: c.verdict,
      source: 'derived from months of supply (4 or less sellers, 4 to 6 balanced, 6 or more buyers)',
      filter: `months_of_supply=${c.monthsOfSupply}`,
      as_of: fetchedAt,
      n: null,
    })
  }
  const named = cities.length === 1 ? cities[0] : cities.find((c) => c.slug === 'bend')
  if (named && named.medianPrice != null) {
    out.push({
      area: named.slug,
      areaLabel: named.areaLabel,
      label: 'median sale price, last 12 months',
      value: named.medianPrice,
      display: String(named.medianPrice),
      source: 'getMarketReportData (the bulk issue intro)',
      filter: `${named.slug} trailing 12 months closed`,
      as_of: fetchedAt,
      n: null,
    })
  }
  return out
}

export interface BulkSendInput {
  audience: unknown
  areas: string[]
  mode: BulkMode
  /** Admin email. Required for mode 'queue' — silence is never approval. */
  approvedBy?: string | null
  /**
   * The recipient count the approver actually saw in the preview. When supplied
   * (the admin surface always supplies it) a queue whose freshly resolved count
   * no longer matches is REFUSED. Stops the case where a tag or a segment grew
   * between "preview 40 people" and "queue", and the approver's consent silently
   * covers an audience they never saw.
   */
  expectedRecipientCount?: number
  now?: Date
  sampleSize?: number
  deps?: Partial<BulkDeps>
}

const SUBJECT_MAX_AREAS = 3

/** Subject built from the areas that actually resolved data, never from the request. */
function buildSubject(areaLabels: string[]): string {
  if (areaLabels.length === 0) return 'Your Central Oregon market report'
  if (areaLabels.length === 1) return `Your ${areaLabels[0]} market report`
  if (areaLabels.length <= SUBJECT_MAX_AREAS) {
    return `Your ${areaLabels.slice(0, -1).join(', ')} and ${areaLabels[areaLabels.length - 1]} market report`
  }
  return 'Your Central Oregon market report'
}

/**
 * Run one bulk market-report send.
 *
 * mode 'preview' resolves the audience, renders the issue from §0 cache data, and
 * returns everything the admin needs to decide. It writes NOTHING: no draft, no
 * queue row, no subscriber row, no send.
 *
 * mode 'queue' additionally writes the draft + citations and hands it to the
 * newsletter queue. It refuses without an approver and refuses outside the send
 * window. It still does not send: the newsletter drain cron does, on its own
 * schedule, re-checking suppression per recipient.
 *
 * Never throws — every failure is a typed { ok:false, error } so an admin action
 * always renders a message instead of a stack trace.
 */
export async function runMarketReportBulkSend(input: BulkSendInput): Promise<BulkResult> {
  const deps: BulkDeps = { ...REAL_BULK_DEPS, ...(input.deps ?? {}) }
  const now = input.now ?? new Date()
  const sampleSize = Math.max(0, Math.trunc(input.sampleSize ?? 5))

  const audience = parseMarketReportAudience(input.audience)
  if (!audience) return { ok: false, error: 'invalid_audience' }

  const areas = Array.isArray(input.areas)
    ? [...new Set(input.areas.map((a) => (typeof a === 'string' ? a.trim().toLowerCase() : '')).filter(Boolean))]
    : []
  if (areas.length === 0) return { ok: false, error: 'no_areas' }

  // ── audience ────────────────────────────────────────────────────────────────
  let resolved: ResolvedAudience
  try {
    resolved = await resolveMarketReportAudience(audience, deps)
  } catch (e) {
    return { ok: false, error: 'no_recipients', detail: e instanceof Error ? e.message : String(e) }
  }
  if (resolved.emails.length === 0) return { ok: false, error: 'no_recipients' }
  if (resolved.route === 'email-list' && resolved.emails.length > MAX_LIST_RECIPIENTS) {
    return {
      ok: false,
      error: 'too_many_recipients',
      detail: `${resolved.emails.length} resolved, cap is ${MAX_LIST_RECIPIENTS}`,
    }
  }
  if (
    input.mode === 'queue' &&
    typeof input.expectedRecipientCount === 'number' &&
    input.expectedRecipientCount !== resolved.emails.length
  ) {
    return {
      ok: false,
      error: 'count_changed',
      detail: `${resolved.emails.length} now, ${input.expectedRecipientCount} when you previewed`,
    }
  }

  // ── §0 content ──────────────────────────────────────────────────────────────
  const fetchedAt = now.toISOString()
  let blocks
  try {
    blocks = await deps.fetchAreas(areas)
  } catch (e) {
    return { ok: false, error: 'no_market_data', detail: e instanceof Error ? e.message : String(e) }
  }
  const { cities, citations } = marketCitiesFromBlocks(blocks ?? [], fetchedAt)
  // §0: an area with no verified absorption rate is dropped by the builder. If
  // nothing survives there is no honest issue to send, so nothing ships.
  if (cities.length === 0) return { ok: false, error: 'no_market_data' }

  const renderedAreas = cities.map((c) => c.slug)
  const omittedAreas = areas.filter((a) => !renderedAreas.includes(a))
  const bodyHtml = marketSection(cities, marketIntroLine(cities, 'areas'))
  const bodyText = decodeEntitiesForText(htmlToPlainText(bodyHtml))
  const subject = buildSubject(cities.map((c) => c.areaLabel))

  const windowShut = outsideEmailSendWindow(now)

  if (input.mode === 'preview') {
    return {
      ok: true,
      mode: 'preview',
      audienceLabel: resolved.label,
      audienceTrace: resolved.trace,
      route: resolved.route,
      recipientCount: resolved.emails.length,
      sample: resolved.emails.slice(0, sampleSize),
      subject,
      bodyHtml,
      bodyText,
      citations,
      renderedAreas,
      omittedAreas,
      windowOpensAt: windowShut ? nextEmailSendWindow(now).toISOString() : null,
    }
  }

  // ── queue (per-action approval class) ───────────────────────────────────────
  const approvedBy = (input.approvedBy ?? '').trim()
  if (!approvedBy) return { ok: false, error: 'approval_required' }

  // Send window. A bulk issue is REFUSED outside 08:00-20:00 market time rather
  // than deferred through scheduleNewsletter: the scheduled path is drained by
  // enqueueDueScheduled -> enqueueNewsletter, which re-resolves recipients from
  // newsletters.audience. For an email-list route that string is not a segment,
  // so the promotion would fall through to "every active subscriber" and reach
  // an audience nobody chose. Refusing is the safe construction; the admin
  // queues it when the window opens.
  if (windowShut) {
    return {
      ok: false,
      error: 'outside_send_window',
      detail: nextEmailSendWindow(now).toISOString(),
    }
  }

  // ── §0 Spark gate: nothing is queued unreconciled (review 2026-09-30). ──────
  const printed = new Set(renderedAreas)
  const checkedBlocks = (blocks ?? []).filter((b: MarketReportAreaBlock) => printed.has(b.slug))
  let spark: SparkGateResult
  try {
    spark = await deps.sparkGate({ blocks: checkedBlocks, figures: bulkIssueFigures(cities, fetchedAt), now })
  } catch (e) {
    spark = {
      verdict: 'not-reconciled',
      rule: SPARK_GATE_RULE,
      checkedAt: now.toISOString(),
      since: null,
      checks: [],
      queries: [],
      polygonGaps: [],
      error: e instanceof Error ? e.message : String(e),
    }
  }
  if (spark.verdict !== 'ok') {
    const detail = describeSparkGate(spark, 600)
    try {
      await deps.alert({
        key: `market-report-bulk:spark-hold:${renderedAreas.join(',')}`,
        cooldownMinutes: 60,
        body: `A bulk market report (${resolved.label}, ${resolved.emails.length} recipients) was held before queueing: ${detail.slice(0, 300)}`,
      })
    } catch {
      // best-effort: the refusal below is the record the approver sees
    }
    return { ok: false, error: 'spark_hold', detail }
  }

  const draft = await deps.createDraft({
    subject,
    preview_text: marketIntroLine(cities, 'areas').slice(0, 140),
    body_html: bodyHtml,
    body_text: bodyText,
    audience: newsletterAudienceValue(audience),
    created_by: approvedBy,
  })
  if (!draft.ok || !draft.id) return { ok: false, error: 'draft_failed', detail: draft.error }
  const newsletterId = draft.id

  // §0 audit trail travels with the issue.
  await deps.setCitations(newsletterId, citations)

  // ── THE LEDGER. Delivery is the newsletter queue's job from here. ───────────
  if (resolved.route === 'audience-segment') {
    const res = await deps.enqueueAudience(newsletterId)
    if (!res.ok) return { ok: false, error: 'enqueue_failed', detail: res.error }
    return {
      ok: true,
      mode: 'queue',
      newsletterId,
      audienceLabel: resolved.label,
      route: resolved.route,
      recipientCount: res.queued,
      queued: res.queued,
    }
  }

  const res = await deps.enqueueList(newsletterId, resolved.emails)
  if (!res.ok) return { ok: false, error: 'enqueue_failed', detail: res.error }
  return {
    ok: true,
    mode: 'queue',
    newsletterId,
    audienceLabel: resolved.label,
    route: resolved.route,
    recipientCount: resolved.emails.length,
    queued: res.queued ?? 0,
  }
}
