'use server'

import { revalidatePath } from 'next/cache'
import { getCrmAccess, requirePersonInScope } from '@/app/actions/crm'
import { scopeBroker, isPersonInScope } from '@/lib/crm/scope'
import { resolveLeadAssignedBroker, getGuestAlertLead } from '@/lib/data/crm/leadAssignedBroker'
import { checkNewsletterVoice } from '@/lib/email/voice-precheck'
import { enqueueNewsletter, enqueueNewsletterToEmails, NEWSLETTER_FROM_ADDRESS } from '@/lib/newsletter/send-queue'
import { parseEmailList } from '@/lib/newsletter/parse-emails'
import { getAudienceEligiblePeople } from '@/lib/data/crm/getAudienceEligiblePeople'
import { wrapNewsletterHtml } from '@/lib/email-templates/newsletter-shell'
import { renderNewsletterPreview, senderIdentityFor, PREVIEW_UNSUBSCRIBE_URL } from '@/lib/newsletter/preview'
import { getActiveSubscribersForSend } from '@/lib/data/newsletter'
import { getAssignedBrokersByPersonId, getSubscribersByEmails, bulkActivateSubscribers } from '@/lib/data/newsletter/queue'
import { sendEmail } from '@/lib/resend'
import { createSavedSearchForLead, updateSavedSearch, deleteSavedSearchById } from '@/lib/data'
import { normalizeSavedSearchFilters, getSavedSearchHash, getFilterNameFallback } from '@/lib/search-filters'
import {
  subscribeToNewsletter,
  setSubscriberStatus,
  getCrmPersonContact,
  createNewsletterDraft,
  updateNewsletter,
  deleteNewsletterDraft,
  getNewsletter,
  type NewsletterSegment,
  type SubscriberStatus,
} from '@/lib/data'

const SEGMENTS: NewsletterSegment[] = ['general', 'buyer', 'seller', 'past-client']
function asSegment(v: FormDataEntryValue | null | undefined): NewsletterSegment {
  const s = String(v ?? 'general')
  return (SEGMENTS as string[]).includes(s) ? (s as NewsletterSegment) : 'general'
}

// ── PUBLIC: subscribe ────────────────────────────────────────────────────────

/** Public newsletter signup (footer / CTA form). No auth. */
export async function subscribeNewsletterAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const email = String(formData.get('email') ?? '').trim()
  const name = String(formData.get('name') ?? '').trim() || null
  const source = String(formData.get('source') ?? 'site')
  const segment = asSegment(formData.get('segment'))
  const r = await subscribeToNewsletter({ email, name, source, segment })
  return { ok: r.ok, error: r.error }
}

// ── ADMIN gate helper ────────────────────────────────────────────────────────
async function requireAdmin(): Promise<{ ok: true; email: string; role: string } | { ok: false }> {
  const access = await getCrmAccess()
  if (!access) return { ok: false }
  return { ok: true, email: access.email, role: access.role }
}

/**
 * OWNER-ONLY gate for newsletter mutations that (a) reach the whole subscriber
 * list or the company-wide CRM (bulk enroll/send, crmTag targeting), or (b) author
 * recipient-facing HTML (create/update body_html). requireAdmin() only proves the
 * caller is SOME admin — it never checks role — so a `broker` (Paul/Rebecca) or a
 * future `report_viewer` would otherwise pass. Company-wide reach + the Matt-only
 * bulk-ops rule mean these are superuser-only. Closes the cross-broker audience
 * leak (getAudienceEligiblePeople has no assigned_broker scope) at the entry point.
 */
async function requireSuperuser(): Promise<{ ok: true; email: string } | { ok: false }> {
  const access = await getCrmAccess()
  if (!access || access.role !== 'superuser') return { ok: false }
  return { ok: true, email: access.email }
}

/** Sanitize a newsletter subject: strip CR/LF + control chars (header-injection
 *  defense-in-depth) and collapse whitespace. */
