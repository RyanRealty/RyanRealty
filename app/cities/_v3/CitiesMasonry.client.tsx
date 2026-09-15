'use client'

/**
 * beui:infinite-masonry on /cities — featured-city photographs.
 * Catalog InfiniteMasonry (virtualized columns + onLoadMore). Navy/cream
 * paint only. Do not swap in Spark thumbs or a house grid.
 */
import { InfiniteMasonry } from '@/components/motion/infinite-masonry'
import { V3_ROOT_CLASS } from '@/components/site/v3'
import { useCallback, useState } from 'react'
import { citiesCatalogReady } from './cities-catalog'

void citiesCatalogReady

export type CitiesMasonryItem = {
  slug: string
  name: string
  src: string
  countLabel: string | null
}

const PAGE = 3

export function CitiesMasonry({
  id,
  items,
}: {
  id: string
  items: readonly CitiesMasonryItem[]
}) {
  const [visible, setVisible] = useState(() => items.slice(0, PAGE))
  const hasMore = visible.length < items.length

  const onLoadMore = useCallback(() => {
    setVisible((current) => items.slice(0, current.length + PAGE))
  }, [items])

  if (items.length < 2) return null

  return (
    <section id={id} className={`${V3_ROOT_CLASS} cities-masonry`}>
      <InfiniteMasonry
        items={visible}
        getItemKey={(item) => item.slug}
        renderItem={(item) => <CityMasonryCard item={item} />}
        onLoadMore={onLoadMore}
        hasMore={hasMore}
        estimateSize={() => 260}
        minColumnWidth={148}
        maxColumns={3}
        gap={12}
        ariaLabel="Featured city photographs"
        className="cities-masonry__feed"
      />
    </section>
  )
}

function CityMasonryCard({ item }: { item: CitiesMasonryItem }) {
  return (
    <a className="cities-masonry__card" href={`/cities/${item.slug}`}>
      <img
        className="cities-masonry__photo"
        src={item.src}
        alt=""
        width={720}
        height={900}
      />
      <span className="cities-masonry__meta">
        <span className="cities-masonry__name">{item.name}</span>
        {item.countLabel ? (
          <span className="cities-masonry__count">{item.countLabel}</span>
        ) : null}
      </span>
    </a>
  )
}
