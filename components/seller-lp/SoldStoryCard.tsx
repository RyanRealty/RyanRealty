'use client'

import Image from 'next/image'
import { useState } from 'react'

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { BrokerSlug, SoldStory } from '@/app/lp/seller-home-value/data'

const HEADSHOT_SRC: Record<BrokerSlug, string> = {
  'ryan-matt': '/images/brokers/ryan-matt.png',
  'stevenson-paul': '/images/brokers/stevenson-paul.png',
  'peterson-rebecca': '/images/brokers/peterson-rebecca.png',
}

const HEADSHOT_ALT: Record<BrokerSlug, string> = {
  'ryan-matt': 'Matt Ryan, principal broker',
  'stevenson-paul': 'Paul Stevenson, broker',
  'peterson-rebecca': 'Rebecca Peterson, broker',
}

// The hard-coded Schoolhouse listing carries displayPrice="$3,000,000" — fine
// for the listings grid, too long for a property-photo pill. Normalize to the
// compact form used elsewhere ("$3M", "$1.23M"). MLS-derived displayPrice
// values already arrive compact ("Sold · $1.72M", "Represented · $2.38M") so
// they pass through unchanged.
function compactDisplayPrice(displayPrice: string): string {
  const fullMatch = /^\$([\d,]+)$/.exec(displayPrice)
  if (!fullMatch) return displayPrice
  const n = Number.parseInt(fullMatch[1].replace(/,/g, ''), 10)
  if (!Number.isFinite(n) || n <= 0) return displayPrice
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    const formatted = m
      .toFixed(m >= 10 ? 0 : m >= 3 ? 1 : 2)
      .replace(/\.?0+$/, '')
    return `$${formatted}M`
  }
  const k = Math.round(n / 1_000)
  return `$${k}K`
}

/**
 * Build a hover-autoplay URL for the listing-tour video. Appends YouTube IFrame
 * API params (autoplay + mute + loop + minimal chrome) — most other providers
 * (Aryeo, etc.) ignore unknown params, so the same URL works as a sane default
 * across the catalog. Falls back to the raw URL if we can't recognize the host.
 */