function cleanSubject(v: FormDataEntryValue | null): string {
  // eslint-disable-next-line no-control-regex
  return String(v ?? '').replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Saved-search (guest_search_alerts) broker-scope guard. Returns true (DENY) only
 * when a restricted broker is acting on a lead that resolves to a DIFFERENT
 * broker. Owner/superuser, a non-CRM admin, the broker's own lead, or an
 * unresolvable/new lead all pass (false). Authorization read lives in the DAL.
 */
async function leadOutOfScope(lead: { email?: string | null; fubLegacyId?: number | null }): Promise<boolean> {
  const access = await getCrmAccess()
  const slug = access ? scopeBroker(access) : null
  if (!slug) return false
  // FAIL CLOSED: resolveLeadAssignedBroker throws on a DB error; a restricted broker
  // must be DENIED (out of scope = true) when ownership can't be verified, not waved
  // through.
  let found: boolean
  let assignedBroker: string | null
  try {
    ({ found, assignedBroker } = await resolveLeadAssignedBroker(lead))
  } catch {
    return true
  }
  if (!found) return false
  return !isPersonInScope(slug, assignedBroker)
}

// ── ADMIN: subscriber management + assignment ────────────────────────────────

/** Manually add a subscriber by email (admin). */
export async function adminAddSubscriberAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false, error: 'unauthorized' }
  const email = String(formData.get('email') ?? '').trim()
  const name = String(formData.get('name') ?? '').trim() || null
  const segment = asSegment(formData.get('segment'))
  const r = await subscribeToNewsletter({ email, name, source: 'admin', segment })
  return { ok: r.ok, error: r.error }
}

/** Assign an existing CRM person to the newsletter (resolves their email). */
export async function adminAssignCrmPersonAction(personId: number, segment?: NewsletterSegment): Promise<{ ok: boolean; error?: string }> {
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false, error: 'unauthorized' }
  const contact = await getCrmPersonContact(personId)
  if (!contact) return { ok: false, error: 'no_email' }
  const r = await subscribeToNewsletter({ email: contact.email, name: contact.name, source: 'crm-assign', segment: segment ?? 'general', crmPersonId: personId })
  return { ok: r.ok, error: r.error }
}

/** Admin set a subscriber's status (remove = unsubscribed, re-add = active). */
export async function adminSetSubscriberStatusAction(id: string, status: SubscriberStatus): Promise<{ ok: boolean }> {
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false }
  return setSubscriberStatus(id, status)
}

/** Bulk-assign many CRM people to the newsletter (resolves each email). */
export async function adminBulkAssignNewsletterAction(personIds: number[], segment?: NewsletterSegment): Promise<{ ok: boolean; assigned: number; skipped: number; error?: string }> {
  const gate = await requireSuperuser()
  if (!gate.ok) return { ok: false, assigned: 0, skipped: 0, error: 'unauthorized' }
  let assigned = 0
  let skipped = 0
  for (const pid of personIds.slice(0, 2000)) {
    const contact = await getCrmPersonContact(pid)
    if (!contact) { skipped++; continue }
    const r = await subscribeToNewsletter({ email: contact.email, name: contact.name, source: 'crm-assign', segment: segment ?? 'general', crmPersonId: pid })
    if (r.ok) assigned++; else skipped++
  }
  return { ok: true, assigned, skipped }
}

/**
 * Resolve the primary email for people carrying a given CRM tag, via the consent-
 * gated audience read (realtor-tagged + no-contact-key people are already excluded
 * there). Primary email = first email value in the JSONB emails array. Shared by
 * both bulk newsletter tools. Empty tag → [].
 */
async function emailsForCrmTag(tag: string): Promise<string[]> {
  const trimmed = tag.trim()
  if (!trimmed) return []
  const { people } = await getAudienceEligiblePeople({ tag: trimmed })
  const out: string[] = []
  for (const p of people) {
    const email = p.emails?.[0]?.trim().toLowerCase()
    if (email && email.includes('@')) out.push(email)
  }
  return [...new Set(out)]
}

/**
 * BULK ENROLL (recurring): add many emails to the newsletter as active subscribers
 * so they receive ALL future issues. Accepts a pasted email list and/or a CRM tag
 * (people carrying that tag, realtor-excluded + no-email skipped). Each becomes an
 * active subscriber via subscribeToNewsletter (upsert by lower(email) de-dupes).
 * Previously opted-out addresses (unsubscribed/bounced/complained) are NEVER
 * reactivated — they count as skipped (S-10). Capped at 5000. Returns counts.
 */
