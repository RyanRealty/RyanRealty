import Link from 'next/link'
import { getOpenHousesWithListings } from '@/app/actions/open-houses'
import type { OpenHouseWithListing } from '@/app/actions/open-houses'
import ListingCard, { type ListingCardData, type ListingBadge } from './ListingCard'

/**
 * Site v2 open houses grid — 4 listing cards of upcoming open houses, with eyebrow
 * + heading + subtitle + head-action. Mirrors design_system/ryan-realty/ui_kits/website/index.html
 * §featured-listings.
 *
 * Data accuracy: every listing traces to open_houses + listing_tile_mv via
 * getOpenHousesWithListings(). No fabricated cards.
 */

function listingDetailHref(o: OpenHouseWithListing): string {
  return `/listing/${o.listing_key}`
}

function buildAddressLine(o: OpenHouseWithListing): string {
  if (o.street_number && o.street_name) {
    return `${o.street_number} ${o.street_name}`.trim()
  }
  return o.unparsed_address ?? 'Address available'
}

function buildCityLine(o: OpenHouseWithListing): string {
  const parts: string[] = []
  if (o.city) parts.push(o.state ? `${o.city}, ${o.state}` : o.city)
  if (o.postal_code) parts[parts.length - 1] += ` ${o.postal_code}`
  if (o.subdivision_name) parts.push(o.subdivision_name)
  return parts.join(' · ')
}

function formatOpenHouseBadge(o: OpenHouseWithListing): { kind: ListingBadge; label: string } {
  const date = new Date(o.event_date)
  const weekday = date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/Los_Angeles' })
  const time =
    o.start_time && o.end_time
      ? ` · ${formatTime(o.start_time)}–${formatTime(o.end_time)}`
      : ''
  return { kind: 'open', label: `Open ${weekday}${time}` }
}

function formatTime(hms: string): string {
  // "13:00:00" → "1pm"
  const [h, m] = hms.split(':').map((x) => parseInt(x, 10))
  if (Number.isNaN(h)) return hms
  const period = h >= 12 ? 'pm' : 'am'
  const hr = h % 12 === 0 ? 12 : h % 12
  const min = m && m !== 0 ? `:${m.toString().padStart(2, '0')}` : ''
  return `${hr}${min}${period}`
}

function toListingCardData(o: OpenHouseWithListing): ListingCardData {
  return {
    listingKey: o.listing_key,
    href: listingDetailHref(o),
    photoUrl: o.photo_url,
    price: o.list_price,
    addressLine: buildAddressLine(o),
    cityLine: buildCityLine(o),
    beds: o.beds_total,
    baths: o.baths_full,
    sqft: o.living_area,
    badge: formatOpenHouseBadge(o),
  }
}

export default async function OpenHousesGrid() {
  const items = await getOpenHousesWithListings().catch(() => [] as OpenHouseWithListing[])
  const top = items.slice(0, 4)

  if (top.length === 0) {
    return null
  }

  return (
    <section className="py-14 border-t border-border">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex items-end justify-between gap-6 flex-wrap mb-6">
          <div>
            <div className="rr-eyebrow">Featured listings</div>
            <h2 className="mt-1.5 text-[clamp(1.5rem,2vw+0.5rem,1.875rem)] font-bold tracking-[-0.01em] text-foreground">
              Open houses this weekend
            </h2>
            <p className="text-sm text-muted-foreground mt-1.5">
              Representing a mix of neighborhoods across Central Oregon.
            </p>
          </div>
          {items.length > 4 ? (
            <Link
              href="/open-houses"
              className="text-sm font-semibold text-primary hover:underline whitespace-nowrap"
            >
              View all {items.length} open houses →
            </Link>
          ) : null}
        </div>

        <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {top.map((o) => (
            <ListingCard key={o.open_house_key} listing={toListingCardData(o)} />
          ))}
        </div>
      </div>
    </section>
  )
}
