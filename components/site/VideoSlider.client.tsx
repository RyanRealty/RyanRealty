'use client'

/**
 * VideoSlider — a horizontal, scroll-snapping rail of listing-video posters that
 * sits near the top of a page to pull visitors into watching. No giant play
 * button: each card is the listing photo (poster) with a slow Ken-Burns drift on
 * hover and a small corner glyph. Tapping any card drops the visitor into /feed,
 * where the videos keep playing continuously (Matt directive).
 *
 * Most listing videos are third-party iframes (Vimeo / YouTube / Matterport) that
 * cannot be silently auto-previewed, so the rail shows the poster with motion and
 * hands off to the feed on tap. Self-hosted clips can be upgraded to an in-card
 * muted preview later without changing this contract.
 */
import Link from 'next/link'
import Image from 'next/image'
import { HugeiconsIcon } from '@hugeicons/react'
import { PlayCircleIcon, ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { Container, Eyebrow, H2 } from '@/components/site/primitives'

export type VideoSlideItem = {
  listingKey: string
  posterUrl: string | null
  price: number | null
  addressLine: string
  cityLine: string
}

/** Deep-link a card into the continuous feed, starting on this listing. */
function feedStartHref(feedHref: string, listingKey: string): string {
  const sep = feedHref.includes('?') ? '&' : '?'
  return `${feedHref}${sep}start=${encodeURIComponent(listingKey)}`
}

function fmtPrice(n: number | null): string {
  if (n == null) return ''
  return `$${(Math.round(n / 1000) * 1000).toLocaleString()}`
}

export function VideoSlider({
  items,
  eyebrow = 'Video tours',
  title = 'Walk through these homes',
  feedHref = '/feed',
}: {
  items: VideoSlideItem[]
  eyebrow?: string
  title?: string
  /** Where a tapped card sends the visitor — the continuous video feed. */
  feedHref?: string
}) {
  if (!items.length) return null

  return (
    <section className="bg-background py-8 sm:py-10">
      <Container>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <Eyebrow>{eyebrow}</Eyebrow>
            <H2 className="mt-1 text-2xl sm:text-3xl">{title}</H2>
          </div>
          <Link
            href={feedHref}
            className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:underline sm:inline-flex"
          >
            Watch the feed
            <HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4" />
          </Link>
        </div>
      </Container>

      {/* Rail aligned to the container on the left (first card lines up under the
          heading) and bleeding off the right edge as a scroll cue. */}
      <Container>
        <div className="no-scrollbar -mr-4 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 pr-4 sm:-mr-6 sm:pr-6 lg:-mr-8 lg:pr-8">
        {items.map((item) => (
          <Link
            key={item.listingKey}
            href={feedStartHref(feedHref, item.listingKey)}
            className="group relative block w-64 shrink-0 snap-start overflow-hidden rounded-xl bg-muted shadow-sm ring-1 ring-foreground/10 transition hover:shadow-md sm:w-72"
            aria-label={`Watch video tours starting with ${item.addressLine}`}
          >
            <div className="relative aspect-video overflow-hidden">
              {item.posterUrl ? (
                <Image
                  src={item.posterUrl}
                  alt={item.addressLine}
                  fill
                  sizes="(min-width: 640px) 288px, 256px"
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-primary to-muted-foreground/20" />
              )}
              {/* Bottom scrim for legibility + corner play glyph (no giant button). */}
              <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-primary/85 to-transparent" />
              <span className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-background/85 text-primary shadow-sm backdrop-blur-sm">
                <HugeiconsIcon icon={PlayCircleIcon} className="h-5 w-5" />
              </span>
              <div className="absolute inset-x-0 bottom-0 p-3.5 text-primary-foreground">
                <div className="text-lg font-bold tabular-nums tracking-tight drop-shadow">
                  {fmtPrice(item.price)}
                </div>
                <div className="truncate text-sm text-primary-foreground/90">{item.addressLine}</div>
                <div className="truncate text-xs text-primary-foreground/70">{item.cityLine}</div>
              </div>
            </div>
          </Link>
        ))}

        {/* Trailing "see the feed" card */}
        <Link
          href={feedHref}
          className="group flex w-44 shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-secondary/30 p-4 text-center transition hover:bg-secondary/50 sm:w-48"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <HugeiconsIcon icon={ArrowRight01Icon} className="h-6 w-6" />
          </span>
          <span className="text-sm font-semibold text-foreground">Watch the feed</span>
          <span className="text-xs text-muted-foreground">Keep watching tours</span>
        </Link>
        </div>
      </Container>
    </section>
  )
}
