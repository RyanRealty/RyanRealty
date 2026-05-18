/**
 * Manual-trigger owner-lookup endpoint.
 *
 * For when Matt wants to immediately re-fire owner enrichment on a specific
 * expired listing — either because the auto-cron landed nothing, or because
 * he added a new provider credential, or because he wants to refresh stale
 * data.
 *
 * POST /api/admin/expired-listing-lookup
 * Body: { listing_key: "..." } OR { street_address, city }
 * Auth: Bearer $CRON_SECRET (admin-only)
 *
 * Returns the OwnerLookupResult + any FUB/DB writes the cron would do.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { lookupOwnerForExpiredListing, enrichOwnerContact, isPhoneOnDNC } from '@/lib/expired-owner-lookup'
import { isAuthorizedCron } from '@/lib/marketing-brain/snapshot'

export const dynamic = 'force-dynamic'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env vars missing')
  return createClient(url, key)
}

export async function POST(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { listing_key?: string; street_address?: string; city?: string; skip_dial?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const supabase = getSupabase()

  // If listing_key provided, look up the listing first
  let streetAddress = body.street_address
  let city = body.city
  let listingKey = body.listing_key

  if (listingKey && (!streetAddress || !city)) {
    const { data } = await supabase
      .from('listings')
      .select('StreetNumber,StreetName,City')
      .eq('ListingKey', listingKey)
      .maybeSingle()
    if (data) {
      streetAddress = `${data.StreetNumber ?? ''} ${data.StreetName ?? ''}`.trim()
      city = data.City
    }
  }

  if (!streetAddress || !city) {
    return NextResponse.json(
      { error: 'Must provide either listing_key OR (street_address AND city)' },
      { status: 400 },
    )
  }

  // Run the full chain
  const ownerLookup = await lookupOwnerForExpiredListing({ streetAddress, city })

  // If we got an owner name from DIAL but no contact info, also run direct skiptrace
  let supplementalEnrichment = null
  if (ownerLookup.status === 'matched-dial' && !ownerLookup.ownerEmail && !ownerLookup.ownerPhone) {
    supplementalEnrichment = await enrichOwnerContact({
      streetAddress,
      city,
      state: 'OR',
      ownerName: ownerLookup.ownerName,
    })
  }

  // DNC scrub if we have a phone
  let dncStatus: boolean | null = null
  const phone = ownerLookup.ownerPhone ?? supplementalEnrichment?.phone
  if (phone) dncStatus = await isPhoneOnDNC(phone)

  // If we have a listing_key, persist the enrichment back to expired_listings
  if (listingKey) {
    // Fetch current attempt counter so we increment instead of clobbering
    const { data: existing } = await supabase
      .from('expired_listings')
      .select('owner_lookup_attempts')
      .eq('listing_key', listingKey)
      .maybeSingle()
    const priorAttempts = (existing?.owner_lookup_attempts as number | undefined) ?? 0
    const update: Record<string, unknown> = {
      owner_lookup_attempts: priorAttempts + 1,
      last_owner_lookup_at: new Date().toISOString(),
    }
    if (ownerLookup.ownerName) update.owner_name = ownerLookup.ownerName
    const emailToWrite = ownerLookup.ownerEmail ?? supplementalEnrichment?.email
    const phoneToWrite = ownerLookup.ownerPhone ?? supplementalEnrichment?.phone
    if (emailToWrite) update.contact_email = emailToWrite
    if (phoneToWrite) update.contact_phone = phoneToWrite
    if (ownerLookup.source) update.contact_source = ownerLookup.source
    if (ownerLookup.notes || supplementalEnrichment?.notes) {
      update.enrichment_notes = `${ownerLookup.notes ?? ''} ${supplementalEnrichment?.notes ?? ''}`.trim()
    }
    const newStatus =
      emailToWrite || phoneToWrite ? 'resolved' : ownerLookup.status === 'pending' ? 'pending' : 'partial'
    update.owner_lookup_status = newStatus

    await supabase.from('expired_listings').update(update).eq('listing_key', listingKey)
  }

  return NextResponse.json({
    streetAddress,
    city,
    listingKey: listingKey ?? null,
    ownerLookup,
    supplementalEnrichment,
    dncStatus: dncStatus === null ? 'unknown' : dncStatus ? 'on-dnc-DO-NOT-CALL' : 'cleared',
    finalContact: {
      email: ownerLookup.ownerEmail ?? supplementalEnrichment?.email ?? null,
      phone: ownerLookup.ownerPhone ?? supplementalEnrichment?.phone ?? null,
    },
  })
}
