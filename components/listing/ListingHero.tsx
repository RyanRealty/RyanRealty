'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import type { SparkPhoto, SparkVideo } from '@/lib/spark'
import { getVideoEmbedHtml } from '@/lib/video-embed'

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

export default function ListingHero({ photos, videos }: Props) {
  const hasVideo = Array.isArray(videos) && videos.length > 0
  const firstVideo = hasVideo ? videos[0]! : null
  const photoList = Array.isArray(photos) ? photos : []
  const primaryPhoto = photoList.find((p) => p.Primary) ?? photoList[0]
  const otherPhotos = photoList.filter((p) => p !== primaryPhoto)
  const orderedPhotos = primaryPhoto ? [primaryPhoto, ...otherPhotos] : []

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
      <div className="flex aspect-[16/10] max-h-[70vh] w-full items-center justify-center bg-zinc-200 text-zinc-500">
        No photos or video
      </div>
    )
  }

  const currentIsPhoto = current?.type === 'photo'
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
            dangerouslySetInnerHTML={{ __html: v.ObjectHtml }}
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
            dangerouslySetInnerHTML={{ __html: embedHtml }}
          />
        )
      }
      if (v.Uri) {
        return (
          <a
            href={v.Uri}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-full w-full items-center justify-center bg-zinc-900 text-white"
          >
            <span className="rounded-lg bg-white/10 px-4 py-2">Watch video →</span>
          </a>
        )
      }
      return (
        <div className="flex h-full w-full items-center justify-center text-zinc-500">Video</div>
      )
    }
    if (currentIsPhoto && photoSrc) {
      return (
        <button
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
        </button>
      )
    }
    return (
      <div className="flex h-full w-full items-center justify-center text-zinc-500">No media</div>
    )
  }

  const isVideo = current?.type === 'video'
  const sectionBg = isVideo ? 'bg-zinc-900' : 'bg-zinc-100'
  const thumbStripBg = isVideo ? 'border-zinc-700 bg-zinc-900' : 'border-zinc-200 bg-zinc-100'
  const counterClass = isVideo ? 'bg-black/60 text-white' : 'bg-white/90 text-zinc-800 shadow'
  const dotSelected = isVideo ? 'bg-white' : 'bg-zinc-800'
  const dotUnselected = isVideo ? 'bg-white/50 hover:bg-white/70' : 'bg-zinc-400 hover:bg-zinc-600'
  const thumbBorder = (isSelected: boolean) => (isSelected ? (isVideo ? 'border-white' : 'border-zinc-800') : 'border-transparent opacity-80 hover:opacity-100')
  const thumbPlaceholder = isVideo ? 'bg-zinc-800' : 'bg-zinc-200'

  return (
    <>
      <section className={`relative w-full ${sectionBg}`} aria-label="Listing photos and video">
        <div className="aspect-[16/10] max-h-[70vh] w-full">
          {isVideo ? (
            <div className="relative h-full w-full bg-black">{renderMainContent()}</div>
          ) : (
            renderMainContent()
          )}

          {mediaItems.length > 1 && (
            <>
              <div className={`absolute left-2 top-2 z-10 rounded px-2 py-1 text-sm ${counterClass}`} aria-live="polite">
                {selectedIndex + 1} of {mediaItems.length}
              </div>
              <button
                type="button"
                onClick={() => setSelectedIndex((i) => (i === 0 ? mediaItems.length - 1 : i - 1))}
                className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow-lg hover:bg-white"
                aria-label="Previous"
              >
                <svg className="h-5 w-5 text-zinc-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setSelectedIndex((i) => (i === mediaItems.length - 1 ? 0 : i + 1))}
                className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow-lg hover:bg-white"
                aria-label="Next"
              >
                <svg className="h-5 w-5 text-zinc-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <div className="absolute bottom-2 left-0 right-0 z-10 flex justify-center gap-1">
                {mediaItems.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedIndex(i)}
                    className={`h-1.5 rounded-full transition ${i === selectedIndex ? `w-6 ${dotSelected}` : `w-1.5 ${dotUnselected}`}`}
                    aria-label={`View ${i + 1} of ${mediaItems.length}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Thumbnail strip */}
        {mediaItems.length > 1 && (
          <div className={`border-t px-2 py-2 ${thumbStripBg}`}>
            <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto pb-1">
              {mediaItems.map((item, i) => {
                const sel = i === selectedIndex
                if (item.type === 'video') {
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedIndex(i)}
                      className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 ${thumbBorder(sel)}`}
                    >
                      <div className={`flex h-full w-full items-center justify-center ${thumbPlaceholder}`}>
                        <svg className={`h-6 w-6 ${isVideo ? 'text-white' : 'text-zinc-500'}`} fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </button>
                  )
                }
                const thumb = item.photo.Uri300 ?? item.photo.Uri640 ?? item.photo.Uri800
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedIndex(i)}
                    className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 ${thumbBorder(sel)}`}
                  >
                    {thumb ? (
                      <img
                        src={thumb}
                        alt=""
                        width={80}
                        height={56}
                        className="h-full w-full object-cover"
                        decoding="async"
                      />
                    ) : (
                      <div className={`h-full w-full ${thumbPlaceholder}`} />
                    )}
                  </button>
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
          <button
            type="button"
            className="absolute right-4 top-4 text-white/80 hover:text-white"
            onClick={() => setLightboxOpen(false)}
          >
            ✕
          </button>
          <img
            src={photoSrc}
            alt=""
            className="max-h-full max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
            width={1200}
            height={750}
            decoding="async"
          />
        </div>
      )}
    </>
  )
}
