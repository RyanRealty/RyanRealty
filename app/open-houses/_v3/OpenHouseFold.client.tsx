'use client'

/**
 * Photographed open houses as the installed shadcn carousel
 * (`npx shadcn add carousel` → `components/ui/carousel.tsx`).
 *
 * Day and hours sit on the card and in the two-line timetable above the
 * rail so a visitor can read when at least two opens are happening without
 * opening a listing (SITE-169). V3Field does not paint `when`; this fold does.
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
import { V3_ROOT_CLASS, V3Carousel, V3ChartSwitch, v3Text } from '@/components/site/v3'
import {
  LISTING_FIELD_LEAD_PHOTO_SIZE,
  listingRowPhotoSrc,
} from '@/lib/listing/row-photo'
import { openHouseWhenBands } from './oh-bands'
import type { OpenHouseFieldItem } from './oh-field-items'
import './open-house-field.css'

/** Public wire for the house wrapper (ci:site-primitive-wired). The fold uses the installed source. */
export { V3Carousel }

function specsAfterWhen(item: OpenHouseFieldItem): string {
  if (!item.meta) return ''
  if (!item.when) return item.meta
  if (item.meta === item.when) return ''
  const prefix = `${item.when} · `
  return item.meta.startsWith(prefix) ? item.meta.slice(prefix.length) : item.meta
}

function OpenHousePhotos({
  items,
  label,
}: {
  items: readonly OpenHouseFieldItem[]
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
    <div className="oh-rail-wrap">
      <Carousel
        setApi={setApi}
        opts={{ align: 'start', containScroll: 'trimSnaps' }}
        className={cn(V3_ROOT_CLASS, 'v3-carousel', 'v3-carousel--rail', 'oh-rail')}
        aria-label={label}
      >
        <CarouselContent className="v3-carousel__track ml-0">
          {rail.map((item, i) => {
            const specs = specsAfterWhen(item)
            return (
              <CarouselItem
                key={item.id}
                className="v3-carousel__slide v3-carousel__slide--rail pl-0"
                aria-label={`Slide ${i + 1} of ${rail.length}`}
              >
                <Link
                  href={item.href}
                  className="oh-slide"
                  aria-label={[item.when, item.priceLabel, item.title, specs].filter(Boolean).join(', ')}
                >
                  {item.photoSrc ? (
                    <span className="oh-slide__media">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={listingRowPhotoSrc(item.photoSrc, LISTING_FIELD_LEAD_PHOTO_SIZE)}
                        alt=""
                        width={800}
                        height={600}
                        className="oh-slide__photo"
                        loading={i < 2 ? 'eager' : 'lazy'}
                        fetchPriority={i === 0 ? 'high' : 'auto'}
                        decoding="async"
                      />
                    </span>
                  ) : null}
                  <span className="oh-slide__body">
                    {item.when ? <span className="oh-slide__when">{item.when}</span> : null}
                    <span className="oh-slide__price">{item.priceLabel}</span>
                    <span className="oh-slide__addr">{item.title}</span>
                    {specs ? <span className="oh-slide__specs">{specs}</span> : null}
                  </span>
                </Link>
              </CarouselItem>
            )
          })}
        </CarouselContent>
        {rail.length > 1 ? (
          <>
            <CarouselPrevious className="v3-carousel__step v3-carousel__step--prev" />
            <CarouselNext className="v3-carousel__step v3-carousel__step--next" />
          </>
        ) : null}
      </Carousel>
      {rail.length > 1 ? (
        <p className="oh-rail__pos" aria-live="polite">
          {String(index + 1).padStart(2, '0')} / {String(rail.length).padStart(2, '0')}
        </p>
      ) : null}
    </div>
  )
}

export function OpenHouseFold({
  items,
  railLabel,
}: {
  items: readonly OpenHouseFieldItem[]
  railLabel: string
}) {
  const upcoming = items.filter((item) => Boolean(item.when)).slice(0, 2)
  const bands = openHouseWhenBands(items)

  if (items.length === 0) return null

  return (
    <div className={cn(V3_ROOT_CLASS, 'oh-fold')}>
      {upcoming.length > 0 ? (
        <ol className="oh-upcoming" aria-label="When these homes are open">
          {upcoming.map((item) => (
            <li key={item.id}>
              <Link href={item.href} className="oh-upcoming__link">
                <span className="oh-upcoming__when">{item.when}</span>
                <span className="oh-upcoming__place">{item.title}</span>
              </Link>
            </li>
          ))}
        </ol>
      ) : null}
      {bands.length > 1 ? (
        <V3ChartSwitch
          label={v3Text('When')}
          items={bands.map((band) => ({ key: band.key, label: v3Text(band.label) }))}
          defaultKey={bands[0]?.key}
          className="oh-bands"
        >
          {bands.map((band) => (
            <OpenHousePhotos
              key={band.key}
              items={band.items}
              label={`${railLabel} · ${band.label}`}
            />
          ))}
        </V3ChartSwitch>
      ) : bands.length === 1 ? (
        <OpenHousePhotos items={bands[0].items} label={railLabel} />
      ) : (
        <OpenHousePhotos items={items} label={railLabel} />
      )}
    </div>
  )
}
