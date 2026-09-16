'use client'

/**
 * SITE-114. Photographed houses as the beUI infinite-masonry object, inside
 * a contained SmoothScroll so the fold has a scroll-tied progress mark.
 * Cards carry price + address + beds/baths/sqft. Photos stay card-sized
 * (800×600), never the 320 ledger thumb.
 */
import { useCallback, useMemo, useState } from 'react'
import { InfiniteMasonry } from '@/components/motion/infinite-masonry'
import {
  ScrollProgress,
  SmoothScroll,
  useSmoothScroll,
} from '@/components/motion/scroll-animation'
import type { ZipMasonryItem } from './zip-constants'
import { zipCatalogReady } from './zip-catalog'

const PAGE_SIZE = 6
const FIRST_PAGE = 8

function MasonryProgress() {
  const { progress } = useSmoothScroll()
  return (
    <ScrollProgress
      variant="circle"
      size={36}
      thickness={3}
      progress={progress}
      className="zip-opening__progress"
    />
  )
}

export function ZipHomesMasonry({
  zip,
  items,
  emptyMessage,
}: {
  zip: string
  items: readonly ZipMasonryItem[]
  emptyMessage: string
}) {
  void zipCatalogReady
  const [shown, setShown] = useState(() => Math.min(FIRST_PAGE, items.length))
  const [loading, setLoading] = useState(false)
  const visible = useMemo(() => items.slice(0, shown), [items, shown])
  const hasMore = shown < items.length

  const loadMore = useCallback(() => {
    if (loading || !hasMore) return
    setLoading(true)
    setShown((current) => Math.min(items.length, current + PAGE_SIZE))
    setLoading(false)
  }, [hasMore, items.length, loading])

  if (items.length === 0) {
    return <p className="zip-opening__empty">{emptyMessage}</p>
  }

  return (
    <SmoothScroll root={false} className="zip-opening__scroll" touch>
      <div className="zip-opening__homes-head">
        <p className="zip-opening__homes-kicker">Houses in {zip}</p>
        <MasonryProgress />
      </div>
      <InfiniteMasonry
        items={visible}
        getItemKey={(item) => item.id}
        renderItem={(item) => <ZipMasonryCard item={item} />}
        onLoadMore={loadMore}
        hasMore={hasMore}
        loading={loading}
        estimateSize={(item) => item.imageHeight + 72}
        minColumnWidth={168}
        maxColumns={3}
        gap={12}
        ariaLabel={`Active single-family listings in ${zip}`}
        className="zip-opening__masonry"
        endState={`Every priced home in ${zip} that is on this list.`}
      />
    </SmoothScroll>
  )
}

function ZipMasonryCard({ item }: { item: ZipMasonryItem }) {
  return (
    <a href={item.href} className="zip-opening__card">
      {item.photoSrc ? (
        <span
          className="zip-opening__card-media"
          style={{ height: item.imageHeight }}
        >
          {/* Spark CDN — skip next/image (Vercel IO). content-floor reads <img>. */}
          <img src={item.photoSrc} alt="" width={800} height={item.imageHeight} />
        </span>
      ) : (
        <span
          className="zip-opening__card-media zip-opening__card-media--empty"
          style={{ height: item.imageHeight }}
        />
      )}
      <span className="zip-opening__card-copy">
        <span className="zip-opening__card-price">{item.priceLabel}</span>
        <span className="zip-opening__card-title">{item.title}</span>
        {item.meta ? <span className="zip-opening__card-meta">{item.meta}</span> : null}
      </span>
    </a>
  )
}
