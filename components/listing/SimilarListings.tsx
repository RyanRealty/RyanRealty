'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { SimilarListingForDetail } from '@/app/actions/listing-detail'
import { Card, CardContent } from '@/components/ui/card'
import TilesSlider, { TilesSliderItem } from '@/components/TilesSlider'
import { trackEvent } from '@/lib/tracking'

function formatPrice(n: number | null | undefined): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

type Props = {
  listingKey: string
  listings: SimilarListingForDetail[]
}

export default function SimilarListings({ listingKey, listings }: Props) {
  useEffect(() => {
    if (listings.length > 0) {
      trackEvent('view_similar_listings', { listing_key: listingKey, count: listings.length })
    }
  }, [listingKey, listings.length])

  if (listings.length === 0) return null

  return (
    <TilesSlider
      title="Similar Homes"
      titleId="similar-listings-heading"
      className="space-y-4"
    >
      {listings.map((item) => (
        <TilesSliderItem key={item.listing_key}>
          <Link href={`/listing/${encodeURIComponent(item.listing_key)}`} className="block h-full">
            <Card className="overflow-hidden h-full">
              <div className="relative aspect-[4/3] bg-border">
                {item.photo_url ? (
                  <Image
                    src={item.photo_url}
                    alt={`${item.address || 'Similar property'} photo`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 320px, (max-width: 1024px) 360px, 420px"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
                    No photo
                  </div>
                )}
              </div>
              <CardContent className="p-3">
                <p className="font-semibold text-accent-foreground">{formatPrice(item.list_price)}</p>
                <p className="text-sm text-primary mt-1">
                  {item.beds_total ?? '—'} Beds · {item.baths_full ?? '—'} Baths
                  {item.living_area != null ? ` · ${Math.round(Number(item.living_area))} Sq Ft` : ''}
                </p>
                <p className="text-sm text-muted-foreground truncate mt-0.5">{item.address || 'Address TBD'}</p>
                {item.subdivision_name && (
                  <p className="text-xs text-muted-foreground mt-0.5">{item.subdivision_name}</p>
                )}
              </CardContent>
            </Card>
          </Link>
        </TilesSliderItem>
      ))}
    </TilesSlider>
  )
}
