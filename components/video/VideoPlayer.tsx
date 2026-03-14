'use client'

import { useState } from 'react'
import { trackEvent } from '@/lib/tracking'
import { Button } from "@/components/ui/button"

export type VideoPlayerType = 'youtube' | 'vimeo' | 'matterport' | 'direct'

function parseVideoUrl(url: string): { type: VideoPlayerType; id?: string } {
  const u = url.toLowerCase().trim()
  if (u.includes('youtube.com/watch') || u.includes('youtu.be/')) {
    const match = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/)
    return { type: 'youtube', id: match?.[1] }
  }
  if (u.includes('vimeo.com/')) {
    const match = u.match(/vimeo\.com\/(?:video\/)?(\d+)/)
    return { type: 'vimeo', id: match?.[1] }
  }
  if (u.includes('my.matterport.com') || u.includes('matterport.com')) return { type: 'matterport' }
  if (u.endsWith('.mp4') || u.endsWith('.webm') || u.includes('mp4')) return { type: 'direct' }
  return { type: 'direct' }
}

type Props = {
  videoUrl: string
  type?: VideoPlayerType
  listingId?: string
  posterUrl?: string
  className?: string
}

export default function VideoPlayer({ videoUrl, type, listingId, posterUrl, className = '' }: Props) {
  const [played, setPlayed] = useState(false)
  const parsed = type ? { type, id: undefined } : parseVideoUrl(videoUrl)
  const effectiveType = type ?? parsed.type

  const handlePlay = () => {
    if (!played) {
      setPlayed(true)
      trackEvent('play_video', {
        listing_id: listingId,
        video_source: effectiveType,
      })
    }
  }

  if (effectiveType === 'youtube') {
    const id = parsed.id ?? videoUrl.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/)?.[1]
    if (!id) return <div className={className}>Invalid YouTube URL</div>
    return (
      <div className={`relative aspect-video bg-black ${className}`}>
        {!played ? (
          <Button
            type="button"
            onClick={handlePlay}
            className="absolute inset-0 flex items-center justify-center bg-black"
            aria-label="Play video"
          >
            <div
              className="rounded-full bg-destructive p-6 text-white shadow-md"
              style={{ clipPath: 'polygon(0 0, 0 100%, 100% 50%)' }}
            />
          </Button>
        ) : null}
        {played ? (
          <iframe
            title="YouTube video"
            src={`https://www.youtube.com/embed/${id}?autoplay=1`}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <img
            src={posterUrl ?? `https://img.youtube.com/vi/${id}/maxresdefault.jpg`}
            alt="Video thumbnail"
            className="h-full w-full object-cover"
          />
        )}
      </div>
    )
  }

  if (effectiveType === 'vimeo') {
    const id = parsed.id ?? videoUrl.match(/vimeo\.com\/(?:video\/)?(\d+)/)?.[1]
    if (!id) return <div className={className}>Invalid Vimeo URL</div>
    return (
      <div className={`aspect-video ${className}`}>
        <iframe
          title="Vimeo video"
          src={`https://player.vimeo.com/video/${id}`}
          className="h-full w-full"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      </div>
    )
  }

  if (effectiveType === 'matterport') {
    return (
      <div className={`aspect-video ${className}`}>
        <iframe title="Matterport tour" src={videoUrl} className="h-full w-full" allowFullScreen />
      </div>
    )
  }

  return (
    <div className={className}>
      <video
        src={videoUrl}
        poster={posterUrl}
        controls
        playsInline
        className="h-full w-full"
        onPlay={handlePlay}
      />
    </div>
  )
}
