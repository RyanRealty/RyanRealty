import { NextResponse } from 'next/server'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { ListingPdfDocument } from '@/lib/pdf/listing-pdf'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit } from '@/lib/rate-limit'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) throw new Error('Supabase service role not configured')
  return createClient(url, key)
}

export async function POST(request: Request) {
  const rl = await checkRateLimit(request, 'strict')
  if (rl.limited) return rl.response

  let body: { listingKey?: string; listingId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const listingKey = body.listingKey?.trim() ?? body.listingId?.trim()
  if (!listingKey) {
    return NextResponse.json({ error: 'Missing listingKey or listingId' }, { status: 400 })
  }

  const supabase = getServiceSupabase()
  const { data: listing, error: listErr } = await supabase
    .from('listings')
    .select('listing_key, listing_id, list_price, beds_total, baths_full, living_area, lot_size_acres, year_built, garage_spaces, standard_status, days_on_market, public_remarks')
    .eq('listing_key', listingKey)
    .maybeSingle()
  if (listErr || !listing) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
  }
  const { data: prop } = await supabase.from('properties').select('unparsed_address, city, state, postal_code').eq('id', (listing as { property_id?: string }).property_id).maybeSingle()
  const { data: photo } = await supabase.from('listing_photos').select('photo_url').eq('listing_key', listingKey).eq('is_hero', true).limit(1).maybeSingle()
  const { data: agent } = await supabase.from('listing_agents').select('agent_name, agent_email, agent_phone').eq('listing_key', listingKey).in('agent_role', ['list', 'listing']).limit(1).maybeSingle()

  const l = listing as Record<string, unknown>
  const p = (prop as Record<string, unknown>) ?? {}
  const pdfData = {
    address: String(p.unparsed_address ?? l.unparsed_address ?? ''),
    city: p.city != null ? String(p.city) : null,
    state: p.state != null ? String(p.state) : null,
    zip: p.postal_code != null ? String(p.postal_code) : null,
    price: Number(l.list_price ?? 0),
    beds: l.beds_total != null ? Number(l.beds_total) : null,
    baths: l.baths_full != null ? Number(l.baths_full) : null,
    sqft: l.living_area != null ? Number(l.living_area) : null,
    lotAcres: l.lot_size_acres != null ? Number(l.lot_size_acres) : null,
    yearBuilt: l.year_built != null ? Number(l.year_built) : null,
    garageSpaces: l.garage_spaces != null ? Number(l.garage_spaces) : null,
    status: l.standard_status != null ? String(l.standard_status) : null,
    daysOnMarket: l.days_on_market != null ? Number(l.days_on_market) : null,
    mlsNumber: l.listing_id != null ? String(l.listing_id) : null,
    heroPhotoUrl: (photo as { photo_url?: string } | null)?.photo_url ?? null,
    description: l.public_remarks != null ? String(l.public_remarks) : null,
    agentName: (agent as { agent_name?: string } | null)?.agent_name ?? null,
    agentPhone: (agent as { agent_phone?: string } | null)?.agent_phone ?? null,
    agentEmail: (agent as { agent_email?: string } | null)?.agent_email ?? null,
    listingUrl: `${siteUrl}/listing/${listingKey}`,
  }

  const doc = React.createElement(ListingPdfDocument, { data: pdfData })
  type DocElement = Parameters<typeof renderToBuffer>[0]
  const buffer = await renderToBuffer(doc as DocElement)
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="listing-${listingKey.slice(0, 12)}.pdf"`,
    },
  })
}
