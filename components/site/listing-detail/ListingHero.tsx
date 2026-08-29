'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { ListingPhoto } from '@/lib/data/types/listing'
import type { VideoEmbed } from '@/lib/data/types/video'
import { PhotoGalleryLightbox } from './PhotoGalleryLightbox'
import { ListingTourOverlay } from './ListingTourOverlay'
import { publishListingHeroUnmute, publishListingHeroVideo } from '@/lib/listing/publish-listing-hero-video'
import { publishListingLeadMedia } from '@/lib/listing/publish-listing-lead-media'

/**
 * Listing media mosaic. Media 1 is a video or 3D tour when one exists,
 * else the first still of THIS house. Price and facts live under the media.
 * No map chip on the media.
 */

type Props = {
  photos: ReadonlyArray<ListingPhoto>
  videos: ReadonlyArray<VideoEmbed>
  addressLine?: string
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

export function ListingHero({ photos, videos, addressLine, className }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [tourOpen, setTourOpen] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const videoRef = useRef<HTMLVideoElement>(null)
  const total = photos.length
  const lead = publishListingLeadMedia(videos)
  const heroVideo = lead?.video ?? null
  const hasLeadMedia = heroVideo != null || total > 0
  const canUnmute = publishListingHeroUnmute(publishListingHeroVideo(videos))
  const altBase = addressLine ? `Photo of ${addressLine}` : 'Listing photo'
  const badgeLabel = heroVideo
    ? total > 0
      ? `Video + ${total}`
      : 'Video'
    : total > 0
      ? `${total} photos`
      : null
  const thumbs = photos.slice(heroVideo ? 0 : 1, heroVideo ? 4 : 5)
  const carouselStills = heroVideo ? photos : photos.slice(1)

  if (!hasLeadMedia) return null

  function openGallery(photoIndex: number) {
    if (total === 0) return
    setOpenIndex(Math.max(0, Math.min(photoIndex, total - 1)))
  }

  function openTour() {
    if (!heroVideo) return
    setTourOpen(true)
  }

  function openLead() {
    if (heroVideo && canUnmute) {
      toggleMute()
      return
    }
    if (heroVideo) {
      openTour()
      return
    }
    openGallery(0)
  }

  function toggleMute() {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted
      setIsMuted(videoRef.current.muted)
    }
  }

  return (
    <div id="listing-hero-visual" className={cn('listing-mosaic', className)}>
      <div className="listing-mosaic__carousel">
        {heroVideo ? (
          <div className="listing-mosaic__slide">
            <VideoLayer
              video={heroVideo}
              posterUrl={photos[0]?.url}
              altBase={altBase}
              videoRef={videoRef}
              onTap={openLead}
            />
          </div>
        ) : photos[0] ? (
          <button
            type="button"
            className="listing-mosaic__slide"
            onClick={() => openGallery(0)}
            aria-label={`Open photo 1 of ${total}`}
          >
            <Image
              src={photos[0].url}
              alt={photos[0].caption ?? `${altBase} 1 of ${total}`}
              fill
              sizes="100vw"
              priority
              className="object-cover"
            />
          </button>
        ) : null}
        {carouselStills.map((photo, i) => {
          const photoIndex = heroVideo ? i : i + 1
          return (
            <button
              key={`${photoIndex}-${photo.url}`}
              type="button"
              className="listing-mosaic__slide"
              onClick={() => openGallery(photoIndex)}
              aria-label={`Open photo ${photoIndex + 1} of ${total}`}
            >
              <Image
                src={photo.url}
                alt={photo.caption ?? `${altBase} ${photoIndex + 1} of ${total}`}
                fill
                sizes="100vw"
                className="object-cover"
              />
            </button>
          )
        })}
      </div>

      <div className="listing-mosaic__grid">
        {heroVideo?.embedType === 'iframe' ? (
          <div className="listing-mosaic__lead">
            <VideoLayer
              video={heroVideo}
              posterUrl={photos[0]?.url}
              altBase={altBase}
              videoRef={videoRef}
              onTap={openLead}
            />
          </div>
        ) : (
        <button
          type="button"
          className="listing-mosaic__lead"
          onClick={openLead}
          aria-label={
            heroVideo
              ? canUnmute
                ? isMuted
                  ? 'Unmute video'
                  : 'Mute video'
                : 'Open tour'
              : `Open photo 1 of ${total}`
          }
        >
          {heroVideo ? (
            <VideoLayer
              video={heroVideo}
              posterUrl={photos[0]?.url}
              altBase={altBase}
              videoRef={videoRef}
              onTap={openLead}
            />
          ) : photos[0] ? (
            <Image
              src={photos[0].url}
              alt={photos[0].caption ?? `${altBase} 1 of ${total}`}
              fill
              sizes="66vw"
              priority
              className="object-cover"
            />
          ) : null}
        </button>
        )}
        <div className="listing-mosaic__thumbs">
          {thumbs.map((photo, i) => {
            const photoIndex = heroVideo ? i : i + 1
            return (
              <button
                key={`${photoIndex}-${photo.url}`}
                type="button"
                className="listing-mosaic__thumb"
                onClick={() => openGallery(photoIndex)}
                aria-label={`Open photo ${photoIndex + 1} of ${total}`}
              >
                <Image
                  src={photo.url}
                  alt={photo.caption ?? `${altBase} ${photoIndex + 1} of ${total}`}
                  fill
                  sizes="17vw"
                  className="object-cover"
                />
              </button>
            )
          })}
        </div>
      </div>

      {badgeLabel ? (
        <button
          type="button"
          className="listing-mosaic__badge"
          onClick={() => (heroVideo ? openTour() : openGallery(0))}
          aria-label={badgeLabel}
        >
          {badgeLabel}
        </button>
      ) : null}

      <PhotoGalleryLightbox
        photos={photos.map((p) => ({ url: p.url, caption: p.caption }))}
        openIndex={openIndex}
        total={total}
        altBase={altBase}
        onClose={() => setOpenIndex(null)}
        onChange={(i) => setOpenIndex(i)}
      />
      <ListingTourOverlay
        open={tourOpen}
        video={heroVideo}
        title={`Listing tour for ${altBase}`}
        onClose={() => setTourOpen(false)}
      />
    </div>
  )
}

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
    return <IframeHeroLayer video={video} posterUrl={posterUrl} altBase={altBase} onOpen={onTap} />
  }
  return (
    <video
      ref={videoRef}
      src={video.url}
      poster={video.posterUrl ?? posterUrl}
      muted
      autoPlay={typeof window === 'undefined' || !window.matchMedia('(prefers-reduced-motion: reduce)').matches}
      loop
      playsInline
      onClick={onTap}
    />
  )
}

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
  onOpen,
}: {
  video: VideoEmbed
  posterUrl?: string
  altBase: string
  onOpen: () => void
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

  return (
    <>
      {posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={posterUrl} alt={altBase} />
      ) : null}
      {failed ? null : (
        <iframe
          src={embedSrc}
          title={`Listing video for ${altBase}`}
          allow={['accelerometer', 'autoplay', 'clipboard-write', 'encrypted-media', 'gyroscope', 'picture-in-picture', 'fullscreen'].join('; ')}
          allowFullScreen
          onError={() => setFailed(true)}
          style={{ opacity: ready ? 1 : 0, pointerEvents: 'none' }}
        />
      )}
      <button
        type="button"
        className="listing-mosaic__open-tour"
        onClick={onOpen}
        aria-label="Open tour"
      >
        Open tour
      </button>
    </>
  )
}
