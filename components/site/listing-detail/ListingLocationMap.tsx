'use client'

import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'

/**
 * ListingLocationMap — 21:9 aspect map with the listing pin + optional
 * subdivision boundary overlay + lifestyle-line ("X min to Mt. Bachelor
 * · Y min downtown · Z min to Deschutes River trail").
 *
 * Spec source:
 *   design_system/ryan-realty/ui_kits/listing-detail/index.html §location
 *   docs/EXECUTION_PLAN.md §8 "What we BEAT" rank 6 — Bend lifestyle data
 *
 * Server-safe wrapper. The actual Google Maps client lives in
 * ListingLocationMap.client.tsx and loads via next/dynamic so the
 * @react-google-maps/api bundle only ships on listing-detail.
 *
 * Lifestyle line is caller-supplied (the page composes it from the
 * subdivisionName via a static lookup table OR via getCommunityMetadata
 * upstream). Renders nothing when no lat/lng is available.
 */

const ListingLocationMapClient = dynamic(() => import('./ListingLocationMap.client'), {
  ssr: false,
  loading: () => (
    <div
      aria-hidden
      className="h-full w-full animate-pulse"
      style={{
        background: 'var(--cream)',
        border: '3px solid var(--navy)',
      }}
    />
  ),
})

const ListingLot3D = dynamic(() => import('./ListingLot3D.client'), {
  ssr: false,
  loading: () => null,
})

type Props = {
  lat: number | null
  lng: number | null
  /** Optional subdivision / neighborhood polygon overlay. */
  boundary?: GeoJSON.Geometry | null
  /** Free-form lifestyle bullets, rendered with middle-dot separators. */
  lifestyleLine?: string | null
  zoom?: number
  className?: string
  photoUrl?: string | null
  price?: number | null
  beds?: number | null
  baths?: number | null
  sqft?: number | null
  cityLine?: string | null
  href?: string | null
}

export function ListingLocationMap({
  lat,
  lng,
  boundary,
  lifestyleLine,
  zoom,
  className,
  addressLine,
  photoUrl,
  price,
  beds,
  baths,
  sqft,
  cityLine,
  href,
}: Props & { addressLine?: string | null }) {
  if (lat == null || lng == null) return null

  return (
    <>
    <section className={cn('section listing-map', className)}>
      <div className="sec-head">
        <div>
          <div className="eyebrow sec-index">Location</div>
          <h2 className="sec-title display">Where this home sits</h2>
        </div>
      </div>

      <div
        className="relative w-full self-stretch"
        style={{
          aspectRatio: '21 / 9',
          minHeight: 'var(--v3-map-min)',
          marginTop: 'clamp(22px,3vw,36px)',
        }}
      >
        <div className="absolute inset-0" style={{ minHeight: 'var(--v3-map-min)' }}>
          <ListingLocationMapClient
            lat={lat}
            lng={lng}
            boundary={boundary ?? null}
            zoom={zoom}
            popup={
              addressLine
                ? {
                    price: price ?? null,
                    photoURL: photoUrl ?? null,
                    streetLine: addressLine,
                    cityLine: cityLine?.trim() || '',
                    beds: beds ?? null,
                    baths: baths ?? null,
                    sqft: sqft ?? null,
                    href: href?.trim() || '#location',
                  }
                : null
            }
          />
        </div>
      </div>
      {lifestyleLine ? (
        <div
          className="tabular-nums"
          style={{
            marginTop: 14,
            fontSize: '0.78rem',
            fontWeight: 500,
            letterSpacing: '0.02em',
            color: 'color-mix(in srgb, var(--v3-navy) 72%, transparent)',
          }}
        >
          {lifestyleLine}
        </div>
      ) : null}
    </section>
    {/* Photorealistic Google 3D mesh when available — fails open to null. */}
    <ListingLot3D lat={lat} lng={lng} label={addressLine} />
    </>
  )
}
