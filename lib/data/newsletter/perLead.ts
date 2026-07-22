import 'server-only'
import { createServiceClient } from '@/lib/data/client'
import { canSubscribe, type SuppressionSignal } from '@/lib/crm/membership-consent'
import { isAudienceExcludedByTag } from '@/lib/data/crm/getAudienceEligiblePeople'
import { personIdsByEmailCi } from '@/lib/data/crm/personByEmailCi'
import { getSuppressionSignals } from '@/lib/data/crm/getSuppressionSignals'
import { fetchPagedRows } from '@/lib/supabase/paginate'

/**
 * Per-lead newsletter DAL + cohort-enrollment reads (newsletter operating layer,
 * 2026-07-22).
 *
 * Three concerns live here, all raw-table reads inside the DAL boundary (G1):
 *
 *   1. PER-LEAD ISSUE HISTORY — join newsletter_recipients (what was sent) +
 *      newsletter_recipient_events (the deduped engagement ledger) by the
 *      person's email/subscriber link, so the contact card can show which
 *      issues a lead received, opened, and clicked.
 *
 *   2. USER SELF-SERVE MEMBERSHIP helpers — the /account/notifications toggle
 *      reads the subscriber row for the signed-in user's email and needs the
 *      email-keyed suppression footprint to decide whether a re-subscribe is
 *      allowed. The DECISION itself is the pure canUserResubscribe() below,
 *      which composes the same canSubscribe() helper the CRM toggle uses.
 *
 *   3. COHORT ENROLLMENT READS + the pure enrollment plan — the admin bulk
 *      enrollment (past clients + engaged leads + westside cohort, Matt's YES
 *      2026-07-21) unions three cohort reads and filters them through
 *      computeEnrollmentPlan(), a pure function so every exclusion rule is
 *      unit-testable with fixtures. NOTHING here sends an email — enrollment
 *      only writes newsletter_subscribers rows; issues go out solely through
 *      the approve-then-drain send queue.
 */

const SUBS = 'newsletter_subscribers'
const RECIPIENTS = 'newsletter_recipients'
const EVENTS = 'newsletter_recipient_events'
const LETTERS = 'newsletters'

// ── 1. Per-lead issue history ────────────────────────────────────────────────

export type NewsletterIssueForPerson = {
  newsletterId: string
  subject: string
  sentAt: string | null
  /** newsletter_recipients.status for this person (sent/delivered/opened/clicked/bounced/...). */
  recipientStatus: string
  opened: boolean
  clicked: boolean
  openCount: number
  clickCount: number
  lastOpenedAt: string | null
  lastClickedAt: string | null
}

export type NewsletterHistoryForPerson = {
  /** Newest first, capped for the card. */
  issues: NewsletterIssueForPerson[]
  /** Totals over EVERY matched recipient row, not just the displayed slice. */
  totals: { received: number; opened: number; clicked: number }
}

const EMPTY_HISTORY: NewsletterHistoryForPerson = { issues: [], totals: { received: 0, opened: 0, clicked: 0 } }

/** Statuses that mean the issue actually reached (or should have reached) the inbox. */
const RECEIVED_STATUSES = new Set(['sent', 'delivered', 'opened', 'clicked'])

/** PostgREST .or() operands cannot carry these characters safely — skip such emails. */
function orSafe(email: string): boolean {
  return !/[,()]/.test(email)
}

/**
 * The lead's newsletter history: every issue a recipient row exists for, joined
 * to the newsletters table (subject + sent date) and the deduped engagement
 * ledger (opened / clicked). Matched by the person's emails AND by any
 * subscriber rows linked via crm_person_id, so a lead whose subscriber row
 * carries an alias address still resolves.
 */