export async function adminBulkEnrollNewsletterAction(input: {
  emails?: string
  crmTag?: string
  segment?: NewsletterSegment
}): Promise<{ ok: boolean; enrolled: number; skipped: number; optedOut?: number; failed?: number; dropped?: number; error?: string }> {
  const gate = await requireSuperuser()
  if (!gate.ok) return { ok: false, enrolled: 0, skipped: 0, error: 'unauthorized' }

  const segment: NewsletterSegment = input.segment ?? 'general'
  const pasted = parseEmailList(input.emails ?? '')
  const tagged = input.crmTag ? await emailsForCrmTag(input.crmTag) : []
  const deduped = [...new Set([...pasted, ...tagged])]
  const all = deduped.slice(0, 5000)
  const dropped = deduped.length - all.length // M2: surface the silent >5,000 truncation
  if (all.length === 0) return { ok: false, enrolled: 0, skipped: 0, error: 'no_recipients' }

  try {
    // S-10: never resurrect an opt-out. subscribeToNewsletter reactivates any existing
    // row to active, so exclude addresses that previously unsubscribed / bounced /
    // complained. A bulk enroll cannot override a recipient's prior opt-out.
    // getSubscribersByEmails now THROWS on a DB error (C2 fail-closed) so a lookup
    // failure aborts here instead of enrolling everyone with an empty opt-out set.
    const preexisting = await getSubscribersByEmails(all)
    const optedOut = new Set(preexisting.filter((s) => s.status !== 'active').map((s) => s.email))
    const eligible = all.filter((e) => !optedOut.has(e))

    // P1/P2: one batch upsert, not a per-email loop (which timed out near the cap).
    const enrolled = await bulkActivateSubscribers(eligible, 'bulk-enroll', segment)
    const failed = eligible.length - enrolled // M3: NOT an opt-out — a persist gap
    // `skipped` kept for back-compat; optedOut + failed break it down.
    return { ok: true, enrolled, skipped: optedOut.size + failed, optedOut: optedOut.size, failed, dropped }
  } catch {
    return { ok: false, enrolled: 0, skipped: 0, error: 'lookup_failed' }
  }
}

// ── ADMIN: saved-search assignment (broker-created, origin='broker') ──────────

function stableHash(filters: Record<string, unknown>): string {
  const sorted = Object.keys(filters).sort().map((k) => `${k}=${JSON.stringify(filters[k])}`).join('&')
  return `broker:${sorted}`
}

/**
 * Assign ONE lead a broker-created saved search (origin='broker'). Filters are
 * normalized through the canonical model (lib/search-filters) and an EMPTY
 * filter set is refused — a saved search with no filters would email the whole
 * MLS feed. Hash comes from getSavedSearchHash so a broker-assigned search
 * dedupes against the same search saved by the lead themselves.
 */
export async function adminAssignSavedSearchAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false, error: 'unauthorized' }
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  if (!email) return { ok: false, error: 'no_email' }
  const fubPersonId = Number(formData.get('fubPersonId')) || null
  if (await leadOutOfScope({ email, fubLegacyId: fubPersonId })) return { ok: false, error: 'unauthorized' }
  let raw: Record<string, unknown> = {}
  try { raw = JSON.parse(String(formData.get('filters') ?? '{}')) } catch { raw = {} }
  const filters = normalizeSavedSearchFilters(raw)
  if (Object.keys(filters).length === 0) return { ok: false, error: 'no_filters' }
  const name = String(formData.get('name') ?? '').trim() || getFilterNameFallback(filters)
  const frequency = String(formData.get('frequency') ?? '') === 'daily' ? 'daily' as const : 'weekly' as const
  return createSavedSearchForLead({ email, fubPersonId, name, filters, filtersHash: getSavedSearchHash(filters), origin: 'broker', assignedBy: gate.email, frequency })
}

/** Edit a saved search (rename + change parameters) — used on the lead page. */
export async function adminUpdateSavedSearchAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false, error: 'unauthorized' }
  const id = String(formData.get('id') ?? '').trim()
  if (!id) return { ok: false, error: 'no_id' }
  const lead = await getGuestAlertLead(id)
  if (lead && (await leadOutOfScope(lead))) return { ok: false, error: 'unauthorized' }
  const name = String(formData.get('name') ?? 'Saved search').trim() || 'Saved search'
  let filters: Record<string, unknown> = {}
  try { filters = JSON.parse(String(formData.get('filters') ?? '{}')) } catch { filters = {} }
  return updateSavedSearch(id, { name, filters, filtersHash: stableHash(filters) })
}

