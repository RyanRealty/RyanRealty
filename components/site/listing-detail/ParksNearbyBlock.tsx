import Link from 'next/link'
import { Eyebrow, H3, Stack } from '@/components/site/primitives'
import { cn } from '@/lib/utils'
import { findParksNear, type ParkType } from '@/data/co-parks'
import type { ListingDetail } from '@/lib/data/types/listing'

/**
 * ParksNearbyBlock — "Parks & recreation nearby" section for the listing-detail
 * page. Lists the notable Central Oregon parks within ~3 miles of the listing,
 * computed from the listing lat/lng against the verified park centroids in the
 * registry (data/co-parks.ts). Each card links to /parks/[slug].
 *
 * Pure registry math (no DB query) — distance is the great-circle distance from
 * the listing to each park's official-boundary centroid. Renders nothing when
 * the listing has no coordinates or no park falls within the radius, so it only
 * appears where there is a real match (CLAUDE.md §0 — never invent proximity).
 */

type Props = {
  listing: Pick<ListingDetail, 'lat' | 'lng'>
  className?: string
}

const TYPE_LABEL: Record<ParkType, string> = {
  state: 'State park',
  city: 'City park',
  'natural-area': 'Natural area',
}

/** Round a mileage to one decimal for display (e.g. 1.4 mi). */
function formatMiles(miles: number): string {
  return `${miles.toFixed(1)} mi`
}

export function ParksNearbyBlock({ listing, className }: Props) {
  const { lat, lng } = listing
  if (typeof lat !== 'number' || typeof lng !== 'number') return null

  const parks = findParksNear(lat, lng, 3, 6)
  if (parks.length === 0) return null

  return (
    <Stack gap="default" className={className}>
      <div>
        <Eyebrow>Parks and recreation</Eyebrow>
        <H3 className="mt-1.5">Parks and recreation nearby</H3>
      </div>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {parks.map((park) => (
          <Link
            key={park.slug}
            href={`/parks/${park.slug}`}
            className={cn(
              'block rounded-[14px] border border-border bg-card p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md',
            )}
          >
            <div className="text-[17px] font-bold tracking-[-0.01em] text-primary">
              {park.name}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{TYPE_LABEL[park.type]}</span>
              <span aria-hidden>·</span>
              <span className="tabular-nums">{formatMiles(park.distanceMiles)}</span>
            </div>
          </Link>
        ))}
      </div>
    </Stack>
  )
}
