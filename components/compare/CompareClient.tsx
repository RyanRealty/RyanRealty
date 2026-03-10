'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { trackEvent } from '@/lib/tracking'
import type { CompareListingRow } from '@/app/compare/page'
import ListingMapGoogle from '@/components/ListingMapGoogle'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryanrealty.com').replace(/\/$/, '')

const ROWS: { key: keyof CompareListingRow; label: string; format: (v: unknown) => string }[] = [
  { key: 'list_price', label: 'Price', format: (v) => (v != null && Number(v) > 0 ? `$${Number(v).toLocaleString()}` : '—') },
  { key: 'beds_total', label: 'Beds', format: (v) => (v != null ? String(v) : '—') },
  { key: 'baths_full', label: 'Baths', format: (v) => (v != null ? String(v) : '—') },
  { key: 'living_area', label: 'Sq ft', format: (v) => (v != null && Number(v) > 0 ? Number(v).toLocaleString() : '—') },
  { key: 'lot_size_sqft', label: 'Lot size', format: (v) => (v != null && Number(v) > 0 ? `${Number(v).toLocaleString()} sq ft` : '—') },
  { key: 'year_built', label: 'Year built', format: (v) => (v != null ? String(v) : '—') },
  { key: 'association_fee', label: 'HOA', format: (v) => (v != null && Number(v) > 0 ? `$${Number(v).toLocaleString()}` : '—') },
  { key: 'tax_amount', label: 'Property taxes', format: (v) => (v != null && Number(v) > 0 ? `$${Number(v).toLocaleString()}` : '—') },
  { key: 'days_on_market', label: 'DOM', format: (v) => (v != null ? String(v) : '—') },
  { key: 'subdivision_name', label: 'Community', format: (v) => (v ? String(v) : '—') },
  { key: 'garage_spaces', label: 'Garage', format: (v) => (v != null ? String(v) : '—') },
  { key: 'standard_status', label: 'Status', format: (v) => (v ? String(v) : '—') },
]

function bestIndex(listings: CompareListingRow[], key: keyof CompareListingRow): number | null {
  if (key === 'list_price' || key === 'association_fee' || key === 'tax_amount' || key === 'days_on_market') {
    const nums = listings.map((l) => (l[key] != null ? Number(l[key]) : NaN))
    const valid = nums.filter((n) => !Number.isNaN(n))
    if (valid.length === 0) return null
    if (key === 'days_on_market') return nums.indexOf(Math.min(...valid))
    return nums.indexOf(Math.min(...valid))
  }
  if (key === 'living_area' || key === 'lot_size_sqft' || key === 'year_built' || key === 'beds_total' || key === 'baths_full' || key === 'garage_spaces') {
    const nums = listings.map((l) => (l[key] != null ? Number(l[key]) : NaN))
    const valid = nums.filter((n) => !Number.isNaN(n))
    if (valid.length === 0) return null
    return nums.indexOf(Math.max(...valid))
  }
  return null
}

type Props = { listings: CompareListingRow[] }

export default function CompareClient({ listings }: Props) {
  const router = useRouter()

  useEffect(() => {
    trackEvent('view_comparison', {
      listing_ids: listings.map((l) => l.listing_key),
      count: listings.length,
    })
  }, [listings])

  const mapListings = listings
    .filter((l) => l.latitude != null && l.longitude != null)
    .map((l, i) => ({
      ListingKey: l.listing_key,
      ListPrice: l.list_price,
      Latitude: l.latitude!,
      Longitude: l.longitude!,
      StreetNumber: null,
      StreetName: null,
      City: null,
      State: null,
      PostalCode: null,
      BedroomsTotal: l.beds_total,
      BathroomsTotal: l.baths_full,
    }))

  const handleShare = () => {
    const ids = listings.map((l) => l.listing_key).join(',')
    const url = `${siteUrl}/compare?ids=${encodeURIComponent(ids)}`
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url)
    trackEvent('share_listing', { share_method: 'comparison', listing_ids: listings.map((l) => l.listing_key) })
  }

  const handleDownloadPdf = async () => {
    const res = await fetch('/api/pdf/comparison', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingIds: listings.map((l) => l.listing_key) }),
    })
    if (!res.ok) return
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'comparison.pdf'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-bold text-[var(--brand-navy)]">Compare Homes</h1>

      <div className="mt-6 grid gap-4" style={{ gridTemplateColumns: `repeat(${listings.length}, minmax(0, 1fr))` }}>
        {listings.map((listing) => (
          <div key={listing.listing_key} className="flex flex-col">
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-[var(--gray-bg)]">
              {listing.photo_url ? (
                <Image src={listing.photo_url} alt="" fill className="object-cover" sizes="300px" />
              ) : (
                <div className="flex h-full items-center justify-center text-[var(--gray-muted)]">No photo</div>
              )}
            </div>
            <p className="mt-2 font-semibold text-[var(--brand-navy)]">
              ${(listing.list_price ?? 0).toLocaleString()}
            </p>
            <p className="text-sm text-[var(--gray-secondary)]">{listing.unparsed_address ?? listing.listing_key}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Link
                href={`/listings/${encodeURIComponent(listing.listing_key)}`}
                className="text-sm font-medium text-[var(--accent)] underline"
              >
                View
              </Link>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <tbody>
            {ROWS.map(({ key, label, format }) => {
              const best = bestIndex(listings, key)
              return (
                <tr key={key} className="border-b border-[var(--gray-border)]">
                  <th className="py-3 pr-4 font-medium text-[var(--gray-secondary)]">{label}</th>
                  {listings.map((listing, i) => (
                    <td
                      key={listing.listing_key}
                      className={`py-3 ${best === i ? 'bg-[var(--success)]/10' : ''}`}
                    >
                      {format(listing[key])}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {mapListings.length > 0 && (
        <div className="mt-8">
          <ListingMapGoogle listings={mapListings} fitBounds />
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-4">
        <button
          type="button"
          onClick={handleShare}
          className="rounded-lg bg-[var(--gray-bg)] px-4 py-2 text-sm font-medium text-[var(--brand-navy)] hover:bg-[var(--gray-border)]"
        >
          Share This Comparison
        </button>
        <button
          type="button"
          onClick={handleDownloadPdf}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--brand-navy)] hover:bg-[var(--accent-hover)]"
        >
          Download as PDF
        </button>
      </div>
    </div>
  )
}
