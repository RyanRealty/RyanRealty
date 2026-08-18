'use client'

import Image from 'next/image'
import dynamic from 'next/dynamic'
import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { ListingPhoto } from '@/lib/data/types/listing'
import type { VideoEmbed } from '@/lib/data/types/video'
import { PhotoGalleryLightbox } from '@/components/site/PhotoGalleryLightbox'
import { Button } from '@/components/ui/button'
import { buildListingHeroStaticMapUrl } from '@/lib/listing-hero-static-map'
import {
  publishListingHeroCompactPrice,
  publishListingHeroKeyStats,
} from '@/lib/listing/publish-listing-hero-stats'
import { publishListingHeroUnmute, publishListingHeroVideo } from '@/lib/listing/publish-listing-hero-video'
import { HugeiconsIcon } from '@hugeicons/react'
import { MapsLocation01Icon, Cancel01Icon } from '@hugeicons/core-free-icons'

const ListingHeroMapClient = dynamic(() => import('./ListingHeroMap.client'), {
  ssr: false,
  loading: () => <div aria-hidden className="h-full w-full animate-pulse bg-muted" />,
})

/**
 * ListingHero — full-bleed KB (kinetic-brutalist) hero for the listing detail page.
 *
 * Owner directive: "make it look like the city/neighborhood KbHero — full-viewport-width,
 * tall (~62–72vh), VIDEO-FIRST."
 *
 * Behavior:
 *   - Full-bleed, edge-to-edge, 62–72vh tall (desktop), matching the KbHero treatment.
 *   - VIDEO PATH: when a marketing video exists, it plays muted+autoplay+loop full-bleed
 *     (object-cover). Clicking the hero unmutes the video (one tap). Address + price
 *     stats overlay the media via a gradient scrim, cream text — same as KbHero overlays
 *     its title. A 4-photo strip lives BELOW the hero for browsable context.
 *   - PHOTO-ONLY PATH: primary photo fills the hero full-bleed; "View all N photos"
 *     affordance overlays bottom-right. Additional photo strip below.
 *   - LIGHTBOX: click any photo in the strip, OR the photo hero itself, OR the "View all"
 *     button — opens the fullscreen PhotoGalleryLightbox with keyboard navigation.
 *     The video hero does NOT open the lightbox on click (it toggles mute instead).
 *
 * Constraints (per owner brief):
 *   - NEVER overflow:hidden on display text (KB rule — cf. kb.css overflow:visible guard).
 *   - No rounded corners on the hero itself (full-bleed treatment).
 *   - PhotoGalleryLightbox preserved (D75 parity gate).
 *   - All photos + videos preserved; thumbnails strip below the hero.
 */

type Props = {
  photos: ReadonlyArray<ListingPhoto>
  videos: ReadonlyArray<VideoEmbed>
  /** Address rendered as overlay text over the hero. */
  addressLine?: string
  /** Price, beds, baths, sqft — rendered as key-stats overlay. */
  price?: number | null
  beds?: number | null
  baths?: number | null
  sqft?: number | null
  acres?: number | null
  /** Listing coordinates — enables the bottom-left map thumb + expand toggle. */
  lat?: number | null
  lng?: number | null
  className?: string
}

function getAutoplayEmbedUrl(video: VideoEmbed): string {
  if (video.embedType !== 'iframe') return video.url
  try {
    const rawUrl = video.url.startsWith('//') ? `https:${video.url}` : video.url
    const url = new URL(rawUrl)
    if (url.hostname.includes('vimeo.com')) {
      url.searchParams.set('autoplay', '1')
      url.searchParams.set('loop', '1')
      url.searchParams.set('muted', '1')
      url.searchParams.set('background', '1')
      url.searchParams.set('byline', '0')
      url.searchParams.set('title', '0')
      url.searchParams.set('portrait', '0')
    } else if (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) {
      url.searchParams.set('autoplay', '1')
      url.searchParams.set('mute', '1')
      url.searchParams.set('loop', '1')
      url.searchParams.set('controls', '0')
      url.searchParams.set('modestbranding', '1')
      url.searchParams.set('rel', '0')
      const id = url.pathname.split('/').filter(Boolean).pop()
      if (id) url.searchParams.set('playlist', id)
    } else {
      url.searchParams.set('autoplay', '1')
      url.searchParams.set('muted', '1')
      url.searchParams.set('loop', '1')
    }
    return url.toString()
  } catch {
    return video.url
  }
}

