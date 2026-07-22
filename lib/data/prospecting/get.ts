import 'server-only'

/**
 * Single-prospect reads (spec 07 §7). Replaces the whole-queue recompute
 * pattern `getExpiredOutreachRow = listExpiredOutreachQueue().find()`
 * (lib/data/expired/outreach.ts:111-114, which re-reads every expired row +
 * the `listings` probe + the entire `cmas` table on every send/preview) with
 * one bounded row read + one bounded `listings` join + one bounded engagement
 * read.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { getBpoListingCyclesByAddress } from '@/lib/data/bpo/reads'
import { getProspectDripState } from './drip'
import { resolveDocsBatch, resolveComplianceBatch } from './batch'
import { getProspectEngagement, EMPTY_ENGAGEMENT, type ProspectEngagementKey } from './engagement'
import { isUndefinedColumnError, type ProspectComplianceState, type ProspectDetail, type ProspectDocState, type ProspectKind, type ProspectPriceCycle, type ProspectRow } from './types'

// Fail-closed default when the batch somehow omits a row (it never should — it
// iterates every input — but the read must never send an unclassified row).
const FAILSAFE_COMPLIANCE: ProspectComplianceState = {
  hardStop: true,
  flags: [],
  relisted: false,
  offMarket: false,
  suppressedSms: true,
  noPhone: true,
  reasons: ['compliance unresolved'],
}

type Sb = ReturnType<typeof createServiceClient>
type RawRow = Record<string, unknown>

// ── Shared column projections (also used by list.ts) ───────────────────────

export const EXPIRED_SELECT =
  'listing_key, street_address, city, postal_code, full_address, owner_name, contact_phone, contact_email, ' +
  'standard_status, expired_at, detected_at, status_change_timestamp, list_price, original_list_price, ' +
  'days_on_market, cumulative_days_on_market, subdivision, property_type, bedrooms, bathrooms, sqft, ' +
  'list_agent_name, list_office_name, contact_source, owner_lookup_status, enrichment_notes, ' +
  'outreach_sms_sent_at, outreach_sms_sid, outreach_crm_person_id, fub_person_id, cma_id, ' +
  'compliance_hard_stop, compliance_flags'

export const FSBO_SELECT =
  'fsbo_url, street_address, city, postal_code, full_address, owner_name, contact_phone, contact_email, ' +
  'list_price, detected_at, status, latitude, longitude, photo_url, bedrooms, bathrooms, sqft, property_type, ' +
  'year_built, lot_size_sqft, days_listed, description, contact_source, owner_lookup_status, enrichment_notes, ' +
  'outreach_sms_sent_at, outreach_sms_sid, outreach_crm_person_id, fub_person_id, cma_id, ' +
  'compliance_hard_stop, compliance_flags'

// ── Email-outreach column feature-detect (migration 20260722010100) ─────────
//
// The email-channel columns may not exist yet (the orchestrator applies
// migrations after the wave). Every prospecting base read selects them
// OPTIMISTICALLY; on a 42703 the caller marks them absent (module-level flag)
// and retries with the legacy column list, so the dashboard renders
// pre-migration instead of erroring. Once marked absent the extra round-trip
// is skipped for the life of the server process.

const EMAIL_OUTREACH_SELECT = 'outreach_email_sent_at, outreach_email_status, outreach_email_message_id'

let emailOutreachColumnsPresent: boolean | null = null

/** The current select list for a prospecting base read (email columns included unless known absent). */
export function prospectSelect(kind: ProspectKind): string {
  const base = kind === 'expired' ? EXPIRED_SELECT : FSBO_SELECT
  return emailOutreachColumnsPresent === false ? base : `${base}, ${EMAIL_OUTREACH_SELECT}`
}

/** Legacy (pre-migration) select list — the 42703 retry target. */
export function prospectSelectLegacy(kind: ProspectKind): string {
  return kind === 'expired' ? EXPIRED_SELECT : FSBO_SELECT
}

