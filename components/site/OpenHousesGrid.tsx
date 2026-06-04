import { getOpenHousesWithListings } from '@/app/actions/open-houses'
import type { OpenHouseWithListing } from '@/app/actions/open-houses'
import ListingCard, { type ListingCardData, type ListingBadge } from './ListingCard'
import { listingTileHref } from '@/lib/slug'
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
  return listingTileHref({
    listingKey: o.listing_key,
    listNumber: o.list_number,
    streetNumber: o.street_number,
    streetName: o.street_name,
    city: o.city,
    subdivisionName: o.subdivision_name,
  })
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
  // event_date is a bare Pacific calendar date ("2026-05-30"). Read it as UTC
  // so the weekday matches that date (Pacific would shift midnight back a day).
  const date = new Date(o.event_date)
  const weekday = date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
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

type Props = {
  /**
   * When provided, only open houses in this city are shown.
   * Pass the city name as it appears in the MLS (e.g. "Bend", "Redmond").
   * Omit for the homepage / all-Central-Oregon view.
   */
  city?: string
  /** Eyebrow label override. Defaults to "Featured listings". */
  eyebrow?: string
  /** Section heading override. Defaults to "Open houses this weekend". */
  heading?: string
  /** Body subtitle override. */
  subtitle?: string
  /** View-all link href. Defaults to "/open-houses". */
  viewAllHref?: string
  /**
   * When set, fetch open houses from today through today+N days instead of the
   * default "this weekend" window. City/community pages pass 14.
   */
  daysAhead?: number
}

export default async function OpenHousesGrid({
  city,
  eyebrow = 'Featured listings',
  heading = 'Open houses this weekend',
  subtitle,
  viewAllHref = '/open-houses',
  daysAhead,
}: Props = {}) {
  const window =
    daysAhead && daysAhead > 0
      ? {
          dateFrom: new Date().toISOString().slice(0, 10),
          dateTo: new Date(Date.now() + daysAhead * 86_400_000).toISOString().slice(0, 10),
        }
      : {}
  const items = await getOpenHousesWithListings({ ...(city ? { city } : {}), ...window }).catch(
    () => [] as OpenHouseWithListing[]
  )
  const top = items.slice(0, 4)

  if (top.length === 0) {
    return null
  }

  const defaultSubtitle = city
    ? `Upcoming open houses in ${city}.`
    : 'Representing a mix of neighborhoods across Central Oregon.'

  return (
    <Section padding="default" divider>
      <Container>
        <div className="flex items-end justify-between gap-6 flex-wrap mb-6">
          <Stack gap="tight">
            <Eyebrow>{eyebrow}</Eyebrow>
            <H2>{heading}</H2>
            <Body size="small" tone="muted">
              {subtitle ?? defaultSubtitle}
            </Body>
          </Stack>
          {items.length > 4 ? (
            <TextLink
              href={viewAllHref}
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
