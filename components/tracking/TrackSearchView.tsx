'use client'

import { useEffect, useRef } from 'react'
import { trackSearchView } from '@/lib/tracking'

type Props = {
  city?: string
  subdivision?: string
  resultsCount?: number
}

/** Fires search_view + view_search_results + Meta Search once when mounted (search/geo page). */
export default function TrackSearchView(props: Props) {
  const done = useRef(false)
  useEffect(() => {
    if (done.current) return
    done.current = true
    trackSearchView({
      city: props.city,
      subdivision: props.subdivision,
      resultsCount: props.resultsCount,
    })
  }, [props.city, props.subdivision, props.resultsCount])
  return null
}
