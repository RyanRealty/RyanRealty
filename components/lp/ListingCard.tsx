/**
 * Shared listing card tile used across every Ryan Realty landing page that
 * surfaces homes (city LP, community LP, neighborhood LP, subdivision LP,
 * search-authority detail pages). One canonical look so a buyer who sees
 * 8 tiles on the Bend page recognizes the same shape on the Tetherow page,
 * the Heath subdivision page, and any future city/community LP.
 *
 * Design (locked 2026-05-19):
 *   - 4/3 aspect photo with status pill top-left + DOM badge top-right
 *   - Playfair price ($1.2M / $850K compact)
 *   - One-line address
 *   - Beds · baths · sqft middot-separated meta
 *   - "Schedule a showing" navy CTA button at the bottom
 *   - Hover lift + drop shadow upgrade
 *
 * Colors reference the design-token CSS custom properties (var(--primary),
 * var(--card), ...) via inline style rather than Tailwind classes, so the
 * card renders correctly in any scope, including Radix portals, while still
 * resolving to the same brand tokens as the rest of the site.
 *
 * Server component — no client-side state. Pass listings in pre-sorted.
 */
import Link from 'next/link'
import { listingDetailPath } from '@/lib/slug'
import { formatPriceCompact } from '@/lib/format/money'
import { statusPillClass } from '@/lib/format/listing-status'

export type ListingCardData = {
  /** Unique key, used for React + the listing detail route. */
  listingKey: string
  /** MLS list number (preferred routing slug). */
  listNumber?: string | null
  /** "65255 Swalley" / "19365 Rim View" — no city. */
  address: string
  city?: string | null
  listPrice: number
  beds?: number | null
  /** Bathrooms may come back from the feed as a string. */
  baths?: number | string | null
  /** Sqft may come back from the feed as a string. */
  sqft?: number | string | null
  photoUrl?: string | null
  /** "Active" | "Pending" | "Active Under Contract" etc. Defaults to no pill. */
  statusLabel?: string | null
  /** Days on market. Hides if null. */
  daysOnMarket?: number | null
  /** Optional subdivision label, shown as fallback when no beds/baths. */
  subdivision?: string | null
}

export interface ListingCardProps {
  listing: ListingCardData
  /** Override the detail-page href. Default: the canonical /homes-for-sale detail URL. */
  href?: string
  /** Override the showing-CTA target. Default: same href + #schedule. */
  scheduleHref?: string
}

/**
 * Canonical public detail URL for a listing card. Uses the real
 * /homes-for-sale/<city>/<address-slug>-<mls> route via listingDetailPath —
 * never the /lp/listings/<id>/ route, which does not exist and 403s.
 */
export function listingCardHref(
  listing: Pick<ListingCardData, 'listingKey' | 'listNumber' | 'address' | 'city' | 'subdivision'>,
): string {
  const addr = (listing.address ?? '').trim()
  const firstSpace = addr.indexOf(' ')
  const streetNumber = firstSpace > 0 ? addr.slice(0, firstSpace) : null
  const streetName = firstSpace > 0 ? addr.slice(firstSpace + 1) : addr || null
  return listingDetailPath(
    listing.listingKey,
    { streetNumber, streetName, city: listing.city ?? null },
    { city: listing.city ?? null, subdivision: listing.subdivision ?? null },
    { mlsNumber: listing.listNumber ?? null },
  )
}

export function ListingCard({ listing, href, scheduleHref }: ListingCardProps) {
  const detailHref = href ?? listingCardHref(listing)
  const ctaHref = scheduleHref ?? `${detailHref}#schedule`

  const facts: string[] = []
  if (listing.beds != null) facts.push(`${listing.beds} bed`)
  if (listing.baths != null && listing.baths !== '') facts.push(`${listing.baths} bath`)
  if (listing.sqft != null && listing.sqft !== '') {
    const sqftNum = Number(listing.sqft)
    if (Number.isFinite(sqftNum) && sqftNum > 0) facts.push(`${sqftNum.toLocaleString()} sqft`)
  }

  return (
    <article
      style={{
        background: 'var(--card)',
        border: '1px solid color-mix(in srgb, var(--v3-navy) 8%, transparent)',
        borderRadius: 16,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 1px 2px color-mix(in srgb, var(--v3-navy) 4%, transparent), 0 6px 18px color-mix(in srgb, var(--v3-navy) 6%, transparent)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        fontFamily: 'Geist, system-ui, sans-serif',
        color: 'var(--primary)',
      }}
      className="rr-listing-card"
    >
      <Link
        href={detailHref}
        style={{
          position: 'relative',
          display: 'block',
          aspectRatio: '4 / 3',
          background: listing.photoUrl
            ? `var(--primary) url('${listing.photoUrl}') center/cover no-repeat`
            : 'color-mix(in srgb, var(--v3-navy) 8%, transparent)',
          textDecoration: 'none',
        }}
        aria-label={`View ${listing.address}`}
      >
        {listing.statusLabel && (
          <span
            className={statusPillClass(listing.statusLabel)}
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              padding: '4px 10px',
              borderRadius: 999,
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            {listing.statusLabel}
          </span>
        )}
        {listing.daysOnMarket != null && (
          <span
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              background: 'rgba(255,255,255,0.95)',
              color: 'var(--primary)',
              padding: '4px 10px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 600,
              boxShadow: '0 2px 4px color-mix(in srgb, var(--v3-navy) 12%, transparent)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {listing.daysOnMarket} days
          </span>
        )}
      </Link>

      <div
        style={{
          padding: '18px 20px 18px',
          display: 'flex',
          flex: 1,
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 24,
            lineHeight: 1.1,
            fontWeight: 500,
            color: 'var(--primary)',
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.01em',
          }}
        >
          {formatPriceCompact(listing.listPrice)}
        </div>
        <Link
          href={detailHref}
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--primary)',
            textDecoration: 'none',
            lineHeight: 1.35,
          }}
        >
          {listing.address}
          {listing.city ? `, ${listing.city}` : null}
        </Link>
        {facts.length > 0 ? (
          <div
            style={{
              fontSize: 13,
              color: 'color-mix(in srgb, var(--v3-navy) 62%, transparent)',
              fontVariantNumeric: 'tabular-nums',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 0,
            }}
          >
            {facts.map((f, i) => (
              <span key={f}>
                {i > 0 ? <span style={{ margin: '0 6px' }}>·</span> : null}
                {f}
              </span>
            ))}
          </div>
        ) : (
          listing.subdivision && (
            <div style={{ fontSize: 13, color: 'color-mix(in srgb, var(--v3-navy) 62%, transparent)' }}>
              {listing.subdivision}
            </div>
          )
        )}
        <Link
          href={ctaHref}
          style={{
            marginTop: 12,
            display: 'block',
            background: 'var(--primary)',
            color: 'var(--primary-foreground)',
            textAlign: 'center',
            padding: '11px 14px',
            borderRadius: 10,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            textDecoration: 'none',
            transition: 'opacity 0.15s ease',
          }}
        >
          Schedule a showing
        </Link>
      </div>
    </article>
  )
}

export default ListingCard
