'use server'

/**
 * Expired-listing manual outreach — the guarded send action behind
 * /admin/expired-outreach (Matt directive 2026-07-11).
 *
 * EVERY guard re-runs at send time, in order, fail-closed:
 *   1. admin auth
 *   2. re-list check (a same-address newer on-market listing = never solicit)
 *   3. hard-stop check (litigator / TCPA / deceased from skip-trace)
 *   4. already-sent check (one intro per owner, ever)
 *   5. TCPA quiet hours (8am–9pm Pacific)
 *   6. ensure a native CRM lead exists (created on first send) + suppressions
 *   7. render template expired-first-touch-sell-v1 with %address% merge —
 *      refuse to send if any merge token is left unresolved
 *   8. Twilio send via the A2P messaging service, timeline log, stamp sent
 */

import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { createServiceClient } from '@/lib/supabase/service'
import { getExpiredOutreachRow, markExpiredOutreachSent } from '@/lib/data/expired/outreach'
import { ensureNativeLead, enrichNativeLead } from '@/lib/data/crm/ensureNativeLead'
import { isSuppressed } from '@/lib/crm/suppressions'
import { inSmsQuietHours } from '@/lib/crm/quiet-hours'
import { renderCrmMerge, findUnresolvedMergeTokens, type MergePersonLike } from '@/lib/crm/merge'
import { buildMergeContext } from '@/lib/crm/merge-context'
import { sendSmsViaMessagingService, toE164 } from '@/lib/crm/twilio'
import { revalidatePath } from 'next/cache'

const TEMPLATE_KEY = 'expired-first-touch-sell-v1'

async function requireAdmin(): Promise<boolean> {
  const session = await getSession()
  const role = await getAdminRoleForEmail(session?.user?.email ?? null)
  return Boolean(role && role.role !== 'report_viewer')
}

export type ExpiredSendResult = { ok: true; sid: string } | { ok: false; error: string }

export async function sendExpiredIntroAction(listingKey: string): Promise<ExpiredSendResult> {
  try {
    if (!(await requireAdmin())) return { ok: false, error: 'Unauthorized' }
    const row = await getExpiredOutreachRow(listingKey.trim())
    if (!row) return { ok: false, error: 'Expired listing not found.' }

    // 2–4: the non-negotiable exclusions, re-checked at the moment of send.
    if (row.relisted) {
      return { ok: false, error: 'This property has re-listed (Active/Pending). Soliciting a listed property is not allowed — row excluded.' }
    }
    if (row.hard_stop) {
      return { ok: false, error: 'Hard-stop contact (litigator/TCPA/deceased flag from skip-trace). Do not text or call.' }
    }
    if (row.outreach_sms_sent_at) {
      return { ok: false, error: `Intro already sent ${row.outreach_sms_sent_at.slice(0, 10)}.` }
    }
    const to = toE164(row.contact_phone)
    if (!to) return { ok: false, error: 'No valid phone on file for this owner.' }

    // 5: TCPA quiet hours.
    if (inSmsQuietHours()) {
      return { ok: false, error: 'TCPA quiet hours (before 8am / after 9pm Pacific). Try again inside the window.' }
    }

    // 6: native CRM lead (find-or-create) + suppression gate.
    const lead = await ensureNativeLead({
      name: row.owner_name,
      phone: row.contact_phone,
      email: row.contact_email,
      source: 'expired-outreach-queue',
      tags: ['audience:seller', 'intent:expired-listing', 'source:expired-outreach-queue', 'broker:matt'],
      assignedBroker: 'matt',
    })
    const sup = await isSuppressed(lead.personId, 'sms')
    if (sup.suppressed) {
      return { ok: false, error: `Suppressed for SMS: ${sup.reasons.join(', ') || 'opt-out on file'}.` }
    }
    await enrichNativeLead({
      personId: lead.personId,
      custom: {
        customClassification: 'EXPIRED',
        customSellerPropertyAddress: `${row.street_address}, ${row.city ?? ''}`.replace(/, $/, ''),
      },
    })

    // 7: template + merge, fail-closed on unresolved tokens.
    const sb = createServiceClient()
    const { data: tpl } = await sb
      .from('crm_templates')
      .select('body')
      .eq('key', TEMPLATE_KEY)
      .eq('channel', 'sms')
      .eq('is_active', true)
      .maybeSingle()
    if (!tpl?.body) return { ok: false, error: `SMS template ${TEMPLATE_KEY} not found or inactive.` }
    const { data: personRow } = await sb
      .from('crm_people')
      .select('name, first_name, last_name, stage, source, emails, phones, addresses, custom')
      .eq('id', lead.personId)
      .maybeSingle()
    const ctx = await buildMergeContext({ person: undefined, senderSlug: 'matt' })
    ctx.property = { ...(ctx.property ?? {}), address: row.street_address }
    const body = renderCrmMerge(String(tpl.body), (personRow ?? {}) as MergePersonLike, ctx)
    const unresolved = findUnresolvedMergeTokens(body)
    if (unresolved.length > 0) {
      return { ok: false, error: `Unresolved merge tokens: ${unresolved.join(', ')} — send refused.` }
    }

    // 8: send + log + stamp.
    const sent = await sendSmsViaMessagingService({ to, body })
    if (!sent.ok) return { ok: false, error: sent.error }
    await sb.from('crm_timeline').insert({
      person_id: lead.personId,
      kind: 'sms_out',
      title: 'Expired outreach intro SMS',
      body,
      payload: { listing_key: row.listing_key, template_key: TEMPLATE_KEY, sid: sent.sid, queue: 'expired-outreach' },
      broker: 'matt',
      source: 'app',
    })
    const stamp = await markExpiredOutreachSent({ listingKey: row.listing_key, crmPersonId: lead.personId, smsSid: sent.sid })
    if (!stamp.ok) console.error('[sendExpiredIntroAction] sent but stamp failed:', stamp.error)
    revalidatePath('/admin/expired-outreach')
    return { ok: true, sid: sent.sid }
  } catch (e) {
    console.error('[sendExpiredIntroAction]', e)
    return { ok: false, error: 'Send failed unexpectedly.' }
  }
}

/** Preview the merged message for one row (no side effects). */
export async function previewExpiredIntroAction(listingKey: string): Promise<{ body: string | null; error: string | null }> {
  try {
    if (!(await requireAdmin())) return { body: null, error: 'Unauthorized' }
    const row = await getExpiredOutreachRow(listingKey.trim())
    if (!row) return { body: null, error: 'Not found' }
    const sb = createServiceClient()
    const { data: tpl } = await sb
      .from('crm_templates')
      .select('body')
      .eq('key', TEMPLATE_KEY)
      .eq('channel', 'sms')
      .eq('is_active', true)
      .maybeSingle()
    if (!tpl?.body) return { body: null, error: 'Template missing' }
    const ctx = await buildMergeContext({ senderSlug: 'matt' })
    ctx.property = { ...(ctx.property ?? {}), address: row.street_address }
    return { body: renderCrmMerge(String(tpl.body), {}, ctx), error: null }
  } catch {
    return { body: null, error: 'Preview failed' }
  }
}
