'use server'

/**
 * Expired-listing manual outreach — the guarded send action behind
 * /admin/expired-outreach (Matt directive 2026-07-11; reworked 2026-07-15 so
 * the first-touch message accompanies the built CMA/expired-audit instead of
 * asking permission to send one that doesn't exist yet).
 *
 * EVERY guard re-runs at send time, in order, fail-closed:
 *   1. admin auth
 *   2. CMA/audit built check — refuse until row.cma_slug exists
 *   3. re-list check (a same-address newer on-market listing = never solicit)
 *   4. hard-stop check (litigator / TCPA / deceased from skip-trace)
 *   5. already-sent check (one intro per owner, ever)
 *   6. TCPA quiet hours (8am–9pm Pacific)
 *   7. ensure a native CRM lead exists (created on first send) + suppressions
 *   8. render template expired-first-touch-sell-v1 with %address%/%cma_link%
 *      merge — refuse to send if any merge token is left unresolved
 *   9. Twilio send via the A2P messaging service, timeline log, stamp sent
 */

import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { createServiceClient } from '@/lib/supabase/service'
import { getExpiredOutreachRow, markExpiredOutreachSent } from '@/lib/data/expired/outreach'
import { slugifyAddress } from '@/lib/cma/address-slug'
import { getLatestClientReadyCmaRowForBaseSlug } from '@/lib/cma/versions'
import { ensureNativeLead, enrichNativeLead } from '@/lib/data/crm/ensureNativeLead'
import { isSuppressed } from '@/lib/crm/suppressions'
import { inSmsQuietHours } from '@/lib/crm/quiet-hours'
import { renderCrmMerge, findUnresolvedMergeTokens, type MergePersonLike } from '@/lib/crm/merge'
import { buildMergeContext } from '@/lib/crm/merge-context'
import { sendSmsViaMessagingService, toE164 } from '@/lib/crm/twilio'
import { revalidatePath } from 'next/cache'

const TEMPLATE_KEY = 'expired-first-touch-sell-v1'
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

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

    // This first-touch message accompanies the CMA/expired-audit (Matt
    // directive 2026-07-15) — it is no longer a bare permission-ask sent
    // before any analysis exists. Refuse to send until the document is built.
    if (!row.cma_slug) {
      return { ok: false, error: 'No CMA/audit built yet for this address. Build it before sending the intro text.' }
    }
    // The texted link must be a CLIENT-READY document — the public /cma route
    // 404s drafts, and the latest version for the address can be an unapproved
    // draft (a rebuild or a new intake atop a delivered document). Resolve the
    // newest finalized|delivered version; refuse if none exists yet.
    const clientReady = await getLatestClientReadyCmaRowForBaseSlug(slugifyAddress(row.street_address))
    if (!clientReady) {
      return { ok: false, error: 'The CMA/audit for this address is not approved yet. Approve it at /admin/cmas first, otherwise the texted link would 404 as a draft.' }
    }
    const docUrl = `${SITE_URL}/cma/${clientReady.slug}`

    // 3–5: the non-negotiable exclusions, re-checked at the moment of send.
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

    // 6: TCPA quiet hours.
    if (inSmsQuietHours()) {
      return { ok: false, error: 'TCPA quiet hours (before 8am / after 9pm Pacific). Try again inside the window.' }
    }

    // 7: native CRM lead (find-or-create) + suppression gate.
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

    // 8: template + merge, fail-closed on unresolved tokens.
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
    // The sent link carries _pid so the web session on the CMA stitches to
    // this contact (rr-doc-tracker identifies on _pid), plus UTMs so the click
    // is not invisible to GA4 as direct/(none). The short-linker swaps the
    // whole URL for /r/<code>, so none of this lengthens the SMS.
    const docUrlForPerson = `${docUrl}?_pid=${lead.personId}&utm_source=crm&utm_medium=sms&utm_campaign=expired`
    const personLike: MergePersonLike = {
      ...(personRow ?? {}),
      custom: { ...((personRow?.custom as Record<string, unknown> | null) ?? {}), cmaLink: docUrlForPerson },
    }
    const merged = renderCrmMerge(String(tpl.body), personLike, ctx)
    const unresolved = findUnresolvedMergeTokens(merged)
    if (unresolved.length > 0) {
      return { ok: false, error: `Send refused. Unresolved merge tokens: ${unresolved.join(', ')}.` }
    }
    // Short-link every URL so clicks land in crm_timeline as sms_click. The
    // dashboard's SMS-engagement column reads from there. Fail-open: on error
    // the original body sends untracked.
    const { instrumentSmsLinks } = await import('@/lib/data/crm/shortLinks')
    const body = await instrumentSmsLinks(merged, { personId: lead.personId, broker: 'matt' }).catch(() => merged)

    // 9: send + log + stamp.
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
    if (!row.cma_slug) return { body: null, error: 'No CMA/audit built yet for this address. Build it before previewing the intro text.' }
    // Same client-ready resolution as the send — the preview must show the
    // link that would actually send.
    const clientReady = await getLatestClientReadyCmaRowForBaseSlug(slugifyAddress(row.street_address))
    if (!clientReady) {
      return { body: null, error: 'The CMA/audit for this address is not approved yet. Approve it at /admin/cmas first.' }
    }
    const docUrl = `${SITE_URL}/cma/${clientReady.slug}`
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
    return { body: renderCrmMerge(String(tpl.body), { custom: { cmaLink: docUrl } }, ctx), error: null }
  } catch {
    return { body: null, error: 'Preview failed' }
  }
}
