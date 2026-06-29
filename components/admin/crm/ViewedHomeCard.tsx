/**
 * FUB-clone property card for the contact-360 Homes tab. Renders one home the
 * lead is shopping as a vertical card — photo with an activity badge overlay,
 * price + live MLS status, beds/baths, linked address, MLS#, and view count —
 * matching the Follow Up Boss iOS Homes tab (screen ui1_5835).
 *
 * Honesty note (§0): FUB's badge reads "Property Inquiry" off a lead-form
 * submission. We track on-site views + saves, so the badge reflects what we
 * actually know ("Saved" / "Viewed") rather than asserting an inquiry. Price and
 * status come live from listing_tile_mv via getViewedListingsForLead.
 */
import Link from 'next/link'
import { Eye } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ListingStatusPill } from '@/components/console/StatusPill'
import type { ViewedListing } from '@/lib/data/crm/getViewedListings'

function usd(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return 'Price n/a'
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function bath(n: number | null): string | null {
  if (n === null || !Number.isFinite(n)) return null
  return Number.isInteger(n) ? `${n} ba` : `${n.toFixed(1)} ba`
}

export default function ViewedHomeCard({ home }: { home: ViewedListing }) {
  const beds = home.beds !== null && Number.isFinite(home.beds) ? `${home.beds} bd` : null
  const baths = bath(home.baths)
  const specs = [beds, baths].filter(Boolean).join(' · ')
  const badge = home.saved ? 'Saved' : 'Viewed'

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="relative">
        {home.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={home.photoUrl} alt={home.address} className="aspect-video w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center bg-muted text-sm text-muted-foreground">No photo</div>
        )}
        <Badge className="absolute left-2 top-2">{badge}</Badge>
      </div>
      <div className="space-y-1 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-lg font-semibold tabular-nums text-foreground">{usd(home.listPrice)}</span>
          <ListingStatusPill status={home.status} />
        </div>
        {specs ? <div className="text-sm text-muted-foreground">{specs}</div> : null}
        {home.listingKey ? (
          <Link href={`/listing/${home.listingKey}`} className="block truncate text-sm font-medium text-foreground hover:underline">
            {home.address}
            {home.city ? `, ${home.city}` : ''}
          </Link>
        ) : (
          <div className="truncate text-sm font-medium text-foreground">{home.address}</div>
        )}
        <div className="text-xs font-medium text-muted-foreground">MLS #{home.listingKey}</div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Eye className="h-3.5 w-3.5" aria-hidden />
          {home.views} view{home.views === 1 ? '' : 's'}
        </div>
      </div>
    </div>
  )
}
