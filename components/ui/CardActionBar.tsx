'use client'

import { EyeIcon } from '@heroicons/react/24/outline'
import { cn } from '@/lib/utils'
import ShareButton from '@/components/ShareButton'
import { BookmarkIcon as ActionBookmarkIcon } from '@/components/icons/ActionIcons'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

/**
 * Shared action bar for all card TILES: view count (read-only), share, save.
 * Liking happens ONLY on the listing detail page (components/listing/ListingActions),
 * not on tiles (Matt directive 2026-06-03) — so the `like` prop is accepted for
 * backward compat with existing callers but is intentionally NOT rendered here.
 * Uses shadcn Button + design tokens: unselected = muted; selected = accent.
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
  /** View count shown next to eye icon (all users). When > 0, displayed first in bar with tooltip "X views". */
  viewCount?: number
}

const overlayBase = 'flex flex-shrink-0 items-center justify-center rounded-full border-2 shadow-sm transition disabled:opacity-60 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:shadow-none'
const countClass = 'min-w-[1ch] text-[10px] tabular-nums drop-shadow-sm'

function onDarkInactive() {
  return 'border-primary-foreground/30 bg-foreground/40 text-primary-foreground hover:bg-foreground/60'
}

function onDarkSaveActive() {
  return 'border-accent text-accent hover:bg-accent/20'
}

function onLightInactive() {
  return 'border-border bg-card/95 text-muted-foreground hover:bg-card hover:text-foreground'
}

function onLightSaveActive() {
  return 'border-accent/60 text-accent hover:bg-accent/10'
}

export default function CardActionBar({
  variant = 'onDark',
  position = 'below',
  onClickWrap,
  share,
  save,
  signedIn = true,
  guestCounts,
  viewCount,
}: CardActionBarProps) {
  const isDark = variant === 'onDark'
  const isBelow = position === 'below'
  const isPriceRow = position === 'priceRow'
  const countColor = (isBelow || isPriceRow) ? 'text-muted-foreground' : (isDark ? 'text-primary-foreground' : 'text-muted-foreground')
  const iconSize = isPriceRow ? ICON_SIZE_COMPACT : (isBelow ? ICON_SIZE_BELOW : ICON_SIZE_OVERLAY)
  const buttonSize = isPriceRow ? BUTTON_SIZE_COMPACT : (isBelow ? BUTTON_SIZE_BELOW : BUTTON_SIZE_OVERLAY)
  const wrapperClass = isPriceRow
    ? 'flex flex-shrink-0 flex-nowrap items-center justify-end gap-0.5'
    : isBelow
      ? 'flex flex-wrap items-center justify-end gap-1 px-2 py-1.5'
      : 'absolute bottom-2 right-2 z-10 flex flex-wrap items-center justify-end gap-1.5'

  const belowButtonBase = 'flex flex-shrink-0 items-center justify-center rounded-full border-2 border-border bg-muted text-muted-foreground transition hover:bg-border hover:text-foreground disabled:opacity-60 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:shadow-none'
  const belowActiveSave = 'border-2 border-accent/60 text-accent bg-muted hover:bg-accent/10'
  const useBelowStyle = isBelow || isPriceRow
  const showViewCount = typeof viewCount === 'number' && Number.isFinite(viewCount)

  return (
    <TooltipProvider delayDuration={300}>
      <div className={wrapperClass} onClick={onClickWrap}>
        {showViewCount && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  'flex flex-shrink-0 items-center gap-0.5',
                  countColor,
                  (isBelow || isPriceRow) ? 'text-[10px]' : 'text-xs',
                )}
                aria-label={`${viewCount} view${viewCount === 1 ? '' : 's'}`}
              >
                <EyeIcon className={iconSize} aria-hidden />
                <span className={cn('tabular-nums', (isBelow || isPriceRow) ? 'min-w-[1ch] text-[10px]' : '')}>{viewCount}</span>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {viewCount} view{viewCount === 1 ? '' : 's'}
            </TooltipContent>
          </Tooltip>
        )}
        {share && (
        <>
          <ShareButton
            url={share.url}
            title={share.title}
            text={share.text}
            variant="compact"
            onShare={share.onShare}
            iconClassName={iconSize}
            className={cn(
              useBelowStyle
                ? cn(belowButtonBase, buttonSize, 'text-foreground')
                : cn(overlayBase, isDark ? onDarkInactive() : onLightInactive(), buttonSize),
            )}
            aria-label={share.ariaLabel ?? 'Share'}
          />
          {share.shareCount != null && (
            <span className={cn(countClass, countColor)}>{share.shareCount}</span>
          )}
        </>
      )}
      {save && (
        <>
          <Button
            type="button"
            onClick={save.onToggle}
            disabled={save.disabled}
            className={cn(
              useBelowStyle
                ? cn(save.active ? belowActiveSave : belowButtonBase, buttonSize)
                : cn(overlayBase, buttonSize, isDark
                    ? (save.active ? onDarkSaveActive() : onDarkInactive())
                    : (save.active ? onLightSaveActive() : onLightInactive())),
            )}
            aria-label={save.ariaLabel}
          >
            <ActionBookmarkIcon filled={save.active} className={iconSize} />
          </Button>
          {save.count != null && <span className={cn(countClass, countColor)}>{save.count}</span>}
        </>
      )}
        {!signedIn && guestCounts && (guestCounts.viewCount! > 0 || guestCounts.likeCount! > 0 || guestCounts.saveCount! > 0) && (
          <span className={cn('flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px]', (isBelow || isPriceRow) ? 'text-muted-foreground' : (isDark ? 'bg-foreground/40 text-primary-foreground/95 backdrop-blur-sm' : 'bg-muted text-muted-foreground'))}>
            {guestCounts.viewCount! > 0 && <span>{guestCounts.viewCount} views</span>}
            {guestCounts.likeCount! > 0 && <span>{guestCounts.likeCount} likes</span>}
            {guestCounts.saveCount! > 0 && <span>{guestCounts.saveCount} saved</span>}
          </span>
        )}
      </div>
    </TooltipProvider>
  )
}
