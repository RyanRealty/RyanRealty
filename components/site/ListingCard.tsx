import Link from 'next/link'
import Image from 'next/image'

/**
 * Site v2 listing card — 4:3 photo on top, badge overlaid, info block below
 * (price, address, city · subdivision, bd/ba/sqft meta). No like/favorite on
 * tiles — liking is detail-page only (Matt directive 2026-06-03).
 * Mirrors design_system/ryan-realty/ui_kits/website/index.html §featured-listings .listing.
 */

export type ListingBadge = 'hot' | 'new' | 'drop' | 'open' | 'sold' | 'video'

export type ListingCardData = {
  listingKey: string
  href: string
  photoUrl?: string | null
  price: number | null
  /** Top line of address (e.g. "2732 NW Ordway Ave"). */
  addressLine: string
  /** City/state/zip + neighborhood (e.g. "Bend, OR 97703 · Awbrey Butte"). */
  cityLine: string
  beds: number | null
  baths: number | null
  sqft: number | null
  badge?: { kind: ListingBadge; label: string }
}

function formatPrice(n: number | null): string {
  if (n == null) return '—'
  // Round to nearest $1k per brand voice
  return `$${(Math.round(n / 1000) * 1000).toLocaleString()}`
}

function formatInt(n: number | null): string {
  return n == null ? '—' : Math.round(n).toLocaleString()
}

const BADGE_CLASS: Record<ListingBadge, string> = {
  hot: 'bg-primary text-white',
  new: 'bg-success text-white',
  drop: 'bg-warning text-[#1a1305]',
  open: 'bg-white text-foreground border border-border',
  sold: 'bg-primary text-white',
  video: 'bg-white/95 text-primary border border-border',
}

/** Inline play glyph for the "Video tour" badge. */
function PlayGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden className="mr-1 shrink-0">
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

export default function ListingCard({ listing }: { listing: ListingCardData }) {
  return (
    <Link
      href={listing.href}
      className="group block bg-card rounded-xl overflow-hidden shadow-sm ring-1 ring-foreground/10 hover:ring-primary/30 hover:shadow-md transition"
    >
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

        {listing.badge ? (
          <div className="absolute top-2.5 left-2.5">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ${BADGE_CLASS[listing.badge.kind]}`}
            >
              {listing.badge.kind === 'video' ? <PlayGlyph /> : null}
              {listing.badge.label}
            </span>
          </div>
        ) : null}

      </div>

      <div className="px-4 pt-3.5 pb-4">
        <div className="text-[22px] font-bold tabular-nums tracking-[-0.01em] text-foreground">
          {formatPrice(listing.price)}
        </div>
        <div className="text-[13px] text-foreground mt-0.5">{listing.addressLine}</div>
        <div className="text-xs text-muted-foreground mt-px">{listing.cityLine}</div>
        <div className="mt-2.5 text-xs text-muted-foreground tabular-nums flex flex-wrap gap-1.5 items-center">
          <span>{formatInt(listing.beds)} bd</span>
          <span aria-hidden>·</span>
          <span>{formatInt(listing.baths)} ba</span>
          <span aria-hidden>·</span>
          <span>{formatInt(listing.sqft)} sqft</span>
        </div>
      </div>
    </Link>
  )
}
