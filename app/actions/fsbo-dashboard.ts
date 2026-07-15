'use server'

/**
 * FSBO Dashboard actions — build the CMA, approve+send it by email, and send
 * the initial-contact SMS, each an explicit admin click with fail-closed
 * guards (mirrors the expireds dashboard + intro-SMS posture).
 */

import { revalidatePath } from 'next/cache'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { createServiceClient } from '@/lib/supabase/service'
import { buildCma } from '@/lib/cma/build'
import { sendCmaToLead } from '@/lib/cma/send'
import { getCmaAdminRowBySlug } from '@/lib/data/cma/documents'
import { updateCmaRowFieldsBySlug } from '@/lib/data'
import { slugifyAddress } from '@/lib/cma/address-slug'
import { ensureNativeLead } from '@/lib/data/crm/ensureNativeLead'
import { isSuppressed } from '@/lib/crm/suppressions'
import { inSmsQuietHours } from '@/lib/crm/quiet-hours'
import { renderCrmMerge, findUnresolvedMergeTokens, type MergePersonLike } from '@/lib/crm/merge'
import { buildMergeContext } from '@/lib/crm/merge-context'
import { sendSmsViaMessagingService, toE164 } from '@/lib/crm/twilio'

const SMS_TEMPLATE_KEY = 'fsbo-first-touch-v1'

async function requireAdmin(): Promise<boolean> {
  const session = await getSession()
  const role = await getAdminRoleForEmail(session?.user?.email ?? null)
  return Boolean(role && role.role !== 'report_viewer')
}

type FsboRow = {
  fsbo_url: string
  street_address: string | null
  city: string | null
  postal_code: string | null
  owner_name: string | null
  contact_phone: string | null
  contact_email: string | null
  enrichment_notes: string | null
  status: string | null
  fub_person_id: number | null
  outreach_crm_person_id: number | null
  outreach_sms_sent_at: string | null
}

async function getFsboRow(fsboUrl: string): Promise<FsboRow | null> {
  const sb = createServiceClient()
  const { data } = await sb
    .from('fsbo_listings')
    .select('fsbo_url, street_address, city, postal_code, owner_name, contact_phone, contact_email, enrichment_notes, status, fub_person_id, outreach_crm_person_id, outreach_sms_sent_at')
    .eq('fsbo_url', fsboUrl)
    .maybeSingle()
  return (data as FsboRow | null) ?? null
}

export async function buildFsboCmaAction(fsboUrl: string): Promise<{ data: { slug: string } | null; error: string | null }> {
  try {
    if (!(await requireAdmin())) return { data: null, error: 'Unauthorized' }
    const f = await getFsboRow(fsboUrl)
    if (!f) return { data: null, error: 'FSBO listing not found' }
    if (!f.street_address) return { data: null, error: 'No street address on the FSBO record' }
    const slug = slugifyAddress(f.street_address)
    const res = await buildCma({
      slug,
      rawAddress: f.street_address,
      city: f.city,
      postalCode: f.postal_code,
      client: { name: f.owner_name, email: f.contact_email, phone: f.contact_phone, notes: 'FSBO CMA (dashboard build)' },
      requestSource: 'fsbo-dashboard',
    })
    if (!res.ok) return { data: null, error: res.error ?? 'CMA build failed' }
    revalidatePath('/admin/fsbos')
    return { data: { slug }, error: null }
  } catch (err) {
    console.error('[buildFsboCmaAction]', err)
    return { data: null, error: 'CMA build failed unexpectedly' }
  }
}

export async function sendFsboCmaEmailAction(
  fsboUrl: string,
  opts: { acknowledgeReview?: boolean } = {},
): Promise<{ data: { transport: string } | null; error: string | null }> {
  try {
    if (!(await requireAdmin())) return { data: null, error: 'Unauthorized' }
    const f = await getFsboRow(fsboUrl)
    if (!f) return { data: null, error: 'FSBO listing not found' }
    if (/HARD STOP|LITIGATOR/i.test(String(f.enrichment_notes ?? ''))) {
      return { data: null, error: 'Hard-stop contact. Do not contact.' }
    }
    if (f.status === 'gone') return { data: null, error: 'This FSBO has come off the market.' }
    if (!f.contact_email) return { data: null, error: 'No owner email on file.' }
    if (!f.street_address) return { data: null, error: 'No street address on the FSBO record' }

    const slug = slugifyAddress(f.street_address)
    const row = await getCmaAdminRowBySlug(slug)
    if (!row) return { data: null, error: 'No CMA built yet. Build it first.' }
    const bs = (row.build_summary ?? {}) as Record<string, unknown>
    const needsReview = String(bs.needs_review ?? '') === 'true' || bs.needs_review === true
    if (needsReview && !opts.acknowledgeReview) {
      return { data: null, error: 'This CMA is flagged for review. Open it, review the flags, then confirm the acknowledgment to send.' }
    }
    if (!(row.client_email as string | null)?.trim()) {
      await updateCmaRowFieldsBySlug(slug, { client_email: f.contact_email.toLowerCase() })
    }
    if (String(row.status ?? '') === 'draft') {
      const fin = await updateCmaRowFieldsBySlug(slug, { status: 'finalized', finalized_at: new Date().toISOString() })
      if (!fin.ok) return { data: null, error: fin.error ?? 'Approve failed' }
    }
    const sent = await sendCmaToLead(slug)
    if (!sent.ok) return { data: null, error: sent.error ?? 'Send failed' }
    revalidatePath('/admin/fsbos')
    return { data: { transport: sent.transport ?? 'gmail' }, error: null }
  } catch (err) {
    console.error('[sendFsboCmaEmailAction]', err)
    return { data: null, error: 'Send failed unexpectedly' }
  }
}

