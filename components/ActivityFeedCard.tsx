'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { toggleSavedListing } from '../app/actions/saved-listings'
import { BookmarkIcon } from '@/components/icons/ActionIcons'
import { trackListingTileClick } from '../app/actions/track-listing-click'
import { trackSavedPropertyAction } from '../app/actions/track-saved-property'
import type { ActivityFeedItem } from '../app/actions/activity-feed'
import { Button } from "@/components/ui/button"

function eventBadge(type: ActivityFeedItem['event_type']): { label: string; className: string } {
  switch (type) {
    case 'new_listing':
      return { label: 'New', className: 'bg-success' }
    case 'price_drop':
      return { label: 'Price drop', className: 'bg-warning' }
    case 'status_pending':
      return { label: 'Under contract', className: 'bg-warning' }
    case 'status_closed':
      return { label: 'Just sold', className: 'bg-muted-foreground' }
    default:
      return { label: '', className: '' }
  }
}

function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n < 0) return ''
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

type Props = {
  item: ActivityFeedItem
  saved?: boolean
  signedIn?: boolean
  userEmail?: string | null
}

export default function ActivityFeedCard({ item, saved = false, signedIn = false, userEmail }: Props) {
  const router = useRouter()
  const listingHref = `/listing/${encodeURIComponent(item.listing_key)}`
  const address = [item.StreetNumber, item.StreetName].filter(Boolean).join(' ')
  const badge = eventBadge(item.event_type)
  const price = item.ListPrice != null ? Number(item.ListPrice) : 0

  async function handleToggleSave(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const result = await toggleSavedListing(item.listing_key)
    if (result.saved && userEmail && typeof window !== 'undefined') {
      trackSavedPropertyAction({
        userEmail,
        listingKey: item.listing_key,
        listingUrl: `${window.location.origin}${listingHref}`,
        sourcePage: window.location.href,
        property: { street: address || undefined, city: item.City ?? undefined },
      }).catch(() => {})
    }
    router.refresh()
  }

  function handleClick() {
    if (userEmail) {
      trackListingTileClick({
        userEmail,
        listingKey: item.listing_key,
        listingUrl: typeof window !== 'undefined' ? `${window.location.origin}${listingHref}` : listingHref,
        sourcePage: typeof window !== 'undefined' ? window.location.href : '',
        property: {
          street: address || undefined,
          city: item.City ?? undefined,
          mlsNumber: item.listing_key,
          price: item.ListPrice != null ? Number(item.ListPrice) : undefined,
        },
      }).catch(() => {})
    }
  }

  return (
    <Link
      href={listingHref}
      onClick={handleClick}
      className="group relative block overflow-hidden rounded-xl bg-border shadow-md transition hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
    >
      {/* 4:5 on mobile; full-bleed image */}
      <div className="aspect-[4/5] w-full sm:aspect-[3/4]">
        {item.PhotoURL ? (
          <Image
            src={item.PhotoURL}
            alt={address || item.listing_key}
            fill
            className="object-cover transition group-hover:scale-[1.02]"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
            <span className="text-sm">No photo</span>
          </div>
        )}
        {badge.label && (
          <span className={`absolute left-2 top-2 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white ${badge.className}`}>
            {badge.label}
          </span>
        )}
        {signedIn && (
          <Button
            type="button"
            onClick={handleToggleSave}
            className="absolute right-2 top-2 rounded-full bg-card/90 p-2 shadow hover:bg-card"
            aria-label={saved ? 'Unsave' : 'Save'}
          >
            {saved ? (
              <BookmarkIcon filled className="h-5 w-5 text-primary" />
            ) : (
              <BookmarkIcon filled={false} className="h-5 w-5 text-muted-foreground" />
            )}
          </Button>
        )}
        {/* Stats overlay at bottom */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-8">
          <p className="font-semibold text-white">{formatPrice(price) || 'Price TBD'}</p>
          <p className="mt-0.5 flex items-center gap-2 text-sm text-white/90">
            {[item.BedroomsTotal, item.BathroomsTotal].filter(Boolean).length > 0 && (
              <span>{[item.BedroomsTotal, item.BathroomsTotal].filter(Boolean).join(' / ')}</span>
            )}
            {(item.City ?? item.SubdivisionName) && (
              <span> · {[item.SubdivisionName, item.City].filter(Boolean).join(', ')}</span>
            )}
          </p>
        </div>
      </div>
    </Link>
  )
}
