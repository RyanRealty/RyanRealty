'use client'

/**
 * VideoFeedClient — the immersive, social-style home-tour feed.
 *
 * Reads like Reels/TikTok, not an embedded box: each slide is full-bleed
 * (100svh), the active video autoplays muted over a blurred fill of its own
 * poster, metadata sits ON the video, and an "Up next" card plus a progress
 * counter make it obvious there is a whole stack to keep scrolling (Matt:
 * "i don't even know there are other videos to watch"). Vertical scroll-snap
 * advances home to home.
 *
 * Reuse, not re-roll: every URL resolves through normalizeEmbed (the same
 * function the listing-detail player + cards use), so the CSP frame-src
 * allow-list (ci:embed-csp-parity) is honored. Only the active slide mounts a
 * player; the rest stay a cheap poster until they scroll into view.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowRight01Icon,
  ArrowUp01Icon,
  ArrowDown01Icon,
  VolumeHighIcon,
  VolumeMute02Icon,
} from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { normalizeEmbed } from '@/lib/video-embed'

export type VideoFeedItem = {
  listingKey: string
  videoUrl: string
  posterUrl: string | null
  price: number | null
  addressLine: string
  cityLine: string
  detailHref: string
  beds: number | null
  baths: number | null
  sqft: number | null
}

function fmtPrice(n: number | null): string {
  if (n == null) return ''
  return `$${(Math.round(n / 1000) * 1000).toLocaleString()}`
}

function fmtInt(n: number | null): string | null {
  if (n == null || Number.isFinite(n) === false) return null
  return Math.round(n).toLocaleString()
}

/** Ensure hosted players that support it autoplay muted, so the active slide is
 *  never a dead black box. YouTube/Vimeo already carry autoplay via normalizeEmbed. */
function withAutoplay(url: string): string {
  const low = url.toLowerCase()
  if (low.includes('cloudflarestream') || low.includes('videodelivery')) {
    if (/autoplay/i.test(url)) return url
    return url + (url.includes('?') ? '&' : '?') + 'autoplay=true&muted=true&loop=true'
  }
  return url
}

/** Flip the mute param for sound on/off (handles youtube mute=1, vimeo muted=1,
 *  cloudflare muted=true). */
function applyMute(url: string, muted: boolean): string {
  if (muted) return url
  return url
    .replace(/([?&]mute)=1/i, '$1=0')
    .replace(/([?&]muted)=1/i, '$1=0')
    .replace(/([?&]muted)=true/i, '$1=false')
}

