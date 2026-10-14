/**
 * XML text escaping for the hand-built sitemap route handlers
 * (app/sitemaps/**). Locs from our own path builders need none, but image and
 * video URLs come from the MLS CDN and from listing media, and titles carry
 * street names, so every interpolated value goes through this. Pure.
 */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
