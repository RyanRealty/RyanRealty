'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import Image from 'next/image'
import { trackEvent } from '@/lib/tracking'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

type Photo = { id: string; photo_url: string; cdn_url?: string | null; sort_order: number }

type Props = {
  listingKey: string
  heroVideoUrl: string | null
  photos: Photo[]
}

/* ─── Video URL helpers ─── */

function isDirectVideoUrl(url: string): boolean {
  return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url)
}

function isEmbeddableVideoUrl(url: string): boolean {
  return /youtube\.com|youtu\.be|vimeo\.com|player\.vimeo\.com/i.test(url)
}

function getEmbedUrl(url: string): string {
  if (url.includes('youtube.com/watch')) {
    const id = new URL(url).searchParams.get('v')
    if (id) return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&playsinline=1`
  }
  if (url.includes('youtube.com/embed/') || url.includes('youtu.be/')) {
    const base = url.split('?')[0]
    return `${base}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&playsinline=1`
  }
  if (url.includes('player.vimeo.com/video/')) {
    const base = url.split('?')[0]
    return `${base}?autoplay=1&muted=1&background=1&loop=1&byline=0&title=0&portrait=0`
  }
  if (url.includes('vimeo.com/') && !url.includes('player.vimeo.com')) {
    const parts = url.split('/')
    const id = parts[parts.length - 1]?.split('?')[0]
    if (id) return `https://player.vimeo.com/video/${id}?autoplay=1&muted=1&background=1&loop=1&byline=0&title=0&portrait=0`
  }
  return ''
}

/* ─── Fullscreen Lightbox ─── */

function Lightbox({
  photos,
  activeIndex,
  onClose,
  onPrev,
  onNext,
}: {
  photos: Photo[]
  activeIndex: number
  onClose: () => void
  onPrev: () => void
  onNext: () => void
}) {
  const photo = photos[activeIndex]

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') onPrev()
      else if (e.key === 'ArrowRight') onNext()
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [onClose, onPrev, onNext])

  if (!photo) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/95"
      onClick={onClose}
      role="dialog"
      aria-label="Photo lightbox"
    >
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-background/20 text-primary-foreground hover:bg-background/40 transition"
        aria-label="Close lightbox"
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
      </button>

      {/* Counter */}
      <div className="absolute top-4 left-4 z-10 rounded-full bg-background/20 px-3 py-1.5 text-sm font-medium text-primary-foreground">
        {activeIndex + 1} / {photos.length}
      </div>

      {/* Previous */}
      {photos.length > 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPrev() }}
          className="absolute left-3 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-background/20 text-primary-foreground hover:bg-background/40 transition"
          aria-label="Previous photo"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
      )}

      {/* Photo */}
      <div
        className="relative h-[85vh] w-[90vw] max-w-6xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={photo.cdn_url ?? photo.photo_url}
          alt={`Property photo ${activeIndex + 1}`}
          fill
          className="object-contain"
          sizes="90vw"
          priority
        />
      </div>

      {/* Next */}
      {photos.length > 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onNext() }}
          className="absolute right-3 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-background/20 text-primary-foreground hover:bg-background/40 transition"
          aria-label="Next photo"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      )}
    </div>
  )
}

/* ─── Main Hero ─── */

