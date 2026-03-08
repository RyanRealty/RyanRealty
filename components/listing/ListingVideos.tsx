'use client'

import type { SparkVideo, SparkVirtualTour } from '../../lib/spark'
import { getVideoEmbedHtml } from '@/lib/video-embed'

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
                className="overflow-hidden rounded-xl border border-zinc-200 bg-white p-2 shadow-sm"
              >
                {v.ObjectHtml ? (
                  <div
                    className="aspect-video w-full overflow-hidden rounded-lg [&>iframe]:h-full [&>iframe]:w-full"
                    dangerouslySetInnerHTML={{ __html: v.ObjectHtml }}
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
                    dangerouslySetInnerHTML={{ __html: getVideoEmbedHtml(v.Uri)! }}
                  />
                ) : v.Uri ? (
                  <a
                    href={v.Uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block aspect-video rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-600 hover:bg-zinc-200"
                  >
                    Watch: {v.Name ?? v.Caption ?? 'Video'}
                  </a>
                ) : (
                  <div className="flex aspect-video items-center justify-center rounded-lg bg-zinc-100 text-zinc-500">
                    {v.Name ?? 'Video'}
                  </div>
                )}
                {(v.Caption || v.Name) && (
                  <p className="mt-2 text-sm text-zinc-600">
                    {v.Caption ?? v.Name}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {!hasVideos && !hasTours && (
        <p className="text-sm text-zinc-500">No videos or virtual tours for this listing.</p>
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
                className="inline-flex items-center rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
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
