'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import ShareButton from '@/components/ShareButton'
import { BookmarkIcon, HeartIcon as ActionHeartIcon } from '@/components/icons/ActionIcons'
import { trackEvent } from '@/lib/tracking'
import { toggleSavedListing } from '@/app/actions/saved-listings'
import { toggleLikeListing } from '@/app/actions/likes'
import { useComparison } from '@/contexts/ComparisonContext'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeftRightIcon } from '@hugeicons/core-free-icons'

type Props = {
  listingKey: string
  address: string
  price?: number
  isSaved: boolean
  isLiked?: boolean
  mlsNumber?: string
  city?: string | null
  beds?: number | null
  baths?: number | null
  /** Canonical share URL (production). When set, ShareButton uses this instead of current window. */
  shareUrl?: string
  /** Share dialog title (e.g. address + price). */
  shareTitle?: string
  /** Rich share text (summary + hashtags). When set, ShareButton uses this for Twitter/email/native share. */
  shareText?: string
}

export default function ListingActions({ listingKey, address, price, isSaved, isLiked = false, mlsNumber, city, beds, baths, shareUrl: shareUrlProp, shareTitle: shareTitleProp, shareText }: Props) {
  const router = useRouter()
  const [liked, setLiked] = useState(isLiked)
  const [likePending, setLikePending] = useState(false)
  const { isInComparison, addToComparison, removeFromComparison, comparisonItems } = useComparison()
  const inCompare = isInComparison(listingKey)
  useEffect(() => {
    setLiked(isLiked)
  }, [isLiked])
  const listingUrl =
    shareUrlProp ??
    (typeof window !== 'undefined'
      ? window.location.href
      : `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com'}/listing/${listingKey}`)
  const shareTitleForButton = shareTitleProp ?? [address, price != null ? `$${price.toLocaleString()}` : ''].filter(Boolean).join(' | ')
  const property = { street: address, city: city ?? undefined, mlsNumber, price, bedrooms: beds ?? undefined, bathrooms: baths ?? undefined }

  const handleScheduleTour = () => {
    trackEvent('schedule_tour_click', { listing_key: listingKey, listing_url: listingUrl })
    document.getElementById('listing-agent-card')?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleContactAgent = () => {
    trackEvent('contact_agent_click', { listing_key: listingKey, listing_url: listingUrl })
    document.getElementById('listing-agent-card')?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSaveClick = async () => {
    const result = await toggleSavedListing(listingKey)
    if (result.error === 'Not signed in') {
      const returnUrl = encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : `/listing/${listingKey}`)
      window.location.href = `/account?signin=1&returnUrl=${returnUrl}`
      return
    }
    if (result.saved) {
      trackEvent('save_listing', { listing_key: listingKey, listing_url: listingUrl, value: price })
    }
    router.refresh()
  }

  const handleShareClick = () => {
    trackEvent('share_listing', { listing_key: listingKey, listing_url: listingUrl })
  }

  const handleCompareToggle = () => {
    if (inCompare) {
      removeFromComparison(listingKey)
      trackEvent('compare_remove', { listing_key: listingKey })
    } else {
      addToComparison(listingKey)
      trackEvent('compare_add', { listing_key: listingKey })
    }
  }

  const handleLikeClick = async () => {
    const result = await toggleLikeListing(listingKey)
    if (result.error === 'Not signed in') {
      const returnUrl = encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : `/listing/${listingKey}`)
      window.location.href = `/account?signin=1&returnUrl=${returnUrl}`
      return
    }
    if (result.error == null) setLiked(result.liked)
    router.refresh()
  }

  return (
    <>
      {/* Sticky bar - desktop */}
      <div className="sticky top-0 z-30 hidden md:flex flex-wrap items-center gap-2 py-3 bg-muted border-b border-border -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <Button variant="default" size="default" onClick={handleScheduleTour}>
          Schedule Tour
        </Button>
        <Button variant="secondary" size="default" onClick={handleContactAgent}>
          Contact Agent
        </Button>
        <Button
          type="button"
          onClick={handleSaveClick}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          aria-label={isSaved ? 'Remove from saved homes' : 'Save to saved homes'}
        >
          <BookmarkIcon filled={isSaved} className={`h-5 w-5 flex-shrink-0 ${isSaved ? 'text-primary' : 'text-muted-foreground'}`} />
          <span className="hidden sm:inline">{isSaved ? 'Saved' : 'Save home'}</span>
        </Button>
        <Button
          type="button"
          onClick={handleLikeClick}
          disabled={likePending}
          className={`inline-flex items-center gap-2 rounded-lg border bg-card px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60 ${liked ? 'border-destructive/60 text-destructive' : 'border-border text-foreground'}`}
          aria-label={liked ? 'Unlike' : 'Like'}
        >
          <ActionHeartIcon filled={liked} className="h-5 w-5 flex-shrink-0" />
          <span className="hidden sm:inline">Like</span>
        </Button>
        <div onClick={handleShareClick}>
          <ShareButton url={listingUrl} title={shareTitleForButton} text={shareText ?? shareTitleForButton} variant="default" trackContext="listing_detail" className="!rounded-lg !border-border !bg-card !text-primary !px-4 !py-2" />
        </div>
        <Button
          type="button"
          onClick={handleCompareToggle}
          disabled={!inCompare && comparisonItems.length >= 4}
          className={[
            'inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
            inCompare
              ? 'border-accent bg-accent/10 text-foreground'
              : 'border-border bg-card text-foreground hover:bg-muted',
            'disabled:opacity-50',
          ].join(' ')}
          aria-label={inCompare ? 'Remove from comparison' : 'Add to comparison'}
        >
          <HugeiconsIcon icon={ArrowLeftRightIcon} className="h-5 w-5 flex-shrink-0" />
          <span className="hidden sm:inline">{inCompare ? 'Comparing' : 'Compare'}</span>
        </Button>
      </div>
      {/* Fixed bottom bar - mobile */}
      <div className="fixed bottom-0 left-0 right-0 z-30 flex md:hidden items-center justify-center gap-2 py-3 px-4 bg-card border-t border-border safe-area-pb">
        <Button variant="default" size="sm" onClick={handleScheduleTour}>
          Schedule Tour
        </Button>
        <Button variant="outline" size="sm" onClick={handleContactAgent}>
          Contact
        </Button>
        <Button type="button" onClick={handleSaveClick} className="p-2 rounded-full border border-border" aria-label={isSaved ? 'Unsave' : 'Save'}>
          <BookmarkIcon filled={isSaved} className={`h-5 w-5 ${isSaved ? 'text-primary' : 'text-muted-foreground'}`} />
        </Button>
        <Button type="button" onClick={handleLikeClick} disabled={likePending} className="p-2 rounded-full border border-border" aria-label={liked ? 'Unlike' : 'Like'}>
          <ActionHeartIcon filled={liked} className={`h-5 w-5 ${liked ? 'text-destructive' : 'text-muted-foreground'}`} />
        </Button>
        <div onClick={handleShareClick}>
          <ShareButton url={listingUrl} title={shareTitleForButton} text={shareText ?? shareTitleForButton} variant="compact" aria-label="Share" trackContext="listing_detail" className="!p-2 !rounded-full !border-border" />
        </div>
        <Button
          type="button"
          onClick={handleCompareToggle}
          disabled={!inCompare && comparisonItems.length >= 4}
          className={[
            'p-2 rounded-full border transition-colors disabled:opacity-50',
            inCompare
              ? 'border-accent bg-accent/10'
              : 'border-border',
          ].join(' ')}
          aria-label={inCompare ? 'Remove from comparison' : 'Compare'}
        >
          <HugeiconsIcon icon={ArrowLeftRightIcon} className={`h-5 w-5 ${inCompare ? 'text-accent-foreground' : 'text-muted-foreground'}`} />
        </Button>
      </div>
      {/* Spacer so content isn't hidden behind fixed mobile bar */}
      <div className="h-16 md:hidden" aria-hidden />
    </>
  )
}
