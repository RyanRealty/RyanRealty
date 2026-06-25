'use server'

/**
 * One-click CMA from a CRM contact record (Stream 2).
 *
 * Matt's rule: the owns-home next step is "Send CMA", and the CMA must
 * auto-generate + queue, then the broker REVIEWS before it sends. Review-first,
 * always — there is NO auto-send between build and delivery.
 *
 * Two server actions map onto the existing two-stage auto-CMA pipeline plus the
 * existing draft-send path:
 *
 *   startCmaForContactAction(personId)
 *     → resolve the contact's owned home from CRM geo (fub_person_geo, same
 *       resolution the lead page uses: formatted_address / source_address +
 *       lat/lng), parse it into the address parts createCmaDelivery wants,
 *       insert the cma_deliveries row (status 'pending' = QUEUED), then build it
 *       to a REVIEWABLE state (status 'ready') via processCmaDelivery. The build
 *       renders the PDF + drafts the email + notifies the assigned broker with a
 *       signed /cma-drafts/<id> review link. It does NOT email the lead.
 *
 *   sendCmaForContactAction(deliveryId)
 *     → after the broker has reviewed the draft, deliver the drafted email to
 *       the lead (the 'ready' → 'sent' transition). The CMA email carries
 *       open/click tracking (instrumentEmailHtml) so engagement lands on the
 *       contact's communication chain. Logs the send to crm_timeline. FUB notes
 *       are intentionally NOT written (FUB cutover — see file footer notes).
 *
 * State machine (review-first, no auto-send):
 *   [start]  createCmaDelivery → 'pending'
 *            processCmaDelivery → 'ready'    (reviewable; broker notified)
 *   [review] broker opens /cma-drafts/<id> or the contact card "Send CMA" UI
 *   [send]   sendCmaForContactAction → 'ready' → 'sent' (lead emailed + tracked)
 *
 * NOTE on the original Stream-2 spec: it said sendCmaForContactAction should
 * "fire it via processCmaDelivery". processCmaDelivery only BUILDS to 'ready'
 * (it never emails the lead), so calling it as the send step would never deliver
 * the CMA. The completion standard ("a second call sends it") governs: the send
 * step performs the 'ready' → 'sent' delivery (the same logic as the existing
 * /api/cma-drafts/<id>/send route), minus the FUB note. processCmaDelivery is
 * used in the START step where it belongs (auto-build to a reviewable draft).
 *
 * DAL boundary: this is a 'use server' action file, so the cma_deliveries +
 * crm_timeline mutations live here legitimately (G1 allows raw .from() in
 * server actions). Reads of the contact + geo go through the service client too,
 * scoped behind the CRM access guard + requirePersonInScope.
 */

import { revalidatePath } from 'next/cache'

import { createServiceClient } from '@/lib/supabase/service'
import { getCrmAccess, requirePersonInScope } from '@/app/actions/crm'
import { createCmaDelivery, processCmaDelivery } from '@/lib/cma-delivery'
import { parseContactAddress } from '@/lib/crm/contact-cma-address'
import { instrumentEmailHtml } from '@/lib/email-tracking'
import { attributeOutbound } from '@/lib/crm/attributed-links'
import { prepareDeliverableEmail } from '@/lib/email/prepare'
import { CRM_BROKER_BY_EMAIL } from '@/lib/crm/constants'
import { sendEmail } from '@/lib/resend'

const STORAGE_BUCKET = 'cma-deliveries'

export type StartCmaResult =
  | { ok: true; deliveryId: string }
  | { ok: false; error: string }

export type SendCmaResult =
  | { ok: true; alreadySent?: boolean }
  | { ok: false; error: string }

// ─── Contact + geo resolution (CRM) ─────────────────────────────────────────

type ContactCmaContext = {
  personId: number
  fubPersonId: number | null
  leadEmail: string | null
  leadName: string | null
  leadPhone: string | null
  /** The owned-home address resolved from CRM geo. */
  homeAddress: string | null
}

