'use server'

/**
 * One-click CMA from a CRM contact record.
 *
 * Rewired 2026-07-07 (W1 lifecycle workflows): the legacy React-PDF
 * cma_deliveries pipeline (lib/cma-delivery.ts) is retired for NEW builds.
 * "Send CMA" on a contact now runs the canonical deterministic builder
 * (lib/cma/build.ts) — the same engine behind the content:cma queue and
 * /admin/cmas — and the draft lands in /admin/cmas for review.
 *
 * Review-first, always:
 *   startCmaForContactAction(personId)
 *     → resolve the contact's owned home from CRM geo, run the deterministic
 *       build, land a `cmas` row in status 'draft'. Returns the slug (the
 *       `deliveryId` field name is kept for the existing form callers).
 *       Nothing is emailed to the lead.
 *   sendCmaForContactAction(idOrSlug)
 *     → for a cmas slug: deliver the APPROVED (finalized) CMA through the
 *       canonical tracked-send rail (lib/cma/send.ts — suppression checked,
 *       branded shell, attributed + instrumented, PDF attached).
 *     → for a legacy cma_deliveries uuid: the old rows still send through
 *       their stored draft so in-flight reviews aren't stranded.
 */

import { revalidatePath } from 'next/cache'

import { createServiceClient } from '@/lib/supabase/service'
import { getCrmAccess, requirePersonInScope } from '@/app/actions/crm'
import { buildCma } from '@/lib/cma/build'
import { sendCmaToLead } from '@/lib/cma/send'
import { slugifyAddress } from '@/lib/cma-request'
import { parseContactAddress } from '@/lib/crm/contact-cma-address'
import { attributeOutbound } from '@/lib/crm/attributed-links'
import { prepareDeliverableEmail } from '@/lib/email/prepare'
import { CRM_BROKER_BY_EMAIL } from '@/lib/crm/constants'
import { isSuppressed, isSuppressedByEmail } from '@/lib/crm/suppressions'
import { sendEmail } from '@/lib/resend'

const STORAGE_BUCKET = 'cma-deliveries'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
  homeAddress: string | null
}

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

// ─── Action 1: start (deterministic build → reviewable draft) ────────────────

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
      return {
        ok: false,
        error: 'Could not read a city from the home address. Check the owner address on file.',
      }
    }

    const slug = slugifyAddress(parsed.rawAddress)
    const built = await buildCma({
      slug,
      rawAddress: parsed.rawAddress,
      city: parsed.parsedCity,
      postalCode: parsed.parsedPostalCode,
      client: {
        name: ctx.leadName,
        email: ctx.leadEmail,
        phone: ctx.leadPhone,
        notes: null,
      },
      requestSource: 'crm-contact-card',
    })

    await logCrmTimeline(personId, {
      kind: 'system',
      title: built.ok ? 'CMA draft built' : 'CMA build did not finish',
      body: built.ok
        ? `CMA for ${parsed.rawAddress} built as a draft. Review and approve it at /admin/cmas/${slug}, then send.`
        : `CMA build for ${parsed.rawAddress} failed: ${built.error ?? 'unknown error'}`,
      broker: access.brokerSlug,
      dedupeKey: `cma:${built.ok ? 'built' : 'build-failed'}:${slug}:${new Date().toISOString().slice(0, 10)}`,
    })

    if (!built.ok) {
      return { ok: false, error: built.error ?? 'CMA build did not finish.' }
    }

    revalidatePath(`/admin/console/leads/${personId}`)
    revalidatePath(`/admin/crm/${personId}`)
    revalidatePath('/admin/cmas')
    return { ok: true, deliveryId: slug }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Unexpected error starting the CMA',
    }
  }
}

// ─── Action 2: send (after broker review) ───────────────────────────────────

export async function sendCmaForContactAction(deliveryId: string): Promise<SendCmaResult> {
  try {
    const id = (deliveryId ?? '').trim()
    if (!id) return { ok: false, error: 'A delivery id is required' }

    const access = await getCrmAccess()
    if (!access) return { ok: false, error: 'Unauthorized' }

    // Canonical path: a cmas slug from the deterministic pipeline.
    if (!UUID_RE.test(id)) {
      const slug = id.toLowerCase()
      const result = await sendCmaToLead(slug)
      if (!result.ok) {
        return {
          ok: false,
          error:
            result.error ??
            `Could not send CMA ${slug}. Approve it at /admin/cmas/${slug} first if it is still a draft.`,
        }
      }
      if (result.personId) {
        revalidatePath(`/admin/console/leads/${result.personId}`)
        revalidatePath(`/admin/crm/${result.personId}`)
      }
      return { ok: true }
    }

    // Legacy path: an in-flight cma_deliveries row from before the cutover.
    return await sendLegacyCmaDelivery(id, access)
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Unexpected error sending the CMA',
    }
  }
}

/**
 * Legacy cma_deliveries send — kept ONLY so 'ready' rows created before the
 * 2026-07-07 cutover can still be delivered from the contact card. No new
 * rows are created on this path.
 */
async function sendLegacyCmaDelivery(
  id: string,
  access: NonNullable<Awaited<ReturnType<typeof getCrmAccess>>>,
): Promise<SendCmaResult> {
  const sb = createServiceClient()
  const { data: row, error } = await sb
    .from('cma_deliveries')
    .select(
      'id,status,fub_person_id,lead_email,lead_name,raw_address,pdf_storage_path,email_subject,email_body_html,email_body_text,assigned_broker_email,assigned_broker_name',
    )
    .eq('id', id)
    .maybeSingle()
  if (error || !row) return { ok: false, error: 'CMA draft not found' }

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
  if (crmPersonId) {
    const scoped = await requirePersonInScope(crmPersonId, access)
    if (!scoped.ok) return { ok: false, error: scoped.error }
  } else if (access.brokerSlug) {
    return { ok: false, error: 'Not authorized for this CMA draft' }
  }

  if (row.status === 'sent') return { ok: true, alreadySent: true }
  if (row.status !== 'ready') {
    return { ok: false, error: `This CMA is not ready to send (status: ${row.status})` }
  }
  if (!row.email_body_html || !row.email_subject || !row.pdf_storage_path) {
    return { ok: false, error: 'This CMA draft is missing its email or PDF' }
  }

  const { data: pdfBlob, error: dlError } = await sb.storage
    .from(STORAGE_BUCKET)
    .download(row.pdf_storage_path as string)
  if (dlError || !pdfBlob) {
    return { ok: false, error: `Could not load the CMA PDF: ${dlError?.message ?? 'no data'}` }
  }
  const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer())

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

  const sup = crmPersonId
    ? await isSuppressed(crmPersonId, 'email')
    : await isSuppressedByEmail(row.lead_email as string, 'email')
  if (sup.suppressed) {
    return { ok: false, error: 'This contact has opted out of email and cannot be sent a CMA.' }
  }

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
    console.warn('[contact-cma] timeline log failed:', e instanceof Error ? e.message : String(e))
  }
}
