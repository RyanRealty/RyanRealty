'use client'

import { useRouter } from 'next/navigation'
import { toggleSavedListing } from '../../app/actions/saved-listings'
import { trackSavedPropertyAction } from '../../app/actions/track-saved-property'
import { trackSaveListing } from '@/lib/tracking'
import { BookmarkIcon } from '@/components/icons/ActionIcons'
import { Button } from "@/components/ui/button"

type Props = {
  listingKey: string
  saved: boolean
  /** When provided, FUB "Saved Property" is sent on save (detail page). */
  userEmail?: string | null
  listingUrl?: string
  property?: { street?: string; city?: string; state?: string; mlsNumber?: string; price?: number; bedrooms?: number; bathrooms?: number }
  /** Icon-only round badge for a result-card photo corner (search/map cards). */
  compact?: boolean
  className?: string
}

export default function SaveListingButton({
  listingKey,
  saved,
  userEmail,
  listingUrl,
  property,
  compact = false,
  className,
}: Props) {
  const router = useRouter()

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    const result = await toggleSavedListing(listingKey)
    if (result.error === 'Not signed in') {
      // Route anonymous savers to sign-in (and back) — mirrors ListingActions —
      // so the save -> account-creation lead-capture path isn't silently lost.
      const returnUrl = encodeURIComponent(
        typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/',
      )
      if (typeof window !== 'undefined') {
        window.location.href = `/account?signin=1&returnUrl=${returnUrl}`
      }
      return
    }
    if (result.saved) {
      if (userEmail && listingUrl && property) {
        trackSavedPropertyAction({
          userEmail,
          listingKey,
          listingUrl,
          sourcePage: typeof window !== 'undefined' ? window.location.href : undefined,
          property,
        })
      }
      if (listingUrl) {
        trackSaveListing({
          listingKey,
          listingUrl,
          price: property?.price,
          mlsNumber: property?.mlsNumber ?? listingKey,
        })
      }
    }
    router.refresh()
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={
          className ??
          'inline-flex h-8 w-8 items-center justify-center rounded-full bg-card/90 shadow-sm hover:bg-card'
        }
        aria-label={saved ? 'Remove from saved homes' : 'Save to saved homes'}
        aria-pressed={saved}
      >
        <BookmarkIcon filled={saved} className={saved ? 'h-4 w-4 text-primary' : 'h-4 w-4 text-muted-foreground'} />
      </button>
    )
  }

  return (
    <Button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm hover:bg-muted"
      aria-label={saved ? 'Remove from saved homes' : 'Save to saved homes'}
    >
      {saved ? (
        <>
          <BookmarkIcon filled className="h-5 w-5 text-primary" />
          Saved
        </>
      ) : (
        <>
          <BookmarkIcon filled={false} className="h-5 w-5 text-muted-foreground" />
          Save home
        </>
      )}
    </Button>
  )
}
