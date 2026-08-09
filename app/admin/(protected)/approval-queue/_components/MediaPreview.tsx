'use client'

/**
 * MediaPreview — draft deliverable preview for one approval-queue card.
 *
 * 11F residual: no shadcn imports, but the empty/iframe/link shells still used
 * public-site semantic classes (bg-muted, border-border, bg-card, text-primary).
 * Those are swapped to var(--a-*) so the card sits in the same token surface as
 * ActionCard. Behaviour is unchanged — same URL/media_type inference, same
 * video/image/carousel/iframe/link branches.
 */

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
      <div
        className="flex h-40 items-center justify-center"
        style={{
          borderRadius: 'var(--a-r-lg)',
          background: 'var(--a-inset)',
          fontSize: 'var(--a-text-sm)',
          color: 'var(--a-text-2)',
        }}
      >
        No preview available
      </div>
    )
  }

  if (mediaType === 'video') {
    return (
      <video
        src={previewUrl}
        controls
        className="w-full"
        style={{ maxHeight: 420, borderRadius: 'var(--a-r-lg)' }}
      />
    )
  }

  if (mediaType === 'image' || mediaType === 'carousel') {
    const images: string[] =
      Array.isArray(resp['images']) ? resp['images'].map(String) : [previewUrl]
    return (
      <div className="flex gap-2 overflow-x-auto pb-1">
        {images.map((src, i) => (
          <div
            key={i}
            className="relative h-52 w-40 shrink-0 overflow-hidden"
            style={{
              borderRadius: 'var(--a-r-lg)',
              background: 'var(--a-inset)',
            }}
          >
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
        className="h-80 w-full"
        style={{
          borderRadius: 'var(--a-r-lg)',
          border: '1px solid var(--a-border)',
          background: 'var(--a-surface)',
        }}
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
      className="block truncate px-4 py-3"
      style={{
        borderRadius: 'var(--a-r-lg)',
        border: '1px solid var(--a-border)',
        background: 'var(--a-inset)',
        fontSize: 'var(--a-text-sm)',
        color: 'var(--a-accent)',
        textDecoration: 'underline',
      }}
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
  )
    return 'video'
  if (actionType.includes('flyer') || actionType.includes('meme') || actionType.includes('post')) {
    return 'image'
  }
  return 'link'
}
