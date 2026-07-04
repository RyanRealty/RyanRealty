'use server'

import { revalidatePath } from 'next/cache'
import { getCrmAccess, requirePersonInScope } from '@/app/actions/crm'
import { scopeBroker, isPersonInScope } from '@/lib/crm/scope'
import { resolveLeadAssignedBroker, getGuestAlertLead } from '@/lib/data/crm/leadAssignedBroker'
import { checkNewsletterVoice } from '@/lib/email/voice-precheck'
import { enqueueNewsletter, enqueueNewsletterToEmails, NEWSLETTER_FROM_ADDRESS } from '@/lib/newsletter/send-queue'
import { parseEmailList } from '@/lib/newsletter/parse-emails'
import { getAudienceEligiblePeople } from '@/lib/data/crm/getAudienceEligiblePeople'
import { getCrmBrokers } from '@/lib/data/crm/getCrmBrokers'
import { wrapNewsletterHtml, type SenderBroker } from '@/lib/email-templates/newsletter-shell'
import { getActiveSubscribersForSend } from '@/lib/data/newsletter'
import { getAssignedBrokersByPersonId, getSubscribersByEmails } from '@/lib/data/newsletter/queue'
import { sendEmail } from '@/lib/resend'
import { createSavedSearchForLead, updateSavedSearch, deleteSavedSearchById } from '@/lib/data'
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
async function requireAdmin(): Promise<{ ok: true; email: string } | { ok: false }> {
  const access = await getCrmAccess()
  if (!access) return { ok: false }
  return { ok: true, email: access.email }
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
  const { found, assignedBroker } = await resolveLeadAssignedBroker(lead)
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
  const gate = await requireAdmin()
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
}): Promise<{ ok: boolean; enrolled: number; skipped: number; error?: string }> {
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false, enrolled: 0, skipped: 0, error: 'unauthorized' }

  const segment: NewsletterSegment = input.segment ?? 'general'
  const pasted = parseEmailList(input.emails ?? '')
  const tagged = input.crmTag ? await emailsForCrmTag(input.crmTag) : []
  const all = [...new Set([...pasted, ...tagged])].slice(0, 5000)
  if (all.length === 0) return { ok: false, enrolled: 0, skipped: 0, error: 'no_recipients' }

  // S-10: never resurrect an opt-out. subscribeToNewsletter reactivates any existing
  // row to active, so exclude addresses that previously unsubscribed / bounced /
  // complained. A bulk enroll cannot override a recipient's prior opt-out; those are
  // reported as skipped. New + already-active addresses enroll normally.
  const preexisting = await getSubscribersByEmails(all)
  const optedOut = new Set(preexisting.filter((s) => s.status !== 'active').map((s) => s.email))
  const eligible = all.filter((e) => !optedOut.has(e))

  let enrolled = 0
  let skipped = optedOut.size
  for (const email of eligible) {
    const r = await subscribeToNewsletter({ email, source: 'bulk-enroll', segment })
    if (r.ok) enrolled++
    else skipped++
  }
  return { ok: true, enrolled, skipped }
}

// ── ADMIN: saved-search assignment (broker-created, origin='broker') ──────────

function stableHash(filters: Record<string, unknown>): string {
  const sorted = Object.keys(filters).sort().map((k) => `${k}=${JSON.stringify(filters[k])}`).join('&')
  return `broker:${sorted}`
}

/** Assign ONE lead a broker-created saved search (origin='broker'). */
export async function adminAssignSavedSearchAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false, error: 'unauthorized' }
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  if (!email) return { ok: false, error: 'no_email' }
  const fubPersonId = Number(formData.get('fubPersonId')) || null
  if (await leadOutOfScope({ email, fubLegacyId: fubPersonId })) return { ok: false, error: 'unauthorized' }
  const name = String(formData.get('name') ?? 'Saved search').trim() || 'Saved search'
  let filters: Record<string, unknown> = {}
  try { filters = JSON.parse(String(formData.get('filters') ?? '{}')) } catch { filters = {} }
  return createSavedSearchForLead({ email, fubPersonId, name, filters, filtersHash: stableHash(filters), origin: 'broker', assignedBy: gate.email, frequency: 'weekly' })
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
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false, error: 'unauthorized' }
  const subject = String(formData.get('subject') ?? '').trim()
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
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false }
  return updateNewsletter(id, {
    subject: String(formData.get('subject') ?? '').trim(),
    preview_text: String(formData.get('preview_text') ?? '').trim() || null,
    body_html: String(formData.get('body_html') ?? '') || null,
    body_text: String(formData.get('body_text') ?? '') || null,
    audience: String(formData.get('audience') ?? 'all'),
  })
}