export async function getNewsletterHistoryForPerson(args: {
  crmPersonId?: number | null
  emails?: string[]
  limit?: number
}): Promise<NewsletterHistoryForPerson> {
  const sb = createServiceClient()
  const personEmails = [...new Set((args.emails ?? []).map((e) => e.trim().toLowerCase()).filter((e) => e.includes('@')))]
  const crmPersonId = Number.isFinite(args.crmPersonId as number) && (args.crmPersonId as number) > 0 ? (args.crmPersonId as number) : null
  if (personEmails.length === 0 && crmPersonId === null) return EMPTY_HISTORY

  // Subscriber rows linked to this person (by id or by email) widen the email set.
  const ors: string[] = []
  if (crmPersonId !== null) ors.push(`crm_person_id.eq.${crmPersonId}`)
  for (const e of personEmails) if (orSafe(e)) ors.push(`email.eq.${e}`)
  const subscriberIds: string[] = []
  const allEmails = new Set(personEmails)
  if (ors.length > 0) {
    const { data } = await sb.from(SUBS).select('id, email').or(ors.join(','))
    for (const row of data ?? []) {
      const r = row as { id: string; email: string }
      subscriberIds.push(r.id)
      const e = (r.email || '').trim().toLowerCase()
      if (e) allEmails.add(e)
    }
  }
  if (allEmails.size === 0 && subscriberIds.length === 0) return EMPTY_HISTORY

  // Recipient rows, matched by email OR subscriber link, merged on row id.
  type RecipientRow = {
    id: string
    newsletter_id: string
    status: string
    open_count: number
    click_count: number
    last_opened_at: string | null
    last_clicked_at: string | null
  }
  const RECIPIENT_COLS = 'id, newsletter_id, status, open_count, click_count, last_opened_at, last_clicked_at'
  const recipientById = new Map<string, RecipientRow>()
  if (allEmails.size > 0) {
    const { data } = await sb.from(RECIPIENTS).select(RECIPIENT_COLS).in('email', [...allEmails]).limit(500)
    for (const row of data ?? []) recipientById.set((row as RecipientRow).id, row as RecipientRow)
  }
  if (subscriberIds.length > 0) {
    const { data } = await sb.from(RECIPIENTS).select(RECIPIENT_COLS).in('subscriber_id', subscriberIds).limit(500)
    for (const row of data ?? []) recipientById.set((row as RecipientRow).id, row as RecipientRow)
  }
  const recipients = [...recipientById.values()]
  if (recipients.length === 0) return EMPTY_HISTORY

  const newsletterIds = [...new Set(recipients.map((r) => r.newsletter_id))]

  // Issue metadata + the deduped ledger (opens/clicks survive webhook replays).
  // Event reads page through fetchPagedRows (stable id order) — a person's
  // ledger is small, but the PostgREST 1,000-row response cap must never
  // silently truncate an engaged multi-year history.
  type EventRow = { newsletter_id: string; event: string }
  const [lettersRes, eventsByEmail, eventsBySubscriber] = await Promise.all([
    sb.from(LETTERS).select('id, subject, sent_at, status').in('id', newsletterIds),
    allEmails.size > 0
      ? fetchPagedRows<EventRow>((from, to) =>
          sb
            .from(EVENTS)
            .select('id, newsletter_id, event')
            .in('newsletter_id', newsletterIds)
            .in('email', [...allEmails])
            .order('id', { ascending: true })
            .range(from, to),
        )
      : Promise.resolve({ rows: [] as EventRow[], error: null }),
    subscriberIds.length > 0
      ? fetchPagedRows<EventRow>((from, to) =>
          sb
            .from(EVENTS)
            .select('id, newsletter_id, event')
            .in('newsletter_id', newsletterIds)
            .in('subscriber_id', subscriberIds)
            .order('id', { ascending: true })
            .range(from, to),
        )
      : Promise.resolve({ rows: [] as EventRow[], error: null }),
  ])

  const letterById = new Map<string, { subject: string; sent_at: string | null }>()
  for (const row of lettersRes.data ?? []) {
    const r = row as { id: string; subject: string; sent_at: string | null }
    letterById.set(r.id, { subject: r.subject, sent_at: r.sent_at })
  }

  const openedIssues = new Set<string>()
  const clickedIssues = new Set<string>()
  for (const r of [...eventsByEmail.rows, ...eventsBySubscriber.rows]) {
    if (r.event === 'open') openedIssues.add(r.newsletter_id)
    if (r.event === 'click') clickedIssues.add(r.newsletter_id)
  }

  const issues: NewsletterIssueForPerson[] = recipients.map((r) => {
    const letter = letterById.get(r.newsletter_id)
    const opened = openedIssues.has(r.newsletter_id) || (r.open_count ?? 0) > 0
    const clicked = clickedIssues.has(r.newsletter_id) || (r.click_count ?? 0) > 0
    return {
      newsletterId: r.newsletter_id,
      subject: letter?.subject ?? 'Newsletter issue',
      sentAt: letter?.sent_at ?? null,
      recipientStatus: r.status,
      opened,
      clicked,
      openCount: r.open_count ?? 0,
      clickCount: r.click_count ?? 0,
      lastOpenedAt: r.last_opened_at,
      lastClickedAt: r.last_clicked_at,
    }
  })

  issues.sort((a, b) => {
    if (a.sentAt && b.sentAt) return b.sentAt.localeCompare(a.sentAt)
    if (a.sentAt) return -1
    if (b.sentAt) return 1
    return a.newsletterId.localeCompare(b.newsletterId)
  })

  const received = issues.filter((i) => RECEIVED_STATUSES.has(i.recipientStatus))
  const totals = {
    received: received.length,
    opened: issues.filter((i) => i.opened).length,
    clicked: issues.filter((i) => i.clicked).length,
  }
  const limit = Math.max(1, Math.min(50, args.limit ?? 8))
  return { issues: issues.slice(0, limit), totals }
}

