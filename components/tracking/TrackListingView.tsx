'use client'

import { useEffect, useRef } from 'react'
import { trackListingView } from '@/lib/tracking'
import { recordListingView } from '@/app/actions/listing-views'

type Props = {
  listingKey: string
  listingUrl: string
  price?: number
  city?: string
  state?: string
  mlsNumber?: string
  bedrooms?: number
  bathrooms?: number
}

/** Fires listing_view + view_item + Meta ViewContent once when mounted; records view for Trending Homes. */
export default function TrackListingView(props: Props) {
  const done = useRef(false)
  useEffect(() => {
    if (done.current) return
    done.current = true
    trackListingView({
      listingKey: props.listingKey,
      listingUrl: props.listingUrl,
      price: props.price,
      city: props.city,
      state: props.state,
      mlsNumber: props.mlsNumber,
      bedrooms: props.bedrooms,
      bathrooms: props.bathrooms,
    })
    if (props.listingKey && props.city) {
      recordListingView(props.listingKey, props.city).catch(() => {})
    }
    // Recently viewed cookie (for home page row)
    try {
      const name = 'recent_listing_views'
      const max = 15
      const raw = typeof document !== 'undefined' ? document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))?.[2] : null
      let keys: string[] = []
      if (raw) try { keys = JSON.parse(decodeURIComponent(raw)) } catch { keys = [] }
      if (!Array.isArray(keys)) keys = []
      const key = props.listingKey.trim()
      if (key) {
        keys = [key, ...keys.filter((k) => k !== key)].slice(0, max)
        document.cookie = name + '=' + encodeURIComponent(JSON.stringify(keys)) + ';path=/;max-age=2592000;samesite=lax'
      }
    } catch { /* ignore */ }
  }, [props.listingKey, props.listingUrl, props.price, props.city, props.state, props.mlsNumber, props.bedrooms, props.bathrooms])
  return null
}
