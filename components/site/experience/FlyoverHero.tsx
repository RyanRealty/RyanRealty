/* Hallmark · macrostructure: Marquee Hero · tone: editorial-data · anchor hue: navy */
/**
 * FlyoverHero — Experience System shared module (Geo archetype hero)
 *
 * Full-bleed video hero with muted autoplay + poster fallback.
 * Overlays live market numerals in Amboqia display with a pulsing live-dot.
 *
 * Reduced-motion: if the user prefers reduced motion, the <video> is never
 * loaded — only the static poster renders. The live stats still display.
 *
 * Video convention: /videos/flyovers/<slug>/hero.mp4 + poster.jpg
 * Not all communities have a flyover yet — pass videoSrc=null to render
 * a photo hero via the existng HeroBlock path (FlyoverHero degrades cleanly).
 *
 * Props:
 *   slug          — geo slug used to build default video paths
 *   videoSrc      — override video src (null = no video, photo-only fallback)
 *   posterSrc     — override poster src
 *   photoSrc      — fallback photo when no video
 *   photoAlt      — alt text for the photo
 *   headline      — hero H1 (community / city name)
 *   activeCount   — live active listing count (null renders "—")
 *   medianPrice   — live median list price in dollars (null renders "—")
 *   medianDays    — median days to pending (null renders "—")
 *   sectionId     — passed to useEngagementTracking
 */
'use client'

