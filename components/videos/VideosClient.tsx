'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { VideoListingRow } from '@/app/actions/videos'
import VideoPlayer from '@/components/video/VideoPlayer'
import { HugeiconsIcon } from '@hugeicons/react'
import { PlayIcon, Cancel01Icon } from '@hugeicons/core-free-icons'
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { listingDetailPath } from '@/lib/slug'

type Props = { initialListings: VideoListingRow[] }

export default function VideosClient({ initialListings }: Props) {
  const [filterCommunity, setFilterCommunity] = useState('')
  const [filterCity, setFilterCity] = useState('')
  const [sort, setSort] = useState<'newest' | 'most_viewed'>('newest')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [muted, setMuted] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = initialListings.filter((l) => {
    if (filterCommunity && l.subdivision_name !== filterCommunity) return false
    if (filterCity && l.city !== filterCity) return false
    return true
  })

  const selected = selectedKey ? filtered.find((l) => l.listing_key === selectedKey) : null

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-bold text-primary">Video Tours</h1>
      <p className="mt-2 text-muted-foreground">
        Browse video tours of Central Oregon homes. Click to play in a lightbox.
      </p>

      <div className="mt-6 flex flex-wrap gap-4">
        <Select value={filterCommunity || '__all__'} onValueChange={(v) => setFilterCommunity(v === '__all__' ? '' : v)}>
          <SelectTrigger className="rounded-lg px-3 py-2 text-sm">
            <SelectValue placeholder="All communities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All communities</SelectItem>
            {[...new Set(initialListings.map((l) => l.subdivision_name).filter(Boolean))].map((c) => (
              <SelectItem key={c} value={c ?? '__all__'}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterCity || '__all__'} onValueChange={(v) => setFilterCity(v === '__all__' ? '' : v)}>
          <SelectTrigger className="rounded-lg px-3 py-2 text-sm">
            <SelectValue placeholder="All cities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All cities</SelectItem>
            {[...new Set(initialListings.map((l) => l.city).filter(Boolean))].map((c) => (
              <SelectItem key={c} value={c ?? '__all__'}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as 'newest' | 'most_viewed')}>
          <SelectTrigger className="rounded-lg px-3 py-2 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="most_viewed">Most viewed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Desktop: grid */}
      <div className="mt-8 hidden md:block">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((listing) => (
            <div key={listing.listing_key} className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <Button
                type="button"
                onClick={() => setSelectedKey(listing.listing_key)}
                className="relative block aspect-video w-full bg-foreground"
              >
                {listing.photo_url ? (
                  <Image src={listing.photo_url} alt={`${listing.unparsed_address || listing.subdivision_name || 'Property'} — video thumbnail`} fill className="object-cover" sizes="400px" />
                ) : (
                  <div className="flex h-full items-center justify-center text-primary-foreground">No image</div>
                )}
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-foreground/40 p-4 text-primary-foreground">
                  <HugeiconsIcon icon={PlayIcon} className="h-16 w-16" />
                </span>
                <span className="absolute bottom-2 left-2 rounded bg-foreground/70 px-2 py-1 text-sm font-medium text-primary-foreground">
                  ${(listing.list_price ?? 0).toLocaleString()}
                </span>
                <span className="absolute bottom-2 right-2 flex flex-col items-end gap-0.5 text-right text-sm font-medium text-primary-foreground drop-shadow">
                  <span>{listing.unparsed_address ?? listing.listing_key}</span>
                  {listing.video_source === 'virtual_tour' && (
                    <span className="rounded bg-foreground/60 px-1.5 py-0.5 text-xs">Virtual tour</span>
                  )}
                </span>
              </Button>
              <div className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-primary">${(listing.list_price ?? 0).toLocaleString()}</p>
                  {listing.video_source === 'virtual_tour' && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">Virtual tour</span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{listing.unparsed_address}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {listing.beds_total ?? '—'} bed · {listing.baths_full ?? '—'} bath
                  {listing.living_area != null && ` · ${Number(listing.living_area).toLocaleString()} sq ft`}
                </p>
                <Link
                  href={listingDetailPath(
                    listing.listing_key,
                    { streetName: listing.unparsed_address ?? undefined, city: listing.city ?? undefined },
                    { city: listing.city ?? undefined, subdivision: listing.subdivision_name ?? undefined }
                  )}
                  className="mt-2 inline-block text-sm font-medium text-accent-foreground"
                >
                  View Listing
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile: vertical scroll (Reels-style) */}
      <div className="mt-8 md:hidden" ref={containerRef}>
        <div className="flex snap-y snap-mandatory flex-col gap-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          {filtered.map((listing) => (
            <div key={listing.listing_key} className="flex snap-start flex-col">
              <div className="relative aspect-[9/16] w-full overflow-hidden rounded-lg bg-foreground">
                <VideoPlayer
                  videoUrl={listing.video_url}
                  listingId={listing.listing_key}
                  posterUrl={listing.photo_url ?? undefined}
                  className="h-full w-full object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-foreground/80 to-transparent p-4 text-primary-foreground">
                  <p className="font-semibold">${(listing.list_price ?? 0).toLocaleString()}</p>
                  <p className="text-sm">{listing.unparsed_address}</p>
                  <p className="text-xs opacity-90">
                    {listing.beds_total ?? '—'} bed · {listing.baths_full ?? '—'} bath
                    {listing.living_area != null && ` · ${Number(listing.living_area).toLocaleString()} sq ft`}
                  </p>
                </div>
                <Link
                  href={listingDetailPath(
                    listing.listing_key,
                    { streetName: listing.unparsed_address ?? undefined, city: listing.city ?? undefined },
                    { city: listing.city ?? undefined, subdivision: listing.subdivision_name ?? undefined }
                  )}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-card/90 px-3 py-2 text-sm font-medium text-primary"
                >
                  View Listing
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox modal */}
      {selectedKey && selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/90 p-4"
          onClick={() => setSelectedKey(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Video lightbox"
        >
          <Button type="button" onClick={() => setSelectedKey(null)} className="absolute right-4 top-4 text-primary-foreground" aria-label="Close">
            <HugeiconsIcon icon={Cancel01Icon} className="h-8 w-8" />
          </Button>
          <div className="flex w-full max-w-5xl flex-col gap-4 md:flex-row" onClick={(e) => e.stopPropagation()}>
            <div className="flex-1">
              <VideoPlayer
                videoUrl={selected.video_url}
                listingId={selected.listing_key}
                posterUrl={selected.photo_url ?? undefined}
                className="aspect-video w-full"
              />
              {selected.video_source === 'virtual_tour' && (
                <p className="mt-2 text-center text-sm text-primary-foreground/90">Virtual tour — opens in player or new tab</p>
              )}
            </div>
            <div className="w-full bg-card p-4 md:w-80">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xl font-bold text-primary">${(selected.list_price ?? 0).toLocaleString()}</p>
                {selected.video_source === 'virtual_tour' && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">Virtual tour</span>
                )}
              </div>
              <p className="text-muted-foreground">{selected.unparsed_address}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {selected.beds_total ?? '—'} bed · {selected.baths_full ?? '—'} bath
                {selected.living_area != null && ` · ${Number(selected.living_area).toLocaleString()} sq ft`}
              </p>
              <Link
                href={listingDetailPath(
                  selected.listing_key,
                  { streetName: selected.unparsed_address ?? undefined, city: selected.city ?? undefined },
                  { city: selected.city ?? undefined, subdivision: selected.subdivision_name ?? undefined }
                )}
                className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-primary"
              >
                View Listing
              </Link>
            </div>
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <p className="mt-8 text-muted-foreground">No video tours match your filters.</p>
      )}
    </div>
  )
}
