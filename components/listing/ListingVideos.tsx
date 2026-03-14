'use client'

import type { SparkVideo, SparkVirtualTour } from '../../lib/spark'
import { getVideoEmbedHtml } from '@/lib/video-embed'
import { sanitizeHtmlWithEmbeds } from '@/lib/sanitize'

const DIRECT_VIDEO_EXT = /\.(mp4|webm|ogg|mov)(\?|$)/i

function isDirectVideoUrl(uri: string): boolean {
  try {
    const path = new URL(uri).pathname
    return DIRECT_VIDEO_EXT.test(path)
  } catch {
    return false
  }
}

type Props = {
  videos: SparkVideo[]
  virtualTours: SparkVirtualTour[]
}

export default function ListingVideos({ videos, virtualTours }: Props) {
  const hasVideos = Array.isArray(videos) && videos.length > 0
  const hasTours = Array.isArray(virtualTours) && virtualTours.length > 0

  return (
    <div className="space-y-8">
      {hasVideos && (
        <div>
          <h2 className="mb-4 text-lg font-semibold">Videos</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {(videos ?? []).map((v, i) => (
              <div
                key={v.Id ?? i}
                className="overflow-hidden rounded-lg border border-border bg-card p-2 shadow-sm"
              >
                {v.ObjectHtml ? (
                  <div
                    className="aspect-video w-full overflow-hidden rounded-lg [&>iframe]:h-full [&>iframe]:w-full"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtmlWithEmbeds(v.ObjectHtml) }}
                  />
                ) : v.Uri && isDirectVideoUrl(v.Uri) ? (
                  <video
                    src={v.Uri}
                    controls
                    className="aspect-video w-full rounded-lg bg-black"
                    playsInline
                    preload="metadata"
                  >
                    <track kind="captions" />
                    Your browser does not support the video tag.
                  </video>
                ) : v.Uri && getVideoEmbedHtml(v.Uri) ? (
                  <div
                    className="relative aspect-video w-full overflow-hidden rounded-lg [&>iframe]:h-full [&>iframe]:w-full"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtmlWithEmbeds(getVideoEmbedHtml(v.Uri)!) }}
                  />
                ) : v.Uri ? (
                  <a
                    href={v.Uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block aspect-video rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:bg-border"
                  >
                    Watch: {v.Name ?? v.Caption ?? 'Video'}
                  </a>
                ) : (
                  <div className="flex aspect-video items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    {v.Name ?? 'Video'}
                  </div>
                )}
                {(v.Caption || v.Name) && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {v.Caption ?? v.Name}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {!hasVideos && !hasTours && (
        <p className="text-sm text-muted-foreground">No videos or virtual tours for this listing.</p>
      )}
      {hasTours && (
        <div>
          <h2 className="mb-4 text-lg font-semibold">Virtual tours</h2>
          <div className="flex flex-wrap gap-3">
            {(virtualTours ?? []).map((vt, i) => (
              <a
                key={vt.Id ?? i}
                href={vt.Uri ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm hover:bg-muted"
              >
                {vt.Name ?? 'Virtual tour'} →
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
