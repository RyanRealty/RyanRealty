'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import { GOOGLE_REVIEWS_URL } from '@/lib/testimonials'
import type { Testimonial, TestimonialSource } from '@/lib/testimonials'

const ROTATE_INTERVAL_MS = 7000
const FADE_DURATION_MS = 500

function FiveStars({ animate = false }: { animate?: boolean }) {
  return (
    <span className="inline-flex gap-0.5 text-xl tracking-tight text-warning sm:text-2xl" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={cn(
            'inline-block',
            animate && 'animate-in fade-in-0 zoom-in-95 duration-300 [animation-fill-mode:backwards]'
          )}
          style={animate ? { animationDelay: `${i * 80}ms` } : undefined}
        >
          ★
        </span>
      ))}
    </span>
  )
}

function SourceIcon({ source, className }: { source: TestimonialSource; className?: string }) {
  const iconClass = cn('shrink-0 text-muted-foreground', className)
  if (source === 'Google') {
    return (
      <span className={iconClass} aria-hidden>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09zM12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23zM5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62zM12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
      </span>
    )
  }
  if (source === 'Zillow') {
    return (
      <span className={iconClass} aria-hidden>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
          <path d="M12 2L2 10.5v11.5h7V16h6v6h7V10.5L12 2zm0 3.2l5.5 4.8v8.5h-3v-6H9.5v6h-3v-8.5L12 5.2z" />
        </svg>
      </span>
    )
  }
  return null
}

