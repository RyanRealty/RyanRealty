/**
 * Expired-listings processing pipeline.
 *
 * Single source of truth for the "newly-expired SFR" workflow. Pulls listings
 * that just transitioned to Expired / Canceled / Withdrawn within our service
 * area, runs the owner-lookup chain, creates / matches a CRM person with the
 * full context, sends Matt a Resend alert, and records the audit row in
 * public.expired_listings.
 *
 * Callers:
 *   1. /api/cron/sync-delta — runs every 10 min after each MLS delta sync.
 *      This is the canonical trigger now (2026-05-22): newly-expired
 *      listings show up in Spark within minutes of the broker marking the
 *      status change, and sync-delta already polls Spark on the same
 *      cadence, so capturing the new expireds in the same call eliminates
 *      a redundant cron + a second Spark hop.
 *   2. /api/cron/detect-expired-listings — kept for ad-hoc manual invocation
 *      via the existing cron secret. The route is no longer on a Vercel
 *      schedule (2026-05-22) but is still hittable for backfills or one-off
 *      triage runs.
 *
 * Service-area + price floor (Matt 2026-08-17: any list price):
 *   - Cities: Bend, Redmond, Sisters, Sunriver, Tumalo, La Pine.
 *   - PropertyType='A' (SFR only).
 *   - Any list price (CAPTURE_MIN_LIST_PRICE = 0).
 *   - Status transition within the last `lookbackHours` (default 24h).
 *
 * Deduplication is by `expired_listings.listing_key` — a listing only
 * triggers the workflow once even if it bounces between Expired and
 * Withdrawn or sync-delta processes it across overlapping windows.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  lookupOwnerForExpiredListing,
  hasReachableOwnerContact,
  ownershipCustomFields,
  type OwnerLookupResult,
} from '@/lib/expired-owner-lookup'
import { autoEnrollPerson } from '@/lib/crm/enroll'
import {
  ensureNativeLead,
  enrichNativeLead,
  createNativeTask,
} from '@/lib/data/crm/ensureNativeLead'

// Expired leads auto-enroll into the "Expired Recovery (auto)" sequence
// (crm_sequences.fub_legacy_plan_id = 71) via autoEnrollPerson, which resolves
// the target sequence from the intent:expired-listing tag through the
// UI-configurable crm_automation_rules table. No hard-coded plan id needed here.
import { sendExpiredAlertEmail } from '@/lib/expired-alert'
import { CAPTURE_MIN_LIST_PRICE, CAPTURE_SERVICE_AREA_CITIES } from '@/lib/prospecting/capture-scope'
import { buildListingNote, type ExpiredNoteHistoryRow, type ExpiredNoteListing } from '@/lib/expired-listing-note'

// Capture scope is defined ONCE, in lib/prospecting/capture-scope.ts (six
// cities, SFR, any list price). These aliases keep the existing import names
// working. ci:capture-scope fails the build if the values are spelled out
// again anywhere in the prospecting path.
export const SERVICE_AREA_CITIES = CAPTURE_SERVICE_AREA_CITIES
export const MIN_LIST_PRICE = CAPTURE_MIN_LIST_PRICE

interface ExpiredListingRow {
  ListingKey: string
  ListNumber: string | null
  StandardStatus: string
  status_change_timestamp: string
  StreetNumber: string | null
  StreetName: string | null
  City: string
  PostalCode: string | null
  ListPrice: number | string | null
  OriginalListPrice: number | string | null
  CumulativeDaysOnMarket: number | string | null
  OnMarketDate: string | null
  ListDate: string | null
  ListAgentName: string | null
  list_agent_email: string | null
  PropertyType: string | null
  BedroomsTotal: number | string | null
  BathroomsTotal: number | string | null
  TotalLivingAreaSqFt: number | string | null
  SubdivisionName: string | null
}

export interface ProcessExpiredOptions {
  /** Cap outbound work per call. Default 30 (matches the legacy cron). */
  maxPerRun?: number
  /** How far back to scan for newly-transitioned rows. Default 24h. */
  lookbackHours?: number
}