/** One full-bleed slide. Plays only when `active`; otherwise shows its poster. */
function FeedSlide({
  item,
  nextItem,
  index,
  total,
  active,
  muted,
  onToggleMute,
  onAdvance,
}: {
  item: VideoFeedItem
  nextItem: VideoFeedItem | null
  index: number
  total: number
  active: boolean
  muted: boolean
  onToggleMute: () => void
  onAdvance: () => void
}) {
  const norm = normalizeEmbed(item.videoUrl)
  const playable = norm != null && norm.embedType !== 'link'
  const poster = item.posterUrl ?? null
  const showPlayer = active && playable && norm != null

  const baseSrc = norm != null && norm.embedType === 'iframe' ? withAutoplay(norm.url) : ''
  const iframeSrc = applyMute(baseSrc, muted)
  const showMuteToggle =
    showPlayer && norm != null && norm.embedType === 'iframe' && /[?&](mute|muted)=/.test(iframeSrc)

  const metaBits = [
    fmtInt(item.beds) ? `${fmtInt(item.beds)} bd` : null,
    fmtInt(item.baths) ? `${fmtInt(item.baths)} ba` : null,
    fmtInt(item.sqft) ? `${fmtInt(item.sqft)} sqft` : null,
  ].filter(Boolean)

  return (
    <section
      className="relative w-full snap-start snap-always overflow-hidden bg-primary"
      style={{ height: '100svh' }}
    >
      {/* Blurred fill of the poster so landscape tours look intentional, not letterboxed. */}
      {poster ? (
        <Image
          src={poster}
          alt=""
          fill
          sizes="100vw"
          aria-hidden
          className="scale-110 object-cover opacity-50 blur-2xl"
        />
      ) : null}
      <div className="absolute inset-0 bg-primary/40" aria-hidden />

      {/* The video, centered and as large as the frame allows. */}
      <div className="absolute inset-0 flex items-center justify-center px-0 py-16 sm:px-6">
        <div className="relative aspect-video w-full max-w-5xl overflow-hidden rounded-none bg-primary sm:rounded-2xl sm:shadow-lg sm:ring-1 sm:ring-primary-foreground/10">
          {showPlayer && norm != null && norm.embedType === 'iframe' ? (
            <iframe
              src={iframeSrc}
              title={`Video tour of ${item.addressLine}`}
              loading="eager"
              className="absolute inset-0 h-full w-full"
              allow={[
                'accelerometer',
                'autoplay',
                'clipboard-write',
                'encrypted-media',
                'gyroscope',
                'picture-in-picture',
                'fullscreen',
              ].join(String.fromCharCode(59) + ' ')}
              allowFullScreen
            />
          ) : showPlayer && norm != null && norm.embedType === 'video-tag' ? (
            <video
              src={norm.url}
              poster={poster ?? undefined}
              autoPlay
              muted={muted}
              loop
              playsInline
              controls
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : poster ? (
            <Image src={poster} alt={item.addressLine} fill sizes="(min-width: 1024px) 1024px, 100vw" className="object-cover" />
          ) : (
            <div className="absolute inset-0 bg-primary" />
          )}
        </div>
      </div>

      {/* Bottom gradient so overlaid metadata always reads. */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-primary via-primary/55 to-transparent"
        aria-hidden
      />

      {/* Metadata overlaid on the video, bottom-left (Reels-style). */}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 sm:p-8">
        <div className="min-w-0 flex-1 text-primary-foreground">
          <div className="font-display text-3xl leading-none tabular-nums tracking-tight sm:text-4xl">
            {fmtPrice(item.price)}
          </div>
          <div className="mt-2 truncate text-base font-medium">{item.addressLine}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-primary-foreground/75">
            {item.cityLine ? <span>{item.cityLine}</span> : null}
            {item.cityLine && metaBits.length ? <span aria-hidden>·</span> : null}
            {metaBits.length ? <span className="tabular-nums">{metaBits.join(' · ')}</span> : null}
          </div>
          <Link
            href={item.detailHref}
            className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-full bg-primary-foreground px-5 text-sm font-semibold text-primary transition hover:bg-primary-foreground/90"
          >
            View this home
            <HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4" />
          </Link>
        </div>

        {/* Up next — the explicit "there are more videos" signal. Tap to advance. */}
        {nextItem ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onAdvance}
            className="h-auto shrink-0 flex-col gap-1.5 rounded-2xl bg-primary-foreground/10 p-2.5 text-primary-foreground ring-1 ring-primary-foreground/20 backdrop-blur-sm hover:bg-primary-foreground/20 hover:text-primary-foreground"
            aria-label={`Up next: ${nextItem.addressLine}`}
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-primary-foreground/70">
              Up next
            </span>
            <span className="relative block h-20 w-32 overflow-hidden rounded-lg bg-primary-foreground/10">
              {nextItem.posterUrl ? (
                <Image src={nextItem.posterUrl} alt="" fill sizes="128px" className="object-cover" />
              ) : null}
              <span className="absolute inset-0 flex items-center justify-center bg-primary/30">
                <HugeiconsIcon icon={ArrowUp01Icon} className="h-6 w-6 text-primary-foreground" />
              </span>
            </span>
            <span className="max-w-32 truncate text-xs font-semibold tabular-nums">
              {fmtPrice(nextItem.price)}
            </span>
          </Button>
        ) : null}
      </div>

      {/* Progress + sound, top-right. */}
      <div className="absolute right-4 top-4 flex items-center gap-2 sm:right-6 sm:top-6">
        {showMuteToggle ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onToggleMute}
            className="h-9 w-9 rounded-full bg-primary/50 text-primary-foreground ring-1 ring-primary-foreground/20 backdrop-blur-sm hover:bg-primary/70 hover:text-primary-foreground"
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            <HugeiconsIcon icon={muted ? VolumeMute02Icon : VolumeHighIcon} className="h-4 w-4" />
          </Button>
        ) : null}
        <span className="rounded-lg bg-primary/50 px-3 py-1 text-xs font-semibold tabular-nums text-primary-foreground ring-1 ring-primary-foreground/20 backdrop-blur-sm">
          {index + 1} / {total}
        </span>
      </div>

      {/* Scroll hint, first slide only. */}
      {active && index === 0 && total > 1 ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
          <span className="flex items-center gap-1 rounded-lg bg-primary/45 px-3 py-1 text-xs font-medium text-primary-foreground/85 ring-1 ring-primary-foreground/15 backdrop-blur-sm">
            Scroll for more tours
            <HugeiconsIcon icon={ArrowDown01Icon} className="h-3.5 w-3.5 animate-bounce" />
          </span>
        </div>
      ) : null}
    </section>
  )
}

export function VideoFeedClient({
  items,
  startKey,
}: {
  items: VideoFeedItem[]
  /** Deep-link from a slider card: start the feed on this listing. */
  startKey?: string | null
}) {
  const ordered = (() => {
    if (!startKey) return items
    const idx = items.findIndex((i) => i.listingKey === startKey)
    if (idx <= 0) return items
    return [...items.slice(idx), ...items.slice(0, idx)]
  })()

  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const slideRefs = useRef<(HTMLDivElement | null)[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [muted, setMuted] = useState(true)

  const scrollToIndex = useCallback((idx: number) => {
    const node = slideRefs.current[idx]
    if (node) node.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  // The slide most in view becomes active (plays). One observer over all slides.
  useEffect(() => {
    const root = scrollerRef.current
    if (root == null) return
    const nodes = slideRefs.current.filter(Boolean) as HTMLDivElement[]
    if (nodes.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        let best: { idx: number; ratio: number } | null = null
        for (const entry of entries) {
          const idx = Number((entry.target as HTMLElement).dataset.idx)
          if (best == null || entry.intersectionRatio > best.ratio) {
            best = { idx, ratio: entry.intersectionRatio }
          }
        }
        if (best != null && best.ratio > 0.55) setActiveIndex(best.idx)
      },
      { root, threshold: [0.2, 0.55, 0.8] }
    )
    nodes.forEach((n) => observer.observe(n))
    return () => observer.disconnect()
  }, [ordered.length])

  if (ordered.length === 0) return null

  return (
    <div
      ref={scrollerRef}
      className="snap-y snap-mandatory overflow-y-auto overscroll-contain scroll-smooth bg-primary"
      style={{ height: '100svh' }}
    >
      {ordered.map((item, idx) => (
        <div
          key={item.listingKey}
          data-idx={idx}
          ref={(el) => {
            slideRefs.current[idx] = el
          }}
        >
          <FeedSlide
            item={item}
            nextItem={ordered[idx + 1] ?? null}
            index={idx}
            total={ordered.length}
            active={idx === activeIndex}
            muted={muted}
            onToggleMute={() => setMuted((m) => !m)}
            onAdvance={() => scrollToIndex(idx + 1)}
          />
        </div>
      ))}
    </div>
  )
}