/** True when the retry-with-legacy-columns path applies for this read error. */
export function shouldRetryWithoutEmailColumns(
  error: { code?: string | null; message?: string | null } | null | undefined,
): boolean {
  return emailOutreachColumnsPresent !== false && isUndefinedColumnError(error)
}

/** Remember the 42703 so later reads skip the optimistic select. */
export function markEmailOutreachColumnsAbsent(): void {
  if (emailOutreachColumnsPresent !== false) {
    console.warn('[prospecting] outreach_email_* columns absent (migration 20260722010100 not applied yet) — using legacy select')
  }
  emailOutreachColumnsPresent = false
}

const LISTINGS_JOIN_COLUMNS =
  'ListingKey, PhotoURL, Latitude, Longitude, ListDate, StandardStatus, public_remarks, year_built, ' +
  'lot_size_acres, garage_spaces, view_description, PropertyType'

export interface ExpiredListingJoin {
  photoUrl: string | null
  latitude: number | null
  longitude: number | null
  listDate: string | null
  standardStatus: string | null
  publicRemarks: string | null
  yearBuilt: number | null
  lotAcres: number | null
  garageSpaces: number | null
  viewDescription: string | null
  propertyType: string | null
}

export function numOrNull(v: unknown): number | null {
  return v == null ? null : Number(v)
}

function mapListingJoinRow(row: RawRow): ExpiredListingJoin {
  return {
    photoUrl: (row.PhotoURL as string | null) ?? null,
    latitude: numOrNull(row.Latitude),
    longitude: numOrNull(row.Longitude),
    listDate: (row.ListDate as string | null) ?? null,
    standardStatus: (row.StandardStatus as string | null) ?? null,
    publicRemarks: (row.public_remarks as string | null) ?? null,
    yearBuilt: numOrNull(row.year_built),
    lotAcres: numOrNull(row.lot_size_acres),
    garageSpaces: numOrNull(row.garage_spaces),
    viewDescription: (row.view_description as string | null) ?? null,
    propertyType: (row.PropertyType as string | null) ?? null,
  }
}

/** Batched `listings` join for expired rows (photo/lat/lng/listedAt + detail
 *  fields), scoped to exactly the given listing keys — never a global read. */
export async function fetchExpiredListingJoinBatch(
  sb: Sb,
  listingKeys: string[],
): Promise<Map<string, ExpiredListingJoin>> {
  const map = new Map<string, ExpiredListingJoin>()
  const unique = [...new Set(listingKeys)].filter((k) => k)
  if (unique.length === 0) return map
  // @canonical-key — the keys come from expired_listings.listing_key, which is the
  // MLS ListingKey copied verbatim at detection time; a self-consistent MLS-key join.
  const { data, error } = await sb.from('listings').select(LISTINGS_JOIN_COLUMNS).in('ListingKey', unique)
  if (error) {
    console.error('[prospecting] listings batch join failed:', error.message)
    return map
  }
  for (const row of (data ?? []) as unknown as RawRow[]) {
    map.set(String(row.ListingKey), mapListingJoinRow(row))
  }
  return map
}

async function fetchExpiredListingJoin(sb: Sb, listingKey: string): Promise<ExpiredListingJoin | null> {
  const map = await fetchExpiredListingJoinBatch(sb, [listingKey])
  return map.get(listingKey) ?? null
}

// ── Row skeleton (doc + compliance resolved, engagement not yet attached) ──

export type ProspectRowSkeleton = Omit<ProspectRow, 'engagement' | 'sendable'>

export function resolvePersonId(row: RawRow): number | null {
  const a = row.outreach_crm_person_id
  const b = row.fub_person_id
  if (typeof a === 'number') return a
  if (typeof b === 'number') return b
  return null
}

/** doc ready + no compliance block + phone present + not already sent. */
export function computeSendable(doc: ProspectDocState, compliance: { hardStop: boolean; relisted: boolean; offMarket: boolean; suppressedSms: boolean; noPhone: boolean }): boolean {
  return (
    doc.state === 'ready' &&
    !compliance.hardStop &&
    !compliance.relisted &&
    !compliance.offMarket &&
    !compliance.suppressedSms &&
    !compliance.noPhone
  )
}

