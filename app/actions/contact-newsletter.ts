'use server'

/**
 * sendNewsletterToContactAction — one-click "Send newsletter" to a single CRM
 * contact (Stream 3).
 *
 * This is the non-owner branch of the record card's next step. It fires the
 * current newsletter to exactly ONE contact, auto-send with no review (Matt's
 * rule: the broker already chose this contact, the send is the action).
 *
 * It reuses the SAME send path as the bulk newsletter (adminSendNewsletterAction
 * in app/actions/newsletter.ts) without editing that file:
 *   - resolve the latest non-draft-eligible newsletter (the "current" one)
 *   - resolve the contact's email + ensure they are a subscriber so we have an
 *     unsubscribe token (RFC 8058 + CAN-SPAM one-click unsubscribe)
 *   - honor the suppression chokepoint (fails closed)
 *   - attribute every site link to the acting broker + stamp recipient identity
 *     (lib/crm/merge.attributeSiteLinks)
 *   - instrument the HTML with open/click tracking (lib/email-tracking)
 *   - send from the verified newsletter domain via Resend
 *   - record the per-recipient tracking row + log to crm_timeline
 *
 * Access-guarded. Never throws: every failure returns { ok: false, error }.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { getCrmAccess, requirePersonInScope, type CrmActionResult } from '@/app/actions/crm'
import { isSuppressed } from '@/lib/crm/suppressions'
import { sendEmail } from '@/lib/resend'
import { wrapNewsletterHtml, newsletterTextFooter } from '@/lib/email-templates/newsletter-shell'
import { attributeSiteLinks } from '@/lib/crm/merge'
import { instrumentEmailHtml } from '@/lib/email-tracking'
import { checkNewsletterVoice } from '@/lib/email/voice-precheck'
import { NEWSLETTER_FROM_ADDRESS } from '@/lib/newsletter/send-queue'
import {
  subscribeToNewsletter,
  getNewsletter,
  recordRecipientSend,
  type NewsletterRow,
} from '@/lib/data'
import type { CrmBrokerSlug } from '@/lib/crm/constants'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
// Bulk newsletter identity sends from the isolated news. subdomain (audit A4).
const NEWSLETTER_FROM = `Ryan Realty <${NEWSLETTER_FROM_ADDRESS}>`
/** One-click newsletter links live 180 days (T-5). */
const ONE_CLICK_TTL_SECONDS = (180 * 24 * 60 * 60)

function unsubUrl(token: string): string {
  return `${SITE_URL}/newsletter/unsubscribe?token=${encodeURIComponent(token)}`
}

/**
 * Resolve the "current" newsletter to send: the most recently sent letter, or
 * if none has been sent yet, the most recent draft that has a body. We send the
 * letter that represents the brand's latest message, never an empty shell.
 */
async function resolveCurrentNewsletter(): Promise<NewsletterRow | null> {
  const sb = createServiceClient()
  // Prefer the latest already-sent letter (the canonical "current" message).
  const sent = await sb
    .from('newsletters')
    .select('id')
    .eq('status', 'sent')
    .order('sent_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (sent.data?.id) {
    const letter = await getNewsletter(sent.data.id as string)
    if (letter && (letter.body_html || letter.body_text)) return letter
  }
  // Fall back to the newest draft with content.
  const draft = await sb
    .from('newsletters')
    .select('id')
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (draft.data?.id) {
    const letter = await getNewsletter(draft.data.id as string)
    if (letter && (letter.body_html || letter.body_text)) return letter
  }
  return null
}

