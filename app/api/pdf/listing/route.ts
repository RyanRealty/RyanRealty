import { NextResponse } from 'next/server'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { ListingPdfDocument } from '@/lib/pdf/listing-pdf'
import { checkRateLimit } from '@/lib/rate-limit'
import { listingDetailPath } from '@/lib/slug'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

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

  const { getListingRawRowByKey, getListingDetailPhotos, getListingDetailAgents } = await import('@/lib/data')
  const listing = await getListingRawRowByKey(listingKey)
  if (!listing) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
  }
  const [photos, agents] = await Promise.all([
    getListingDetailPhotos(listingKey),
    getListingDetailAgents(listingKey),
  ])
  const photo = photos.find((p) => p.is_hero === true) ?? photos[0] ?? null
  const agent = agents[0] ?? null

  const l = listing as Record<string, unknown>
  // The wide raw row carries unparsed_address + city/state/postal directly.
  const p: Record<string, unknown> = {
    unparsed_address: l.unparsed_address ?? null,
    city: l.City ?? l.city ?? null,
    state: l.State ?? l.state ?? null,
    postal_code: l.PostalCode ?? l.postal_code ?? null,
  }
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
    listingUrl: `${siteUrl}${listingDetailPath(
      listingKey,
      { city: p.city != null ? String(p.city) : null, state: p.state != null ? String(p.state) : null, postalCode: p.postal_code != null ? String(p.postal_code) : null },
      { city: p.city != null ? String(p.city) : null }
    )}`,
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
