'use client'

/**
 * Featured communities as one spotlight with an index (2026-10-01).
 *
 * WHAT IT WAS. A shadcn carousel of community Cards (SITE-97): photo, name,
 * one figure, a blurb, Explore. The separate judge read it, the Browse places
 * new-construction run and the resort run under it as one card shape spent
 * three times ("three consecutive sections ... the identical eyebrow-heading-
 * into-3-card-arrow-carousel"), and the resort run's figure as a bare numeral.
 *
 * WHAT IT IS. One community large and the rest as an index beside it, the
 * resorts run folded in (the page's one place for community figures):
 * - the index is the installed shadcn Tabs (Radix: WAI-ARIA tabs, roving
 *   focus, arrow keys), every community a row with its "homes for sale"
 *   figure, labelled, and the figure drawn as a rule on one scale (the
 *   largest at full ink), busiest first;
 * - the panel is the installed shadcn Card: the community's photograph, its
 *   town, its name, its authored first sentence, then its published figures
 *   each with its label, and its door;
 * - every panel is in the served HTML (forceMount: crawlable doors and
 *   figures), only the chosen one shows; the choice moves on click, arrow
 *   keys, Home and End.
 * Figures print as the loader published them (static strings, no count-up:
 * the server face of an animated number was a zero, VOICE audit 2026-09-22).
 * Empty slides still mount #featured-community so Home smoke never misses it.
 */
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { V3_ROOT_CLASS, V3Eyebrow, V3Heading } from '@/components/site/v3'
import type { HomeFeaturedCommunityFigure, HomeFeaturedCommunitySlide } from './home-featured-community-shared'
import { HOME_FEATURED_COMMUNITY_SOURCE } from './home-featured-community-shared'
import './home-featured-community.css'

/**
 * The figures a panel prints, each only when published: the two the source
 * line describes, both alias-aware over the same listings. The loader's
 * MarketPulse figures (new this week, days to an offer) come from a narrower
 * subdivision-name join (Tetherow 13 active there against 22 here, read
 * 2026-10-01), so they do not stand beside these.
 */
const PANEL_FIGURES = ['homes for sale', 'home for sale', 'median list price'] as const

function forSaleOf(slide: HomeFeaturedCommunitySlide): HomeFeaturedCommunityFigure | null {
  return slide.figures.find((f) => f.label === 'homes for sale' || f.label === 'home for sale') ?? null
}

/**
 * Busiest first. When any community has a published count, one without
 * (Crosswater read 0 on 2026-10-01) leaves the spotlight rather than standing
 * as an empty panel; when none has one (the read failed), every slide stays,
 * named and described, in its curated order.
 */
export function spotlightOrder(slides: readonly HomeFeaturedCommunitySlide[]): HomeFeaturedCommunitySlide[] {
  const anyCounted = slides.some((slide) => forSaleOf(slide)?.n != null)
  return slides
    .filter((slide) => !anyCounted || forSaleOf(slide)?.n != null)
    .map((slide, i) => ({ slide, i, n: forSaleOf(slide)?.n ?? null }))
    .sort((a, b) => {
      if (a.n != null && b.n != null) return b.n - a.n || a.i - b.i
      if (a.n != null) return -1
      if (b.n != null) return 1
      return a.i - b.i
    })
    .map((x) => x.slide)
}

function panelFigures(slide: HomeFeaturedCommunitySlide): HomeFeaturedCommunityFigure[] {
  return PANEL_FIGURES.flatMap((label) => slide.figures.filter((f) => f.label === label))
}

export function HomeFeaturedCommunity({
  slides,
  id = 'featured-community',
  eyebrow = 'Resorts and communities',
  heading = 'Resorts and planned communities',
}: {
  slides: readonly HomeFeaturedCommunitySlide[]
  id?: string
  eyebrow?: string
  heading?: string
}) {
  const ordered = useMemo(() => spotlightOrder(slides), [slides])
  const [chosen, setChosen] = useState<string | null>(null)
  const value = chosen && ordered.some((slide) => slide.slug === chosen) ? chosen : (ordered[0]?.slug ?? '')
  const largest = useMemo(
    () => Math.max(0, ...ordered.map((slide) => forSaleOf(slide)?.n ?? 0)),
    [ordered],
  )

  if (ordered.length === 0) {
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
        <p className="home-featured-community__claim">
          Pick a community to see its homes for sale and its median list price today.
        </p>
      </div>

      <Tabs
        value={value}
        onValueChange={setChosen}
        orientation="vertical"
        className="home-featured-community__stage"
      >
        <TabsList
          aria-label={heading}
          variant="line"
          className="home-featured-community__index"
          // Jax stands off the index as he does off a photograph: at 375 the
          // row of tabs runs under his resting disc (build b1).
          data-jax-clear=""
        >
          {ordered.map((slide) => {
            const count = forSaleOf(slide)
            const share = count?.n != null && largest > 0 ? count.n / largest : null
            return (
              <TabsTrigger key={slide.slug} value={slide.slug} className="home-featured-community__tab">
                <span className="home-featured-community__tab-name">{slide.name}</span>
                {count ? (
                  <span className="home-featured-community__tab-count">
                    {count.value} <span className="home-featured-community__tab-unit">for sale</span>
                  </span>
                ) : (
                  <span className="home-featured-community__tab-count home-featured-community__tab-unit">
                    {slide.city}
                  </span>
                )}
                {share != null ? (
                  <span className="home-featured-community__tab-rule" aria-hidden="true">
                    <span style={{ width: `${Math.max(share * 100, 2)}%` }} />
                  </span>
                ) : null}
              </TabsTrigger>
            )
          })}
        </TabsList>

        {ordered.map((slide) => {
          const figures = panelFigures(slide)
          return (
            <TabsContent
              key={slide.slug}
              value={slide.slug}
              forceMount
              hidden={slide.slug !== value}
              className="home-featured-community__panel"
            >
              <Card className="home-featured-community__card">
                <div className="home-featured-community__photo" data-jax-clear="">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={slide.photoSrc}
                    alt={`${slide.name}, ${slide.city}`}
                    width={1200}
                    height={800}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <div className="home-featured-community__copy">
                  <CardHeader className="home-featured-community__card-head">
                    <CardDescription className="home-featured-community__city">{slide.city}</CardDescription>
                    <CardTitle className="home-featured-community__name">{slide.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="home-featured-community__card-body">
                    {slide.blurb ? <p className="home-featured-community__blurb">{slide.blurb}</p> : null}
                    {figures.length > 0 ? (
                      <dl className="home-featured-community__figures">
                        {figures.map((figure) => (
                          <div key={figure.label} className="home-featured-community__figure">
                            <dt className="home-featured-community__figure-label">{figure.label}</dt>
                            <dd className="home-featured-community__figure-value">{figure.value}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                  </CardContent>
                  <CardFooter className="home-featured-community__card-foot">
                    <Link href={slide.href} className="home-featured-community__door">
                      {`Explore ${slide.name}`}
                    </Link>
                  </CardFooter>
                </div>
              </Card>
            </TabsContent>
          )
        })}
      </Tabs>

      <div className="home-featured-community__foot">
        <Link href="/communities" className="home-featured-community__more">
          Every community
        </Link>
        <p className="home-featured-community__source">{HOME_FEATURED_COMMUNITY_SOURCE}</p>
      </div>
    </section>
  )
}
