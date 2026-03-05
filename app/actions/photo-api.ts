'use server'

import { fetchPlacePhoto } from '../../lib/photo-api'

/**
 * Get a dynamic place photo URL (and attribution) for use as hero/banner fallback.
 * Uses Unsplash or Pexels if API keys are set — real photos instead of AI-generated.
 * Call when no custom banner/hero exists for the city or subdivision.
 */
export async function getPlacePhotoFallback(query: string): Promise<{
  url: string | null
  attribution: string | null
} | null> {
  const result = await fetchPlacePhoto(query)
  if (!result) return null
  return { url: result.url, attribution: result.attribution }
}
