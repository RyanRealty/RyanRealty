import Link from 'next/link'
import type { ListingDetailListing } from '@/app/actions/listing-detail'
import type { ListingDetailCommunity } from '@/app/actions/listing-detail'
import Badge from '@/components/ui/Badge'

function formatPrice(n: number | null | undefined): string {
  if (n == null) return ''
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function statusVariant(s: string | null | undefined): 'new' | 'pending' | 'sold' | 'trending' {
  if (!s) return 'trending'
  const lower = s.toLowerCase()
  if (lower.includes('active')) return 'new'
  if (lower.includes('pending')) return 'pending'
  if (lower.includes('closed') || lower.includes('sold')) return 'sold'
  return 'trending'
}

type Props = {
  listing: ListingDetailListing
  address: string
  city?: string
  state?: string
  postalCode?: string
  community: ListingDetailCommunity | null
  mlsNumber: string
}

export default function ListingHeader({ listing, address, city, state, postalCode, community, mlsNumber }: Props) {
  const status = listing.standard_status ?? listing.mls_status ?? 'Active'
  const variant = statusVariant(status)
  const isSold = variant === 'sold'
  const price = isSold ? (listing.close_price ?? listing.list_price) : listing.list_price
  const hasPriceDrop =
    listing.original_list_price != null &&
    listing.list_price != null &&
    listing.original_list_price > listing.list_price
  const savings = hasPriceDrop && listing.original_list_price != null && listing.list_price != null
    ? listing.original_list_price - listing.list_price
    : 0
  const cityStateZip = [city, state, postalCode].filter(Boolean).join(', ')
  const baths = listing.baths_full ?? listing.baths_total_integer ?? 0
  const sqft = listing.living_area != null ? Math.round(Number(listing.living_area)) : null
  const lotAcres = listing.lot_size_acres != null ? Number(listing.lot_size_acres) : null
  const year = listing.year_built
  const dom = listing.days_on_market ?? listing.cumulative_days_on_market

  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={variant}>{status}</Badge>
        {dom != null && dom > 0 && (
          <span className="text-sm text-[var(--gray-secondary)]">Days on Market: {dom}</span>
        )}
      </div>
      <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--brand-navy)]" style={{ color: 'var(--brand-navy)' }}>
        {address || 'Property'}
      </h1>
      {cityStateZip && <p className="text-[var(--gray-secondary)]">{cityStateZip}</p>}
      {community && (
        <p>
          <Link
            href={`/communities/${encodeURIComponent(community.slug)}`}
            className="text-[var(--accent)] hover:underline font-medium"
          >
            {community.name}
          </Link>
        </p>
      )}
      <div className="flex flex-wrap items-baseline gap-2">
        <span className={`text-3xl sm:text-4xl font-bold ${isSold ? 'text-[var(--brand-navy)]' : 'text-[var(--accent)]'}`}>
          {formatPrice(price)}
        </span>
        {hasPriceDrop && (
          <>
            <span className="text-xl text-[var(--gray-muted)] line-through">{formatPrice(listing.original_list_price)}</span>
            <Badge variant="price-drop">Price Reduced · {formatPrice(savings)}</Badge>
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--gray-secondary)] border-t border-b border-[var(--gray-border)] py-2">
        <span>{listing.beds_total ?? '—'} Beds</span>
        <span aria-hidden>|</span>
        <span>{baths} Baths</span>
        <span aria-hidden>|</span>
        <span>{sqft != null ? `${sqft} Sq Ft` : '—'}</span>
        {lotAcres != null && lotAcres > 0 && (
          <>
            <span aria-hidden>|</span>
            <span>{lotAcres} Acres</span>
          </>
        )}
        {year != null && (
          <>
            <span aria-hidden>|</span>
            <span>Built {year}</span>
          </>
        )}
      </div>
      {mlsNumber && (
        <p className="text-xs text-[var(--gray-muted)]">MLS# {mlsNumber}</p>
      )}
    </header>
  )
}
