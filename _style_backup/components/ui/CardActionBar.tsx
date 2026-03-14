'use client'

import ShareButton from '@/components/ShareButton'
import { HeartIcon as ActionHeartIcon, BookmarkIcon as ActionBookmarkIcon } from '@/components/icons/ActionIcons'

/**
 * Shared action bar for all card types: share, like, save.
 * Always rendered in the bottom-right corner of the card media (or card) for consistency.
 * Uses design tokens: unselected = subtle; selected = accent. Same icon size and spacing site-wide.
 */

/** Standardized sizes: below-photo bar (small, like other platforms) */
const ICON_SIZE_BELOW = 'h-3.5 w-3.5'
const BUTTON_SIZE_BELOW = 'h-7 w-7'
/** Compact size for price row: smaller so share/like/save fit on one line without wrapping */
const ICON_SIZE_COMPACT = 'h-3 w-3'
const BUTTON_SIZE_COMPACT = 'h-6 w-6'
const ICON_SIZE_OVERLAY = 'h-4 w-4'
const BUTTON_SIZE_OVERLAY = 'h-9 w-9'

/** 'onDark' = over photo (white/translucent buttons); 'onLight' = over white (border + zinc) */
export type CardActionBarVariant = 'onDark' | 'onLight'

/** 'below' = bar below photo, right-aligned, smaller standardized size (no overlay). 'overlay' = on top of media. 'priceRow' = inline with price, compact so icons don't wrap. */
export type CardActionBarPosition = 'below' | 'overlay' | 'priceRow'

export type CardActionBarProps = {
  variant?: CardActionBarVariant
  /** When 'below', bar is not absolute and uses smaller icon/button size. Default 'below'. */
  position?: CardActionBarPosition
  /** Stop click from bubbling to card link */
  onClickWrap?: (e: React.MouseEvent) => void
  share?: {
    url: string
    title?: string
    text?: string
    ariaLabel?: string
    onShare?: () => void
    shareCount?: number
  }
  like?: {
    active: boolean
    count?: number
    ariaLabel: string
    onToggle: (e: React.MouseEvent) => void
    disabled?: boolean
  }
  save?: {
    active: boolean
    count?: number
    ariaLabel: string
    onToggle: (e: React.MouseEvent) => void
    disabled?: boolean
  }
  /** When true, show share/like/save (signed in). When false, can show view/like/save counts as text. */
  signedIn?: boolean
  /** When not signed in, optional summary e.g. "12 views · 5 likes" */
  guestCounts?: { viewCount?: number; likeCount?: number; saveCount?: number }
}

const buttonBase = 'flex flex-shrink-0 items-center justify-center rounded-full border-2 shadow-[var(--shadow-medium)] transition disabled:opacity-60 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-cta)] focus-visible:ring-offset-2 focus-visible:shadow-none'
const countClass = 'min-w-[1ch] text-[10px] tabular-nums drop-shadow-[var(--shadow-medium)]'

function onDarkClasses(active: boolean): string {
  return active
    ? 'border-2 border-[var(--color-cta)] text-[var(--color-cta)] hover:bg-[var(--color-cta)]/20'
    : 'border-2 border-white/30 bg-black/40 text-white hover:bg-black/60'
}

function onLightClasses(active: boolean): string {
  return active
    ? 'border-2 border-[var(--color-cta)] text-[var(--color-cta)] hover:bg-[var(--color-cta)]/10'
    : 'border-2 border-[var(--color-border-cream)] bg-white/95 text-[var(--text-muted)] hover:bg-white hover:text-[var(--text-primary)]'
}

function onLightLikeActiveClasses(): string {
  return 'border-2 border-[var(--urgent)]/60 text-[var(--urgent)] hover:bg-[var(--urgent)]/10'
}

function onLightSaveActiveClasses(): string {
  return 'border-2 border-[var(--color-cta)]/60 text-[var(--color-cta)] hover:bg-[var(--color-cta)]/10'
}

