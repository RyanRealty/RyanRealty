'use client'

/**
 * Photographed price-cut houses as the installed shadcn carousel
 * (`npx shadcn add carousel` → `components/ui/carousel.tsx`).
 *
 * THE OBJECT. ui.shadcn.com/docs/components/carousel is one composed slide
 * with Previous / Next flanking the track — not a strip of equal peeking
 * cards. This file imports that source itself. A house rail wrapper is not
 * the install (`ci:catalog-install` requireRouteImport / taste-receipt --ship).
 *
 * Each slide names city and cut size on the facts, not as a chip on the
 * photograph (contrast on mixed MLS plates failed the last mark).
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from '@/components/ui/carousel'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS, V3Carousel } from '@/components/site/v3'

/** Public wire for the house wrapper (ci:site-primitive-wired). The fold uses the installed source below. */
export { V3Carousel }
import {
  LISTING_FIELD_LEAD_PHOTO_SIZE,
  listingRowPhotoSrc,
} from '@/lib/listing/row-photo'
import type { PriceDropFieldItem } from './drops-field-items'
import './price-drops-field.css'

export function PriceDropPhotos({
  items,
  label,
}: {
  items: readonly PriceDropFieldItem[]
  label: string
}) {
  const photographed = items.filter((item) => Boolean(item.photoSrc?.trim()))
  const rail = photographed.length > 0 ? photographed : items
  const [api, setApi] = useState<CarouselApi>()
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!api) return
    const read = () => setIndex(api.selectedScrollSnap())
    read()
    api.on('select', read)
    api.on('reInit', read)
    return () => {
      api.off('select', read)
      api.off('reInit', read)
    }
  }, [api])

  if (rail.length === 0) return null

  return (
    <div className="pd-cuts">
      <Carousel
        setApi={setApi}
        opts={{ align: 'start', containScroll: 'trimSnaps' }}
        className={cn(V3_ROOT_CLASS, 'v3-carousel', 'pd-cuts-rail')}
        aria-label={label}
      >
        <CarouselContent className="v3-carousel__track ml-0">
          {rail.map((item, i) => (
            <CarouselItem
              key={item.id}
              className="v3-carousel__slide pl-0"
              aria-label={`Slide ${i + 1} of ${rail.length}`}
            >
              <Link
                href={item.href}
                className="pd-slide"
                aria-label={
                  item.specs
                    ? `${item.priceLabel}, ${item.title}, ${item.specs}`
                    : `${item.priceLabel}, ${item.title}`
                }
              >
                {item.photoSrc ? (
                  <span className="pd-slide__media">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={listingRowPhotoSrc(item.photoSrc, LISTING_FIELD_LEAD_PHOTO_SIZE)}
                      alt=""
                      width={800}
                      height={600}
                      className="pd-slide__photo"
                      loading={i < 2 ? 'eager' : 'lazy'}
                      fetchPriority={i === 0 ? 'high' : 'auto'}
                      decoding="async"
                    />
                  </span>
                ) : null}
                <span className="pd-slide__body">
                  {item.city ? <span className="pd-slide__city">{item.city}</span> : null}
                  <span className="pd-slide__price">{item.priceLabel}</span>
                  {item.dropLine ? <span className="pd-slide__drop">{item.dropLine}</span> : null}
                  {item.cutShare != null ? (
                    <span className="pd-slide__cut" aria-hidden="true">
                      <span style={{ width: `${(item.cutShare * 100).toFixed(1)}%` }} />
                    </span>
                  ) : null}
                  <span className="pd-slide__addr">{item.title}</span>
                  {item.specs ? <span className="pd-slide__specs">{item.specs}</span> : null}
                </span>
              </Link>
            </CarouselItem>
          ))}
        </CarouselContent>
        {rail.length > 1 ? (
          <>
            <CarouselPrevious className="v3-carousel__step v3-carousel__step--prev" />
            <CarouselNext className="v3-carousel__step v3-carousel__step--next" />
          </>
        ) : null}
      </Carousel>
      {rail.length > 1 ? (
        <p className="pd-cuts__pos" aria-live="polite">
          {String(index + 1).padStart(2, '0')} / {String(rail.length).padStart(2, '0')}
        </p>
      ) : null}
    </div>
  )
}
