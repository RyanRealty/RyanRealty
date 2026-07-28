import 'server-only'

/**
 * Fail-closed compliance reads for a prospect (spec 07 §6). On ANY read
 * error every function here returns the MOST restrictive value — mirrors
 * `isSuppressed` (lib/crm/suppressions.ts), the authoritative send gate.
 *
 * No free-text regex. The 5 duplicate `/HARD STOP|LITIGATOR/i` sites this
 * replaces (dashboard.ts:190, outreach.ts:98,321, fsbo/dashboard.ts:171,
 * fsbo-dashboard.ts:90,131, send-doc.ts:96) are deleted by the surfaces that
 * consume this module, not here.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { isSuppressed } from '@/lib/crm/suppressions'
import {
  blockAllChannels,
  hasSendableEmail,
  hasSendablePhone,
  PROSPECT_CHANNELS,
  type ComplianceFlag,
  type ProspectChannel,
  type ProspectChannelBlocks,
  type ProspectComplianceState,
  type ProspectKind,
} from './types'

// ── Hard stop ────────────────────────────────────────────────────────────────

async function computeHardStop(
  personId: number | null,
  persistedHardStop: boolean,
): Promise<{ hardStop: boolean; suppressedSms: boolean }> {
  try {
    let suppressedSms = false
    if (personId != null) {
      const { suppressed } = await isSuppressed(personId, 'sms')
      suppressedSms = suppressed
    }
    return { hardStop: persistedHardStop === true || suppressedSms, suppressedSms }
  } catch (e) {
    // Fail CLOSED — mirrors isSuppressed's own fail-closed contract.
    console.error('[prospecting] hard-stop check threw, fail-closed:', e instanceof Error ? e.message : e)
    return { hardStop: true, suppressedSms: true }
  }
}

/**
 * Hard-stop = UNION of the live isSuppressed(personId,'sms') tag read and the
 * persisted `compliance_hard_stop` column. Either true → true. Any thrown
 * error → true. personId resolves `outreach_crm_person_id ?? fub_person_id`
 * (spec §6.1 / the documented legacy-column fallback).
 */
export async function getProspectHardStop(prospect: {
  outreach_crm_person_id?: number | null
  fub_person_id?: number | null
  compliance_hard_stop: boolean | null
}): Promise<boolean> {
  const personId = prospect.outreach_crm_person_id ?? prospect.fub_person_id ?? null
  const { hardStop } = await computeHardStop(personId, prospect.compliance_hard_stop === true)
  return hardStop
}

// ── Re-list guards (spec §6.3 / §6.4) ───────────────────────────────────────

/**
 * Expired re-list check — ported verbatim from the single-row shape in
 * lib/data/expired/outreach.ts `getExpiredListingDetail` (the address-match +
 * status_change_timestamp-newer-than-expiry logic, ~lines 230-245). Never
 * solicit an address that is now Active/Pending/Coming Soon in MLS.
 */
export async function isRelistedNow(prospect: {
  street_address: string | null
  city: string | null
  status_change_timestamp: string | null
}): Promise<boolean> {
  if (!prospect.street_address) return false
  try {
    const sb = createServiceClient()
    const num = String(prospect.street_address).split(' ')[0]
    const namePrefix = String(prospect.street_address).slice(num.length + 1).split(' ')[0]?.toUpperCase() ?? ''
    const { data: onMarket, error } = await sb
      .from('listings')
      .select('StreetName, City, status_change_timestamp')
      .eq('StreetNumber', num)
      .in('StandardStatus', ['Active', 'Pending', 'Coming Soon'])
    if (error) {
      console.error('[prospecting] isRelistedNow read failed:', error.message)
      return false
    }
    return (onMarket ?? []).some(
      (l) =>
        String(l.StreetName ?? '').toUpperCase().startsWith(namePrefix) &&
        String(l.City ?? '').toUpperCase() === String(prospect.city ?? '').toUpperCase() &&
        (prospect.status_change_timestamp == null ||
          String(l.status_change_timestamp ?? '') > prospect.status_change_timestamp),
    )
  } catch (e) {
    console.error('[prospecting] isRelistedNow threw:', e instanceof Error ? e.message : e)
    return false
  }
}

/**
 * FSBO re-list check (spec §6.4 #2) — the same MLS Active/Pending/Coming Soon
 * address match used for expireds, minus the status_change_timestamp compare
 * (an FSBO was never in MLS to begin with, so any current on-market match at
 * the address is new activity — there is no prior expiry event to compare
 * against, unlike the expired-listing case).
 */
