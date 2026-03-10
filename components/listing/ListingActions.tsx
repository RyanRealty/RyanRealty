'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Button from '@/components/ui/Button'
import ShareButton from '@/components/ShareButton'
import { trackEvent } from '@/lib/tracking'
import { toggleSavedListing } from '@/app/actions/saved-listings'

type Props = {
  listingKey: string
  address: string
  price?: number
  isSaved: boolean
  mlsNumber?: string
  city?: string | null
  beds?: number | null
  baths?: number | null
}

export default function ListingActions({ listingKey, address, price, isSaved, mlsNumber, city, beds, baths }: Props) {
  const router = useRouter()
  const listingUrl =
    typeof window !== 'undefined'
      ? window.location.href
      : `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryanrealty.com'}/listings/${listingKey}`
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
      const returnUrl = encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : `/listings/${listingKey}`)
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

  const handleCompareClick = () => {
    trackEvent('compare_listing', { listing_key: listingKey, listing_url: listingUrl })
    // TODO: add to comparison tray
  }

  const shareTitle = [address, price != null ? `$${price.toLocaleString()}` : ''].filter(Boolean).join(' | ')

  return (
    <>
      {/* Sticky bar - desktop */}
      <div className="sticky top-0 z-30 hidden md:flex flex-wrap items-center gap-2 py-3 bg-[var(--brand-cream)] border-b border-[var(--gray-border)] -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <Button variant="primary" size="md" onClick={handleScheduleTour}>
          Schedule Tour
        </Button>
        <Button variant="secondary" size="md" onClick={handleContactAgent}>
          Contact Agent
        </Button>
        <button
          type="button"
          onClick={handleSaveClick}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--gray-border)] bg-white px-4 py-2 text-sm font-medium text-[var(--brand-navy)] hover:bg-[var(--gray-bg)]"
          aria-label={isSaved ? 'Remove from saved homes' : 'Save to saved homes'}
        >
          {isSaved ? (
            <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 24 24"><path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" /></svg>
          ) : (
            <svg className="h-5 w-5 text-[var(--gray-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
          )}
          <span className="hidden sm:inline">{isSaved ? 'Saved' : 'Save'}</span>
        </button>
        <div onClick={handleShareClick}>
          <ShareButton title={shareTitle} variant="default" className="!rounded-lg !border-[var(--gray-border)] !bg-white !text-[var(--brand-navy)] !px-4 !py-2" />
        </div>
        <button
          type="button"
          onClick={handleCompareClick}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--gray-border)] bg-white px-4 py-2 text-sm font-medium text-[var(--brand-navy)] hover:bg-[var(--gray-bg)]"
          aria-label="Add to compare"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          <span className="hidden sm:inline">Compare</span>
        </button>
      </div>
      {/* Fixed bottom bar - mobile */}
      <div className="fixed bottom-0 left-0 right-0 z-30 flex md:hidden items-center justify-center gap-2 py-3 px-4 bg-white border-t border-[var(--gray-border)] safe-area-pb">
        <Button variant="primary" size="sm" onClick={handleScheduleTour}>
          Schedule Tour
        </Button>
        <Button variant="outline" size="sm" onClick={handleContactAgent}>
          Contact
        </Button>
        <button type="button" onClick={handleSaveClick} className="p-2 rounded-full border border-[var(--gray-border)]" aria-label={isSaved ? 'Unsave' : 'Save'}>
          {isSaved ? <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 24 24"><path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" /></svg> : <svg className="h-5 w-5 text-[var(--gray-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>}
        </button>
        <div onClick={handleShareClick}>
          <ShareButton variant="compact" aria-label="Share" className="!p-2 !rounded-full !border-[var(--gray-border)]" />
        </div>
      </div>
      {/* Spacer so content isn't hidden behind fixed mobile bar */}
      <div className="h-16 md:hidden" aria-hidden />
    </>
  )
}
