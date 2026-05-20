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
 * Colors use literal hex (no CSS vars) so the card renders correctly in any
 * scope, including Radix portals.
 *
 * Server component — no client-side state. Pass listings in pre-sorted.
 */
import Link from 'next/link'

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
  /** Override the detail-page href. Default: /lp/listings/<listNumber|listingKey>/ */
  href?: string
  /** Override the showing-CTA target. Default: same href + #schedule. */
  scheduleHref?: string
}

function fmtUsd(n: number, opts: { compact?: boolean } = {}): string {
  if (!Number.isFinite(n)) return '—'
  if (opts.compact) {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)}M`
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
    return `$${n.toFixed(0)}`
  }
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}

function statusPillStyle(label: string): { bg: string; text: string } {
  const lower = label.toLowerCase()
  if (lower.includes('pending')) return { bg: '#b8860b', text: '#faf8f4' }
  if (lower.includes('contract')) return { bg: '#8b4513', text: '#faf8f4' }
  if (lower.includes('closed') || lower.includes('sold')) return { bg: '#5d6470', text: '#faf8f4' }
  return { bg: '#102742', text: '#faf8f4' }
}

export function ListingCard({ listing, href, scheduleHref }: ListingCardProps) {
  const detailHref =
    href ??
    `/lp/listings/${encodeURIComponent(listing.listNumber ?? listing.listingKey)}/`
  const ctaHref = scheduleHref ?? `${detailHref}#schedule`

  const facts: string[] = []
  if (listing.beds != null) facts.push(`${listing.beds} bed`)
  if (listing.baths != null && listing.baths !== '') facts.push(`${listing.baths} bath`)
  if (listing.sqft != null && listing.sqft !== '') {
    const sqftNum = Number(listing.sqft)
    if (Number.isFinite(sqftNum) && sqftNum > 0) facts.push(`${sqftNum.toLocaleString()} sqft`)
  }

  const pill = listing.statusLabel ? statusPillStyle(listing.statusLabel) : null

  return (
    <article
      style={{
        background: '#ffffff',
        border: '1px solid rgba(16,39,66,0.08)',
        borderRadius: 16,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 1px 2px rgba(16,39,66,0.04), 0 6px 18px rgba(16,39,66,0.06)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        fontFamily: 'Geist, system-ui, sans-serif',
        color: '#102742',
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
            ? `#102742 url('${listing.photoUrl}') center/cover no-repeat`
            : 'rgba(16,39,66,0.08)',
          textDecoration: 'none',
        }}
        aria-label={`View ${listing.address}`}
      >
        {pill && listing.statusLabel && (
          <span
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              background: pill.bg,
              color: pill.text,
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
              color: '#102742',
              padding: '4px 10px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 600,
              boxShadow: '0 2px 4px rgba(16,39,66,0.12)',
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
            color: '#102742',
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.01em',
          }}
        >
          {fmtUsd(listing.listPrice, { compact: listing.listPrice >= 1_000_000 })}
        </div>
        <Link
          href={detailHref}
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: '#102742',
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
              color: 'rgba(16,39,66,0.62)',
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
            <div style={{ fontSize: 13, color: 'rgba(16,39,66,0.62)' }}>
              {listing.subdivision}
            </div>
          )
        )}
        <Link
          href={ctaHref}
          style={{
            marginTop: 12,
            display: 'block',
            background: '#102742',
            color: '#faf8f4',
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
