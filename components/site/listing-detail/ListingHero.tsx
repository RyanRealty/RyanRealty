'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { ListingPhoto } from '@/lib/data/types/listing'
import type { VideoEmbed } from '@/lib/data/types/video'
import { PhotoGalleryLightbox } from './PhotoGalleryLightbox'
import { ListingTourOverlay } from './ListingTourOverlay'
import { ListingStreetViewOverlay } from './ListingStreetViewOverlay'
import {
  publishListingHeroUnmute,
  publishListingHeroVideo,
  publishListingVirtualTour,
} from '@/lib/listing/publish-listing-hero-video'
import { publishListingLeadMedia } from '@/lib/listing/publish-listing-lead-media'
import {
  publishListingMosaicPills,
  type ListingMosaicPill,
} from '@/lib/listing/publish-listing-mosaic-pills'
import {
  LISTING_MOSAIC_CAROUSEL_SIZES,
  LISTING_MOSAIC_LEAD_SIZES,
  LISTING_MOSAIC_PHOTO_QUALITY,
  LISTING_MOSAIC_THUMB_SIZES,
  LISTING_MOSAIC_THUMB_WIDE_SIZES,
  preferListingMosaicPhotoUrl,
  publishListingMosaicTiles,
} from '@/lib/listing/publish-listing-mosaic'
import { isOffsiteTourHost } from '@/lib/listing/publish-listing-on-site-tour'
import { formatPriceExact } from '@/lib/format/money'
import { publishListingHeroKeyStats } from '@/lib/listing/publish-listing-hero-stats'
import dynamic from 'next/dynamic'

const ListingMediaMap = dynamic(() => import('./ListingLocationMap.client'), {
  ssr: false,
  loading: () => <div className="listing-mosaic__map-slot" aria-hidden />,
})

/**
 * Listing media mosaic. Price, beds, baths, sqft, and street sit on the
 * media. Tabs (when leftover): photos, 3D, floor plan, map. No empty navy.
 */

type MediaTab = 'photos' | 'tour' | 'floor' | 'map'