/**
 * Resolve the contact's identity + owned-home address from the CRM. Mirrors how
 * app/admin/console/leads/[id]/page.tsx derives homeAddress from full.geo:
 * fub_person_geo.formatted_address (preferred) or .source_address, keyed by the
 * contact's fub_legacy_id.
 */
async function resolveContactContext(personId: number): Promise<ContactCmaContext | { error: string }> {
  const sb = createServiceClient()
  const { data: person } = await sb
    .from('crm_people')
    .select('id,fub_legacy_id,name,emails,phones')
    .eq('id', personId)
    .maybeSingle()
  if (!person) return { error: 'Contact not found' }

  const fubPersonId = (person.fub_legacy_id as number | null) ?? null

  const emails = (person.emails as Array<{ value?: string; isPrimary?: number | boolean }> | null) ?? []
  const leadEmail =
    emails
      .slice()
      .sort((a, b) => Number(!!b.isPrimary) - Number(!!a.isPrimary))[0]?.value?.trim()
      .toLowerCase() ?? null

  const phones = (person.phones as Array<{ value?: string; isPrimary?: number | boolean }> | null) ?? []
  const leadPhone =
    phones
      .slice()
      .sort((a, b) => Number(!!b.isPrimary) - Number(!!a.isPrimary))[0]?.value?.trim() ?? null

  let homeAddress: string | null = null
  if (fubPersonId) {
    const { data: geo } = await sb
      .from('fub_person_geo')
      .select('formatted_address,source_address')
      .eq('fub_person_id', fubPersonId)
      .maybeSingle()
    homeAddress =
      (geo?.formatted_address as string | null)?.trim() ||
      (geo?.source_address as string | null)?.trim() ||
      null
  }

  return {
    personId,
    fubPersonId,
    leadEmail,
    leadName: (person.name as string | null)?.trim() || null,
    leadPhone,
    homeAddress,
  }
}

// ─── Action 1: start (auto-build → queue → REVIEW) ──────────────────────────

/**
 * Queue + auto-build a reviewable CMA for the contact's owned home. Returns the
 * delivery id once the draft is built (status 'ready'); the broker reviews +
 * sends with sendCmaForContactAction. Never throws — returns the result shape.
 */
export async function startCmaForContactAction(personId: number): Promise<StartCmaResult> {
  try {
    if (!Number.isFinite(personId) || personId <= 0) {
      return { ok: false, error: 'A valid contact id is required' }
    }
    const access = await getCrmAccess()
    if (!access) return { ok: false, error: 'Unauthorized' }
    const scoped = await requirePersonInScope(personId, access)
    if (!scoped.ok) return { ok: false, error: scoped.error }

    const ctx = await resolveContactContext(personId)
    if ('error' in ctx) return { ok: false, error: ctx.error }

    if (!ctx.homeAddress) {
      return {
        ok: false,
        error: 'No home on file for this contact. Add the owner address before sending a CMA.',
      }
    }
    if (!ctx.leadEmail) {
      return {
        ok: false,
        error: 'No email on file for this contact. Add an email before sending a CMA.',
      }
    }

    const parsed = parseContactAddress(ctx.homeAddress)
    if (!parsed || !parsed.parsedCity) {
      // createCmaDelivery's property match keys on city + street number; without
      // a parseable city we cannot resolve the MLS property reliably.
      return {
        ok: false,
        error: 'Could not read a city from the home address. Check the owner address on file.',
      }
    }

    // ── Stage 1: queue the delivery row (status 'pending').
    const created = await createCmaDelivery({
      rawAddress: parsed.rawAddress,
      parsedStreet: parsed.parsedStreet,
      parsedCity: parsed.parsedCity,
      parsedState: parsed.parsedState,
      parsedPostalCode: parsed.parsedPostalCode,
      leadEmail: ctx.leadEmail,
      leadName: ctx.leadName,
      leadPhone: ctx.leadPhone,
      fubPersonId: ctx.fubPersonId,
    })
    if ('error' in created) {
      return { ok: false, error: `Could not queue the CMA: ${created.error}` }
    }
    const deliveryId = created.id

    // Log the QUEUED-for-review event to the contact timeline.
    await logCrmTimeline(personId, {
      kind: 'system',
      title: 'CMA queued for review',
      body: `Auto-CMA queued for ${parsed.rawAddress}. Building a draft for you to review before it sends.`,
      broker: access.brokerSlug,
      dedupeKey: `cma:queued:${deliveryId}`,
    })

    // ── Stage 2: build to a REVIEWABLE draft (status 'ready'). This renders the
    // PDF, drafts the email, and notifies the assigned broker with a signed
    // /cma-drafts/<id> review link. It does NOT email the lead.
    const built = await processCmaDelivery(deliveryId)
    if (!built.ok) {
      const reason =
        built.status === 'no_match'
          ? 'We could not match this address to an MLS property, so a CMA cannot be built automatically.'
          : `CMA build did not finish (${built.reason ?? built.status}).`
      await logCrmTimeline(personId, {
        kind: 'system',
        title: 'CMA build did not finish',
        body: reason,
        broker: access.brokerSlug,
        dedupeKey: `cma:build-failed:${deliveryId}`,
      })
      return { ok: false, error: reason }
    }

    revalidatePath(`/admin/console/leads/${personId}`)
    revalidatePath(`/admin/crm/${personId}`)
    return { ok: true, deliveryId }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Unexpected error starting the CMA',
    }
  }
}

