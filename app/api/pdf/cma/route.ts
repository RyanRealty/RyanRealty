import { NextResponse } from 'next/server'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { getSession } from '@/app/actions/auth'
import { getCachedCMA, computeCMA } from '@/lib/cma'
import { CMAPdfDocument } from '@/lib/pdf/cma-pdf'
import { createClient } from '@supabase/supabase-js'
import { sendEvent } from '@/lib/followupboss'
import { checkRateLimit } from '@/lib/rate-limit'
import { listingDetailPath } from '@/lib/slug'

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
  const { data: prop } = await supabase
    .from('properties')
    .select('unparsed_address, street_number, city, postal_code')
    .eq('id', propertyId)
    .single()
  const p = prop as { unparsed_address?: string; street_number?: string; city?: string; postal_code?: string } | null

  // Find listing by matching address (RESO columns, no property_id FK)
  type CmaPdfListingRow = { ListingKey?: string; BedroomsTotal?: number; BathroomsTotal?: number; TotalLivingAreaSqFt?: number; PhotoURL?: string; ListAgentName?: string }
  let listingRow: CmaPdfListingRow | null = null
  if (p?.city) {
    let q = supabase
      .from('listings')
      .select('ListingKey, BedroomsTotal, BathroomsTotal, TotalLivingAreaSqFt, PhotoURL, ListAgentName')
      .ilike('City', p.city)
    if (p.street_number) q = q.eq('StreetNumber', p.street_number)
    if (p.postal_code) q = q.eq('PostalCode', p.postal_code)
    const { data: matches } = await q.order('ModificationTimestamp', { ascending: false }).limit(1)
    listingRow = (matches as CmaPdfListingRow[] | null)?.[0] ?? null
  }

  const resolvedListingKey = listingRow?.ListingKey ?? ''
  const listingHref = listingDetailPath(resolvedListingKey)
  const pdfData = {
    cma,
    address: p?.unparsed_address ?? '',
    beds: listingRow?.BedroomsTotal ?? null,
    baths: listingRow?.BathroomsTotal ?? null,
    sqft: listingRow?.TotalLivingAreaSqFt ?? null,
    lotAcres: null,
    yearBuilt: null,
    heroPhotoUrl: listingRow?.PhotoURL ?? null,
    agentName: listingRow?.ListAgentName ?? null,
    agentEmail: null,
    agentPhone: null,
  }

  const doc = React.createElement(CMAPdfDocument, { data: pdfData })
  type DocElement = Parameters<typeof renderToBuffer>[0]
  const buffer = await renderToBuffer(doc as DocElement)

  // Fire-and-forget: FUB tracking must never block the PDF response
  const source = siteUrl.replace(/^https?:\/\//, '').toLowerCase() || 'ryan-realty.com'
  sendEvent({
    type: 'Property Inquiry',
    person: { emails: [{ value: session.user.email }] },
    source,
    sourceUrl: `${siteUrl}${listingHref}`,
    message: 'Downloaded CMA / Value Report (high intent)',
    property: {
      street: pdfData.address,
      url: `${siteUrl}${listingHref}`,
    },
  }).catch((err) => console.error('[cma-pdf] FUB tracking failed:', err))

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="cma-${propertyId.slice(0, 8)}.pdf"`,
    },
  })
}
