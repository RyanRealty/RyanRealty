'use client'

import Image from 'next/image'

interface MediaPreviewProps {
  actionType: string
  executorResponse: Record<string, unknown> | null
}

/**
 * Renders a preview of the draft deliverable based on action_type + executor_response.
 * executor_response shape (per marketing_brain_actions schema):
 *   { draft_path, preview_url, media_type, caption_map, ... }
 */
export function MediaPreview({ actionType, executorResponse }: MediaPreviewProps) {
  const prefix = actionType.split(':')[0] ?? 'content'
  const resp = executorResponse ?? {}

  const previewUrl = String(resp['preview_url'] ?? resp['draft_path'] ?? '')
  const mediaType = String(resp['media_type'] ?? inferMediaType(actionType, previewUrl))

  if (!previewUrl) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
        No preview available
      </div>
    )
  }

  if (mediaType === 'video') {
    return (
      <video
        src={previewUrl}
        controls
        className="w-full rounded-lg"
        style={{ maxHeight: 420 }}
      />
    )
  }

  if (mediaType === 'image' || mediaType === 'carousel') {
    const images: string[] =
      Array.isArray(resp['images']) ? resp['images'].map(String) : [previewUrl]
    return (
      <div className="flex gap-2 overflow-x-auto pb-1">
        {images.map((src, i) => (
          <div key={i} className="relative h-52 w-40 shrink-0 overflow-hidden rounded-lg bg-muted">
            <Image
              src={src}
              alt={`Preview ${i + 1}`}
              fill
              className="object-cover"
              unoptimized={src.startsWith('http')}
            />
          </div>
        ))}
      </div>
    )
  }

  if (mediaType === 'blog' || mediaType === 'email' || prefix === 'site') {
    return (
      <iframe
        src={previewUrl}
        className="h-80 w-full rounded-lg border border-border bg-card"
        sandbox="allow-same-origin allow-scripts"
        title="Draft preview"
      />
    )
  }

  // Fallback: link
  return (
    <a
      href={previewUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block truncate rounded-lg border border-border bg-muted px-4 py-3 text-sm text-primary underline"
    >
      View draft: {previewUrl}
    </a>
  )
}

function inferMediaType(actionType: string, url: string): string {
  if (/\.(mp4|webm|mov)$/i.test(url)) return 'video'
  if (/\.(jpg|jpeg|png|webp|gif)$/i.test(url)) return 'image'
  if (actionType.includes('blog') || actionType.includes('seo')) return 'blog'
  if (actionType.includes('email') || actionType.includes('newsletter')) return 'email'
  if (actionType.includes('carousel') || actionType.includes('ig_carousel')) return 'carousel'
  if (
    actionType.includes('video') ||
    actionType.includes('reel') ||
    actionType.includes('clip') ||
    actionType.includes('tour')
  ) return 'video'
  if (actionType.includes('flyer') || actionType.includes('meme') || actionType.includes('post')) {
    return 'image'
  }
  return 'link'
}
