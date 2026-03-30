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
  const ids = idsRaw.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 4)

  if (ids.length === 0) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <CompareClient listings={[]} />
      </main>
    )
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  let listings: CompareListingData[] = []

  if (url?.trim() && key?.trim()) {
    const supabase = createClient(url, key)
    const select = 'ListingKey, ListNumber, ListPrice, BedroomsTotal, BathroomsTotal, TotalLivingAreaSqFt, StreetNumber, StreetName, City, State, PostalCode, SubdivisionName, PhotoURL, Latitude, Longitude, StandardStatus, PropertyType, OnMarketDate, LotSizeAcres, YearBuilt, GarageSpaces, AssociationFee, TaxAnnualAmount'

    // Fetch listings by both ListNumber and ListingKey (match whichever column hits)
    const [byNumber, byKey] = await Promise.all([
      supabase.from('listings').select(select).in('ListNumber', ids),
      supabase.from('listings').select(select).in('ListingKey', ids),
    ])

    const allRows = [...(byNumber.data ?? []), ...(byKey.data ?? [])]
    // Dedupe by ListingKey
    const seen = new Set<string>()
    const deduped = allRows.filter((r) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const k = String((r as any).ListingKey ?? (r as any).ListNumber ?? '')
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })

    // Also fetch hero photos
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

    listings = deduped.map((r) => {
      const row = r as Record<string, unknown>
      const listingKey = String(row.ListingKey ?? row.ListNumber ?? '')
      const streetParts = [row.StreetNumber, row.StreetName].filter(Boolean).join(' ').trim()
      const addressParts = [streetParts, row.City, row.State, row.PostalCode].filter(Boolean)
      return {
        listingKey,
        address: addressParts.join(', '),
        city: (row.City as string) ?? null,
        state: (row.State as string) ?? null,
        postalCode: (row.PostalCode as string) ?? null,
        subdivision: (row.SubdivisionName as string) ?? null,
        price: (row.ListPrice as number) ?? null,
        beds: (row.BedroomsTotal as number) ?? null,
        baths: (row.BathroomsTotal as number) ?? null,
        sqft: (row.TotalLivingAreaSqFt as number) ?? null,
        lotSizeAcres: (row.LotSizeAcres as number) ?? null,
        yearBuilt: (row.YearBuilt as number) ?? null,
        garageSpaces: (row.GarageSpaces as number) ?? null,
        hoa: (row.AssociationFee as number) ?? null,
        taxes: (row.TaxAnnualAmount as number) ?? null,
        dom: daysOnMarket(row.OnMarketDate as string),
        status: (row.StandardStatus as string) ?? null,
        propertyType: (row.PropertyType as string) ?? null,
        photoUrl: photoMap.get(listingKey) ?? (row.PhotoURL as string) ?? null,
        latitude: (row.Latitude as number) ?? null,
        longitude: (row.Longitude as number) ?? null,
      }
    })
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <CompareClient listings={listings} />
    </main>
  )
}
