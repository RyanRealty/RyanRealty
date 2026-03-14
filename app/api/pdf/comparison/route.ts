import { NextResponse } from 'next/server'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { ComparisonPdfDocument, type ComparisonListing } from '@/lib/pdf/comparison-pdf'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit } from '@/lib/rate-limit'

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) throw new Error('Supabase service role not configured')
  return createClient(url, key)
}

export async function POST(request: Request) {
  const rl = await checkRateLimit(request, 'strict')
  if (rl.limited) return rl.response

  let body: { listingIds?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const ids = (body.listingIds ?? []).map((s) => String(s).trim()).filter(Boolean).slice(0, 4)
  if (ids.length === 0) {
    return NextResponse.json({ error: 'Missing listingIds' }, { status: 400 })
  }

  const supabase = getServiceSupabase()
  const select = 'ListingKey, ListNumber, ListPrice, BedroomsTotal, BathroomsTotal, TotalLivingAreaSqFt, StreetNumber, StreetName, City, State, PostalCode, PhotoURL'

  const [byNumber, byKey] = await Promise.all([
    supabase.from('listings').select(select).in('ListNumber', ids),
    supabase.from('listings').select(select).in('ListingKey', ids),
  ])

  const allRows = [...(byNumber.data ?? []), ...(byKey.data ?? [])]
  const seen = new Set<string>()
  const deduped = allRows.filter((r) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const k = String((r as any).ListingKey ?? (r as any).ListNumber ?? '')
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  // Fetch hero photos
  const listingKeys = deduped.map((r) => String((r as Record<string, unknown>).ListingKey ?? ''))
  const { data: photos } = await supabase
    .from('listing_photos')
    .select('listing_key, photo_url')
    .in('listing_key', listingKeys)
    .eq('is_hero', true)

  const photoMap = new Map<string, string>()
  for (const p of (photos ?? []) as { listing_key: string; photo_url: string }[]) {
    if (p.photo_url) photoMap.set(p.listing_key, p.photo_url)
  }

  const listings: ComparisonListing[] = deduped.map((r) => {
    const row = r as Record<string, unknown>
    const lk = String(row.ListingKey ?? '')
    const streetParts = [row.StreetNumber, row.StreetName].filter(Boolean).join(' ').trim()
    const addressParts = [streetParts, row.City, row.State, row.PostalCode].filter(Boolean)
    return {
      address: addressParts.join(', '),
      price: (row.ListPrice as number) ?? 0,
      beds: (row.BedroomsTotal as number) ?? null,
      baths: (row.BathroomsTotal as number) ?? null,
      sqft: (row.TotalLivingAreaSqFt as number) ?? null,
      photoUrl: photoMap.get(lk) ?? (row.PhotoURL as string) ?? null,
    }
  })

  const doc = React.createElement(ComparisonPdfDocument, { data: { listings } })
  type DocElement = Parameters<typeof renderToBuffer>[0]
  const pdfBuffer = await renderToBuffer(doc as DocElement)

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="property-comparison.pdf"',
    },
  })
}
