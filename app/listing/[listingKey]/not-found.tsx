import { ListingUnavailable } from '@/components/site/listing-detail/ListingUnavailable'

/**
 * Router-level 404 for /listing/<key>. PublicNav still provides the header.
 * Do not remount V3Chrome. One V3Footer outside main.
 *
 * The body itself lives in ListingUnavailable so this boundary and the page's
 * own rendered refusal are the same page — see that file for why the page
 * cannot rely on notFound() alone.
 */
export default function ListingNotFound() {
  return <ListingUnavailable />
}
