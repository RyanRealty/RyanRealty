import { getOpenHousesWithListings } from '@/app/actions/open-houses'
import type { OpenHouseWithListing } from '@/app/actions/open-houses'
import ListingCard, { type ListingCardData, type ListingBadge } from './ListingCard'
import {
  Body,
  Container,
  Eyebrow,
  Grid,
  H2,
  Section,
  Stack,
  TextLink,
} from '@/components/site/primitives'

/**
 * Site v2 open houses grid — 4 listing cards of upcoming open houses, with
 * eyebrow + heading + subtitle + head-action. Mirrors design_system/ryan-realty/
 * ui_kits/website/index.html §featured-listings.
 *
 * Data accuracy: every listing traces to open_houses + listing_tile_mv via
 * getOpenHousesWithListings(). No fabricated cards.
 *
 * Lifted onto Wave 2 Layer 1 primitives 2026-05-27. Open-house time-range
 * separator switched from en-dash to hyphen ("10am-1pm") so user-facing
 * badge strings clear the brand-voice §6.1 punctuation rule.
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
      ? ` · ${formatTime(o.start_time)}-${formatTime(o.end_time)}`
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
    <Section padding="default" divider>
      <Container>
        <div className="flex items-end justify-between gap-6 flex-wrap mb-6">
          <Stack gap="tight">
            <Eyebrow>Featured listings</Eyebrow>
            <H2>Open houses this weekend</H2>
            <Body size="small" tone="muted">
              Representing a mix of neighborhoods across Central Oregon.
            </Body>
          </Stack>
          {items.length > 4 ? (
            <TextLink
              href="/open-houses"
              underline="on-hover"
              className="whitespace-nowrap text-sm"
            >
              View all {items.length} open houses →
            </TextLink>
          ) : null}
        </div>

        <Grid cols={4} gap="default">
          {top.map((o) => (
            <ListingCard key={o.open_house_key} listing={toListingCardData(o)} />
          ))}
        </Grid>
      </Container>
    </Section>
  )
}
