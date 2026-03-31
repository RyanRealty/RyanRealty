'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import SaveListingButton from '@/components/listing/SaveListingButton'
import LikeButton from '@/components/listing/LikeButton'
import ShareButton from '@/components/ShareButton'
import { trackEvent } from '@/lib/tracking'
import { trackCtaClick } from '@/lib/cta-tracking'
import { incrementListingShareCount } from '@/app/actions/engagement'
import { cn } from '@/lib/utils'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'

function formatPrice(n: number | null | undefined): string {
  if (n == null) return ''
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

type Props = {
  listingKey: string
  address: string
  city: string | null
  price: number | null
  beds: number | null
  baths: number | null
  sqft: number | null
  saved: boolean
  liked: boolean
  shareUrl: string
  shareTitle: string
  shareText: string
  userEmail?: string | null
  /** Called when user completes a share (bump share count). */
  onShare?: () => void
  /** Engagement counts for social proof (shown next to icons). */
  viewCount?: number
  likeCount?: number
  saveCount?: number
  shareCount?: number
}

export default function ShowcaseStickyBar({
  listingKey,
  address,
  city,
  price,
  beds,
  baths,
  sqft,
  saved,
  liked,
  shareUrl,
  shareTitle,
  shareText,
  userEmail,
  onShare,
  viewCount = 0,
  likeCount = 0,
  saveCount = 0,
  shareCount = 0,
}: Props) {
  const location = [address, city].filter(Boolean).join(', ')
  const [engagement, setEngagement] = useState({
    viewCount,
    likeCount,
    saveCount,
    shareCount,
  })

  useEffect(() => {
    setEngagement({ viewCount, likeCount, saveCount, shareCount })
  }, [viewCount, likeCount, saveCount, shareCount])

  useEffect(() => {
    let mounted = true
    const supabase = createSupabaseClient()
    const channel = supabase
      .channel(`engagement-sticky-${listingKey}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'engagement_metrics', filter: `listing_key=eq.${listingKey}` },
        (payload: { new?: unknown; old?: unknown }) => {
          const row = (payload.new ?? payload.old ?? {}) as {
            view_count?: number
            like_count?: number
            save_count?: number
            share_count?: number
          }
          if (!mounted) return
          setEngagement({
            viewCount: Math.max(0, Number(row.view_count ?? 0)),
            likeCount: Math.max(0, Number(row.like_count ?? 0)),
            saveCount: Math.max(0, Number(row.save_count ?? 0)),
            shareCount: Math.max(0, Number(row.share_count ?? 0)),
          })
        }
      )
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [listingKey])

  const showEngagement =
    engagement.viewCount > 0 || engagement.likeCount > 0 || engagement.saveCount > 0 || engagement.shareCount > 0
  return (
    <div
      className={cn(
        'sticky top-0 z-20 border-b border-border bg-card/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80'
      )}
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-1">
          {price != null && price > 0 && (
            <p className="text-2xl font-bold tracking-tight text-foreground">{formatPrice(price)}</p>
          )}
          {location && <h1 className="text-sm font-normal text-muted-foreground">{location}</h1>}
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            {beds != null && <span>{beds} bd</span>}
            {baths != null && <span>{baths} ba</span>}
            {sqft != null && sqft > 0 && (
              <span>{Number(sqft).toLocaleString()} sqft</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showEngagement && (
            <span className="mr-1 flex items-center gap-2 text-xs text-muted-foreground" aria-label="Engagement">
              {engagement.viewCount > 0 && <span>{engagement.viewCount} view{engagement.viewCount === 1 ? '' : 's'}</span>}
              {engagement.saveCount > 0 && <span>{engagement.saveCount} saved</span>}
              {engagement.likeCount > 0 && <span>{engagement.likeCount} like{engagement.likeCount === 1 ? '' : 's'}</span>}
              {engagement.shareCount > 0 && <span>{engagement.shareCount} share{engagement.shareCount === 1 ? '' : 's'}</span>}
            </span>
          )}
          <SaveListingButton
            listingKey={listingKey}
            saved={saved}
            userEmail={userEmail ?? undefined}
            listingUrl={typeof window !== 'undefined' ? window.location.href : shareUrl}
            property={{
              street: address || undefined,
              city: city ?? undefined,
              price: price ?? undefined,
              mlsNumber: listingKey,
              bedrooms: beds ?? undefined,
              bathrooms: baths ?? undefined,
            }}
          />
          <LikeButton listingKey={listingKey} liked={liked} variant="compact" className="rounded-full" />
          <ShareButton
            url={shareUrl}
            title={shareTitle}
            text={shareText}
            variant="default"
            trackContext="listing_showcase"
            aria-label="Share this listing"
            onShare={onShare ?? (() => incrementListingShareCount(listingKey))}
            className="rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
          />
          <Button asChild variant="outline" size="default" className="rounded-lg" aria-label="Schedule a tour">
            <Link
              href={`/contact?listing=${encodeURIComponent(listingKey)}&reason=tour`}
              onClick={() => {
                trackEvent('schedule_tour_click', { listing_key: listingKey, listing_url: shareUrl })
                trackCtaClick({
                  label: 'Schedule tour',
                  destination: `/contact?listing=${encodeURIComponent(listingKey)}&reason=tour`,
                  context: `listing_showcase_sticky:${listingKey}`,
                })
              }}
            >
              Schedule tour
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
