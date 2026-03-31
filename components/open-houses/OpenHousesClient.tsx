'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { trackEvent } from '@/lib/tracking'
import type { OpenHouseWithListing } from '@/app/actions/open-houses'
import type { OpenHousesFilters } from '@/app/actions/open-houses'
import dynamic from 'next/dynamic'

const ListingMapGoogle = dynamic(
  () => import('@/components/ListingMapGoogle'),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground"
        style={{ minHeight: '400px' }}
      >
        Loading map…
      </div>
    ),
  }
)
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { listingDetailPath } from '@/lib/slug'

type ViewMode = 'map' | 'list' | 'calendar'

function formatTime(t: string | null): string {
  if (!t) return ''
  const parts = t.toString().split(':')
  const h = parseInt(parts[0] ?? '0', 10)
  const m = parts[1] ? parseInt(parts[1].slice(0, 2), 10) : 0
  if (h === 0 && m === 0) return ''
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`
}

function formatDate(d: string): string {
  return new Date(d + 'Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

type Props = {
  initialOpenHouses: OpenHouseWithListing[]
  initialFilters?: OpenHousesFilters
}

export default function OpenHousesClient({ initialOpenHouses, initialFilters }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [viewMode, setViewMode] = useState<ViewMode>('list')

  useEffect(() => {
    trackEvent('open_house_page_view', { count: initialOpenHouses.length })
  }, [initialOpenHouses.length])

  const mapListings = useMemo(
    () =>
      initialOpenHouses
        .filter((oh) => oh.latitude != null && oh.longitude != null)
        .map((oh) => ({
          ListingKey: oh.listing_key,
          ListPrice: oh.list_price,
          Latitude: oh.latitude!,
          Longitude: oh.longitude!,
          StreetNumber: oh.street_number,
          StreetName: oh.street_name,
          City: oh.city,
          State: oh.state,
          PostalCode: oh.postal_code,
          BedroomsTotal: oh.beds_total,
          BathroomsTotal: oh.baths_full,
          _timeWindow: [formatTime(oh.start_time), formatTime(oh.end_time)].filter(Boolean).join(' – ') || 'Open house',
        })),
    [initialOpenHouses]
  )

  const updateFilters = (updates: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(updates)) {
      if (v === undefined || v === '') next.delete(k)
      else next.set(k, v)
    }
    router.push(`/open-houses?${next.toString()}`)
  }

  const address = (oh: OpenHouseWithListing) =>
    oh.unparsed_address || [oh.street_number, oh.street_name, oh.city, oh.state, oh.postal_code].filter(Boolean).join(', ')

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h2 className="sr-only">Browse open houses</h2>
      <p className="text-muted-foreground">
        This weekend and upcoming in Central Oregon. Add to calendar or RSVP from the listing page.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <div className="flex rounded-lg border border-border bg-card p-2">
          {(['list', 'map', 'calendar'] as const).map((mode) => (
            <Button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize ${viewMode === mode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
            >
              {mode}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            type="date"
            value={initialFilters?.dateFrom ?? ''}
            onChange={(e) => updateFilters({ dateFrom: e.target.value || undefined })}
            className="rounded-lg border border-border px-3 py-2 text-sm"
          />
          <Input
            type="date"
            value={initialFilters?.dateTo ?? ''}
            onChange={(e) => updateFilters({ dateTo: e.target.value || undefined })}
            className="rounded-lg border border-border px-3 py-2 text-sm"
          />
          <Input
            type="text"
            placeholder="City"
            value={initialFilters?.city ?? ''}
            onChange={(e) => updateFilters({ city: e.target.value || undefined })}
            className="w-28 rounded-lg border border-border px-3 py-2 text-sm"
          />
          <Input
            type="number"
            placeholder="Min price"
            value={initialFilters?.minPrice ?? ''}
            onChange={(e) => updateFilters({ minPrice: e.target.value || undefined })}
            className="w-28 rounded-lg border border-border px-3 py-2 text-sm"
          />
          <Input
            type="number"
            placeholder="Max price"
            value={initialFilters?.maxPrice ?? ''}
            onChange={(e) => updateFilters({ maxPrice: e.target.value || undefined })}
            className="w-28 rounded-lg border border-border px-3 py-2 text-sm"
          />
          <Select value={String(initialFilters?.beds ?? '') || '__all__'} onValueChange={(v) => updateFilters({ beds: v === '__all__' ? undefined : v })}>
            <SelectTrigger className="rounded-lg px-3 py-2 text-sm">
              <SelectValue placeholder="Beds" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Beds</SelectItem>
              {[1, 2, 3, 4, 5].map((n) => (
                <SelectItem key={n} value={String(n)}>{n}+</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(initialFilters?.baths ?? '') || '__all__'} onValueChange={(v) => updateFilters({ baths: v === '__all__' ? undefined : v })}>
            <SelectTrigger className="rounded-lg px-3 py-2 text-sm">
              <SelectValue placeholder="Baths" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Baths</SelectItem>
              {[1, 2, 3, 4].map((n) => (
                <SelectItem key={n} value={String(n)}>{n}+</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {initialOpenHouses.length === 0 && (
        <p className="mt-8 text-muted-foreground">No open houses match your filters. Try a different date range.</p>
      )}

      {viewMode === 'map' && initialOpenHouses.length > 0 && (
        <div className="mt-8">
          <ListingMapGoogle
            listings={mapListings.map((l) => ({
              ...l,
              Latitude: l.Latitude,
              Longitude: l.Longitude,
            }))}
            fitBounds
          />
        </div>
      )}

      {viewMode === 'list' && initialOpenHouses.length > 0 && (
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {initialOpenHouses.map((oh) => (
            <li key={oh.id}>
              <Link
                href={listingDetailPath(oh.listing_key, {
                  streetNumber: oh.street_number,
                  streetName: oh.street_name,
                  city: oh.city,
                  state: oh.state,
                  postalCode: oh.postal_code,
                }, undefined, { mlsNumber: oh.list_number })}
                className="block overflow-hidden rounded-lg border border-border bg-card shadow-sm transition hover:shadow-md"
              >
                <div className="relative aspect-[4/3] bg-muted">
                  {oh.photo_url ? (
                    <Image src={oh.photo_url} alt={`${address(oh)} — open house`} fill className="object-cover" sizes="(max-width:640px) 100vw, 320px" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">No photo</div>
                  )}
                  <span className="absolute left-2 top-2 rounded-md bg-destructive px-2 py-1 text-xs font-semibold text-destructive-foreground">
                    <span aria-hidden>ðŸ“…</span> {formatDate(oh.event_date)} · {formatTime(oh.start_time)} – {formatTime(oh.end_time)}
                  </span>
                </div>
                <div className="p-4">
                  <p className="text-xl font-bold text-primary">
                    ${(oh.list_price ?? 0).toLocaleString()}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{address(oh)}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {oh.beds_total ?? '—'} bed · {oh.baths_full ?? '—'} bath
                    {oh.living_area != null && ` · ${Number(oh.living_area).toLocaleString()} sq ft`}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {viewMode === 'calendar' && initialOpenHouses.length > 0 && (
        <div className="mt-8 overflow-x-auto">
          <div className="min-w-[600px] rounded-lg border border-border bg-card p-4">
            <p className="mb-4 font-semibold text-primary">Upcoming by date</p>
            <ul className="space-y-2">
              {initialOpenHouses.map((oh) => (
                <li key={oh.id}>
                  <Link
                    href={listingDetailPath(oh.listing_key, {
                      streetNumber: oh.street_number,
                      streetName: oh.street_name,
                      city: oh.city,
                      state: oh.state,
                      postalCode: oh.postal_code,
                    }, undefined, { mlsNumber: oh.list_number })}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3 hover:bg-muted"
                  >
                    <span className="font-medium text-primary">{formatDate(oh.event_date)}</span>
                    <span className="text-muted-foreground">
                      {formatTime(oh.start_time)} – {formatTime(oh.end_time)}
                    </span>
                    <span className="text-sm">{address(oh)}</span>
                    <span className="text-sm font-semibold">${(oh.list_price ?? 0).toLocaleString()}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