type Props = {
  photos: ReadonlyArray<ListingPhoto>
  floorPlans?: ReadonlyArray<ListingPhoto>
  videos: ReadonlyArray<VideoEmbed>
  addressLine?: string
  lat?: number | null
  lng?: number | null
  openHouseLabel?: string | null
  className?: string
  price?: number | null
  beds?: number | null
  baths?: number | null
  sqft?: number | null
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
  floorPlans = [],
  videos,
  addressLine,
  lat,
  lng,
  openHouseLabel,
  className,
  price,
  beds,
  baths,
  sqft,
}: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [galleryPane, setGalleryPane] = useState<'photos' | 'floor'>('photos')
  const [embed, setEmbed] = useState<VideoEmbed | null>(null)
  const [tourOpen, setTourOpen] = useState(false)
  const [streetOpen, setStreetOpen] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [allowAutoplay, setAllowAutoplay] = useState(false)
  const [mediaTab, setMediaTab] = useState<MediaTab>(() => {
    if (photos.length > 0) return 'photos'
    if (floorPlans.length > 0) return 'floor'
    if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) return 'map'
    return 'photos'
  })
  const videoRef = useRef<HTMLVideoElement>(null)
  const total = photos.length
  const reel = publishListingHeroVideo(videos)
  const virtualTour = publishListingVirtualTour(videos)
  const lead = publishListingLeadMedia(videos)
  const heroVideo = lead?.kind === 'video' ? lead.video : null
  const hasMap =
    lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)
  const hasLeadMedia = heroVideo != null || total > 0 || floorPlans.length > 0 || hasMap
  const canUnmute = publishListingHeroUnmute(heroVideo)
  const altBase = addressLine ? `Photo of ${addressLine}` : 'Listing photo'
  const hasStreetView = hasMap
  const onMediaFacts = publishListingHeroKeyStats({ beds, baths, sqft }).join(' · ')
  const onSiteTour = virtualTour && !isOffsiteTourHost(virtualTour.url) ? virtualTour : null
  const mosaicPills = publishListingMosaicPills({
    photoCount: total,
    videos,
    floorPlanCount: floorPlans.length,
    hasStreetView,
  })
  const tiles = publishListingMosaicTiles({
    photoCount: total,
    leadIsVideo: heroVideo != null,
  })
  const carouselStills = heroVideo ? photos : photos.slice(1)
  const leadOpenLabel = lead?.kind === 'video' ? 'Open video' : null
  const tilesWide = tiles.length > 2
  const thumbSizes = tilesWide ? LISTING_MOSAIC_THUMB_WIDE_SIZES : LISTING_MOSAIC_THUMB_SIZES

  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = new URLSearchParams(window.location.search).get('photo')
    const n = raw ? Number(raw) : Number.NaN
    if (!Number.isInteger(n) || n < 1 || total === 0) return
    setGalleryPane('photos')
    setOpenIndex(Math.max(0, Math.min(n - 1, total - 1)))
  }, [total])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    setAllowAutoplay(true)
  }, [])

  useEffect(() => {
    if (!heroVideo || heroVideo.embedType !== 'video-tag') return
    if (!allowAutoplay) return
    const el = videoRef.current
    if (!el) return
    el.muted = true
    void el.play().catch(() => {})
  }, [heroVideo, allowAutoplay])

  if (!hasLeadMedia) return null

  function openGallery(photoIndex: number, pane: 'photos' | 'floor' = 'photos') {
    const pool = pane === 'floor' ? floorPlans : photos
    if (pool.length === 0) return
    setGalleryPane(pane)
    setOpenIndex(Math.max(0, Math.min(photoIndex, pool.length - 1)))
  }

  function openEmbed(kind: 'video' | 'tour') {
    if (kind === 'tour') {
      setEmbed(null)
      setTourOpen(true)
      return
    }
    if (!reel) return
    setTourOpen(false)
    setEmbed(reel)
  }

  function openLead() {
    if (heroVideo && canUnmute) {
      toggleMute()
      return
    }
    if (heroVideo) {
      openEmbed('video')
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

  function openCaption(pill: ListingMosaicPill) {
    if (pill.action === 'gallery') {
      setMediaTab('photos')
      return
    }
    if (pill.action === 'floor') {
      setMediaTab('floor')
      openGallery(0, 'floor')
      return
    }
    if (pill.action === 'tour') {
      setMediaTab('tour')
      if (!onSiteTour) openEmbed('tour')
      return
    }
    if (pill.action === 'street') {
      setStreetOpen(true)
    }
  }

  const showMap = mediaTab === 'map' && hasMap
  const showTour = mediaTab === 'tour' && onSiteTour

  return (
    <div id="listing-hero-visual" className={cn('listing-mosaic', className)}>
      {showTour ? (
        <div className="listing-mosaic__pane">
          <iframe
            src={onSiteTour.url}
            title={`3D tour of ${addressLine ?? 'this home'}`}
            allow="fullscreen; xr-spatial-tracking"
            allowFullScreen
          />
        </div>
      ) : null}
      {showMap ? (
        <div className="listing-mosaic__pane">
          <ListingMediaMap lat={lat!} lng={lng!} zoom={16} />
        </div>
      ) : null}
      {showMap || showTour ? null : (
      <>
      <div className="listing-mosaic__carousel">
        {heroVideo ? (
          <div className="listing-mosaic__slide">
            <VideoLayer
              video={heroVideo}
              posterUrl={photos[0]?.url}
              altBase={altBase}
              videoRef={videoRef}
              onTap={openLead}
              openLabel={leadOpenLabel ?? 'Open video'}
              allowAutoplay={allowAutoplay}
            />
          </div>
        ) : photos[0] ? (
          <button
            type="button"
            className="listing-mosaic__slide"
            onClick={() => openGallery(0)}
            aria-label={`Open photo 1 of ${total}`}
          >
            <MosaicStill
              src={photos[0].url}
              alt={photos[0].caption ?? `${altBase} 1 of ${total}`}
              sizes={LISTING_MOSAIC_CAROUSEL_SIZES}
              priority
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
              <MosaicStill
                src={photo.url}
                alt={photo.caption ?? `${altBase} ${photoIndex + 1} of ${total}`}
                sizes={LISTING_MOSAIC_CAROUSEL_SIZES}
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
              openLabel={leadOpenLabel ?? 'Open video'}
              allowAutoplay={allowAutoplay}
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
                : (leadOpenLabel ?? 'Open video')
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
              openLabel={leadOpenLabel ?? 'Open video'}
              allowAutoplay={allowAutoplay}
            />
          ) : photos[0] ? (
            <MosaicStill
              src={photos[0].url}
              alt={photos[0].caption ?? `${altBase} 1 of ${total}`}
              sizes={LISTING_MOSAIC_LEAD_SIZES}
              priority
            />
          ) : null}
        </button>
        )}
        <div className={cn('listing-mosaic__thumbs', tilesWide && 'is-wide')}>
          {tiles.map((tile) => {
            const photo = photos[tile.photoIndex]
            if (!photo) return null
            return (
              <button
                key={`photo-${tile.photoIndex}`}
                type="button"
                className="listing-mosaic__thumb"
                onClick={() => openGallery(tile.photoIndex)}
                aria-label={`Open photo ${tile.photoIndex + 1} of ${total}`}
              >
                <MosaicStill
                  src={photo.url}
                  alt={photo.caption ?? `${altBase} ${tile.photoIndex + 1}`}
                  sizes={thumbSizes}
                />
              </button>
            )
          })}
        </div>
      </div>
      </>
      )}

      {openHouseLabel ? (
        <div className="listing-mosaic__open-house">{openHouseLabel}</div>
      ) : null}
      {price != null || onMediaFacts || addressLine ? (
        <div className="listing-mosaic__on-media">
          {price != null ? (
            <p className="listing-mosaic__on-ask">{formatPriceExact(price)}</p>
          ) : null}
          {onMediaFacts ? <p className="listing-mosaic__on-facts">{onMediaFacts}</p> : null}
          {addressLine ? <p className="listing-mosaic__on-street">{addressLine}</p> : null}
        </div>
      ) : null}
      {mosaicPills.length > 0 || hasMap ? (
        <div className="listing-mosaic__captions" role="tablist" aria-label="Listing media">
          {mosaicPills.map((pill) => (
            <button
              key={pill.id}
              type="button"
              className={cn(
                'listing-mosaic__caption',
                ((pill.action === 'gallery' && mediaTab === 'photos') ||
                  (pill.action === 'floor' && mediaTab === 'floor') ||
                  (pill.action === 'tour' && mediaTab === 'tour')) &&
                  'is-on',
              )}
              onClick={() => openCaption(pill)}
              aria-label={pill.label}
            >
              {pill.label}
            </button>
          ))}
          {hasMap ? (
            <button
              type="button"
              className={cn('listing-mosaic__caption', mediaTab === 'map' && 'is-on')}
              onClick={() => setMediaTab('map')}
              aria-label="Map"
            >
              Map
            </button>
          ) : null}
        </div>
      ) : null}

      <PhotoGalleryLightbox
        photos={photos.map((p) => ({ url: p.url, caption: p.caption }))}
        floorPlans={floorPlans.map((p) => ({ url: p.url, caption: p.caption }))}
        videos={videos}
        openIndex={openIndex}
        pane={galleryPane}
        onPaneChange={setGalleryPane}
        total={galleryPane === 'floor' ? floorPlans.length : total}
        altBase={altBase}
        hasStreetView={hasStreetView}
        onClose={() => setOpenIndex(null)}
        onChange={(i) => setOpenIndex(i)}
        onOpenEmbed={reel || virtualTour ? openEmbed : undefined}
        onOpenStreet={hasStreetView ? () => setStreetOpen(true) : undefined}
      />
      <ListingTourOverlay
        open={tourOpen || embed != null}
        video={
          embed ??
          (virtualTour && !isOffsiteTourHost(virtualTour.url) ? virtualTour : null)
        }
        floorPlans={floorPlans}
        lat={lat}
        lng={lng}
        title={`Listing tour for ${altBase}`}
        onClose={() => {
          setTourOpen(false)
          setEmbed(null)
        }}
      />
      {hasStreetView ? (
        <ListingStreetViewOverlay
          open={streetOpen}
          lat={lat!}
          lng={lng!}
          title={`Street view of ${addressLine ?? 'this home'}`}
          onClose={() => setStreetOpen(false)}
        />
      ) : null}
    </div>
  )
}

