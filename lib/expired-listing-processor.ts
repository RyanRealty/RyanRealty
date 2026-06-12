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
  findPersonByPhone,
  getPersonById,
  updatePersonProfile,
  isPlaceholderFubEmail,
  addPersonTags,
  addPersonNote,
  postLeadOriginNote,
  createRealtimeTask,
  setPersonCustomFields,
  sendEvent,
  type FubEventPerson,
} from '@/lib/followupboss'
import {
  lookupOwnerForExpiredListing,
  hasReachableOwnerContact,
  type OwnerLookupResult,
} from '@/lib/expired-owner-lookup'
import { mirrorPersonFromFub } from '@/lib/crm/mirror'
import { autoEnrollByFubId } from '@/lib/crm/enroll'

/**
 * FUB Action Plan id for the Expired Recovery (auto) plan. The 7-touch
 * cadence wired in the prior session (Touch 0 SMS, then day-2 / day-8 /
 * day-14 / day-30 / day-60 / day-90 emails). When this cron creates a
 * fresh expired-listing FUB person, it auto-enrolls them in this plan
 * so Matt does not have to click "Apply Action Plan" by hand on every
 * new lead.
 */
const EXPIRED_RECOVERY_PLAN_ID = 71
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

function buildListingNote(l: ExpiredListingRow, owner: OwnerLookupResult): string {
  const lines: string[] = []
  const addr = `${l.StreetNumber ?? ''} ${l.StreetName ?? ''}`.trim()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com'
  lines.push(`EXPIRED LISTING ALERT. ${l.StandardStatus} on ${l.status_change_timestamp.slice(0, 10)}.`)
  lines.push('')
  lines.push(`Property: ${addr}, ${l.City}, OR ${l.PostalCode ?? ''}`)
  lines.push(`MLS #: ${l.ListNumber ?? l.ListingKey}`)
  if (l.SubdivisionName) lines.push(`Community: ${l.SubdivisionName}`)
  if (owner.taxlot) lines.push(`County taxlot: ${owner.taxlot}`)
  lines.push('')
  const lp = num(l.ListPrice)
  const olp = num(l.OriginalListPrice)
  if (lp != null) lines.push(`Last list price: $${new Intl.NumberFormat('en-US').format(Math.round(lp))}`)
  if (olp != null && lp != null && olp !== lp) {
    const drop = olp - lp
    const dropPct = ((drop / olp) * 100).toFixed(1)
    lines.push(`Original list: $${new Intl.NumberFormat('en-US').format(Math.round(olp))} (dropped $${new Intl.NumberFormat('en-US').format(Math.round(drop))}, ${dropPct}%)`)
  }
  const dom = num(l.CumulativeDaysOnMarket)
  if (dom != null) lines.push(`Days on market: ${dom} days`)
  lines.push('')
  if (l.BedroomsTotal) lines.push(`Beds: ${l.BedroomsTotal}`)
  if (l.BathroomsTotal) lines.push(`Baths: ${l.BathroomsTotal}`)
  const sqft = num(l.TotalLivingAreaSqFt)
  if (sqft) lines.push(`Living area: ${new Intl.NumberFormat('en-US').format(Math.round(sqft))} sqft`)
  lines.push('')
  lines.push(`Prior list agent: ${l.ListAgentName ?? 'unknown'}${l.list_agent_email ? ` (${l.list_agent_email})` : ''}`)
  lines.push('')
  lines.push('OWNER CONTACT')
  if (owner.ownerName) lines.push(`Name: ${owner.ownerName}`)
  if (owner.ownerMailingAddress) lines.push(`Mailing: ${owner.ownerMailingAddress}`)
  if (owner.ownerEmail) lines.push(`Email: ${owner.ownerEmail}`)
  if (owner.ownerPhone) lines.push(`Phone: ${owner.ownerPhone}`)
  if (owner.allPhones && owner.allPhones.length > 1) {
    lines.push(`All phones: ${owner.allPhones.map((p) => `${p.value}${p.dnc ? ' (DNC)' : ''}`).join(', ')}`)
  }
  if (owner.allEmails && owner.allEmails.length > 1) {
    lines.push(`All emails: ${owner.allEmails.join(', ')}`)
  }
  if (!hasReachableOwnerContact(owner)) {
    lines.push('No verified email or phone yet. Do not cold-call until skip trace completes.')
  }
  if (owner.complianceTags?.length) {
    lines.push(`Compliance: ${owner.complianceTags.join(', ')}`)
  }
  if (owner.notes) {
    lines.push('')
    lines.push(`Lookup detail: ${owner.notes}`)
  }
  lines.push('')
  lines.push(`Expired LP: ${siteUrl}/lp/expired-listing`)
  if (l.ListNumber) {
    lines.push(`MLS history: ${siteUrl}/homes-for-sale/listing/${l.ListNumber}`)
  }
  return lines.join('\n')
}

