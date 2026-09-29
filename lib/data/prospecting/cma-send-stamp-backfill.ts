/**
 * Reconcile the owners a CMA send emailed but never stamped.
 *
 * Until lib/cma/prospect-send-claim.ts, `sendCmaToLead` (Send now on the review
 * page, the compose dialog, the contact card) delivered a CMA and stamped the
 * CMA row, the CRM timeline and `email_events`, but never the owner's row in
 * `expired_listings` / `fsbo_listings`. Those rows still read "never emailed".
 * This module finds them and writes what really happened, from what the CMA row
 * already recorded, so the prospecting screen and the at-most-once claim tell
 * the truth about who has been written to.
 *
 * The rules, all from the delivered `cmas` row (nothing is invented):
 *   - a CMA counts when `delivered_at` is set and the recipient (`client_email`)
 *     is not on our own domain. An internal recipient was a test send.
 *   - its prospect row is whatever `resolveProspectForCmaSend` returns: the
 *     build's `cma_id` link, then the MLS `subject_listing_key` for an orphan.
 *   - a prospect row that already has `outreach_email_sent_at` is left alone.
 *   - `outreach_email_sent_at` becomes the CMA's `delivered_at`. The time the
 *     email went, not the time this runs.
 *   - `outreach_email_status` becomes 'sent'.
 *   - `outreach_email_message_id` becomes the provider id on the `email_events`
 *     'sent' row keyed `cma:<slug>` (the row nearest `delivered_at` that has one),
 *     only when the prospect row has none and such a row exists.
 *   - `outreach_crm_person_id` becomes `cmas.person_id`, only when the prospect
 *     row has none.
 *   - two delivered CMAs on one prospect row stamp it once, from the earlier
 *     delivery: the first contact is the one the row records.
 *   - the write is guarded by `outreach_email_sent_at IS NULL`, so a live
 *     finalize that lands mid-run wins and this write becomes a no-op.
 *
 * The plan is read-only. `applyCmaSendProspectStamp` is the only write, and only
 * scripts/_backfill-cma-send-now-prospect-stamps.ts with --apply calls it.
 */
import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import { isInternalRecipientEmail } from '@/lib/email/internal-recipient'
import { resolveProspectForCmaSend, type CmaSendProspect } from './cma-send-prospect'
import type { ProspectKind } from './types'

export type DeliveredCma = {
  id: string
  slug: string
  status: string | null
  clientEmail: string | null
  /** cmas.delivered_at, as the database returned it. */
  deliveredAt: string
  personId: number | null
}

export type ProspectEmailState = {
  emailSentAt: string | null
  emailStatus: string | null
  messageId: string | null
  crmPersonId: number | null
  /** The owner's email on the prospect row. Shown in the plan so a reviewer can compare it to the recipient. */
  contactEmail: string | null
}

export type CmaSentEvent = {
  messageId: string | null
  recipientEmail: string
  occurredAt: string
}

export type StampPatch = {
  outreach_email_sent_at: string
  outreach_email_status: 'sent'
  outreach_email_message_id?: string
  outreach_crm_person_id?: number
}

export type PlannedStamp = {
  cma: DeliveredCma
  prospect: CmaSendProspect
  before: ProspectEmailState
  /**
   * Whether the recipient is the address on the owner's prospect row. Information
   * only, it never changes the plan: null when the prospect row has no email.
   */
  recipientMatchesProspect: boolean | null
  /** The email_events row the message id came from. Null when there is none to use. */
  sentEvent: CmaSentEvent | null
  /** How many 'sent' rows exist for cma:<slug>. More than one means the CMA was sent more than once. */
  sentEventCount: number
  patch: StampPatch
}

export type SkipReason =
  | 'no-recipient'
  | 'internal-recipient'
  | 'no-prospect-row'
  | 'prospect-row-missing'
  | 'already-stamped'
  | 'superseded-by-earlier-delivery'

export type SkippedCma = {
  slug: string
  deliveredAt: string
  recipient: string | null
  reason: SkipReason
  detail: string | null
}

export type StampPlan = {
  /** Delivered CMA rows read. */
  delivered: number
  stamps: PlannedStamp[]
  skipped: SkippedCma[]
}

/** The key the plan, the states and the guard all use for one prospect row. */
export function prospectRowKey(p: { kind: ProspectKind; id: string }): string {
  return `${p.kind}:${p.id}`
}

