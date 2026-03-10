'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { SimilarListingForDetail } from '@/app/actions/listing-detail'
import Card, { CardContent } from '@/components/ui/Card'
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
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-[var(--brand-navy)]">Similar Homes</h2>
      <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {listings.map((item) => (
          <Link
            key={item.listing_key}
            href={`/listings/${encodeURIComponent(item.listing_key)}`}
            className="flex-shrink-0 w-[280px]"
          >
            <Card className="overflow-hidden h-full">
              <div className="relative aspect-[4/3] bg-[var(--gray-border)]">
                {item.photo_url ? (
                  <Image
                    src={item.photo_url}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="280px"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-[var(--gray-muted)] text-sm">
                    No photo
                  </div>
                )}
              </div>
              <CardContent className="p-3">
                <p className="font-semibold text-[var(--accent)]">{formatPrice(item.list_price)}</p>
                <p className="text-sm text-[var(--brand-navy)] mt-1">
                  {item.beds_total ?? '—'} Beds · {item.baths_full ?? '—'} Baths
                  {item.living_area != null ? ` · ${Math.round(Number(item.living_area))} Sq Ft` : ''}
                </p>
                <p className="text-sm text-[var(--gray-secondary)] truncate mt-0.5">{item.address || 'Address TBD'}</p>
                {item.subdivision_name && (
                  <p className="text-xs text-[var(--gray-muted)] mt-0.5">{item.subdivision_name}</p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  )
}