export function ListingHero({
  photos,
  videos,
  addressLine,
  price,
  beds,
  baths,
  sqft,
  acres = null,
  lat = null,
  lng = null,
  className,
}: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [isMuted, setIsMuted] = useState(true)
  const [isPaused, setIsPaused] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const total = photos.length

  const hasCoords =
    lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)
  const staticMapUrl = hasCoords ? buildListingHeroStaticMapUrl(lat, lng) : null
  const canShowMap = hasCoords && Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim())

  const closeMap = useCallback(() => setMapOpen(false), [])
  const toggleMap = useCallback(() => setMapOpen((open) => !open), [])

  useEffect(() => {
    if (!mapOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeMap()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mapOpen, closeMap])

  // Pause autoplay video while the map covers the hero.
  useEffect(() => {
    if (!mapOpen || !videoRef.current) return
    videoRef.current.pause()
    setIsPaused(true)
  }, [mapOpen])

  // Coords alone still render the hero so the map thumb works when photos
  // have not loaded yet (or the listing has no media).
  if (total === 0 && videos.length === 0 && !canShowMap) return null

  const altBase = addressLine ? `Photo of ${addressLine}` : 'Listing photo'
  const heroVideo = publishListingHeroVideo(videos)
  const hasVideo = heroVideo != null
  const canUnmute = publishListingHeroUnmute(heroVideo)
  // Pause/play is only wired for the native <video> path — that's the one
  // element this component directly controls via videoRef. The iframe path
  // (external embed) has no reliable cross-origin pause API here.
  const canTogglePlay = canUnmute

  function toggleMute() {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted
      setIsMuted(videoRef.current.muted)
    }
  }

  function togglePlay() {
    if (!videoRef.current) return
    if (videoRef.current.paused) {
      videoRef.current.play()
      setIsPaused(false)
    } else {
      videoRef.current.pause()
      setIsPaused(true)
    }
  }

  const compactPrice = publishListingHeroCompactPrice(price)
  const keyStats = publishListingHeroKeyStats({ beds, baths, sqft, acres })

  return (
    <div className={cn('flex flex-col', className)}>
      {/* ── FULL-BLEED HERO (62–72vh) ─────────────────────────────── */}
      <div
        className="listing-hero-band"
        style={{
          position: 'relative',
          width: '100%',
          minHeight: 'clamp(360px, 66vh, 780px)',
          background: 'var(--navy, #102742)',
          overflow: 'hidden',
        }}
      >
        {/* Media layer — video or photo, full-bleed object-cover */}
        {!mapOpen && hasVideo && heroVideo ? (
          <VideoLayer
            video={heroVideo}
            posterUrl={photos[0]?.url}
            altBase={altBase}
            videoRef={videoRef}
            onTap={toggleMute}
          />
        ) : null}
        {!mapOpen && !hasVideo && photos[0] ? (
          <button
            type="button"
            onClick={() => setOpenIndex(0)}
            aria-label={`Open photo 1 of ${total}`}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, padding: 0, background: 'none', cursor: 'zoom-in' }}
          >
            <Image
              src={photos[0].url}
              alt={photos[0].caption ?? `${altBase} 1 of ${total}`}
              fill
              sizes="100vw"
              priority
              className="object-cover"
              style={{ objectFit: 'cover', objectPosition: 'center 38%' }}
            />
          </button>
        ) : null}

        {/* Expanded map fills the hero image space */}
        {mapOpen && hasCoords ? (
          <div className="absolute inset-0 z-10" role="region" aria-label="Property location map">
            <ListingHeroMapClient lat={lat!} lng={lng!} />
          </div>
        ) : null}

        {/* Gradient scrim — same gradient as kb.css .hero-photo::after */}
        {!mapOpen ? (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg,rgba(16,39,66,.30) 0%,rgba(16,39,66,.08) 18%,rgba(16,39,66,.02) 42%,rgba(16,39,66,.58) 74%,rgba(16,39,66,.92) 100%)',
            zIndex: 2,
            pointerEvents: 'none',
          }}
        />
        ) : null}

        {/* Overlay text — address + price + key stats, cream on navy scrim */}
        {!mapOpen ? (
        <div
          className="listing-hero-overlay"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 3,
            paddingTop: 'clamp(18px,3vw,40px)',
            paddingRight: 'clamp(18px,3.5vw,56px)',
            paddingBottom: 'clamp(22px,3.5vw,48px)',
            // Leave room for the bottom-left map thumb (80px + gutters).
            paddingLeft: canShowMap
              ? 'clamp(108px, 14vw, 140px)'
              : 'clamp(18px,3.5vw,56px)',
            color: 'var(--cream, #faf8f4)',
          }}
        >
          {addressLine ? (
            // Geist, not Amboqia: an address is data, not display copy, and
            // Amboqia's capital "I" reads as a numeral 1 in an uppercase,
            // alphanumeric string ("63177 INER" → "63177 1NER" —
            // design-audit P3, accessibility).
            <div
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 'clamp(1.3rem,3.2vw,2.4rem)',
                lineHeight: 1.05,
                letterSpacing: '-0.01em',
                textTransform: 'uppercase',
                fontWeight: 600,
                overflow: 'visible',
                marginBottom: 'clamp(10px,1.4vw,20px)',
              }}
            >
              {addressLine}
            </div>
          ) : null}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '14px',
              borderTop: '3px solid rgba(250,248,244,0.55)',
              paddingTop: '12px',
            }}
          >
            {compactPrice ? (
              <span
                style={{
                  fontFamily: 'var(--font-amboqia-safe, serif)',
                  fontSize: 'clamp(1.4rem,3.2vw,2.4rem)',
                  lineHeight: 1,
                  fontWeight: 400,
                  color: 'var(--cream, #faf8f4)',
                  fontVariantNumeric: 'tabular-nums',
                  overflow: 'visible',
                }}
              >
                {compactPrice}
              </span>
            ) : null}
            {keyStats.length > 0 ? (
              <span
                style={{
                  fontSize: 'clamp(0.78rem,1.6vw,1rem)',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'rgba(250,248,244,0.78)',
                }}
              >
                {keyStats.join(' · ')}
              </span>
            ) : null}
            {/* View all photos — photo-only path */}
            {!hasVideo && total > 1 ? (
              <button
                type="button"
                onClick={() => setOpenIndex(0)}
                style={{
                  marginLeft: 'auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--navy, #102742)',
                  background: 'var(--cream, #faf8f4)',
                  border: 0,
                  padding: '10px 16px',
                  cursor: 'pointer',
                }}
                aria-label={`View all ${total} photos`}
              >
                <ViewAllIcon /> View all {total}
              </button>
            ) : null}
          </div>
        </div>
        ) : null}

        {/* Video mute + pause. Parked top-right of the media so UNMUTE never
            sits on the address / price / beds-baths-sqft row (Look 2026-08-13). */}
        {!mapOpen && canUnmute ? (
          <div
            style={{
              position: 'absolute',
              top: 'clamp(12px,2vw,20px)',
              right: 'clamp(18px,3.5vw,56px)',
              zIndex: 5,
              display: 'inline-flex',
              gap: 8,
            }}
          >
            {canTogglePlay ? (
              <button
                type="button"
                onClick={togglePlay}
                aria-label={isPaused ? 'Play video' : 'Pause video'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--navy, #102742)',
                  background: 'var(--cream, #faf8f4)',
                  border: 0,
                  padding: '9px 14px',
                  cursor: 'pointer',
                  opacity: 0.92,
                }}
              >
                {isPaused ? <PlayIcon /> : <PauseIcon />}
                {isPaused ? 'Play' : 'Pause'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={toggleMute}
              aria-label={isMuted ? 'Unmute video' : 'Mute video'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.68rem',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--navy, #102742)',
                background: 'var(--cream, #faf8f4)',
                border: 0,
                padding: '9px 14px',
                cursor: 'pointer',
                opacity: 0.92,
              }}
            >
              {isMuted ? <UnmuteIcon /> : <MuteIcon />}
              {isMuted ? 'Unmute' : 'Mute'}
            </button>
          </div>
        ) : null}

        {/* Bottom-left map thumb / clear control */}
        {canShowMap ? (
          <div
            className="absolute bottom-4 left-4 z-20 flex items-end gap-2"
          >
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={toggleMap}
              aria-pressed={mapOpen}
              aria-label={mapOpen ? 'Hide map and show photos' : 'Show map of this home'}
              className={cn(
                'relative h-20 w-20 overflow-hidden rounded-xl border-2 p-0 shadow-md',
                'border-primary-foreground/80 bg-card hover:bg-card',
                'focus-visible:ring-ring',
                mapOpen && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
              )}
            >
              {staticMapUrl && !mapOpen ? (
                // eslint-disable-next-line @next/next/no-img-element -- Static Maps URL; not in next/image remotePatterns
                <img
                  src={staticMapUrl}
                  alt=""
                  width={80}
                  height={80}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <span className="flex h-full w-full flex-col items-center justify-center gap-1 bg-card text-primary">
                  <HugeiconsIcon
                    icon={mapOpen ? Cancel01Icon : MapsLocation01Icon}
                    className="size-6"
                    aria-hidden
                  />
                  <span className="text-xs font-semibold uppercase tracking-wide">
                    {mapOpen ? 'Photos' : 'Map'}
                  </span>
                </span>
              )}
              {!mapOpen && staticMapUrl ? (
                <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-primary/80 py-0.5 text-center text-xs font-semibold uppercase tracking-wide text-primary-foreground">
                  Map
                </span>
              ) : null}
            </Button>
            {mapOpen ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={closeMap}
                aria-label="Show photos"
                className="h-11 min-w-11 shadow-md"
              >
                Show photos
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* ── PHOTO STRIP BELOW HERO ────────────────────────────────── */}
      {total > 0 ? (
        <PhotoStrip
          photos={photos}
          altBase={altBase}
          total={total}
          onOpen={setOpenIndex}
          hasVideo={hasVideo}
        />
      ) : null}

      {/* ── LIGHTBOX ─────────────────────────────────────────────── */}
      <PhotoGalleryLightbox
        photos={photos.map((p) => ({ url: p.url, caption: p.caption }))}
        openIndex={openIndex}
        total={total}
        altBase={altBase}
        onClose={() => setOpenIndex(null)}
        onChange={(i) => setOpenIndex(i)}
      />
    </div>
  )
}

// ─── Video layer (iframe or video-tag) ────────────────────────────────────────

function VideoLayer({
  video,
  posterUrl,
  altBase,
  videoRef,
  onTap,
}: {
  video: VideoEmbed
  posterUrl?: string
  altBase: string
  videoRef: React.RefObject<HTMLVideoElement | null>
  onTap: () => void
}) {
  if (video.embedType === 'iframe') {
    return <IframeHeroLayer video={video} posterUrl={posterUrl} altBase={altBase} />
  }
  return (
    <video
      ref={videoRef}
      src={video.url}
      poster={video.posterUrl ?? posterUrl}
      muted
      // A vestibular-disorder visitor had no way to stop this full-viewport
      // autoplay loop (only Unmute/Mute exists) — reduced-motion loads paused
      // on the poster frame instead (design-audit P2, accessibility).
      autoPlay={typeof window === 'undefined' || !window.matchMedia('(prefers-reduced-motion: reduce)').matches}
      loop
      playsInline
      onClick={onTap}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        objectPosition: 'center 38%',
        cursor: 'pointer',
      }}
    />
  )
}

