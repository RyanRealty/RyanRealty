import type { ListingHubLinks as Links } from '@/lib/listing/listing-hub-links'
import { listingHubLinkList } from '@/lib/listing/listing-hub-links'

/**
 * Exact-match text links to the listing's city inventory hub and community
 * hub. Community href/anchor come from listingCommunityDoor (PR #513).
 */
export function ListingHubLinks({ links }: { links: Links }) {
  const doors = listingHubLinkList(links)
  if (doors.length === 0) return null
  return (
    <p className="listing-hub-links">
      {doors.map((door, index) => (
        <span key={door.href}>
          {index > 0 ? <span aria-hidden="true"> · </span> : null}
          <a href={door.href}>{door.anchor}</a>
        </span>
      ))}
    </p>
  )
}
