'use server'

/**
 * Compose-and-send for the Expireds + FSBO dashboards (Matt directive
 * 2026-07-14): when sending the CMA/audit to a lead, the broker picks the
 * channel (email or text), picks a template or writes the message, and sends.
 *
 * - prepareDocSendAction: everything the compose dialog needs — the doc facts,
 *   the default email prefill, and every active template of both channels,
 *   PRE-MERGED against this owner + property (what you see is what sends).
 * - sendDocEmailAction: the tracked CMA rail (Gmail DWD from the broker's
 *   mailbox, PDF attached, open/click instrumented) with the composed subject
 *   + message. The click is the approval; needs_review demands acknowledgment.
 * - sendDocSmsAction: Twilio A2P with every guard fail-closed (hard-stop,
 *   quiet hours, suppression, unresolved merge tokens), links short-linked so
 *   taps land on the dashboard.
 */

import { revalidatePath } from 'next/cache'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { createServiceClient } from '@/lib/supabase/service'
import { getCmaAdminRowBySlug } from '@/lib/data/cma/documents'
import { updateCmaRowFieldsBySlug } from '@/lib/data'
import { getExpiredListingDetail } from '@/lib/data/expired/outreach'
import { sendCmaToLead, prepareCmaSendPreview } from '@/lib/cma/send'
import { slugifyAddress } from '@/lib/cma/address-slug'
import { ensureNativeLead } from '@/lib/data/crm/ensureNativeLead'
import { isSuppressed } from '@/lib/crm/suppressions'
import { inSmsQuietHours } from '@/lib/crm/quiet-hours'
import { renderCrmMerge, findUnresolvedMergeTokens, type MergePersonLike } from '@/lib/crm/merge'
import { buildMergeContext } from '@/lib/crm/merge-context'
import { sendSmsViaMessagingService, toE164 } from '@/lib/crm/twilio'

export type DocKind = 'expired' | 'fsbo'

async function requireAdmin(): Promise<boolean> {
  const session = await getSession()
  const role = await getAdminRoleForEmail(session?.user?.email ?? null)
  return Boolean(role && role.role !== 'report_viewer')
}

interface DocTarget {
  id: string
  streetAddress: string
  city: string | null
  postalCode: string | null
  ownerName: string | null
  phone: string | null
  email: string | null
  hardStop: boolean
  relisted: boolean
  gone: boolean
  personId: number | null
  smsSentAt: string | null
  revalidate: string
  source: string
}

async function loadTarget(kind: DocKind, id: string): Promise<DocTarget | null> {
  if (kind === 'expired') {
    const e = await getExpiredListingDetail(id)
    if (!e?.street_address) return null
    return {
      id: e.listing_key,
      streetAddress: e.street_address,
      city: e.city,
      postalCode: e.postal_code,
      ownerName: e.owner_name,
      phone: e.contact_phone,
      email: e.contact_email,
      hardStop: e.hard_stop,
      relisted: e.relisted,
      gone: false,
      personId: e.crm_person_id,
      smsSentAt: e.outreach_sms_sent_at,
      revalidate: '/admin/expireds',
      source: 'expired-outreach',
    }
  }
  const sb = createServiceClient()
  const { data: f } = await sb
    .from('fsbo_listings')
    .select('fsbo_url, street_address, city, postal_code, owner_name, contact_phone, contact_email, enrichment_notes, status, fub_person_id, outreach_crm_person_id, outreach_sms_sent_at')
    .eq('fsbo_url', id)
    .maybeSingle()
  if (!f?.street_address) return null
  return {
    id: String(f.fsbo_url),
    streetAddress: String(f.street_address),
    city: (f.city as string | null) ?? null,
    postalCode: (f.postal_code as string | null) ?? null,
    ownerName: (f.owner_name as string | null) ?? null,
    phone: (f.contact_phone as string | null) ?? null,
    email: (f.contact_email as string | null) ?? null,
    hardStop: /HARD STOP|LITIGATOR/i.test(String(f.enrichment_notes ?? '')),
    relisted: false,
    gone: f.status === 'gone',
    personId: (f.outreach_crm_person_id as number | null) ?? (f.fub_person_id as number | null),
    smsSentAt: (f.outreach_sms_sent_at as string | null) ?? null,
    revalidate: '/admin/fsbos',
    source: 'fsbo-outreach',
  }
}

export interface ComposeTemplate {
  key: string
  name: string
  subject: string | null
  body: string
}

