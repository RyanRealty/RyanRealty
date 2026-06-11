'use client'

import { useState, useCallback } from 'react'
import { ShareIcon as ActionShareIcon } from '@/components/icons/ActionIcons'
import { trackEvent } from '@/lib/tracking'
import { Button } from "@/components/ui/button"

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
  /** If set, trackEvent('share', { context }) is fired when user shares or copies link */
  trackContext?: string
  /** Called when user completes a share (native, copy, or platform). Use to bump share count. */
  onShare?: () => void
  /** Optional class for the icon only (e.g. to match other action icons in a bar). */
  iconClassName?: string
}

function ShareIcon({ className = '' }: { className?: string }) {
  return <ActionShareIcon className={className || 'size-5 shrink-0'} />
}

function buildShareUrl(platform: string, params: { url: string; title: string; text: string }): string {
  const encodedUrl = encodeURIComponent(params.url)
  const encodedTitle = encodeURIComponent(params.title)
  const encodedText = encodeURIComponent(params.text || params.title)
  switch (platform) {
    case 'twitter':
    case 'x':
      return `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`
    case 'linkedin':
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`
    case 'whatsapp':
      return `https://wa.me/?text=${encodedText}%20${encodedUrl}`
    case 'sms':
      return `sms:?&body=${encodedText}%20${encodedUrl}`
    case 'instagram':
      return 'https://www.instagram.com/'
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
  trackContext,
  onShare,
  iconClassName,
}: ShareButtonProps) {
  const [open, setOpen] = useState(false)

  // Resolved INSIDE handlers only (handlers run exclusively in the browser).
  // Accepts a RELATIVE url (e.g. `/communities/tetherow`) and resolves it
  // against the current origin at interaction time. Callers should pass the
  // relative href instead of the
  // `typeof window !== 'undefined' ? window.location.origin + href : ...`
  // pattern — that render-time server/client branch is exactly what React's
  // hydration-mismatch error warns about (site audit 2026-06-10, P0-5).
  const resolveShareUrl = useCallback(() => {
    if (url) return url.startsWith('/') ? new URL(url, window.location.origin).href : url
    return window.location.href
  }, [url])
  const shareTitle = title ?? (typeof document !== 'undefined' ? document.title : '')
  const shareText = text ?? shareTitle

  const trackShare = useCallback(
    (method: string) => {
      if (trackContext) trackEvent('share', { context: trackContext, method })
      onShare?.()
    },
    [trackContext, onShare]
  )

  const handleNativeShare = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.share) {
      setOpen(true)
      return
    }
    try {
      await navigator.share({
        title: shareTitle,
        text: shareText,
        url: resolveShareUrl(),
      })
      trackShare('native')
      setOpen(false)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setOpen(true)
    }
  }, [shareTitle, shareText, resolveShareUrl, trackShare])

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(resolveShareUrl())
      trackShare('copy_link')
      setOpen(false)
    } catch {
      setOpen(true)
    }
  }, [resolveShareUrl, trackShare])

  const handlePlatformShare = useCallback((platform: string) => {
    trackShare(platform)
    const link = buildShareUrl(platform, { url: resolveShareUrl(), title: shareTitle, text: shareText })
    if (platform === 'email') {
      window.location.href = link
    } else {
      window.open(link, '_blank', 'noopener,noreferrer,width=600,height=500')
    }
    setOpen(false)
  }, [resolveShareUrl, shareTitle, shareText, trackShare])

  return (
    <div className="relative inline-block">
      <Button
        type="button"
        onClick={() => (typeof navigator?.share === 'function' ? handleNativeShare() : setOpen((o) => !o))}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground shadow-sm transition hover:border-border hover:bg-muted outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:shadow-none ${className}`}
      >
        <ShareIcon className={iconClassName ?? (variant === 'compact' ? 'size-3.5 shrink-0 sm:size-4' : 'size-5 shrink-0')} />
        {variant === 'default' && <span>Share</span>}
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" aria-hidden onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full z-50 mt-1 min-w-[200px] rounded-lg border border-border bg-card py-2 shadow-md"
            role="menu"
          >
            <Button
              type="button"
              role="menuitem"
              onClick={handleCopyLink}
              className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-muted-foreground hover:bg-muted"
            >
              <span className="text-muted-foreground">🔗</span> Copy link
            </Button>
            <Button
              type="button"
              role="menuitem"
              onClick={() => handlePlatformShare('whatsapp')}
              className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-muted-foreground hover:bg-muted"
            >
              <span className="text-muted-foreground">💬</span> WhatsApp
            </Button>
            <Button
              type="button"
              role="menuitem"
              onClick={() => handlePlatformShare('sms')}
              className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-muted-foreground hover:bg-muted"
            >
              <span className="text-muted-foreground">📱</span> SMS
            </Button>
            <Button
              type="button"
              role="menuitem"
              onClick={() => handlePlatformShare('email')}
              className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-muted-foreground hover:bg-muted"
            >
              <span className="text-muted-foreground">✉️</span> Email
            </Button>
            <Button
              type="button"
              role="menuitem"
              onClick={() => handlePlatformShare('twitter')}
              className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-muted-foreground hover:bg-muted"
            >
              <span className="text-muted-foreground">𝕏</span> X (Twitter)
            </Button>
            <Button
              type="button"
              role="menuitem"
              onClick={() => handlePlatformShare('facebook')}
              className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-muted-foreground hover:bg-muted"
            >
              <span className="text-muted-foreground">f</span> Facebook
            </Button>
            <Button
              type="button"
              role="menuitem"
              onClick={() => handlePlatformShare('linkedin')}
              className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-muted-foreground hover:bg-muted"
            >
              <span className="text-muted-foreground">in</span> LinkedIn
            </Button>
            <Button
              type="button"
              role="menuitem"
              onClick={() => handlePlatformShare('instagram')}
              className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-muted-foreground hover:bg-muted"
            >
              <span className="text-muted-foreground">📷</span> Instagram
            </Button>
            {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
              <Button
                type="button"
                role="menuitem"
                onClick={handleNativeShare}
                className="flex w-full items-center gap-3 border-t border-border px-4 py-2 text-left text-sm text-muted-foreground hover:bg-muted"
              >
                <span className="text-muted-foreground">⋯</span> More options…
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
