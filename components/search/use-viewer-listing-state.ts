'use client'

/**
 * Client hydration for the per-visitor listing state (signed-in, saved,
 * liked). Seeded from whatever the server rendered (place pages render the
 * signed-out shell so their HTML is visitor-independent and CDN-cacheable);
 * one action round trip corrects it after mount. A fetch failure keeps the
 * seed — the page works signed-out rather than breaking.
 */

import { useEffect, useState } from 'react'
import { getViewerListingState, type ViewerListingState } from '@/app/actions/viewer-listing-state'

export function useViewerListingState(seed?: Partial<ViewerListingState>): ViewerListingState {
  const [state, setState] = useState<ViewerListingState>({
    signedIn: seed?.signedIn ?? false,
    savedListingKeys: seed?.savedListingKeys ?? [],
    likedListingKeys: seed?.likedListingKeys ?? [],
  })
  useEffect(() => {
    let active = true
    getViewerListingState()
      .then((next) => {
        if (active) setState(next)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])
  return state
}