export interface DocSendContext {
  docSlug: string
  docUrl: string
  subjectAddress: string
  ownerName: string | null
  email: string | null
  phone: string | null
  needsReview: boolean
  hardStop: boolean
  defaultEmailSubject: string
  defaultEmailBody: string
  emailTemplates: ComposeTemplate[]
  smsTemplates: ComposeTemplate[]
}

export async function prepareDocSendAction(
  kind: DocKind,
  id: string,
): Promise<{ data: DocSendContext | null; error: string | null }> {
  try {
    if (!(await requireAdmin())) return { data: null, error: 'Unauthorized' }
    const t = await loadTarget(kind, id)
    if (!t) return { data: null, error: 'Record not found' }
    const slug = slugifyAddress(t.streetAddress)
    const row = await getCmaAdminRowBySlug(slug)
    if (!row) return { data: null, error: 'No document built yet. Build it first.' }
    const bs = (row.build_summary ?? {}) as Record<string, unknown>
    const needsReview = String(bs.needs_review ?? '') === 'true' || bs.needs_review === true

    const preview = await prepareCmaSendPreview(slug)
    if (!preview.ok) return { data: null, error: preview.error }

    // Every active template of both channels, PRE-MERGED for this owner +
    // property so the dialog shows exactly what would send. Unresolved tokens
    // stay visible for the broker to fix (the send refuses them).
    const sb = createServiceClient()
    const { data: tpls } = await sb
      .from('crm_templates')
      .select('key, channel, name, subject, body')
      .eq('is_active', true)
      .in('channel', ['sms', 'email'])
      .order('name')
    const personLike = {
      name: t.ownerName,
      custom: { cmaLink: preview.docUrl },
    } as unknown as MergePersonLike
    const ctx = await buildMergeContext({ person: undefined, senderSlug: 'matt' })
    ctx.property = { ...(ctx.property ?? {}), address: t.streetAddress }
    const emailTemplates: ComposeTemplate[] = []
    const smsTemplates: ComposeTemplate[] = []
    for (const tpl of tpls ?? []) {
      const merged: ComposeTemplate = {
        key: String(tpl.key),
        name: String(tpl.name ?? tpl.key),
        subject: tpl.subject ? renderCrmMerge(String(tpl.subject), personLike, ctx) : null,
        body: renderCrmMerge(String(tpl.body ?? ''), personLike, ctx),
      }
      if (tpl.channel === 'email') emailTemplates.push(merged)
      else smsTemplates.push(merged)
    }

    return {
      data: {
        docSlug: slug,
        docUrl: preview.docUrl,
        subjectAddress: preview.subjectAddress,
        ownerName: t.ownerName,
        email: t.email,
        phone: t.phone,
        needsReview,
        hardStop: t.hardStop,
        defaultEmailSubject: preview.subject,
        defaultEmailBody: preview.bodyText,
        emailTemplates,
        smsTemplates,
      },
      error: null,
    }
  } catch (err) {
    console.error('[prepareDocSendAction]', err)
    return { data: null, error: 'Could not prepare the send.' }
  }
}

export async function sendDocEmailAction(
  kind: DocKind,
  id: string,
  input: { subject: string; body: string; acknowledgeReview?: boolean },
): Promise<{ data: { transport: string } | null; error: string | null }> {
  try {
    if (!(await requireAdmin())) return { data: null, error: 'Unauthorized' }
    const t = await loadTarget(kind, id)
    if (!t) return { data: null, error: 'Record not found' }
    if (t.hardStop) return { data: null, error: 'Hard-stop contact. Do not contact.' }
    if (t.relisted) return { data: null, error: 'This property is back on the market. No outreach.' }
    if (t.gone) return { data: null, error: 'This FSBO has come off the market.' }
    if (!t.email) return { data: null, error: 'No owner email on file.' }
    const body = input.body?.trim()
    if (!body) return { data: null, error: 'The message is empty.' }
    const unresolved = findUnresolvedMergeTokens(body + ' ' + (input.subject ?? ''))
    if (unresolved.length > 0) return { data: null, error: `Send refused. Unresolved merge tokens: ${unresolved.join(', ')}.` }

    const slug = slugifyAddress(t.streetAddress)
    const row = await getCmaAdminRowBySlug(slug)
    if (!row) return { data: null, error: 'No document built yet. Build it first.' }
    const bs = (row.build_summary ?? {}) as Record<string, unknown>
    const needsReview = String(bs.needs_review ?? '') === 'true' || bs.needs_review === true
    if (needsReview && !input.acknowledgeReview) {
      return { data: null, error: 'This document is flagged for review. Confirm the acknowledgment to send.' }
    }
    if (!(row.client_email as string | null)?.trim()) {
      await updateCmaRowFieldsBySlug(slug, { client_email: t.email.toLowerCase() })
    }
    if (String(row.status ?? '') === 'draft') {
      const fin = await updateCmaRowFieldsBySlug(slug, { status: 'finalized', finalized_at: new Date().toISOString() })
      if (!fin.ok) return { data: null, error: fin.error ?? 'Approve failed' }
    }
    const sent = await sendCmaToLead(slug, { subject: input.subject, bodyText: body })
    if (!sent.ok) return { data: null, error: sent.error ?? 'Send failed' }
    revalidatePath(t.revalidate)
    return { data: { transport: sent.transport ?? 'gmail' }, error: null }
  } catch (err) {
    console.error('[sendDocEmailAction]', err)
    return { data: null, error: 'Send failed unexpectedly' }
  }
}