// ─── Iframe hero (Vimeo/YouTube background embed) with poster fallback ─────────
// design-audit STA-6: a full-bleed third-party embed with no fallback surfaced
// the host's own error page (e.g. a network-filtered "connection not secure"
// page) as the entire hero. The poster photo now sits behind the iframe as a
// base layer, and an embed load error hides the iframe so the photo shows.
function isPlayerReadyMessage(event: MessageEvent, src: string): boolean {
  const origin = String(event.origin || '')
  const fromVimeo = origin.includes('vimeo.com') && src.includes('vimeo.com')
  const fromYoutube =
    (origin.includes('youtube.com') || origin.includes('youtube-nocookie.com')) &&
    (src.includes('youtube.com') || src.includes('youtu.be'))
  if (!fromVimeo && !fromYoutube) return false
  let data: unknown = event.data
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data)
    } catch {
      return false
    }
  }
  if (!data || typeof data !== 'object') return false
  const rec = data as Record<string, unknown>
  const eventName = typeof rec.event === 'string' ? rec.event : ''
  return eventName === 'ready' || eventName === 'play' || eventName === 'onReady'
}

function IframeHeroLayer({
  video,
  posterUrl,
  altBase,
}: {
  video: VideoEmbed
  posterUrl?: string
  altBase: string
}) {
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)
  const embedSrc = getAutoplayEmbedUrl(video)

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (isPlayerReadyMessage(event, embedSrc)) setReady(true)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [embedSrc])

  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  }
  return (
    <>
      {posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={posterUrl}
          alt={altBase}
          style={{ ...baseStyle, objectPosition: 'center 38%', zIndex: 1 }}
        />
      ) : null}
      {failed ? null : (
        <iframe
          src={embedSrc}
          title={`Listing video for ${altBase}`}
          allow={['accelerometer', 'autoplay', 'clipboard-write', 'encrypted-media', 'gyroscope', 'picture-in-picture', 'fullscreen'].join('; ')}
          allowFullScreen
          onError={() => setFailed(true)}
          style={{
            ...baseStyle,
            border: 0,
            zIndex: 2,
            opacity: ready ? 1 : 0,
            transition: 'opacity 200ms ease-out',
          }}
        />
      )}
    </>
  )
}

