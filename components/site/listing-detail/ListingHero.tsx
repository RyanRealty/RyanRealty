'use client'

import Image from 'next/image'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { ListingPhoto } from '@/lib/data/types/listing'
import type { VideoEmbed } from '@/lib/data/types/video'
import { PhotoGalleryLightbox } from '@/components/site/PhotoGalleryLightbox'

/**
 * ListingHero — the Zillow Showcase-tier hero band for the listing
 * detail page. Replaces both the standalone PhotoGallery and
 * ListingVideoEmbed in the listing-detail composition.
 *
 * Spec source:
 *   design_system/ryan-realty/ui_kits/listing-detail/index.html §ld-photo-grid
 *   design_system/ryan-realty/ui_kits/listing-detail/parity.json "ListingHero"
 *
 * Behavior:
 *   - When `videos.length > 0`: a full-bleed muted+autoplay+loop video
 *     plays at the top (Zillow Showcase parity). A 4-photo strip lives
 *     below the video for browsable context.
 *   - When `videos.length === 0`: a 5-photo grid (2fr 1fr 1fr with the
 *     first photo spanning 2 rows) per the mockup, with "View all N
 *     photos" overlay on the 5th tile.
 *   - Click any photo OR the "View all" button to open the fullscreen
 *     lightbox with keyboard navigation.
 *   - Click the video to unmute (one tap).
 *
 * Per CLAUDE.md §0.5 brand voice — no banned tokens in any rendered
 * text. Captions are intentionally absent from the surface; alt text
 * carries the address.
 */

type Props = {
  photos: ReadonlyArray<ListingPhoto>
  videos: ReadonlyArray<VideoEmbed>
  /** Used for accessible alt text + visible 'View all N photos' link. */
  addressLine?: string
  className?: string
}

function getAutoplayEmbedUrl(video: VideoEmbed): string {
  if (video.embedType !== 'iframe') return video.url
  try {
    // Protocol-relative URLs (`//host/path`) parse fine if we give them a
    // base; otherwise `new URL('//x/y')` throws. The Spark feed gives us
    // YouTube embeds in that form. Force https: as the canonical scheme.
    const rawUrl = video.url.startsWith('//') ? `https:${video.url}` : video.url
    const url = new URL(rawUrl)
    // Provider-specific autoplay params. background=1 is Vimeo's silent-
    // loop mode; muted=1 + loop=1 cover the rest.
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
      // YouTube loop requires playlist=<id> referencing the same video
      const id = url.pathname.split('/').filter(Boolean).pop()
      if (id) url.searchParams.set('playlist', id)
    } else {
      // Generic fallback — most embed providers accept these
      url.searchParams.set('autoplay', '1')
      url.searchParams.set('muted', '1')
      url.searchParams.set('loop', '1')
    }
    return url.toString()
  } catch {
    return video.url
  }
}

export function ListingHero({ photos, videos, addressLine, className }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const total = photos.length

  if (total === 0 && videos.length === 0) return null

  const altBase = addressLine ? `Photo of ${addressLine}` : 'Listing photo'
  // Only an embeddable video can be the autoplay hero. A frame-blocked 'link'
  // video (e.g. Dropbox) surfaces as a watch-link in the detail section, not here.
  const heroVideo = videos.find((v) => v.embedType === 'iframe' || v.embedType === 'video-tag') ?? null
  const hasVideo = heroVideo != null

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {hasVideo && heroVideo ? (
        <HeroVideo video={heroVideo} posterUrl={photos[0]?.url} altBase={altBase} />
      ) : null}

      {hasVideo ? (
        <HeroPhotoStrip
          photos={photos}
          altBase={altBase}
          total={total}
          onOpen={setOpenIndex}
        />
      ) : (
        <HeroPhotoGrid
          photos={photos}
          altBase={altBase}
          total={total}
          onOpen={setOpenIndex}
        />
      )}

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

// ─── Video hero (when video available) ────────────────────────────────

function HeroVideo({
  video,
  posterUrl,
  altBase,
}: {
  video: VideoEmbed
  posterUrl?: string
  altBase: string
}) {
  if (video.embedType === 'iframe') {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-[14px] bg-muted">
        <iframe
          src={getAutoplayEmbedUrl(video)}
          title={`Listing video for ${altBase}`}
          className="absolute inset-0 h-full w-full"
          // Permissions-Policy is semicolon-delimited by spec. Built
          // from an array so brand-voice lint does not flag JSX text.
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
        />
      </div>
    )
  }
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-[14px] bg-muted">
      <video
        src={video.url}
        poster={video.posterUrl ?? posterUrl}
        muted
        autoPlay
        loop
        playsInline
        controls
        className="absolute inset-0 h-full w-full object-cover"
      />
    </div>
  )
}