export async function sendDocSmsAction(
  kind: DocKind,
  id: string,
  input: { body: string },
): Promise<{ data: { sid: string } | null; error: string | null }> {
  try {
    if (!(await requireAdmin())) return { data: null, error: 'Unauthorized' }
    const t = await loadTarget(kind, id)
    if (!t) return { data: null, error: 'Record not found' }
    if (t.hardStop) return { data: null, error: 'Hard-stop contact (litigator / TCPA / deceased flag). Do not text.' }
    if (t.relisted) return { data: null, error: 'This property is back on the market. No outreach.' }
    if (t.gone) return { data: null, error: 'This FSBO has come off the market.' }
    if (!t.phone) return { data: null, error: 'No owner phone on file.' }
    if (inSmsQuietHours()) return { data: null, error: 'TCPA quiet hours (before 8am or after 9pm Pacific). Try later.' }
    const body = input.body?.trim()
    if (!body) return { data: null, error: 'The message is empty.' }
    const unresolved = findUnresolvedMergeTokens(body)
    if (unresolved.length > 0) return { data: null, error: `Send refused. Unresolved merge tokens: ${unresolved.join(', ')}.` }
    const to = toE164(t.phone)
    if (!to) return { data: null, error: 'Owner phone did not normalize to E.164.' }

    const lead = await ensureNativeLead({
      name: t.ownerName ?? `Owner of ${t.streetAddress}`,
      email: t.email,
      phone: t.phone,
      source: t.source,
      assignedBroker: 'matt',
    })
    if (!(lead.personId > 0)) return { data: null, error: 'Could not create the CRM contact.' }
    const sup = await isSuppressed(lead.personId, 'sms')
    if (sup.suppressed) return { data: null, error: `This contact has opted out of texting (${sup.reasons.join(', ')}).` }

    const { instrumentSmsLinks } = await import('@/lib/data/crm/shortLinks')
    const tracked = await instrumentSmsLinks(body, { personId: lead.personId, broker: 'matt' }).catch(() => body)
    const sent = await sendSmsViaMessagingService({ to, body: tracked })
    if (!sent.ok) return { data: null, error: sent.error }

    const sb = createServiceClient()
    await sb.from('crm_timeline').insert({
      person_id: lead.personId,
      kind: 'sms_out',
      title: kind === 'expired' ? 'Expired outreach SMS (composed)' : 'FSBO outreach SMS (composed)',
      body: tracked,
      payload: { [kind === 'expired' ? 'listing_key' : 'fsbo_url']: t.id, sid: sent.sid, queue: `${kind}-compose` },
      broker: 'matt',
      source: 'app',
    })
    // Stamp the first outreach send (repeat composed sends keep the original stamp).
    if (!t.smsSentAt) {
      if (kind === 'expired') {
        const { markExpiredOutreachSent } = await import('@/lib/data/expired/outreach')
        await markExpiredOutreachSent({ listingKey: t.id, crmPersonId: lead.personId, smsSid: sent.sid })
      } else {
        await sb
          .from('fsbo_listings')
          .update({ outreach_sms_sent_at: new Date().toISOString(), outreach_sms_sid: sent.sid, outreach_crm_person_id: lead.personId })
          .eq('fsbo_url', t.id)
      }
    }
    revalidatePath(t.revalidate)
    return { data: { sid: sent.sid }, error: null }
  } catch (err) {
    console.error('[sendDocSmsAction]', err)
    return { data: null, error: 'Send failed unexpectedly' }
  }
}
