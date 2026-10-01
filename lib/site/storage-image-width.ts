/**
 * A Supabase Storage photograph at the width a surface draws it (2026-10-01).
 *
 * The town stills (asset-library/photos/grok-imagine/imagine-place-city-*.png)
 * are 2.6 to 2.9 MB PNGs. The homepage drew them as 56px search thumbnails and
 * as mosaic tiles at full size: six of them were 16 MB of a page, and in the
 * opened search the last thumbnail had not arrived 700 ms after the click
 * (build b1, Terrebonne). Supabase's image renderer serves the same object
 * at a width, as WebP to a browser that accepts it (measured: 160px wide,
 * 11 KB; 720px wide, 78 KB). The admin photo board already reads it this way.
 *
 * Pure: a Supabase Storage public object URL comes back as its render URL at
 * `width`; anything else (a local /images path, a listing CDN) comes back as
 * it was. Never invents a source.
 */
const OBJECT = '/storage/v1/object/public/'
const RENDER = '/storage/v1/render/image/public/'

export function storageImageAtWidth(url: string | null | undefined, width: number): string | null {
  const src = url?.trim()
  if (!src) return null
  if (!Number.isFinite(width) || width <= 0) return src
  let parsed: URL
  try {
    parsed = new URL(src)
  } catch {
    return src
  }
  if (!parsed.hostname.endsWith('.supabase.co') || !parsed.pathname.startsWith(OBJECT)) return src
  if (parsed.search) return src
  parsed.pathname = RENDER + parsed.pathname.slice(OBJECT.length)
  parsed.search = `?width=${Math.round(width)}&quality=72`
  return parsed.toString()
}
