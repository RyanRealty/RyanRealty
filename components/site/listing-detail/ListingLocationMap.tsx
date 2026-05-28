'use client'

import dynamic from 'next/dynamic'
import { Eyebrow, H3, Stack } from '@/components/site/primitives'

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
      className="h-full w-full animate-pulse rounded-[14px] border border-border bg-card"
    />
  ),
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
}

export function ListingLocationMap({
  lat,
  lng,
  boundary,
  lifestyleLine,
  zoom,
  className,
}: Props) {
  if (lat == null || lng == null) return null

  return (
    <Stack gap="default" className={className}>
      <div>
        <Eyebrow>Location</Eyebrow>
        <H3 className="mt-1.5">Where this home sits</H3>
      </div>
      <div className="relative w-full self-stretch" style={{ aspectRatio: '21 / 9' }}>
        <div className="absolute inset-0">
          <ListingLocationMapClient
            lat={lat}
            lng={lng}
            boundary={boundary ?? null}
            zoom={zoom}
          />
        </div>
      </div>
      {lifestyleLine ? (
        <div className="text-[13px] text-muted-foreground tabular-nums">{lifestyleLine}</div>
      ) : null}
    </Stack>
  )
}
