import type { ListingCommunityDoor as Door } from '@/lib/listing/listing-community-door'

/**
 * Prominent community / resort door under the price strip.
 *
 * One descriptive link, not a second Quiet block (out-of-area already uses
 * Quiet) and not Quick facts. The words come from listingCommunityDoor.
 */
export function ListingCommunityDoor({ door }: { door: Door }) {
  return (
    <p className="listing-community-door">
      <a href={door.href}>{door.anchor}</a>
    </p>
  )
}