// ── 2. User self-serve membership helpers ────────────────────────────────────

export type SubscriberSummary = {
  id: string
  status: string
  unsubscribeToken: string
  segment: string
}

/** The subscriber row for a signed-in user's email (case-insensitive), or null. */
export async function getSubscriberForUserEmail(email: string): Promise<SubscriberSummary | null> {
  const norm = (email ?? '').trim().toLowerCase()
  if (!norm || !norm.includes('@')) return null
  const sb = createServiceClient()
  const { data } = await sb.from(SUBS).select('id, status, unsubscribe_token, segment').ilike('email', norm).maybeSingle()
  if (!data) return null
  const r = data as { id: string; status: string; unsubscribe_token: string; segment: string }
  return { id: r.id, status: r.status, unsubscribeToken: r.unsubscribe_token, segment: r.segment }
}

/**
 * Email-keyed suppression footprint (crm_suppressions rows keyed by value, no
 * person required) — the piece the person-keyed getSuppressionSignals cannot
 * see. FAIL CLOSED: an unreadable compliance table returns a synthetic 'all'
 * blocker so any decision built on it refuses.
 */
export async function getEmailKeyedSuppressionSignals(email: string): Promise<SuppressionSignal[]> {
  const norm = (email ?? '').trim().toLowerCase()
  if (!norm) return [{ channel: 'all', reason: 'no-email' }]
  const sb = createServiceClient()
  const { data, error } = await sb.from('crm_suppressions').select('channel, reason').eq('value', norm)
  if (error) return [{ channel: 'all', reason: 'suppression-check-failed' }]
  return (data ?? []).map((r) => ({
    channel: (r as { channel: string }).channel as SuppressionSignal['channel'],
    reason: String((r as { reason: string }).reason ?? ''),
  }))
}

/**
 * Delete ONLY the soft, self-clearable email 'unsubscribe' suppressions keyed by
 * this email value. Scoped by channel + reason so it can never clear a bounce,
 * complaint, do-not-email, or compliance hard-stop row. Person-keyed removal
 * routes through lib/crm/suppressions.removeSuppression at the call site.
 */
export async function removeSoftEmailUnsubscribeByEmailValue(email: string): Promise<void> {
  const norm = (email ?? '').trim().toLowerCase()
  if (!norm) return
  const sb = createServiceClient()
  await sb.from('crm_suppressions').delete().eq('value', norm).eq('channel', 'email').eq('reason', 'unsubscribe')
}

