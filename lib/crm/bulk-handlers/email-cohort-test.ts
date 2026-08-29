/**
 * The "send one to me first" copy of a batch email.
 *
 * Renders through the SAME pipeline the cohort handler uses — template resolve,
 * renderCrmMerge with a real buildMergeContext, composeOutboundHtml,
 * attributeOutbound, prepareDeliverableEmail, the same attachments — so what
 * lands in the broker's inbox is what the cohort would get, not an
 * approximation. A preview that renders differently from the send is worse than
 * no preview: it certifies the wrong thing.
 *
 * Two deliberate differences from a real cohort send, both so a test can never
 * be mistaken for or counted as the campaign:
 *   - the subject carries a [TEST] prefix
 *   - nothing is written to email_events, so the campaign's sent/open/click
 *     numbers stay clean and the test is not tracked as a recipient
 *
 * It goes out through sendGovernedEmail like every other send (G56), addressed
 * to the BROKER'S OWN crm_person record. That is the honest shape: the broker
 * is the recipient, so it is their consent record that gets checked and their
 * timeline that records the message. The sampled contact is merge DATA only and
 * is never mailed, never suppression-checked as a recipient, and gets no
 * timeline row for a message they did not receive.
 *
 * A side benefit of addressing it properly: the CAN-SPAM footer's unsubscribe
 * token is the BROKER'S. If they click it in their own test they unsubscribe
 * themselves, not the client whose data was borrowed for the merge.
 */

import 'server-only'
import { sendGovernedEmail } from '@/lib/comms/sendGovernedEmail'
import { personIdsByEmailCi } from '@/lib/data/crm/personByEmailCi'
import { createServiceClient } from '@/lib/supabase/service'
import { renderCrmMerge } from '@/lib/crm/merge'
import { buildMergeContext } from '@/lib/crm/merge-context'
import { composeOutboundHtml } from '@/lib/crm/email-body'
import { getSignatureForMailbox } from '@/lib/crm/email-signature'
import { attributeOutbound } from '@/lib/crm/attributed-links'
import { loadEmailAttachments } from '@/lib/crm/attachments'
import type { CrmAttachmentRef } from '@/lib/crm/attachment-limits'
import {
  brokerSlugFromActorEmail,
  freezeBulkEmailSendParams,
} from '@/lib/crm/bulk-email-identity'
import {
  getEmailCohortRecipients,
  getCrmTemplateForSend,
} from '@/lib/data/crm/getEmailCohortRecipients'
import { resolveCohortContent, type EmailCohortParams } from './email-cohort'

export async function sendBatchTestEmail(input: {
  /** The signed-in broker's own address. */
  to: string
  /** A real contact from the cohort, used ONLY as merge data. */
  samplePersonId: number
  params: EmailCohortParams
}): Promise<{ ok: true; sentTo: string; mergedAgainst: string } | { ok: false; error: string }> {
  const { to, samplePersonId, params } = input

  const template =
    params.templateId != null ? await getCrmTemplateForSend(params.templateId) : null
  const content = resolveCohortContent(params, template)
  if (!content) return { ok: false, error: 'Pick a template, or write a subject and body' }

  const [recipient] = await getEmailCohortRecipients([samplePersonId])
  if (!recipient) return { ok: false, error: 'Could not load a contact to merge against' }

  const mergeContext = await buildMergeContext({
    person: recipient,
    senderSlug: recipient.assigned_broker ?? null,
  })
  const frozen = freezeBulkEmailSendParams(to, params)
  const signatureHtml = frozen.includeSignature
    ? (await getSignatureForMailbox(to))?.html ?? null
    : null
  const subject = renderCrmMerge(content.subject, recipient, mergeContext)
  const merged = composeOutboundHtml(
    renderCrmMerge(content.body, recipient, mergeContext),
    signatureHtml,
    'auto',
  )
  // attributeOutbound too, or the test is not the send. Without it the links
  // arrive BARE while the real cohort wraps them in signed /api/track/e/click
  // tokens — which is precisely the class of defect a test exists to surface
  // (a plain-text body whose URL never became an anchor shipped unclickable and
  // untracked for exactly this reason). Cost of the fidelity: if the broker
  // clicks a link in their own test, one click event lands on the sampled
  // contact. That is a fair trade for a preview that is byte-identical.
  const body = attributeOutbound(merged, {
    brokerSlug: recipient.assigned_broker ?? 'matt',
    personId: recipient.id,
    fubPersonId: recipient.fub_legacy_id,
    emailKey: 'batch-test',
    label: subject,
  })

  let attachments: Array<{ filename: string; content: Buffer }> | undefined
  const refs: CrmAttachmentRef[] = params.attachments ?? []
  if (refs.length > 0) {
    const loaded = await loadEmailAttachments(refs)
    if (!loaded.ok) return { ok: false, error: loaded.error }
    attachments = (loaded.attachments ?? []).map((a) => ({ filename: a.filename, content: a.content }))
  }

  // The broker's own CRM record is the recipient of record. Without it there is
  // no consent record to check and no timeline to write, and bypassing the
  // chokepoint to send anyway is exactly what G56 exists to stop — so refuse.
  const brokerIds = await personIdsByEmailCi(createServiceClient(), to.toLowerCase())
  const brokerPersonId = brokerIds[0]
  if (!brokerPersonId) {
    return { ok: false, error: `No CRM contact for ${to}, so the test has no recipient record. Add yourself as a contact first.` }
  }

  const res = await sendGovernedEmail({
    personId: brokerPersonId,
    purpose: 'crm:batch-email-test',
    initiator: { kind: 'broker', broker: brokerSlugFromActorEmail(to), source: 'batch-email-test' },
    payload:
      frozen.sendVia === 'gmail'
        ? {
            rail: 'gmail',
            to: [to],
            subject: `[TEST] ${subject}`,
            bodyText: body,
            bodyFormat: 'html',
            withSignature: false,
            attachments: attachments?.map((a) => ({
              filename: a.filename,
              content: a.content,
              mimeType: 'application/octet-stream',
            })),
          }
        : {
            rail: 'resend',
            to,
            subject: `[TEST] ${subject}`,
            html: body,
            from: frozen.fromIdentity,
            replyTo: frozen.replyTo,
            attachments,
            timelineTitle: `[TEST] ${subject}`,
          },
  })
  if (!res.ok) {
    // The chokepoint names the stage that refused (hard-stop, suppression,
    // recipient, provider) — pass it through rather than a generic failure.
    return { ok: false, error: `${res.stage}: ${res.error}` }
  }

  return {
    ok: true,
    sentTo: to,
    mergedAgainst: recipient.email || `contact ${recipient.id}`,
  }
}
