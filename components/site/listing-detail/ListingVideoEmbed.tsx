'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
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
  const preferred = videos.find((v) => v.embedType !== 'link') ?? videos[0]
  // Zillow 3D Home tours refuse framing behind a PerimeterX bot wall — the
  // iframe renders the competitor's logo plus a CAPTCHA inside our listing
  // page. Render those as the branded open-in-new-tab card instead.
  const zillowHosted = (() => {
    try { return /(^|\.)zillow\.com$/i.test(new URL(preferred.url).hostname) } catch { return false }
  })()
  const video = zillowHosted && preferred.embedType === 'iframe'
    ? { ...preferred, embedType: 'link' as const }
    : preferred
  const isTour = variant === 'tour'
  const eyebrow = isTour ? 'Virtual tour' : 'Video'
  const heading = isTour ? 'Explore this home in 3D' : 'Walkthrough'
  const ctaLabel = isTour ? 'Open the virtual tour' : 'Watch the video tour'
  // A 3D / virtual tour (Matterport, Zillow-3D) is INTERACTIVE — embed it
  // directly so the viewer sees the tour's own start screen, instead of hiding
  // it behind a generic "play" button the way a marketing video is gated.
  const directEmbed = isTour && video.embedType === 'iframe'
  const orientationClass =
    video.orientation === 'portrait'
      ? 'aspect-[9/16] max-w-sm mx-auto'
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
          // w-full is REQUIRED: this box is a flex item in <Stack> (which does
          // not stretch its children), and aspect-video derives height FROM
          // width — without w-full the box collapses to ~0 and the absolute
          // iframe/video has nothing to fill (the "empty 3D tour box" bug).
          'relative w-full overflow-hidden',
          orientationClass,
        )}
        style={{
          background: 'var(--navy)',
          border: '3px solid var(--navy)',
        }}
      >
        {video.embedType === 'link' ? (
          <a
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute inset-0 flex flex-col items-center justify-center gap-3"
            style={{ background: 'var(--navy)', color: 'var(--cream)' }}
            aria-label={`${ctaLabel} (opens in a new tab)`}
          >
            <span
              className="w-16 h-16 flex items-center justify-center"
              style={{
                background: 'var(--cream)',
                border: '3px solid var(--cream)',
                color: 'var(--navy)',
              }}
            >
              <span aria-hidden className="text-2xl ml-1">▶</span>
            </span>
            <span
              className="px-4 py-2 text-sm font-semibold"
              style={{
                background: 'var(--cream)',
                color: 'var(--navy)',
                letterSpacing: '0.04em',
              }}
            >
              {ctaLabel}
            </span>
          </a>
        ) : directEmbed || playing ? (
          video.embedType === 'iframe' ? (
            <iframe
              src={video.url}
              title={isTour ? 'Virtual tour' : 'Listing video'}
              loading="lazy"
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
          <Button
            type="button"
            variant="ghost"
            onClick={() => setPlaying(true)}
            className="absolute inset-0 flex h-auto w-auto items-center justify-center rounded-none p-0 group bg-cover bg-center hover:bg-transparent"
            style={
              video.posterUrl
                ? { backgroundImage: `url(${video.posterUrl})` }
                : undefined
            }
            aria-label="Play listing video"
          >
            {!video.posterUrl ? (
              <div className="absolute inset-0" style={{ background: 'var(--navy)' }} />
            ) : null}
            <span
              className="relative w-16 h-16 flex items-center justify-center transition"
              style={{
                background: 'var(--cream)',
                border: '3px solid var(--cream)',
                color: 'var(--navy)',
              }}
            >
              <span aria-hidden className="text-2xl ml-1">▶</span>
            </span>
          </Button>
        )}
      </div>
    </Stack>
  )
}
