'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { SparkSafeImage } from '@/lib/listing/SparkSafeImage'
import { cn } from '@/lib/utils'
import type { ListingPhoto } from '@/lib/data/types/listing'
import type { VideoEmbed } from '@/lib/data/types/video'
import { PhotoSkeleton } from '@/components/motion/photo-skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/motion/tabs'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from '@/components/ui/carousel'
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
  LISTING_MOSAIC_STRIP_SIZES,
  preferListingMosaicPhotoUrl,
} from '@/lib/listing/publish-listing-mosaic'
import { listingRowPhotoSrc } from '@/lib/listing/row-photo'
import { isOffsiteTourHost } from '@/lib/listing/publish-listing-on-site-tour'
import dynamic from 'next/dynamic'

const ListingMediaMap = dynamic(() => import('./ListingLocationMap.client'), {
  ssr: false,
  loading: () => <div className="listing-mosaic__map-slot" aria-hidden />,
})

/**
 * Listing media: ONE FRAME and a FILMSTRIP (site queue SITE-45).
 *
 * The 2026-09-08 taste table scored the listing fold 55 and named the shape:
 * "a main photo, a 2x2 thumbnail grid, and a row of pill buttons over the
 * bottom-right corner — indistinguishable from Zillow/Redfin/Realtor.com at a
 * glance", with the five pills wrapping onto the sky at 375 with no scrim.
 *
 * Now: one frame carries the photograph. A navy filmstrip under it indexes
 * every photo; a thumb changes the frame (desktop) or scrolls the carousel to
 * it (phone), the strip expands on hover or on its toggle, and the media
 * controls (3D, floor plan, street view, map, "N photos") live on that strip
 * instead of floating on the picture. At 375 the strip shows the count and
 * one "More" control; the rest sit behind it. The gallery itself is the
 * fold's first interactive object.
 *
 * Nothing is written on the photograph. The price, the facts and the street
 * are the PriceCtaStrip directly under the strip (SITE-45): with the hero in
 * the main column the old on-media caption repeated all three lines sixty
 * pixels above where they are set, and a bare number on a picture is the
 * thing SITE-20 had to fence with a status word. No empty navy, no grid.
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
  /**
   * Lead stills emit `<link rel="preload">` when true (next/image `priority`).
   * Speculative App Router prefetches must pass false (SITE-60): a 1600×1200
   * Spark plate in a payload the visitor never opened is the list-page tax.
   * Real document / click navigations keep the default so LCP stays sharp.
   */
  lcpPriority?: boolean
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
  lcpPriority = true,
}: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [galleryPane, setGalleryPane] = useState<'photos' | 'floor'>('photos')
  const [carouselApi, setCarouselApi] = useState<CarouselApi>()
  const [embed, setEmbed] = useState<VideoEmbed | null>(null)
  const [tourOpen, setTourOpen] = useState(false)
  const [streetOpen, setStreetOpen] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [allowAutoplay, setAllowAutoplay] = useState(false)
  /** The photo in the frame (desktop) and the slide in view (phone). */
  const [frame, setFrame] = useState(0)
  /** Filmstrip is always open — every thumb stays in the reel (Matt 2026-09-15). */
  const [mediaTab, setMediaTab] = useState<MediaTab>(() => {
    if (photos.length > 0) return 'photos'
    if (floorPlans.length > 0) return 'floor'
    if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) return 'map'
    return 'photos'
  })
  const videoRef = useRef<HTMLVideoElement>(null)
  const reelRef = useRef<HTMLDivElement>(null)
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
  const onSiteTour = virtualTour && !isOffsiteTourHost(virtualTour.url) ? virtualTour : null
  const mosaicPills = publishListingMosaicPills({
    photoCount: total,
    videos,
    floorPlanCount: floorPlans.length,
    hasStreetView,
  })
  const leadOpenLabel = lead?.kind === 'video' ? 'Open video' : null

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

  /* Keep the current thumb in view as the frame moves. */
  useEffect(() => {
    const reelEl = reelRef.current
    if (!reelEl) return
    const thumb = reelEl.querySelector<HTMLElement>(`[data-frame="${frame}"]`)
    if (!thumb) return
    const left = thumb.offsetLeft - reelEl.clientWidth / 2 + thumb.clientWidth / 2
    reelEl.scrollTo({ left: Math.max(0, left), behavior: 'smooth' })
  }, [frame])

  const goTo = useCallback(
    (i: number) => {
      const next = Math.max(0, Math.min(i, Math.max(0, total - 1)))
      setFrame(next)
      setMediaTab('photos')
      carouselApi?.scrollTo(heroVideo ? next : next)
    },
    [total, carouselApi, heroVideo],
  )

  useEffect(() => {
    if (!carouselApi) return
    const sync = () => {
      setFrame(carouselApi.selectedScrollSnap())
      setMediaTab('photos')
    }
    carouselApi.on('select', sync)
    return () => {
      carouselApi.off('select', sync)
    }
  }, [carouselApi])

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
    openGallery(frame)
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
      openGallery(frame)
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
  const counter = total > 0 ? `${Math.min(frame + 1, total)} / ${total}` : null

  /* The strip's tools. "N photos" is the one control the phone always shows;
     the rest are the overflow there and inline on desktop. */
  const primaryPill = mosaicPills.find((pill) => pill.action === 'gallery') ?? null
  const otherPills = mosaicPills.filter((pill) => pill.action !== 'gallery')
  const streetPill = otherPills.find((pill) => pill.action === 'street') ?? null
  const mediaTabItems = [
    { value: 'photos' as const, label: primaryPill?.label ?? 'Photos' },
    ...otherPills
      .filter((pill) => pill.action === 'floor' || pill.action === 'tour')
      .map((pill) => ({
        value: (pill.action === 'floor' ? 'floor' : 'tour') as MediaTab,
        label: pill.label,
      })),
    hasMap ? { value: 'map' as const, label: 'Map' } : null,
  ].filter((row): row is { value: MediaTab; label: string } => row != null)

  return (
    <div
      id="listing-hero-visual"
      className={cn('listing-hero-bleed listing-frame', className)}
    >
      <div className="listing-frame__media">
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
          <Carousel
            className="listing-hero-carousel listing-mosaic__carousel"
            opts={{ align: 'start', loop: false }}
            setApi={setCarouselApi}
            aria-label={addressLine ? `Photos of ${addressLine}` : 'Listing photos'}
          >
            <CarouselContent className="ml-0">
              {heroVideo ? (
                <CarouselItem className="pl-0">
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
                </CarouselItem>
              ) : null}
              {photos.length === 0 && !heroVideo ? (
                <CarouselItem className="pl-0">
                  <div
                    className="listing-mosaic__slide listing-mosaic__slide--empty"
                    role="img"
                    aria-label="Photos not available yet"
                  >
                    <p className="listing-mosaic__empty-label">Photos not available yet</p>
                  </div>
                </CarouselItem>
              ) : null}
              {photos.map((photo, i) => (
                <CarouselItem key={`${i}-${photo.url}`} className="pl-0">
                  <button
                    type="button"
                    className="listing-mosaic__slide"
                    onClick={() => openGallery(i)}
                    aria-label={`View photo ${i + 1} of ${total}`}
                  >
                    {i === 0 || i === frame ? (
                    <MosaicStill
                      src={photo.url}
                      alt={photo.caption ?? `${altBase} ${i + 1} of ${total}`}
                      sizes={i === 0 ? LISTING_MOSAIC_LEAD_SIZES : LISTING_MOSAIC_CAROUSEL_SIZES}
                      priority={lcpPriority && i === 0}
                    />
                    ) : null}
                  </button>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="listing-hero-carousel__prev left-2" />
            <CarouselNext className="listing-hero-carousel__next right-2" />
          </Carousel>
        )}

        {openHouseLabel ? (
          <div className="listing-mosaic__open-house">{openHouseLabel}</div>
        ) : null}
        {mediaTabItems.length > 1 ? (
          <Tabs
            value={mediaTab}
            onValueChange={(next) => {
              if (next === 'tour') {
                const tour = otherPills.find((pill) => pill.action === 'tour')
                if (tour) {
                  openCaption(tour)
                  return
                }
              }
              if (next === 'floor') {
                const floor = otherPills.find((pill) => pill.action === 'floor')
                if (floor) {
                  openCaption(floor)
                  return
                }
              }
              if (next === 'photos' || next === 'map' || next === 'tour' || next === 'floor') {
                setMediaTab(next)
              }
            }}
            variant="pill"
            className="listing-frame__tabs"
          >
            <TabsList>
              {mediaTabItems.map((item) => (
                <TabsTrigger key={item.value} value={item.value}>
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        ) : null}
      </div>

      {/* Cream index under the bleed photograph. beUI pill tabs sit on the
          photograph (bg-card track), not on a navy filmstrip. */}
      {total > 0 || mediaTabItems.length > 0 ? (
        <div className="listing-strip" data-open="true">
          {total > 0 ? (
            <span className="listing-strip__counter">{counter}</span>
          ) : null}
          {total > 0 ? (
            <div
              id="listing-strip-reel"
              className="listing-strip__reel"
              ref={reelRef}
              role="list"
              aria-label="Photo index"
            >
              {photos.map((photo, index) => {
                return (
                <button
                  key={`thumb-${index}-${photo.url}`}
                  type="button"
                  role="listitem"
                  className={cn('listing-strip__thumb', index === frame && 'is-current')}
                  data-frame={index}
                  onClick={() => goTo(index)}
                  aria-label={`Show photo ${index + 1} of ${total}`}
                  aria-current={index === frame ? 'true' : undefined}
                >
                  <SparkSafeImage
                    src={listingRowPhotoSrc(photo.url)}
                    alt=""
                    fill
                    sizes={LISTING_MOSAIC_STRIP_SIZES}
                    quality={LISTING_MOSAIC_PHOTO_QUALITY}
                    className="object-cover"
                  />
                </button>
                )
              })}
            </div>
          ) : null}
          <div className="listing-strip__tools" role="group" aria-label="Listing media">
            {total > 0 ? (
              <button
                type="button"
                className="listing-strip__tool listing-strip__tool--primary"
                onClick={() => openGallery(frame)}
                aria-label={`Open photo ${frame + 1} of ${total}`}
              >
                Open
              </button>
            ) : null}
            {mediaTabItems.length > 1 ? null : primaryPill ? (
              <button
                type="button"
                className="listing-strip__tool listing-strip__tool--primary"
                onClick={() => openCaption(primaryPill)}
              >
                {primaryPill.label}
              </button>
            ) : null}
            {streetPill ? (
              <button
                type="button"
                className="listing-strip__tool"
                onClick={() => openCaption(streetPill)}
              >
                {streetPill.label}
              </button>
            ) : null}
          </div>
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
  // The hero is a full-bleed frame. Always the 1600 mosaic derivative
  // (Matt 2026-09-15) — never the 320 thumb or the 800 field-lead bucket.
  const live = preferListingMosaicPhotoUrl(src)
  void sizes
  void priority
  return (
    <>
      <PhotoSkeleton label="Loading photograph" />
      <img src={live} alt={alt} className={contain ? 'is-plan' : undefined} />
    </>
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
        <img src={listingRowPhotoSrc(posterUrl)} alt={altBase} />
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
