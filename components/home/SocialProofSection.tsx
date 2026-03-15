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
    <span className="inline-flex gap-0.5 text-lg tracking-tight text-warning sm:text-xl" aria-hidden>
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
        <svg viewBox="0 0 24 24" className="h-5 w-5 sm:h-6 sm:w-6" fill="currentColor" aria-hidden>
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09zM12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23zM5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62zM12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
      </span>
    )
  }
  if (source === 'Zillow') {
    return (
      <span className={iconClass} aria-hidden>
        <svg viewBox="0 0 24 24" className="h-5 w-5 sm:h-6 sm:w-6" fill="currentColor" aria-hidden>
          <path d="M12 2L2 10.5v11.5h7V16h6v6h7V10.5L12 2zm0 3.2l5.5 4.8v8.5h-3v-6H9.5v6h-3v-8.5L12 5.2z" />
        </svg>
      </span>
    )
  }
  return null
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
      className={cn('w-full bg-muted px-4 pt-8 pb-12 sm:px-6 sm:pt-10 sm:pb-16')}
      aria-labelledby="social-proof-heading"
    >
      <div className="mx-auto flex w-full max-w-[80%] flex-col gap-4 md:flex-row md:items-stretch md:gap-6">
        {/* Left: photo only — no container, no white; uses section background (e.g. muted) */}
        <div className="relative flex min-h-[240px] shrink-0 items-center justify-center bg-transparent md:min-h-[320px] md:w-2/5">
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

        {/* Right: reviews centered vertically, card 90% of column height */}
        <div className="relative flex min-h-[240px] flex-1 items-center md:min-h-[320px]">
          {!transitioning ? (
            <div className="flex h-[90%] w-full max-h-[90%]">
              <Card className="h-full w-full">
                <CardContent className="flex h-full min-h-0 flex-col gap-1 p-2.5 sm:p-3">
                  <h2 id="social-proof-heading" className="shrink-0 text-xs font-semibold leading-tight text-foreground sm:text-sm">
                    Work with Central Oregon&apos;s top team
                  </h2>
                  <FiveStars />
                  <blockquote className="min-h-0 flex-1 overflow-hidden">
                    <p className="line-clamp-6 text-[11px] leading-snug text-foreground sm:text-xs">
                      &ldquo;{current.quote}&rdquo;
                    </p>
                  </blockquote>
                  <Separator className="shrink-0" />
                  <footer className="flex shrink-0 flex-wrap items-center justify-between gap-1.5">
                    <cite className="not-italic text-[11px] font-semibold text-primary sm:text-xs">
                      — {current.author}
                    </cite>
                    <span className="flex shrink-0 items-center gap-1">
                      <SourceIcon source={current.source} />
                      <Badge variant="outline" className="text-[10px]">{current.source}</Badge>
                    </span>
                  </footer>
                  {testimonials.length > 1 && (
                    <div className="flex shrink-0 flex-col gap-0.5">
                      <div className="flex items-center justify-center gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => goToIndex(index - 1)}
                          aria-label="Previous review"
                        >
                          <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 12H5M12 19l-7-7 7-7" />
                          </svg>
                        </Button>
                        <div className="flex items-center gap-0.5" aria-label="Review navigation">
                          {testimonials.map((_, i) => (
                            <Button
                              key={i}
                              type="button"
                              variant="ghost"
                              size="icon"
                              className={cn('h-4 w-4 rounded-full p-0', i === index ? 'bg-primary text-primary-foreground' : 'bg-muted')}
                              onClick={() => goToIndex(i)}
                              aria-label={`Go to review ${i + 1} of ${testimonials.length}`}
                            />
                          ))}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => goToIndex(index + 1)}
                          aria-label="Next review"
                        >
                          <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12h14M12 5l7 7-7 7" />
                          </svg>
                        </Button>
                      </div>
                      <p className="text-center text-[9px] text-muted-foreground sm:text-[10px]">
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
              </Card>
            </div>
          ) : (
            <>
              <div
                className="absolute inset-0 flex items-center opacity-0 transition-opacity"
                style={{ transitionDuration: `${FADE_DURATION_MS}ms` }}
                aria-hidden
              >
                <div className="h-[90%] w-full max-h-[90%]">
                  <Card className="h-full w-full">
                    <CardContent className="flex h-full min-h-0 flex-col gap-1 p-2.5 sm:p-3">
                      <h2 id="social-proof-heading" className="shrink-0 text-xs font-semibold leading-tight text-foreground sm:text-sm">
                        Work with Central Oregon&apos;s top team
                      </h2>
                      <FiveStars />
                      <blockquote className="min-h-0 flex-1 overflow-hidden">
                        <p className="line-clamp-6 text-[11px] leading-snug text-foreground sm:text-xs">
                          &ldquo;{current.quote}&rdquo;
                        </p>
                      </blockquote>
                      <Separator className="shrink-0" />
                      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-1.5">
                        <cite className="not-italic text-[11px] font-semibold text-primary sm:text-xs">
                          — {current.author}
                        </cite>
                        <span className="flex shrink-0 items-center gap-1">
                          <SourceIcon source={current.source} />
                          <Badge variant="outline" className="text-[10px]">{current.source}</Badge>
                        </span>
                      </footer>
                      {testimonials.length > 1 && (
                        <div className="flex shrink-0 flex-col gap-0.5">
                          <div className="flex items-center justify-center gap-0.5">
                            <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={() => goToIndex(index - 1)} aria-label="Previous review">
                              <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M19 12H5M12 19l-7-7 7-7" />
                              </svg>
                            </Button>
                            <div className="flex items-center gap-0.5" aria-label="Review navigation">
                              {testimonials.map((_, i) => (
                                <Button
                                  key={i}
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className={cn('h-4 w-4 rounded-full p-0', i === index ? 'bg-primary text-primary-foreground' : 'bg-muted')}
                                  onClick={() => goToIndex(i)}
                                  aria-label={`Go to review ${i + 1} of ${testimonials.length}`}
                                />
                              ))}
                            </div>
                            <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={() => goToIndex(index + 1)} aria-label="Next review">
                              <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M5 12h14M12 5l7 7-7 7" />
                              </svg>
                            </Button>
                          </div>
                          <p className="text-center text-[9px] text-muted-foreground sm:text-[10px]">
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
                  </Card>
                </div>
              </div>
              <div
                className={cn(
                  'absolute inset-0 z-10 flex items-center transition-opacity',
                  showNext ? 'opacity-100' : 'opacity-0'
                )}
                style={{ transitionDuration: `${FADE_DURATION_MS}ms` }}
                onTransitionEnd={handleFadeInEnd}
              >
                <div className="h-[90%] w-full max-h-[90%]">
                  <Card className="h-full w-full">
                    <CardContent className="flex h-full min-h-0 flex-col gap-1 p-2.5 sm:p-3">
                      <h2 className="shrink-0 text-xs font-semibold leading-tight text-foreground sm:text-sm">
                        Work with Central Oregon&apos;s top team
                      </h2>
                      <FiveStars animate />
                      <blockquote className="min-h-0 flex-1 overflow-hidden">
                        <p className="line-clamp-6 text-[11px] leading-snug text-foreground sm:text-xs">
                          &ldquo;{nextReview.quote}&rdquo;
                        </p>
                      </blockquote>
                      <Separator className="shrink-0" />
                      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-1.5">
                        <cite className="not-italic text-[11px] font-semibold text-primary sm:text-xs">
                          — {nextReview.author}
                        </cite>
                        <span className="flex shrink-0 items-center gap-1">
                          <SourceIcon source={nextReview.source} />
                          <Badge variant="outline" className="text-[10px]">{nextReview.source}</Badge>
                        </span>
                      </footer>
                      {testimonials.length > 1 && (
                        <div className="flex shrink-0 flex-col gap-0.5">
                          <div className="flex items-center justify-center gap-0.5">
                            <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={() => goToIndex(nextIndex - 1)} aria-label="Previous review">
                              <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M19 12H5M12 19l-7-7 7-7" />
                              </svg>
                            </Button>
                            <div className="flex items-center gap-0.5" aria-label="Review navigation">
                              {testimonials.map((_, i) => (
                                <Button
                                  key={i}
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className={cn('h-4 w-4 rounded-full p-0', i === nextIndex ? 'bg-primary text-primary-foreground' : 'bg-muted')}
                                  onClick={() => goToIndex(i)}
                                  aria-label={`Go to review ${i + 1} of ${testimonials.length}`}
                                />
                              ))}
                            </div>
                            <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={() => goToIndex(nextIndex + 1)} aria-label="Next review">
                              <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M5 12h14M12 5l7 7-7 7" />
                              </svg>
                            </Button>
                          </div>
                          <p className="text-center text-[9px] text-muted-foreground sm:text-[10px]">
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
                  </Card>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
