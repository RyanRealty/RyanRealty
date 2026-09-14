'use client'

/**
 * Featured communities as the shadcn carousel + Card demo (SITE-97).
 * Same catalog object as About FirmClosings: prev/next + peek, each slide a
 * Card (photo, name, sourced pulse figures via AnimatedNumber, door).
 * Empty slides still mount #featured-community so Home smoke never misses it.
 */
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'
import { AnimatedNumber } from '@/components/motion/number'
import { V3_ROOT_CLASS, V3Eyebrow, V3Heading } from '@/components/site/v3'
import type { HomeFeaturedCommunityFigure, HomeFeaturedCommunitySlide } from './home-featured-community-shared'
import { HOME_FEATURED_COMMUNITY_SOURCE } from './home-featured-community-shared'
import { homeBriefText } from './home-competitive-brief'
import './home-featured-community.css'

function figureFormat(figure: HomeFeaturedCommunityFigure) {
  const published = figure.value
  const n = figure.n
  if (n == null || !Number.isFinite(n)) return undefined
  if (published.includes('$')) {
    return (x: number) => (Math.round(x) === Math.round(n) ? published : `$${Math.round(x).toLocaleString('en-US')}`)
  }
  if (!Number.isInteger(n)) {
    return (x: number) => (Math.abs(x - n) < 0.05 ? published : (Math.round(x * 10) / 10).toFixed(1))
  }
  return (x: number) => (Math.round(x) === Math.round(n) ? published : Math.round(x).toLocaleString('en-US'))
}

export function HomeFeaturedCommunity({
  slides,
  id = 'featured-community',
  eyebrow = 'Featured communities',
  heading = 'Resorts and planned communities',
}: {
  slides: readonly HomeFeaturedCommunitySlide[]
  id?: string
  eyebrow?: string
  heading?: string
}) {
  if (slides.length === 0) {
    return (
      <section
        id={id}
        className={`${V3_ROOT_CLASS} home-featured-community home-featured-community--empty`}
        aria-labelledby={`${id}-heading`}
      >
        <div className="home-featured-community__head">
          {eyebrow.trim() ? <V3Eyebrow>{eyebrow}</V3Eyebrow> : null}
          <V3Heading level={2} id={`${id}-heading`} className="home-featured-community__heading">
            {heading}
          </V3Heading>
        </div>
        <p className="home-featured-community__empty" role="status">
          Resort and planned-community spotlights will show here when registry
          photos are available.{' '}
          <Link href="/communities" className="home-featured-community__more">
            Every community
          </Link>
        </p>
      </section>
    )
  }

  return (
    <section
      id={id}
      className={`${V3_ROOT_CLASS} home-featured-community`}
      aria-labelledby={`${id}-heading`}
    >
      <div className="home-featured-community__head">
        {eyebrow.trim() ? <V3Eyebrow>{eyebrow}</V3Eyebrow> : null}
        <V3Heading level={2} id={`${id}-heading`} className="home-featured-community__heading">
          {heading}
        </V3Heading>
        <p className="home-featured-community__brief">{homeBriefText('7')}</p>
      </div>

      <Carousel
        opts={{ align: 'start', containScroll: 'trimSnaps' }}
        className="home-featured-community__carousel w-full"
        aria-label={heading}
      >
        <CarouselContent>
          {slides.map((slide) => {
            const card = (
              <Card className="home-featured-community__card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={slide.photoSrc} alt={`${slide.name} photo`} width={800} height={600} decoding="async" />
                <CardHeader>
                  <CardDescription>{slide.city}</CardDescription>
                  <CardTitle>{slide.name}</CardTitle>
                </CardHeader>
                {slide.figures.length > 0 ? (
                  <CardContent>
                    <ul className="home-featured-community__figures">
                      {slide.figures.map((figure) => (
                        <li key={`${slide.slug}-${figure.label}`} className="home-featured-community__figure">
                          {figure.n != null && Number.isFinite(figure.n) ? (
                            <AnimatedNumber
                              value={figure.n}
                              format={figureFormat(figure)}
                              startOnView
                              className="home-featured-community__figure-value"
                            />
                          ) : (
                            <span className="home-featured-community__figure-value">{figure.value}</span>
                          )}
                          <span className="home-featured-community__figure-label">{figure.label}</span>
                        </li>
                      ))}
                    </ul>
                    {slide.blurb ? <p className="home-featured-community__blurb">{slide.blurb}</p> : null}
                  </CardContent>
                ) : slide.blurb ? (
                  <CardContent>
                    <p className="home-featured-community__blurb">{slide.blurb}</p>
                  </CardContent>
                ) : null}
                <CardFooter>
                  <Button asChild>
                    <span>{`Explore ${slide.name}`}</span>
                  </Button>
                </CardFooter>
              </Card>
            )
            return (
              <CarouselItem key={slide.slug} className="md:basis-1/2 lg:basis-1/3">
                <div className="p-1">
                  <Link href={slide.href} className="home-featured-community__card-link">
                    {card}
                  </Link>
                </div>
              </CarouselItem>
            )
          })}
        </CarouselContent>
        {slides.length > 1 ? (
          <div className="home-featured-community__arrows">
            <CarouselPrevious className="static size-auto translate-x-0 translate-y-0" />
            <CarouselNext className="static size-auto translate-x-0 translate-y-0" />
          </div>
        ) : null}
      </Carousel>

      <p className="home-featured-community__nav">
        <Link href="/communities" className="home-featured-community__more">
          Every community
        </Link>
      </p>
      <p className="home-featured-community__source">{HOME_FEATURED_COMMUNITY_SOURCE}</p>
    </section>
  )
}
