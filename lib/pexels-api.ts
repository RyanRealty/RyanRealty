/**
 * Pexels photo search (curated stock). https://www.pexels.com/api/documentation/#photos-search
 * Env: PEXELS_API_KEY — send as Authorization header value (not Bearer).
 */

export type PexelsSearchHit = {
  id: number
  url: string
  thumbUrl: string
  photographer: string
  photographerUrl: string
  /** Landscape-oriented src when available */
  width: number
  height: number
}

export async function searchPexelsPhotos(
  query: string,
  opts?: { perPage?: number }
): Promise<{ ok: true; data: PexelsSearchHit[] } | { ok: false; error: string; status?: number }> {
  const q = (query || '').trim()
  if (!q) return { ok: false, error: 'Missing query' }

  const key =
    process.env.PEXELS_API_KEY?.trim() ||
    process.env.PEXELS_ACCESS_KEY?.trim() ||
    process.env.PEXEL_API_KEY?.trim()
  if (!key) return { ok: false, error: 'PEXELS_API_KEY not set (optional aliases: PEXELS_ACCESS_KEY, PEXEL_API_KEY)' }

  const perPage = Math.min(15, Math.max(1, opts?.perPage ?? 12))
  const url = new URL('https://api.pexels.com/v1/search')
  url.searchParams.set('query', q)
  url.searchParams.set('per_page', String(perPage))
  url.searchParams.set('orientation', 'landscape')

  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: key },
      next: { revalidate: 0 },
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return {
        ok: false,
        status: res.status,
        error: text.slice(0, 200) || res.statusText || 'Pexels request failed',
      }
    }
    const json = (await res.json()) as {
      photos?: Array<{
        id: number
        width: number
        height: number
        url: string
        photographer: string
        photographer_url: string
        src?: {
          large?: string
          large2x?: string
          medium?: string
          small?: string
          landscape?: string
          tiny?: string
        }
      }>
    }
    const data: PexelsSearchHit[] = (json.photos ?? []).map((p) => {
      const src = p.src ?? {}
      const thumb = src.tiny ?? src.medium ?? src.small
      const main = src.landscape ?? src.large2x ?? src.large ?? src.medium ?? p.url
      return {
        id: p.id,
        url: main,
        thumbUrl: thumb ?? main,
        photographer: p.photographer,
        photographerUrl: p.photographer_url,
        width: p.width,
        height: p.height,
      }
    })
    return { ok: true, data }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