export function engagementKeyFor(skeleton: ProspectRowSkeleton): ProspectEngagementKey {
  const slug = skeleton.doc.state === 'ready' || skeleton.doc.state === 'sent' ? skeleton.doc.slug : null
  return { id: skeleton.id, slug, personId: skeleton.personId }
}

export function finalizeRow(
  skeleton: ProspectRowSkeleton,
  engagement: ProspectRow['engagement'] | undefined,
): ProspectRow {
  return {
    ...skeleton,
    engagement: engagement ?? EMPTY_ENGAGEMENT,
    sendable: computeSendable(skeleton.doc, skeleton.compliance),
  }
}

// ── Pure skeleton mappers (no I/O) — shared by the single-row builders below
// and the batch classifier in list.ts (via batch.ts). Doc + compliance are
// resolved by the caller (per-row for getProspect, batched for the worklist).

export function mapExpiredSkeleton(
  raw: RawRow,
  doc: ProspectDocState,
  compliance: ProspectComplianceState,
  listing: ExpiredListingJoin | null,
): ProspectRowSkeleton {
  return {
    kind: 'expired',
    id: String(raw.listing_key),
    personId: resolvePersonId(raw),
    ownerName: (raw.owner_name as string | null) ?? null,
    streetAddress: (raw.street_address as string | null) ?? null,
    city: (raw.city as string | null) ?? null,
    postalCode: (raw.postal_code as string | null) ?? null,
    fullAddress:
      (raw.full_address as string | null) ??
      ([raw.street_address, raw.city].filter(Boolean).join(', ') || null),
    listPrice: numOrNull(raw.list_price),
    listedAt: listing?.listDate ?? null,
    expiredAt: (raw.expired_at as string | null) ?? (raw.status_change_timestamp as string | null) ?? null,
    detectedAt: (raw.detected_at as string | null) ?? null,
    photoUrl: listing?.photoUrl ?? null,
    latitude: listing?.latitude ?? null,
    longitude: listing?.longitude ?? null,
    contactPhone: (raw.contact_phone as string | null) ?? null,
    contactEmail: (raw.contact_email as string | null) ?? null,
    doc,
    compliance,
  }
}

export function mapFsboSkeleton(
  raw: RawRow,
  doc: ProspectDocState,
  compliance: ProspectComplianceState,
): ProspectRowSkeleton {
  return {
    kind: 'fsbo',
    id: String(raw.fsbo_url),
    personId: resolvePersonId(raw),
    ownerName: (raw.owner_name as string | null) ?? null,
    streetAddress: (raw.street_address as string | null) ?? null,
    city: (raw.city as string | null) ?? null,
    postalCode: (raw.postal_code as string | null) ?? null,
    fullAddress: (raw.full_address as string | null) ?? null,
    listPrice: numOrNull(raw.list_price),
    listedAt: null,
    expiredAt: null,
    detectedAt: (raw.detected_at as string | null) ?? null,
    photoUrl: (raw.photo_url as string | null) ?? null,
    latitude: numOrNull(raw.latitude),
    longitude: numOrNull(raw.longitude),
    contactPhone: (raw.contact_phone as string | null) ?? null,
    contactEmail: (raw.contact_email as string | null) ?? null,
    doc,
    compliance,
  }
}

// The single-row builders delegate to the SAME batch resolvers the worklist uses
// (spec §4.1 "one built definition") — so the detail drawer and the send guard
// can never disagree with the list about whether a doc is built/ready.

export async function buildExpiredRowSkeleton(
  raw: RawRow,
  listing: ExpiredListingJoin | null,
): Promise<ProspectRowSkeleton> {
  const id = String(raw.listing_key)
  const [docMap, compMap] = await Promise.all([
    resolveDocsBatch('expired', [raw]),
    resolveComplianceBatch('expired', [raw]),
  ])
  return mapExpiredSkeleton(raw, docMap.get(id) ?? { state: 'none' }, compMap.get(id) ?? FAILSAFE_COMPLIANCE, listing)
}

