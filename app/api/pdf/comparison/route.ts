import { NextResponse } from 'next/server'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { ComparisonPdfDocument } from '@/lib/pdf/comparison-pdf'
import { createClient } from '@supabase/supabase-js'

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) throw new Error('Supabase service role not configured')
  return createClient(url, key)
}

export async function POST(request: Request) {
  let body: { listingIds?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const ids = Array.isArray(body.listingIds) ? body.listingIds.filter((x): x is string => typeof x === 'string').slice(0, 4) : []
  if (ids.length === 0) {
    return NextResponse.json({ error: 'Missing listingIds array' }, { status: 400 })
  }

  const supabase = getServiceSupabase()
  const { data: rows } = await supabase
    .from('listings')
    .select('listing_key, list_price, beds_total, baths_full, living_area')
    .in('listing_key', ids)
  const listings = rows ?? []
  const propIds = [...new Set(listings.map((r) => (r as { property_id?: string }).property_id).filter(Boolean))]
  const { data: props } = propIds.length > 0
    ? await supabase.from('properties').select('id, unparsed_address').in('id', propIds)
    : { data: [] }
  const propMap = new Map((props ?? []).map((p) => [(p as { id: string }).id, (p as { unparsed_address: string }).unparsed_address]))
  const { data: photos } = await supabase.from('listing_photos').select('listing_key, photo_url').eq('is_hero', true).in('listing_key', ids)
  const photoMap = new Map((photos ?? []).map((r) => [(r as { listing_key: string }).listing_key, (r as { photo_url: string }).photo_url]))

  const pdfListings = listings.map((l) => {
    const r = l as Record<string, unknown>
    const addr = propMap.get(r.property_id as string) ?? String(r.unparsed_address ?? '')
    return {
      address: addr,
      price: Number(r.list_price ?? 0),
      beds: r.beds_total != null ? Number(r.beds_total) : null,
      baths: r.baths_full != null ? Number(r.baths_full) : null,
      sqft: r.living_area != null ? Number(r.living_area) : null,
      photoUrl: photoMap.get(r.listing_key as string) ?? null,
    }
  })

  const doc = React.createElement(ComparisonPdfDocument, { data: { listings: pdfListings } })
  type DocElement = Parameters<typeof renderToBuffer>[0]
  const buffer = await renderToBuffer(doc as DocElement)
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="comparison.pdf"',
    },
  })
}
