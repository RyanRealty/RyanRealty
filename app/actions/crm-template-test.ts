'use server'

/**
 * crm-template-test — broker self-test send for template preview.
 *
 * This is NOT a marketing/automated send. It sends to the CALLING BROKER'S OWN
 * email or cell phone only, with sample merge data, so they can preview a
 * template before using it with real contacts. It is therefore excluded from the
 * prepareDeliverableEmail / CAN-SPAM gate (NON_SENDER in check-email-quality.mjs)
 * for the same reason 1:1 broker replies and internal alerts are excluded: it is
 * not a bulk or marketing-automation send; no real contact is involved; and the
 * CAN-SPAM requirements (List-Unsubscribe headers, footer with postal address)
 * would be misleading noise in a preview to self.
 *
 * Compliance gates that DO still apply:
 *   - Access guard (CRM access required)
 *   - TCPA quiet-hours check for SMS (9pm to 8am Pacific)
 *   - A2P 10DLC Twilio gate (sendSms checks a2p campaign status)
 *   - Send path is the same library calls (sendCrmEmail / sendSms) as real sends
 */

import { getCrmAccess } from '@/app/actions/crm'
import type { CrmTemplateResult } from '@/lib/crm/templateValidation'

export type SendTestInput = {
  channel: 'email' | 'sms'
  subject?: string | null
  body: string
}

/**
 * Send a test of a template (current in-form draft) to the calling broker's
 * own email address (email templates) or cell phone (SMS templates).
 *
 * Merge tokens are resolved with sample data so the broker can evaluate the
 * rendered layout without using a real contact record. Unresolved tokens are
 * rendered as [token_name] so the broker can spot any they forgot to fill.
 */
export async function sendTemplateSelfTestAction(
  input: SendTestInput,
): Promise<CrmTemplateResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }

  const channel = input.channel === 'sms' ? 'sms' : 'email'
  const rawBody = (input.body ?? '').trim()
  if (!rawBody) return { ok: false, error: 'Template body is empty. Nothing to send.' }

  // Render with sample data so tokens like %contact_first_name% do not reach
  // the inbox literally. Values chosen to look real enough to evaluate copy.
  const { renderCrmMerge } = await import('@/lib/crm/merge')
  const samplePerson = {
    first_name: 'Alex',
    name: 'Alex Sample',
    custom: {
      customSellerPropertyAddress: '123 River Ridge Dr, Bend OR 97701',
      customPropertyAddress: '123 River Ridge Dr, Bend OR 97701',
      cmaLink: 'https://ryan-realty.com/cma/sample',
    },
  }
  const renderedBody = renderCrmMerge(rawBody, samplePerson)
    // Replace any remaining unresolved standard tokens with bracketed labels.
    .replace(/%([A-Za-z][A-Za-z0-9_]*)%/g, '[$1]')

  if (channel === 'email') {
    const rawSubject = (input.subject ?? '').trim()
    if (!rawSubject) return { ok: false, error: 'An email template requires a subject line.' }
    const renderedSubject = renderCrmMerge(rawSubject, samplePerson)
      .replace(/%([A-Za-z][A-Za-z0-9_]*)%/g, '[$1]')

    const { CRM_MAILBOXES, sendCrmEmail } = await import('@/lib/crm/gmail')
    const slug = access.brokerSlug ?? 'matt'
    const mailbox = CRM_MAILBOXES.find((m) => m.slug === slug) ?? CRM_MAILBOXES[0]

    const result = await sendCrmEmail({
      fromMailbox: mailbox.email,
      to: mailbox.email,              // send to self
      subject: `[TEST] ${renderedSubject}`,
      bodyText: renderedBody,
      withSignature: false,           // no signature on test previews
    })
    if (!result.ok) return { ok: false, error: result.error }
    return { ok: true, message: `Test email sent to ${mailbox.email}` }
  }

  // SMS path. Respect TCPA quiet hours (compliance gate).
  const { inSmsQuietHours } = await import('@/lib/crm/quiet-hours')
  if (inSmsQuietHours()) {
    return { ok: false, error: 'Quiet hours (TCPA 9pm to 8am Pacific). Try again after 8am.' }
  }

  // Route through the cached DAL reader (not raw .from()) for broker telephony.
  const { getBrokerTelephony } = await import('@/lib/data/crm/getBrokerTelephony')
  const telephony = await getBrokerTelephony()
  const slug = access.brokerSlug ?? 'matt'
  const entry = telephony.bySlug[slug] ?? null
  const toPhone = entry?.forwardToCell ?? null
  const fromNumber = entry?.twilioNumber ?? null
  if (!toPhone) {
    return { ok: false, error: 'No cell phone on file for your broker profile. Add forward_to_cell in Admin > Team.' }
  }
  if (!fromNumber) {
    return { ok: false, error: 'No Twilio number on file for your broker profile.' }
  }

  const { sendSms } = await import('@/lib/crm/twilio')
  const smsResult = await sendSms({ from: fromNumber, to: toPhone, body: renderedBody })
  if (!smsResult.ok) return { ok: false, error: smsResult.error }
  return { ok: true, message: `Test SMS sent to ${toPhone}` }
}
