/**
 * Expired listings detection cron.
 *
 * Runs hourly via vercel.json cron. For every listing whose StandardStatus
 * transitioned to Expired, Canceled, or Withdrawn in the last 24h within
 * our service area (Bend, Redmond, Sisters, Sunriver, Tumalo, La Pine,
 * Madras, Prineville), dedupe against public.expired_listing_intake and
 * for each new one:
 *
 *   1. Try to match the property address to an existing FUB person
 *      (the owner may already be in our database from a farm import)
 *   2. If matched: add tags (audience:seller, seller:hot, intent:expired-listing,
 *      source:expired-listing-cron) + Note with full listing context + 5-min
 *      realtime task for Matt
 *   3. If unmatched: create a placeholder FUB person with the listing info
 *      so it appears in Matt's expired-listing smart list immediately,
 *      tagged with owner-lookup:pending for skip-trace later
 *   4. Record everything in expired_listing_intake for audit + dedupe
 *
 * Per Matt's 2026-05-17 directive: detect expired/withdrawn/canceled
 * listings → find owner → load into FUB → alert broker → drive to
 * /lp/expired-listing landing page.
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
} from '@/lib/followupboss'
import { isAuthorizedCron } from '@/lib/marketing-brain/snapshot'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

const SERVICE_AREA_CITIES = [
  'Bend', 'Redmond', 'Sisters', 'Sunriver', 'Tumalo',
  'La Pine', 'Madras', 'Prineville',
]

const LOOKBACK_HOURS = 24

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env vars missing')
  return createClient(url, key)
}

type ExpiredListing = {
  ListingKey: string
  ListNumber: string | null
  StandardStatus: string
  status_change_timestamp: string
  street_address: string
  City: string
  PostalCode: string | null
  ListPrice: number | null
  OriginalListPrice: number | null
  CumulativeDaysOnMarket: number | null
  ListAgentName: string | null
  list_agent_email: string | null
  PropertyType: string | null
  BedroomsTotal: number | null
  BathroomsTotalDecimal: number | null
  TotalLivingAreaSqFt: number | null
  SubdivisionName: string | null
}

async function fetchNewExpiredListings(supabase: ReturnType<typeof getSupabase>): Promise<ExpiredListing[]> {
  const since = new Date(Date.now() - LOOKBACK_HOURS * 3600_000).toISOString()
  // Mixed-case column quoting per CLAUDE.md
  const sql = `
    SELECT
      l."ListingKey",
      l."ListNumber",
      l."StandardStatus",
      l.status_change_timestamp,
      (COALESCE(l."StreetNumber",'') || ' ' || COALESCE(l."StreetName",'')) AS street_address,
      l."City",
      l."PostalCode",
      l."ListPrice"::numeric AS "ListPrice",
      l."OriginalListPrice"::numeric AS "OriginalListPrice",
      l."CumulativeDaysOnMarket"::int AS "CumulativeDaysOnMarket",
      l."ListAgentName",
      l.list_agent_email,
      l."PropertyType",
      l."BedroomsTotal"::int AS "BedroomsTotal",
      l."BathroomsTotalDecimal"::numeric AS "BathroomsTotalDecimal",
      l."TotalLivingAreaSqFt"::numeric AS "TotalLivingAreaSqFt",
      l."SubdivisionName"
    FROM listings l
    WHERE l."StandardStatus" IN ('Expired', 'Canceled', 'Withdrawn')
      AND l.status_change_timestamp > $1::timestamptz
      AND l."City" = ANY($2::text[])
      AND l."PropertyType" = 'A'  -- SFR only per CLAUDE.md convention
      AND NOT EXISTS (
        SELECT 1 FROM expired_listing_intake e WHERE e.listing_key = l."ListingKey"
      )
    ORDER BY l.status_change_timestamp DESC
    LIMIT 50
  `
  // Use RPC for parameterized SQL — but we don't have an RPC for this.
  // Use the supabase.from() client with chained filters instead.
  const { data, error } = await supabase
    .from('listings')
    .select('ListingKey,ListNumber,StandardStatus,status_change_timestamp,StreetNumber,StreetName,City,PostalCode,ListPrice,OriginalListPrice,CumulativeDaysOnMarket,ListAgentName,list_agent_email,PropertyType,BedroomsTotal,BathroomsTotalDecimal,TotalLivingAreaSqFt,SubdivisionName')
    .in('StandardStatus', ['Expired', 'Canceled', 'Withdrawn'])
    .gt('status_change_timestamp', since)
    .in('City', SERVICE_AREA_CITIES)
    .eq('PropertyType', 'A')
    .order('status_change_timestamp', { ascending: false })
    .limit(50)

  if (error) {
    console.error('[detect-expired] listings query failed:', error.message)
    return []
  }

  // Filter out already-processed listings
  const keys = (data || []).map((d) => d.ListingKey as string)
  if (keys.length === 0) return []
  const { data: existing } = await supabase
    .from('expired_listing_intake')
    .select('listing_key')
    .in('listing_key', keys)
  const seenKeys = new Set((existing || []).map((r) => r.listing_key))

  return (data || [])
    .filter((d) => !seenKeys.has(d.ListingKey as string))
    .map((d) => ({
      ListingKey: d.ListingKey,
      ListNumber: d.ListNumber,
      StandardStatus: d.StandardStatus,
      status_change_timestamp: d.status_change_timestamp,
      street_address: `${d.StreetNumber ?? ''} ${d.StreetName ?? ''}`.trim(),
      City: d.City,
      PostalCode: d.PostalCode,
      ListPrice: d.ListPrice != null ? Number(d.ListPrice) : null,
      OriginalListPrice: d.OriginalListPrice != null ? Number(d.OriginalListPrice) : null,
      CumulativeDaysOnMarket: d.CumulativeDaysOnMarket,
      ListAgentName: d.ListAgentName,
      list_agent_email: d.list_agent_email,
      PropertyType: d.PropertyType,
      BedroomsTotal: d.BedroomsTotal,
      BathroomsTotalDecimal: d.BathroomsTotalDecimal,
      TotalLivingAreaSqFt: d.TotalLivingAreaSqFt,
      SubdivisionName: d.SubdivisionName,
    }))
}

function formatPrice(n: number | null): string {
  if (n == null) return 'unspecified'
  return '$' + new Intl.NumberFormat('en-US').format(Math.round(n))
}

function buildListingNote(l: ExpiredListing): string {
  const parts: string[] = []
  parts.push(`EXPIRED LISTING DETECTED — ${l.StandardStatus} on ${l.status_change_timestamp.slice(0, 10)}`)
  parts.push('')
  parts.push(`Property: ${l.street_address}, ${l.City}, OR ${l.PostalCode ?? ''}`)
  parts.push(`MLS #: ${l.ListNumber ?? l.ListingKey}`)
  if (l.SubdivisionName) parts.push(`Subdivision: ${l.SubdivisionName}`)
  parts.push('')
  parts.push(`Last list price: ${formatPrice(l.ListPrice)}`)
  if (l.OriginalListPrice && l.ListPrice && l.OriginalListPrice !== l.ListPrice) {
    const drop = l.OriginalListPrice - l.ListPrice
    const dropPct = ((drop / l.OriginalListPrice) * 100).toFixed(1)
    parts.push(`Original list: ${formatPrice(l.OriginalListPrice)} (dropped ${formatPrice(drop)} = ${dropPct}%)`)
  }
  if (l.CumulativeDaysOnMarket != null) parts.push(`Days on market: ${l.CumulativeDaysOnMarket}`)
  parts.push('')
  if (l.BedroomsTotal) parts.push(`Beds: ${l.BedroomsTotal}`)
  if (l.BathroomsTotalDecimal) parts.push(`Baths: ${l.BathroomsTotalDecimal}`)
  if (l.TotalLivingAreaSqFt) parts.push(`Sqft: ${Math.round(Number(l.TotalLivingAreaSqFt))}`)
  parts.push('')
  parts.push(`Previous list agent: ${l.ListAgentName ?? 'unknown'}${l.list_agent_email ? ` <${l.list_agent_email}>` : ''}`)
  parts.push('')
  parts.push('NEXT STEPS:')
  parts.push('  1. Look up owner via Deschutes County DIAL by address')
  parts.push('  2. Cross-check FUB by address / name')
  parts.push('  3. Drop the expired-listing audit landing page link via direct mail / email')
  parts.push(`  4. Landing page: ${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com'}/lp/expired-listing`)
  return parts.join('\n')
}

/**
 * Match an expired listing to an existing FUB person by address.
 * Looks for FUB people whose mailing address (in addresses[0]) contains
 * the street number + street name of the expired property. Imperfect
 * but catches the absentee-owner case where we have the owner's mailing
 * address from a prior farm import.
 */