export interface ProcessExpiredStats {
  scanned: number
  new_processed: number
  fub_existing_matched: number
  fub_created_dial: number
  fub_created_placeholder: number
  fub_skipped_no_contact: number
  notes_added: number
  tasks_created: number
  plans_enrolled: number
  cmas_queued: number
  alert_emails_sent: number
  errors: number
  sample: Array<{
    key: string
    address: string
    city: string
    status: string
    ownerStatus: string
    fubPersonId?: number
    skippedFub?: boolean
  }>
}

function emptyStats(): ProcessExpiredStats {
  return {
    scanned: 0,
    new_processed: 0,
    fub_existing_matched: 0,
    fub_created_dial: 0,
    fub_created_placeholder: 0,
    fub_skipped_no_contact: 0,
    notes_added: 0,
    tasks_created: 0,
    plans_enrolled: 0,
    cmas_queued: 0,
    alert_emails_sent: 0,
    errors: 0,
    sample: [],
  }
}

function num(v: number | string | null | undefined): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

async function loadHistoryForExpiredNote(listingKey: string): Promise<ExpiredNoteHistoryRow[]> {
  const { selectListingHistoryForKey } = await import('@/lib/data')
  let rows = await selectListingHistoryForKey(listingKey)
  if (rows.length > 0) return rows
  const token = (process.env.SPARK_API_KEY ?? '').trim()
  if (!token) return []
  try {
    const { fetchAndInsertHistoryCore } = await import('@/lib/sync/fetchListingHistory')
    await fetchAndInsertHistoryCore(token, listingKey)
  } catch (err) {
    console.error('[expired-listing-processor] history fetch failed', listingKey, err)
    return []
  }
  rows = await selectListingHistoryForKey(listingKey)
  return rows
}

async function fetchNewExpiredListings(
  supabase: SupabaseClient,
  maxPerRun: number,
  lookbackHours: number,
): Promise<ExpiredListingRow[]> {
  void supabase
  const since = new Date(Date.now() - lookbackHours * 3600_000).toISOString()
  const { selectNewExpiredListings, getExistingExpiredListingKeys } = await import('@/lib/data')
  const data = await selectNewExpiredListings({
    sinceIso: since,
    serviceAreaCities: SERVICE_AREA_CITIES,
    minListPrice: MIN_LIST_PRICE,
    limit: maxPerRun,
  })
  const keys = data.map((d) => (d as { ListingKey: string }).ListingKey)
  if (keys.length === 0) return []
  const seenKeys = await getExistingExpiredListingKeys(keys)
  return data
    .filter((d) => !seenKeys.has((d as { ListingKey: string }).ListingKey))
    .slice(0, maxPerRun) as unknown as ExpiredListingRow[]
}

/**
 * Run the full new-expired-listing pipeline. Returns aggregated stats so the
 * caller can decide what to log / surface.
 *
 * Safe to call multiple times per minute — the dedupe against
 * `public.expired_listings.listing_key` guarantees a single listing only
 * triggers the workflow once.
 */