/** Remove a saved search by id. */
export async function adminDeleteSavedSearchAction(id: string): Promise<{ ok: boolean }> {
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false }
  const lead = await getGuestAlertLead(id)
  if (lead && (await leadOutOfScope(lead))) return { ok: false }
  return deleteSavedSearchById(id)
}

/** Bulk-assign many CRM people the SAME broker-created saved search. */
export async function adminBulkAssignSavedSearchAction(personIds: number[], name: string, filters: Record<string, unknown>): Promise<{ ok: boolean; assigned: number; skipped: number; error?: string }> {
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false, assigned: 0, skipped: 0, error: 'unauthorized' }
  const access = await getCrmAccess()
  const hash = stableHash(filters)
  let assigned = 0
  let skipped = 0
  for (const pid of personIds.slice(0, 2000)) {
    // Restricted broker: silently skip leads outside their scope (owner short-circuits).
    if (access && !(await requirePersonInScope(pid, access)).ok) { skipped++; continue }
    const contact = await getCrmPersonContact(pid)
    if (!contact) { skipped++; continue }
    const r = await createSavedSearchForLead({ email: contact.email, fubPersonId: null, name, filters, filtersHash: hash, origin: 'broker', assignedBy: gate.email, frequency: 'weekly' })
    if (r.ok) assigned++; else skipped++
  }
  return { ok: true, assigned, skipped }
}

// ── ADMIN: newsletter drafts ─────────────────────────────────────────────────

export async function adminCreateNewsletterAction(formData: FormData): Promise<{ ok: boolean; id?: string; error?: string }> {
  const gate = await requireSuperuser()
  if (!gate.ok) return { ok: false, error: 'unauthorized' }
  const subject = cleanSubject(formData.get('subject'))
  if (!subject) return { ok: false, error: 'subject_required' }
  return createNewsletterDraft({
    subject,
    preview_text: String(formData.get('preview_text') ?? '').trim() || null,
    body_html: String(formData.get('body_html') ?? '') || null,
    body_text: String(formData.get('body_text') ?? '') || null,
    audience: String(formData.get('audience') ?? 'all'),
    created_by: gate.email,
  })
}

export async function adminUpdateNewsletterAction(id: string, formData: FormData): Promise<{ ok: boolean }> {
  const gate = await requireSuperuser()
  if (!gate.ok) return { ok: false }
  return updateNewsletter(id, {
    subject: cleanSubject(formData.get('subject')),
    preview_text: String(formData.get('preview_text') ?? '').trim() || null,
    body_html: String(formData.get('body_html') ?? '') || null,
    body_text: String(formData.get('body_text') ?? '') || null,
    audience: String(formData.get('audience') ?? 'all'),
  })
}

export async function adminDeleteNewsletterAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const gate = await requireSuperuser()
  if (!gate.ok) return { ok: false }
  // M5: only a draft is deletable. A stale tab could otherwise fire delete against a
  // newsletter that's already sending/sent and orphan its queued recipient rows.
  const letter = await getNewsletter(id)
  if (!letter) return { ok: false, error: 'not_found' }
  if (letter.status !== 'draft') return { ok: false, error: 'not_deletable' }
  return deleteNewsletterDraft(id)
}

// ── ADMIN: SEND (the compliance-gated path) ──────────────────────────────────

/**
 * Send a draft newsletter to its audience. Per recipient: skip anyone suppressed
 * for email (lib/crm/suppressions — fails closed), attach a one-click
 * List-Unsubscribe header + footer link (RFC 8058 + CAN-SPAM), send via Resend
 * from the verified mail.ryan-realty.com domain. Tallies sent/failed, stamps the
 * subscribers, and marks the newsletter sent. Returns a summary.
 */
