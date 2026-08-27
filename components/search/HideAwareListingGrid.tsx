'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { V3ListingRow, type V3ListingRowData } from '@/components/site/v3'
import ListingCardHideControl from '@/components/listing/ListingCardHideControl'
import { getHiddenListingKeys } from '@/app/actions/hidden-listings'
import { buildHiddenKeySet, isHiddenListing } from '@/components/search/hidden-exclusion'
import './search-ledger.css'

/**
 * One item = the design-system card plus BOTH raw RETS identifiers, because the
 * hidden set is keyed on the canonical ListingKey while the card's own key is
 * `ListNumber ?? ListingKey` — matching on both is what lets a hidden home drop
 * whether the store recorded its ListingKey or its MLS ListNumber.
 */
export type HideAwareItem = {
  card: V3ListingRowData
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
  gridClassName,
}: {
  items: HideAwareItem[]
  /** Call-site stability only: the Ledger register renders one dense column,
   *  so column fan-out no longer applies (THE LOOK §9). */
  cols?: 2 | 3 | 4
  /** When set, wrap the rows in a plain div with these classes instead of the
   *  default ledger stack — lets a surface keep its own wrapper while still
   *  getting the exclusion + hide control. */
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
    // entangling the row's own internal styles. The control sits over the
    // thumb so the figure column stays clean.
    <div key={card.listingKey} data-listing-key={card.listingKey} className="relative group/hide">
      <ListingCardHideControl
        listingKey={card.listingKey}
        addressLine={card.addressLine}
        onVisibilityChange={onHiddenChange}
        className="left-1 top-1 right-auto size-7"
      />
      <V3ListingRow listing={card} />
    </div>
  ))

  // Ledger register (THE LOOK §9): one dense hairline-separated column, never
  // a card grid. `cols` stays in the public props for call-site stability but
  // no longer fans rows out horizontally; `gridClassName` still lets a caller
  // keep its own wrapper.
  if (gridClassName) return <div className={gridClassName}>{cards}</div>
  return <div className="v3-lrow-list mt-2">{cards}</div>
}