export default function ShowcaseHero({ listingKey, heroVideoUrl, photos }: Props) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [mode, setMode] = useState<'video' | 'photos'>(heroVideoUrl ? 'video' : 'photos')
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [videoMuted, setVideoMuted] = useState(true)
  const videoRef = useRef<HTMLVideoElement>(null)
  const thumbStripRef = useRef<HTMLDivElement>(null)

  const hasVideo = Boolean(heroVideoUrl?.trim())
  const isDirect = hasVideo && heroVideoUrl ? isDirectVideoUrl(heroVideoUrl) : false
  const totalPhotos = photos.length
  const activePhoto = photos[activeIndex]

  const handleVideoPlay = useCallback(() => {
    trackEvent('play_video', { listing_key: listingKey, position: 'hero' })
  }, [listingKey])

  const toggleMute = useCallback(() => {
    setVideoMuted((m) => {
      const next = !m
      if (videoRef.current) videoRef.current.muted = next
      return next
    })
  }, [])

  const goToPhoto = useCallback((i: number) => {
    setActiveIndex(i)
    setMode('photos')
  }, [])

  const openLightbox = useCallback(() => {
    if (mode === 'photos') setLightboxOpen(true)
  }, [mode])

  const prevPhoto = useCallback(() => {
    setActiveIndex((i) => (i - 1 + totalPhotos) % totalPhotos)
  }, [totalPhotos])

  const nextPhoto = useCallback(() => {
    setActiveIndex((i) => (i + 1) % totalPhotos)
  }, [totalPhotos])

  // Scroll active thumbnail into view
  useEffect(() => {
    if (!thumbStripRef.current) return
    const active = thumbStripRef.current.children[hasVideo ? activeIndex + 1 : activeIndex] as HTMLElement | undefined
    active?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [activeIndex, hasVideo])

  // No media at all — show a beautiful Central Oregon fallback instead of empty gray
  if (!hasVideo && totalPhotos === 0) {
    return (
      <section className="relative aspect-video w-full overflow-hidden" aria-label="Listing media">
        <img
          src="https://images.unsplash.com/photo-1653930796811-84d446f9e221?w=1920&q=80"
          alt="Central Oregon landscape"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/60 to-transparent" />
        <div className="absolute bottom-4 left-4 text-sm text-primary-foreground/80">
          Photos coming soon
        </div>
      </section>
    )
  }

  return (
    <>
      <section className="relative w-full bg-background" aria-label="Listing media">
        {/* ─── Main display area ─── */}
        <div className="relative aspect-video w-full overflow-hidden bg-muted">
          {/* Video mode */}
          {mode === 'video' && hasVideo && heroVideoUrl && (
            <>
              {isDirect ? (
                <video
                  ref={videoRef}
                  src={heroVideoUrl}
                  className="h-full w-full object-cover"
                  playsInline
                  muted={videoMuted}
                  loop
                  autoPlay
                  preload="metadata"
                  onPlay={handleVideoPlay}
                  aria-label="Listing video tour"
                />
              ) : isEmbeddableVideoUrl(heroVideoUrl) ? (
                <iframe
                  src={getEmbedUrl(heroVideoUrl)}
                  className="h-full w-full border-0"
                  allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                  allowFullScreen
                  title="Listing video tour"
                  onLoad={handleVideoPlay}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-muted">
                  <Button asChild variant="secondary" size="lg">
                    <a href={heroVideoUrl} target="_blank" rel="noopener noreferrer">
                      Open video tour
                    </a>
                  </Button>
                </div>
              )}

              {/* Video overlay controls */}
              <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between bg-gradient-to-t from-foreground/50 to-transparent p-4">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 rounded-full bg-background/20 px-3 py-1.5 text-sm font-medium text-primary-foreground backdrop-blur-sm">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                    Video tour
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {isDirect && (
                    <button
                      type="button"
                      onClick={toggleMute}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-background/20 text-primary-foreground backdrop-blur-sm hover:bg-background/40 transition"
                      aria-label={videoMuted ? 'Unmute video' : 'Mute video'}
                    >
                      {videoMuted ? (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
                      ) : (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                      )}
                    </button>
                  )}
                  {totalPhotos > 0 && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => { setMode('photos'); setActiveIndex(0) }}
                      className="bg-background/20 text-primary-foreground backdrop-blur-sm hover:bg-background/40 border-0"
                    >
                      View {totalPhotos} photo{totalPhotos !== 1 ? 's' : ''}
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Photo mode */}
          {mode === 'photos' && activePhoto && (
            <>
              <Image
                src={activePhoto.cdn_url ?? activePhoto.photo_url}
                alt={`Property photo ${activeIndex + 1}`}
                fill
                priority={activeIndex === 0}
                className="cursor-pointer object-cover object-top transition-opacity duration-300"
                sizes="100vw"
                onClick={openLightbox}
              />

              {/* Photo overlay controls */}
              <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between bg-gradient-to-t from-foreground/50 to-transparent p-4">
                <div className="flex items-center gap-2">
                  {totalPhotos > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={prevPhoto}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-background/20 text-primary-foreground backdrop-blur-sm hover:bg-background/40 transition"
                        aria-label="Previous photo"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                      </button>
                      <button
                        type="button"
                        onClick={nextPhoto}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-background/20 text-primary-foreground backdrop-blur-sm hover:bg-background/40 transition"
                        aria-label="Next photo"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </button>
                    </>
                  )}
                  <span className="rounded-full bg-background/20 px-3 py-1.5 text-sm font-medium text-primary-foreground backdrop-blur-sm">
                    {activeIndex + 1} / {totalPhotos}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {hasVideo && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setMode('video')}
                      className="bg-background/20 text-primary-foreground backdrop-blur-sm hover:bg-background/40 border-0"
                    >
                      <svg className="mr-1.5 h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                      Watch video
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={openLightbox}
                    className="bg-background/20 text-primary-foreground backdrop-blur-sm hover:bg-background/40 border-0"
                  >
                    <svg className="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                    Fullscreen
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ─── Thumbnail strip ─── */}
        {(totalPhotos > 0 || hasVideo) && (
          <div className="border-t border-border bg-card px-2 py-2">
            <div ref={thumbStripRef} className="flex gap-1.5 overflow-x-auto pb-1 scroll-smooth no-scrollbar">
              {hasVideo && (
                <button
                  type="button"
                  onClick={() => setMode('video')}
                  className={cn(
                    'relative flex h-[72px] w-[108px] shrink-0 items-center justify-center overflow-hidden rounded-lg transition-all',
                    mode === 'video'
                      ? 'ring-2 ring-primary ring-offset-1 ring-offset-background'
                      : 'opacity-70 hover:opacity-100'
                  )}
                  aria-label="Watch video tour"
                >
                  {/* Use first photo as video thumbnail background */}
                  {photos[0] ? (
                    <>
                      <Image
                        src={photos[0].cdn_url ?? photos[0].photo_url}
                        alt=""
                        fill
                        sizes="108px"
                        className="object-cover brightness-50"
                      />
                      <span className="relative z-10 flex items-center gap-1 text-xs font-semibold text-primary-foreground drop-shadow">
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                        Tour
                      </span>
                    </>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-semibold text-primary bg-muted rounded px-2 py-1">
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                      Video
                    </span>
                  )}
                </button>
              )}
              {photos.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => goToPhoto(i)}
                  className={cn(
                    'relative h-[72px] w-[108px] shrink-0 overflow-hidden rounded-lg transition-all',
                    mode === 'photos' && activeIndex === i
                      ? 'ring-2 ring-primary ring-offset-1 ring-offset-background'
                      : 'opacity-70 hover:opacity-100'
                  )}
                  aria-label={`View photo ${i + 1}`}
                >
                  <Image
                    src={p.cdn_url ?? p.photo_url}
                    alt=""
                    fill
                    sizes="108px"
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ─── Fullscreen Lightbox ─── */}
      {lightboxOpen && totalPhotos > 0 && (
        <Lightbox
          photos={photos}
          activeIndex={activeIndex}
          onClose={() => setLightboxOpen(false)}
          onPrev={prevPhoto}
          onNext={nextPhoto}
        />
      )}
    </>
  )
}
