/**
 * FSBO processor — the native (post-FUB-cutover) pipeline, mirroring
 * lib/expired-listing-processor.ts. The old cron body wrote to the retired FUB
 * path (sendEvent/addPersonTags), which silently no-ops since the 2026-06-24
 * cutover; this replaces it with the native crm_people flow (Matt directive
 * 2026-07-14: find every FSBO, skip-trace, add as a record, dashboard, prepare
 * a CMA + initial-contact SMS).
 *
 * Flow per new FSBO listing (Zillow via Apify; Craigslist/Facebook slot in as
 * sources when a vetted actor exists):
 *   detect → owner contact (direct from the listing page, else the county +
 *   BatchData skip-trace chain with compliance tags + demographics) →
 *   ensureNativeLead (NO placeholder leads without a real phone/email) →
 *   enrichNativeLead (tags + demographics custom + origin note) →
 *   60-min Call task → auto-CMA (createCmaRequest, notifyLead=false) →
 *   Matt alert email → upsert fsbo_listings (audit row).
 *
 * NO AUTO-TEXTING: outreach is manual approve-and-send from /admin/fsbos.
 * The auto-enroll sweep only scans people with fub_created_at set; native
 * leads carry NULL there, so the intent:fsbo tag does NOT auto-enroll them
 * into the texting sequence. (If fub_created_at is ever backfilled on native
 * leads, revisit this gate before it fires Plan 72.)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { detectFsboListings, FSBO_SERVICE_AREA_CITIES, FSBO_MIN_LIST_PRICE, type FsboListing } from '@/lib/fsbo-detector'
import { lookupOwnerForExpiredListing, type OwnerLookupResult } from '@/lib/expired-owner-lookup'
import { ensureNativeLead, enrichNativeLead, createNativeTask } from '@/lib/data/crm/ensureNativeLead'
import { sendFsboAlertEmail } from '@/lib/fsbo-alert'

const MAX_PER_RUN = 15

function citySlug(city: string | null): string {
  return (city ?? 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

export interface FsboProcessStats {
  scraped: number
  already_seen: number
  new_processed: number
  crm_created: number
  crm_existing: number
  skipped_no_contact: number
  tasks_created: number
  cmas_queued: number
  alerts_sent: number
  errors: number
  scrape_errors: string[]
  sample: Array<{ url: string; address: string | null; city: string | null; price: number | null; ownerStatus: string; crmPersonId: number | null }>
}

export async function processNewFsboListings(supabase: SupabaseClient): Promise<FsboProcessStats> {
  const stats: FsboProcessStats = {
    scraped: 0, already_seen: 0, new_processed: 0, crm_created: 0, crm_existing: 0,
    skipped_no_contact: 0, tasks_created: 0, cmas_queued: 0, alerts_sent: 0, errors: 0,
    scrape_errors: [], sample: [],
  }

  // 1. Detect (Zillow FSBO per service-area city, via Apify).
  const detection = await detectFsboListings()
  const listings: FsboListing[] = detection.listings
  stats.scraped = listings.length
  stats.scrape_errors = detection.errors ?? []

  // 2. Dedupe against fsbo_listings; refresh last_seen on the known set.
  const urls = listings.map((l) => l.fsboUrl)
  const seen = new Set<string>()
  for (let i = 0; i < urls.length; i += 100) {
    const { data } = await supabase.from('fsbo_listings').select('fsbo_url').in('fsbo_url', urls.slice(i, i + 100))
    for (const r of data ?? []) seen.add(String(r.fsbo_url))
  }
  stats.already_seen = seen.size
  if (seen.size > 0) {
    await supabase
      .from('fsbo_listings')
      .update({ last_seen_at: new Date().toISOString(), status: 'active' })
      .in('fsbo_url', Array.from(seen))
  }

  const unseen = listings.filter((l) => !seen.has(l.fsboUrl)).slice(0, MAX_PER_RUN)

  for (const l of unseen) {
    try {
      stats.new_processed++

      // 3. Owner contact — prefer direct from the listing page, else the
      // county-records + BatchData skip-trace chain (shared with expireds).
      let ownerName = l.ownerName ?? null
      let ownerPhone = l.contactPhone ?? null
      let ownerEmail = l.contactEmail ?? null
      let ownerMailingAddress: string | null = null
      let ownerStatus: 'matched-fub' | 'matched-dial' | 'matched-apollo' | 'pending' | 'direct-from-listing' = 'pending'
      let ownerSource = 'placeholder'
      let ownerNotes: string | null = null
      let ownerLookup: OwnerLookupResult | null = null

      if (ownerName || ownerPhone || ownerEmail) {
        ownerStatus = 'direct-from-listing'
        ownerSource = `${l.fsboSource}-page`
        ownerNotes = 'Owner contact surfaced directly from the FSBO listing page.'
      } else {
        ownerLookup = await lookupOwnerForExpiredListing({
          streetAddress: l.streetAddress ?? '',
          city: l.city ?? '',
        })
        ownerStatus = ownerLookup.status
        ownerSource = ownerLookup.source ?? 'placeholder'
        ownerNotes = ownerLookup.notes ?? null
        ownerName = ownerLookup.ownerName ?? ownerName
        ownerPhone = ownerLookup.ownerPhone ?? ownerPhone
        ownerEmail = ownerLookup.ownerEmail ?? ownerEmail
        ownerMailingAddress = ownerLookup.ownerMailingAddress ?? null
      }

      // 4. Native CRM record — never a placeholder without real contact.
      let crmPersonId: number | null = null
      const hasContact = Boolean(ownerPhone || ownerEmail)
      if (hasContact) {
        const native = await ensureNativeLead({
          name: ownerName ?? `Owner of ${l.streetAddress ?? l.fullAddress}`,
          email: ownerEmail,
          phone: ownerPhone,
          source: 'fsbo-cron',
          assignedBroker: 'matt',
        })
        if (native.personId > 0) {
          crmPersonId = native.personId
          if (native.created) stats.crm_created++
          else stats.crm_existing++
        }
      } else {
        stats.skipped_no_contact++
      }

      if (crmPersonId) {
        // Demographics → namespaced custom fields (same mapping as expireds).
        const demo = ownerLookup?.demographics
        const df = ownerLookup?.flags
        const custom: Record<string, string | number | boolean> = {
          customClassification: 'FSBO',
          customSellerPropertyAddress: l.fullAddress ?? `${l.streetAddress ?? ''}, ${l.city ?? ''}`,
        }
        if (demo) {
          if (demo.age != null && demo.age !== '') custom.customAge = demo.age
          if (demo.ageRange) custom.customAgeRange = demo.ageRange
          if (demo.gender) custom.customGender = demo.gender
          if (demo.maritalStatus) custom.customMaritalStatus = demo.maritalStatus
          if (demo.occupation) custom.customOccupation = demo.occupation
          if (demo.income) custom.customIncome = demo.income
          if (demo.netWorth) custom.customNetWorth = demo.netWorth
        }
        if (df) {
          if (df.equityRich) custom.customEquityRich = true
          if (df.vacant) custom.customVacant = true
        }

        await enrichNativeLead({
          personId: crmPersonId,
          tags: [
            'FSBO',
            'audience:seller',
            'seller:hot',
            'intent:fsbo',
            'source:fsbo-cron',
            'broker:matt',
            `city:${citySlug(l.city)}`,
            ownerStatus === 'pending' ? 'owner-lookup:pending' : 'owner-lookup:resolved',
            ...(ownerLookup?.absentee ? ['owner:absentee'] : []),
            ...(ownerLookup?.outOfState ? ['geo:out-of-state'] : []),
            ...(ownerLookup?.complianceTags ?? []),
          ],
          assignedBroker: 'matt',
          originNote: {
            title: 'FSBO auto-detect',
            body: [
              `FSBO listing at ${l.fullAddress ?? l.streetAddress} (${l.fsboSource}).`,
              l.listPrice ? `Asking $${Math.round(l.listPrice).toLocaleString()}.` : null,
              l.daysListed != null ? `${l.daysListed} days listed.` : null,
              `Owner source: ${ownerSource}.`,
              ownerNotes,
              l.fsboUrl,
            ].filter(Boolean).join(' '),
          },
        })

        await createNativeTask({
          personId: crmPersonId,
          name: `FSBO ${l.streetAddress ?? l.fullAddress}, ${l.city ?? ''}${l.listPrice ? ` ($${Math.round(l.listPrice).toLocaleString()})` : ''}`,
          type: 'Call',
          dueInMinutes: 60,
          assignedBroker: 'matt',
        })
        stats.tasks_created++

        // 5. Auto-CMA (standard seller CMA — the FSBO hasn't failed; they are
        // selling). notifyLead=false: the owner never asked us for anything.
        try {
          const { createCmaRequest } = await import('@/lib/cma-request')
          const cmaRes = await createCmaRequest({
            rawAddress: l.fullAddress ?? `${l.streetAddress}, ${l.city}, OR ${l.postalCode ?? ''}`,
            parsedStreet: l.streetAddress ?? null,
            parsedCity: l.city ?? null,
            parsedState: 'OR',
            parsedPostalCode: l.postalCode ?? null,
            leadEmail: ownerEmail,
            leadName: ownerName,
            leadPhone: ownerPhone,
            leadTimeline: 'ready-now',
            leadClassification: 'hot',
            crmPersonId,
            requestSource: 'fsbo-cron',
            notifyLead: false,
          })
          if (cmaRes.ok) stats.cmas_queued++
        } catch (e) {
          console.warn('[fsbo-processor] CMA request threw:', e)
        }
      }

      // 6. Matt alert (fires with or without a CRM person — nothing is lost).
      const alertRes = await sendFsboAlertEmail({
        fsboUrl: l.fsboUrl,
        fsboSource: l.fsboSource,
        streetAddress: l.streetAddress,
        city: l.city,
        state: l.state,
        postalCode: l.postalCode,
        listPrice: l.listPrice,
        bedrooms: l.bedrooms,
        bathrooms: l.bathrooms,
        sqft: l.sqft,
        lotSizeSqft: l.lotSizeSqft,
        propertyType: l.propertyType,
        yearBuilt: l.yearBuilt,
        daysListed: l.daysListed,
        photoUrl: l.photoUrl,
        ownerName,
        contactPhone: ownerPhone,
        contactEmail: ownerEmail,
        ownerLookupStatus: ownerStatus,
        ownerMailingAddress,
        fubPersonId: crmPersonId,
        enrichmentNotes: ownerNotes,
      })
      if (alertRes.ok) stats.alerts_sent++

      // 7. Audit row.
      const nowIso = new Date().toISOString()
      await supabase.from('fsbo_listings').upsert(
        {
          fsbo_url: l.fsboUrl,
          fsbo_unique_id: l.fsboUniqueId,
          fsbo_source: l.fsboSource,
          full_address: l.fullAddress,
          street_address: l.streetAddress,
          city: l.city,
          state: l.state,
          postal_code: l.postalCode,
          latitude: l.latitude,
          longitude: l.longitude,
          list_price: l.listPrice,
          bedrooms: l.bedrooms,
          bathrooms: l.bathrooms,
          sqft: l.sqft,
          lot_size_sqft: l.lotSizeSqft,
          property_type: l.propertyType,
          year_built: l.yearBuilt,
          days_listed: l.daysListed,
          photo_url: l.photoUrl,
          description: l.description,
          owner_name: ownerName,
          contact_phone: ownerPhone,
          contact_email: ownerEmail,
          contact_source: ownerSource,
          enrichment_notes: ownerNotes,
          fub_person_id: crmPersonId,
          fub_person_matched_by: crmPersonId ? `${ownerSource}-native` : 'no-contact-skip',
          alert_sent_at: alertRes.ok ? nowIso : null,
          alert_method: alertRes.ok ? 'resend-email' : null,
          owner_lookup_status: ownerStatus === 'pending' ? 'pending' : 'resolved',
          owner_lookup_attempts: 1,
          last_owner_lookup_at: nowIso,
          detected_at: nowIso,
          first_seen_at: nowIso,
          last_seen_at: nowIso,
          status: 'active',
        },
        { onConflict: 'fsbo_url' },
      )

      stats.sample.push({
        url: l.fsboUrl,
        address: l.streetAddress,
        city: l.city,
        price: l.listPrice,
        ownerStatus,
        crmPersonId,
      })
    } catch (err) {
      stats.errors++
      console.error('[fsbo-processor]', l.fsboUrl, err)
    }
  }

  return stats
}

export { FSBO_SERVICE_AREA_CITIES, FSBO_MIN_LIST_PRICE, MAX_PER_RUN as FSBO_MAX_PER_RUN }
