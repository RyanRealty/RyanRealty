'use server'

/**
 * Viewer listing state — the per-visitor bits a search/place surface needs
 * (signed-in, saved keys, liked keys) in ONE round trip, fetched from the
 * CLIENT after hydration.
 *
 * Why this exists (2026-09-01): PlaceSplitView read these during server
 * render, which put cookies() inside every place page's shell — the read that
 * made every place route per-request dynamic (and, on the plat route's ISR
 * config, served a production-wide DYNAMIC_SERVER_USAGE 500 for seven weeks).
 * The shell now renders visitor-independent HTML and this action hydrates the
 * personal layer, the same pattern SignInPromptWithSession and the hidden-key
 * fetch already use.
 */

import { getSession } from '@/app/actions/auth'
import { getSavedListingKeys } from '@/app/actions/saved-listings'
import { getLikedListingKeys } from '@/app/actions/likes'

export type ViewerListingState = {
  signedIn: boolean
  savedListingKeys: string[]
  likedListingKeys: string[]
}

export async function getViewerListingState(): Promise<ViewerListingState> {
  const session = await getSession()
  if (!session?.user) return { signedIn: false, savedListingKeys: [], likedListingKeys: [] }
  const [savedListingKeys, likedListingKeys] = await Promise.all([
    getSavedListingKeys(),
    getLikedListingKeys(),
  ])
  return { signedIn: true, savedListingKeys, likedListingKeys }
}
