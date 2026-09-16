/**
 * remote-media-proxy.mjs — let headless Chromium load cross-origin media in an
 * egress-restricted sandbox.
 *
 * WHY THIS IS SHARED. A public page's photographs are CDN URLs (Spark listing
 * photos, Supabase storage heroes). In a cloud sandbox the NODE process reaches
 * those hosts through the configured proxy and headless Chromium does NOT:
 * `curl` answers 200 for a Spark photo while `new Image()` inside the page fires
 * `onerror` (verified 2026-09-15).
 *
 * `take-route-shots.mjs` already carried the fix as its "TRAP 10" — fetch the
 * media in Node and fulfill it into the browser, the same bytes a visitor gets.
 * `check-route-content-floor.mjs` did not, and it MEASURES IMAGES: its
 * `heroImageWidth` is the rendered width of the widest <img> that actually
 * loaded. So in a cloud session every image-bearing route reported the same
 * collapsed hero (120px) and the floor failed on routes nobody had touched —
 * a gate that cannot be run is a gate that gets ignored.
 *
 * One copy, both callers. Set SHOT_NO_MEDIA_PROXY=1 to turn it off; a machine
 * with ordinary network access behaves identically either way, because a failed
 * fetch hands the request straight back to the browser.
 */

const MEDIA_TYPES = new Set(['image', 'media', 'font'])

/** One response cache per process — six shots load the same hero six times. */
const mediaCache = new Map()

/**
 * @param {import('playwright').BrowserContext|import('playwright').Page} target
 *   Anything with `.route()`. A context covers every page opened from it.
 * @param {string} pageOrigin  Same-origin requests are left alone.
 * @param {{served:number}} [stats]  Optional counter, for a capture footnote.
 */
export async function installRemoteMediaProxy(target, pageOrigin, stats = { served: 0 }) {
  if (process.env.SHOT_NO_MEDIA_PROXY === '1') return stats
  await target.route('**/*', async (route) => {
    const request = route.request()
    if (!MEDIA_TYPES.has(request.resourceType())) return route.continue()
    let origin
    try {
      origin = new URL(request.url()).origin
    } catch {
      return route.continue()
    }
    if (origin === pageOrigin) return route.continue()
    const key = request.url()
    try {
      if (!mediaCache.has(key)) {
        const response = await fetch(key, { signal: AbortSignal.timeout(20_000) })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        mediaCache.set(key, {
          body: Buffer.from(await response.arrayBuffer()),
          contentType: response.headers.get('content-type') ?? 'application/octet-stream',
        })
      }
      const hit = mediaCache.get(key)
      stats.served += 1
      return route.fulfill({ status: 200, contentType: hit.contentType, body: hit.body })
    } catch {
      // No proxy needed, or the host is genuinely down: let the browser try.
      return route.continue()
    }
  })
  return stats
}
