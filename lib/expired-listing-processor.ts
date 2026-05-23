/**
 * Expired-listings processing pipeline.
 *
 * Single source of truth for the "newly-expired SFR" workflow. Pulls listings
 * that just transitioned to Expired / Canceled / Withdrawn within our service
 * area, runs the owner-lookup chain, creates / matches a FUB person with the
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
 * Service-area + price floor (locked 2026-05-19 per Matt's directive):
 *   - Cities: Bend, Redmond, Sisters, Sunriver, Tumalo, La Pine.
 *   - PropertyType='A' (SFR only).
 *   - ListPrice > $500,000.
 *   - Status transition within the last `lookbackHours` (default 24h).
 *
 * Deduplication is by `expired_listings.listing_key` — a listing only
 * triggers the workflow once even if it bounces between Expired and
 * Withdrawn or sync-delta processes it across overlapping windows.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  findPersonByEmail,
  addPersonTags,
  addPersonNote,
  createRealtimeTask,
  setPersonCustomFields,
  applyActionPlan,
  sendEvent,
  type FubEventPerson,
} from '@/lib/followupboss'

/**
 * FUB Action Plan id for the Expired Recovery (auto) plan. The 7-touch
 * cadence wired in the prior session (Touch 0 SMS, then day-2 / day-8 /
 * day-14 / day-30 / day-60 / day-90 emails). When this cron creates a
 * fresh expired-listing FUB person, it auto-enrolls them in this plan
 * so Matt does not have to click "Apply Action Plan" by hand on every
 * new lead.
 */
const EXPIRED_RECOVERY_PLAN_ID = 71
import { lookupOwnerForExpiredListing } from '@/lib/expired-owner-lookup'
import { sendExpiredAlertEmail } from '@/lib/expired-alert'

export const SERVICE_AREA_CITIES = [
  'Bend',
  'Redmond',
  'Sisters',
  'Sunriver',
  'Tumalo',
  'La Pine',
] as const

export const MIN_LIST_PRICE = 500_000

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
  ListAgentName: string | null
  list_agent_email: string | null
  PropertyType: string | null
  BedroomsTotal: number | string | null
  BathroomsTotalDecimal: number | string | null
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
  notes_added: number
  tasks_created: number
  plans_enrolled: number
  alert_emails_sent: number
  errors: number
  sample: Array<{
    key: string
    address: string
    city: string
    status: string
    ownerStatus: string
    fubPersonId?: number
  }>
}