export async function buildFsboRowSkeleton(raw: RawRow): Promise<ProspectRowSkeleton> {
  const id = String(raw.fsbo_url)
  const [docMap, compMap] = await Promise.all([
    resolveDocsBatch('fsbo', [raw]),
    resolveComplianceBatch('fsbo', [raw]),
  ])
  return mapFsboSkeleton(raw, docMap.get(id) ?? { state: 'none' }, compMap.get(id) ?? FAILSAFE_COMPLIANCE)
}

// ── Public reads ─────────────────────────────────────────────────────────

async function loadExpired(
  sb: Sb,
  id: string,
): Promise<{ row: ProspectRow; raw: RawRow; listing: ExpiredListingJoin | null } | null> {
  let { data: r, error } = await sb
    .from('expired_listings')
    .select(prospectSelect('expired'))
    // @canonical-key — expired_listings.listing_key is the MLS key stored at
    // detection time; a self-lookup against our own table.
    .eq('listing_key', id.trim())
    .maybeSingle()
  if (error && shouldRetryWithoutEmailColumns(error)) {
    markEmailOutreachColumnsAbsent()
    ;({ data: r, error } = await sb
      .from('expired_listings')
      .select(prospectSelectLegacy('expired'))
      .eq('listing_key', id.trim())
      .maybeSingle())
  }
  if (error) {
    console.error('[prospecting] getProspect(expired) failed:', error.message)
    return null
  }
  if (!r) return null
  const raw = r as unknown as RawRow
  const listing = await fetchExpiredListingJoin(sb, String(raw.listing_key))
  const skeleton = await buildExpiredRowSkeleton(raw, listing)
  const engagementMap = await getProspectEngagement('expired', [engagementKeyFor(skeleton)])
  return { row: finalizeRow(skeleton, engagementMap[skeleton.id]), raw, listing }
}

async function loadFsbo(sb: Sb, id: string): Promise<{ row: ProspectRow; raw: RawRow } | null> {
  let { data: r, error } = await sb
    .from('fsbo_listings')
    .select(prospectSelect('fsbo'))
    .eq('fsbo_url', id.trim())
    .maybeSingle()
  if (error && shouldRetryWithoutEmailColumns(error)) {
    markEmailOutreachColumnsAbsent()
    ;({ data: r, error } = await sb
      .from('fsbo_listings')
      .select(prospectSelectLegacy('fsbo'))
      .eq('fsbo_url', id.trim())
      .maybeSingle())
  }
  if (error) {
    console.error('[prospecting] getProspect(fsbo) failed:', error.message)
    return null
  }
  if (!r) return null
  const raw = r as unknown as RawRow
  const skeleton = await buildFsboRowSkeleton(raw)
  const engagementMap = await getProspectEngagement('fsbo', [engagementKeyFor(skeleton)])
  return { row: finalizeRow(skeleton, engagementMap[skeleton.id]), raw }
}

/** One prospect row — one bounded read, no whole-queue recompute (spec §7). */
export async function getProspect(kind: ProspectKind, id: string): Promise<ProspectRow | null> {
  const sb = createServiceClient()
  if (kind === 'expired') {
    const loaded = await loadExpired(sb, id)
    return loaded?.row ?? null
  }
  const loaded = await loadFsbo(sb, id)
  return loaded?.row ?? null
}

