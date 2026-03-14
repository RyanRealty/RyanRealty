'use client'

import ShareButton from '@/components/ShareButton'
import { HeartIcon as ActionHeartIcon, BookmarkIcon as ActionBookmarkIcon } from '@/components/icons/ActionIcons'
import { Button } from "@/components/ui/button"

export type PageActionBarProps = {
  /** e.g. "Save city" | "Save community" | "Save home" */
  saveLabel?: string
  saveActive?: boolean
  onSave?: (e: React.MouseEvent) => void
  saveDisabled?: boolean
  /** Show Like button (e.g. community, listing). */
  like?: boolean
  likeActive?: boolean
  onLike?: (e: React.MouseEvent) => void
  likeDisabled?: boolean
  shareUrl?: string
  shareTitle?: string
  shareText?: string
  /** When false, hide the Share button. Default true when shareUrl is set. */
  showShare?: boolean
  /** When false, hide save/like (e.g. not signed in). */
  signedIn?: boolean
  /** 'bar' = full-width bar below hero (default). 'overlay' = compact row for hero top-right. */
  variant?: 'bar' | 'overlay'
}

/**
 * Page-level action bar for city, community, neighborhood, and listing detail pages.
 * Full buttons with icon + label (e.g. "Save home", "Like", "Share").
 * Cards use icon-only via CardActionBar; this component is for the detail page itself.
 */
export default function PageActionBar({
  saveLabel,
  saveActive = false,
  onSave,
  saveDisabled = false,
  like = false,
  likeActive = false,
  onLike,
  likeDisabled = false,
  shareUrl,
  shareTitle,
  shareText,
  showShare = true,
  signedIn = true,
  variant = 'bar',
}: PageActionBarProps) {
  const showShareButton = showShare && shareUrl
  const isOverlay = variant === 'overlay'
  const buttonBase = isOverlay
    ? 'inline-flex items-center gap-1.5 rounded-full border border-white/80 bg-black/40 backdrop-blur-sm px-3 py-2 text-sm font-medium text-white shadow-md transition hover:bg-black/55 disabled:opacity-60'
    : 'inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-primary shadow-sm transition hover:bg-muted disabled:opacity-60'
  const wrapperClass = isOverlay
    ? 'flex flex-wrap items-center justify-end gap-2'
    : 'flex flex-wrap items-center justify-center gap-2 sm:gap-3 bg-muted border-b border-border px-4 py-3 sm:px-6'

  return (
    <div
      className={wrapperClass}
      role="group"
      aria-label="Page actions"
    >
      {signedIn && saveLabel && onSave && (
        <Button
          type="button"
          onClick={onSave}
          disabled={saveDisabled}
          className={`${buttonBase} ${saveActive ? (isOverlay ? 'border-accent bg-accent/30 text-white' : 'border-accent text-accent-foreground bg-accent/5') : ''}`}
          aria-label={saveActive ? `Remove from saved` : saveLabel}
        >
          <ActionBookmarkIcon filled={saveActive} className="h-5 w-5 flex-shrink-0" />
          {!isOverlay && <span>{saveActive ? 'Saved' : saveLabel}</span>}
        </Button>
      )}
      {signedIn && like && onLike && (
        <Button
          type="button"
          onClick={onLike}
          disabled={likeDisabled}
          className={`${buttonBase} ${likeActive ? (isOverlay ? 'border-destructive bg-destructive/100/40 text-white' : 'border-destructive/60 text-destructive bg-destructive/100/5') : ''}`}
          aria-label={likeActive ? 'Unlike' : 'Like'}
        >
          <ActionHeartIcon filled={likeActive} className="h-5 w-5 flex-shrink-0" />
          {!isOverlay && <span>Like</span>}
        </Button>
      )}
      {showShareButton && (
        <ShareButton
          url={shareUrl!}
          title={shareTitle}
          text={shareText}
          variant={isOverlay ? 'compact' : 'default'}
          className={isOverlay ? `${buttonBase} !rounded-full !px-3 !py-2 !text-white !border-white/80 !bg-black/40` : buttonBase}
          aria-label="Share"
        />
      )}
    </div>
  )
}