/** The 'sent' event nearest the CMA's delivered_at that carries a provider id. */
function nearestSentEventWithId(events: CmaSentEvent[], deliveredAt: string): CmaSentEvent | null {
  const target = Date.parse(deliveredAt)
  let best: CmaSentEvent | null = null
  let bestGap = Number.POSITIVE_INFINITY
  for (const ev of events) {
    if (!ev.messageId) continue
    const gap = Math.abs(Date.parse(ev.occurredAt) - target)
    const g = Number.isFinite(gap) ? gap : Number.POSITIVE_INFINITY
    if (best === null || g < bestGap || (g === bestGap && ev.occurredAt > best.occurredAt)) {
      best = ev
      bestGap = g
    }
  }
  return best
}

/**
 * Pure planner: which prospect rows get stamped, from which delivered CMA, with
 * what. Everything it needs is passed in, so the rules are testable without a
 * database.
 */
export function buildStampPlan(input: {
  delivered: DeliveredCma[]
  /** Resolved prospect row per CMA slug; a missing key or null means none. */
  prospects: Map<string, CmaSendProspect | null>
  /** Current outreach email state per `prospectRowKey`. */
  states: Map<string, ProspectEmailState | null>
  /** 'sent' email_events rows per CMA slug. */
  sentEvents: Map<string, CmaSentEvent[]>
}): { stamps: PlannedStamp[]; skipped: SkippedCma[] } {
  const stamps: PlannedStamp[] = []
  const skipped: SkippedCma[] = []
  const plannedFrom = new Map<string, string>()

  const ordered = [...input.delivered].sort(
    (a, b) => Date.parse(a.deliveredAt) - Date.parse(b.deliveredAt) || a.slug.localeCompare(b.slug),
  )

  for (const cma of ordered) {
    const skip = (reason: SkipReason, detail: string | null = null) =>
      skipped.push({ slug: cma.slug, deliveredAt: cma.deliveredAt, recipient: cma.clientEmail, reason, detail })

    const email = (cma.clientEmail ?? '').trim().toLowerCase()
    if (!email) {
      skip('no-recipient')
      continue
    }
    if (isInternalRecipientEmail(email)) {
      skip('internal-recipient')
      continue
    }
    const prospect = input.prospects.get(cma.slug) ?? null
    if (!prospect) {
      skip('no-prospect-row')
      continue
    }
    const key = prospectRowKey(prospect)
    const before = input.states.get(key) ?? null
    if (!before) {
      skip('prospect-row-missing', key)
      continue
    }
    if (before.emailSentAt) {
      skip('already-stamped', `outreach_email_sent_at ${before.emailSentAt}`)
      continue
    }
    const earlier = plannedFrom.get(key)
    if (earlier) {
      skip('superseded-by-earlier-delivery', `${key} is stamped from ${earlier}`)
      continue
    }
    plannedFrom.set(key, cma.slug)

    const events = input.sentEvents.get(cma.slug) ?? []
    const sentEvent = nearestSentEventWithId(events, cma.deliveredAt)
    const patch: StampPatch = {
      outreach_email_sent_at: cma.deliveredAt,
      outreach_email_status: 'sent',
    }
    if (sentEvent?.messageId && !before.messageId) patch.outreach_email_message_id = sentEvent.messageId
    if (cma.personId != null && before.crmPersonId == null) patch.outreach_crm_person_id = cma.personId

    const ownerEmail = (before.contactEmail ?? '').trim().toLowerCase()
    stamps.push({
      cma,
      prospect,
      before,
      recipientMatchesProspect: ownerEmail ? ownerEmail === email : null,
      sentEvent,
      sentEventCount: events.length,
      patch,
    })
  }

  return { stamps, skipped }
}

// ── reads ───────────────────────────────────────────────────────────────────

async function readDeliveredCmas(): Promise<DeliveredCma[]> {
  const sb = createServiceClient()
  const PAGE = 500
  const out: DeliveredCma[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('cmas')
      .select('id, slug, status, client_email, delivered_at, person_id')
      .not('delivered_at', 'is', null)
      .order('delivered_at', { ascending: true })
      .order('slug', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`cmas delivered read failed: ${error.message}`)
    for (const r of data ?? []) {
      out.push({
        id: String(r.id),
        slug: String(r.slug),
        status: (r.status as string | null) ?? null,
        clientEmail: (r.client_email as string | null) ?? null,
        deliveredAt: String(r.delivered_at),
        personId: r.person_id == null ? null : Number(r.person_id),
      })
    }
    if (!data || data.length < PAGE) break
  }
  return out
}

