'use client'

/**
 * Home featured community carousel. One community at a time: photo left,
 * sales + blurb right, prev/next + dots. Slides arrive prebuilt from the
 * server — this island only pages them.
 */
import { useId, useState } from 'react'
import Link from 'next/link'
import {
  V3_ROOT_CLASS,
  V3Button,
  V3Eyebrow,
  V3Heading,
} from '@/components/site/v3'
import type { HomeFeaturedCommunitySlide } from './home-featured-community-shared'
import { HOME_FEATURED_COMMUNITY_SOURCE } from './home-featured-community-shared'
import './home-featured-community.css'

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
  const labelId = useId()
  const [index, setIndex] = useState(0)
  if (slides.length === 0) return null

  const safeIndex = ((index % slides.length) + slides.length) % slides.length
  const slide = slides[safeIndex]!
  const multi = slides.length > 1

  function go(delta: number) {
    setIndex((prev) => {
      const next = prev + delta
      if (next < 0) return slides.length - 1
      if (next >= slides.length) return 0
      return next
    })
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
      </div>

      <div
        className="home-featured-community__frame"
        role="group"
        aria-roledescription="carousel"
        aria-labelledby={labelId}
      >
        <p id={labelId} className="home-featured-community__vh">
          {slide.name}, {safeIndex + 1} of {slides.length}
        </p>

        <figure className="home-featured-community__media">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={slide.photoSrc} alt="" decoding="async" />
        </figure>

        <div className="home-featured-community__panel">
          <p className="home-featured-community__city">{slide.city}</p>
          <Link href={slide.href} className="home-featured-community__name">
            {slide.name}
          </Link>

          {slide.figures.length > 0 ? (
            <ul className="home-featured-community__figures">
              {slide.figures.map((figure) => (
                <li key={`${slide.slug}-${figure.label}`} className="home-featured-community__figure">
                  <span className="home-featured-community__figure-value">{figure.value}</span>
                  <span className="home-featured-community__figure-label">{figure.label}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {slide.blurb ? <p className="home-featured-community__blurb">{slide.blurb}</p> : null}

          <V3Button href={slide.href} variant="primary" className="home-featured-community__cta">
            {`Explore ${slide.name}`}
          </V3Button>
        </div>
      </div>

      <div className="home-featured-community__nav">
        {multi ? (
          <div className="home-featured-community__controls">
            <V3Button
              type="button"
              variant="ghost"
              className="home-featured-community__control"
              ariaLabel="Previous featured community"
              onClick={() => go(-1)}
            >
              Previous
            </V3Button>
            <V3Button
              type="button"
              variant="ghost"
              className="home-featured-community__control"
              ariaLabel="Next featured community"
              onClick={() => go(1)}
            >
              Next
            </V3Button>
          </div>
        ) : null}

        {multi ? (
          <ul className="home-featured-community__dots" aria-label="Featured community slides">
            {slides.map((item, i) => (
              <li key={item.slug}>
                <V3Button
                  type="button"
                  variant="ghost"
                  className="home-featured-community__dot"
                  ariaLabel={`${item.name}, slide ${i + 1} of ${slides.length}`}
                  ariaPressed={i === safeIndex}
                  onClick={() => setIndex(i)}
                >
                  <span className="home-featured-community__dot-mark" aria-hidden="true" />
                </V3Button>
              </li>
            ))}
          </ul>
        ) : null}

        <Link href="/communities" className="home-featured-community__more">
          Every community
        </Link>
      </div>

      <p className="home-featured-community__source">{HOME_FEATURED_COMMUNITY_SOURCE}</p>
    </section>
  )
}
