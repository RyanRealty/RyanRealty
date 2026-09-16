'use client'

/**
 * SITE-114. Photographed houses as the beUI infinite-masonry object.
 * InfiniteMasonry is the scroll — not a nested contained-scroll wrap (that hid stagger
 * and painted a loading tail as a navy hole). ScrollProgress reads this
 * scroller's own 0..1 so the bar and circle photograph a partial fill.
 * Cards carry price + address + beds/baths/sqft. Photos stay card-sized
 * (800×600), never the 320 ledger thumb.
 */
import { useMotionValue } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { InfiniteMasonry } from '@/components/motion/infinite-masonry'
import { ScrollProgress } from '@/components/motion/scroll-animation'
import type { ZipMasonryItem } from './zip-constants'
import { zipCatalogReady } from './zip-catalog'

const PAGE_SIZE = 6
const FIRST_PAGE = 10
const OPEN_PROGRESS = 0.42

function MasonryProgress({ progress }: { progress: ReturnType<typeof useMotionValue<number>> }) {
  return (
    <>
      <ScrollProgress
        variant="bar"
        height={4}
        position="top"
        fixed={false}
        spring={false}
        progress={progress}
        className="zip-opening__progress-bar"
      />
      <ScrollProgress
        variant="circle"
        size={44}
        thickness={4}
        spring={false}
        progress={progress}
        className="zip-opening__progress"
      />
    </>
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
  const rootRef = useRef<HTMLDivElement>(null)
  const progress = useMotionValue(OPEN_PROGRESS)
  const photographed = useMemo(() => items.filter((item) => Boolean(item.photoSrc)), [items])
  const [shown, setShown] = useState(() => Math.min(FIRST_PAGE, photographed.length))
  const visible = useMemo(() => photographed.slice(0, shown), [photographed, shown])
  const hasMore = shown < photographed.length

  const loadMore = useCallback(() => {
    if (!hasMore) return
    setShown((current) => Math.min(photographed.length, current + PAGE_SIZE))
  }, [hasMore, photographed.length])

  useEffect(() => {
    const root = rootRef.current?.querySelector('section')
    if (!(root instanceof HTMLElement)) return
    const max = root.scrollHeight - root.clientHeight
    if (max > 40) {
      const top = Math.round(max * OPEN_PROGRESS)
      root.scrollTop = top
      progress.set(top / max)
    } else {
      progress.set(OPEN_PROGRESS)
    }
  }, [progress, visible.length])

  if (photographed.length === 0) {
    return <p className="zip-opening__empty">{emptyMessage}</p>
  }

  return (
    <div
      id="masonry-open"
      ref={rootRef}
      className="zip-opening__masonry-frame"
      data-demo-state="masonry-open"
    >
      <p className="zip-opening__homes-kicker">Houses in {zip}</p>
      <MasonryProgress progress={progress} />
      <InfiniteMasonry
        items={visible}
        getItemKey={(item) => item.id}
        renderItem={(item) => <ZipMasonryCard item={item} />}
        onLoadMore={loadMore}
        hasMore={hasMore}
        loading={false}
        estimateSize={(item) => item.imageHeight + 88}
        minColumnWidth={220}
        maxColumns={3}
        gap={14}
        prefetch={2}
        ariaLabel={`Active single-family listings in ${zip}`}
        className="zip-opening__masonry"
        endState={`Every priced home in ${zip} that is on this list.`}
      />
    </div>
  )
}

function ZipMasonryCard({ item }: { item: ZipMasonryItem }) {
  return (
    <a href={item.href} className="zip-opening__card">
      <span
        className="zip-opening__card-media"
        style={{ height: item.imageHeight }}
      >
        {/* Spark CDN — skip next/image (Vercel IO). content-floor reads <img>. */}
        <img src={item.photoSrc} alt="" width={800} height={item.imageHeight} />
      </span>
      <span className="zip-opening__card-copy">
        <span className="zip-opening__card-price">{item.priceLabel}</span>
        <span className="zip-opening__card-title">{item.title}</span>
        {item.meta ? <span className="zip-opening__card-meta">{item.meta}</span> : null}
      </span>
    </a>
  )
}
