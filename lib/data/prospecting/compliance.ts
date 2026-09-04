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
import { isClosedStatus } from '@/lib/listing-status'
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

/** On-market statuses the existing expired-outreach probe already used. */
export const EXPIRED_OUTREACH_ON_MARKET = ['Active', 'Pending', 'Coming Soon'] as const

/**
 * Same listings probe as the original relist check, plus Closed so a
 * post-expire sale at the address (or parcel) paints as relisted.
 * PostgREST `or` — Coming Soon needs quotes (space in the value).
 */
export const EXPIRED_OUTREACH_STATUS_OR =
  'StandardStatus.in.(Active,Pending,"Coming Soon"),StandardStatus.ilike.*Closed*'

export const EXPIRED_OUTREACH_LISTING_SELECT =
  'StreetNumber, StreetName, City, status_change_timestamp, StandardStatus, CloseDate, parcel_number'

/** Junk APN values the listings column sometimes carries — not a real taxlot. */
export function normalizeParcelNumber(raw: unknown): string | null {
  const v = String(raw ?? '').trim()
  if (!v) return null
  if (/^(n\/?a\.?|none|tbd|null|unknown|0+|-+|\.+)$/i.test(v)) return null
  return v
}

export type ExpiredOutreachListing = {
  StreetNumber?: unknown
  StreetName?: unknown
  City?: unknown
  StandardStatus?: unknown
  CloseDate?: unknown
  status_change_timestamp?: unknown
  parcel_number?: unknown
}

/**
 * One listing hits the existing expired-outreach block: same street number
 * (caller-scoped) + first word of StreetName + City, OR the same
 * parcel_number when both sides have one. On-market after expiryComparator
 * is the original relist. Closed with CloseDate (else status_change_timestamp)
 * after expiryComparator is the sold-after-expire extend — still `relisted`.
 */
/**
 * Prefer a real APN when present. Owner-lookup writes
 * `taxlot <APN>` into enrichment_notes for FSBOs (no listing_key → no
 * listings.parcel_number anchor), so scrape that when the column is absent.
 */
export function parcelFromEnrichmentNotes(notes: string | null | undefined): string | null {
  if (!notes) return null
  // Owner-lookup writes `taxlot <APN>` — require a digit so plain English
  // after the word "taxlot" is not treated as a parcel.
  const m = String(notes).match(/\btaxlot\s+([A-Za-z0-9_-]*\d[A-Za-z0-9_-]*)/i)
  return m ? normalizeParcelNumber(m[1]) : null
}

export function expiredOutreachListingHits(opts: {
  kind: ProspectKind
  listing: ExpiredOutreachListing
  namePrefix: string
  cityUpper: string
  expiryComparator: string | null
  subjectParcel: string | null
}): boolean {
  const streetName = String(opts.listing.StreetName ?? '').toUpperCase()
  const city = String(opts.listing.City ?? '').toUpperCase()
  const addressMatch = streetName.startsWith(opts.namePrefix) && city === opts.cityUpper
  const listingParcel = normalizeParcelNumber(opts.listing.parcel_number)
  const parcelMatch = Boolean(opts.subjectParcel && listingParcel && opts.subjectParcel === listingParcel)
  if (!addressMatch && !parcelMatch) return false

  const status = (opts.listing.StandardStatus as string | null) ?? null
  // Active / Pending / Coming Soon at the address or parcel — block for both
  // kinds. Expired still requires the on-market event to be newer than expire
  // when a comparator is present; FSBO was never in MLS, so any current
  // on-market match is new brokerage activity and hard-skips.
  if ((EXPIRED_OUTREACH_ON_MARKET as readonly string[]).includes(String(status ?? ''))) {
    if (opts.kind === 'fsbo') return true
    return opts.expiryComparator == null || String(opts.listing.status_change_timestamp ?? '') > opts.expiryComparator
  }

  // Closed after expire (expired) OR after FSBO detect (fsbo) — same hard-skip.
  if (!isClosedStatus(status) || opts.expiryComparator == null) return false
  const soldAt = String(opts.listing.CloseDate ?? opts.listing.status_change_timestamp ?? '')
  return soldAt !== '' && soldAt > opts.expiryComparator
}

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
 * Expired re-list check — same StreetNumber + first-word StreetName + City
 * probe as before, now also Closed after `status_change_timestamp` (sold
 * after expire) and parcel_number when the original listing carries one.
 * Fail-open on read error (worklist paint). The send path re-runs this
 * decision fail-closed via `verifyNotRelisted`.
 */