/**
 * The full suppression footprint for an address: person-keyed rows + tags
 * across every sibling crm_person carrying it (via getSuppressionSignals),
 * plus the email-keyed value rows. FAIL CLOSED: any resolver error surfaces as
 * a synthetic 'all' blocker so a decision built on it refuses.
 */
export async function collectEmailChannelSignals(email: string): Promise<SuppressionSignal[]> {
  const norm = (email ?? '').trim().toLowerCase()
  if (!norm) return [{ channel: 'all', reason: 'no-email' }]
  const signals: SuppressionSignal[] = []
  try {
    // personIdsByEmailCi THROWS on a read error (unlike getPersonIdsByEmail,
    // which swallows) — a failed person resolve must block, not look clean.
    const sb = createServiceClient()
    const personIds = await personIdsByEmailCi(sb, norm)
    for (const pid of personIds) signals.push(...(await getSuppressionSignals(pid)))
  } catch {
    return [{ channel: 'all', reason: 'suppression-check-failed' }]
  }
  signals.push(...(await getEmailKeyedSuppressionSignals(norm)))
  return signals
}

export type UserNewsletterMembership = {
  subscribed: boolean
  status: string | null
  /** False when a compliance hard-stop makes the ON position unavailable. */
  canSubscribe: boolean
  blockedReason?: string
}

/**
 * Newsletter membership for a signed-in user's email — the read behind the
 * /account/notifications toggle. Combines the subscriber row with the
 * fail-closed suppression footprint so the UI can disable the ON position
 * (with a reason) instead of failing on tap.
 */
export async function getNewsletterMembershipForUserEmail(email: string): Promise<UserNewsletterMembership> {
  const norm = (email ?? '').trim().toLowerCase()
  if (!norm) return { subscribed: false, status: null, canSubscribe: false, blockedReason: 'no email' }
  const sub = await getSubscriberForUserEmail(norm)
  if (sub?.status === 'active') return { subscribed: true, status: sub.status, canSubscribe: true }
  const signals = await collectEmailChannelSignals(norm)
  const decision = canUserResubscribe(signals, sub?.status ?? null)
  return {
    subscribed: false,
    status: sub?.status ?? null,
    canSubscribe: decision.allowed,
    blockedReason: decision.allowed ? undefined : decision.reason,
  }
}

/**
 * PURE: may the SIGNED-IN OWNER of an address flip their own newsletter toggle
 * back on? Composes the same canSubscribe('email') hard-stop semantics the CRM
 * toggle uses (app/actions/crm-membership.ts), with exactly ONE owner
 * exception: a plain 'unsubscribe' suppression on the email channel — the row
 * our own unsubscribe paths write — is the owner's own prior opt-out, and the
 * owner re-opting-in may clear it. EVERYTHING else stays a blocker exactly as
 * canSubscribe classifies it: hard bounce, spam complaint, do_not_email, any
 * 'all'-channel compliance hard-stop, and every tag-derived pseudo-reason
 * (tag:do_not_email, tag:unsubscribed, ...) — those are records we or a mailbox
 * provider wrote, never self-clearable. A terminal subscriber status (bounced /
 * complained) is an independent deliverability hard-stop.
 */
export function canUserResubscribe(
  signals: SuppressionSignal[],
  subscriberStatus: string | null,
): { allowed: boolean; reason?: string } {
  const status = (subscriberStatus ?? '').trim().toLowerCase()
  if (status === 'bounced') return { allowed: false, reason: 'this address previously hard bounced' }
  if (status === 'complained') return { allowed: false, reason: 'this address filed a spam complaint' }
  const rows = Array.isArray(signals) ? signals : []
  // The single owner-clearable signal: channel 'email', reason exactly 'unsubscribe'.
  const remaining = rows.filter(
    (s) => !(s.channel === 'email' && String(s.reason ?? '').trim().toLowerCase() === 'unsubscribe'),
  )
  return canSubscribe('email', remaining)
}

// ── 3. Cohort enrollment reads ───────────────────────────────────────────────

