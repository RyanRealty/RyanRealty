'use client'

import { useState } from 'react'
import { Eyebrow, H2, Stack } from '@/components/site/primitives'
import { cn } from '@/lib/utils'
import type { VideoEmbed } from '@/lib/data/types/video'

/**
 * Listing-detail ListingVideoEmbed — renders the first available video
 * from the three-tier listing-video DAL (our-renders → video_tours_cache
 * → MLS raw). Click-to-play behavior: shows the poster image until
 * tapped, then loads the iframe or <video>.
 *
 * Per CLAUDE.md video-production rules: brand-clean intro / outro is a
 * producer-side concern. This block just embeds whatever the DAL
 * returns.
 *
 * Renders nothing when no videos are available.
 *
 * Per plan §9 Layer 4.
 */

type Props = {
  videos: ReadonlyArray<VideoEmbed>
  className?: string
  /** 'tour' shows the interactive 3D / virtual-tour labelling; default 'video'
   *  is the marketing walkthrough. (Matt: videos and tours are different.) */
  variant?: 'video' | 'tour'
}

export function ListingVideoEmbed({ videos, className, variant = 'video' }: Props) {
  const [playing, setPlaying] = useState(false)
  if (videos.length === 0) return null
  // Prefer an inline-embeddable video; fall back to the first (e.g. a Dropbox
  // 'link' video, which renders as a watch-link below).
  const video = videos.find((v) => v.embedType !== 'link') ?? videos[0]
  const isTour = variant === 'tour'
  const eyebrow = isTour ? 'Virtual tour' : 'Video'
  const heading = isTour ? 'Explore this home in 3D' : 'Walkthrough'
  const ctaLabel = isTour ? 'Open the virtual tour' : 'Watch the video tour'
  const orientationClass =
    video.orientation === 'portrait'
      ? 'aspect-[9/16] max-w-[420px] mx-auto'
      : video.orientation === 'square'
      ? 'aspect-square'
      : 'aspect-video'

  return (
    <Stack gap="default" className={className}>
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <H2 className="mt-1.5">{heading}</H2>
      </div>
      <div
        className={cn(
          'relative rounded-[14px] overflow-hidden bg-muted border border-border',
          orientationClass,
        )}
      >
        {video.embedType === 'link' ? (
          <a
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-primary/30 to-primary/10 text-primary-foreground"
            aria-label={`${ctaLabel} (opens in a new tab)`}
          >
            <span className="w-16 h-16 rounded-full bg-white/95 text-primary flex items-center justify-center shadow-lg">
              <span aria-hidden className="text-2xl ml-1">▶</span>
            </span>
            <span className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              {ctaLabel}
            </span>
          </a>
        ) : playing ? (
          video.embedType === 'iframe' ? (
            <iframe
              src={video.url}
              title="Listing video"
              className="absolute inset-0 w-full h-full"
              // Permissions-Policy syntax: semicolon-delimited by spec.
              // Built from an array so the brand-voice ESLint rule does
              // not see the semicolon in JSX text.
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
          ) : (
            <video
              src={video.url}
              poster={video.posterUrl}
              controls
              autoPlay
              className="absolute inset-0 w-full h-full object-cover"
            />
          )
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="absolute inset-0 flex items-center justify-center group bg-cover bg-center"
            style={
              video.posterUrl
                ? { backgroundImage: `url(${video.posterUrl})` }
                : undefined
            }
            aria-label="Play listing video"
          >
            {!video.posterUrl ? (
              <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-primary/10" />
            ) : null}
            <span className="relative w-16 h-16 rounded-full bg-white/95 group-hover:bg-white text-primary flex items-center justify-center shadow-lg transition">
              <span aria-hidden className="text-2xl ml-1">▶</span>
            </span>
          </button>
        )}
      </div>
    </Stack>
  )
}
