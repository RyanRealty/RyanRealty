'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import type { SparkPhoto, SparkVideo } from '@/lib/spark'
import { getVideoEmbedHtml } from '@/lib/video-embed'
import { sanitizeHtmlWithEmbeds } from '@/lib/sanitize'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon, ArrowRight01Icon, PlayIcon } from '@hugeicons/core-free-icons'
import { Button } from "@/components/ui/button"

const DIRECT_VIDEO_EXT = /\.(mp4|webm|ogg|mov)(\?|$)/i
const EMBED_VIDEO_REGEX = /youtube\.com|youtu\.be|vimeo\.com/i
function isDirectVideoUrl(uri: string): boolean {
  try {
    return DIRECT_VIDEO_EXT.test(new URL(uri).pathname)
  } catch {
    return false
  }
}
function isVideoUrl(uri: string): boolean {
  return isDirectVideoUrl(uri) || EMBED_VIDEO_REGEX.test(uri)
}
function photoToVideoUrl(photo: SparkPhoto): string | null {
  const uri = photo.Uri1600 ?? photo.Uri1280 ?? photo.Uri1024 ?? photo.Uri800 ?? photo.Uri640 ?? photo.Uri300 ?? ''
  if (uri && isVideoUrl(uri)) return uri
  return null
}

type MediaItem =
  | { type: 'video'; video: SparkVideo; id: string }
  | { type: 'photo'; photo: SparkPhoto; id: string }

type Props = {
  photos: SparkPhoto[]
  videos: SparkVideo[]
}

/** First direct-playable video URL (mp4/webm/etc.) for hero background, from videos array or a photo that is a video. */
function getHeroBackgroundVideoUrl(
  videos: SparkVideo[],
  orderedPhotos: SparkPhoto[]
): string | null {
  const firstDirect = Array.isArray(videos)
    ? videos.find((v) => v.Uri && isDirectVideoUrl(v.Uri))
    : null
  if (firstDirect?.Uri) return firstDirect.Uri
  const firstPhoto = orderedPhotos[0]
  if (firstPhoto) {
    const url = photoToVideoUrl(firstPhoto)
    if (url && isDirectVideoUrl(url)) return url
  }
  return null
}

