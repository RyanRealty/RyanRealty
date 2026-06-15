'use server'

import { getCrmAccess } from '@/app/actions/crm'
import { isSuppressed } from '@/lib/crm/suppressions'
import { sendEmail } from '@/lib/resend'
import { wrapNewsletterHtml, newsletterTextFooter } from '@/lib/email-templates/newsletter-shell'
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

  const segment = letter.audience.startsWith('segment:') ? (letter.audience.slice('segment:'.length) as NewsletterSegment) : undefined
  const recipients = await getActiveSubscribersForSend({ segment })
  if (recipients.length === 0) return { ok: false, error: 'no_recipients' }

  // Record who sent it (per-broker attribution) + lock the send.
  await updateNewsletter(id, { status: 'sending', recipient_count: recipients.length })
  await updateNewsletter(id, { sent_by: gate.email })

  let sent = 0
  let skipped = 0
  let failed = 0
  const sentIds: string[] = []

  for (const r of recipients) {
    // Honor the suppression chokepoint for linked CRM people (fails closed).
    if (r.crm_person_id) {
      const sup = await isSuppressed(r.crm_person_id, 'email')
      if (sup.suppressed) { skipped++; continue }
    }
    const u = unsubUrl(r.unsubscribe_token)
    const html = letter.body_html ? wrapNewsletterHtml({ bodyHtml: letter.body_html, previewText: letter.preview_text, unsubscribeUrl: u }) : undefined
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

  return { ok: true, sent, skipped, failed }
}
