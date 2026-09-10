/**
 * The photograph on an out-of-area listing row, at the size the row draws it.
 *
 * WHY THIS EXISTS (SITE-59). The rows on /oregon/[city] draw a listing's own
 * MLS photograph in an 88x66 box. The URL the feed hands us asks Spark's
 * resize CDN for the SAME picture at 1600x1200: measured 2026-09-09,
 * `.../ore/1600x1200/true/20260501165710852242000000-o.jpg` is 330,871 bytes,
 * and `.../ore/320x240/true/` — the same asset id, the same path, one token
 * changed — is 30,147 bytes of the same photograph (verified by eye and by
 * dimensions: 1200x899 against 320x240, the same aerial of 835 Cherry Street).
 * Eleven rows was 3.6 MB of pictures to paint 968x726 of page.
 *
 * §0 — A PHOTOGRAPH IS A CLAIM. This never substitutes one listing's picture
 * for another's, and it never invents a stand-in. It rewrites ONE path segment
 * — the render size — on a URL that already points at this listing's own
 * photo, on the one host whose path grammar we have verified. The asset id is
 * untouched, so the bytes that come back are that listing's picture or nothing.
 *
 * ODS §3-13 — display, never copy. The picture is still fetched from the MLS's
 * own CDN by the visitor's browser at render time. Nothing is stored here.
 *
 * Anything that is not exactly that host and that path shape passes through
 * unchanged, so a feed that moves hosts degrades to today's behaviour rather
 * than to a broken URL.
 */

/** The host whose `/{feed}/{W}x{H}/{crop}/{asset}` grammar is verified. */
const SPARK_RESIZE_HOST = 'cdn.resize.sparkplatform.com'

/**
 * The render the row asks for. 320x240 is the smallest bucket Spark answered
 * distinctly (256x192 came back byte-identical to 320x240, so the CDN snaps
 * upward and asking smaller buys nothing), and it is still ~3.6x the 88x66 CSS
 * box, which keeps it sharp on a 2x screen.
 */
const ROW_RENDER = '320x240'

/** `/ore/1600x1200/true/<asset>.jpg` — feed, size, crop flag, asset. */
const SPARK_RESIZE_PATH = /^\/([^/]+)\/\d+x\d+\/([^/]+)\/(.+)$/

export function listingRowPhotoSrc(raw: string): string {
  const src = raw.trim()
  if (!src) return src
  let url: URL
  try {
    url = new URL(src)
  } catch {
    // Not an absolute URL (an owned file under public/, say). Leave it alone.
    return src
  }
  if (url.hostname !== SPARK_RESIZE_HOST) return src
  const parts = SPARK_RESIZE_PATH.exec(url.pathname)
  if (!parts) return src
  const [, feed, crop, asset] = parts
  url.pathname = `/${feed}/${ROW_RENDER}/${crop}/${asset}`
  return url.toString()
}
