/**
 * MobileHomesTab — §25.7 Homes tab for the mobile Contact Detail
 *
 * Empty state (§25.7.1): house icon + "No Home Searches" + body text, centered.
 * Populated state (§25.7.2): "ACTIVITY" section header + "SEE ALL" + horizontal
 *   scrollable card carousel of property inquiry cards.
 *
 * Property card anatomy (§25.7.2):
 *   photo/placeholder | badge (black pill) | price | address | MLS | view count
 *
 * Server component.
 */

import { Eye, Home } from 'lucide-react'
import type { ViewedListing } from '@/lib/data/crm/getViewedListings'

export interface MobileHomesTabProps {
  listings: ViewedListing[]
}

function formatListingPrice(n: number | null): string {
  if (n == null) return 'Price unavailable'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 3).replace(/\.?0+$/, '')}M`
  return `$${Math.round(n).toLocaleString('en-US')}`
}

export function MobileHomesTab({ listings }: MobileHomesTabProps) {
  /* §25.7.1 Empty state */
  if (listings.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-8 py-20 text-center">
        {/* §25.7.1: outline house, ~80 pt, text-muted-foreground */}
        <Home className="mb-4 text-muted-foreground" size={80} strokeWidth={1.5} />
        <p className="text-[18px] font-semibold text-muted-foreground">No Home Searches</p>
        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
          When your client views or saves properties, you&apos;ll see them here
        </p>
      </div>
    )
  }

  /* §25.7.2 Populated state */
  return (
    <div className="bg-secondary pb-24">
      {/* §25.7.2 Section header + SEE ALL */}
      <div className="flex items-center justify-between bg-secondary px-4 py-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.8px] text-muted-foreground">
          Activity
        </span>
        <span className="text-[13px]" style={{ color: 'var(--console-info)' }}>SEE ALL</span>
      </div>

      {/* §25.7.2 Horizontal card carousel */}
      <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-3 pt-1">
        {listings.map((l) => (
          <div
            key={l.listingKey}
            className="w-[180px] shrink-0 overflow-hidden rounded-xl bg-card shadow-sm"
          >
            {/* Photo zone */}
            <div className="relative h-[120px] bg-secondary">
              {l.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={l.photoUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Home className="text-muted-foreground" size={40} strokeWidth={1.5} />
                </div>
              )}
              {/* §25.7.2: badge — black pill, white text (inquiry type / "Viewed") */}
              <div className="absolute left-2 top-2">
                <span className="rounded-xl bg-foreground px-2 py-0.5 text-[10px] font-semibold text-white">
                  {l.saved ? 'Saved' : 'Viewed'}
                </span>
              </div>
            </div>

            {/* Card body */}
            <div className="px-2.5 py-2">
              {/* Price */}
              <p className="text-[13px] font-semibold text-foreground">
                {formatListingPrice(l.listPrice)}
              </p>
              {/* Address — truncated */}
              <p className="truncate text-[12px] text-muted-foreground">{l.address}</p>
              {/* MLS */}
              <p className="text-[11px] text-muted-foreground">
                {l.listingKey ? `MLS #${l.listingKey}` : 'MLS ID unavailable'}
              </p>
              {/* View count */}
              <div className="mt-1 flex items-center gap-1">
                <Eye size={12} className="text-muted-foreground" strokeWidth={1.75} />
                <span className="text-[11px] text-muted-foreground">
                  {l.views} view{l.views !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>
        ))}

        {/* §25.7.2: right-edge peek affordance — fades to indicate more */}
        <div className="w-4 shrink-0" aria-hidden />
      </div>
    </div>
  )
}
