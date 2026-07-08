'use client'

import Image from 'next/image'
import { useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import type { ListingPhoto } from '@/lib/data/types/listing'
import type { VideoEmbed } from '@/lib/data/types/video'
import { PhotoGalleryLightbox } from '@/components/site/PhotoGalleryLightbox'

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

function formatPrice(p: number): string {
  if (p >= 1_000_000) return `$${(p / 1_000_000).toFixed(p % 1_000_000 === 0 ? 0 : 1)}M`
  if (p >= 1_000) return `$${Math.round(p / 1_000)}K`
  return `$${p.toLocaleString('en-US')}`
}

export function ListingHero({ photos, videos, addressLine, price, beds, baths, sqft, className }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [isMuted, setIsMuted] = useState(true)
  const [isPaused, setIsPaused] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const total = photos.length

  if (total === 0 && videos.length === 0) return null

  const altBase = addressLine ? `Photo of ${addressLine}` : 'Listing photo'
  const heroVideo = videos.find((v) => v.embedType === 'iframe' || v.embedType === 'video-tag') ?? null
  const hasVideo = heroVideo != null
  // Pause/play is only wired for the native <video> path — that's the one
  // element this component directly controls via videoRef. The iframe path
  // (external embed) has no reliable cross-origin pause API here.
  const canTogglePlay = hasVideo && heroVideo?.embedType === 'video-tag'

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

  const keyStats: string[] = []
  if (beds != null) keyStats.push(`${beds} bd`)
  if (baths != null) keyStats.push(`${baths} ba`)
  if (sqft != null) keyStats.push(`${sqft.toLocaleString('en-US')} sqft`)

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
        {hasVideo && heroVideo ? (
          <VideoLayer
            video={heroVideo}
            posterUrl={photos[0]?.url}
            altBase={altBase}
            videoRef={videoRef}
            onTap={toggleMute}
          />
        ) : photos[0] ? (
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

        {/* Gradient scrim — same gradient as kb.css .hero-photo::after */}
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

        {/* Overlay text — address + price + key stats, cream on navy scrim */}
        <div
          className="listing-hero-overlay"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 3,
            padding: 'clamp(18px,3vw,40px) clamp(18px,3.5vw,56px) clamp(22px,3.5vw,48px)',
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
            {price != null ? (
              <span
                style={{
                  fontFamily: 'var(--font-amboqia, serif)',
                  fontSize: 'clamp(1.4rem,3.2vw,2.4rem)',
                  lineHeight: 1,
                  fontWeight: 400,
                  color: 'var(--cream, #faf8f4)',
                  fontVariantNumeric: 'tabular-nums',
                  overflow: 'visible',
                }}
              >
                {formatPrice(price)}
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

        {/* Video mute + pause affordances. WCAG 2.2.2 requires a way to stop
            motion that autoplays longer than 5s — mute alone doesn't satisfy
            that (design-audit P2, accessibility). */}
        {hasVideo ? (
          <div
            style={{
              position: 'absolute',
              bottom: 'clamp(22px,3.5vw,48px)',
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
    return (
      <iframe
        src={getAutoplayEmbedUrl(video)}
        title={`Listing video for ${altBase}`}
        allow={[
          'accelerometer',
          'autoplay',
          'clipboard-write',
          'encrypted-media',
          'gyroscope',
          'picture-in-picture',
          'fullscreen',
        ].join('; ')}
        allowFullScreen
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          border: 0,
          objectFit: 'cover',
        }}
      />
    )
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