async function fetchPriceHistory(row: Pick<ProspectRow, 'streetAddress' | 'city' | 'postalCode'>): Promise<ProspectPriceCycle[]> {
  if (!row.streetAddress) return []
  const num = row.streetAddress.split(' ')[0]
  const namePrefix = row.streetAddress.slice(num.length + 1).trim()
  if (!num || !namePrefix) return []
  // Ported from lib/data/expired/outreach.ts getExpiredListingDetail (the
  // "full price history" block) — reuses the exact BPO cycle reader so the
  // prospecting detail view and the BPO/CMA engines never disagree about a
  // property's prior MLS attempts.
  const cycles = await getBpoListingCyclesByAddress({
    streetNumber: num,
    streetNameIlike: `${namePrefix}%`,
    cityIlike: row.city ?? null,
    postalCode: row.postalCode ?? null,
  })
  return cycles.map((c) => ({
    listDate: (c.ListDate as string | null) ?? (c.OnMarketDate as string | null) ?? null,
    status: (c.StandardStatus as string | null) ?? null,
    originalListPrice: c.OriginalListPrice != null ? Number(c.OriginalListPrice) : null,
    finalListPrice: c.ListPrice != null ? Number(c.ListPrice) : null,
    closePrice: c.ClosePrice != null ? Number(c.ClosePrice) : null,
    daysOnMarket: c.DaysOnMarket != null ? Number(c.DaysOnMarket) : null,
    priceDropCount: c.price_drop_count != null ? Number(c.price_drop_count) : null,
    offMarketDate: (c.off_market_date as string | null) ?? null,
    // Under-contract history — already selected by BPO_CYCLE_COLUMNS; surfaced
    // so the drawer can show "went pending, fell through" instead of dropping it.
    daysToPending: c.days_to_pending != null ? Number(c.days_to_pending) : null,
    wasRelisted: Boolean(c.was_relisted),
    backOnMarketCount: c.back_on_market_count != null ? Number(c.back_on_market_count) : null,
  }))
}

// ── Ownership tenure ("how long they owned it") ─────────────────────────────
//
// Additive surface field (2026-07-21): ownershipYears on ProspectDetail.
// Never estimated (§0) — a date is used only when a source proves it:
//   1. crm_people.custom.customOwnershipSince — county deed record persisted
//      by the owner-lookup chain (lib/expired-owner-lookup.ts).
//   2. The "Owned since YYYY-MM-DD" marker the same chain writes into
//      expired/fsbo enrichment_notes (buildCountyNotes).
//   3. The most recent CLOSED MLS cycle in the already-fetched price history
//      (the last recorded MLS sale at the address).
// When none of the three exists the field is null and the UI stays silent.

const OWNED_SINCE_NOTE_RE = /Owned since (\d{4}-\d{2}-\d{2})/

function parseIsoDate(v: unknown): Date | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(v.trim())) return null
  const d = new Date(v.trim().slice(0, 10))
  return Number.isNaN(d.getTime()) ? null : d
}

/** Whole years between the proven date and now. 0 = under a year. Null when
 *  the input is absent, unparseable, or in the future (bad data → omit). */
export function ownershipYearsFromDate(sinceIso: unknown, asOf: Date = new Date()): number | null {
  const since = parseIsoDate(sinceIso)
  if (!since) return null
  const ms = asOf.getTime() - since.getTime()
  if (ms < 0) return null
  return Math.floor(ms / (365.2425 * 86_400_000))
}

/** Resolve the proven ownership-start date by source priority (see above). */
export function deriveOwnershipSince(args: {
  customOwnershipSince?: unknown
  enrichmentNotes: string | null
  priceHistory: ProspectPriceCycle[]
}): string | null {
  const custom = parseIsoDate(args.customOwnershipSince)
  if (custom) return custom.toISOString().slice(0, 10)

  const noteMatch = args.enrichmentNotes?.match(OWNED_SINCE_NOTE_RE)
  if (noteMatch && parseIsoDate(noteMatch[1])) return noteMatch[1]

  // Last recorded MLS sale: closed cycle with a real close price, newest first.
  const closed = args.priceHistory
    .filter((c) => (c.closePrice ?? 0) > 0 && parseIsoDate(c.offMarketDate) != null)
    .sort((a, b) => String(b.offMarketDate).localeCompare(String(a.offMarketDate)))
  const last = closed[0]?.offMarketDate ?? null
  return last ? last.slice(0, 10) : null
}

/** Bounded single-person read of crm_people.custom.customOwnershipSince.
 *  Fail-soft: any error or missing person returns null. */
async function fetchCustomOwnershipSince(sb: Sb, personId: number | null): Promise<string | null> {
  if (personId == null) return null
  const { data, error } = await sb.from('crm_people').select('custom').eq('id', personId).maybeSingle()
  if (error || !data) return null
  const custom = (data as { custom?: Record<string, unknown> | null }).custom
  const v = custom?.customOwnershipSince
  return typeof v === 'string' ? v : null
}