export async function adminDeleteNewsletterAction(id: string): Promise<{ ok: boolean }> {
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false }
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
  const gate = await requireAdmin()
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
  const gate = await requireAdmin()
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

const NL_KNOWN_BROKERS = new Set(['matt', 'rebecca', 'paul'])
/** Absolute-HTTPS headshots — email can't load app-relative assets (mirrors send-queue). */
const NL_HEADSHOTS: Record<string, string> = {
  matt: 'https://ryan-realty.com/images/brokers/ryan-matt.png',
  rebecca: 'https://ryan-realty.com/images/brokers/peterson-rebecca.png',
  paul: 'https://ryan-realty.com/images/brokers/stevenson-paul.png',
}

function nlNormalizeBroker(slug: string | null | undefined): string {
  const s = (slug ?? '').trim().toLowerCase()
  return NL_KNOWN_BROKERS.has(s) ? s : 'matt'
}

/** Brand-voice dotted phone (541.703.3095). Returns the input if it can't parse 10 digits. */
function nlFormatPhoneDotted(phone: string | null): string | null {
  if (!phone) return null
  const d = phone.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')
  return d.length === 10 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}` : phone
}

/**
 * Build the per-recipient close identity for a chosen broker slug — mirrors
 * lib/newsletter/send-queue.ts senderBrokerFor + loadBrokerMap so the admin
 * preview and test-send render through the EXACT identity the real send uses.
 * Returns null when the broker roster can't be read.
 */
async function nlSenderBrokerFor(slug: string): Promise<{ sender: SenderBroker; replyTo: string | null } | null> {
  const brokers = await getCrmBrokers()
  if (brokers.length === 0) return null
  const target = nlNormalizeBroker(slug)
  const b = brokers.find((x) => x.slug === target) ?? brokers.find((x) => x.slug === 'matt') ?? brokers[0]
  const sender: SenderBroker = {
    name: b.name || 'Ryan Realty',
    firstName: (b.name || 'Ryan').split(/\s+/)[0] || b.name,
    title: b.title,
    phone: nlFormatPhoneDotted(b.phone),
    email: b.email,
    headshotUrl: NL_HEADSHOTS[b.slug] ?? NL_HEADSHOTS.matt,
    isOwner: b.slug === 'matt',
  }
  return { sender, replyTo: b.email }
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
  const letter = await getNewsletter(id)
  if (!letter) return { ok: false, error: 'not_found' }
  if (!letter.body_html) return { ok: false, error: 'empty_body' }
  const identity = await nlSenderBrokerFor(brokerSlug)
  if (!identity) return { ok: false, error: 'no_brokers' }
  const html = wrapNewsletterHtml({
    bodyHtml: letter.body_html,
    previewText: letter.preview_text,
    unsubscribeUrl: 'https://ryan-realty.com/newsletter/unsubscribe?token=preview',
    senderBroker: identity.sender,
  })
  return { ok: true, html }
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
  const identity = await nlSenderBrokerFor(brokerSlug)
  if (!identity) return { ok: false, error: 'no_brokers' }

  const unsubscribeUrl = 'https://ryan-realty.com/newsletter/unsubscribe?token=preview'
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
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false, error: 'unauthorized' }
  const { produceNewsletterDraft } = await import('@/lib/newsletter/produce-draft')
  const result = await produceNewsletterDraft(gate.email)
  if (result.ok && result.id) revalidatePath('/admin/newsletters')
  return result
}
