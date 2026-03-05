/**
 * Place/hero photos from Unsplash.
 * Search: city page = "City Oregon", community page = "Community City Oregon".
 * Set UNSPLASH_ACCESS_KEY in .env.local (https://unsplash.com/developers).
 */

export type PlacePhotoResult = {
  url: string
  attribution: string
  sourceUrl?: string
}

export type PlacePhotoOption = PlacePhotoResult & { thumbUrl: string }

/**
 * Fetch one landscape photo from Unsplash for the given search query.
 * Optional page (1-based) for "refresh" to get a different image.
 */
export async function fetchPlacePhoto(
  query: string,
  opts?: { page?: number }
): Promise<PlacePhotoResult | null> {
  const q = (query || 'Central Oregon').trim()
  if (!q) return null
  const unsplashKey = process.env.UNSPLASH_ACCESS_KEY
  if (!unsplashKey?.trim()) return null
  return fetchUnsplashSingle(unsplashKey, q, opts?.page ?? 1)
}

/**
 * Fetch multiple options for the place (for "pick another" UI). Returns up to count results with thumb + regular URL.
 */
export async function fetchPlacePhotoOptions(
  query: string,
  count: number
): Promise<PlacePhotoOption[]> {
  const q = (query || 'Central Oregon').trim()
  if (!q || count < 1) return []
  const unsplashKey = process.env.UNSPLASH_ACCESS_KEY
  if (!unsplashKey?.trim()) return []
  return fetchUnsplashPage(unsplashKey, q, count)
}

async function fetchUnsplashSingle(
  accessKey: string,
  query: string,
  page: number
): Promise<PlacePhotoResult | null> {
  try {
    const url = new URL('https://api.unsplash.com/search/photos')
    url.searchParams.set('query', `${query} landscape`)
    url.searchParams.set('per_page', '1')
    url.searchParams.set('page', String(Math.max(1, page)))
    url.searchParams.set('orientation', 'landscape')
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Client-ID ${accessKey}` },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { results?: Array<{ urls?: { regular?: string }; user?: { name?: string; links?: { html?: string } } }> }
    const photo = data.results?.[0]
    if (!photo?.urls?.regular) return null
    const name = photo.user?.name ?? 'Unknown'
    const userUrl = photo.user?.links?.html
    return {
      url: photo.urls.regular,
      attribution: `Photo by ${name} on Unsplash`,
      sourceUrl: userUrl ?? 'https://unsplash.com',
    }
  } catch {
    return null
  }
}

async function fetchUnsplashPage(
  accessKey: string,
  query: string,
  perPage: number
): Promise<PlacePhotoOption[]> {
  try {
    const url = new URL('https://api.unsplash.com/search/photos')
    url.searchParams.set('query', `${query} landscape`)
    url.searchParams.set('per_page', String(Math.min(10, Math.max(1, perPage))))
    url.searchParams.set('orientation', 'landscape')
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Client-ID ${accessKey}` },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const data = (await res.json()) as {
      results?: Array<{
        urls?: { regular?: string; thumb?: string; small?: string }
        user?: { name?: string; links?: { html?: string } }
      }>
    }
    const results: PlacePhotoOption[] = []
    for (const photo of data.results ?? []) {
      const regular = photo.urls?.regular
      const thumb = photo.urls?.thumb ?? photo.urls?.small ?? regular
      if (!regular) continue
      const name = photo.user?.name ?? 'Unknown'
      results.push({
        url: regular,
        thumbUrl: thumb ?? regular,
        attribution: `Photo by ${name} on Unsplash`,
        sourceUrl: photo.user?.links?.html ?? 'https://unsplash.com',
      })
    }
    return results
  } catch {
    return []
  }
}

// Pexels fallback removed; using Unsplash only for hero images.