export async function adminSendNewsletterAction(
  id: string,
): Promise<{ ok: boolean; queued?: number; brokerSplit?: Record<string, number>; large?: boolean; error?: string }> {
  const gate = await requireSuperuser()
  if (!gate.ok) return { ok: false, error: 'unauthorized' }

  const letter = await getNewsletter(id)
  if (!letter) return { ok: false, error: 'not_found' }
  if (letter.status === 'sent' || letter.status === 'sending') return { ok: false, error: 'already_sent' }
  if (!letter.body_html && !letter.body_text) return { ok: false, error: 'empty_body' }

  // Brand-voice hard-fail gate (R-1 / G-NL-4). A newsletter is public copy but the
  // CI voice gate skips app/admin/, so enforce it here before anything enqueues.
  const voice = checkNewsletterVoice({ subject: letter.subject, bodyHtml: letter.body_html, bodyText: letter.body_text })
  if (!voice.ok) return { ok: false, error: `Brand-voice check failed. Fix before sending: ${voice.violations.join('; ')}` }

  // Approve = ENQUEUE (spec §6, gate G-NL-9). The old path sent up to 5,000 emails
  // in this request — a Vercel timeout stranded status='sending' forever. Now this
  // records the approver, then enqueueNewsletter() wins a CAS lock, freezes each
  // recipient's broker + engagement tier, writes the queue + tranche schedule, and
  // returns immediately. The send cron drains it, re-checking suppression + active
  // per recipient (S-8). No synchronous per-recipient loop in the request path.
  await updateNewsletter(id, { sent_by: gate.email })
  const result = await enqueueNewsletter(id)
  if (!result.ok) return { ok: false, error: result.error }

  revalidatePath('/admin/newsletters')
  return { ok: true, queued: result.queued, brokerSplit: result.brokerSplit, large: result.large }
}

/**
 * BULK ONE-OFF SEND: deliver THIS draft issue to an explicit list (this issue
 * only — recipients are NOT enrolled in the recurring audience beyond the row the
 * one-off path creates for the unsubscribe token). Resolve the list from a pasted
 * email list ∪ a CRM tag's people, run the SAME brand-voice gate as the normal
 * send FIRST (abort on fail), record the approver, then enqueueNewsletterToEmails
 * — which creates a subscriber row per recipient and routes through the existing
 * drain (per-row suppression + active re-check, no bypass).
 */
export async function adminBulkOneOffSendAction(
  newsletterId: string,
  input: { emails?: string; crmTag?: string },
): Promise<{ ok: boolean; queued?: number; error?: string }> {
  const gate = await requireSuperuser()
  if (!gate.ok) return { ok: false, error: 'unauthorized' }

  const letter = await getNewsletter(newsletterId)
  if (!letter) return { ok: false, error: 'not_found' }
  if (letter.status === 'sent' || letter.status === 'sending') return { ok: false, error: 'already_sent' }
  if (!letter.body_html && !letter.body_text) return { ok: false, error: 'empty_body' }

  const pasted = parseEmailList(input.emails ?? '')
  const tagged = input.crmTag ? await emailsForCrmTag(input.crmTag) : []
  const emails = [...new Set([...pasted, ...tagged])]
  if (emails.length === 0) return { ok: false, error: 'no_recipients' }

  // Same voice hard-fail gate as the audience send (CI skips app/admin/).
  const voice = checkNewsletterVoice({ subject: letter.subject, bodyHtml: letter.body_html, bodyText: letter.body_text })
  if (!voice.ok) return { ok: false, error: `Brand-voice check failed. Fix before sending: ${voice.violations.join('; ')}` }

  await updateNewsletter(newsletterId, { sent_by: gate.email })
  const result = await enqueueNewsletterToEmails(newsletterId, emails)
  if (!result.ok) return { ok: false, error: result.error }

  revalidatePath('/admin/newsletters')
  return { ok: true, queued: result.queued }
}

// ── ADMIN: preview + test-send (per-broker identity swap) ────────────────────
// Rendering lives in lib/newsletter/preview.ts — the review page (server) and
// these actions (client refresh) share the exact same render path.

const NL_KNOWN_BROKERS = new Set(['matt', 'rebecca', 'paul'])

function nlNormalizeBroker(slug: string | null | undefined): string {
  const s = (slug ?? '').trim().toLowerCase()
  return NL_KNOWN_BROKERS.has(s) ? s : 'matt'
}

/**
 * Render a newsletter through the REAL send pipeline (wrapNewsletterHtml) for a
 * chosen broker and return the HTML. Powers the admin "preview as broker" iframe —
 * it proves the per-broker identity swap visually before anything is sent. Uses a
 * placeholder unsubscribe URL (the preview never sends).
 */
