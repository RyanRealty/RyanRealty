'use server'

import { revalidatePath } from 'next/cache'
import { getCrmAccess, requirePersonInScope } from '@/app/actions/crm'
import { scopeBroker, isPersonInScope } from '@/lib/crm/scope'
import { resolveLeadAssignedBroker, getGuestAlertLead } from '@/lib/data/crm/leadAssignedBroker'
import { isSuppressed, isSuppressedByEmail } from '@/lib/crm/suppressions'
import { sendEmail } from '@/lib/resend'
import { attributeOutbound } from '@/lib/crm/attributed-links'
import { CRM_BROKER_BY_EMAIL } from '@/lib/crm/constants'
import { wrapNewsletterHtml, newsletterTextFooter } from '@/lib/email-templates/newsletter-shell'
import { checkNewsletterVoice } from '@/lib/email/voice-precheck'
import { createSavedSearchForLead, updateSavedSearch, deleteSavedSearchById } from '@/lib/data'
import {
  subscribeToNewsletter,
  setSubscriberStatus,
  getCrmPersonContact,
  getActiveSubscribersForSend,
  markSubscribersSent,
  createNewsletterDraft,
  updateNewsletter,
  deleteNewsletterDraft,
  getNewsletter,
  recordRecipientSend,
  type NewsletterSegment,
  type SubscriberStatus,
} from '@/lib/data'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const NEWSLETTER_FROM = 'Ryan Realty <newsletter@mail.ryan-realty.com>'

function unsubUrl(token: string): string {
  return `${SITE_URL}/newsletter/unsubscribe?token=${encodeURIComponent(token)}`
}
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
export async function adminSendNewsletterAction(id: string): Promise<{ ok: boolean; sent?: number; skipped?: number; failed?: number; error?: string }> {
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false, error: 'unauthorized' }

  const letter = await getNewsletter(id)
  if (!letter) return { ok: false, error: 'not_found' }
  if (letter.status === 'sent' || letter.status === 'sending') return { ok: false, error: 'already_sent' }
  if (!letter.body_html && !letter.body_text) return { ok: false, error: 'empty_body' }

  // Brand-voice hard-fail gate. A newsletter is public copy but the CI voice gate
  // skips app/admin/, so check here before a single send goes out.
  const voice = checkNewsletterVoice({ subject: letter.subject, bodyHtml: letter.body_html, bodyText: letter.body_text })
  if (!voice.ok) return { ok: false, error: `Brand-voice check failed. Fix before sending: ${voice.violations.join('; ')}` }

  const segment = letter.audience.startsWith('segment:') ? (letter.audience.slice('segment:'.length) as NewsletterSegment) : undefined
  const recipients = await getActiveSubscribersForSend({ segment })
  if (recipients.length === 0) return { ok: false, error: 'no_recipients' }

  // Record who sent it (per-broker attribution) + lock the send.
  await updateNewsletter(id, { status: 'sending', recipient_count: recipients.length })
  await updateNewsletter(id, { sent_by: gate.email })

  // Broker attribution: every link in the newsletter carries ?agent=<sender>
  // so the broker sees opens/clicks routed to them (CRM cutover 2026-06-24).
  const brokerSlug = CRM_BROKER_BY_EMAIL[gate.email.trim().toLowerCase()] ?? 'matt'

  let sent = 0
  let skipped = 0
  let failed = 0
  const sentIds: string[] = []

  for (const r of recipients) {
    // Honor the suppression chokepoint (fails closed). Use the person id when
    // the subscriber is linked to a CRM person, else resolve by email so an
    // unlinked subscriber row is still checked against the consent record.
    if (r.crm_person_id) {
      const sup = await isSuppressed(r.crm_person_id, 'email')
      if (sup.suppressed) { skipped++; continue }
    } else {
      const sup = await isSuppressedByEmail(r.email, 'email')
      if (sup.suppressed) { skipped++; continue }
    }
    const u = unsubUrl(r.unsubscribe_token)
    const rawHtml = letter.body_html ? wrapNewsletterHtml({ bodyHtml: letter.body_html, previewText: letter.preview_text, unsubscribeUrl: u }) : undefined
    const html = rawHtml
      ? attributeOutbound(rawHtml, { brokerSlug, personId: r.crm_person_id ?? null, emailKey: `newsletter:${id}`, label: letter.subject })
      : undefined
    const text = (letter.body_text ?? '') + newsletterTextFooter(u)
    const res = await sendEmail({
      to: r.email,
      from: NEWSLETTER_FROM,
      subject: letter.subject,
      html,
      text,
      headers: { 'List-Unsubscribe': `<${u}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    })
    // One tracking row per recipient; the Resend message id ties webhook
    // opens/clicks back to this person.
    await recordRecipientSend({ newsletterId: id, subscriberId: r.id, email: r.email, resendMessageId: res.id ?? null, failed: Boolean(res.error) })
    if (res.error) { failed++ } else { sent++; sentIds.push(r.id) }
  }

  const iso = new Date().toISOString()
  await markSubscribersSent(sentIds, iso)
  await updateNewsletter(id, { status: failed > 0 && sent === 0 ? 'failed' : 'sent', sent_count: sent, failed_count: failed, sent_at: iso })

  // Reflect the sent/failed status in the admin newsletters list without a manual reload (O13).
  revalidatePath('/admin/newsletters')

  return { ok: true, sent, skipped, failed }
}
