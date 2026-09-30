/**
 * market-report-admin — what a broker can do to a contact's market-report
 * subscription from the CRM (the record card, the send center, the
 * Subscriptions hub), behind the caller's auth and scope checks.
 *
 * Matt's decisions 2026-09-29: admins see the same reports the contact sees
 * and have the same controls (on/off, interval, areas); the first send goes
 * to the broker's own inbox as a preview, and only an explicit approval lets
 * the cadence send it. Every change here plans through
 * lib/crm/market-report-subscription-control.ts and lands with a crm_timeline
 * row naming the admin, so the hub and the record card can no longer change a
 * subscription silently.
 *
 * Server-only. Reads and writes go through lib/data/crm (DAL boundary).
 */
import 'server-only'

import { buildMarketReportAreas, type ReportFrequency } from '@/lib/data/crm/getContactReportSubscriptions'
import {
  applyReportSubscriptionPatch,
  createReportSubscription,
  getMarketReportContact,
  getReportSubscriptionRecord,
  type ReportSubscriptionRecord,
} from '@/lib/data/crm/marketReportSubscription'
import { getLatestDeliveredReportAt, getLatestReportPreview } from '@/lib/data/crm/marketReportSends'
import {
  planReportChange,
  planReportChanges,
  type ReportChange,
} from '@/lib/crm/market-report-subscription-control'
import { deliverMarketReport, type DeliverReportOutcome } from '@/lib/crm/market-report-deliver'
import { isInternalOutboundRecipient } from '@/lib/email/auto-track'
import { reportAreaLabel } from '@/lib/crm/market-report-areas'

export type AdminResult = { ok: true; message: string } | { ok: false; error: string }

/**
 * Validate + de-dupe area slugs. Unknown slugs are reported, never dropped.
 * The authority is the list the calling surface OFFERED: the report-area
 * registry by default (the record card, the send center, the preferences
 * page), or the caller's own set (the Subscriptions hub offers the
 * crm_report_areas config table), so a surface never refuses an area it
 * showed.
 */
export function sanitizeAdminAreas(
  raw: readonly unknown[],
  validSlugs?: ReadonlySet<string>,
): { areas: string[]; unknown: string[] } {
  const valid = validSlugs ?? new Set(buildMarketReportAreas().map((a) => a.slug))
  const seen = new Set<string>()
  const areas: string[] = []
  const unknown: string[] = []
  for (const r of raw) {
    const slug = typeof r === 'string' ? r.trim() : ''
    if (!slug) continue
    if (!valid.has(slug)) {
      unknown.push(slug)
      continue
    }
    if (seen.has(slug)) continue
    seen.add(slug)
    areas.push(slug)
  }
  return { areas, unknown }
}

/** What the broker is told after a change (the planner's own lines speak to the contact). */
export function adminChangeMessage(change: ReportChange, rec: Pick<ReportSubscriptionRecord, 'firstSendApprovedAt'>): string {
  switch (change.kind) {
    case 'pause':
      return 'Market reports turned off.'
    case 'resume':
      return rec.firstSendApprovedAt
        ? 'Market reports turned on.'
        : 'Market reports turned on. The first send waits for your approval after a preview.'
    case 'stop':
      return 'Market reports stopped.'
    case 'frequency':
      return `Market reports set to ${change.frequency}.`
    case 'areas':
      return 'Market report areas saved.'
    case 'approve':
      return 'First send approved. It goes out at the next 8am to 8pm Pacific run while reports are on.'
  }
}

async function applyChange(
  rec: ReportSubscriptionRecord,
  change: ReportChange,
  admin: { email: string; brokerSlug: string | null; consentNote?: string | null },
): Promise<AdminResult> {
  const plan = planReportChange(rec, change, { via: 'admin', adminEmail: admin.email, consentNote: admin.consentNote })
  if (!plan.ok) return plan
  if (plan.noop) return { ok: true, message: 'Nothing to change.' }
  const res = await applyReportSubscriptionPatch(rec, plan.patch, {
    title: plan.title,
    payload: { via: 'admin', change: change.kind },
    broker: admin.brokerSlug,
    source: 'app',
  })
  return res.ok ? { ok: true, message: adminChangeMessage(change, rec) } : { ok: false, error: res.error }
}

