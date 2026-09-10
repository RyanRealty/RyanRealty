/**
 * Spark resize URLs at the size a row / filmstrip actually draws.
 *
 * Promoted from app/oregon/[city]/_v3/listing-row-photo.ts (SITE-59) because
 * SITE-60 needs the same rewrite in listing-hero filmstrip and speculative
 * Flight payloads: those were asking Spark for 1600×1200 plates of photos
 * that render at ~96px. Same rewrite, same asset id. The oregon module
 * re-exports this file.
 *
 * WHY THE TOKEN (SITE-59). The rows on /oregon/[city] draw a listing's own
 * MLS photograph in an 88x66 box. The feed URL asks Spark for 1600x1200
 * (measured 330,871 bytes); `320x240` of the same asset is 30,147 bytes.
 * 320x240 is the smallest bucket Spark answered distinctly (256x192 came
 * back byte-identical). The asset id is untouched — this never substitutes
 * one listing's picture for another's. ODS §3-13: display, never copy.
 * Hosts/paths we have not verified pass through unchanged.
 */

const SPARK_RESIZE_HOST = 'cdn.resize.sparkplatform.com'
const ROW_RENDER = '320x240'
const SPARK_RESIZE_PATH = /^\/([^/]+)\/\d+x\d+\/([^/]+)\/(.+)$/

export function listingRowPhotoSrc(raw: string): string {
  const src = raw.trim()
  if (!src) return src
  let url: URL
  try {
    url = new URL(src)
  } catch {
    return src
  }
  if (url.hostname !== SPARK_RESIZE_HOST) return src
  const parts = SPARK_RESIZE_PATH.exec(url.pathname)
  if (!parts) return src
  const [, feed, crop, asset] = parts
  url.pathname = `/${feed}/${ROW_RENDER}/${crop}/${asset}`
  return url.toString()
}
