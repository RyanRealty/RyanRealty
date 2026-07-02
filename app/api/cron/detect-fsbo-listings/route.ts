/**
 * FSBO listings detection cron.
 *
 * Hourly via vercel.json. Scrapes Zillow's For-Sale-By-Owner filter for
 * each of our 6 service-area cities (Bend, Redmond, Sisters, Sunriver,
 * Tumalo, La Pine), dedupes against public.fsbo_listings (PK by fsbo_url),
 * and for each new listing runs the same pipeline shape as the expired
 * cron — adjusted because FSBO listings frequently carry the seller's
 * contact info directly on the page, so the owner-lookup chain is the
 * fallback rather than the primary path.
 *
 *   1. Apify Zillow FSBO scrape per city
 *   2. Filter: SFR-ish + ListPrice > $500K + city in service area
 *   3. Dedupe against public.fsbo_listings.fsbo_url
 *   4. For each new listing:
 *      a. If owner_name + phone/email came from the page → status='direct-from-listing'
 *      b. Else run lookupOwnerForExpiredListing() (FUB → DIAL → Tracerfy → Apify)
 *   5. Create or match the FUB person record (real or placeholder)
 *   6. Apply canonical tags: audience:seller, seller:hot,
 *      intent:fsbo, seller:fsbo-untouched, source:fsbo-cron, broker:matt,
 *      city:<slug>, owner-lookup:{resolved|pending}
 *   7. Set custom fields (customSellerPropertyAddress, customLeadTier=hot,
 *      customMoveTimeline=ready-now)
 *   8. Add a structured note with full FSBO context
 *   9. Create 60-min Call task assigned to Matt
 *  10. Email Matt via Resend with the full alert
 *  11. Upsert into public.fsbo_listings for dedupe + audit
 *
 * Auth: Authorization: Bearer $CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  findPersonByEmail,
  addPersonTags,
  addPersonNote,
  createRealtimeTask,
  setPersonCustomFields,
  sendEvent,
  type FubEventPerson,
} from '@/lib/followupboss'

import { isAuthorizedCron } from '@/lib/marketing-brain/snapshot'
import { lookupOwnerForExpiredListing } from '@/lib/expired-owner-lookup'
import { sendFsboAlertEmail } from '@/lib/fsbo-alert'
import {
  detectFsboListings,
  FSBO_SERVICE_AREA_CITIES,
  FSBO_MIN_LIST_PRICE,
  type FsboListing,
} from '@/lib/fsbo-detector'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

const MAX_PER_RUN = 25  // mirrors expired cron's bound on outbound work per fire

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env vars missing')
  return createClient(url, key)
}

function citySlug(city: string): string {
  return city.toLowerCase().replace(/\s+/g, '-')
}

function buildFsboNote(l: FsboListing, ownerNotes: string | null): string {
  const lines: string[] = []
  lines.push(`FSBO LISTING. Auto-detected from Zillow on ${new Date().toISOString().slice(0, 10)}.`)
  lines.push('')
  lines.push(`Property: ${l.fullAddress}`)
  if (l.fsboUniqueId) lines.push(`Zillow zpid: ${l.fsboUniqueId}`)
  lines.push(`Listing URL: ${l.fsboUrl}`)
  lines.push('')
  if (l.listPrice != null) {
    lines.push(`List price: $${new Intl.NumberFormat('en-US').format(Math.round(l.listPrice))}`)
  }
  if (l.daysListed != null) lines.push(`Days listed: ${l.daysListed}`)
  lines.push('')
  if (l.bedrooms != null) lines.push(`Beds: ${l.bedrooms}`)
  if (l.bathrooms != null) lines.push(`Baths: ${l.bathrooms}`)
  if (l.sqft) lines.push(`Sqft: ${new Intl.NumberFormat('en-US').format(l.sqft)}`)
  if (l.lotSizeSqft) lines.push(`Lot: ${new Intl.NumberFormat('en-US').format(l.lotSizeSqft)} sqft`)
  if (l.yearBuilt) lines.push(`Year built: ${l.yearBuilt}`)
  if (l.propertyType) lines.push(`Type: ${l.propertyType}`)
  lines.push('')
  if (l.ownerName) lines.push(`Owner (per Zillow): ${l.ownerName}`)
  if (l.contactPhone) lines.push(`Phone: ${l.contactPhone}`)
  if (l.contactEmail) lines.push(`Email: ${l.contactEmail}`)
  if (ownerNotes) {
    lines.push('')
    lines.push(`Owner lookup: ${ownerNotes}`)
  }
  lines.push('')
  lines.push('Approach: FSBO sellers chose to skip representation. Lead with value, not a critique of their decision. The pitch is the listing appointment conversation: pricing accuracy, exposure, time saved.')
  return lines.join('\n')
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  const stats = {
    scanned_total: 0,
    new_unseen: 0,
    new_processed: 0,
    fub_existing_matched: 0,
    fub_created_real: 0,
    fub_created_placeholder: 0,
    notes_added: 0,
    tasks_created: 0,
    plans_enrolled: 0,
    alert_emails_sent: 0,
    errors: 0,
    by_city: {} as Record<string, number>,
  }
  const sample: Array<{
    url: string
    address: string
    city: string
    price: number | null
    ownerStatus: string
    fubPersonId?: number
  }> = []

  // Step 1: scrape Zillow FSBO per city
  const { listings, byCity, errors: scrapeErrors } = await detectFsboListings()
  stats.scanned_total = listings.length
  stats.by_city = byCity
  if (scrapeErrors.length > 0) {
    console.warn('[detect-fsbo] scrape errors:', scrapeErrors)
  }

  if (listings.length === 0) {
    return NextResponse.json({ ...stats, scrape_errors: scrapeErrors, sample })
  }

  // Step 2: dedupe against fsbo_listings
  const urls = listings.map((l) => l.fsboUrl)
  const { data: existing } = await supabase
    .from('fsbo_listings')
    .select('fsbo_url')
    .in('fsbo_url', urls)
  const seen = new Set((existing || []).map((r) => r.fsbo_url))

  // Step 3: also touch last_seen_at on listings we've already processed, so
  // we can later detect which FSBOs have come down (status='gone' sweep).
  if (seen.size > 0) {
    await supabase
      .from('fsbo_listings')
      .update({ last_seen_at: new Date().toISOString(), status: 'active' })
      .in('fsbo_url', Array.from(seen))
  }

  const unseen = listings.filter((l) => !seen.has(l.fsboUrl)).slice(0, MAX_PER_RUN)
  stats.new_unseen = unseen.length

  for (const l of unseen) {
    try {
      stats.new_processed++

      // Step 4: owner resolution — prefer direct from listing, fall back
      // to the full expired-owner-lookup chain.
      let ownerName = l.ownerName ?? null
      let ownerPhone = l.contactPhone ?? null
      let ownerEmail = l.contactEmail ?? null
      let ownerMailingAddress: string | null = null
      let ownerStatus: 'matched-fub' | 'matched-dial' | 'matched-apollo' | 'pending' | 'direct-from-listing' =
        'pending'
      let ownerSource: string = 'placeholder'
      let ownerNotes: string | null = null
      let fubPersonId: number | null = null
      let ownerLookup: import('@/lib/expired-owner-lookup').OwnerLookupResult | null = null

      const hasDirectContact = Boolean(ownerName || ownerPhone || ownerEmail)
      if (hasDirectContact) {
        ownerStatus = 'direct-from-listing'
        ownerSource = 'zillow-fsbo-page'
        ownerNotes = 'Owner name/phone/email surfaced directly from the Zillow FSBO detail page.'
      } else {
        // Fall back to the expired-listings lookup chain (FUB → DIAL → Tracerfy → Apify)
        const lookup = await lookupOwnerForExpiredListing({
          streetAddress: l.streetAddress,
          city: l.city,
        })
        ownerLookup = lookup
        ownerStatus = lookup.status
        ownerSource = lookup.source ?? 'placeholder'
        ownerNotes = lookup.notes ?? null
        if (lookup.fubPersonId) fubPersonId = lookup.fubPersonId
        if (lookup.ownerName) ownerName = lookup.ownerName
        if (lookup.ownerPhone) ownerPhone = lookup.ownerPhone
        if (lookup.ownerEmail) ownerEmail = lookup.ownerEmail
        if (lookup.ownerMailingAddress) ownerMailingAddress = lookup.ownerMailingAddress
      }

      // Step 5: FUB person resolution
      let matchedBy: string = ownerSource
      if (!fubPersonId) {
        const isReal = ownerStatus === 'direct-from-listing' || ownerStatus === 'matched-dial' || ownerStatus === 'matched-apollo'
        const nameForRecord = ownerName ?? `Owner of ${l.streetAddress}`
        const [firstName, ...rest] = nameForRecord.split(/\s+/)
        const lastName = rest.join(' ') || (isReal ? '' : `(${l.city})`)
        const syntheticEmail =
          ownerEmail ??
          `fsbo-${(l.fsboUniqueId ?? l.fsboUrl).replace(/[^a-zA-Z0-9]/g, '').slice(0, 40)}@placeholder.ryan-realty.com`

        const person: FubEventPerson = {
          firstName,
          lastName,
          emails: [{ value: syntheticEmail }],
          ...(ownerPhone ? { phones: [{ value: ownerPhone }] } : {}),
        }

        const eventRes = await sendEvent({
          type: 'Seller Inquiry',
          source: 'FSBO Cron',
          sourceUrl: l.fsboUrl,
          pageTitle: 'FSBO Listing. Auto-detected',
          person,
          message: `Auto-detected FSBO listing at ${l.fullAddress} (${l.fsboSource}). Owner source: ${matchedBy}.`,
          brokerAttribution: { brokerSlug: 'matt' },
        })
        if (eventRes.ok) {
          const newly = await findPersonByEmail(syntheticEmail)
          if (newly?.id) {
            fubPersonId = newly.id
            if (isReal) {
              stats.fub_created_real++
              matchedBy = ownerStatus === 'direct-from-listing' ? 'fsbo-page-create' : `${ownerSource}-create`
            } else {
              stats.fub_created_placeholder++
              matchedBy = 'placeholder'
            }
          }
        }
      } else {
        stats.fub_existing_matched++
      }

      if (!fubPersonId) {
        stats.errors++
        console.warn('[detect-fsbo] failed to resolve FUB person for', l.fsboUrl)
        continue
      }

      // Step 6: tags
      await addPersonTags(fubPersonId, [
        // Plain words — match Matt's existing filter conventions
        'FSBO',
        l.city,
        // Namespaced — enrichment + workflow targeting
        'audience:seller',
        'seller:hot',
        'seller:fsbo-untouched',   // holding tag — removing it triggers Plan 72
        'intent:fsbo',
        'source:fsbo-cron',
        'broker:matt',
        `city:${citySlug(l.city)}`,
        ownerStatus === 'pending' ? 'owner-lookup:pending' : 'owner-lookup:resolved',
        // owner-resolution intel (county records + skip trace, 2026-06-09)
        ...(ownerLookup?.absentee ? ['owner:absentee'] : []),
        ...(ownerLookup?.outOfState ? ['geo:out-of-state'] : []),
        ...(ownerLookup?.complianceTags ?? []),
      ])

      // Step 7: custom fields
      await setPersonCustomFields(fubPersonId, {
        customSellerPropertyAddress: l.fullAddress,
        customLeadTier: 'hot',
        customMoveTimeline: 'ready-now',
      })

      // Step 7b: drip enrollment moved to the CRM engine (2026-06-09) —
      // crm-auto-enroll routes intent:fsbo into the CRM's FSBO Recovery
      // sequence. FUB-side applyActionPlan removed to prevent double-drips.
      stats.plans_enrolled++

      // Step 8: note
      const noteOk = await addPersonNote(fubPersonId, buildFsboNote(l, ownerNotes))
      if (noteOk) stats.notes_added++

      // Step 9: 60-min Call task
      const taskOk = await createRealtimeTask({
        personId: fubPersonId,
        taskName: `FSBO ${l.streetAddress}, ${l.city} ($${new Intl.NumberFormat('en-US').format(Math.round(l.listPrice ?? 0))})`,
        taskType: 'Call',
        dueInMinutes: 60,
      })
      if (taskOk) stats.tasks_created++

      // Step 10: Resend alert
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
        fubPersonId,
        enrichmentNotes: ownerNotes,
      })
      if (alertRes.ok) stats.alert_emails_sent++

      // Step 11: upsert into fsbo_listings
      const nowIso = new Date().toISOString()
      await supabase.from('fsbo_listings').upsert({
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
        contact_source: matchedBy,
        enrichment_notes: ownerNotes,
        fub_person_id: fubPersonId,
        fub_person_matched_by: matchedBy,
        alert_sent_at: alertRes.ok ? nowIso : null,
        alert_method: alertRes.ok ? 'resend-email' : null,
        owner_lookup_status: ownerStatus === 'pending' ? 'pending' : 'resolved',
        owner_lookup_attempts: 1,
        last_owner_lookup_at: nowIso,
        detected_at: nowIso,
        first_seen_at: nowIso,
        last_seen_at: nowIso,
        status: 'active',
      }, { onConflict: 'fsbo_url' })

      sample.push({
        url: l.fsboUrl,
        address: l.streetAddress,
        city: l.city,
        price: l.listPrice,
        ownerStatus,
        fubPersonId,
      })
    } catch (err) {
      stats.errors++
      console.error('[detect-fsbo]', l.fsboUrl, err)
    }
  }

  return NextResponse.json({
    ...stats,
    config: {
      cities: FSBO_SERVICE_AREA_CITIES,
      min_list_price: FSBO_MIN_LIST_PRICE,
      max_per_run: MAX_PER_RUN,
    },
    scrape_errors: scrapeErrors,
    sample,
  })
}
