'use client'

/**
 * Browse places on Home `/`: catalog Card (and resort Carousel) demos.
 * One card structure: reserved 4:3 media (honest photo or navy text-only),
 * title, subtitle, count slot, CardFooter. Never a short bald stub next
 * to a photo card.
 */
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'
import { AnimatedNumber } from '@/components/motion/number'
import { V3_ROOT_CLASS, V3Eyebrow, V3Heading } from '@/components/site/v3'
import { placeDoorPhotoSrc } from './home-browse-places'
import './home-browse-places.css'

export { HOME_PLACE_CARD_MEDIA_RATIO, placeDoorPhotoSrc } from './home-browse-places'

export type HomePlaceDoor = {
  label: string
  href: string
  /**
   * Sourced houses-for-sale count. Number animates. Formatted string is a
   * published figure with no separate magnitude. Omit when unmeasured —
   * never send a zero for a miss.
   */
  count?: number | string
  /** City-index or communityImage photo. Omit when none — reserved plate still renders. */
  photoSrc?: string
  description?: string
}

export type HomePlaceRun = {
  name: string
  unit?: string
  doors: readonly HomePlaceDoor[]
  seeAll?: { label: string; href: string }
  /** Resort run uses the installed Carousel (peek + prev/next), not a chip row. */
  layout?: 'cards' | 'carousel'
}

function doorCount(count: HomePlaceDoor['count']): { n: number; label: string } | null {
  if (typeof count === 'number' && Number.isFinite(count) && count > 0) {
    return { n: count, label: count.toLocaleString('en-US') }
  }
  if (typeof count === 'string' && count.trim()) {
    const n = Number(count.replace(/[^0-9.]/g, ''))
    if (Number.isFinite(n) && n > 0) return { n, label: count.trim() }
  }
  return null
}

/** Linked place stills name the place. Aerial files say so. Empty only when there is no photo. */
export function homePlacePhotoAlt(door: Pick<HomePlaceDoor, 'label' | 'photoSrc'>): string {
  const name = door.label.trim()
  const src = door.photoSrc?.trim() ?? ''
  if (!name || !src) return ''
  if (/\baerial\b/i.test(src)) return `${name} aerial`
  return name
}

function PlaceMedia({ door }: { door: HomePlaceDoor }) {
  const photoSrc = placeDoorPhotoSrc(door.photoSrc)
  const photoAlt = homePlacePhotoAlt(door)
  if (photoSrc) {
    return (
      <div className="home-browse-places__media">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoSrc} alt={photoAlt} width={800} height={600} decoding="async" />
      </div>
    )
  }
  return (
    <div className="home-browse-places__media home-browse-places__media--reserved" aria-hidden="true">
      <span className="home-browse-places__media-name">{door.label}</span>
    </div>
  )
}

function PlaceCard({
  door,
  unit,
  cta,
}: {
  door: HomePlaceDoor
  unit?: string
  cta: string
}) {
  const live = doorCount(door.count)
  const description = door.description?.trim() || unit?.trim() || undefined
  return (
    <Card className="home-browse-places__card pt-0">
      <PlaceMedia door={door} />
      <CardHeader>
        <CardTitle>{door.label}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : (
          <CardDescription className="home-browse-places__desc-slot">&nbsp;</CardDescription>
        )}
      </CardHeader>
      <CardContent className="home-browse-places__count-slot">
        {live ? (
          <AnimatedNumber
            value={live.n}
            format={(n) =>
              Math.round(n) === Math.round(live.n) ? live.label : Math.round(n).toLocaleString('en-US')
            }
            startOnView
            className="home-browse-places__count"
          />
        ) : (
          <span className="home-browse-places__count home-browse-places__count--empty" aria-hidden="true">
            &nbsp;
          </span>
        )}
      </CardContent>
      <CardFooter>
        <Button asChild variant="link">
          <span>{cta}</span>
        </Button>
      </CardFooter>
    </Card>
  )
}

export function HomeBrowsePlaces({
  runs,
  id = 'places',
  eyebrow = 'Central Oregon',
  heading = 'Browse places',
}: {
  runs: readonly HomePlaceRun[]
  id?: string
  eyebrow?: string
  heading?: string
}) {
  const shown = runs
    .map((run) => ({
      ...run,
      doors: run.doors.filter((d) => d.label.trim() && d.href.trim()),
    }))
    .filter((run) => run.name.trim() && run.doors.length > 0)
  if (shown.length === 0) return null

  return (
    <section
      id={id}
      className={`${V3_ROOT_CLASS} home-browse-places`}
      aria-labelledby="places-heading"
    >
      <div className="home-browse-places__head">
        {eyebrow.trim() ? <V3Eyebrow>{eyebrow}</V3Eyebrow> : null}
        <V3Heading level={2} id="places-heading" className="home-browse-places__heading">
          {heading}
        </V3Heading>
      </div>

      {shown.map((run) => {
        const runId = `${id}-${run.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
        const cta = run.layout === 'carousel' ? 'Explore' : 'See homes'
        const carousel = run.layout === 'carousel' && run.doors.length > 1
        return (
          <section key={runId} className="home-browse-places__run" aria-labelledby={runId}>
            <div className="home-browse-places__runhead">
              <h3 id={runId} className="home-browse-places__runname">
                {run.name}
                {run.unit?.trim() ? (
                  <span className="home-browse-places__unit"> · {run.unit}</span>
                ) : null}
              </h3>
              {run.seeAll ? (
                <Link href={run.seeAll.href} className="home-browse-places__all">
                  {run.seeAll.label}
                </Link>
              ) : null}
            </div>

            {carousel ? (
              <div className="home-browse-places__stage">
                <Carousel
                  opts={{ align: 'start', containScroll: 'trimSnaps' }}
                  className="home-browse-places__carousel w-full"
                  aria-label={run.name}
                >
                  <CarouselContent className="home-browse-places__track">
                    {run.doors.map((door) => (
                      <CarouselItem
                        key={door.href}
                        className="home-browse-places__slide basis-[85%] md:basis-1/2 lg:basis-1/3"
                      >
                        <div className="home-browse-places__slide-inner">
                          <Link href={door.href} className="home-browse-places__link">
                            <PlaceCard door={door} unit={run.unit} cta={cta} />
                          </Link>
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <CarouselPrevious />
                  <CarouselNext />
                </Carousel>
              </div>
            ) : (
              <ul className="home-browse-places__cards">
                {run.doors.map((door) => (
                  <li key={door.href} className="home-browse-places__item">
                    <Link href={door.href} className="home-browse-places__link">
                      <PlaceCard door={door} unit={run.unit} cta={cta} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </section>
  )
}
