'use client'

/**
 * VideoFeedClient — the continuous, scroll-to-advance video feed Matt asked for:
 * "open in a player, and then a preview of the next video should queue up and
 * allow them to just watch videos." Vertical scroll-snap. The slide in view
 * plays; the next one is already on screen, queued, so the visitor keeps
 * watching home after home.
 *
 * On-brand on purpose (Matt: "/feed looks different than other pages"): navy
 * page, cream type, Amboqia-driven primitives — same shell as the rest of the
 * site, not the old off-brand listings grid.
 *
 * Reuse, not re-roll: every video URL resolves through normalizeEmbed (the same
 * function the listing-detail player + VideoListingCard use), so the host
 * allow-list and CSP frame-src parity (ci:embed-csp-parity) are honored. The
 * active slide mounts an autoplay+muted iframe / video; inactive slides stay a
 * cheap poster until they scroll into view. Never a hand-rolled iframe.
 */
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowRight01Icon, VolumeHighIcon, VolumeMute02Icon } from '@hugeicons/core-free-icons'
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

/** A single video slide. Plays only when `active`; otherwise shows its poster. */
function FeedSlide({
  item,
  active,
  muted,
  onToggleMute,
}: {
  item: VideoFeedItem
  active: boolean
  muted: boolean
  onToggleMute: () => void
}) {
  const norm = normalizeEmbed(item.videoUrl)
  const playable = norm != null && norm.embedType !== 'link'
  // Poster = the MLS listing photo (always an allowed next/image host + shows the
  // actual home). The YouTube thumbnail from normalizeEmbed lives on
  // img.youtube.com, which is not in next.config images — never feed it to Image.
  const poster = item.posterUrl ?? null

  // Mount the player only when this slide is active, so just one video plays.
  const showPlayer = active && playable && norm != null

  // Sound preference rides on the iframe src for YouTube/Vimeo (mute param).
  const iframeSrc =
    norm != null && norm.embedType === 'iframe'
      ? muted
        ? norm.url
        : norm.url.replace(/([?&])mute=1/i, '$1mute=0').replace(/([?&])muted=1/i, '$1muted=0')
      : ''

  const metaBits = [
    fmtInt(item.beds) ? `${fmtInt(item.beds)} bd` : null,
    fmtInt(item.baths) ? `${fmtInt(item.baths)} ba` : null,
    fmtInt(item.sqft) ? `${fmtInt(item.sqft)} sqft` : null,
  ].filter(Boolean)

  // Only youtube/vimeo srcs carry a mute param we can flip; hosted players
  // (aryeo, cloudflare, matterport) have their own controls, so hide the toggle.
  const showMuteToggle =
    showPlayer && norm != null && norm.embedType === 'iframe' && /[?&](mute|muted)=/.test(norm.url)

  return (
    <section className="flex min-h-screen snap-start snap-always items-center justify-center px-4 py-20 sm:px-6">
      <div className="relative w-full max-w-4xl overflow-hidden rounded-2xl bg-primary shadow-lg ring-1 ring-primary-foreground/10">
        <div className="relative aspect-video w-full">
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
            <Image
              src={poster}
              alt={item.addressLine}
              fill
              sizes="(min-width: 896px) 896px, 100vw"
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-primary" />
          )}

          {/* Metadata scrim — only over the poster so it never covers player chrome. */}
          {showPlayer ? null : (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-primary/90 via-primary/40 to-transparent" />
          )}
        </div>

        {/* Caption rail under the video: price, address, quick facts, CTA. */}
        <div className="flex flex-wrap items-end justify-between gap-4 bg-primary px-5 py-4 text-primary-foreground sm:px-6">
          <div className="min-w-0">
            <div className="text-2xl font-bold tabular-nums tracking-tight">{fmtPrice(item.price)}</div>
            <div className="truncate text-sm text-primary-foreground/90">{item.addressLine}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-primary-foreground/70">
              {item.cityLine ? <span>{item.cityLine}</span> : null}
              {item.cityLine && metaBits.length ? <span aria-hidden>·</span> : null}
              {metaBits.length ? <span className="tabular-nums">{metaBits.join(' · ')}</span> : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {showMuteToggle ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onToggleMute}
                className="h-9 gap-1.5 rounded-full bg-primary-foreground/10 px-3 text-xs font-semibold text-primary-foreground ring-1 ring-primary-foreground/25 hover:bg-primary-foreground/20 hover:text-primary-foreground"
                aria-label={muted ? 'Unmute' : 'Mute'}
              >
                <HugeiconsIcon
                  icon={muted ? VolumeMute02Icon : VolumeHighIcon}
                  className="h-4 w-4"
                />
                {muted ? 'Sound off' : 'Sound on'}
              </Button>
            ) : null}
            <Link
              href={item.detailHref}
              className="inline-flex h-9 items-center gap-1 rounded-full bg-primary-foreground px-4 text-xs font-semibold text-primary transition hover:bg-primary-foreground/90"
            >
              View this home
              <HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
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
      className="h-screen snap-y snap-mandatory overflow-y-auto overscroll-contain scroll-smooth bg-primary"
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
            active={idx === activeIndex}
            muted={muted}
            onToggleMute={() => setMuted((m) => !m)}
          />
        </div>
      ))}
    </div>
  )
}