/**
 * Emails with a real engagement signal (an 'open' or 'click' email_events row)
 * inside the lookback window. Deduped by email; keeps the first non-null
 * person_id seen. THROWS on a read error — a partial engaged set must abort the
 * enrollment build, never silently shrink it.
 */
export async function getEngagedLeadEmailsSince(days = 180): Promise<Array<{ email: string; personId: number | null }>> {
  const sb = createServiceClient()
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const byEmail = new Map<string, number | null>()
  const PAGE = 1000
  let offset = 0
  for (;;) {
    const { data, error } = await sb
      .from('email_events')
      .select('recipient_email, person_id')
      .in('event', ['open', 'click'])
      .gte('occurred_at', cutoff)
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1)
    if (error) throw new Error(`getEngagedLeadEmailsSince: ${error.message}`)
    for (const row of data ?? []) {
      const r = row as { recipient_email: string | null; person_id: number | null }
      const email = (r.recipient_email ?? '').trim().toLowerCase()
      if (!email || !email.includes('@')) continue
      const existing = byEmail.get(email)
      if (existing === undefined || existing === null) byEmail.set(email, r.person_id ?? existing ?? null)
    }
    if ((data ?? []).length < PAGE) break
    offset += PAGE
  }
  return [...byEmail.entries()].map(([email, personId]) => ({ email, personId }))
}

/** Distinct crm_people ids linked to a westside parcel. THROWS on a read error. */
export async function getWestsideLinkedPersonIds(): Promise<number[]> {
  const sb = createServiceClient()
  const ids = new Set<number>()
  const PAGE = 1000
  let offset = 0
  for (;;) {
    const { data, error } = await sb
      .from('westside_parcels')
      .select('person_id')
      .not('person_id', 'is', null)
      .order('apn', { ascending: true })
      .range(offset, offset + PAGE - 1)
    if (error) throw new Error(`getWestsideLinkedPersonIds: ${error.message}`)
    for (const row of data ?? []) {
      const id = Number((row as { person_id: number | null }).person_id)
      if (Number.isFinite(id) && id > 0) ids.add(id)
    }
    if ((data ?? []).length < PAGE) break
    offset += PAGE
  }
  return [...ids]
}

/**
 * Resolve primary email + name + tags for a set of person ids (chunked). Skips
 * soft-deleted people. THROWS on a read error (fail closed — a partial read
 * would hide the realtor tags that gate targeting).
 */
export async function getPeopleForEnrollment(
  personIds: number[],
): Promise<Array<{ personId: number; email: string | null; name: string | null; tags: string[] }>> {
  const ids = [...new Set(personIds.filter((n) => Number.isFinite(n) && n > 0))]
  if (ids.length === 0) return []
  const sb = createServiceClient()
  const out: Array<{ personId: number; email: string | null; name: string | null; tags: string[] }> = []
  const CHUNK = 500
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error } = await sb
      .from('crm_people')
      .select('id, name, emails, tags, deleted')
      .in('id', ids.slice(i, i + CHUNK))
    if (error) throw new Error(`getPeopleForEnrollment: ${error.message}`)
    for (const row of data ?? []) {
      const r = row as { id: number; name: string | null; emails: unknown; tags: unknown; deleted: boolean | null }
      if (r.deleted) continue
      const emails = (Array.isArray(r.emails) ? r.emails : []) as Array<{ value?: string; isPrimary?: number | boolean }>
      const email = emails.find((e) => e.isPrimary)?.value ?? emails[0]?.value ?? null
      const tags = (Array.isArray(r.tags) ? r.tags : []).filter((t): t is string => typeof t === 'string')
      out.push({ personId: r.id, email: email ? email.trim().toLowerCase() : null, name: r.name ?? null, tags })
    }
  }
  return out
}

// ── 3b. Pure enrollment plan (unit-tested) ───────────────────────────────────

export type EnrollmentCandidate = {
  email: string | null
  personId: number | null
  name: string | null
  tags: string[]
  /** Which cohorts matched: 'past-client' | 'engaged' | 'westside'. */
  cohorts: string[]
}