export async function isRelistedNow(prospect: {
  street_address: string | null
  city: string | null
  status_change_timestamp: string | null
  listing_key?: string | null
}): Promise<boolean> {
  if (!prospect.street_address) return false
  try {
    const sb = createServiceClient()
    const num = String(prospect.street_address).split(' ')[0]
    const namePrefix = String(prospect.street_address).slice(num.length + 1).split(' ')[0]?.toUpperCase() ?? ''
    const cityUpper = String(prospect.city ?? '').toUpperCase()
    let subjectParcel: string | null = null
    if (prospect.listing_key) {
      const { data: anchor, error: anchorErr } = await sb
        .from('listings')
        .select('parcel_number')
        .eq('ListingKey', prospect.listing_key) // @canonical-key prospect.listing_key is the RETS key
        .maybeSingle()
      if (anchorErr) {
        console.error('[prospecting] isRelistedNow parcel read failed:', anchorErr.message)
      } else {
        subjectParcel = normalizeParcelNumber(anchor?.parcel_number)
      }
    }
    const streetQ = sb
      .from('listings')
      .select(EXPIRED_OUTREACH_LISTING_SELECT)
      .eq('StreetNumber', num)
      .or(EXPIRED_OUTREACH_STATUS_OR)
    const parcelQ = subjectParcel
      ? sb
          .from('listings')
          .select(EXPIRED_OUTREACH_LISTING_SELECT)
          .eq('parcel_number', subjectParcel)
          .or(EXPIRED_OUTREACH_STATUS_OR)
      : Promise.resolve({ data: [] as ExpiredOutreachListing[], error: null })
    const [streetRes, parcelRes] = await Promise.all([streetQ, parcelQ])
    if (streetRes.error) {
      console.error('[prospecting] isRelistedNow read failed:', streetRes.error.message)
      return false
    }
    if (parcelRes.error) {
      console.error('[prospecting] isRelistedNow parcel probe failed:', parcelRes.error.message)
    }
    const rows = [
      ...((streetRes.data ?? []) as ExpiredOutreachListing[]),
      ...((parcelRes.data ?? []) as ExpiredOutreachListing[]),
    ]
    return rows.some((l) =>
      expiredOutreachListingHits({
        kind: 'expired',
        listing: l,
        namePrefix,
        cityUpper,
        expiryComparator: prospect.status_change_timestamp,
        subjectParcel,
      }),
    )
  } catch (e) {
    console.error('[prospecting] isRelistedNow threw:', e instanceof Error ? e.message : e)
    return false
  }
}

/**
 * FSBO live-status hard-skip (Matt 2026-09-03) — same paint as expired:
 * Active/Pending/Coming Soon at the address OR parcel, OR Closed since
 * `detected_at` (CloseDate else status_change_timestamp > detect comparator).
 * Prefer `parcel_number` when present; else scrape taxlot from enrichment_notes.
 * Fail-open on read error (worklist). Send re-runs fail-closed via verifyNotRelisted.
 */
export async function isFsboRelistedNow(prospect: {
  street_address: string | null
  city: string | null
  detected_at?: string | null
  parcel_number?: string | null
  enrichment_notes?: string | null
}): Promise<boolean> {
  if (!prospect.street_address) return false
  try {
    const sb = createServiceClient()
    const num = String(prospect.street_address).split(' ')[0]
    const namePrefix = String(prospect.street_address).slice(num.length + 1).split(' ')[0]?.toUpperCase() ?? ''
    const cityUpper = String(prospect.city ?? '').toUpperCase()
    const subjectParcel =
      normalizeParcelNumber(prospect.parcel_number) ??
      parcelFromEnrichmentNotes(prospect.enrichment_notes)
    const streetQ = sb
      .from('listings')
      .select(EXPIRED_OUTREACH_LISTING_SELECT)
      .eq('StreetNumber', num)
      .or(EXPIRED_OUTREACH_STATUS_OR)
    const parcelQ = subjectParcel
      ? sb
          .from('listings')
          .select(EXPIRED_OUTREACH_LISTING_SELECT)
          .eq('parcel_number', subjectParcel)
          .or(EXPIRED_OUTREACH_STATUS_OR)
      : Promise.resolve({ data: [] as ExpiredOutreachListing[], error: null })
    const [streetRes, parcelRes] = await Promise.all([streetQ, parcelQ])
    if (streetRes.error) {
      console.error('[prospecting] isFsboRelistedNow read failed:', streetRes.error.message)
      return false
    }
    if (parcelRes.error) {
      console.error('[prospecting] isFsboRelistedNow parcel probe failed:', parcelRes.error.message)
    }
    const rows = [
      ...((streetRes.data ?? []) as ExpiredOutreachListing[]),
      ...((parcelRes.data ?? []) as ExpiredOutreachListing[]),
    ]
    return rows.some((l) =>
      expiredOutreachListingHits({
        kind: 'fsbo',
        listing: l,
        namePrefix,
        cityUpper,
        expiryComparator: prospect.detected_at ?? null,
        subjectParcel,
      }),
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
  /** expired only — resolves listings.parcel_number for same-taxlot hits. */
  listing_key?: string | null
  /** fsbo only — Closed-after-detect comparator (detected_at). */
  detected_at?: string | null
  /** Prefer when present — same-taxlot MLS hit without relying on street spelling. */
  parcel_number?: string | null
  /** fsbo — taxlot scraped from owner-lookup enrichment_notes when no parcel column. */
  enrichment_notes?: string | null
  /** fsbo only — offMarket = status !== 'active' (no longer FSBO). */
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
          listing_key: prospect.listing_key ?? null,
        })
      : await isFsboRelistedNow({
          street_address: prospect.street_address,
          city: prospect.city,
          detected_at: prospect.detected_at ?? null,
          parcel_number: prospect.parcel_number ?? null,
          enrichment_notes: prospect.enrichment_notes ?? null,
        })

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