async function readProspectEmailState(kind: ProspectKind, id: string): Promise<ProspectEmailState | null> {
  const sb = createServiceClient()
  const table = kind === 'expired' ? 'expired_listings' : 'fsbo_listings'
  const keyCol = kind === 'expired' ? 'listing_key' : 'fsbo_url'
  const { data, error } = await sb
    .from(table)
    .select('outreach_email_sent_at, outreach_email_status, outreach_email_message_id, outreach_crm_person_id, contact_email')
    .eq(keyCol, id)
    .maybeSingle()
  if (error) throw new Error(`${table} outreach state read failed: ${error.message}`)
  if (!data) return null
  return {
    emailSentAt: (data.outreach_email_sent_at as string | null) ?? null,
    emailStatus: (data.outreach_email_status as string | null) ?? null,
    messageId: (data.outreach_email_message_id as string | null) ?? null,
    crmPersonId: data.outreach_crm_person_id == null ? null : Number(data.outreach_crm_person_id),
    contactEmail: (data.contact_email as string | null) ?? null,
  }
}

async function readCmaSentEvents(slugs: string[]): Promise<Map<string, CmaSentEvent[]>> {
  const sb = createServiceClient()
  const out = new Map<string, CmaSentEvent[]>()
  const CHUNK = 50
  for (let i = 0; i < slugs.length; i += CHUNK) {
    const chunk = slugs.slice(i, i + CHUNK)
    const { data, error } = await sb
      .from('email_events')
      .select('email_key, message_id, recipient_email, occurred_at')
      .eq('event', 'sent')
      .in(
        'email_key',
        chunk.map((s) => `cma:${s}`),
      )
      .order('occurred_at', { ascending: true })
    if (error) throw new Error(`email_events sent read failed: ${error.message}`)
    for (const r of data ?? []) {
      const slug = String(r.email_key ?? '').slice('cma:'.length)
      const list = out.get(slug) ?? []
      list.push({
        messageId: (r.message_id as string | null) ?? null,
        recipientEmail: String(r.recipient_email ?? ''),
        occurredAt: String(r.occurred_at),
      })
      out.set(slug, list)
    }
  }
  return out
}

/** Read everything the plan needs from the live tables and build it. Writes nothing. */
export async function planCmaSendProspectStampBackfill(): Promise<StampPlan> {
  const delivered = await readDeliveredCmas()

  // Resolve a prospect row only for a CMA that could be stamped: an external
  // recipient. Internal and empty recipients never reach the resolver.
  const prospects = new Map<string, CmaSendProspect | null>()
  for (const cma of delivered) {
    const email = (cma.clientEmail ?? '').trim()
    if (!email || isInternalRecipientEmail(email)) continue
    prospects.set(cma.slug, await resolveProspectForCmaSend(cma.slug))
  }

  const states = new Map<string, ProspectEmailState | null>()
  for (const prospect of prospects.values()) {
    if (!prospect) continue
    const key = prospectRowKey(prospect)
    if (!states.has(key)) states.set(key, await readProspectEmailState(prospect.kind, prospect.id))
  }

  const slugsNeedingEvents = delivered
    .filter((cma) => {
      const prospect = prospects.get(cma.slug)
      return prospect ? states.get(prospectRowKey(prospect))?.emailSentAt == null : false
    })
    .map((cma) => cma.slug)
  const sentEvents = await readCmaSentEvents(slugsNeedingEvents)

  return { delivered: delivered.length, ...buildStampPlan({ delivered, prospects, states, sentEvents }) }
}

// ── the one write ───────────────────────────────────────────────────────────

/**
 * Write one planned stamp. Guarded by `outreach_email_sent_at IS NULL`, so a row
 * that got a real send stamp between the plan and this write is left exactly as
 * that send left it. `updated: false` means the guard matched nothing.
 */
export async function applyCmaSendProspectStamp(
  stamp: Pick<PlannedStamp, 'prospect' | 'patch'>,
): Promise<{ ok: true; updated: boolean } | { ok: false; error: string }> {
  const sb = createServiceClient()
  const table = stamp.prospect.kind === 'expired' ? 'expired_listings' : 'fsbo_listings'
  const keyCol = stamp.prospect.kind === 'expired' ? 'listing_key' : 'fsbo_url'
  const { data, error } = await sb
    .from(table)
    .update(stamp.patch)
    .eq(keyCol, stamp.prospect.id)
    .is('outreach_email_sent_at', null)
    .select(keyCol)
  if (error) return { ok: false, error: error.message }
  return { ok: true, updated: (data?.length ?? 0) > 0 }
}