/**
 * PURE: lowercase + dedupe candidates by email. Entries with no usable email
 * are counted (the has-email filter) and dropped. Duplicate emails merge their
 * cohort labels and tags, keeping the first personId/name seen.
 */
export function dedupeCandidatesByEmail(candidates: EnrollmentCandidate[]): {
  deduped: EnrollmentCandidate[]
  noEmail: number
} {
  const byEmail = new Map<string, EnrollmentCandidate>()
  let noEmail = 0
  for (const c of candidates) {
    const email = (c.email ?? '').trim().toLowerCase()
    if (!email || !email.includes('@')) {
      noEmail += 1
      continue
    }
    const existing = byEmail.get(email)
    if (!existing) {
      byEmail.set(email, {
        email,
        personId: c.personId ?? null,
        name: c.name ?? null,
        tags: [...new Set(c.tags ?? [])],
        cohorts: [...new Set(c.cohorts ?? [])],
      })
      continue
    }
    existing.personId = existing.personId ?? c.personId ?? null
    existing.name = existing.name ?? c.name ?? null
    existing.tags = [...new Set([...existing.tags, ...(c.tags ?? [])])]
    existing.cohorts = [...new Set([...existing.cohorts, ...(c.cohorts ?? [])])]
  }
  return { deduped: [...byEmail.values()], noEmail }
}

export type EnrollmentPlanCounts = {
  /** Raw candidates before any filter (deduped + noEmail). */
  candidates: number
  noEmail: number
  realtorExcluded: number
  suppressed: number
  alreadySubscribed: number
  /** Prior unsubscribed / bounced / complained — NEVER resurrected (S-10). */
  optedOut: number
  eligible: number
}

export type EnrollmentPlan = {
  eligible: EnrollmentCandidate[]
  counts: EnrollmentPlanCounts
}

/**
 * PURE: apply the four consent/targeting filters, in order, to the deduped
 * candidate list:
 *
 *   1. realtor exclusion — same tag patterns as the Meta audience read
 *      (isAudienceExcludedByTag): competitors never enter a marketing list.
 *   2. suppression — any email in `suppressedEmails` (built with
 *      isSuppressedByEmail, which FAILS CLOSED) is out, whatever the reason.
 *   3. already subscribed — an active subscriber row is a no-op, skipped.
 *   4. prior opt-out — an existing row in ANY non-active status (unsubscribed /
 *      bounced / complained) is never resurrected by a bulk enroll (S-10).
 *
 * Everything else is eligible. The caller passes `noEmail` from
 * dedupeCandidatesByEmail so the counts add up to the raw candidate total.
 */
export function computeEnrollmentPlan(
  deduped: EnrollmentCandidate[],
  args: {
    noEmail: number
    suppressedEmails: ReadonlySet<string>
    existingSubscriberStatusByEmail: ReadonlyMap<string, string>
  },
): EnrollmentPlan {
  const counts: EnrollmentPlanCounts = {
    candidates: deduped.length + args.noEmail,
    noEmail: args.noEmail,
    realtorExcluded: 0,
    suppressed: 0,
    alreadySubscribed: 0,
    optedOut: 0,
    eligible: 0,
  }
  const eligible: EnrollmentCandidate[] = []
  for (const c of deduped) {
    const email = (c.email ?? '').trim().toLowerCase()
    if (!email) {
      // Defensive: dedupeCandidatesByEmail already dropped these. The entry is
      // already inside counts.candidates (it sits in `deduped`), so only the
      // bucket moves — never the total.
      counts.noEmail += 1
      continue
    }
    if (isAudienceExcludedByTag(c.tags)) {
      counts.realtorExcluded += 1
      continue
    }
    if (args.suppressedEmails.has(email)) {
      counts.suppressed += 1
      continue
    }
    const status = args.existingSubscriberStatusByEmail.get(email)
    if (status !== undefined) {
      if (status === 'active') counts.alreadySubscribed += 1
      else counts.optedOut += 1
      continue
    }
    eligible.push(c)
  }
  counts.eligible = eligible.length
  return { eligible, counts }
}