function emptyStats(): ProcessExpiredStats {
  return {
    scanned: 0,
    new_processed: 0,
    fub_existing_matched: 0,
    fub_created_dial: 0,
    fub_created_placeholder: 0,
    notes_added: 0,
    tasks_created: 0,
    plans_enrolled: 0,
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

function buildListingNote(l: ExpiredListingRow, ownerNotes: string | null): string {
  const lines: string[] = []
  const addr = `${l.StreetNumber ?? ''} ${l.StreetName ?? ''}`.trim()
  lines.push(`EXPIRED LISTING. ${l.StandardStatus} on ${l.status_change_timestamp.slice(0, 10)}.`)
  lines.push('')
  lines.push(`Property: ${addr}, ${l.City}, OR ${l.PostalCode ?? ''}`)
  lines.push(`MLS #: ${l.ListNumber ?? l.ListingKey}`)
  if (l.SubdivisionName) lines.push(`Subdivision: ${l.SubdivisionName}`)
  lines.push('')
  const lp = num(l.ListPrice)
  const olp = num(l.OriginalListPrice)
  if (lp != null) lines.push(`Last list price: $${new Intl.NumberFormat('en-US').format(Math.round(lp))}`)
  if (olp != null && lp != null && olp !== lp) {
    const drop = olp - lp
    const dropPct = ((drop / olp) * 100).toFixed(1)
    lines.push(`Original list: $${new Intl.NumberFormat('en-US').format(Math.round(olp))} (dropped ${dropPct}%)`)
  }
  const dom = num(l.CumulativeDaysOnMarket)
  if (dom != null) lines.push(`Days on market: ${dom}`)
  lines.push('')
  if (l.BedroomsTotal) lines.push(`Beds: ${l.BedroomsTotal}`)
  if (l.BathroomsTotalDecimal) lines.push(`Baths: ${l.BathroomsTotalDecimal}`)
  const sqft = num(l.TotalLivingAreaSqFt)
  if (sqft) lines.push(`Sqft: ${new Intl.NumberFormat('en-US').format(Math.round(sqft))}`)
  lines.push('')
  lines.push(`Prior list agent: ${l.ListAgentName ?? 'unknown'}${l.list_agent_email ? ` <${l.list_agent_email}>` : ''}`)
  if (ownerNotes) {
    lines.push('')
    lines.push(`Owner lookup: ${ownerNotes}`)
  }
  lines.push('')
  lines.push('Landing page to drive owner to:')
  lines.push(`  ${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com'}/lp/expired-listing`)
  return lines.join('\n')
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
    limit: maxPerRun * 2,
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
      })

      let fubPersonId: number | null = owner.fubPersonId ?? null
      let matchedBy: string = owner.source ?? 'placeholder'

      if (!fubPersonId) {
        const isReal = owner.status === 'matched-dial' && owner.ownerName
        const nameForRecord = owner.ownerName ?? `Owner of ${streetAddress}`
        const [firstName, ...rest] = nameForRecord.split(/\s+/)
        const lastName = rest.join(' ') || (isReal ? '' : `(${l.City})`)
        const syntheticEmail =
          owner.ownerEmail ?? `expired-listing-${l.ListingKey}@placeholder.ryan-realty.com`

        const person: FubEventPerson = {
          firstName,
          lastName,
          emails: [{ value: syntheticEmail }],
          ...(owner.ownerPhone ? { phones: [{ value: owner.ownerPhone }] } : {}),
        }

        const eventRes = await sendEvent({
          type: 'Seller Inquiry',
          source: 'expired-listing-cron',
          sourceUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com'}/lp/expired-listing`,
          pageTitle: 'Expired Listing. Auto-detected.',
          person,
          message: `Auto-detected expired listing at ${fullAddress}. Source: ${matchedBy}.`,
        })
        if (eventRes.ok) {
          const newly = await findPersonByEmail(syntheticEmail)
          if (newly?.id) {
            fubPersonId = newly.id
            if (isReal) {
              stats.fub_created_dial++
              matchedBy = 'dial-create'
            } else {
              stats.fub_created_placeholder++
              matchedBy = 'placeholder'
            }
          }
        }
      } else {
        stats.fub_existing_matched++
        matchedBy = owner.source ?? 'fub-existing'
      }

      if (!fubPersonId) {
        stats.errors++
        continue
      }

      const plainStatusTag =
        l.StandardStatus === 'Expired'
          ? 'Expired'
          : l.StandardStatus === 'Canceled'
            ? 'canceled'
            : l.StandardStatus === 'Withdrawn'
              ? 'withdrawn'
              : 'Expired'

      await addPersonTags(fubPersonId, [
        plainStatusTag,
        'audience:seller',
        'seller:hot',
        'intent:expired-listing',
        'source:expired-listing-cron',
        'broker:matt',
        owner.status === 'pending' ? 'owner-lookup:pending' : 'owner-lookup:resolved',
      ])

      await setPersonCustomFields(fubPersonId, {
        customSellerPropertyAddress: fullAddress,
        customLeadTier: 'hot',
        customMoveTimeline: 'ready-now',
      })

      // Auto-enroll in the Expired Recovery plan so the 7-touch cadence
      // starts on day 0 without Matt clicking "Apply Action Plan" by hand.
      // applyActionPlan treats "already enrolled" (HTTP 409 / 422) as a
      // success so re-runs of the cron don't double-count.
      const enrolled = await applyActionPlan(fubPersonId, EXPIRED_RECOVERY_PLAN_ID)
      if (enrolled) stats.plans_enrolled++

      const noteOk = await addPersonNote(fubPersonId, buildListingNote(l, owner.notes ?? null))
      if (noteOk) stats.notes_added++

      const taskOk = await createRealtimeTask({
        personId: fubPersonId,
        taskName: `Expired listing. ${streetAddress}, ${l.City} (${l.StandardStatus} ${l.status_change_timestamp.slice(0, 10)}).`,
        taskType: 'Call',
        dueInMinutes: 60,
      })
      if (taskOk) stats.tasks_created++

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
        bathrooms: num(l.BathroomsTotalDecimal),
        sqft: num(l.TotalLivingAreaSqFt),
        subdivision: l.SubdivisionName,
        ownerLookupStatus: owner.status,
        ownerName: owner.ownerName ?? null,
        ownerMailingAddress: owner.ownerMailingAddress ?? null,
        ownerEmail: owner.ownerEmail ?? null,
        ownerPhone: owner.ownerPhone ?? null,
        fubPersonId,
        enrichmentNotes: owner.notes ?? null,
      })
      if (alertRes.ok) stats.alert_emails_sent++

      void supabase
      const { upsertExpiredListingRow } = await import('@/lib/data')
      await upsertExpiredListingRow(
        {
          listing_key: l.ListingKey,
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
          bathrooms: num(l.BathroomsTotalDecimal),
          sqft: num(l.TotalLivingAreaSqFt),
          subdivision: l.SubdivisionName,
          fub_person_id: fubPersonId,
          fub_person_matched_by: matchedBy,
          alert_sent_at: alertRes.ok ? new Date().toISOString() : null,
          alert_method: alertRes.ok ? 'resend-email' : null,
          owner_lookup_status: owner.status === 'pending' ? 'pending' : 'resolved',
          owner_lookup_attempts: 1,
          last_owner_lookup_at: new Date().toISOString(),
        },
      )

      stats.sample.push({
        key: l.ListingKey,
        address: streetAddress,
        city: l.City,
        status: l.StandardStatus,
        ownerStatus: owner.status,
        fubPersonId,
      })
    } catch (err) {
      stats.errors++
      console.error('[expired-listing-processor]', l.ListingKey, err)
    }
  }

  return stats
}