export async function adminPreviewNewsletterAction(
  id: string,
  brokerSlug: string,
): Promise<{ ok: boolean; html?: string; error?: string }> {
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false, error: 'unauthorized' }
  return renderNewsletterPreview(id, brokerSlug)
}

/**
 * Send ONE test copy of the rendered-as-broker newsletter to the admin's own
 * inbox (gate.email). Uses the real shell + FROM address + List-Unsubscribe
 * headers so the test matches production delivery, with replyTo set to the chosen
 * broker. Never touches the subscriber list or the send queue.
 */
export async function adminTestSendNewsletterAction(
  id: string,
  brokerSlug: string,
): Promise<{ ok: boolean; error?: string }> {
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false, error: 'unauthorized' }
  const letter = await getNewsletter(id)
  if (!letter) return { ok: false, error: 'not_found' }
  if (!letter.body_html && !letter.body_text) return { ok: false, error: 'empty_body' }
  const identity = await senderIdentityFor(brokerSlug)
  if (!identity) return { ok: false, error: 'no_brokers' }

  const unsubscribeUrl = PREVIEW_UNSUBSCRIBE_URL
  const html = letter.body_html
    ? wrapNewsletterHtml({
        bodyHtml: letter.body_html,
        previewText: letter.preview_text,
        unsubscribeUrl,
        senderBroker: identity.sender,
      })
    : undefined
  const text = letter.body_text?.trim() || undefined

  const res = await sendEmail({
    to: gate.email,
    from: `${identity.sender.name} · Ryan Realty <${NEWSLETTER_FROM_ADDRESS}>`,
    replyTo: identity.replyTo ?? undefined,
    subject: `[TEST] ${letter.subject}`,
    html,
    text,
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  })
  if (res.error) return { ok: false, error: res.error }
  return { ok: true }
}

/**
 * Resolve the audience size + per-broker split for a draft WITHOUT enqueuing —
 * powers the send-confirm dialog. Mirrors enqueueNewsletter's audience resolution
 * (getActiveSubscribersForSend + getAssignedBrokersByPersonId), so the preview
 * matches what the actual send will fan out to.
 */
export async function adminNewsletterAudiencePreviewAction(
  id: string,
): Promise<{ ok: boolean; total?: number; brokerSplit?: Record<string, number>; error?: string }> {
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false, error: 'unauthorized' }
  const letter = await getNewsletter(id)
  if (!letter) return { ok: false, error: 'not_found' }

  const segment = letter.audience?.startsWith('segment:')
    ? (letter.audience.slice('segment:'.length) as NewsletterSegment)
    : undefined
  const audience = await getActiveSubscribersForSend({ segment })
  const personIds = audience.map((s) => s.crm_person_id).filter((n): n is number => Number.isFinite(n as number))
  const brokerByPerson = await getAssignedBrokersByPersonId(personIds)

  const brokerSplit: Record<string, number> = {}
  for (const s of audience) {
    const broker = nlNormalizeBroker(s.crm_person_id ? brokerByPerson.get(s.crm_person_id) : null)
    brokerSplit[broker] = (brokerSplit[broker] ?? 0) + 1
  }
  return { ok: true, total: audience.length, brokerSplit }
}

/**
 * Generate a monthly newsletter DRAFT from LIVE data (the curation button).
 *
 * requireAdmin, then delegate to produceNewsletterDraft which pulls every figure
 * through the DAL (getMarketReportData / getRecentBlogPosts / getCommunityBySlug /
 * getEventsForMonth), assembles the section body + plain text, writes the §0
 * citation trace, and returns the new draft id. Never sends — the draft goes to
 * /admin/newsletters/<id> for Matt's review + approval (draft-first).
 */
export async function adminGenerateNewsletterDraftAction(): Promise<{ ok: boolean; id?: string; error?: string }> {
  const gate = await requireSuperuser()
  if (!gate.ok) return { ok: false, error: 'unauthorized' }
  const { produceNewsletterDraft } = await import('@/lib/newsletter/produce-draft')
  const result = await produceNewsletterDraft(gate.email)
  if (result.ok && result.id) revalidatePath('/admin/newsletters')
  return result
}
