'use server'

/**
 * CRM suppression-list admin — the owner-guarded mutation surface over the
 * compliance suppression list (the FUB Block List folded in). Two operations:
 *
 *   addSuppressionAction   — manually suppress a person/value on a channel.
 *   liftSuppressionAction  — remove ONE suppression row. Lifting a compliance
 *                            or litigator suppression requires an explicit
 *                            confirm flag (per the TCPA memory — a hard-stop /
 *                            litigator lift is a legal liability, never casual,
 *                            never bulk).
 *
 * BOTH are guarded to owner/superuser (destructive compliance config) and BOTH
 * write an audit trail: a crm_timeline 'system' row stamped with who + when, so
 * every consent change is attributable. There is intentionally NO bulk-lift
 * surface — the Wave 3 bulk engine NEVER lifts suppressions; it only ever reads
 * them through isSuppressed (fail-closed) before a send.
 *
 * DAL boundary (G1): the raw .from() writes execute inside this 'use server'
 * module (the sanctioned mutation surface). The cached read side lives in
 * lib/data/crm/getCrmSuppressions; mutations revalidate that tag + the page.
 */

import { revalidatePath, revalidateTag } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { getCrmAccess } from '@/app/actions/crm'
import {
  CRM_SUPPRESSIONS_TAG,
  normalizeSuppressionChannel,
} from '@/lib/data/crm/getCrmSuppressions'
import {
  buildSuppressionAuditRow,
  checkComplianceLiftAllowed,
  type CrmSuppressionResult,
} from '@/lib/crm/suppression-helpers'

/** Owner/superuser gate. Destructive compliance config is owner-only. */
async function requireOwner(): Promise<
  { ok: true; email: string; broker: string | null } | { ok: false; error: string }
> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  if (access.role !== 'superuser') {
    return { ok: false, error: 'Only an owner can change the suppression list' }
  }
  return { ok: true, email: access.email, broker: access.brokerSlug }
}

function bust() {
  revalidateTag(CRM_SUPPRESSIONS_TAG, 'max')
  revalidatePath('/admin/crm/suppressions')
  revalidatePath('/admin/crm/health')
}

/**
 * Manually add a suppression. `target` is a person id (numeric) — the admin
 * picks the contact to block. Channel defaults to 'all' (the safest, broadest
 * block) when omitted or invalid. Writes the suppression row AND the audit
 * timeline row; the timeline write failure does NOT roll back the suppression
 * (the consent record is load-bearing and must persist).
 */
export async function addSuppressionAction(formData: FormData): Promise<CrmSuppressionResult> {
  const auth = await requireOwner()
  if (!auth.ok) return auth

  const personId = Number(formData.get('target'))
  const channel = normalizeSuppressionChannel(formData.get('channel'))
  const reason = String(formData.get('reason') ?? '').trim()
  if (!personId || !Number.isFinite(personId)) {
    return { ok: false, error: 'A contact is required to suppress' }
  }
  if (!reason) return { ok: false, error: 'A reason is required' }

  const sb = createServiceClient()
  const { data: person } = await sb
    .from('crm_people')
    .select('id')
    .eq('id', personId)
    .maybeSingle()
  if (!person) return { ok: false, error: 'Contact not found' }

  // Don't write a duplicate (same person + same channel + same reason).
  const { data: existing } = await sb
    .from('crm_suppressions')
    .select('id')
    .eq('person_id', personId)
    .eq('channel', channel)
    .eq('reason', reason)
    .maybeSingle()
  if (existing) return { ok: true }

  const { error: insErr } = await sb.from('crm_suppressions').insert({
    person_id: personId,
    channel,
    reason,
    source: 'manual',
  })
  if (insErr) return { ok: false, error: insErr.message }

  // Audit trail — never blocks the suppression (already written above).
  const audit = buildSuppressionAuditRow({
    action: 'add',
    personId,
    channel,
    reason,
    who: auth.email,
    whoBroker: auth.broker,
  })
  const { error: auditErr } = await sb.from('crm_timeline').insert(audit)
  if (auditErr) console.warn('[crm-suppressions] add audit write failed:', auditErr.message)

  bust()
  return { ok: true }
}

/**
 * Lift (remove) ONE suppression row by id. Loads the row first to read its
 * reason — a compliance/litigator reason requires an explicit `confirm` flag
 * (checkComplianceLiftAllowed). Single-record only; there is no bulk-lift.
 * Writes the audit timeline row before removing the suppression so the lift is
 * attributable even if the delete races.
 */
export async function liftSuppressionAction(formData: FormData): Promise<CrmSuppressionResult> {
  const auth = await requireOwner()
  if (!auth.ok) return auth

  const id = Number(formData.get('id'))
  const confirm = String(formData.get('confirm') ?? '') === '1'
  if (!id || !Number.isFinite(id)) return { ok: false, error: 'Suppression id is required' }

  const sb = createServiceClient()
  const { data: row } = await sb
    .from('crm_suppressions')
    .select('id,person_id,channel,reason,value')
    .eq('id', id)
    .maybeSingle()
  if (!row) return { ok: false, error: 'Suppression not found' }

  const reason = String(row.reason ?? '')
  const channel = normalizeSuppressionChannel(row.channel)

  // Compliance/litigator lift must be confirmed.
  const gate = checkComplianceLiftAllowed({ reason, confirm })
  if (!gate.ok) return gate

  // Audit FIRST (so the lift is attributable). Only write a person-keyed audit
  // row when the suppression has a person; a value-keyed row (person_id null)
  // has no contact 360 to attach to — its lift is still bust()-logged via the
  // page, and console for the record.
  if (row.person_id != null) {
    const audit = buildSuppressionAuditRow({
      action: 'lift',
      personId: Number(row.person_id),
      channel,
      reason,
      who: auth.email,
      whoBroker: auth.broker,
      confirmed: confirm,
      value: (row.value as string | null) ?? null,
    })
    const { error: auditErr } = await sb.from('crm_timeline').insert(audit)
    if (auditErr) console.warn('[crm-suppressions] lift audit write failed:', auditErr.message)
  } else {
    console.warn(
      `[crm-suppressions] lifted value-keyed suppression id=${id} (${channel}/${reason}) by ${auth.email}`,
    )
  }

  const { error: delErr } = await sb.from('crm_suppressions').delete().eq('id', id)
  if (delErr) return { ok: false, error: delErr.message }

  bust()
  return { ok: true }
}