function MosaicStill({
  src,
  alt,
  sizes,
  priority = false,
  contain = false,
}: {
  src: string
  alt: string
  sizes: string
  priority?: boolean
  contain?: boolean
}) {
  return (
    <Image
      src={preferListingMosaicPhotoUrl(src)}
      alt={alt}
      fill
      sizes={sizes}
      quality={LISTING_MOSAIC_PHOTO_QUALITY}
      priority={priority}
      className={contain ? 'object-contain' : 'object-cover'}
    />
  )
}

function VideoLayer({
  video,
  posterUrl,
  altBase,
  videoRef,
  onTap,
  openLabel,
  allowAutoplay,
}: {
  video: VideoEmbed
  posterUrl?: string
  altBase: string
  videoRef: React.RefObject<HTMLVideoElement | null>
  onTap: () => void
  openLabel: string
  allowAutoplay: boolean
}) {
  if (video.embedType === 'iframe') {
    return (
      <IframeHeroLayer
        video={video}
        posterUrl={posterUrl}
        altBase={altBase}
        onOpen={onTap}
        openLabel={openLabel}
        allowAutoplay={allowAutoplay}
      />
    )
  }
  return (
    <video
      ref={videoRef}
      src={video.url}
      poster={video.posterUrl ?? posterUrl}
      muted
      autoPlay={allowAutoplay}
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
  openLabel,
  allowAutoplay,
}: {
  video: VideoEmbed
  posterUrl?: string
  altBase: string
  onOpen: () => void
  openLabel: string
  allowAutoplay: boolean
}) {
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)
  const embedSrc = allowAutoplay ? getAutoplayEmbedUrl(video) : null

  useEffect(() => {
    if (!embedSrc) return
    function onMessage(event: MessageEvent) {
      if (embedSrc && isPlayerReadyMessage(event, embedSrc)) setReady(true)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [embedSrc])

  return (
    <>
      {posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preferListingMosaicPhotoUrl(posterUrl)} alt={altBase} />
      ) : null}
      {failed || !embedSrc ? null : (
        <iframe
          src={embedSrc}
          title={`Listing video for ${altBase}`}
          allow={['accelerometer', 'autoplay', 'clipboard-write', 'encrypted-media', 'gyroscope', 'picture-in-picture', 'fullscreen'].join('; ')}
          allowFullScreen
          onError={() => setFailed(true)}
          style={{ opacity: ready || !posterUrl ? 1 : 0.01, pointerEvents: 'none' }}
        />
      )}
      <button
        type="button"
        className="listing-mosaic__hit"
        onClick={onOpen}
        aria-label={openLabel}
      />
    </>
  )
}