// ─── Action 2: send (after broker review) ───────────────────────────────────

/**
 * Deliver the reviewed CMA email to the lead (status 'ready' → 'sent'). The
 * email body is instrumented with open/click tracking so engagement lands on
 * the contact's communication chain. Logs the send to crm_timeline. Never
 * throws — returns the result shape. FUB notes are NOT written (cutover).
 */
export async function sendCmaForContactAction(deliveryId: string): Promise<SendCmaResult> {
  try {
    const id = (deliveryId ?? '').trim()
    if (!id) return { ok: false, error: 'A delivery id is required' }

    const access = await getCrmAccess()
    if (!access) return { ok: false, error: 'Unauthorized' }

    const sb = createServiceClient()
    const { data: row, error } = await sb
      .from('cma_deliveries')
      .select(
        'id,status,fub_person_id,lead_email,lead_name,raw_address,pdf_storage_path,email_subject,email_body_html,email_body_text,assigned_broker_email,assigned_broker_name,cma_estimated_value',
      )
      .eq('id', id)
      .maybeSingle()
    if (error || !row) return { ok: false, error: 'CMA draft not found' }

    // Resolve the contact this delivery belongs to (for scope + timeline) by its
    // fub_person_id, the only link cma_deliveries carries back to a contact.
    const fubPersonId = (row.fub_person_id as number | null) ?? null
    let crmPersonId: number | null = null
    if (fubPersonId) {
      const { data: p } = await sb
        .from('crm_people')
        .select('id')
        .eq('fub_legacy_id', fubPersonId)
        .maybeSingle()
      crmPersonId = (p?.id as number | null) ?? null
    }
    // Scope-guard the send to the contact when we can resolve them. A delivery
    // with no resolvable contact (legacy LP row) is owner/superuser-only.
    if (crmPersonId) {
      const scoped = await requirePersonInScope(crmPersonId, access)
      if (!scoped.ok) return { ok: false, error: scoped.error }
    } else if (access.brokerSlug) {
      // Restricted broker cannot send an unlinked delivery.
      return { ok: false, error: 'Not authorized for this CMA draft' }
    }

    if (row.status === 'sent') {
      return { ok: true, alreadySent: true }
    }
    if (row.status !== 'ready') {
      return { ok: false, error: `This CMA is not ready to send (status: ${row.status})` }
    }
    if (!row.email_body_html || !row.email_subject || !row.pdf_storage_path) {
      return { ok: false, error: 'This CMA draft is missing its email or PDF' }
    }

    // Pull the PDF from Storage to attach.
    const { data: pdfBlob, error: dlError } = await sb.storage
      .from(STORAGE_BUCKET)
      .download(row.pdf_storage_path as string)
    if (dlError || !pdfBlob) {
      return { ok: false, error: `Could not load the CMA PDF: ${dlError?.message ?? 'no data'}` }
    }
    const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer())

    // Broker-attribute (every link gets ?agent=<broker>) AND instrument open/click
    // tracking on the drafted email so the broker sees routing + engagement on the
    // contact's communication chain. emailKey is stable per delivery; label is the
    // subject (the engagement panel keys on the email title). (CRM cutover 2026-06-24.)
    const subject = row.email_subject as string
    const cmaBrokerSlug = CRM_BROKER_BY_EMAIL[String(row.assigned_broker_email ?? '').trim().toLowerCase()] ?? 'matt'
    const trackedHtml = crmPersonId
      ? attributeOutbound(row.email_body_html as string, {
          brokerSlug: cmaBrokerSlug,
          personId: crmPersonId,
          fubPersonId,
          emailKey: `cma:${id}`,
          label: subject,
        })
      : (row.email_body_html as string)

    // Route through the deliverability preflight: multipart text + RFC 8058
    // List-Unsubscribe headers + CAN-SPAM postal footer (CRM cutover 2026-06-24).
    const prepared = await prepareDeliverableEmail({
      subject,
      html: trackedHtml,
      text: (row.email_body_text as string) ?? null,
      personId: crmPersonId,
    })
    const result = await sendEmail({
      to: row.lead_email as string,
      subject: prepared.subject,
      html: prepared.html,
      text: prepared.text,
      headers: prepared.headers,
      replyTo: (row.assigned_broker_email as string | null) ?? 'matt@ryan-realty.com',
      attachments: [{ filename: 'home-valuation.pdf', content: pdfBuffer }],
    })
    if (result.error) {
      return { ok: false, error: `Email send failed: ${result.error}` }
    }

    const sentAt = new Date().toISOString()
    await sb
      .from('cma_deliveries')
      .update({ status: 'sent', sent_email_resend_id: result.id ?? null, sent_at: sentAt })
      .eq('id', id)

    // Log the send to the contact's timeline (kind 'email_out' so it threads
    // into the conversation view). NO FUB note (FUB cutover).
    if (crmPersonId) {
      await logCrmTimeline(crmPersonId, {
        kind: 'email_out',
        title: subject,
        body: `CMA sent to ${row.lead_email as string} for ${row.raw_address as string}.`,
        broker: (row.assigned_broker_name as string | null) ?? access.brokerSlug,
        payload: { deliveryId: id, resendId: result.id ?? null, to: row.lead_email },
        dedupeKey: `cma:sent:${id}`,
      })
      revalidatePath(`/admin/console/leads/${crmPersonId}`)
      revalidatePath(`/admin/crm/${crmPersonId}`)
    }

    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Unexpected error sending the CMA',
    }
  }
}

// ─── Timeline helper ────────────────────────────────────────────────────────

async function logCrmTimeline(
  personId: number,
  entry: {
    kind: string
    title?: string | null
    body?: string | null
    broker?: string | null
    source?: string
    payload?: Record<string, unknown>
    dedupeKey?: string
  },
): Promise<void> {
  try {
    const sb = createServiceClient()
    await sb.from('crm_timeline').insert({
      person_id: personId,
      kind: entry.kind,
      title: entry.title ?? null,
      body: entry.body ?? null,
      broker: entry.broker ?? null,
      source: entry.source ?? 'app',
      payload: entry.payload ?? {},
      dedupe_key: entry.dedupeKey ?? null,
    })
  } catch (e) {
    // Timeline logging is best-effort; never fail the action on a log write.
    console.warn('[contact-cma] timeline log failed:', e instanceof Error ? e.message : String(e))
  }
}
