'use client'

/**
 * Search / homes-for-sale inventory Field. Consumes V3Field as-is: map +
 * type multi-select lead + photo doors. Hide subtraction stays at this
 * edge (W7.2) so a shared cache cannot bake a per-user hide.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { PlaceFieldMap } from '@/app/central-oregon/_v3/PlaceFieldMap.client'
import { getHiddenListingKeys } from '@/app/actions/hidden-listings'
import ListingCardHideControl from '@/components/listing/ListingCardHideControl'
import { buildHiddenKeySet, isHiddenListing } from '@/components/search/hidden-exclusion'
import { V3Button, V3Field, type V3FieldItem } from '@/components/site/v3'
import { searchFieldItems, type SearchFieldItem } from './search-field-items'

export function SearchHomesField({
  listings,
  placeName,
  boundary,
  count,
  emptyMessage,
}: {
  listings: Parameters<typeof searchFieldItems>[0]
  placeName: string
  boundary?: unknown
  count?: {
    value: string
    label: string
    source: string
    updatedAt?: string | number | Date | null
  }
  emptyMessage: string
}) {
  const all = useMemo(() => searchFieldItems(listings), [listings])
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    let cancelled = false
    getHiddenListingKeys()
      .then((keys) => {
        if (cancelled === false && keys.length > 0) setHiddenKeys(buildHiddenKeySet(keys))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const onHiddenChange = useCallback((key: string, hidden: boolean) => {
    setHiddenKeys((prev) => {
      const next = new Set(prev)
      if (hidden) next.add(key)
      else next.delete(key)
      return next
    })
  }, [])

  const types = useMemo(() => {
    const seen = new Set<string>()
    const next: { key: string; label: string; cat: 0 | 1 | 2 | 3 | 4 }[] = []
    for (const item of all) {
      if (seen.has(item.typeKey)) continue
      seen.add(item.typeKey)
      next.push({ key: item.typeKey, label: item.typeLabel, cat: item.cat })
    }
    return next
  }, [all])

  const visible = useMemo(() => {
    const typed =
      selectedTypes.length === 0
        ? all
        : all.filter((item) => selectedTypes.includes(item.typeKey))
    return typed.filter(
      (item) =>
        isHiddenListing(
          { ListingKey: item.listingKey, ListNumber: item.listNumber },
          hiddenKeys,
        ) === false,
    )
  }, [all, selectedTypes, hiddenKeys])

  const typeLead =
    types.length > 1 ? (
      <nav aria-label="Property types">
        {types.map((type) => {
          const on = selectedTypes.includes(type.key)
          return (
            <V3Button
              key={type.key}
              type="button"
              variant="ghost"
              ariaPressed={on}
              onClick={() =>
                setSelectedTypes((prev) =>
                  prev.includes(type.key)
                    ? prev.filter((key) => key !== type.key)
                    : [...prev, type.key],
                )
              }
            >
              <span
                className={`v3-field__mark v3-field__mark--cat-${type.cat}`}
                aria-hidden="true"
              />
              {type.label}
            </V3Button>
          )
        })}
      </nav>
    ) : null

  return (
    <V3Field
      id="homes"
      ariaLabel={`Homes for sale in ${placeName}`}
      items={visible}
      listAsDoors
      lead={typeLead}
      count={count}
      emptyMessage={emptyMessage}
      itemChrome={(item: V3FieldItem) => {
        const row = item as SearchFieldItem
        return (
          <ListingCardHideControl
            listingKey={row.listingKey}
            addressLine={row.title}
            onVisibilityChange={onHiddenChange}
            className="left-1 top-1 right-auto size-7"
          />
        )
      }}
      mapSlot={(binding) => {
        const pins = binding.items.flatMap((item) =>
          item.lat != null && item.lng != null
            ? [
                {
                  id: item.id,
                  href: item.href,
                  priceLabel: item.priceLabel,
                  title: item.title,
                  lat: item.lat,
                  lng: item.lng,
                  cat: item.cat,
                },
              ]
            : [],
        )
        if (pins.length === 0 && boundary == null) return null
        return (
          <PlaceFieldMap
            pins={pins}
            placeName={placeName}
            posterSrc={visible.find((item) => item.photoSrc)?.photoSrc}
            boundary={boundary}
          />
        )
      }}
    />
  )
}
