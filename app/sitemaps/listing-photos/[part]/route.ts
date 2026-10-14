// @no-static-params — rendered on first request and held for the revalidate
// window, like the per-class children (app/sitemaps/[cls]/route.ts).
/**
 * /sitemaps/listing-photos/{1..24}.xml — every photo of every listing in
 * /sitemaps/listings.xml, split into fixed parts (2026-10-14).
 *
 * listings.xml keeps one lead photo per listing; this set carries the gallery,
 * up to LISTING_SITEMAP_PHOTO_CAP photos per listing, so Google Images can tie
 * each MLS photograph to its listing page. Same listing set, same canonical
 * locs and lastmod as listings.xml; part membership is a stable hash of the
 * ListingKey (lib/data/sitemap/listing-photo-sitemap.ts explains the sizing).
 *
 * Image URLs are the MLS's own CDN, the 1600x1200 render the listing page
 * loads. Never a copy (ODS §3-13). media_suppressed, the seller internet
 * opt-out and non-IDX listings carry no photos here.
 *
 * Six-hour window: photographs change far less often than inventory, and each
 * regeneration detoasts ~370 listing documents (docs/TOAST_READ_DISCIPLINE.md).
 */
import { parseListingPhotoSitemapPart } from '@/lib/data/sitemap/listing-photo-sitemap'
import { getListingPhotoSitemapEntries, siteBaseUrl } from '@/lib/sitemap-class-rows'
import { escapeXml } from '@/lib/sitemap-xml'

export const revalidate = 21600
export const maxDuration = 300
export const dynamicParams = true

export async function GET(_req: Request, ctx: { params: Promise<{ part: string }> }) {
  const { part: raw } = await ctx.params
  const part = parseListingPhotoSitemapPart(raw)
  if (part == null) return new Response('Not found', { status: 404 })

  const baseUrl = siteBaseUrl()
  const entries = await getListingPhotoSitemapEntries(part)

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...entries.map((e) => {
      const loc = escapeXml(e.path.startsWith('http') ? e.path : `${baseUrl}${e.path}`)
      const lastmod = e.lastModified ? `<lastmod>${escapeXml(e.lastModified)}</lastmod>` : ''
      const images = e.images.map((src) => `<image:image><image:loc>${escapeXml(src)}</image:loc></image:image>`).join('')
      return `<url><loc>${loc}</loc>${lastmod}${images}</url>`
    }),
    '</urlset>',
    '',
  ].join('\n')

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
