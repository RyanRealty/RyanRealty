'use client'
/**
 * The fixed broker bar on a phone.
 *
 * It is its own component because of where it has to live. The bar is
 * `position: fixed` and used to render inside ListingBrokerCTA, which the page
 * puts in `.listing-detail-aside` — an element that is `display: none` below
 * 64rem. A fixed element does not escape a hidden ancestor, so the bar measured
 * 0px high at 390, and its own `@media (min-width: 1024px) { display: none }`
 * took care of the rest. It rendered nowhere, on a control whose CSS comment
 * says "Conversion-critical."
 *
 * The page mounts it in the shell's `floating` slot, outside the grid, and it
 * shows the same attributed broker as the card because both read one hook.
 */
import ListingMobileContactBar from './ListingMobileContactBar.client'
import { useAttributedBroker } from './use-attributed-broker'
import type { Broker } from '@/lib/data/types/broker'

export default function ListingBrokerBar({
  defaultBroker,
  brokers,
  listingKey,
  lockToDefault = false,
}: {
  defaultBroker: Broker
  brokers: Broker[]
  listingKey: string
  lockToDefault?: boolean
}) {
  // assign: false — the card owns the sticky assignment, this reads it.
  const broker = useAttributedBroker({ defaultBroker, brokers, lockToDefault })
  return <ListingMobileContactBar broker={broker} listingKey={listingKey} />
}
