import Link from 'next/link'
import type { ListingDetailListing } from '@/app/actions/listing-detail'
import type { ListingDetailCommunity } from '@/app/actions/listing-detail'
import { Badge } from '@/components/ui/badge'

function formatPrice(n: number | null | undefined): string {
  if (n == null) return ''
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function formatDataLastChecked(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(d)
}

function statusVariant(s: string | null | undefined): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (!s) return 'secondary'
  const lower = s.toLowerCase()
  if (lower.includes('active')) return 'default'
  if (lower.includes('pending')) return 'secondary'
  if (lower.includes('closed') || lower.includes('sold')) return 'outline'
  return 'secondary'
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
  const isSold = variant === 'outline'
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
      </div>
      <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">
        {address || 'Property'}
      </h1>
      {cityStateZip && <p className="text-muted-foreground">{cityStateZip}</p>}
      {community && (
        <p>
          <Link
            href={`/communities/${encodeURIComponent(community.slug)}`}
            className="text-accent-foreground hover:underline font-medium"
          >
            {community.name}
          </Link>
        </p>
      )}
      <div className="flex flex-wrap items-baseline gap-2">
        <span className={`text-3xl sm:text-4xl font-bold ${isSold ? 'text-primary' : 'text-accent-foreground'}`}>
          {formatPrice(price)}
        </span>
        {hasPriceDrop && (
          <>
            <span className="text-xl text-muted-foreground line-through">{formatPrice(listing.original_list_price)}</span>
            <Badge variant="destructive">Price Reduced · {formatPrice(savings)}</Badge>
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground border-t border-b border-border py-2">
        <span>{listing.beds_total ?? '—'} Beds</span>
        <span aria-hidden>|</span>
        <span>{baths} Baths</span>
        <span aria-hidden>|</span>
        <span>{sqft != null ? `${sqft} Sq Ft` : '—'}</span>
        {(dom != null && dom >= 0) && (
          <>
            <span aria-hidden>|</span>
            <span>{dom === 0 ? 'New listing' : `${dom} Days on market`}</span>
          </>
        )}
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
      {listing.updated_at && (
        <p className="text-xs text-muted-foreground" title={new Date(listing.updated_at).toLocaleString()}>
          Data last checked: {formatDataLastChecked(listing.updated_at)}
        </p>
      )}
      {mlsNumber && (
        <p className="text-xs text-muted-foreground">MLS# {mlsNumber}</p>
      )}
    </header>
  )
}
