import { NextResponse } from 'next/server'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { getSession } from '@/app/actions/auth'
import { getCachedCMA, computeCMA } from '@/lib/cma'
import { CMAPdfDocument } from '@/lib/pdf/cma-pdf'
import { createClient } from '@supabase/supabase-js'
import { sendEvent } from '@/lib/followupboss'
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

  const session = await getSession()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  let body: { propertyId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const propertyId = body.propertyId?.trim()
  if (!propertyId) {
    return NextResponse.json({ error: 'Missing propertyId' }, { status: 400 })
  }

  let cma = await getCachedCMA(propertyId)
  if (!cma) cma = await computeCMA(propertyId)
  if (!cma) {
    return NextResponse.json({ error: 'No valuation available' }, { status: 404 })
  }

  const supabase = getServiceSupabase()
  const { data: prop } = await supabase.from('properties').select('unparsed_address').eq('id', propertyId).single()
  const { data: listing } = await supabase
    .from('listings')
    .select('beds_total, baths_full, living_area, lot_size_acres, year_built, listing_key, list_price, standard_status, days_on_market, listing_id')
    .eq('property_id', propertyId)
    .order('modification_timestamp', { ascending: false })
    .limit(1)
    .maybeSingle()
  const listingKey = (listing as { listing_key?: string } | null)?.listing_key ?? ''
  const { data: photo } = await supabase
    .from('listing_photos')
    .select('photo_url')
    .eq('listing_key', listingKey)
    .eq('is_hero', true)
    .limit(1)
    .maybeSingle()
  const { data: agent } = await supabase
    .from('listing_agents')
    .select('agent_name, agent_email, agent_phone')
    .eq('listing_key', listingKey)
    .in('agent_role', ['list', 'listing'])
    .limit(1)
    .maybeSingle()

  const listingRow = listing as { beds_total?: number; baths_full?: number; living_area?: number; lot_size_acres?: number; year_built?: number } | null
  const pdfData = {
    cma,
    address: (prop as { unparsed_address?: string } | null)?.unparsed_address ?? '',
    beds: listingRow?.beds_total ?? null,
    baths: listingRow?.baths_full ?? null,
    sqft: listingRow?.living_area ?? null,
    lotAcres: listingRow?.lot_size_acres ?? null,
    yearBuilt: listingRow?.year_built ?? null,
    heroPhotoUrl: (photo as { photo_url?: string } | null)?.photo_url ?? null,
    agentName: (agent as { agent_name?: string } | null)?.agent_name ?? null,
    agentEmail: (agent as { agent_email?: string } | null)?.agent_email ?? null,
    agentPhone: (agent as { agent_phone?: string } | null)?.agent_phone ?? null,
  }

  const doc = React.createElement(CMAPdfDocument, { data: pdfData })
  type DocElement = Parameters<typeof renderToBuffer>[0]
  const buffer = await renderToBuffer(doc as DocElement)
  const source = siteUrl.replace(/^https?:\/\//, '').toLowerCase() || 'ryan-realty.com'
  await sendEvent({
    type: 'Property Inquiry',
    person: { emails: [{ value: session.user.email }] },
    source,
    sourceUrl: `${siteUrl}/listing/${listingKey}`,
    message: 'Downloaded CMA / Value Report (high intent)',
    property: {
      street: pdfData.address,
      url: `${siteUrl}/listing/${listingKey}`,
    },
  })

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="cma-${propertyId.slice(0, 8)}.pdf"`,
    },
  })
}
