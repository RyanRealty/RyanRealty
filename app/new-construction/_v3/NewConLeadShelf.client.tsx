'use client'

/**
 * Affordable SFR lead shelf — catalog job `shadcn-carousel`.
 *
 * Imports the installed source (`@/components/ui/carousel`) and the same
 * house card face as /buy. Community chips (Parkside → Calaveras → Easton)
 * switch the track. Snapshot bands stay on the chip; live cards are today's
 * photographed homes in that subdivision.
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
import { V3_ROOT_CLASS, V3Button, V3ChartSwitch, v3Text } from '@/components/site/v3'
import { HomeRailCardFace } from '@/app/_v3/HomeListingRail.client'
import type { HomeRailCard } from '@/app/_v3/home-rail-items'
import {
  bendNewConRowConcessionLine,
  bendNewConRowConcessionReveal,
  bendNewConRowOffer,
  type NewConInventoryRow,
} from '@/lib/site/bend-new-construction'
import type { NewConLeadBand } from './load-lead-shelf'
import '@/components/site/v3/V3ListingRow.css'
import '@/components/site/v3/V3Carousel.css'
import '@/app/_v3/home-homes-rails.css'
import './new-con-lead-shelf.css'

function SnapshotDoor({ band }: { band: NewConLeadBand }) {
  const { row, href, seeHomesLabel, liveCount } = band
  return (
    <div className="newcon-lead__empty">
      <p className="newcon-lead__empty-band">{row.priceBand}</p>
      <p className="newcon-lead__empty-meta">
        {liveCount != null
          ? `${liveCount} live now · ${row.active} Active on 2026-09-16`
          : `${row.active} Active on 2026-09-16`}
        {row.builders ? ` · ${row.builders}` : ''}
        {row.typical ? ` · ${row.typical}` : ''}
      </p>
      <ConcessionNote row={row} />
      <V3Button href={href} variant="primary">
        {seeHomesLabel}
      </V3Button>
    </div>
  )
}

/**
 * Builder + concession, ON the home shelf (SITE-151, Matt 2026-09-21): a
 * visitor scrolling real Parkside / Calaveras / Easton houses sees who
 * built them and what is published right next to the cards, not four
 * sections down in a disjointed Financing block. Renders nothing when the
 * row has no attached offer (no builder sampled, or nothing publishable
 * found for that specific community) — §0: say nothing rather than imply
 * one.
 */
function ConcessionNote({ row }: { row: NewConInventoryRow }) {
  const attach = bendNewConRowOffer(row.name)
  if (!attach) return null
  const headline = bendNewConRowConcessionLine(row.name)
  const deep = bendNewConRowConcessionReveal(row.name)
  const builder = row.builders ?? 'Builder not in sampled details'
  return (
    <div className="newcon-lead__concession">
      <p className="newcon-lead__concession-builder">Built by {builder}</p>
      {headline ? <p className="newcon-lead__concession-headline">{headline}</p> : null}
      {deep ? <p className="newcon-lead__concession-deep">{deep}</p> : null}
    </div>
  )
}

function LeadTrack({
  cards,
  label,
  fallback,
  priority,
}: {
  cards: readonly HomeRailCard[]
  label: string
  fallback: NewConLeadBand
  priority: boolean
}) {
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

  if (cards.length === 0) return <SnapshotDoor band={fallback} />

  return (
    <div className="newcon-lead__track">
      <p className="newcon-lead__pos" aria-hidden="true">
        {String(index + 1).padStart(2, '0')} / {String(cards.length).padStart(2, '0')}
      </p>
      <Carousel
        setApi={setApi}
        opts={{ align: 'start', containScroll: 'trimSnaps' }}
        className={cn(V3_ROOT_CLASS, 'v3-carousel', 'v3-carousel--rail', 'home-rail__carousel')}
        aria-label={label}
      >
        <CarouselContent className="v3-carousel__track ml-0">
          {cards.map((card, i) => (
            <CarouselItem
              key={card.listingKey}
              className="v3-carousel__slide v3-carousel__slide--rail pl-0"
            >
              <HomeRailCardFace card={card} priority={priority && i < 2} />
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
      <ConcessionNote row={fallback.row} />
      <V3Button href={fallback.href} variant="primary" className="newcon-lead__door">
        {fallback.seeHomesLabel}
      </V3Button>
    </div>
  )
}

export function NewConLeadShelf({
  heading,
  note,
  bands,
  seeAllHref,
}: {
  heading: string
  note: string
  bands: readonly NewConLeadBand[]
  seeAllHref: string
}) {
  if (bands.length === 0) return null
  const headingId = 'newcon-lead-heading'

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
      <V3ChartSwitch
        label={v3Text('Community')}
        items={bands.map((band) => ({ key: band.key, label: v3Text(band.label) }))}
        className="newcon-lead__switch"
      >
        {bands.map((band, i) => (
          <LeadTrack
            key={band.key}
            cards={band.cards}
            label={band.label}
            fallback={band}
            priority={i === 0}
          />
        ))}
      </V3ChartSwitch>
      <V3Button href={seeAllHref} variant="ghost" className="newcon-lead__see-all">
        See all Bend new construction
      </V3Button>
    </section>
  )
}
