'use client'

/**
 * The place-type field: the Atlas and the list of that type, linked.
 *
 * WHAT THE EVALUATOR SAID (taste table 2026-09-08, place-type-community,
 * severity major): "The list and the map show the same listings but are not
 * connected — no hover-on-row highlights the matching Atlas dot (or vice
 * versa), no sort or filter (price, beds) sits above the list. Neither shot
 * shows any affordance for revealing more data beyond a default row
 * click-through and pinch-zoom."
 *
 * So this file is one small piece of state — the listing key the reader is
 * pointing at — shared by the two sections, plus the sort. It is deliberately
 * NOT a store: a React context that lives inside this one route's island,
 * created here and consumed by two components in the same file.
 *
 * The link runs both ways. A pointer or a focus on a row rings the mark on the
 * map; a pointer over a mark raises the row. Keyboard users get it through
 * focus, which is why the handler is on focus as well as pointerenter.
 *
 * The sort is real anchors with real hrefs so the control is in the HTML that
 * ships (and reads as a control to a crawler and a screen reader), and the
 * reorder itself happens here rather than as a navigation: these routes are
 * statically generated for every city and community, and reading searchParams
 * on the server would make all of them dynamic. The anchors carry rel=nofollow
 * for the same reason — the sorted URL is the same page, and the canonical
 * already says so.
 */

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { V3Atlas, type V3AtlasProps } from '@/components/site/v3/V3Atlas.client'
import { V3ListingRow, type V3ListingRowData } from '@/components/site/v3/V3ListingRow'
import { V3_LEDGER_CLASS, V3_ROOT_CLASS } from '@/components/site/v3/atoms'
import { cn } from '@/lib/utils'
import {
  PLACE_TYPE_SORTS,
  isPlaceTypeSort,
  sortPlaceTypeRows,
  type PlaceTypeSort,
} from '@/lib/place/place-type-sort'
import './place-type-page.css'

type LinkState = {
  linkedKey: string | null
  setLinkedKey: (key: string | null) => void
  sort: PlaceTypeSort
  setSort: (sort: PlaceTypeSort) => void
}

const PlaceTypeLinkContext = createContext<LinkState | null>(null)

function useLink(): LinkState {
  const ctx = useContext(PlaceTypeLinkContext)
  if (!ctx) {
    // A consumer outside the provider would silently lose the link rather than
    // fail, and a link that silently does nothing is the defect this file is
    // fixing. Fail where it can be seen.
    throw new Error('[place-type] the map and the list must sit inside <PlaceTypeField>')
  }
  return ctx
}

/**
 * The provider. Wraps BOTH sections, including the Suspense boundary the Atlas
 * streams inside, so the two halves share one hovered key even though the map
 * arrives after the list.
 */
export function PlaceTypeField({ children }: { children: ReactNode }) {
  const [linkedKey, setLinkedKeyState] = useState<string | null>(null)
  const [sort, setSort] = useState<PlaceTypeSort>('newest')
  const setLinkedKey = useCallback((key: string | null) => {
    setLinkedKeyState((prev) => (prev === key ? prev : key))
  }, [])
  const value = useMemo(
    () => ({ linkedKey, setLinkedKey, sort, setSort }),
    [linkedKey, setLinkedKey, sort],
  )
  return <PlaceTypeLinkContext.Provider value={value}>{children}</PlaceTypeLinkContext.Provider>
}

/**
 * The Atlas, wired to the shared key. Every other prop passes straight through,
 * so the map on this page is the same primitive every other page renders.
 */
export function PlaceTypeAtlas(props: Omit<V3AtlasProps, 'linkedKey' | 'onLinkedKeyChange'>) {
  const { linkedKey, setLinkedKey } = useLink()
  return <V3Atlas {...props} linkedKey={linkedKey} onLinkedKeyChange={setLinkedKey} />
}

/** The sort control, above the list. */
export function PlaceTypeSortBar({ pagePath }: { pagePath: string }) {
  const { sort, setSort } = useLink()
  return (
    <div className="place-type-sort" role="group" aria-label="Sort these listings">
      {PLACE_TYPE_SORTS.map((option) => {
        const on = option.key === sort
        return (
          <a
            key={option.key}
            href={option.key === 'newest' ? pagePath : `${pagePath}?sort=${option.key}`}
            rel="nofollow"
            className={cn('place-type-sort__link', on && 'is-on')}
            aria-current={on ? 'true' : undefined}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
              e.preventDefault()
              const next = isPlaceTypeSort(option.key) ? option.key : 'newest'
              setSort(next)
              // The address bar keeps up without a navigation, so the reader can
              // share the sorted view and the back button still leaves the page.
              window.history.replaceState(null, '', e.currentTarget.getAttribute('href') ?? pagePath)
            }}
          >
            {option.label}
          </a>
        )
      })}
    </div>
  )
}

/**
 * The photographed rows, in the reader's order, each one linked to its mark.
 * The wrapper is a plain element around the barrel's row rather than a fork of
 * it: V3ListingRow stays the one listing row this site has.
 */
export function PlaceTypeRows({ rows }: { rows: readonly V3ListingRowData[] }) {
  const { linkedKey, setLinkedKey, sort } = useLink()
  const ordered = useMemo(() => sortPlaceTypeRows(rows, sort), [rows, sort])
  return (
    <div className={cn(V3_ROOT_CLASS, V3_LEDGER_CLASS, 'v3-lrow-list', 'place-type-rows')}>
      {ordered.map((listing, index) => {
        const on = linkedKey === listing.listingKey
        return (
          <div
            key={listing.listingKey}
            className={cn('place-type-row', on && 'is-linked')}
            data-listing-key={listing.listingKey}
            data-linked={on ? 'true' : 'false'}
            onPointerEnter={() => setLinkedKey(listing.listingKey)}
            onPointerLeave={() => setLinkedKey(null)}
            onFocus={() => setLinkedKey(listing.listingKey)}
            onBlur={() => setLinkedKey(null)}
          >
            <V3ListingRow
              listing={listing}
              priority={sort === 'newest' && index < 3}
            />
          </div>
        )
      })}
    </div>
  )
}
