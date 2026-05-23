import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import CompareClient, { type CompareListingData } from '@/components/compare/CompareClient'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const metadata: Metadata = {
  title: 'Compare Properties',
  description: 'Compare up to 4 Central Oregon homes side by side — price, size, features, and more.',
  alternates: { canonical: `${siteUrl}/compare` },
  robots: { index: false, follow: true },
  openGraph: {
    title: 'Compare Properties | Ryan Realty',
    description: 'Compare up to 4 Central Oregon homes side by side — price, size, features, and more.',
    url: `${siteUrl}/compare`,
    type: 'website',
    siteName: 'Ryan Realty',
    images: [{ url: `${siteUrl}/api/og?type=default`, width: 1200, height: 630, alt: 'Compare properties | Ryan Realty' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Compare Properties | Ryan Realty',
    description: 'Compare up to 4 Central Oregon homes side by side — price, size, features, and more.',
    images: [`${siteUrl}/api/og?type=default`],
  },
}

export const revalidate = 60

function daysOnMarket(d: string | null | undefined): number | null {
  if (!d) return null
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return null
  const days = Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000))
  return days >= 0 ? days : null
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const idsRaw = typeof params.ids === 'string' ? params.ids : ''
  const ids = decodeURIComponent(idsRaw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4)

  if (ids.length === 0) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <CompareClient listings={[]} />
      </main>
    )
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const key = serviceKey?.trim() ? serviceKey : anonKey
  let listings: CompareListingData[] = []

  if (url?.trim() && key?.trim()) {
    void createClient
    const { getListingTiles, getListingDetailPhotos } = await import('@/lib/data')

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

    const photoArrays = await Promise.all(
      deduped.map((t) => getListingDetailPhotos(t.listingKey).catch(() => []))
    )
    const photoMap = new Map<string, string>()
    deduped.forEach((t, idx) => {
      const photos = photoArrays[idx] ?? []
      const hero = photos.find((p) => p.is_hero === true) ?? photos[0]
      if (hero?.photo_url) photoMap.set(t.listingKey, hero.photo_url)
    })

    listings = deduped.map((t) => {
      const streetParts = [t.streetNumber, t.streetName].filter(Boolean).join(' ').trim()
      const addressParts = [streetParts, t.city, 'OR', t.postalCode].filter(Boolean)
      return {
        listingKey: t.listingKey,
        address: addressParts.join(', '),
        city: t.city,
        state: 'OR',
        postalCode: t.postalCode,
        subdivision: t.subdivisionName,
        price: t.listPrice,
        beds: t.beds,
        baths: t.baths,
        sqft: t.sqft,
        lotSizeAcres: t.lotSizeAcres,
        yearBuilt: t.yearBuilt,
        garageSpaces: t.garageSpaces,
        hoa: null,
        taxes: null,
        dom: t.dom,
        status: t.status,
        propertyType: t.propertyType,
        photoUrl: photoMap.get(t.listingKey) ?? t.photoUrl ?? null,
        latitude: t.lat,
        longitude: t.lng,
      }
    })
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <CompareClient listings={listings} />
    </main>
  )
}
