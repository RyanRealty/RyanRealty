'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import ListingCard, { type ListingCardData } from '@/components/site/ListingCard'
import ListingCardHideControl from '@/components/listing/ListingCardHideControl'
import { getHiddenListingKeys } from '@/app/actions/hidden-listings'
import { buildHiddenKeySet, isHiddenListing } from '@/components/search/hidden-exclusion'
import { Grid } from '@/components/site/primitives'

/**
 * One item = the design-system card plus BOTH raw RETS identifiers, because the
 * hidden set is keyed on the canonical ListingKey while the card's own key is
 * `ListNumber ?? ListingKey` — matching on both is what lets a hidden home drop
 * whether the store recorded its ListingKey or its MLS ListNumber.
 */
export type HideAwareItem = {
  card: ListingCardData
  ListingKey: string | null
  ListNumber: string | null
}

/**
 * Client grid that applies the signed-in user's "Hide homes I don't want to
 * see" subtraction to an SSR-rendered listing set, and carries the same hover
 * hide control as the /search grid. Used by the SSR browse surfaces
 * (/search/[...slug] city + community + preset pages) so a home the user hid on
 * /search does not reappear when they browse a city page (W7.2).
 *
 * Server results are SHARED caches, so the hiding happens here at the edge of
 * render — never baked into the fetch. Signed-out users get an empty set (no
 * filtering). Pagination totals are unaffected: hidden homes drop from the
 * rendered grid only, exactly as SearchResults keeps its shared `total`.
 */
export default function HideAwareListingGrid({
  items,
  cols = 4,
  gridClassName,
}: {
  items: HideAwareItem[]
  cols?: 2 | 3 | 4
  /** When set, wrap the cards in a plain div with these classes instead of the
   *  design-system Grid — lets a surface keep its own grid styling (e.g. the KB
   *  price-drops grid) while still getting the exclusion + hide control. */
  gridClassName?: string
}) {
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    let cancelled = false
    getHiddenListingKeys()
      .then((keys) => { if (!cancelled && keys.length > 0) setHiddenKeys(buildHiddenKeySet(keys)) })
      .catch(() => {}) // fail open: worst case a hidden home briefly reappears
    return () => { cancelled = true }
  }, [])

  const onHiddenChange = useCallback((key: string, hidden: boolean) => {
    setHiddenKeys((prev) => {
      const next = new Set(prev)
      if (hidden) next.add(key)
      else next.delete(key)
      return next
    })
  }, [])

  const visible = useMemo(
    () => items.filter((it) => !isHiddenListing({ ListingKey: it.ListingKey, ListNumber: it.ListNumber }, hiddenKeys)),
    [items, hiddenKeys],
  )

  const cards = visible.map(({ card }) => (
    // Named group `group/hide` reveals the control on hover, without
    // entangling ListingCard's own internal `group` styles.
    <div key={card.listingKey} data-listing-key={card.listingKey} className="relative group/hide">
      <ListingCardHideControl
        listingKey={card.listingKey}
        addressLine={card.addressLine}
        onVisibilityChange={onHiddenChange}
      />
      <ListingCard listing={card} />
    </div>
  ))

  if (gridClassName) return <div className={gridClassName}>{cards}</div>
  return (
    <Grid cols={cols} gap="loose" className="mt-2">
      {cards}
    </Grid>
  )
}