export type FsboSmsResult = { ok: true; sid: string } | { ok: false; error: string }

/** Initial-contact SMS — every guard re-runs at send, fail-closed. */
export async function sendFsboIntroSmsAction(fsboUrl: string): Promise<FsboSmsResult> {
  try {
    if (!(await requireAdmin())) return { ok: false, error: 'Unauthorized' }
    const sb = createServiceClient()
    const f = await getFsboRow(fsboUrl)
    if (!f) return { ok: false, error: 'FSBO listing not found.' }
    if (/HARD STOP|LITIGATOR/i.test(String(f.enrichment_notes ?? ''))) {
      return { ok: false, error: 'Hard-stop contact (litigator / TCPA / deceased flag). Do not text.' }
    }
    if (f.status === 'gone') return { ok: false, error: 'This FSBO has come off the market.' }
    if (f.outreach_sms_sent_at) return { ok: false, error: 'Intro text already sent to this owner.' }
    if (!f.contact_phone) return { ok: false, error: 'No owner phone on file.' }
    if (inSmsQuietHours()) return { ok: false, error: 'TCPA quiet hours (before 8am or after 9pm Pacific). Try later.' }
    const to = toE164(f.contact_phone)
    if (!to) return { ok: false, error: 'Owner phone did not normalize to E.164.' }

    // Native lead (created on first send if the cron skipped it).
    const lead = await ensureNativeLead({
      name: f.owner_name ?? `Owner of ${f.street_address}`,
      email: f.contact_email,
      phone: f.contact_phone,
      source: 'fsbo-outreach',
      assignedBroker: 'matt',
    })
    if (!(lead.personId > 0)) return { ok: false, error: 'Could not create the CRM contact.' }
    const sup = await isSuppressed(lead.personId, 'sms')
    if (sup.suppressed) return { ok: false, error: `This contact has opted out of texting (${sup.reasons.join(', ')}).` }

    const { data: tpl } = await sb
      .from('crm_templates')
      .select('body')
      .eq('key', SMS_TEMPLATE_KEY)
      .eq('channel', 'sms')
      .eq('is_active', true)
      .maybeSingle()
    if (!tpl?.body) {
      return { ok: false, error: `SMS template ${SMS_TEMPLATE_KEY} is not active yet. Approve the template wording first.` }
    }
    const { data: personRow } = await sb
      .from('crm_people')
      .select('name, first_name, last_name, stage, source, emails, phones, addresses, custom')
      .eq('id', lead.personId)
      .maybeSingle()
    const ctx = await buildMergeContext({ person: undefined, senderSlug: 'matt' })
    ctx.property = { ...(ctx.property ?? {}), address: f.street_address ?? '' }
    const merged = renderCrmMerge(String(tpl.body), (personRow ?? {}) as MergePersonLike, ctx)
    const unresolved = findUnresolvedMergeTokens(merged)
    if (unresolved.length > 0) {
      return { ok: false, error: `Send refused. Unresolved merge tokens: ${unresolved.join(', ')}.` }
    }
    const { instrumentSmsLinks } = await import('@/lib/data/crm/shortLinks')
    const body = await instrumentSmsLinks(merged, { personId: lead.personId, broker: 'matt' }).catch(() => merged)

    const sent = await sendSmsViaMessagingService({ to, body })
    if (!sent.ok) return { ok: false, error: sent.error }
    await sb.from('crm_timeline').insert({
      person_id: lead.personId,
      kind: 'sms_out',
      title: 'FSBO outreach intro SMS',
      body,
      payload: { fsbo_url: f.fsbo_url, template_key: SMS_TEMPLATE_KEY, sid: sent.sid, queue: 'fsbo-outreach' },
      broker: 'matt',
      source: 'app',
    })
    await sb
      .from('fsbo_listings')
      .update({ outreach_sms_sent_at: new Date().toISOString(), outreach_sms_sid: sent.sid, outreach_crm_person_id: lead.personId })
      .eq('fsbo_url', f.fsbo_url)
    revalidatePath('/admin/fsbos')
    return { ok: true, sid: sent.sid }
  } catch (err) {
    console.error('[sendFsboIntroSmsAction]', err)
    return { ok: false, error: 'Send failed unexpectedly.' }
  }
}