/** Row + property card + full price history for the review drawer (spec §7). */
export async function getProspectDetail(kind: ProspectKind, id: string): Promise<ProspectDetail | null> {
  const sb = createServiceClient()

  if (kind === 'expired') {
    const loaded = await loadExpired(sb, id)
    if (!loaded) return null
    const { row, raw, listing } = loaded
    const [priceHistory, drip, customOwnershipSince] = await Promise.all([
      fetchPriceHistory(row),
      getProspectDripState(kind, row.personId),
      fetchCustomOwnershipSince(sb, row.personId),
    ])
    return {
      ...row,
      standardStatus: listing?.standardStatus ?? (raw.standard_status as string | null) ?? null,
      subdivision: (raw.subdivision as string | null) ?? null,
      bedrooms: numOrNull(raw.bedrooms),
      bathrooms: numOrNull(raw.bathrooms),
      sqft: numOrNull(raw.sqft),
      yearBuilt: listing?.yearBuilt ?? null,
      lotAcres: listing?.lotAcres ?? null,
      garageSpaces: listing?.garageSpaces ?? null,
      viewDescription: listing?.viewDescription ?? null,
      propertyType: (raw.property_type as string | null) ?? listing?.propertyType ?? null,
      publicRemarks: listing?.publicRemarks ?? null,
      priorListAgentName: (raw.list_agent_name as string | null) ?? null,
      priorListOfficeName: (raw.list_office_name as string | null) ?? null,
      originalListPrice: numOrNull(raw.original_list_price),
      daysOnMarket: numOrNull(raw.days_on_market),
      cumulativeDaysOnMarket: numOrNull(raw.cumulative_days_on_market),
      contactSource: (raw.contact_source as string | null) ?? null,
      ownerLookupStatus: (raw.owner_lookup_status as string | null) ?? null,
      enrichmentNotes: (raw.enrichment_notes as string | null) ?? null,
      ownershipYears: ownershipYearsFromDate(
        deriveOwnershipSince({
          customOwnershipSince,
          enrichmentNotes: (raw.enrichment_notes as string | null) ?? null,
          priceHistory,
        }),
      ),
      priceHistory,
      drip,
    }
  }

  const loaded = await loadFsbo(sb, id)
  if (!loaded) return null
  const { row, raw } = loaded
  const [priceHistory, drip, customOwnershipSince] = await Promise.all([
    fetchPriceHistory(row),
    getProspectDripState(kind, row.personId),
    fetchCustomOwnershipSince(sb, row.personId),
  ])
  return {
    ...row,
    standardStatus: null,
    subdivision: null,
    bedrooms: numOrNull(raw.bedrooms),
    bathrooms: numOrNull(raw.bathrooms),
    sqft: numOrNull(raw.sqft),
    yearBuilt: numOrNull(raw.year_built),
    // fsbo_listings only tracks lot size in sqft — converted to acres (÷43560)
    // to match the shared ProspectDetail contract; a straight unit conversion
    // of an already-measured value, not an inferred number.
    lotAcres: raw.lot_size_sqft != null ? Number(raw.lot_size_sqft) / 43560 : null,
    garageSpaces: null,
    viewDescription: null,
    propertyType: (raw.property_type as string | null) ?? null,
    publicRemarks: (raw.description as string | null) ?? null,
    priorListAgentName: null,
    priorListOfficeName: null,
    originalListPrice: null,
    daysOnMarket: numOrNull(raw.days_listed),
    cumulativeDaysOnMarket: null,
    contactSource: (raw.contact_source as string | null) ?? null,
    ownerLookupStatus: (raw.owner_lookup_status as string | null) ?? null,
    enrichmentNotes: (raw.enrichment_notes as string | null) ?? null,
    ownershipYears: ownershipYearsFromDate(
      deriveOwnershipSince({
        customOwnershipSince,
        enrichmentNotes: (raw.enrichment_notes as string | null) ?? null,
        priceHistory,
      }),
    ),
    priceHistory,
    drip,
  }
}