import Image from 'next/image'
import { useRef, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { DisplayHeading, Container } from '@/components/site/primitives'
import { useEngagementTracking } from './useEngagementTracking'
import { useCountUp } from './useCountUp'

function fmtPrice(n: number | null): string {
  if (n == null) return '\u2014'
  // Brand spec: currency rounded to the nearest thousand, full form —
  // $1,425,000, never $1,425K (CLAUDE.md voice rules).
  return `$${(Math.round(n / 1000) * 1000).toLocaleString()}`
}

function fmtCount(n: number | null): string {
  if (n == null) return '—'
  return n.toLocaleString()
}

function fmtDays(n: number | null): string {
  if (n == null) return '—'
  return `${Math.round(n)}`
}

type Props = {
  slug: string
  headline: string
  /**
   * Optional place-name display treatment (Geo archetype v3.2, Family 4):
   * renders the place name HUGE in Amboqia inside the same <h1> with the
   * headline as a smaller second line — the name IS the design, the headline
   * keeps the full SEO text. Omit for the original single-line H1.
   */
  displayName?: string
  /**
   * Optional small label over the media (bottom-right). Used to honestly
   * label a regional fallback photo ("Regional view · Cascade Range") so a
   * city without a verified photo never implies a wrong place.
   */
  mediaCaption?: string
  activeCount?: number | null
  medianPrice?: number | null
  medianDays?: number | null
  /** Honest label for the days stat. Cities = "Days to pending" (pulse), but
   *  neighborhoods source days-on-market from market_stats_cache — pass the
   *  matching label so the number is never mislabeled (§0). */
  daysLabel?: string
  videoSrc?: string | null
  posterSrc?: string | null
  photoSrc?: string | null
  photoAlt?: string
  sectionId?: string
  className?: string
}

export function FlyoverHero({
  slug,
  headline,
  displayName,
  mediaCaption,
  activeCount = null,
  medianPrice = null,
  medianDays = null,
  daysLabel = 'Days to pending',
  videoSrc,
  posterSrc,
  photoSrc,
  photoAlt,
  sectionId = 'hero',
  className,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  useEngagementTracking(sectionId, { ref, pageType: 'geo', position: 0 })

  // Count-up animation for activeCount on viewport entry
  const activeSpanRef = useRef<HTMLSpanElement | null>(null)
  const { displayValue: activeCountDisplay } = useCountUp(activeCount, {
    duration: 900,
    format: (n) => n.toLocaleString(),
    ref: activeSpanRef as unknown as React.RefObject<HTMLElement | null>,
  })

  // Default paths from convention
  const defaultVideo = `/videos/flyovers/${slug}/hero.mp4`
  const defaultPoster = `/videos/flyovers/${slug}/poster.jpg`
  const resolvedVideo = videoSrc !== undefined ? videoSrc : defaultVideo
  const resolvedPoster = posterSrc !== undefined ? posterSrc : defaultPoster

  // Reduced-motion check (client-side)
  const [prefersReduced, setPrefersReduced] = useState(false)
  const [videoError, setVideoError] = useState(false)
  // LCP fix (2026-06-10, RUM showed 60s LCP on /communities/tetherow): the
  // hero <video> (37 MB) used to be the painted media layer, so LCP waited on
  // video bytes and the raw 814 KB poster.jpg (the poster attribute bypasses
  // Next image optimization). Now the optimized poster <Image priority> always
  // paints first as the base layer, and the video element mounts ~1.2s later,
  // fading in over the poster once it can actually play.
  const [mountVideo, setMountVideo] = useState(false)
  const [videoPlaying, setVideoPlaying] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReduced(mq.matches)
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    const t = window.setTimeout(() => setMountVideo(true), 1200)
    return () => window.clearTimeout(t)
  }, [])

  const showVideo = resolvedVideo && !prefersReduced && !videoError && mountVideo

  const hasStats = activeCount != null || medianPrice != null || medianDays != null

  return (
    <section
      ref={ref}
      aria-label={`${headline} hero`}
      className={cn(
        'relative flex items-end overflow-hidden',
        'min-h-[580px] md:min-h-[680px]',
        className,
      )}
      style={{ paddingTop: 'max(88px, env(safe-area-inset-top))' }}
    >
      {/* Media layer — optimized poster paints first (the LCP element); the
          video mounts after first paint and fades in over it once playing. */}
      <div className="absolute inset-0">
        {(resolvedPoster || photoSrc) ? (
          <Image
            src={(photoSrc ?? resolvedPoster) as string}
            alt={photoAlt ?? `${headline}, aerial view`}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        ) : null}
        {showVideo ? (
          <video
            ref={videoRef}
            src={resolvedVideo as string}
            autoPlay
            muted
            loop
            playsInline
            preload="none"
            className={cn(
              'absolute inset-0 w-full h-full object-cover transition-opacity duration-700',
              videoPlaying ? 'opacity-100' : 'opacity-0',
            )}
            onPlaying={() => setVideoPlaying(true)}
            onError={() => setVideoError(true)}
            aria-hidden
          />
        ) : (
          null
        )}
      </div>

      {/* Multi-layer scrim — protects text, shows sky/photo at top */}
      <div
        className="absolute inset-0"
        aria-hidden
        style={{
          background:
            'linear-gradient(to top, rgba(16,39,66,0.88) 0%, rgba(16,39,66,0.56) 35%, rgba(16,39,66,0.18) 65%, rgba(16,39,66,0.0) 82%)',
        }}
      />
      <div
        className="absolute inset-0"
        aria-hidden
        style={{
          background:
            'linear-gradient(to bottom, rgba(16,39,66,0.38) 0%, transparent 18%)',
        }}
      />

      {/* Honest media label (e.g. regional-fallback photo) */}
      {mediaCaption ? (
        <span
          className="absolute bottom-3 right-3 z-10 rounded-md px-2 py-1 text-[10px] font-medium uppercase tracking-[0.08em] text-white/75"
          style={{ background: 'rgba(16,39,66,0.55)' }}
        >
          {mediaCaption}
        </span>
      ) : null}

      {/* Content */}
      <Container className="relative w-full pb-12 md:pb-16">
        {/* Live indicator */}
        <div className="flex items-center gap-2 mb-5">
          <span
            className="inline-block w-[7px] h-[7px] rounded-full bg-green-400"
            style={{
              boxShadow: '0 0 0 2px rgba(74,222,128,0.30)',
              animation: 'rr-pulse-dot 2s ease-in-out infinite',
            }}
            aria-hidden
          />
          <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-white/70">
            Live market
          </span>
        </div>

        {/* Place-name display treatment (Family 4): the name IS the design.
            One <h1> carries both the huge Amboqia place name and the full
            SEO headline as a smaller second line. Stats follow below. */}
        {displayName ? (
          <DisplayHeading
            as="h1"
            className="text-white mb-5"
            style={{
              animation: 'rr-fade-up 0.9s cubic-bezier(0.16,1,0.3,1) 0.10s both',
            }}
          >
            <span
              className="block leading-none"
              style={{
                fontSize: 'clamp(3.25rem, 11vw, 7rem)',
                letterSpacing: '-0.02em',
                textShadow: '0 2px 18px rgba(0,0,0,0.28)',
              }}
            >
              {displayName}
            </span>
            <span
              className="block mt-3 font-sans font-medium text-white/85"
              style={{
                fontSize: 'clamp(0.95rem, 1.6vw, 1.15rem)',
                letterSpacing: '0.005em',
                lineHeight: 1.35,
                textShadow: '0 1px 8px rgba(0,0,0,0.20)',
              }}
            >
              {headline}
            </span>
          </DisplayHeading>
        ) : null}

        {/* Stats in Amboqia — data IS the identity */}
        {hasStats ? (
          <div className="flex items-end gap-8 md:gap-12 flex-wrap mb-5">
            {activeCount != null ? (
              <div className="flex flex-col gap-0.5">
                <span
                  ref={activeSpanRef}
                  className="font-display tabular-nums text-white leading-none"
                  style={{
                    fontSize: 'clamp(2.5rem, 5.5vw, 4.25rem)',
                    letterSpacing: '-0.02em',
                    textShadow: '0 2px 16px rgba(0,0,0,0.22)',
                    animation: 'rr-stat-reveal 0.8s cubic-bezier(0.16,1,0.3,1) 0.30s both',
                  }}
                >
                  {activeCountDisplay}
                </span>
                <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-white/58">
                  Active homes
                </span>
              </div>
            ) : null}

            {activeCount != null && medianPrice != null ? (
              <div
                className="w-px h-12 self-center flex-shrink-0"
                aria-hidden
                style={{ background: 'rgba(255,255,255,0.18)' }}
              />
            ) : null}

            {medianPrice != null ? (
              <div className="flex flex-col gap-0.5">
                <span
                  className="font-display tabular-nums text-white leading-none"
                  style={{
                    fontSize: 'clamp(2.5rem, 5.5vw, 4.25rem)',
                    letterSpacing: '-0.02em',
                    textShadow: '0 2px 16px rgba(0,0,0,0.22)',
                    animation: 'rr-stat-reveal 0.8s cubic-bezier(0.16,1,0.3,1) 0.45s both',
                  }}
                >
                  {fmtPrice(medianPrice)}
                </span>
                <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-white/58">
                  Median list price
                </span>
              </div>
            ) : null}

            {medianDays != null ? (
              <>
                <div
                  className="w-px h-12 self-center flex-shrink-0"
                  aria-hidden
                  style={{ background: 'rgba(255,255,255,0.18)' }}
                />
                <div className="flex flex-col gap-0.5">
                  <span
                    className="font-display tabular-nums text-white leading-none"
                    style={{
                      fontSize: 'clamp(2.5rem, 5.5vw, 4.25rem)',
                      letterSpacing: '-0.02em',
                      textShadow: '0 2px 16px rgba(0,0,0,0.22)',
                      animation: 'rr-stat-reveal 0.8s cubic-bezier(0.16,1,0.3,1) 0.60s both',
                    }}
                  >
                    {fmtDays(medianDays)}
                  </span>
                  <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-white/58">
                    {daysLabel}
                  </span>
                </div>
              </>
            ) : null}
          </div>
        ) : null}

        {/* H1 headline (original treatment — only when no displayName) */}
        {!displayName ? (
          <DisplayHeading
            as="h1"
            className="text-white max-w-[680px]"
            style={{
              fontSize: 'clamp(1.75rem, 3.2vw, 2.75rem)',
              letterSpacing: '-0.01em',
              lineHeight: 1.18,
              textShadow: '0 1px 10px rgba(0,0,0,0.18)',
              animation: 'rr-fade-up 0.9s cubic-bezier(0.16,1,0.3,1) 0.15s both',
            }}
          >
            {headline}
          </DisplayHeading>
        ) : null}
      </Container>

      {/* Keyframe definitions — injected once here, reused by all stat-reveal instances */}
      <style>{`
        @keyframes rr-pulse-dot {
          0%, 100% { box-shadow: 0 0 0 2px rgba(74,222,128,0.30); }
          50%       { box-shadow: 0 0 0 5px rgba(74,222,128,0.14); }
        }
        @keyframes rr-stat-reveal {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes rr-fade-up {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .font-display { animation: none !important; }
        }
      `}</style>
    </section>
  )
}