function splitOwnerName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: 'Owner', lastName: '' }
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

async function mergeContactOntoFubPerson(
  personId: number,
  owner: OwnerLookupResult,
): Promise<void> {
  const existing = await getPersonById(personId)
  if (!existing) return

  const emails = [...(existing.emails ?? [])]
  const phones = [...(existing.phones ?? [])]

  const hasRealEmail = emails.some(
    (e) => e.value && !isPlaceholderFubEmail(e.value) && /@/.test(e.value),
  )

  if (owner.ownerEmail && !emails.some((e) => e.value?.toLowerCase() === owner.ownerEmail?.toLowerCase())) {
    const withoutPlaceholders = emails.filter((e) => !isPlaceholderFubEmail(e.value))
    if (hasRealEmail) {
      withoutPlaceholders.push({ value: owner.ownerEmail, type: 'home' })
    } else {
      withoutPlaceholders.unshift({ value: owner.ownerEmail, type: 'home', isPrimary: 1 })
    }
    emails.splice(0, emails.length, ...withoutPlaceholders)
  }

  if (owner.ownerPhone) {
    const norm = owner.ownerPhone.replace(/\D/g, '').slice(-10)
    if (norm && !phones.some((p) => p.value?.replace(/\D/g, '').slice(-10) === norm)) {
      phones.push({ value: owner.ownerPhone, type: 'mobile' })
    }
  }

  const { firstName, lastName } = owner.ownerName
    ? splitOwnerName(owner.ownerName)
    : { firstName: existing.firstName ?? 'Owner', lastName: existing.lastName ?? '' }

  await updatePersonProfile({
    personId,
    firstName,
    lastName,
    emails: emails.length ? emails : undefined,
    phones: phones.length ? phones : undefined,
  })
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
        postalCode: l.PostalCode,
      })

      const hasContact = hasReachableOwnerContact(owner)
      let fubPersonId: number | null = owner.fubPersonId ?? null
      let matchedBy: string = owner.source ?? 'unresolved'
      let skippedFub = false

      if (fubPersonId) {
        stats.fub_existing_matched++
        matchedBy = owner.source ?? 'fub-existing'
        if (hasContact) {
          await mergeContactOntoFubPerson(fubPersonId, owner)
        }
      } else if (hasContact) {
        const { firstName, lastName } = owner.ownerName
          ? splitOwnerName(owner.ownerName)
          : { firstName: 'Expired', lastName: `Listing ${l.ListNumber ?? l.ListingKey}` }

        const person: FubEventPerson = {
          firstName,
          lastName,
          ...(owner.ownerEmail ? { emails: [{ value: owner.ownerEmail }] } : {}),
          ...(owner.ownerPhone ? { phones: [{ value: owner.ownerPhone }] } : {}),
        }

        const eventRes = await sendEvent({
          type: 'Seller Inquiry',
          source: 'expired-listing-cron',
          sourceUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com'}/lp/expired-listing`,
          pageTitle: 'Expired Listing. Auto-detected.',
          person,
          message: `Auto-detected expired listing at ${fullAddress}. Owner source: ${matchedBy}.`,
        })
        if (eventRes.ok) {
          if (owner.ownerEmail) {
            const newly = await findPersonByEmail(owner.ownerEmail)
            if (newly?.id) fubPersonId = newly.id
          }
          if (!fubPersonId && owner.ownerPhone) {
            const byPhone = await findPersonByPhone(owner.ownerPhone)
            if (byPhone?.id) fubPersonId = byPhone.id
          }
        }
        if (fubPersonId) {
          stats.fub_created_dial++
          matchedBy = `${owner.source ?? 'skiptrace'}-create`
        } else {
          stats.errors++
        }
      } else {
        // Matt directive 2026-06-09: no placeholder FUB leads without real contact.
        skippedFub = true
        stats.fub_skipped_no_contact++
        matchedBy = 'no-contact-skip-fub'
      }

      if (!fubPersonId && !skippedFub) {
        stats.errors++
      }

      const lookupPending = !hasContact
      const listingNote = buildListingNote(l, owner)

      if (fubPersonId) {
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
          lookupPending ? 'owner-lookup:pending' : 'owner-lookup:resolved',
          ...(owner.absentee ? ['owner:absentee'] : []),
          ...(owner.outOfState ? ['geo:out-of-state'] : []),
          ...(owner.complianceTags ?? []),
        ])

        await setPersonCustomFields(fubPersonId, {
          customSellerPropertyAddress: fullAddress,
          customLeadTier: 'hot',
          customMoveTimeline: 'ready-now',
        })

        stats.plans_enrolled++

        const noteOk = await addPersonNote(fubPersonId, listingNote)
        if (noteOk) stats.notes_added++

        await postLeadOriginNote(fubPersonId, {
          source: 'expired-listing-cron',
          sourceLabel: 'Expired listing auto-detect (MLS delta)',
          landingPage: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com'}/lp/expired-listing`,
          audience: 'seller',
          tier: 'hot',
          tierReason: `${l.StandardStatus} in service area, ListPrice above floor`,
          want: `Reach owner at ${fullAddress} before re-list window closes.`,
          assignedAgent: 'matt',
          assignmentReason: 'expired listing cron routing',
          extra: lookupPending
            ? 'Owner name may be known but contact is still pending. Do not enroll outreach until phone or email is verified.'
            : `Owner contact resolved via ${owner.source ?? 'skip trace'}.`,
        })

        const taskOk = await createRealtimeTask({
          personId: fubPersonId,
          taskName: `Expired listing. ${streetAddress}, ${l.City} (${l.StandardStatus} ${l.status_change_timestamp.slice(0, 10)}).`,
          taskType: 'Call',
          dueInMinutes: 60,
        })
        if (taskOk) stats.tasks_created++

        // Mirror BEFORE the CMA request so createCmaRequest can stamp the
        // CMA link onto crm_people.custom (the expired sequence's opening
        // text merges %cma_link%; the engine holds the text until it exists).
        await mirrorPersonFromFub(fubPersonId).catch((e) =>
          console.warn('[expired-listing-processor] CRM mirror failed:', e),
        )
        void autoEnrollByFubId(fubPersonId)
          .then((r) => {
            if (r.enrolled) console.log(`[expired-listing-processor] auto-enrolled FUB ${fubPersonId} → ${r.sequence}`)
          })
          .catch((e) => console.warn('[expired-listing-processor] auto-enroll failed:', e))

        // Auto-CMA (Matt directive 2026-06-11): every detected expired listing
        // gets a CMA queued for the property, link attached to the opening
        // outreach. notifyLead=false — the owner never asked us for anything.
        if (hasContact) {
          try {
            const { createCmaRequest, cmaPublicUrl } = await import('@/lib/cma-request')
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
              fubPersonId,
              requestSource: 'expired-listing-cron',
              notifyLead: false,
            })
            if (cmaRes.ok) {
              stats.cmas_queued++
              await addPersonNote(
                fubPersonId,
                `CMA queued for ${fullAddress}. Producer builds the 15-page deliverable (SLA 1 business day). Link for outreach once built: ${cmaPublicUrl(cmaRes.slug)} — the opening text in the Expired Recovery sequence carries this link and stays queued until the CMA exists and A2P is approved.`,
              )
            } else {
              console.warn('[expired-listing-processor] CMA request failed:', cmaRes.error)
            }
          } catch (e) {
            console.warn('[expired-listing-processor] CMA request threw:', e)
          }
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
          bathrooms: num(l.BathroomsTotal),
          sqft: num(l.TotalLivingAreaSqFt),
          subdivision: l.SubdivisionName,
          fub_person_id: fubPersonId,
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
        fubPersonId: fubPersonId ?? undefined,
        skippedFub: skippedFub || undefined,
      })
    } catch (err) {
      stats.errors++
      console.error('[expired-listing-processor]', l.ListingKey, err)
    }
  }

  return stats
}