export async function processNewExpiredListings(
  supabase: SupabaseClient,
  opts: ProcessExpiredOptions = {},
): Promise<ProcessExpiredStats> {
  const maxPerRun = opts.maxPerRun ?? 30
  const lookbackHours = opts.lookbackHours ?? 24
  const stats = emptyStats()

  const newListings = await fetchNewExpiredListings(supabase, maxPerRun, lookbackHours)
  stats.scanned = newListings.length

  for (const l of newListings) {
    try {
      const streetAddress = `${l.StreetNumber ?? ''} ${l.StreetName ?? ''}`.trim()
      const fullAddress = `${streetAddress}, ${l.City}, OR ${l.PostalCode ?? ''}`.trim()
      stats.new_processed++

      const owner = await lookupOwnerForExpiredListing({
        streetAddress,
        city: l.City,
        postalCode: l.PostalCode,
      })

      const hasContact = hasReachableOwnerContact(owner)
      const lookupPending = !hasContact
      // The native crm_people id once we create/reuse a lead. Named crmPersonId
      // (not fubPersonId) because the CRM cutover (2026-06-24) means the workflow
      // is fully CRM-native now: person + tags + note + task + enrollment all live
      // in crm_*, no vendor round-trip. Those creds are gone in production,
      // so the old sendEvent→findPersonByEmail resolve returned null and the whole
      // downstream (tags/note/task/enroll/CMA) silently no-op'd. This block is the
      // fix — it creates the lead directly via ensureNativeLead and enrolls via
      // autoEnrollPerson (crm_people-id keyed), not autoEnrollByPersonId.
      let crmPersonId: number | null = null
      let matchedBy: string = owner.source ?? 'unresolved'
      let skippedFub = false

      if (hasContact) {
        // Create/reuse the native CRM lead (email-first, then phone dedup).
        // ensureNativeLead is idempotent and never throws.
        const native = await ensureNativeLead({
          name: owner.ownerName ?? `Expired Listing ${l.ListNumber ?? l.ListingKey}`,
          email: owner.ownerEmail ?? null,
          phone: owner.ownerPhone ?? null,
          source: 'expired-listing-cron',
          assignedBroker: 'matt',
        })
        if (native.personId > 0) {
          crmPersonId = native.personId
          if (native.created) stats.fub_created_dial++
          else stats.fub_existing_matched++
          matchedBy = native.created
            ? `${owner.source ?? 'skiptrace'}-native-create`
            : `${owner.source ?? 'native'}-existing`
        } else {
          // Skip = no usable key to anchor a contact point on. Should not happen
          // here (hasContact implies a real email or phone), but fail safe.
          stats.errors++
        }
      } else {
        // Matt directive 2026-06-09: no placeholder leads without real contact.
        // County records gave the owner NAME but skip trace returned no phone or
        // email (typically BATCHDATA_API_KEY missing on Vercel). No person is
        // created; the audit row + the alert to Matt still fire so nothing is lost.
        skippedFub = true
        stats.fub_skipped_no_contact++
        matchedBy = 'no-contact-skip-fub'
      }

      // Doc id from the auto-CMA queue (set below when a person exists), stamped
      // into the expired_listings upsert so the row is born linked by id (§4.2).
      let queuedCmaId: string | null = null

      if (crmPersonId) {
        const plainStatusTag =
          l.StandardStatus === 'Expired'
            ? 'Expired'
            : l.StandardStatus === 'Canceled'
              ? 'canceled'
              : l.StandardStatus === 'Withdrawn'
                ? 'withdrawn'
                : 'Expired'

        // Skip-trace demographics -> namespaced custom fields on the contact
        // (crm_people.custom jsonb, RLS service-role only — safe for PII).
        // Store only present values and true flags to keep the record clean.
        const demo = owner.demographics
        const df = owner.flags
        const demographicCustom: Record<string, string | number | boolean> = {}
        if (demo) {
          if (demo.age != null && demo.age !== '') demographicCustom.customAge = demo.age
          if (demo.ageRange) demographicCustom.customAgeRange = demo.ageRange
          if (demo.dob) demographicCustom.customDob = demo.dob
          if (demo.gender) demographicCustom.customGender = demo.gender
          if (demo.maritalStatus) demographicCustom.customMaritalStatus = demo.maritalStatus
          if (demo.householdSize != null && demo.householdSize !== '') demographicCustom.customHouseholdSize = demo.householdSize
          if (demo.presenceOfChildren != null && demo.presenceOfChildren !== '') demographicCustom.customPresenceOfChildren = demo.presenceOfChildren
          if (demo.occupation) demographicCustom.customOccupation = demo.occupation
          if (demo.income) demographicCustom.customIncome = demo.income
          if (demo.netWorth) demographicCustom.customNetWorth = demo.netWorth
        }
        if (df) {
          if (df.recentlyMoved) demographicCustom.customRecentlyMoved = true
          if (df.recentlyDivorced) demographicCustom.customRecentlyDivorced = true
          if (df.equityRich) demographicCustom.customEquityRich = true
          if (df.vacant) demographicCustom.customVacant = true
        }

        // Tags + custom + origin note in one native enrichment call. The
        // intent:expired-listing tag is what auto-enroll keys on for Plan 71.
        await enrichNativeLead({
          personId: crmPersonId,
          tags: [
            plainStatusTag,
            'audience:seller',
            'seller:hot',
            'intent:expired-listing',
            'source:expired-listing-cron',
            'broker:matt',
            'owner-lookup:resolved',
            ...(owner.absentee ? ['owner:absentee'] : []),
            ...(owner.outOfState ? ['geo:out-of-state'] : []),
            ...(df?.equityRich ? ['owner:equity-rich'] : []),
            ...(owner.complianceTags ?? []),
          ],
          custom: {
            customClassification: 'EXPIRED',
            customSellerPropertyAddress: fullAddress,
            customLeadTier: 'hot',
            customMoveTimeline: 'ready-now',
            ...demographicCustom,
            ...ownershipCustomFields(owner),
          },
          assignedBroker: 'matt',
          originNote: {
            title: `Expired listing auto-detect. ${l.StandardStatus}`,
            body: buildListingNote(l as ExpiredNoteListing, owner, await loadHistoryForExpiredNote(l.ListingKey)),
          },
        })
        stats.notes_added++

        const callTaskDue = 60 // minutes
        await createNativeTask({
          personId: crmPersonId,
          name: `Expired listing. ${streetAddress}, ${l.City} (${l.StandardStatus} ${l.status_change_timestamp.slice(0, 10)}).`,
          type: 'Call',
          dueInMinutes: callTaskDue,
          assignedBroker: 'matt',
        })
        stats.tasks_created++

        // PLAN 71 AUTO-ENROLL PAUSED (Matt directive 2026-07-11): expired
        // outreach is manual approve-and-send at /admin/expired-outreach —
        // nothing texts an expired owner without a broker's click. Tags,
        // custom fields, the call task, the auto-CMA, and the Matt alert all
        // still fire; only the automatic first-touch sequence is off. To
        // restore the old behavior, re-add the autoEnrollPerson(crmPersonId)
        // call here (import kept).
        void autoEnrollPerson // import retained for the documented restore path
        console.log(
          `[expired-listing-processor] auto-enroll PAUSED for crm ${crmPersonId} — manual queue at /admin/expired-outreach (2026-07-11 directive)`,
        )

        // Auto-CMA (Matt directive 2026-06-11): every detected expired listing
        // gets a CMA queued for the property, link attached to the opening
        // outreach. notifyLead=false — the owner never asked us for anything.
        try {
          const { createCmaRequest } = await import('@/lib/cma-request')
          const cmaRes = await createCmaRequest({
            rawAddress: fullAddress,
            parsedStreet: streetAddress || null,
            parsedCity: l.City ?? null,
            parsedState: 'OR',
            parsedPostalCode: l.PostalCode ?? null,
            leadEmail: owner.ownerEmail ?? null,
            leadName: owner.ownerName ?? null,
            leadPhone: owner.ownerPhone ?? null,
            leadTimeline: 'ready-now',
            leadClassification: 'hot',
            crmPersonId,
            requestSource: 'expired-listing-cron',
            notifyLead: false,
            // ONE doc (Matt 2026-08-05, supersedes spec 07 §4.1's separate
            // audit): expired subjects build a plain CMA and the builder adds
            // the last-listing review section from the listing history itself.
            // Legacy 'expired-audit' rows still satisfy the worklist via
            // acceptedDocTypesFor.
            docType: 'cma',
          })
          if (cmaRes.ok) {
            stats.cmas_queued++
            // Spec 07 §4.2 — remember the doc id and stamp it INTO the upsert
            // below. The expired_listings row does not exist yet at this point
            // (upsertExpiredListingRow runs after this block), so stamping here
            // 0-row-updates silently (adversarial audit 2026-07-18 CRITICAL).
            queuedCmaId = cmaRes.cmaId
          } else {
            console.warn('[expired-listing-processor] CMA request failed:', cmaRes.error)
          }
        } catch (e) {
          console.warn('[expired-listing-processor] CMA request threw:', e)
        }
      }

      const alertRes = await sendExpiredAlertEmail({
        listingKey: l.ListingKey,
        listNumber: l.ListNumber,
        streetAddress,
        city: l.City,
        postalCode: l.PostalCode,
        status: l.StandardStatus,
        statusChangedAt: l.status_change_timestamp,
        listPrice: num(l.ListPrice),
        originalListPrice: num(l.OriginalListPrice),
        daysOnMarket: num(l.CumulativeDaysOnMarket),
        listAgentName: l.ListAgentName,
        bedrooms: typeof l.BedroomsTotal === 'number' ? l.BedroomsTotal : null,
        bathrooms: num(l.BathroomsTotal),
        sqft: num(l.TotalLivingAreaSqFt),
        subdivision: l.SubdivisionName,
        ownerLookupStatus: lookupPending ? 'pending' : owner.status,
        ownerName: owner.ownerName ?? null,
        ownerMailingAddress: owner.ownerMailingAddress ?? null,
        ownerEmail: owner.ownerEmail ?? null,
        ownerPhone: owner.ownerPhone ?? null,
        crmPersonId,
        enrichmentNotes: owner.notes ?? null,
      })
      if (alertRes.ok) stats.alert_emails_sent++

      void supabase
      const { upsertExpiredListingRow } = await import('@/lib/data')
      await upsertExpiredListingRow(
        {
          listing_key: l.ListingKey,
          cma_id: queuedCmaId,
          list_number: l.ListNumber,
          full_address: fullAddress,
          street_address: streetAddress,
          city: l.City,
          state: 'OR',
          postal_code: l.PostalCode,
          owner_name: owner.ownerName ?? null,
          list_agent_name: l.ListAgentName,
          list_agent_email: l.list_agent_email,
          list_price: num(l.ListPrice),
          original_list_price: num(l.OriginalListPrice),
          days_on_market:
            typeof l.CumulativeDaysOnMarket === 'number'
              ? l.CumulativeDaysOnMarket
              : num(l.CumulativeDaysOnMarket),
          expired_at: l.status_change_timestamp,
          standard_status: l.StandardStatus,
          contact_phone: owner.ownerPhone ?? null,
          contact_email: owner.ownerEmail ?? null,
          contact_source: matchedBy,
          enrichment_notes: owner.notes ?? null,
          status_change_timestamp: l.status_change_timestamp,
          property_type: l.PropertyType,
          bedrooms: typeof l.BedroomsTotal === 'number' ? l.BedroomsTotal : null,
          bathrooms: num(l.BathroomsTotal),
          sqft: num(l.TotalLivingAreaSqFt),
          subdivision: l.SubdivisionName,
          fub_person_id: crmPersonId,
          fub_person_matched_by: matchedBy,
          alert_sent_at: alertRes.ok ? new Date().toISOString() : null,
          alert_method: alertRes.ok ? 'resend-email' : null,
          owner_lookup_status: lookupPending ? 'pending' : 'resolved',
          owner_lookup_attempts: 1,
          last_owner_lookup_at: new Date().toISOString(),
        },
      )

      stats.sample.push({
        key: l.ListingKey,
        address: streetAddress,
        city: l.City,
        status: l.StandardStatus,
        ownerStatus: lookupPending ? 'pending' : owner.status,
        fubPersonId: crmPersonId ?? undefined,
        skippedFub: skippedFub || undefined,
      })
    } catch (err) {
      stats.errors++
      console.error('[expired-listing-processor]', l.ListingKey, err)
    }
  }

  return stats
}
