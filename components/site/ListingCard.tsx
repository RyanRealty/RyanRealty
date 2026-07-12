import Link from 'next/link'
import Image from 'next/image'
import { formatPrice } from '@/lib/format/money'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

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
  /** Whole-dollar price per living sqft (list price / sqft). Rendered only when
   *  the card opts in via `showPricePerSqft` — search results show it to match
   *  the search mockup; other surfaces stay on the leaner bd/ba/sqft meta. */
  pricePerSqft?: number | null
  badge?: { kind: ListingBadge; label: string }
  /** Scalar virtual-tour / video URL. When present and embeddable, the
   *  VideoListingCard plays it inline; otherwise the card links to detail. */
  tourUrl?: string | null
}

/** beds · baths · sqft, rendering only the values the listing actually has —
 *  no "— bd · — ba · — sqft" placeholder rows for land / estate parcels whose
 *  MLS record carries no living-area stats. Renders nothing when all are null. */
function MetaRow({
  beds,
  baths,
  sqft,
  pricePerSqft,
}: {
  beds: number | null
  baths: number | null
  sqft: number | null
  pricePerSqft?: number | null
}) {
  const parts: string[] = []
  if (beds != null) parts.push(`${Math.round(beds).toLocaleString()} bd`)
  if (baths != null) parts.push(`${Math.round(baths).toLocaleString()} ba`)
  if (sqft != null) parts.push(`${Math.round(sqft).toLocaleString()} sqft`)
  if (pricePerSqft != null && pricePerSqft > 0) parts.push(`$${Math.round(pricePerSqft).toLocaleString()}/sqft`)
  if (parts.length === 0) return null
  return (
    <div className="mt-2.5 text-xs text-muted-foreground tabular-nums flex flex-wrap gap-1.5 items-center">
      {parts.map((p, i) => (
        <span key={p} className="flex items-center gap-1.5">
          {i > 0 ? <span aria-hidden>·</span> : null}
          <span>{p}</span>
        </span>
      ))}
    </div>
  )
}

const BADGE_CLASS: Record<ListingBadge, string> = {
  hot: 'bg-primary text-primary-foreground',
  new: 'bg-card text-primary border border-border',
  drop: 'bg-primary text-primary-foreground',
  open: 'bg-card text-foreground border border-border',
  sold: 'bg-primary text-primary-foreground',
  video: 'bg-card/95 text-primary border border-border',
}

/** Inline play glyph for the "Video tour" badge. */
function PlayGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden className="mr-1 shrink-0">
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

export default function ListingCard({
  listing,
  showPricePerSqft = false,
}: {
  listing: ListingCardData
  /** Opt-in: append "$X/sqft" to the meta row (search results, per the search
   *  mockup). Off by default so featured/homepage/other grids stay unchanged. */
  showPricePerSqft?: boolean
}) {
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
            <Badge
              className={cn(
                'px-2.5 py-0.5 rounded-full text-[11px] font-medium h-auto',
                BADGE_CLASS[listing.badge.kind],
              )}
            >
              {listing.badge.kind === 'video' ? <PlayGlyph /> : null}
              {listing.badge.label}
            </Badge>
          </div>
        ) : null}

      </div>

      <div className="px-4 pt-3.5 pb-4">
        <div className="text-[22px] font-bold tabular-nums tracking-[-0.01em] text-foreground">
          {formatPrice(listing.price)}
        </div>
        <div className="text-[13px] text-foreground mt-0.5">{listing.addressLine}</div>
        <div className="text-xs text-muted-foreground mt-px">{listing.cityLine}</div>
        <MetaRow
          beds={listing.beds}
          baths={listing.baths}
          sqft={listing.sqft}
          pricePerSqft={showPricePerSqft ? listing.pricePerSqft : null}
        />
      </div>
    </Link>
  )
}
