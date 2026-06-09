'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ListingVideoEmbed } from '@/components/site/listing-detail/ListingVideoEmbed'
import { normalizeEmbed } from '@/lib/video-embed'
import type { ListingCardData } from '@/components/site/ListingCard'
import type { VideoEmbed } from '@/lib/data/types/video'

/**
 * VideoListingCard — a ListingCard that PLAYS the home's tour inline.
 *
 * Renders the listing photo as a poster with a centered play-button overlay
 * plus price / address, in the same visual language as ListingCard
 * (design_system/ryan-realty/ui_kits/website §featured-listings .listing). On
 * click it mounts the existing listing-detail tour player
 * (components/site/listing-detail/ListingVideoEmbed) with the card's tourUrl,
 * so the video plays in-grid as the visitor browses — no navigation needed.
 *
 * Reuse, not re-roll:
 *   - The tour URL is resolved through normalizeEmbed (the SAME function the
 *     listing-detail DAL uses, now in the pure lib/video-embed module), so the
 *     host allow-list + CSP frame-src parity (ci:embed-csp-parity) are honored.
 *     Never a hand-rolled <iframe>.
 *   - When tourUrl is absent, or normalizeEmbed returns null / 'link' (a host
 *     that blocks framing), the card degrades to a plain link to listing detail
 *     so it NEVER shows a broken player.
 *
 * Server-renderable poster: this is a client component, but its default
 * (un-clicked) markup is the poster — it server-renders in the grid for SSR /
 * crawlers and hydrates so the player can mount on click. The player module is
 * NOT mounted until the visitor clicks (lazy — `playing` gates the render).
 */

/** Build a single-element VideoEmbed[] for ListingVideoEmbed from a scalar URL. */
function toEmbed(norm: NonNullable<ReturnType<typeof normalizeEmbed>>, posterUrl?: string | null): VideoEmbed[] {
  return [
    {
      source: 'mls-other',
      embedType: norm.embedType,
      url: norm.url,
      posterUrl: norm.posterUrl ?? posterUrl ?? undefined,
      professional: true,
      isVirtualTour: true,
    },
  ]
}

function formatPrice(n: number | null): string {
  if (n == null) return '—'
  return `$${(Math.round(n / 1000) * 1000).toLocaleString()}`
}

export default function VideoListingCard({ listing }: { listing: ListingCardData }) {
  const [playing, setPlaying] = useState(false)

  // Resolve the tour URL ONCE through the same normalizer the player uses. A
  // null result (no URL) or an 'iframe'/'video-tag' result is playable; a
  // 'link' result means the host blocks framing — fall back to detail rather
  // than render a watch-link inside a card.
  const norm = listing.tourUrl ? normalizeEmbed(listing.tourUrl) : null
  const embeddable = norm != null && norm.embedType !== 'link'

  // Once mounted, hand the resolved URL to the EXISTING listing-detail player.
  if (playing && embeddable && norm) {
    return (
      <div className="bg-card rounded-xl overflow-hidden shadow-sm ring-1 ring-foreground/10">
        <ListingVideoEmbed videos={toEmbed(norm, listing.photoUrl)} variant="tour" className="p-3" />
        <div className="px-4 pb-4 pt-1">
          <div className="text-[22px] font-bold tabular-nums tracking-[-0.01em] text-foreground">
            {formatPrice(listing.price)}
          </div>
          <Link href={listing.href} className="text-[13px] text-foreground hover:text-primary">
            {listing.addressLine}
          </Link>
          <div className="text-xs text-muted-foreground mt-px">{listing.cityLine}</div>
        </div>
      </div>
    )
  }

  // Poster + price/address. The whole tile is a button when embeddable (play
  // inline) and a link to detail otherwise (never a broken player).
  const poster = (
    <>
      <div className="relative aspect-[4/3] bg-muted">
        {listing.photoUrl ? (
          <Image
            src={listing.photoUrl}
            alt={listing.addressLine}
            fill
            className="object-cover transition duration-300 group-hover:scale-[1.02]"
            sizes="(min-width: 1080px) 320px, (min-width: 560px) 50vw, 100vw"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted-foreground/20" />
        )}

        {/* Soft scrim so the play button reads on any photo. */}
        <div className="absolute inset-0 bg-foreground/10 group-hover:bg-foreground/15 transition" />

        {/* Centered play overlay — a triangle in a disc, the universal "this is
            video" affordance (not a static badge). */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-primary shadow-lg transition group-hover:scale-105 group-hover:bg-white">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden className="ml-1">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </div>

        {/* Corner "Video tour" label so the card reads as video even before hover. */}
        <div className="absolute top-2.5 left-2.5">
          <span className="inline-flex items-center rounded-full border border-border bg-white/95 px-2.5 py-0.5 text-[11px] font-medium text-primary">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden className="mr-1 shrink-0">
              <path d="M8 5v14l11-7z" />
            </svg>
            Video tour
          </span>
        </div>
      </div>

      <div className="px-4 pt-3.5 pb-4">
        <div className="text-[22px] font-bold tabular-nums tracking-[-0.01em] text-foreground">
          {formatPrice(listing.price)}
        </div>
        <div className="text-[13px] text-foreground mt-0.5">{listing.addressLine}</div>
        <div className="text-xs text-muted-foreground mt-px">{listing.cityLine}</div>
      </div>
    </>
  )

  if (!embeddable) {
    // No playable tour URL — degrade to a link to listing detail (where the
    // full tour DAL still resolves the video). Never a broken inline player.
    return (
      <Link
        href={listing.href}
        className="group block bg-card rounded-xl overflow-hidden shadow-sm ring-1 ring-foreground/10 hover:ring-primary/30 hover:shadow-md transition"
        aria-label={`View ${listing.addressLine} — ${formatPrice(listing.price)} (opens the listing with its video tour)`}
      >
        {poster}
      </Link>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      className="group block w-full text-left bg-card rounded-xl overflow-hidden shadow-sm ring-1 ring-foreground/10 hover:ring-primary/30 hover:shadow-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      aria-label={`Play the video tour of ${listing.addressLine} — ${formatPrice(listing.price)}`}
    >
      {poster}
    </button>
  )
}