export default function ListingHero({ photos, videos }: Props) {
  const hasVideo = Array.isArray(videos) && videos.length > 0
  const firstVideo = hasVideo ? videos[0]! : null
  const photoList = Array.isArray(photos) ? photos : []
  const primaryPhoto = photoList.find((p) => p.Primary) ?? photoList[0]
  const otherPhotos = photoList.filter((p) => p !== primaryPhoto)
  const orderedPhotos = primaryPhoto ? [primaryPhoto, ...otherPhotos] : []

  const heroBackgroundVideoUrl = getHeroBackgroundVideoUrl(
    Array.isArray(videos) ? videos : [],
    orderedPhotos
  )

  const mediaItems: MediaItem[] = []
  if (firstVideo) {
    mediaItems.push({ type: 'video', video: firstVideo, id: firstVideo.Id ?? 'v0' })
  }
  const firstPhotoAsVideo =
    !firstVideo && orderedPhotos.length > 0 && photoToVideoUrl(orderedPhotos[0]!)
  if (firstPhotoAsVideo) {
    const p = orderedPhotos[0]!
    mediaItems.push({ type: 'video', video: { Uri: photoToVideoUrl(p)!, Id: p.Id ?? 'ph-v-0' }, id: p.Id ?? 'ph-v-0' })
  }
  const photosToAdd = firstPhotoAsVideo ? orderedPhotos.slice(1) : orderedPhotos
  photosToAdd.forEach((p, i) => {
    mediaItems.push({ type: 'photo', photo: p, id: p.Id ?? `p${i}` })
  })

  const [selectedIndex, setSelectedIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const current = mediaItems[selectedIndex]

  const goPrev = () => setSelectedIndex((i) => (i === 0 ? mediaItems.length - 1 : i - 1))
  const goNext = () => setSelectedIndex((i) => (i === mediaItems.length - 1 ? 0 : i + 1))

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (lightboxOpen) {
        if (e.key === 'Escape') setLightboxOpen(false)
        return
      }
      if (e.key === 'ArrowLeft') setSelectedIndex((i) => (i === 0 ? mediaItems.length - 1 : i - 1))
      else if (e.key === 'ArrowRight') setSelectedIndex((i) => (i === mediaItems.length - 1 ? 0 : i + 1))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [lightboxOpen, mediaItems.length])

  if (mediaItems.length === 0) {
    return (
      <div className="flex aspect-[16/10] max-h-[70vh] w-full items-center justify-center bg-border text-muted-foreground">
        No photos or video
      </div>
    )
  }

  const currentIsPhoto = current?.type === 'photo'
  const showBackgroundVideoHero = Boolean(heroBackgroundVideoUrl)
  const currentPhoto = currentIsPhoto ? (current as { type: 'photo'; photo: SparkPhoto }).photo : null
  const photoSrc = currentPhoto
    ? (currentPhoto.Uri1600 ?? currentPhoto.Uri1280 ?? currentPhoto.Uri1024 ?? currentPhoto.Uri800 ?? currentPhoto.Uri640 ?? currentPhoto.Uri300 ?? '')
    : ''

  const renderMainContent = () => {
    if (current?.type === 'video') {
      const v = current.video
      if (v.ObjectHtml) {
        return (
          <div
            className="aspect-video h-full w-full [&>iframe]:h-full [&>iframe]:w-full"
            dangerouslySetInnerHTML={{ __html: sanitizeHtmlWithEmbeds(v.ObjectHtml) }}
          />
        )
      }
      if (v.Uri && isDirectVideoUrl(v.Uri)) {
        return (
          <video
            src={v.Uri}
            controls
            className="h-full w-full object-contain"
            playsInline
            preload="auto"
            autoPlay
            muted
          >
            <track kind="captions" />
          </video>
        )
      }
      const embedHtml = v.Uri ? getVideoEmbedHtml(v.Uri, true) : null
      if (embedHtml) {
        return (
          <div
            className="relative aspect-video h-full w-full [&>iframe]:h-full [&>iframe]:w-full"
            dangerouslySetInnerHTML={{ __html: sanitizeHtmlWithEmbeds(embedHtml) }}
          />
        )
      }
      if (v.Uri) {
        return (
          <a
            href={v.Uri}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-full w-full items-center justify-center bg-primary text-white"
          >
            <span className="rounded-lg bg-card/10 px-4 py-2">Watch video →</span>
          </a>
        )
      }
      return (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">Video</div>
      )
    }
    if (currentIsPhoto && photoSrc) {
      return (
        <Button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="relative h-full w-full focus:outline-none"
        >
          <Image
            src={photoSrc}
            alt={currentPhoto?.Caption ?? `Photo ${selectedIndex + 1}`}
            fill
            className="object-contain"
            sizes="100vw"
            priority={selectedIndex === 0}
          />
        </Button>
      )
    }
    return (
      <div className="flex h-full w-full items-center justify-center text-muted-foreground">No media</div>
    )
  }

  const isVideo = current?.type === 'video'
  const sectionBg = isVideo ? 'bg-primary' : 'bg-muted'
  const thumbStripBg = isVideo ? 'border-primary bg-primary' : 'border-border bg-muted'
  const counterClass = isVideo ? 'bg-black/60 text-white' : 'bg-card/90 text-primary shadow'
  const dotSelected = isVideo ? 'bg-card' : 'bg-primary'
  const dotUnselected = isVideo ? 'bg-card/50 hover:bg-card/70' : 'bg-muted-foreground hover:bg-muted-foreground'
  const thumbBorder = (isSelected: boolean) => (isSelected ? (isVideo ? 'border-white' : 'border-primary') : 'border-transparent opacity-80 hover:opacity-100')
  const thumbPlaceholder = isVideo ? 'bg-primary' : 'bg-border'

  return (
    <div className="w-full">
      {/* Full-bleed background video hero when listing has a direct-playable video (mp4/webm) */}
      {showBackgroundVideoHero && heroBackgroundVideoUrl && (
        <section className="relative w-full overflow-hidden bg-black" aria-label="Listing video">
          <div className="aspect-[16/10] max-h-[75vh] w-full relative">
            <video
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              className="absolute inset-0 h-full w-full object-cover"
              src={heroBackgroundVideoUrl}
              aria-hidden
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" aria-hidden />
          </div>
        </section>
      )}

      <section className={`relative w-full ${sectionBg}`} aria-label="Listing photos and video">
        <div className="aspect-[16/10] max-h-[70vh] w-full relative">
          <div key={selectedIndex} className="h-full w-full animate-listing-slide-fade">
            {isVideo ? (
              <div className="relative h-full w-full bg-black">{renderMainContent()}</div>
            ) : (
              renderMainContent()
            )}
          </div>

          {mediaItems.length > 1 && (
            <>
              <div className={`absolute left-4 top-4 z-10 rounded-lg px-3 py-1.5 text-sm font-medium ${counterClass}`} aria-live="polite">
                {selectedIndex + 1} / {mediaItems.length}
              </div>
              <Button
                type="button"
                className="absolute left-2 top-1/2 z-10 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white shadow-md transition-all duration-200 hover:bg-black/60 hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                aria-label="Previous photo or video"
                onClick={goPrev}
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} className="h-6 w-6" />
              </Button>
              <Button
                type="button"
                className="absolute right-2 top-1/2 z-10 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white shadow-md transition-all duration-200 hover:bg-black/60 hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                aria-label="Next photo or video"
                onClick={goNext}
              >
                <HugeiconsIcon icon={ArrowRight01Icon} className="h-6 w-6" />
              </Button>
              <div className="absolute bottom-3 left-0 right-0 z-10 flex justify-center gap-1.5">
                {mediaItems.map((_, i) => (
                  <Button
                    key={i}
                    type="button"
                    onClick={() => setSelectedIndex(i)}
                    className={`h-2 rounded-full transition-all duration-200 ${i === selectedIndex ? `w-6 ${dotSelected}` : `w-2 ${dotUnselected}`}`}
                    aria-label={`View ${i + 1} of ${mediaItems.length}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Thumbnail strip: full-bleed with horizontal padding only */}
        {mediaItems.length > 1 && (
          <div className={`border-t px-4 py-3 ${thumbStripBg}`}>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {mediaItems.map((item, i) => {
                const sel = i === selectedIndex
                if (item.type === 'video') {
                  return (
                    <Button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedIndex(i)}
                      className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 ${thumbBorder(sel)}`}
                    >
                      <div className={`flex h-full w-full items-center justify-center ${thumbPlaceholder}`}>
                        <HugeiconsIcon icon={PlayIcon} className={`h-6 w-6 ${isVideo ? 'text-white' : 'text-muted-foreground'}`} />
                      </div>
                    </Button>
                  )
                }
                const thumb = item.photo.Uri300 ?? item.photo.Uri640 ?? item.photo.Uri800
                return (
                  <Button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedIndex(i)}
                    className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 ${thumbBorder(sel)}`}
                  >
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={`Photo ${i + 1} of property`}
                        width={80}
                        height={56}
                        className="h-full w-full object-cover"
                        decoding="async"
                      />
                    ) : (
                      <div className={`h-full w-full ${thumbPlaceholder}`} />
                    )}
                  </Button>
                )
              })}
            </div>
          </div>
        )}
      </section>

      {lightboxOpen && currentIsPhoto && photoSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxOpen(false)}
          onKeyDown={(e) => e.key === 'Escape' && setLightboxOpen(false)}
          role="button"
          tabIndex={0}
        >
          <Button
            type="button"
            className="absolute right-4 top-4 text-white/80 hover:text-white"
            onClick={() => setLightboxOpen(false)}
          >
            ✕
          </Button>
          <img
            src={photoSrc}
            alt={`Property photo — full size view`}
            className="max-h-full max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
            width={1200}
            height={750}
            decoding="async"
          />
        </div>
      )}
    </div>
  )
}