export default function CardActionBar({
  variant = 'onDark',
  position = 'below',
  onClickWrap,
  share,
  like,
  save,
  signedIn = true,
  guestCounts,
}: CardActionBarProps) {
  const isDark = variant === 'onDark'
  const isBelow = position === 'below'
  const isPriceRow = position === 'priceRow'
  const countColor = (isBelow || isPriceRow) ? 'text-[var(--text-secondary)]' : (isDark ? 'text-white' : 'text-[var(--text-secondary)]')
  const iconSize = isPriceRow ? ICON_SIZE_COMPACT : (isBelow ? ICON_SIZE_BELOW : ICON_SIZE_OVERLAY)
  const buttonSize = isPriceRow ? BUTTON_SIZE_COMPACT : (isBelow ? BUTTON_SIZE_BELOW : BUTTON_SIZE_OVERLAY)
  const wrapperClass = isPriceRow
    ? 'flex flex-shrink-0 flex-nowrap items-center justify-end gap-0.5'
    : isBelow
      ? 'flex flex-wrap items-center justify-end gap-1 px-2 py-1.5'
      : 'absolute bottom-2 right-2 z-10 flex flex-wrap items-center justify-end gap-1.5'
  /* Same circle for all: border-2 so outline never disappears; selected only changes border and icon color */
  const belowButtonBase = 'flex flex-shrink-0 items-center justify-center rounded-full border-2 border-[var(--color-border-cream)] bg-[var(--color-bg-subtle)] text-[var(--text-muted)] transition hover:bg-[var(--gray-border)] hover:text-[var(--text-primary)] disabled:opacity-60 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-cta)] focus-visible:ring-offset-2 focus-visible:shadow-none'
  const belowActiveLike = 'border-2 border-[var(--urgent)]/60 text-[var(--urgent)] bg-[var(--color-bg-subtle)] hover:bg-[var(--urgent)]/10'
  const belowActiveSave = 'border-2 border-[var(--color-cta)]/60 text-[var(--color-cta)] bg-[var(--color-bg-subtle)] hover:bg-[var(--color-cta)]/10'
  const useBelowStyle = isBelow || isPriceRow

  return (
    <div
      className={wrapperClass}
      onClick={onClickWrap}
    >
      {share && (
        <>
          <ShareButton
            url={share.url}
            title={share.title}
            text={share.text}
            variant="compact"
            onShare={share.onShare}
            iconClassName={iconSize}
            className={
              useBelowStyle
                ? `${belowButtonBase} ${buttonSize} text-[var(--text-primary)]`
                : `${buttonBase} ${isDark ? 'border-white/30 bg-black/40 text-white hover:bg-black/60' : 'border-2 border-[var(--color-border-cream)] bg-white/95 text-[var(--text-muted)] hover:bg-white hover:text-[var(--text-primary)]'} ${buttonSize}`
            }
            aria-label={share.ariaLabel ?? 'Share'}
          />
          {share.shareCount != null && share.shareCount > 0 && (
            <span className={`${countClass} ${countColor}`}>{share.shareCount}</span>
          )}
        </>
      )}
      {like && (
        <>
          <button
            type="button"
            onClick={like.onToggle}
            disabled={like.disabled}
            className={
              useBelowStyle
                ? `${like.active ? belowActiveLike : belowButtonBase} ${buttonSize}`
                : `${buttonBase} ${buttonSize} ${isDark ? (like.active ? 'border-2 border-[var(--urgent)]/60 text-[var(--urgent)] hover:bg-[var(--urgent)]/20' : onDarkClasses(false)) : (like.active ? onLightLikeActiveClasses() : onLightClasses(false))}`
            }
            aria-label={like.ariaLabel}
          >
            <ActionHeartIcon filled={like.active} className={iconSize} />
          </button>
          {like.count != null && like.count > 0 && <span className={`${countClass} ${countColor}`}>{like.count}</span>}
        </>
      )}
      {save && (
        <>
          <button
            type="button"
            onClick={save.onToggle}
            disabled={save.disabled}
            className={
              useBelowStyle
                ? `${save.active ? belowActiveSave : belowButtonBase} ${buttonSize}`
                : `${buttonBase} ${buttonSize} ${isDark ? (save.active ? 'border-2 border-[var(--color-cta)] text-[var(--color-cta)] hover:bg-[var(--color-cta)]/20' : onDarkClasses(false)) : (save.active ? onLightSaveActiveClasses() : onLightClasses(false))}`
            }
            aria-label={save.ariaLabel}
          >
            <ActionBookmarkIcon filled={save.active} className={iconSize} />
          </button>
          {save.count != null && save.count > 0 && <span className={`${countClass} ${countColor}`}>{save.count}</span>}
        </>
      )}
      {!signedIn && guestCounts && (guestCounts.viewCount! > 0 || guestCounts.likeCount! > 0 || guestCounts.saveCount! > 0) && (
        <span className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] ${(isBelow || isPriceRow) ? 'text-[var(--text-secondary)]' : (isDark ? 'bg-black/40 text-white/95 backdrop-blur-sm' : 'bg-[var(--color-bg-subtle)] text-[var(--text-secondary)]')}`}>
          {guestCounts.viewCount! > 0 && <span>{guestCounts.viewCount} views</span>}
          {guestCounts.likeCount! > 0 && <span>{guestCounts.likeCount} likes</span>}
          {guestCounts.saveCount! > 0 && <span>{guestCounts.saveCount} saved</span>}
        </span>
      )}
    </div>
  )
}