export async function sendNewsletterToContactAction(personId: number): Promise<CrmActionResult> {
  try {
    if (!personId || !Number.isFinite(personId)) return { ok: false, error: 'Bad personId' }

    const access = await getCrmAccess()
    if (!access) return { ok: false, error: 'Unauthorized' }
    const scoped = await requirePersonInScope(personId, access)
    if (!scoped.ok) return scoped

    const sb = createServiceClient()
    const { data: person } = await sb
      .from('crm_people')
      .select('id,fub_legacy_id,emails,name,assigned_broker')
      .eq('id', personId)
      .maybeSingle()
    if (!person) return { ok: false, error: 'Person not found' }

    const emails = (person.emails ?? []) as Array<{ value?: string; isPrimary?: number | boolean }>
    const to = emails.find((e) => e.isPrimary)?.value ?? emails[0]?.value ?? null
    if (!to) return { ok: false, error: 'No email address on file' }

    // Suppression chokepoint (fails closed) — never email a hard stop / unsub.
    const gate = await isSuppressed(personId, 'email')
    if (gate.suppressed) return { ok: false, error: `Blocked by suppression (${gate.reasons.join(', ')})` }

    const letter = await resolveCurrentNewsletter()
    if (!letter) return { ok: false, error: 'No newsletter is ready to send' }

    // Voice hard-fail gate (G-NL-4) — parity with the bulk send path (R-1).
    const voice = checkNewsletterVoice({ subject: letter.subject, bodyHtml: letter.body_html, bodyText: letter.body_text })
    if (!voice.ok) return { ok: false, error: `Brand-voice check failed: ${voice.violations.join('; ')}` }

    // Never resurrect an opt-out (S-10). If this email is already a subscriber who
    // unsubscribed / bounced / complained, refuse — don't reactivate + send. Only a
    // brand-new email gets subscribed; an already-active one is used as-is, so its
    // segment is never clobbered to 'general'.
    const { data: existing } = await sb
      .from('newsletter_subscribers')
      .select('id, status, unsubscribe_token')
      .ilike('email', to)
      .maybeSingle()
    if (existing && (existing.status as string) !== 'active') {
      return { ok: false, error: `Contact previously ${existing.status}. Not re-subscribing or sending.` }
    }
    if (!existing) {
      await subscribeToNewsletter({
        email: to,
        name: (person.name as string | null) ?? null,
        source: 'crm-one-click',
        segment: 'general',
        crmPersonId: personId,
        fubPersonId: (person.fub_legacy_id as number | null) ?? undefined,
      })
    }
    const { data: sub } = existing
      ? { data: existing }
      : await sb.from('newsletter_subscribers').select('id,unsubscribe_token').ilike('email', to).maybeSingle()
    if (!sub?.unsubscribe_token) return { ok: false, error: 'Could not resolve subscriber' }

    const u = unsubUrl(sub.unsubscribe_token as string)
    const actingSlug: CrmBrokerSlug =
      access.brokerSlug ?? ((person.assigned_broker as CrmBrokerSlug | null) ?? 'matt')
    const fubId = (person.fub_legacy_id as number | null) ?? null

    // Build the HTML: shell + unsub footer, then attribute every site link to
    // the acting broker + stamp recipient identity, then instrument tracking with
    // the broker baked into the token (§5/H1) + a 180-day TTL (T-5).
    let html: string | undefined
    if (letter.body_html) {
      const attributed = attributeSiteLinks(letter.body_html, actingSlug, fubId)
      const wrapped = wrapNewsletterHtml({ bodyHtml: attributed, previewText: letter.preview_text, unsubscribeUrl: u })
      html = instrumentEmailHtml(wrapped, {
        personId,
        emailKey: `newsletter:${letter.id}:p${personId}`,
        label: letter.subject,
        broker: actingSlug,
        ttlSeconds: ONE_CLICK_TTL_SECONDS,
      })
    }
    const text = letter.body_text
      ? attributeSiteLinks(letter.body_text, actingSlug, fubId) + newsletterTextFooter(u)
      : undefined

    const res = await sendEmail({
      to,
      from: NEWSLETTER_FROM,
      subject: letter.subject,
      html,
      text,
      headers: { 'List-Unsubscribe': `<${u}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    })
    // Per-recipient tracking row — recorded on FAILURE too (S-11), so a failed
    // one-click send still leaves an auditable attempt, exactly like the bulk path.
    await recordRecipientSend({
      newsletterId: letter.id,
      subscriberId: sub.id as string,
      email: to,
      resendMessageId: res.id ?? null,
      failed: Boolean(res.error),
    })
    if (res.error) {
      await sb.from('crm_timeline').insert({
        person_id: personId,
        kind: 'email_out',
        title: letter.subject,
        body: `Newsletter send failed: ${res.error}`,
        payload: { newsletterId: letter.id, to, error: res.error, oneClick: true },
        broker: actingSlug,
        source: 'app',
        dedupe_key: `newsletter-fail:${letter.id}:${personId}:${res.error.slice(0, 40)}`,
      })
      return { ok: false, error: res.error }
    }
    // Log to the contact timeline so the send shows on the record card.
    await sb.from('crm_timeline').insert({
      person_id: personId,
      kind: 'email_out',
      title: letter.subject,
      body: 'Sent the latest newsletter',
      payload: { newsletterId: letter.id, to, resendId: res.id ?? null, oneClick: true },
      broker: actingSlug,
      source: 'app',
      dedupe_key: res.id ? `newsletter:${res.id}:p${personId}` : `newsletter:${letter.id}:${Date.now()}:p${personId}`,
    })

    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Failed to send newsletter' }
  }
}