/** Shared card content to avoid triplication */
function ReviewCardContent({
  review,
  headingId,
  animate,
  activeIndex,
  testimonials,
  onGoToIndex,
}: {
  review: Testimonial
  headingId?: string
  animate?: boolean
  activeIndex: number
  testimonials: Testimonial[]
  onGoToIndex: (i: number) => void
}) {
  return (
    <CardContent className="flex h-full min-h-0 flex-col gap-2 p-5 sm:p-6">
      <h2
        {...(headingId ? { id: headingId } : {})}
        className="shrink-0 text-base font-semibold leading-tight text-foreground sm:text-lg"
      >
        Work with Central Oregon&apos;s top team
      </h2>
      <FiveStars animate={animate} />
      <blockquote className="min-h-0 flex-1 overflow-hidden">
        <p className="line-clamp-5 text-sm leading-relaxed text-foreground sm:text-base">
          &ldquo;{review.quote}&rdquo;
        </p>
      </blockquote>
      <Separator className="shrink-0" />
      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <cite className="not-italic text-sm font-semibold text-primary">
          — {review.author}
        </cite>
        <span className="flex shrink-0 items-center gap-1.5">
          <SourceIcon source={review.source} />
          <Badge variant="outline" className="text-xs">{review.source}</Badge>
        </span>
      </footer>
      {testimonials.length > 1 && (
        <div className="flex shrink-0 flex-col gap-1 pt-1">
          <div className="flex items-center justify-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onGoToIndex(activeIndex - 1)}
              aria-label="Previous review"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </Button>
            <div className="flex items-center gap-1" aria-label="Review navigation">
              {testimonials.map((_, i) => (
                <Button
                  key={i}
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 p-0"
                  onClick={() => onGoToIndex(i)}
                  aria-label={`Go to review ${i + 1} of ${testimonials.length}`}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'h-2.5 w-2.5 rounded-full',
                      i === activeIndex ? 'bg-primary' : 'bg-border'
                    )}
                  />
                </Button>
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onGoToIndex(activeIndex + 1)}
              aria-label="Next review"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Button>
          </div>
          <p className="text-center text-sm text-foreground/80">
            Not all Google or Zillow reviews shown.{' '}
            <a href={GOOGLE_REVIEWS_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
              See all on Google
            </a>
            {' · '}
            <Link href="/reviews" className="underline hover:text-foreground">
              Read all reviews
            </Link>
          </p>
        </div>
      )}
    </CardContent>
  )
}

type Props = {
  testimonials: Testimonial[]
  /** Resolved team photo URL (from admin or static file with cache-buster). */
  teamImageSrc: string
}

export default function SocialProofSection({ testimonials, teamImageSrc }: Props) {
  const [index, setIndex] = useState(0)
  const [transitioning, setTransitioning] = useState(false)
  const [nextIndex, setNextIndex] = useState(0)
  const [showNext, setShowNext] = useState(false)
  const [imageError, setImageError] = useState(false)

  const startFade = useCallback(() => {
    if (testimonials.length <= 1 || transitioning) return
    setNextIndex((index + 1) % testimonials.length)
    setTransitioning(true)
    setShowNext(false)
  }, [testimonials.length, transitioning, index])

  useEffect(() => {
    if (testimonials.length <= 1) return
    const id = setInterval(startFade, ROTATE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [testimonials.length, startFade])

  useEffect(() => {
    if (!transitioning) return
    const raf = requestAnimationFrame(() => setShowNext(true))
    return () => cancelAnimationFrame(raf)
  }, [transitioning])

  const handleFadeInEnd = useCallback(
    (e: React.TransitionEvent) => {
      if (!transitioning || e.propertyName !== 'opacity') return
      setIndex(nextIndex)
      setTransitioning(false)
      setShowNext(false)
    },
    [transitioning, nextIndex]
  )

  const goToIndex = useCallback(
    (target: number) => {
      if (testimonials.length <= 1 || transitioning) return
      const next = (target + testimonials.length) % testimonials.length
      if (next === index) return
      setNextIndex(next)
      setTransitioning(true)
      setShowNext(false)
    },
    [testimonials.length, transitioning, index]
  )

  if (testimonials.length === 0) return null

  const current = testimonials[index]
  const nextReview = testimonials[nextIndex]

  return (
    <section
      className="w-full bg-muted px-4 py-10 sm:px-6 sm:py-14"
      aria-labelledby="social-proof-heading"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 md:flex-row md:items-stretch md:gap-8">
        {/* Left: team photo */}
        <div className="relative flex min-h-[240px] shrink-0 items-center justify-center bg-transparent md:min-h-[360px] md:w-2/5">
          {!imageError ? (
            // eslint-disable-next-line @next/next/no-img-element -- Plain img so the exact URL loads (no Next optimization/AVIF cache).
            <img
              src={teamImageSrc}
              alt="Ryan Realty team"
              className="max-h-full w-full object-contain object-center"
              onError={() => setImageError(true)}
              fetchPriority="high"
            />
          ) : (
            <Alert variant="destructive" className="flex h-full items-center justify-center">
              <AlertDescription>Image failed to load</AlertDescription>
            </Alert>
          )}
        </div>

        {/* Right: reviews carousel */}
        <div className="relative flex min-h-[280px] flex-1 items-center md:min-h-[360px]">
          {!transitioning ? (
            <Card className="w-full">
              <ReviewCardContent
                review={current}
                headingId="social-proof-heading"
                activeIndex={index}
                testimonials={testimonials}
                onGoToIndex={goToIndex}
              />
            </Card>
          ) : (
            <>
              <div
                className="absolute inset-0 flex items-center opacity-0 transition-opacity"
                style={{ transitionDuration: `${FADE_DURATION_MS}ms` }}
                aria-hidden
              >
                <Card className="w-full">
                  <ReviewCardContent
                    review={current}
                    headingId="social-proof-heading"
                    activeIndex={index}
                    testimonials={testimonials}
                    onGoToIndex={goToIndex}
                  />
                </Card>
              </div>
              <div
                className={cn(
                  'absolute inset-0 z-10 flex items-center transition-opacity',
                  showNext ? 'opacity-100' : 'opacity-0'
                )}
                style={{ transitionDuration: `${FADE_DURATION_MS}ms` }}
                onTransitionEnd={handleFadeInEnd}
              >
                <Card className="w-full">
                  <ReviewCardContent
                    review={nextReview}
                    animate
                    activeIndex={nextIndex}
                    testimonials={testimonials}
                    onGoToIndex={goToIndex}
                  />
                </Card>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