/**
 * Set a contact's subscription: areas, interval, on/off. Creates the row when
 * the contact has none and `createIfMissing` (a first setup from the record
 * card or the send center). A created row starts NOT approved, so nothing
 * sends until a broker approves the first send; its last_sent_at starts at the
 * last report the contact actually received, so a "Send now + subscribe" does
 * not send the same report twice.
 *
 * On an existing row every requested change is planned first and lands as
 * ONE write with one timeline row, so a refused turn-on (no areas, or a
 * contact's own stop without a consent note) leaves nothing half-saved.
 */
export async function adminUpdateReportSubscription(input: {
  personId: number
  admin: { email: string; brokerSlug: string | null }
  areas?: readonly unknown[]
  /** The areas the calling surface offered (see sanitizeAdminAreas). Default: the registry. */
  validAreas?: ReadonlySet<string>
  frequency?: ReportFrequency
  active?: boolean
  consentNote?: string | null
  createIfMissing?: boolean
}): Promise<AdminResult> {
  let areas: string[] | undefined
  if (input.areas) {
    const s = sanitizeAdminAreas(input.areas, input.validAreas)
    if (s.unknown.length) return { ok: false, error: `Unknown area${s.unknown.length > 1 ? 's' : ''}: ${s.unknown.join(', ')}` }
    areas = s.areas
  }

  let rec: ReportSubscriptionRecord | null
  try {
    rec = await getReportSubscriptionRecord({ personId: input.personId })
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }

  if (!rec) {
    if (!input.createIfMissing) return { ok: false, error: 'This contact has no market-report subscription yet.' }
    const active = input.active === true
    const createAreas = areas ?? []
    if (active && createAreas.length === 0) return { ok: false, error: 'Pick at least one area to turn market reports on' }
    const frequency = input.frequency ?? 'monthly'
    const lastSentAt = await getLatestDeliveredReportAt(input.personId)
    const created = await createReportSubscription(
      input.personId,
      {
        areas: createAreas,
        frequency,
        isActive: active,
        lastSentAt,
        source: 'broker',
        requestedAt: null,
        consentNote: (input.consentNote ?? '').trim() || null,
      },
      {
        title: active
          ? `Market reports set to ${frequency} for ${createAreas.map(reportAreaLabel).join(', ')} by ${input.admin.email}`
          : `Market report subscription created (off) by ${input.admin.email}`,
        payload: { via: 'admin', change: 'create' },
        broker: input.admin.brokerSlug,
        source: 'app',
      },
    )
    if (!created.ok) return created
    if (created.created) {
      return { ok: true, message: active ? 'Market reports set. The first send waits for your approval.' : 'Market report subscription saved (off).' }
    }
    // A row appeared between the read and the insert (another tab, the
    // contact's own page): the insert left it alone, so plan the change
    // against it like any existing row instead of reporting a save that
    // did not happen.
    rec = created.record
  }

  // Turning reports OFF with every area unticked keeps the areas on the row
  // (a paused subscription with areas is harmless; an "on" one without any is
  // refused), so switching off never fails on the area picker.
  if (areas && areas.length === 0 && input.active !== true) areas = undefined
  // Areas first (a resume needs at least one), then the interval, then on/off.
  const changes: ReportChange[] = []
  if (areas) changes.push({ kind: 'areas', areas, labels: areas.map(reportAreaLabel) })
  if (input.frequency) changes.push({ kind: 'frequency', frequency: input.frequency })
  if (typeof input.active === 'boolean') changes.push(input.active ? { kind: 'resume' } : { kind: 'pause' })

  const plan = planReportChanges(rec, changes, {
    via: 'admin',
    adminEmail: input.admin.email,
    consentNote: input.consentNote,
  })
  if (!plan.ok) return { ok: false, error: plan.error }
  if (plan.noop) return { ok: true, message: 'Nothing to change.' }
  const res = await applyReportSubscriptionPatch(rec, plan.patch, {
    title: plan.titles.join('; '),
    payload: { via: 'admin', change: plan.applied.map((c) => c.kind).join('+') },
    broker: input.admin.brokerSlug,
    source: 'app',
  })
  if (!res.ok) return { ok: false, error: res.error }
  const after = plan.after
  return { ok: true, message: plan.applied.map((c) => adminChangeMessage(c, after)).join(' ') }
}

