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
}

export default function SaveListingButton({ listingKey, saved, userEmail, listingUrl, property }: Props) {
  const router = useRouter()

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    const result = await toggleSavedListing(listingKey)
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