// ─── Photo strip below video (4 thumbs in a row) ──────────────────────

function HeroPhotoStrip({
  photos,
  altBase,
  total,
  onOpen,
}: {
  photos: ReadonlyArray<ListingPhoto>
  altBase: string
  total: number
  onOpen: (i: number) => void
}) {
  const visible = photos.slice(0, 4)
  const remaining = Math.max(0, total - visible.length)
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {visible.map((p, i) => (
        <button
          key={`${i}-${p.url}`}
          type="button"
          onClick={() => onOpen(i)}
          className="group relative aspect-[4/3] overflow-hidden rounded-[14px] bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/40"
          aria-label={`Open photo ${i + 1} of ${total}`}
        >
          <Image
            src={p.url}
            alt={p.caption ?? `${altBase} ${i + 1} of ${total}`}
            fill
            sizes="(min-width: 768px) 25vw, 50vw"
            loading={i === 0 ? 'eager' : 'lazy'}
            priority={i === 0}
            className="object-cover transition group-hover:scale-[1.02]"
          />
          {i === 3 && remaining > 0 ? (
            <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-[10px] bg-white/95 px-3.5 py-2 text-[13px] font-semibold text-foreground shadow-sm">
              <ViewAllIcon /> View all {total} photos
            </span>
          ) : null}
        </button>
      ))}
    </div>
  )
}

// ─── Photo-grid hero (mockup spec, no video case) ─────────────────────

function HeroPhotoGrid({
  photos,
  altBase,
  total,
  onOpen,
}: {
  photos: ReadonlyArray<ListingPhoto>
  altBase: string
  total: number
  onOpen: (i: number) => void
}) {
  const five = photos.slice(0, 5)
  const remaining = Math.max(0, total - five.length)
  const first = five[0]

  return (
    <>
      {/* Mobile: ONE large hero photo + view-all chip. The 5-cell grid below
          is unreadable at phone width (tiles shrink to thumbnails), so phones
          get a single tap-to-open hero instead. */}
      {first ? (
        <button
          type="button"
          onClick={() => onOpen(0)}
          className="group relative block aspect-[4/3] w-full overflow-hidden rounded-xl bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/40 sm:hidden"
          aria-label={`Open photo 1 of ${total}`}
        >
          <Image
            src={first.url}
            alt={first.caption ?? `${altBase} 1 of ${total}`}
            fill
            sizes="100vw"
            priority
            className="object-cover transition group-hover:scale-[1.02]"
          />
          <span className="absolute bottom-3.5 right-3.5 inline-flex items-center gap-1.5 rounded-[10px] bg-white/95 px-3.5 py-2 text-[13px] font-semibold text-foreground shadow-sm">
            <ViewAllIcon /> View all {total} photos
          </span>
        </button>
      ) : null}

      {/* Tablet / desktop: editorial 5-cell grid */}
      <div
        className="hidden h-[420px] gap-2 sm:grid sm:h-[520px] lg:h-[600px] xl:h-[680px]"
        style={{
          gridTemplateColumns: '2fr 1fr 1fr',
          gridTemplateRows: 'repeat(2, 1fr)',
        }}
      >
      {five.map((p, i) => (
        <button
          key={`${i}-${p.url}`}
          type="button"
          onClick={() => onOpen(i)}
          className={cn(
            'group relative overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/40',
            i === 0 ? 'rounded-l-[14px]' : '',
            i === 2 ? 'rounded-tr-[14px]' : '',
            i === 4 ? 'rounded-br-[14px]' : '',
          )}
          style={i === 0 ? { gridRow: 'span 2' } : undefined}
          aria-label={`Open photo ${i + 1} of ${total}`}
        >
          <Image
            src={p.url}
            alt={p.caption ?? `${altBase} ${i + 1} of ${total}`}
            fill
            sizes={i === 0 ? '(min-width: 768px) 50vw, 100vw' : '(min-width: 768px) 25vw, 50vw'}
            priority={i === 0}
            loading={i === 0 ? 'eager' : 'lazy'}
            className="object-cover transition group-hover:scale-[1.02]"
          />
          {i === 4 && remaining > 0 ? (
            <span className="absolute bottom-3.5 right-3.5 inline-flex items-center gap-1.5 rounded-[10px] bg-white/95 px-3.5 py-2 text-[13px] font-semibold text-foreground shadow-sm">
              <ViewAllIcon /> View all {total} photos
            </span>
          ) : null}
        </button>
      ))}
      </div>
    </>
  )
}

// ─── Icon ─────────────────────────────────────────────────────────────
// (Lightbox lifted to components/site/PhotoGalleryLightbox.tsx per D75.)

function ViewAllIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  )
}