function buildHoverPreviewUrl(videoUrl: string): string {
  try {
    const u = new URL(videoUrl)
    if (/youtube\.com$/i.test(u.hostname.replace(/^www\./, '')) || u.hostname === 'youtu.be') {
      // Extract video id from /embed/<id> or v=<id>
      let videoId = ''
      const embedMatch = /\/embed\/([^/?#]+)/.exec(u.pathname)
      if (embedMatch) videoId = embedMatch[1]
      if (!videoId) videoId = u.searchParams.get('v') ?? ''
      u.searchParams.set('autoplay', '1')
      u.searchParams.set('mute', '1')
      u.searchParams.set('controls', '0')
      u.searchParams.set('modestbranding', '1')
      u.searchParams.set('rel', '0')
      u.searchParams.set('playsinline', '1')
      if (videoId) {
        u.searchParams.set('loop', '1')
        u.searchParams.set('playlist', videoId)
      }
      return u.toString()
    }
    // Aryeo / framed-visuals + others — pass best-effort autoplay/mute params.
    u.searchParams.set('autoplay', '1')
    u.searchParams.set('mute', '1')
    u.searchParams.set('muted', '1')
    return u.toString()
  } catch {
    return videoUrl
  }
}

export function SoldStoryCard({ story }: { story: SoldStory }) {
  const { listing, testimonial, brokerSlug, brokerFirstName, featured, side } =
    story
  const roleLabel = side === 'buy' ? 'Buyer rep' : 'Marketed by'

  // beds/baths/sqft for the specs line on no-review cards.
  const statBits: string[] = []
  if (listing.beds != null) statBits.push(`${listing.beds} bd`)
  if (listing.baths != null) statBits.push(`${listing.baths} ba`)
  if (listing.sqft != null) statBits.push(`${listing.sqft.toLocaleString()} sqft`)
  const statLine = statBits.join(' · ')

  // Pill is the SAME on every card: address (line 1) + status · price ·
  // neighborhood (line 2). Always over the photo, always left-aligned.
  // `displayPrice` arrives either bare ("$3,000,000" for Schoolhouse) or
  // already prefixed ("Sold · $1.72M"). Strip the prefix so the status word
  // comes from `listing.badge` consistently.
  const stripped = listing.displayPrice.replace(/^[A-Za-z][A-Za-z\s]*·\s*/, '')
  const compactPrice = compactDisplayPrice(stripped)
  // "Currently Listed" reads tightest as just "Listed" in the pill.
  const statusForPill =
    listing.badge === 'Currently Listed' ? 'Listed' : listing.badge

  return (
    <figure className="flex h-full flex-col overflow-hidden rounded-2xl border border-primary/10 bg-card shadow-sm transition-shadow hover:shadow-md">
      <PhotoBlock
        listing={listing}
        featured={featured}
        addressLine={listing.addressLine}
        statusForPill={statusForPill}
        compactPrice={compactPrice}
      />

      {/* Card body — review attribution OR a single horizontal property row.
          No-review cards collapse to one row (headshot + specs + role/name)
          so they don't carry vertical whitespace under the photo. */}
      <div className={featured ? 'p-6 sm:p-7' : 'p-5'}>
        {testimonial ? (
          <ReviewBody
            featured={featured}
            quote={testimonial.pull}
            author={testimonial.author}
            brokerSlug={brokerSlug}
            brokerFirstName={brokerFirstName}
            roleLabel={roleLabel}
          />
        ) : (
          <PropertyRow
            featured={featured}
            statLine={statLine}
            brokerSlug={brokerSlug}
            brokerFirstName={brokerFirstName}
            roleLabel={roleLabel}
          />
        )}
      </div>
    </figure>
  )
}

/**
 * Photo block. If a videoUrl exists, the photo is wrapped in a Dialog trigger
 * with two interaction layers:
 *   - Hover (desktop): swap the still photo for a muted-autoplay iframe so the
 *     visitor sees a preview without leaving the grid. Iframe is conditionally
 *     mounted so it doesn't preload on page load.
 *   - Click / tap: open the full Dialog with controls.
 * If no videoUrl, just render the photo + pill.
 */
function PhotoBlock({
  listing,
  featured,
  addressLine,
  statusForPill,
  compactPrice,
}: {
  listing: SoldStory['listing']
  featured: boolean
  addressLine: string
  statusForPill: string
  compactPrice: string
}) {
  const [hovered, setHovered] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const hasVideo = !!listing.videoUrl
  const aspect = featured ? 'aspect-[16/10]' : 'aspect-[4/3]'

  const photo = (
    <Image
      src={listing.photoUrl}
      alt={`${addressLine}${listing.neighborhood ? `, ${listing.neighborhood}` : ''}`}
      fill
      sizes={
        featured ? '(max-width: 1024px) 100vw, 50vw' : '(max-width: 768px) 100vw, 33vw'
      }
      className="object-cover"
    />
  )

  // Two-line pill, always left-aligned, always present on every card:
  //   Line 1 — address (prominent)
  //   Line 2 — status · price · neighborhood (smaller, muted-on-photo)
  const pill = (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-4 pb-3 pt-12 sm:px-5 sm:pb-4">
      <p
        className={`font-semibold leading-tight tracking-tight text-card ${
          featured ? 'text-lg sm:text-xl' : 'text-base'
        }`}
      >
        {addressLine}
      </p>
      <p
        className={`mt-1 text-card/85 ${featured ? 'text-sm' : 'text-xs'}`}
      >
        {statusForPill} · {compactPrice}
        {listing.neighborhood && (
          <span className="text-card/75"> · {listing.neighborhood}</span>
        )}
      </p>
    </div>
  )

  if (!hasVideo) {
    return (
      <div className={`relative w-full ${aspect}`}>
        {photo}
        {pill}
      </div>
    )
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={`Play listing tour video for ${listing.addressLine}`}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className={`group relative block w-full ${aspect} cursor-pointer overflow-hidden focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/30`}
        >
          {photo}
          {/* Hover-only autoplay preview. Mounted only when hovered so it
              lazy-loads on intent, not on page load. Pointer-events disabled
              so the underlying button click opens the full Dialog. */}
          {hovered && listing.videoUrl && (
            <iframe
              src={buildHoverPreviewUrl(listing.videoUrl)}
              title={`Preview — ${listing.addressLine}`}
              aria-hidden
              tabIndex={-1}
              allow="autoplay; encrypted-media"
              className="pointer-events-none absolute inset-0 h-full w-full border-0 bg-black"
            />
          )}
          {pill}
          {/* Tour badge — small pill in the top-right corner. Subtle, doesn't
              fight the photo. Indicates a video is available without a giant
              centered play disc. */}
          <span
            aria-hidden
            className="pointer-events-none absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white shadow-md ring-1 ring-white/15 backdrop-blur-sm sm:right-4 sm:top-4 sm:gap-1.5 sm:px-3 sm:text-xs"
          >
            <PlayTriangle className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
            Tour
          </span>
        </button>
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="max-w-4xl overflow-hidden border-0 p-0"
      >
        <DialogTitle className="sr-only">
          Listing tour video — {listing.addressLine}
        </DialogTitle>
        {/* Visible close button — white-on-dark so it stays legible against
            any video frame. The default shadcn ghost-variant close is
            transparent and disappears on the iframe. */}
        <DialogClose
          aria-label="Close video"
          className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-white shadow-lg ring-1 ring-white/20 transition-colors hover:bg-black/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <CloseX className="h-5 w-5" />
        </DialogClose>
        {dialogOpen && listing.videoUrl && (
          <iframe
            src={listing.videoUrl}
            title={`Listing tour video for ${listing.addressLine}`}
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            allowFullScreen
            className="aspect-video w-full border-0 bg-black"
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Card body for cards WITHOUT a paired Google review. ONE horizontal row:
 * headshot + specs (bd/ba/sqft) + role/name. No vertical stacking, no top
 * border, no whitespace under the photo. Address lives on the photo pill
 * (always there for every card) so the body doesn't repeat it.
 */
function PropertyRow({
  featured,
  statLine,
  brokerSlug,
  brokerFirstName,
  roleLabel,
}: {
  featured: boolean
  statLine: string
  brokerSlug: BrokerSlug
  brokerFirstName: 'Matt' | 'Paul' | 'Rebecca'
  roleLabel: string
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`relative shrink-0 overflow-hidden rounded-full bg-primary/5 ${
          featured ? 'h-12 w-12' : 'h-10 w-10'
        }`}
        aria-hidden
      >
        <Image
          src={HEADSHOT_SRC[brokerSlug]}
          alt={HEADSHOT_ALT[brokerSlug]}
          fill
          sizes={featured ? '48px' : '40px'}
          className="object-cover object-top"
        />
      </span>
      <div className="min-w-0 grow">
        {statLine && (
          <p
            className={`tabular-nums text-foreground ${
              featured ? 'text-sm sm:text-base' : 'text-sm'
            }`}
          >
            {statLine}
          </p>
        )}
        <p className="mt-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">
          {roleLabel}{' '}
          <span className="font-semibold normal-case tracking-normal text-foreground">
            {brokerFirstName}
          </span>
        </p>
      </div>
    </div>
  )
}

/**
 * Card body for cards WITH a paired Google review. Stars + Google G + quote
 * (Amboqia for featured, Geist medium for compact) + reviewer attribution
 * line + broker headshot row.
 */
function ReviewBody({
  featured,
  quote,
  author,
  brokerSlug,
  brokerFirstName,
  roleLabel,
}: {
  featured: boolean
  quote: string
  author: string
  brokerSlug: BrokerSlug
  brokerFirstName: 'Matt' | 'Paul' | 'Rebecca'
  roleLabel: string
}) {
  return (
    <>
      <div className="flex items-center justify-between">
        <StarRow />
        <GoogleMark className="h-4 w-4 opacity-70" />
      </div>
      <blockquote
        className={`mt-3 ${
          featured
            ? 'font-display text-xl leading-snug text-foreground sm:text-2xl'
            : 'text-base font-medium leading-snug text-foreground sm:text-lg'
        }`}
      >
        &ldquo;{quote}&rdquo;
      </blockquote>
      <figcaption
        className={`flex items-center gap-3 border-t border-primary/10 ${
          featured ? 'mt-5 pt-5' : 'mt-4 pt-4'
        }`}
      >
        <div className="grow">
          <p
            className={`font-semibold text-foreground ${
              featured ? 'text-base' : 'text-sm'
            }`}
          >
            {author}
          </p>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Verified Google review
          </p>
        </div>
        <BrokerHeadshot
          brokerSlug={brokerSlug}
          brokerFirstName={brokerFirstName}
          roleLabel={roleLabel}
          featured={featured}
          inline
        />
      </figcaption>
    </>
  )
}

function BrokerHeadshot({
  brokerSlug,
  brokerFirstName,
  roleLabel,
  featured,
  inline = false,
}: {
  brokerSlug: BrokerSlug
  brokerFirstName: 'Matt' | 'Paul' | 'Rebecca'
  roleLabel: string
  featured: boolean
  /** When true (used inside ReviewBody figcaption), the layout fits beside
   *  other content with a left border. When false, it stands alone as the
   *  attribution row of a no-review card. */
  inline?: boolean
}) {
  return (
    <div className={`flex items-center gap-2 ${inline ? 'border-l border-primary/10 pl-3' : ''}`}>
      <span
        className={`relative overflow-hidden rounded-full bg-primary/5 ${
          featured ? 'h-11 w-11' : 'h-9 w-9'
        }`}
        aria-hidden
      >
        <Image
          src={HEADSHOT_SRC[brokerSlug]}
          alt={HEADSHOT_ALT[brokerSlug]}
          fill
          sizes={featured ? '44px' : '36px'}
          className="object-cover object-top"
        />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {roleLabel}
        </span>
        <span
          className={`font-semibold text-foreground ${
            featured ? 'text-sm' : 'text-xs'
          }`}
        >
          {brokerFirstName}
        </span>
      </span>
    </div>
  )
}

function PlayTriangle({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      fill="currentColor"
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

function CloseX({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  )
}

function StarRow() {
  return (
    <span
      aria-label="Five star rating"
      className="text-base leading-none text-primary"
    >
      {'★★★★★'}
    </span>
  )
}

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Google"
      role="img"
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09A6.97 6.97 0 0 1 5.5 12c0-.72.12-1.42.34-2.09V7.07H2.18A10.97 10.97 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.07.56 4.21 1.64l3.16-3.16C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  )
}
