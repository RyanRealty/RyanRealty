/**
 * Expired listings detection cron — Phase 4 (full owner-lookup automation).
 *
 * Hourly via vercel.json. For every SFR listing whose StandardStatus
 * transitioned to Expired / Canceled / Withdrawn in the last 24h within
 * our service-area cities, dedupes against public.expired_listings (PK by
 * listing_key) and for each new one runs the full pipeline:
 *
 *   1. Pull listing context from public.listings (Spark MLS mirror)
 *   2. Run owner-lookup chain — FUB internal → Deschutes DIAL → email enrich
 *   3. Create or match the FUB person record:
 *      a. If FUB match: tag the existing person, add a Note with listing context
 *      b. If DIAL match: create a real FUB person from owner_name + mailing addr
 *      c. If no match: placeholder FUB person, owner_lookup:pending
 *   4. Apply canonical tags: audience:seller, seller:hot,
 *      intent:expired-listing, source:expired-listing-cron, broker:matt
 *   5. Create 60-min Call task on the FUB person
 *   6. Email Matt via Resend with the full alert (listing + owner + FUB link)
 *   7. Insert/update row in public.expired_listings for dedupe + audit
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
import { sendExpiredAlertEmail } from '@/lib/expired-alert'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

/**
 * Service area + price floor — LOCKED 2026-05-19 per Matt's directive.
 *
 * Cities: Bend, Redmond, Sisters, Sunriver, Tumalo, La Pine ONLY.
 * Madras and Prineville are intentionally excluded — too far from Ryan
 * Realty's geographic focus + the data sources we use for owner lookup
 * (Deschutes DIAL) don't cover Jefferson + Crook counties.
 *
 * Price floor: ListPrice > $500,000. Sub-$500K expireds aren't worth the
 * skiptrace credit + outreach cost given Matt's target market.
 *
 * Both filters are server-side at query time — keeps the row cap meaningful
 * and the Tracerfy budget predictable.
 */
const SERVICE_AREA_CITIES = [
  'Bend', 'Redmond', 'Sisters', 'Sunriver', 'Tumalo', 'La Pine',
]

const MIN_LIST_PRICE = 500_000

const LOOKBACK_HOURS = 24
const MAX_PER_RUN = 30  // cap per-run so a backlog doesn't blow up

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env vars missing')
  return createClient(url, key)
}

type ExpiredListingRow = {
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

async function fetchNewExpiredListings(supabase: ReturnType<typeof getSupabase>): Promise<ExpiredListingRow[]> {
  const since = new Date(Date.now() - LOOKBACK_HOURS * 3600_000).toISOString()
  const { data, error } = await supabase
    .from('listings')
    .select(
      'ListingKey,ListNumber,StandardStatus,status_change_timestamp,StreetNumber,StreetName,City,PostalCode,ListPrice,OriginalListPrice,CumulativeDaysOnMarket,ListAgentName,list_agent_email,PropertyType,BedroomsTotal,BathroomsTotalDecimal,TotalLivingAreaSqFt,SubdivisionName',
    )
    .in('StandardStatus', ['Expired', 'Canceled', 'Withdrawn'])
    .gt('status_change_timestamp', since)
    .in('City', SERVICE_AREA_CITIES)
    .eq('PropertyType', 'A')  // SFR only per CLAUDE.md convention
    .gt('ListPrice', MIN_LIST_PRICE)  // $500K floor — Matt directive 2026-05-19
    .order('status_change_timestamp', { ascending: false })
    .limit(MAX_PER_RUN * 2)  // over-fetch; some will already be in expired_listings

  if (error) {
    console.error('[detect-expired] listings query failed:', error.message)
    return []
  }

  const keys = (data || []).map((d) => d.ListingKey as string)
  if (keys.length === 0) return []
  const { data: existing } = await supabase
    .from('expired_listings')
    .select('listing_key')
    .in('listing_key', keys)
  const seenKeys = new Set((existing || []).map((r) => r.listing_key))

  return (data || [])
    .filter((d) => !seenKeys.has(d.ListingKey as string))
    .slice(0, MAX_PER_RUN) as ExpiredListingRow[]
}

function num(v: number | string | null | undefined): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function buildListingNote(l: ExpiredListingRow, ownerNotes: string | null): string {
  const lines: string[] = []
  const addr = `${l.StreetNumber ?? ''} ${l.StreetName ?? ''}`.trim()
  lines.push(`EXPIRED LISTING — ${l.StandardStatus} on ${l.status_change_timestamp.slice(0, 10)}`)
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

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  const stats = {
    scanned: 0,
    new_processed: 0,
    fub_existing_matched: 0,
    fub_created_dial: 0,
    fub_created_placeholder: 0,
    notes_added: 0,
    tasks_created: 0,
    alert_emails_sent: 0,
    errors: 0,
  }
  const sample: Array<{ key: string; address: string; city: string; status: string; ownerStatus: string; fubPersonId?: number }> = []

  const newListings = await fetchNewExpiredListings(supabase)
  stats.scanned = newListings.length

  for (const l of newListings) {
    try {
      const streetAddress = `${l.StreetNumber ?? ''} ${l.StreetName ?? ''}`.trim()
      const fullAddress = `${streetAddress}, ${l.City}, OR ${l.PostalCode ?? ''}`.trim()
      stats.new_processed++

      // Step 1: owner lookup chain
      const owner = await lookupOwnerForExpiredListing({
        streetAddress,
        city: l.City,
      })

      // Step 2: FUB person resolution
      let fubPersonId: number | null = owner.fubPersonId ?? null
      let matchedBy: string = owner.source ?? 'placeholder'

      if (!fubPersonId) {
        // No existing FUB match. Create either a real person (DIAL gave us a
        // name) or a placeholder (no contact info at all).
        const isReal = owner.status === 'matched-dial' && owner.ownerName
        const nameForRecord = owner.ownerName ?? `Owner of ${streetAddress}`
        const [firstName, ...rest] = nameForRecord.split(/\s+/)
        const lastName = rest.join(' ') || (isReal ? '' : `(${l.City})`)
        const syntheticEmail = owner.ownerEmail
          ?? `expired-listing-${l.ListingKey}@placeholder.ryan-realty.com`

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
          pageTitle: 'Expired Listing — auto-detected',
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

      // Step 3: tag + custom fields + note + task
      await addPersonTags(fubPersonId, [
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

      const noteOk = await addPersonNote(fubPersonId, buildListingNote(l, owner.notes ?? null))
      if (noteOk) stats.notes_added++

      const taskOk = await createRealtimeTask({
        personId: fubPersonId,
        taskName: `Expired listing — ${streetAddress}, ${l.City} (${l.StandardStatus} ${l.status_change_timestamp.slice(0, 10)})`,
        taskType: 'Call',
        dueInMinutes: 60,
      })
      if (taskOk) stats.tasks_created++

      // Step 4: Resend email alert to Matt
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

      // Step 5: record in expired_listings (canonical table)
      await supabase.from('expired_listings').upsert({
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
        days_on_market: typeof l.CumulativeDaysOnMarket === 'number' ? l.CumulativeDaysOnMarket : num(l.CumulativeDaysOnMarket),
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
      }, { onConflict: 'listing_key' })

      sample.push({
        key: l.ListingKey,
        address: streetAddress,
        city: l.City,
        status: l.StandardStatus,
        ownerStatus: owner.status,
        fubPersonId,
      })
    } catch (err) {
      stats.errors++
      console.error('[detect-expired]', l.ListingKey, err)
    }
  }

  return NextResponse.json({ ...stats, sample })
}
