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
 *
 * VIDEO AND AUDIO ARE NOT PROXIED (2026-10-03). Fulfilling hands the whole body
 * to Chromium in one message. A listing reel of 79 MB (18575 SW Century Drive,
 * the phone-fold gate's video case) closed the browser mid-gate every run:
 * "Target page, context or browser has been closed", reproduced locally with
 * the same file. A <video> asks for byte ranges and no gate reads its frames,
 * so the browser fetches it itself. Anything else over MAX_FULFILL_BYTES goes
 * back to the browser the same way.
 */

const MEDIA_TYPES = new Set(['image', 'font'])

/** Largest body handed to the browser in one fulfill: far above any photo or font. */
export const MAX_FULFILL_BYTES = 16 * 1024 * 1024

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
        if (Number(response.headers.get('content-length') ?? 0) > MAX_FULFILL_BYTES) {
          await response.body?.cancel()
          throw new Error('too large to fulfill')
        }
        const body = Buffer.from(await response.arrayBuffer())
        if (body.length > MAX_FULFILL_BYTES) throw new Error('too large to fulfill')
        mediaCache.set(key, {
          body,
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
