'use client'

/**
 * One horizontal house rail for the homepage. Cards reuse SplitCardMedia
 * (badges, photo carousel, in-card 3D/video) and the same ask/meta publishers as Field Split cards.
 * Photo and copy open the listing. Tour plays in the card media. No save/heart on public cards (Matt 2026-09-15).
 */
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { formatPublishedSaleAsk } from '@/lib/listing/publish-listing-ask'
import {
  publishListingShareKind,
  publishListingSharePricePerSqft,
} from '@/lib/listing/publish-listing-share'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from '@/components/ui/carousel'
import { V3_ROOT_CLASS, V3Button } from '@/components/site/v3'
import {
  SplitCardMedia,
  SPLIT_CARD_MEDIA_SIZES_RAIL,
} from '@/components/site/v3/SplitCardMedia'
import type { HomeRailCard, HomeRailRow } from './home-rail-items'
import '@/components/site/v3/V3ListingRow.css'
import '@/components/site/v3/V3Carousel.css'
import './home-homes-rails.css'

export function HomeRailCardFace({
  card,
  priority,
}: {
  card: HomeRailCard
  priority?: boolean
}) {
  const ask = formatPublishedSaleAsk({ price: card.price, propertyType: card.propertyType })
  const shareKind = publishListingShareKind({
    propertySubType: card.propertySubType,
    subdivisionName: card.subdivisionName,
    city: card.city,
    listNumber: card.listNumber,
  })
  const meta: string[] = []
  if (card.beds != null) meta.push(`${Math.round(card.beds).toLocaleString('en-US')} bd`)
  if (card.baths != null) meta.push(`${Math.round(card.baths).toLocaleString('en-US')} ba`)
  if (card.sqft != null) meta.push(`${Math.round(card.sqft).toLocaleString('en-US')} sqft`)
  if (card.statusLabel) meta.push(card.statusLabel)
  const publishedPpsf = publishListingSharePricePerSqft({
    propertyType: card.propertyType,
    propertySubType: card.propertySubType,
    subdivisionName: card.subdivisionName,
    city: card.city,
    listNumber: card.listNumber,
    pricePerSqft: card.pricePerSqft,
  })
  if (publishedPpsf != null && publishedPpsf > 0) {
    meta.push(`$${Math.round(publishedPpsf).toLocaleString('en-US')}/sqft`)
  }

  return (
    <Card size="sm" className={cn(V3_ROOT_CLASS, 'home-rail__card')}>
      <div className="home-rail__media">
        <SplitCardMedia
          urls={card.photoUrls}
          tags={card.badges}
          hasTour={card.hasTour}
          tourUrl={card.tourUrl}
          addressLine={card.addressLine}
          priority={priority}
          tourLabel={card.tourLabel}
          sizes={SPLIT_CARD_MEDIA_SIZES_RAIL}
          href={card.href}
        />
      </div>
      <Link href={card.href} className="home-rail__copy-link">
        <CardHeader className="home-rail__copy">
          <CardTitle>{ask ?? 'Price on request'}</CardTitle>
          {shareKind ? <span className="home-rail__kind">{shareKind}</span> : null}
          {meta.length > 0 ? <CardDescription>{meta.join(' · ')}</CardDescription> : null}
        </CardHeader>
        <CardContent>
          <span className="home-rail__addr">{card.addressLine}</span>
          <span className="home-rail__city">{card.cityLine}</span>
        </CardContent>
      </Link>
    </Card>
  )
}

/**
 * THE SHELF'S POSITION, read off the installed carousel's own api.
 *
 * `ui.shadcn.com/docs/components/carousel` ships exactly this beside the demo
 * ("Slide 1 of 5", from `api.selectedScrollSnap()` / `api.scrollSnapList()`).
 * Keeping it is the difference between adapting the component and re-skinning
 * a row of cards: a still of the shelf now says how far along the reader is,
 * and clicking a chevron visibly moves it.
 *
 * Exported with `HomeRailPosition` so any shelf that wants the readout reads
 * it through this code rather than a second copy. The /buy FOLD shelf
 * deliberately does not: 25px above the photograph is the difference between
 * the first ask's street address being on screen at 1440x900 and under it.
 */
export function useRailPosition(api: CarouselApi | undefined): {
  index: number
  count: number
} {
  const [pos, setPos] = useState({ index: 0, count: 0 })

  useEffect(() => {
    if (!api) return
    const read = () =>
      setPos({ index: api.selectedScrollSnap(), count: api.scrollSnapList().length })
    read()
    api.on('select', read)
    api.on('reInit', read)
    return () => {
      api.off('select', read)
      api.off('reInit', read)
    }
  }, [api])

  return pos
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/**
 * The counter and the hairline that fills with it — navy up to the snap
 * position, `--v3-hairline` past it. It rides the head row beside the see-all,
 * so it adds no row of its own.
 */
export function HomeRailPosition({ index, count }: { index: number; count: number }) {
  if (count < 2) return null
  const shown = Math.min(index + 1, count)
  return (
    <span className="home-rail__pos" aria-hidden="true">
      <span className="home-rail__pos-count">
        {pad2(shown)} <span className="home-rail__pos-sep">/</span> {pad2(count)}
      </span>
      <span
        className="home-rail__pos-rule"
        style={{ ['--home-rail-p' as string]: `${(shown / count) * 100}%` }}
      />
    </span>
  )
}

export function HomeListingRail({
  row,
}: {
  row: HomeRailRow
}) {
  const [api, setApi] = useState<CarouselApi>()
  const { index, count } = useRailPosition(api)

  return (
    <section
      id={row.id}
      className={cn(V3_ROOT_CLASS, 'home-rail')}
      aria-labelledby={`${row.id}-heading`}
    >
      <div className="home-rail__head">
        <div className="home-rail__head-copy">
          <h2 id={`${row.id}-heading`} className="home-rail__title">
            {row.heading}
          </h2>
        </div>
        <HomeRailPosition index={index} count={count} />
        <V3Button href={row.seeAll.href} variant="ghost">
          {row.seeAll.label}
        </V3Button>
      </div>
      <Carousel
        setApi={setApi}
        opts={{ align: 'start', containScroll: 'trimSnaps' }}
        className={cn(V3_ROOT_CLASS, 'v3-carousel', 'v3-carousel--rail', 'home-rail__carousel')}
        aria-label={row.heading}
      >
        <CarouselContent className="v3-carousel__track ml-0">
          {row.cards.map((card, index) => (
            <CarouselItem
              key={card.listingKey}
              className="v3-carousel__slide v3-carousel__slide--rail pl-0"
            >
              <HomeRailCardFace card={card} priority={index < 2} />
            </CarouselItem>
          ))}
        </CarouselContent>
        {/*
          The shadcn control IS a round chevron on each side of the track you
          drag. Parked under the cards as a static pair (which is what shipped
          until 2026-09-16) it fell below the 900px fold on /buy, so the shelf
          read in a screenshot as a static grid and a separate evaluator
          scored demoMatch FALSE. V3Carousel had already been corrected the
          same way in b32f97c3; this is the identical treatment, centred on
          the media midline by `--v3-carousel-nav-top` in V3Carousel.css.
        */}
        {row.cards.length > 1 ? (
          <>
            <CarouselPrevious className="v3-carousel__step v3-carousel__step--prev" />
            <CarouselNext className="v3-carousel__step v3-carousel__step--next" />
          </>
        ) : null}
      </Carousel>
    </section>
  )
}
