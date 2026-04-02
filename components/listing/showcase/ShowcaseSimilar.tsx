'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { trackEvent } from '@/lib/tracking'
import { listingDetailPath } from '@/lib/slug'

type Similar = {
  listing_key: string
  list_price: number | null
  beds_total: number | null
  baths_full: number | null
  living_area: number | null
  subdivision_name: string | null
  address: string
  photo_url: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
}

type Props = {
  listingKey: string
  listings: Similar[]
  /** Override section title. Default: "Similar homes" */
  title?: string
}

function formatPrice(n: number | null | undefined): string {
  if (n == null) return ''
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export default function ShowcaseSimilar({ listingKey, listings, title = 'Similar homes' }: Props) {
  useEffect(() => {
    if (listings.length > 0) {
      trackEvent('view_similar_listings', { listing_key: listingKey, count: listings.length })
    }
  }, [listingKey, listings.length])

  if (listings.length === 0) return null

  return (
    <section className="mt-12" aria-labelledby="similar-heading">
      <h2 id="similar-heading" className="mb-6 text-xl font-semibold text-foreground">
        {title}
      </h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((item) => (
          <Link
            key={item.listing_key}
            href={listingDetailPath(item.listing_key, { city: item.city, state: item.state, postalCode: item.postal_code })}
            className="group focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg"
          >
            <Card className="overflow-hidden border-border bg-card transition-shadow group-hover:shadow-md">
              <div className="relative aspect-[4/3] bg-muted">
                {item.photo_url ? (
                  <Image
                    src={item.photo_url}
                    alt=""
                    fill
                    sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">No photo</div>
                )}
              </div>
              <CardContent className="p-4">
                <p className="font-semibold text-foreground">{formatPrice(item.list_price)}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {[item.beds_total != null && `${item.beds_total} bd`, item.baths_full != null && `${item.baths_full} ba`, item.living_area != null && `${Number(item.living_area).toLocaleString()} sqft`]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {item.address && (
                  <p className="mt-1 truncate text-sm text-muted-foreground">{item.address}</p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  )
}
