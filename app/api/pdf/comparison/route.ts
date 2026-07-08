import { NextResponse } from 'next/server'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { ComparisonPdfDocument, type ComparisonListing } from '@/lib/pdf/comparison-pdf'
import { checkRateLimit } from '@/lib/rate-limit'

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

  const { getListingTiles, getListingDetailPhotos } = await import('@/lib/data')
  // DAL: pull tiles by both keying paths (ListingKey OR ListNumber).
  const [byNumberTiles, byKeyTiles] = await Promise.all([
    getListingTiles({ listNumbers: ids, status: 'all', limit: 50 }),
    getListingTiles({ listingKeys: ids, status: 'all', limit: 50 }),
  ])
  const allTiles = [...byNumberTiles, ...byKeyTiles]
  const seen = new Set<string>()
  const deduped = allTiles.filter((t) => {
    const k = t.listingKey || t.listNumber || ''
    if (!k || seen.has(k)) return false
    seen.add(k)
    return true
  })

  // Hero photos: 4-way parallel detail-photo fetch for the (capped) listing set.
  const photoArrays = await Promise.all(
    deduped.map((t) => getListingDetailPhotos(t.listingKey).catch(() => []))
  )
  const photoMap = new Map<string, string>()
  deduped.forEach((t, idx) => {
    const photos = photoArrays[idx] ?? []
    const hero = photos.find((p) => p.is_hero === true) ?? photos[0]
    if (hero?.photo_url) photoMap.set(t.listingKey, hero.photo_url)
  })

  const listings: ComparisonListing[] = deduped.map((t) => {
    const streetParts = [t.streetNumber, t.streetName, t.streetSuffix].filter(Boolean).join(' ').trim()
    const addressParts = [streetParts, t.city, 'OR', t.postalCode].filter(Boolean)
    return {
      address: addressParts.join(', '),
      price: t.listPrice ?? 0,
      beds: t.beds,
      baths: t.baths,
      sqft: t.sqft,
      photoUrl: photoMap.get(t.listingKey) ?? t.photoUrl ?? null,
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
