import { NextResponse } from 'next/server'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { getSession } from '@/app/actions/auth'
import { getCachedCMA, computeCMA } from '@/lib/cma'
import { CMAPdfDocument } from '@/lib/pdf/cma-pdf'
import { createClient } from '@supabase/supabase-js'
import { sendEvent, findPersonByEmail } from '@/lib/followupboss'
import { canonicallyTagLead } from '@/lib/canonical-lead-tagger'
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

  void getServiceSupabase
  const { getPropertyById, getCityListings: getCityListingsDAL } = await import('@/lib/data')
  const p = await getPropertyById(propertyId)

  // Find listing via listing_tile_mv (city + optional postal + street match).
  type CmaPdfListingRow = { ListingKey?: string; BedroomsTotal?: number; BathroomsTotal?: number; TotalLivingAreaSqFt?: number; PhotoURL?: string; ListAgentName?: string }
  let listingRow: CmaPdfListingRow | null = null
  if (p?.city) {
    const tiles = await getCityListingsDAL(p.city, {
      status: 'all',
      sort: 'newest',
      limit: 500,
      postalCode: p.postal_code && /^\d{5}$/.test(p.postal_code) ? p.postal_code : undefined,
    })
    const match = p.street_number
      ? tiles.find((t) => String(t.streetNumber ?? '') === String(p.street_number))
      : tiles[0]
    if (match) {
      listingRow = {
        ListingKey: match.listingKey,
        BedroomsTotal: match.beds ?? undefined,
        BathroomsTotal: match.baths ?? undefined,
        TotalLivingAreaSqFt: match.sqft ?? undefined,
        PhotoURL: match.photoUrl ?? undefined,
      }
    }
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
  const leadEmail = session.user.email
  sendEvent({
    type: 'Property Inquiry',
    person: { emails: [{ value: leadEmail }] },
    source,
    sourceUrl: `${siteUrl}${listingHref}`,
    message: 'Downloaded CMA / Value Report (high intent)',
    property: {
      street: pdfData.address,
      url: `${siteUrl}${listingHref}`,
    },
  })
    .then(async () => {
      // A CMA / value-report download is a high-intent SELLER signal — tag it into
      // the canonical audience workflow so it enters the seller pipeline + is
      // measured, instead of landing in FUB untagged. Best-effort, after creation.
      const person = await findPersonByEmail(leadEmail)
      if (person?.id) {
        await canonicallyTagLead({ fubPersonId: person.id, audience: 'seller', source: 'cma-request', tier: 'warm' })
      }
    })
    .catch((err) => console.error('[cma-pdf] FUB tracking failed:', err))

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="cma-${propertyId.slice(0, 8)}.pdf"`,
    },
  })
}
