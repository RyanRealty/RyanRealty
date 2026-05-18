'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useRef, useState, useCallback } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  FavouriteIcon,
  ShareKnowledgeIcon,
  VolumeHighIcon,
  VolumeMute01Icon,
  PlayCircleIcon,
} from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'
import { listingDetailPath } from '@/lib/slug'
import HeartBurst from './HeartBurst'
import {
  isLiked,
  toggleLike,
  setLiked as setLikedExternal,
  subscribeLiked,
  getLifetimeLikeCount,
} from '@/lib/pulse-saves'
import { recordLike } from '@/lib/pulse-signals'
import { trackEvent } from '@/lib/tracking'
import type { PulseFeedItem } from '@/app/actions/pulse-feed'

const DIRECT_VIDEO_PATTERN = /\.(mp4|webm|mov|m4v)(\?|#|$)/i
const SIGNUP_TRIGGER_LIKES = 3

type Props = {
  item: PulseFeedItem
  priority?: boolean
  videoActive?: boolean
  onVideoVisible?: (listingKey: string) => void
  onLikeThresholdHit?: () => void
}

function formatPriceFull(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null
  return `$${Math.round(value).toLocaleString('en-US')}`
}

function formatPriceShort(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`
  return `$${Math.round(value).toLocaleString('en-US')}`
}

function formatLikeCount(value: number): string {
  if (value >= 10_000) return `${(value / 1_000).toFixed(0)}K`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return String(value)
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diffMs = Date.now() - then
  if (diffMs < 0) return 'just now'
  const min = Math.floor(diffMs / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const days = Math.floor(hr / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDetailLine(item: PulseFeedItem): string {
  const parts: string[] = []
  if (item.BedroomsTotal != null && Number(item.BedroomsTotal) > 0) {
    parts.push(`${Number(item.BedroomsTotal)} bd`)
  }
  if (item.BathroomsTotal != null && Number(item.BathroomsTotal) > 0) {
    const baths = Number(item.BathroomsTotal)
    parts.push(`${Number.isInteger(baths) ? baths : baths.toFixed(1)} ba`)
  }
  if (item.TotalLivingAreaSqFt != null && Number(item.TotalLivingAreaSqFt) > 0) {
    parts.push(`${Math.round(Number(item.TotalLivingAreaSqFt)).toLocaleString('en-US')} sqft`)
  }
  return parts.join(' · ')
}

function formatLocation(item: PulseFeedItem): string {
  const street = [item.StreetNumber, item.StreetName].filter(Boolean).join(' ').trim()
  const place = [item.SubdivisionName, item.City].filter(Boolean).join(', ')
  if (street && place) return `${street} · ${place}`
  return street || place || ''
}

function attributionText(item: PulseFeedItem): string | null {
  const agent = item.ListAgentName?.trim()
  const office = item.ListOfficeName?.trim()
  if (agent && office) return `Listed by ${agent} · ${office}`
  if (office) return `Listed by ${office}`
  if (agent) return `Listed by ${agent}`
  return null
}

function priceDropDelta(item: PulseFeedItem): { from: number; to: number; deltaPct: number } | null {
  if (item.event_type !== 'price_drop') return null
  const payload = item.payload ?? {}
  const fromRaw = payload.previous_price ?? item.original_list_price
  const toRaw = payload.new_price ?? item.ListPrice
  const from = typeof fromRaw === 'number' ? fromRaw : Number(fromRaw ?? NaN)
  const to = typeof toRaw === 'number' ? toRaw : Number(toRaw ?? NaN)
  if (!Number.isFinite(from) || !Number.isFinite(to) || from <= to || from <= 0) return null
  const deltaPct = ((to - from) / from) * 100
  return { from, to, deltaPct }
}

function soldPrice(item: PulseFeedItem): { list: number | null; close: number | null; deltaPct: number | null } {
  const payload = item.payload ?? {}
  const listRaw = payload.ListPrice ?? item.ListPrice
  const closeRaw = payload.ClosePrice ?? null
  const list = typeof listRaw === 'number' ? listRaw : listRaw != null ? Number(listRaw) : null
  const close = typeof closeRaw === 'number' ? closeRaw : closeRaw != null ? Number(closeRaw) : null
  const deltaPct = list != null && close != null && list > 0 ? ((close - list) / list) * 100 : null
  return { list, close, deltaPct }
}

function socialProofPill(item: PulseFeedItem): string | null {
  switch (item.event_type) {
    case 'status_closed': {
      const s = soldPrice(item)
      if (s.deltaPct != null) {
        const abs = Math.abs(s.deltaPct)
        if (abs < 0.5) return 'Sold at list price'
        return s.deltaPct >= 0 ? `Sold ${abs.toFixed(1)}% over list` : `Sold ${abs.toFixed(1)}% under list`
      }
      return null
    }
    case 'status_pending': {
      const days = item.days_to_pending
      if (days != null && days >= 0) {
        return days === 0 ? 'Pending same day' : days === 1 ? 'Pending in 1 day' : `Pending in ${days} days`
      }
      return null
    }
    case 'price_drop': {
      const drop = priceDropDelta(item)
      if (drop) return `Reduced ${Math.abs(drop.deltaPct).toFixed(1)}%`
      return null
    }
    case 'new_listing': {
      const ago = relativeTime(item.event_at)
      return ago ? `Hit the market ${ago}` : null
    }
    case 'back_on_market':
      return 'Back on the market'
    default:
      return null
  }
}

function eventChip(item: PulseFeedItem): { label: string; tone: 'new' | 'sold' | 'pending' | 'drop' | 'back' } {
  switch (item.event_type) {
    case 'price_drop':
      return { label: 'Price drop', tone: 'drop' }
    case 'status_pending':
      return { label: 'Under contract', tone: 'pending' }
    case 'status_closed':
      return { label: 'Just sold', tone: 'sold' }
    case 'back_on_market':
      return { label: 'Back on market', tone: 'back' }
    case 'new_listing':
    default:
      return { label: 'Just listed', tone: 'new' }
  }
}

const TONE_CHIP: Record<string, string> = {
  new: 'bg-primary text-primary-foreground',
  sold: 'bg-foreground text-background',
  pending: 'bg-amber-600 text-white',
  drop: 'bg-rose-600 text-white',
  back: 'bg-emerald-700 text-white',
}

export default function PulseCard({
  item,
  priority = false,
  videoActive = false,
  onVideoVisible,
  onLikeThresholdHit,
}: Props) {
  const [liked, setLiked] = useState(false)
  const [likeBump, setLikeBump] = useState(0)
  const [shareConfirm, setShareConfirm] = useState(false)
  const [muted, setMuted] = useState(true)
  const [videoFailed, setVideoFailed] = useState(false)
  const [burst, setBurst] = useState<{ x: number; y: number } | null>(null)
  const cardRef = useRef<HTMLElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const lastTapRef = useRef<number>(0)

  const tourUrl = item.virtual_tour_url?.trim() || ''
  const hasInlineVideo = Boolean(tourUrl && DIRECT_VIDEO_PATTERN.test(tourUrl)) && !videoFailed
  const hasExternalTour = Boolean(item.has_virtual_tour && tourUrl && !DIRECT_VIDEO_PATTERN.test(tourUrl))

  // Sync like state from store and subscribe to external changes.
  useEffect(() => {
    setLiked(isLiked(item.listing_key))
    return subscribeLiked((next) => setLiked(next.has(item.listing_key)))
  }, [item.listing_key])

  // Inform the parent which card's video should be active when this card is in view.
  useEffect(() => {
    if (!onVideoVisible || !hasInlineVideo) return
    const el = cardRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > 0.55) {
            onVideoVisible(item.listing_key)
          }
        }
      },
      { threshold: [0, 0.55, 1] }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [item.listing_key, hasInlineVideo, onVideoVisible])

  // Play / pause according to parent-controlled active flag.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (videoActive && hasInlineVideo) {
      video.play().catch(() => undefined)
    } else {
      video.pause()
    }
  }, [videoActive, hasInlineVideo])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = muted
  }, [muted])

  const fireLike = useCallback(
    (origin: { x: number; y: number } | null) => {
      const next = toggleLike(item.listing_key)
      setLiked(next.liked)
      if (next.liked) {
        setLikeBump((n) => n + 1)
        setTimeout(() => setLikeBump(0), 700)
        if (origin) setBurst(origin)
        try {
          if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(8)
        } catch {
          // ignore
        }
        recordLike({
          source: 'listing',
          city: item.City ?? null,
          event_type: item.event_type ?? null,
          price: item.ListPrice ?? null,
        })
        trackEvent('like_listing', {
          listing_key: item.listing_key,
          source: 'pulse_feed',
          event_type: item.event_type,
        })
        const total = getLifetimeLikeCount()
        if (total === SIGNUP_TRIGGER_LIKES) {
          onLikeThresholdHit?.()
        }
      }
    },
    [item.listing_key, item.event_type, item.City, item.ListPrice, onLikeThresholdHit]
  )

  function handleLikeButton(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const rect = cardRef.current?.getBoundingClientRect()
    fireLike(rect ? { x: rect.width / 2, y: rect.height / 2 } : null)
  }

  // Double-tap anywhere on the card → like + burst at tap point. Detects tap pairs within 280ms.
  function handleMediaTap(e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) {
    const now = Date.now()
    const last = lastTapRef.current
    lastTapRef.current = now
    if (now - last > 280) return
    e.preventDefault()
    e.stopPropagation()
    const rect = cardRef.current?.getBoundingClientRect()
    let x = rect ? rect.width / 2 : 0
    let y = rect ? rect.height / 2 : 0
    if ('touches' in e && e.changedTouches && e.changedTouches.length > 0) {
      const t = e.changedTouches[0]
      if (rect) {
        x = t.clientX - rect.left
        y = t.clientY - rect.top
      }
    } else if ('clientX' in e && rect) {
      x = e.clientX - rect.left
      y = e.clientY - rect.top
    }
    if (!isLiked(item.listing_key)) {
      fireLike({ x, y })
    } else {
      // Re-trigger the burst even if already liked, no count change.
      setBurst({ x, y })
    }
  }

  async function handleShare(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (typeof window === 'undefined') return
    const href = listingDetailPath(item.listing_key, undefined, undefined, { mlsNumber: item.ListNumber ?? null })
    const url = `${window.location.origin}${href}`
    const title = location || 'Central Oregon listing'
    setShareConfirm(true)
    setTimeout(() => setShareConfirm(false), 1500)
    trackEvent('share_listing', {
      listing_key: item.listing_key,
      source: 'pulse_feed',
      event_type: item.event_type,
    })
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ url, title, text: 'On the Ryan Realty market pulse.' })
        return
      } catch {
        // fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // ignore
    }
  }

  function handleVideoTap(e: React.MouseEvent<HTMLVideoElement>) {
    e.preventDefault()
    e.stopPropagation()
    setMuted((m) => !m)
  }

  function handleCardLinkClick() {
    trackEvent(hasInlineVideo ? 'play_video' : 'view_listing', {
      listing_key: item.listing_key,
      source: 'pulse_feed',
      event_type: item.event_type,
    })
  }

  const chip = eventChip(item)
  const detailLine = formatDetailLine(item)
  const location = formatLocation(item)
  const timeAgo = relativeTime(item.event_at)
  const drop = priceDropDelta(item)
  const sold = item.event_type === 'status_closed' ? soldPrice(item) : null
  const attribution = attributionText(item)
  const proof = socialProofPill(item)
  const href = listingDetailPath(item.listing_key, undefined, undefined, { mlsNumber: item.ListNumber ?? null })

  const headlinePrice = sold?.close ?? sold?.list ?? drop?.to ?? item.ListPrice ?? null
  const headlineLabel = sold ? 'Sold for' : drop ? 'Now' : null

  return (
    <article
      ref={cardRef}
      className="group relative isolate overflow-hidden rounded-2xl bg-foreground text-background shadow-lg scroll-snap-align-start"
      style={{ scrollSnapAlign: 'start' }}
    >
      <div
        className="relative aspect-[9/16] w-full"
        onClick={handleMediaTap}
        onTouchEnd={handleMediaTap}
        role="button"
        tabIndex={-1}
        aria-label="Double tap to like"
      >
        {hasInlineVideo ? (
          <video
            ref={videoRef}
            src={tourUrl}
            poster={item.PhotoURL ?? undefined}
            muted={muted}
            playsInline
            loop
            preload="metadata"
            onClick={handleVideoTap}
            onError={() => setVideoFailed(true)}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : item.PhotoURL ? (
          <Image
            src={item.PhotoURL}
            alt={location || item.listing_key}
            fill
            priority={priority}
            sizes="(max-width: 640px) 100vw, 540px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
            <span className="text-sm">Photo coming soon</span>
          </div>
        )}

        {/* Top gradient + chips */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-foreground/75 via-foreground/30 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3 sm:p-4">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide shadow-sm',
              TONE_CHIP[chip.tone]
            )}
          >
            {chip.label}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-background/15 px-2.5 py-1 text-[11px] font-medium text-background backdrop-blur">
            {timeAgo}
          </span>
        </div>

        {/* External tour CTA (top-right under time chip) */}
        {hasExternalTour && (
          <a
            href={tourUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="absolute right-3 top-12 inline-flex items-center gap-1 rounded-full bg-background/15 px-2.5 py-1 text-[11px] font-medium text-background backdrop-blur transition hover:bg-background/25"
          >
            <HugeiconsIcon icon={PlayCircleIcon} className="h-3.5 w-3.5" />
            <span>Video tour</span>
          </a>
        )}

        {/* Floating action column — TikTok/Reels style, right edge, vertically centered */}
        <div className="absolute right-3 top-1/2 z-20 flex -translate-y-1/2 flex-col items-center gap-3">
          <button
            type="button"
            onClick={handleLikeButton}
            aria-pressed={liked}
            aria-label={liked ? 'Unlike' : 'Like'}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-background/15 text-background backdrop-blur transition hover:bg-background/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-background/80"
          >
            <HugeiconsIcon
              icon={FavouriteIcon}
              className={cn(
                'h-7 w-7 transition',
                liked ? 'fill-rose-500 text-rose-500' : 'text-background'
              )}
            />
          </button>
          <span
            key={likeBump}
            className={cn(
              'min-w-8 text-center text-xs font-semibold tabular-nums text-background drop-shadow',
              likeBump > 0 && 'motion-safe:animate-[pulseHeartBump_500ms_ease-out_forwards]'
            )}
          >
            Like
          </span>
          <button
            type="button"
            onClick={handleShare}
            aria-label="Share"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-background/15 text-background backdrop-blur transition hover:bg-background/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-background/80"
          >
            <HugeiconsIcon icon={ShareKnowledgeIcon} className="h-6 w-6 text-background" />
          </button>
          <span className="text-xs font-semibold text-background drop-shadow">
            {shareConfirm ? 'Sent' : 'Share'}
          </span>
        </div>

        {/* Inline mute control for autoplay video (bottom-left, above the info overlay) */}
        {hasInlineVideo && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setMuted((m) => !m)
            }}
            aria-label={muted ? 'Unmute video' : 'Mute video'}
            className="absolute bottom-44 left-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-background/15 text-background backdrop-blur transition hover:bg-background/25"
          >
            <HugeiconsIcon icon={muted ? VolumeMute01Icon : VolumeHighIcon} className="h-4 w-4" />
          </button>
        )}

        {/* Bottom gradient + content overlay — tight, single-line where possible */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-foreground/95 via-foreground/45 to-transparent" />
        <Link
          href={href}
          onClick={handleCardLinkClick}
          className="absolute inset-x-0 bottom-0 z-10 block px-4 pb-5 pr-20 pt-10 sm:px-5 sm:pb-6 sm:pr-24 focus:outline-none"
        >
          {headlineLabel && (
            <p className="text-[11px] uppercase tracking-[0.18em] text-background/80">{headlineLabel}</p>
          )}
          <p
            className={cn(
              'font-display leading-none text-background',
              'text-3xl sm:text-4xl'
            )}
            style={{ fontFamily: 'var(--font-amboqia, ui-serif, Georgia, serif)' }}
          >
            {formatPriceFull(headlinePrice) ?? 'Price TBD'}
          </p>
          {drop && (
            <p className="mt-1 flex items-baseline gap-2 text-xs text-background/85">
              <span className="line-through opacity-70">Was {formatPriceShort(drop.from)}</span>
              <span className="rounded-full bg-rose-600 px-2 py-0.5 font-semibold text-white">
                {drop.deltaPct.toFixed(1)}%
              </span>
            </p>
          )}
          {location && (
            <p className="mt-2 text-sm font-medium text-background/95">{location}</p>
          )}
          {proof && (
            <p className="mt-0.5 text-xs text-background/75">{proof}</p>
          )}
          {attribution && (
            <p className="mt-3 text-[10px] font-medium text-background/55">
              {attribution}
            </p>
          )}
        </Link>

        <HeartBurst burst={burst} onComplete={() => setBurst(null)} />
      </div>

      <style jsx global>{`
        @keyframes pulseHeartBump {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
      `}</style>
    </article>
  )
}