// ─── Photo strip (below the hero) ─────────────────────────────────────────────

function PhotoStrip({
  photos,
  altBase,
  total,
  onOpen,
  hasVideo,
}: {
  photos: ReadonlyArray<ListingPhoto>
  altBase: string
  total: number
  onOpen: (i: number) => void
  hasVideo: boolean
}) {
  // Show up to 6 thumbnails (or 5 when no video, leaving room for "View all")
  const maxThumb = hasVideo ? 6 : 5
  const visible = photos.slice(0, maxThumb)
  const remaining = Math.max(0, total - visible.length)

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${visible.length + (remaining > 0 ? 1 : 0)}, 1fr)`,
        gap: 3,
        background: 'var(--navy, #102742)',
        borderTop: '3px solid var(--navy, #102742)',
      }}
    >
      {visible.map((p, i) => (
        <button
          key={`${i}-${p.url}`}
          type="button"
          onClick={() => onOpen(i)}
          aria-label={`Open photo ${i + 1} of ${total}`}
          style={{
            position: 'relative',
            aspectRatio: '4/3',
            overflow: 'hidden',
            border: 0,
            padding: 0,
            background: 'var(--navy, #102742)',
            cursor: 'zoom-in',
          }}
        >
          <Image
            src={p.url}
            alt={p.caption ?? `${altBase} ${i + 1} of ${total}`}
            fill
            sizes="(min-width: 1200px) 16vw, (min-width: 760px) 20vw, 33vw"
            // The strip sits at the fold directly under the hero — lazy-loading
            // left the cells as solid navy voids on first paint. Load all visible
            // thumbnails eagerly so the strip renders as photos, never a gap.
            loading="eager"
            priority={i === 0 && !hasVideo}
            className="object-cover transition-transform duration-500 hover:scale-[1.03]"
            style={{ objectFit: 'cover' }}
          />
        </button>
      ))}

      {/* "View all" cell — KB-styled */}
      {remaining > 0 ? (
        <button
          type="button"
          onClick={() => onOpen(0)}
          aria-label={`View all ${total} photos`}
          style={{
            position: 'relative',
            aspectRatio: '4/3',
            background: 'var(--navy, #102742)',
            border: 0,
            padding: 0,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            color: 'var(--cream, #faf8f4)',
          }}
        >
          <ViewAllIcon size={22} />
          <span
            style={{
              fontSize: '0.66rem',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'rgba(250,248,244,0.78)',
            }}
          >
            +{remaining} more
          </span>
        </button>
      ) : null}
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function ViewAllIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  )
}

function UnmuteIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  )
}

function MuteIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <polygon points="6 4 20 12 6 20" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="5" y="4" width="5" height="16" />
      <rect x="14" y="4" width="5" height="16" />
    </svg>
  )
}
