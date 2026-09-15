'use client'

/**
 * One horizontal house rail for the homepage. Cards reuse SplitCardMedia
 * (badges, photo carousel, 3D/video) and the same ask/meta publishers as Field Split cards.
 * Photo and copy open the listing. No save/heart on public cards (Matt 2026-09-15).
 */
import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { formatPublishedSaleAsk } from '@/lib/listing/publish-listing-ask'
import {
  publishListingShareKind,
  publishListingSharePricePerSqft,
} from '@/lib/listing/publish-listing-share'
import { publishTourEmbedFromUrl } from '@/lib/listing/publish-listing-hero-video'
import type { VideoEmbed } from '@/lib/data/types/video'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'
import { AnimatedNumber } from '@/components/motion/number'
import { V3_ROOT_CLASS, V3Button } from '@/components/site/v3'
import type { HomeHeroLive } from './home-hero-inventory'
import {
  SplitCardMedia,
  SPLIT_CARD_MEDIA_SIZES_RAIL,
} from '@/components/site/v3/SplitCardMedia'
import { ListingTourOverlay } from '@/components/site/listing-detail/ListingTourOverlay'
import type { HomeRailCard, HomeRailRow } from './home-rail-items'
import '@/components/site/v3/V3ListingRow.css'
import '@/components/site/v3/V3Carousel.css'
import './home-homes-rails.css'

function HomeRailCardFace({
  card,
  onOpenTour,
  priority,
}: {
  card: HomeRailCard
  onOpenTour?: () => void
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
          onOpenTour={card.hasTour ? onOpenTour : undefined}
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

export function HomeListingRail({
  row,
  live,
}: {
  row: HomeRailRow
  /** Optional animated regional count on the lead rail (Rare UI / beUI number). */
  live?: HomeHeroLive
}) {
  const [tour, setTour] = useState<VideoEmbed | null>(null)

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
          {live ? (
            <p className="home-rail__live">
              <AnimatedNumber
                value={live.forSale}
                format={(n) =>
                  Math.round(n) === Math.round(live.forSale)
                    ? live.forSaleLabel
                    : Math.round(n).toLocaleString('en-US')
                }
                startOnView={false}
                className="home-rail__live-n"
              />
              <span> homes for sale across Central Oregon</span>
              <span className="home-rail__live-src">{live.source}</span>
            </p>
          ) : null}
        </div>
        <V3Button href={row.seeAll.href} variant="ghost">
          {row.seeAll.label}
        </V3Button>
      </div>
      <Carousel
        opts={{ align: 'start', containScroll: 'trimSnaps' }}
        className={cn(V3_ROOT_CLASS, 'v3-carousel', 'v3-carousel--rail', 'home-rail__carousel')}
        aria-label={row.heading}
      >
        <CarouselContent className="v3-carousel__track ml-0">
          {row.cards.map((card, index) => (
            <CarouselItem
              key={card.listingKey}
              className="v3-carousel__slide v3-carousel__slide--rail pl-0 !basis-[min(17.5rem,78vw)] min-[64rem]:!basis-1/4"
            >
              <HomeRailCardFace
                card={card}
                priority={index < 2}
                onOpenTour={
                  card.tourUrl || card.hasTour
                    ? () => {
                        const embed = publishTourEmbedFromUrl(
                          card.tourUrl,
                          card.photoUrls[0] ?? null,
                        )
                        if (embed) setTour(embed)
                        else if (card.href) window.location.assign(`${card.href}#tour`)
                      }
                    : undefined
                }
              />
            </CarouselItem>
          ))}
        </CarouselContent>
        {row.cards.length > 1 ? (
          <div className="v3-carousel__nav home-rail__arrows">
            <CarouselPrevious className="v3-carousel__step static size-auto translate-x-0 translate-y-0" />
            <CarouselNext className="v3-carousel__step static size-auto translate-x-0 translate-y-0" />
          </div>
        ) : null}
      </Carousel>
      <ListingTourOverlay
        open={tour != null}
        video={tour}
        title="Listing tour"
        onClose={() => setTour(null)}
      />
    </section>
  )
}
