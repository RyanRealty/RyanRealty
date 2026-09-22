'use client'

/**
 * Live Bend new-construction homes — catalog job `shadcn-carousel`.
 *
 * Imports the installed source (`@/components/ui/carousel`) and the same
 * house card face as /buy. One track of today's photographed homes, not a
 * three-community switch. A concession sits on the home when public remarks
 * or that builder's published page name one.
 */
import { useEffect, useState } from 'react'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from '@/components/ui/carousel'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS, V3Button } from '@/components/site/v3'
import { HomeRailCardFace } from '@/app/_v3/HomeListingRail.client'
import type { NewConHomeCard } from './load-lead-shelf'
import '@/components/site/v3/V3ListingRow.css'
import '@/components/site/v3/V3Carousel.css'
import '@/app/_v3/home-homes-rails.css'
import './new-con-lead-shelf.css'

function CardConcession({ card }: { card: NewConHomeCard }) {
  const concession = card.concession
  if (!concession && !card.builderName) return null
  return (
    <div className="newcon-lead__card-offer">
      {concession ? (
        <>
          <p className="newcon-lead__card-whose">{concession.whose}</p>
          <p className="newcon-lead__card-what">{concession.what}</p>
          {concession.extra ? <p className="newcon-lead__card-extra">{concession.extra}</p> : null}
          {concession.sourceHref ? (
            <a className="newcon-lead__card-source" href={concession.sourceHref}>
              {concession.source}
            </a>
          ) : (
            <p className="newcon-lead__card-source">{concession.source}</p>
          )}
        </>
      ) : (
        <p className="newcon-lead__card-whose">Built by {card.builderName}</p>
      )}
    </div>
  )
}

export function NewConLeadShelf({
  heading,
  note,
  cards,
  seeAllHref,
}: {
  heading: string
  note: string
  cards: readonly NewConHomeCard[]
  seeAllHref: string
}) {
  const [api, setApi] = useState<CarouselApi>()
  const [index, setIndex] = useState(0)
  const headingId = 'newcon-lead-heading'

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

  if (cards.length === 0) return null

  return (
    <section
      id="affordable"
      className={cn(V3_ROOT_CLASS, 'home-rail', 'newcon-lead')}
      aria-labelledby={headingId}
    >
      <div className="home-rail__head newcon-lead__head">
        <div className="home-rail__head-copy">
          <h2 id={headingId} className="home-rail__title">
            {heading}
          </h2>
          <p className="newcon-lead__note">{note}</p>
        </div>
      </div>
      <div className="newcon-lead__track">
        <p className="newcon-lead__pos" aria-hidden="true">
          {String(index + 1).padStart(2, '0')} / {String(cards.length).padStart(2, '0')}
        </p>
        <Carousel
          setApi={setApi}
          opts={{ align: 'start', containScroll: 'trimSnaps' }}
          className={cn(V3_ROOT_CLASS, 'v3-carousel', 'v3-carousel--rail', 'home-rail__carousel')}
          aria-label={heading}
        >
          <CarouselContent className="v3-carousel__track ml-0">
            {cards.map((card, i) => (
              <CarouselItem
                key={card.listingKey}
                className="v3-carousel__slide v3-carousel__slide--rail pl-0"
              >
                <div className="newcon-lead__card">
                  <HomeRailCardFace card={card} priority={i < 2} />
                  <CardConcession card={card} />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          {cards.length > 1 ? (
            <>
              <CarouselPrevious className="v3-carousel__step v3-carousel__step--prev" />
              <CarouselNext className="v3-carousel__step v3-carousel__step--next" />
            </>
          ) : null}
        </Carousel>
      </div>
      <V3Button href={seeAllHref} variant="ghost" className="newcon-lead__see-all">
        See all Bend new construction
      </V3Button>
    </section>
  )
}
