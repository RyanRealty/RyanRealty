'use client'

import { useState, useCallback } from 'react'

export type ShareButtonProps = {
  /** Page or content title for share text (e.g. "123 Main St, Bend | $549,000") */
  title?: string
  /** Optional description (e.g. meta description). Some platforms use this. */
  text?: string
  /** Full URL to share (default: current window location) */
  url?: string
  /** Accessible label for the button */
  'aria-label'?: string
  /** Optional class for the trigger button */
  className?: string
  /** Size: compact (icon only) or default (icon + "Share") */
  variant?: 'compact' | 'default'
}

const SHARE_ICON = (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
    <polyline points="16 6 12 2 8 6" />
    <line x1="12" y1="2" x2="12" y2="15" />
  </svg>
)

function buildShareUrl(platform: string, params: { url: string; title: string; text: string }): string {
  const encodedUrl = encodeURIComponent(params.url)
  const encodedTitle = encodeURIComponent(params.title)
  const encodedText = encodeURIComponent(params.text || params.title)
  switch (platform) {
    case 'twitter':
    case 'x':
      return `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`
    case 'linkedin':
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`
    case 'email':
      return `mailto:?subject=${encodedTitle}&body=${encodedText}%0A%0A${encodedUrl}`
    default:
      return params.url
  }
}

export default function ShareButton({
  title,
  text,
  url,
  'aria-label': ariaLabel = 'Share',
  className = '',
  variant = 'default',
}: ShareButtonProps) {
  const [open, setOpen] = useState(false)

  const shareUrl = url ?? (typeof window !== 'undefined' ? window.location.href : '')
  const shareTitle = title ?? (typeof document !== 'undefined' ? document.title : '')
  const shareText = text ?? shareTitle

  const handleNativeShare = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.share) {
      setOpen(true)
      return
    }
    try {
      await navigator.share({
        title: shareTitle,
        text: shareText,
        url: shareUrl,
      })
      setOpen(false)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setOpen(true)
    }
  }, [shareTitle, shareText, shareUrl])

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setOpen(false)
    } catch {
      setOpen(true)
    }
  }, [shareUrl])

  const handlePlatformShare = useCallback((platform: string) => {
    const link = buildShareUrl(platform, { url: shareUrl, title: shareTitle, text: shareText })
    if (platform === 'email') {
      window.location.href = link
    } else {
      window.open(link, '_blank', 'noopener,noreferrer,width=600,height=500')
    }
    setOpen(false)
  }, [shareUrl, shareTitle, shareText])

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => (typeof navigator?.share === 'function' ? handleNativeShare() : setOpen((o) => !o))}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 ${className}`}
      >
        {SHARE_ICON}
        {variant === 'default' && <span>Share</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" aria-hidden onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full z-50 mt-1 min-w-[200px] rounded-xl border border-zinc-200 bg-white py-2 shadow-lg"
            role="menu"
          >
            <button
              type="button"
              role="menuitem"
              onClick={handleCopyLink}
              className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
            >
              <span className="text-zinc-400">🔗</span> Copy link
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => handlePlatformShare('email')}
              className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
            >
              <span className="text-zinc-400">✉️</span> Email
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => handlePlatformShare('twitter')}
              className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
            >
              <span className="text-zinc-400">𝕏</span> X (Twitter)
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => handlePlatformShare('facebook')}
              className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
            >
              <span className="text-zinc-400">f</span> Facebook
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => handlePlatformShare('linkedin')}
              className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
            >
              <span className="text-zinc-400">in</span> LinkedIn
            </button>
            {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
              <button
                type="button"
                role="menuitem"
                onClick={handleNativeShare}
                className="flex w-full items-center gap-3 border-t border-zinc-100 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
              >
                <span className="text-zinc-400">⋯</span> More options…
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
