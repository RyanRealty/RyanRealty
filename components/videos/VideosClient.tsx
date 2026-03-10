'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { VideoListingRow } from '@/app/actions/videos'
import VideoPlayer from '@/components/video/VideoPlayer'

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
      <h1 className="text-3xl font-bold text-[var(--brand-navy)]">Video Tours</h1>
      <p className="mt-2 text-[var(--gray-secondary)]">
        Browse video tours of Central Oregon homes. Click to play in a lightbox.
      </p>

      <div className="mt-6 flex flex-wrap gap-4">
        <select
          value={filterCommunity}
          onChange={(e) => setFilterCommunity(e.target.value)}
          className="rounded-lg border border-[var(--gray-border)] px-3 py-2 text-sm"
        >
          <option value="">All communities</option>
          {[...new Set(initialListings.map((l) => l.subdivision_name).filter(Boolean))].map((c) => (
            <option key={c} value={c ?? ''}>{c}</option>
          ))}
        </select>
        <select
          value={filterCity}
          onChange={(e) => setFilterCity(e.target.value)}
          className="rounded-lg border border-[var(--gray-border)] px-3 py-2 text-sm"
        >
          <option value="">All cities</option>
          {[...new Set(initialListings.map((l) => l.city).filter(Boolean))].map((c) => (
            <option key={c} value={c ?? ''}>{c}</option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as 'newest' | 'most_viewed')} className="rounded-lg border border-[var(--gray-border)] px-3 py-2 text-sm">
          <option value="newest">Newest</option>
          <option value="most_viewed">Most viewed</option>
        </select>
      </div>

      {/* Desktop: grid */}
      <div className="mt-8 hidden md:block">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((listing) => (
            <div key={listing.listing_key} className="overflow-hidden rounded-xl border border-[var(--gray-border)] bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setSelectedKey(listing.listing_key)}
                className="relative block aspect-video w-full bg-black"
              >
                {listing.photo_url ? (
                  <Image src={listing.photo_url} alt="" fill className="object-cover" sizes="400px" />
                ) : (
                  <div className="flex h-full items-center justify-center text-white">No image</div>
                )}
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 p-4 text-white">
                  <svg className="h-16 w-16" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
                <span className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-1 text-sm font-medium text-white">
                  ${(listing.list_price ?? 0).toLocaleString()}
                </span>
                <span className="absolute bottom-2 right-2 text-right text-sm font-medium text-white drop-shadow">
                  {listing.unparsed_address ?? listing.listing_key}
                </span>
              </button>
              <div className="p-4">
                <p className="font-semibold text-[var(--brand-navy)]">${(listing.list_price ?? 0).toLocaleString()}</p>
                <p className="text-sm text-[var(--gray-secondary)]">{listing.unparsed_address}</p>
                <p className="mt-1 text-xs text-[var(--gray-muted)]">
                  {listing.beds_total ?? '—'} bed · {listing.baths_full ?? '—'} bath
                  {listing.living_area != null && ` · ${Number(listing.living_area).toLocaleString()} sq ft`}
                </p>
                <Link
                  href={`/listings/${encodeURIComponent(listing.listing_key)}`}
                  className="mt-2 inline-block text-sm font-medium text-[var(--accent)]"
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
              <div className="relative aspect-[9/16] w-full overflow-hidden rounded-lg bg-black">
                <VideoPlayer
                  videoUrl={listing.video_url}
                  listingId={listing.listing_key}
                  posterUrl={listing.photo_url ?? undefined}
                  className="h-full w-full object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-white">
                  <p className="font-semibold">${(listing.list_price ?? 0).toLocaleString()}</p>
                  <p className="text-sm">{listing.unparsed_address}</p>
                  <p className="text-xs opacity-90">
                    {listing.beds_total ?? '—'} bed · {listing.baths_full ?? '—'} bath
                    {listing.living_area != null && ` · ${Number(listing.living_area).toLocaleString()} sq ft`}
                  </p>
                </div>
                <Link
                  href={`/listings/${encodeURIComponent(listing.listing_key)}`}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-white/90 px-3 py-2 text-sm font-medium text-[var(--brand-navy)]"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setSelectedKey(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Video lightbox"
        >
          <button type="button" onClick={() => setSelectedKey(null)} className="absolute right-4 top-4 text-white" aria-label="Close">
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <div className="flex w-full max-w-5xl flex-col gap-4 md:flex-row" onClick={(e) => e.stopPropagation()}>
            <div className="flex-1">
              <VideoPlayer
                videoUrl={selected.video_url}
                listingId={selected.listing_key}
                posterUrl={selected.photo_url ?? undefined}
                className="aspect-video w-full"
              />
            </div>
            <div className="w-full bg-white p-4 md:w-80">
              <p className="text-xl font-bold text-[var(--brand-navy)]">${(selected.list_price ?? 0).toLocaleString()}</p>
              <p className="text-[var(--gray-secondary)]">{selected.unparsed_address}</p>
              <p className="mt-2 text-sm text-[var(--gray-muted)]">
                {selected.beds_total ?? '—'} bed · {selected.baths_full ?? '—'} bath
                {selected.living_area != null && ` · ${Number(selected.living_area).toLocaleString()} sq ft`}
              </p>
              <Link
                href={`/listings/${encodeURIComponent(selected.listing_key)}`}
                className="mt-4 inline-block rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--brand-navy)]"
              >
                View Listing
              </Link>
            </div>
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <p className="mt-8 text-[var(--gray-muted)]">No video tours match your filters.</p>
      )}
    </div>
  )
}