/** Order-insensitive area comparison. */
function sameAreaSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  const s = new Set(a)
  return b.every((x) => s.has(x))
}

/**
 * Approve the first send. Refused until a preview of the CURRENT areas and
 * interval reached a broker's inbox: approval means "send what I previewed".
 */
export async function adminApproveFirstSend(input: {
  personId: number
  admin: { email: string; brokerSlug: string | null }
}): Promise<AdminResult> {
  let rec: ReportSubscriptionRecord | null
  try {
    rec = await getReportSubscriptionRecord({ personId: input.personId })
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
  if (!rec) return { ok: false, error: 'This contact has no market-report subscription.' }
  if (!rec.firstSendApprovedAt) {
    const preview = await getLatestReportPreview(input.personId)
    if (!preview) return { ok: false, error: 'Send yourself a preview first. Approval means sending what you previewed.' }
    if (!sameAreaSet(preview.areas, rec.areas) || (preview.frequency ?? '') !== rec.frequency) {
      return { ok: false, error: 'The areas or the interval changed since your last preview. Send a new preview, then approve.' }
    }
  }
  return applyChange(rec, { kind: 'approve' }, input.admin)
}

/**
 * "Send a preview to me": the exact email the contact would get, from her
 * assigned broker, with her greeting and areas, to the acting broker's own
 * mailbox. Only an internal broker mailbox may receive it (a preview must
 * never reach a lead, and the send chokepoint's auto-tracking skips internal
 * mailboxes, so no person's tracking rides on it).
 */
export async function adminSendReportPreview(input: {
  personId: number
  admin: { email: string; brokerSlug: string | null }
  now?: Date
}): Promise<AdminResult> {
  const to = input.admin.email.trim().toLowerCase()
  if (!isInternalOutboundRecipient(to)) {
    return { ok: false, error: `Previews go to a broker mailbox, and ${to} is not one.` }
  }
  let rec: ReportSubscriptionRecord | null
  let contact: Awaited<ReturnType<typeof getMarketReportContact>>
  try {
    ;[rec, contact] = await Promise.all([
      getReportSubscriptionRecord({ personId: input.personId }),
      getMarketReportContact(input.personId),
    ])
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
  if (!contact || contact.deleted) return { ok: false, error: 'Contact not found' }
  if (!rec || rec.areas.length === 0) return { ok: false, error: 'Pick at least one area for this contact first.' }

  const now = input.now ?? new Date()
  const outcome = await deliverMarketReport({
    kind: 'preview',
    personId: input.personId,
    contactName: contact.firstName ?? contact.name,
    to,
    // Her own address: a preview is checked against her suppression too.
    contactEmail: contact.primaryEmail,
    brokerSlug: contact.assignedBroker ?? input.admin.brokerSlug ?? 'matt',
    subscription: { id: rec.id, frequency: rec.frequency, areas: rec.areas, lastSentAt: rec.lastSentAt },
    areaSlugs: rec.areas,
    emailKey: `market-report:preview:${input.personId}:${now.getTime()}`,
    now,
  })
  return previewResult(outcome, to)
}

function previewResult(outcome: DeliverReportOutcome, to: string): AdminResult {
  switch (outcome.status) {
    case 'sent':
      return { ok: true, message: `Preview sent to ${to}.` }
    case 'held':
      return {
        ok: false,
        error:
          outcome.reason === 'suppressed'
            ? 'This contact has email turned off, so there is no report to preview.'
            : outcome.reason === 'stale-data'
              ? `The market data is stale, so a report would be held. ${outcome.detail}`
              : outcome.reason === 'spark-stop' || outcome.reason === 'spark-unreconciled'
                ? `The numbers did not pass the Spark check (CLAUDE.md §0), so the preview is held for Matt. ${outcome.detail}`
                : 'No verified market data for these areas right now.',
      }
    case 'already-sent':
    case 'cancelled':
      return { ok: false, error: 'Not sent.' }
    case 'failed':
      return { ok: false, error: `Preview not sent: ${outcome.detail}` }
  }
}