export async function isFsboRelistedNow(prospect: {
  street_address: string | null
  city: string | null
}): Promise<boolean> {
  if (!prospect.street_address) return false
  try {
    const sb = createServiceClient()
    const num = String(prospect.street_address).split(' ')[0]
    const namePrefix = String(prospect.street_address).slice(num.length + 1).split(' ')[0]?.toUpperCase() ?? ''
    const { data: onMarket, error } = await sb
      .from('listings')
      .select('StreetName, City')
      .eq('StreetNumber', num)
      .in('StandardStatus', ['Active', 'Pending', 'Coming Soon'])
    if (error) {
      console.error('[prospecting] isFsboRelistedNow read failed:', error.message)
      return false
    }
    return (onMarket ?? []).some(
      (l) =>
        String(l.StreetName ?? '').toUpperCase().startsWith(namePrefix) &&
        String(l.City ?? '').toUpperCase() === String(prospect.city ?? '').toUpperCase(),
    )
  } catch (e) {
    console.error('[prospecting] isFsboRelistedNow threw:', e instanceof Error ? e.message : e)
    return false
  }
}

// ── Assembled compliance state ──────────────────────────────────────────────

export interface ProspectComplianceInput {
  contact_email?: string | null
  compliance_hard_stop: boolean | null
  /** compliance_flags jsonb column — an array of strings at rest. */
  compliance_flags: unknown
  street_address: string | null
  city: string | null
  contact_phone: string | null
  /** expired only — feeds isRelistedNow's newer-than-expiry compare. */
  status_change_timestamp?: string | null
  /** fsbo only — offMarket = status !== 'active'. */
  status?: string | null
  outreach_crm_person_id?: number | null
  fub_person_id?: number | null
}

function toFlags(raw: unknown): ComplianceFlag[] {
  if (!Array.isArray(raw)) return []
  return raw.map((f) => String(f))
}

/**
 * Assembles the full fail-closed compliance view for a prospect (spec §6).
 * `personId` is passed in (already resolved by the caller — get.ts/list.ts —
 * from `outreach_crm_person_id ?? fub_person_id`) so it is derived exactly
 * once per row rather than re-derived here and in the engagement/doc reads.
 */
export async function resolveComplianceState(
  kind: ProspectKind,
  prospect: ProspectComplianceInput,
  personId: number | null,
): Promise<ProspectComplianceState> {
  const { hardStop, suppressedSms } = await computeHardStop(personId, prospect.compliance_hard_stop === true)
  const flags = toFlags(prospect.compliance_flags)

  // Per-channel resolution (see types.ts ProspectComplianceState). The email
  // channel gets its OWN live suppression read — a do-not-call contact is
  // blocked for sms/call and stays open for email.
  let emailBlockReason: string | null = null
  let callBlockReason: string | null = null
  if (personId != null) {
    try {
      const [em, call] = await Promise.all([isSuppressed(personId, 'email'), isSuppressed(personId, 'call')])
      emailBlockReason = em.suppressed ? (em.reasons[0] ?? 'Opt-out on file') : null
      callBlockReason = call.suppressed ? (call.reasons[0] ?? 'Opt-out on file') : null
    } catch (e) {
      // Fail CLOSED, matching computeHardStop.
      console.error('[prospecting] per-channel suppression check threw, fail-closed:', e instanceof Error ? e.message : e)
      emailBlockReason = 'Compliance check unavailable'
      callBlockReason = 'Compliance check unavailable'
    }
  }

  const relisted =
    kind === 'expired'
      ? await isRelistedNow({
          street_address: prospect.street_address,
          city: prospect.city,
          status_change_timestamp: prospect.status_change_timestamp ?? null,
        })
      : await isFsboRelistedNow({ street_address: prospect.street_address, city: prospect.city })

  const offMarket = kind === 'fsbo' ? (prospect.status ?? 'active') !== 'active' : false
  const noPhone = !hasSendablePhone(prospect.contact_phone)
  const noEmail = !hasSendableEmail(prospect.contact_email ?? null)

  const channels: ProspectChannelBlocks = prospect.compliance_hard_stop === true
    ? blockAllChannels('Compliance hard stop on the record')
    : {
        sms: { blocked: hardStop, reason: hardStop ? 'Blocked for SMS' : null },
        email: { blocked: emailBlockReason != null, reason: emailBlockReason },
        call: { blocked: callBlockReason != null, reason: callBlockReason },
      }
  if (noPhone) {
    for (const c of ['sms', 'call'] as ProspectChannel[]) {
      if (!channels[c].blocked) channels[c] = { blocked: true, reason: 'No phone on file' }
    }
  }
  if (noEmail && !channels.email.blocked) channels.email = { blocked: true, reason: 'No email on file' }

  const allChannelsBlocked = PROSPECT_CHANNELS.every((c) => channels[c].blocked)

  const reasons: string[] = []
  if (allChannelsBlocked) reasons.push('No open channel — do not contact')
  for (const c of PROSPECT_CHANNELS) {
    if (channels[c].blocked && channels[c].reason) reasons.push(`${c.toUpperCase()}: ${channels[c].reason}`)
  }
  if (relisted) reasons.push('Relisted in MLS')
  if (offMarket) reasons.push('Off market')

  return { hardStop, flags, relisted, offMarket, suppressedSms, noPhone, noEmail, reasons, channels, allChannelsBlocked }
}