async function matchOwnerByAddress(l: ExpiredListing): Promise<{ id: number; name: string } | null> {
  // Use FUB search-by-address pattern via /v1/people?streetAddress= if it
  // exists; otherwise fall back to nothing for v1. FUB API doesn't expose
  // a clean address-search endpoint; this would need a Supabase query
  // against a denormalized FUB-people mirror. Stub for v1 — return null
  // and let Matt manually skiptrace.
  void l
  return null
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  const stats = {
    scanned: 0,
    new: 0,
    matched_existing_fub_person: 0,
    created_fub_person: 0,
    notes_added: 0,
    tasks_created: 0,
    errors: 0,
  }
  const samples: Array<{ key: string; address: string; city: string; status: string; matched?: string }> = []

  const newListings = await fetchNewExpiredListings(supabase)
  stats.scanned = newListings.length

  for (const l of newListings) {
    try {
      stats.new++

      const note = buildListingNote(l)
      let fubPersonId: number | null = null
      let matchedBy: string | null = null

      // Step 1: try to match owner via address-lookup helper (stub for v1)
      const matched = await matchOwnerByAddress(l)
      if (matched) {
        fubPersonId = matched.id
        matchedBy = 'address'
        stats.matched_existing_fub_person++
      }

      // Step 2: if no match, create a placeholder FUB person so this shows
      //         up in Matt's "expired listings — needs owner lookup" smart list
      if (!fubPersonId) {
        // Use a synthetic email keyed on the ListingKey so re-runs match
        const syntheticEmail = `expired-listing-${l.ListingKey}@placeholder.ryan-realty.com`
        const eventRes = await sendEvent({
          type: 'Seller Inquiry',
          source: 'expired-listing-cron',
          sourceUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com'}/lp/expired-listing`,
          pageTitle: 'Expired Listing — auto-detected',
          person: {
            firstName: 'Owner of',
            lastName: `${l.street_address} (${l.City})`,
            emails: [{ value: syntheticEmail }],
          },
          message: note,
        })
        if (eventRes.ok) {
          // Look up the just-created person by email to get their id
          const newly = await findPersonByEmail(syntheticEmail)
          if (newly?.id) {
            fubPersonId = newly.id
            matchedBy = 'created'
            stats.created_fub_person++
          }
        }
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
        matchedBy === 'created' ? 'owner-lookup:pending' : 'owner-lookup:resolved',
      ])

      await setPersonCustomFields(fubPersonId, {
        customSellerPropertyAddress: `${l.street_address}, ${l.City}, OR ${l.PostalCode ?? ''}`.trim(),
        customLeadTier: 'hot',
        customMoveTimeline: 'ready-now',
      })

      const noteOk = await addPersonNote(fubPersonId, note)
      if (noteOk) stats.notes_added++

      const taskOk = await createRealtimeTask({
        personId: fubPersonId,
        taskName: `Expired listing — ${l.street_address}, ${l.City} (${l.StandardStatus} ${l.status_change_timestamp.slice(0, 10)})`,
        taskType: 'Call',
        dueInMinutes: 60,
      })
      if (taskOk) stats.tasks_created++

      // Step 4: record in intake table
      await supabase.from('expired_listing_intake').insert({
        listing_key: l.ListingKey,
        status_at_detect: l.StandardStatus,
        status_change_timestamp: l.status_change_timestamp,
        list_number: l.ListNumber,
        street_address: l.street_address,
        city: l.City,
        postal_code: l.PostalCode,
        list_price: l.ListPrice,
        original_list_price: l.OriginalListPrice,
        cumulative_days_on_market: l.CumulativeDaysOnMarket,
        list_agent_name: l.ListAgentName,
        list_agent_email: l.list_agent_email,
        property_type: l.PropertyType,
        bedrooms: l.BedroomsTotal,
        fub_person_id: fubPersonId,
        fub_person_matched_by: matchedBy,
        owner_lookup_status: matchedBy === 'created' ? 'pending' : 'resolved',
      })

      samples.push({
        key: l.ListingKey,
        address: `${l.street_address}, ${l.City}`,
        city: l.City,
        status: l.StandardStatus,
        matched: matchedBy ?? 'none',
      })
    } catch (err) {
      stats.errors++
      console.error('[detect-expired]', l.ListingKey, err)
    }
  }

  return NextResponse.json({ ...stats, samples: samples.slice(0, 10) })
}
