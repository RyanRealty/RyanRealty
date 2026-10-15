/**
 * /sitemaps/video.xml — listing video tours for Google video search (2026-10-14).
 *
 * One <url> per listings.xml listing (Active, Active Under Contract, Pending)
 * whose MLS video is a YouTube or Vimeo player with a dated MLS record: the
 * same videos the listing page's VideoObject describes
 * (lib/sitemap-class-rows.ts getListingVideoSitemapEntries). Each entry names
 * the player (player_loc), never a file: the video is the listing broker's
 * work, embedded from its host and never re-hosted (ODS). The thumbnail is
 * YouTube's own still, or for Vimeo the listing's MLS lead photo; the
 * publication date is the MLS media record's ModificationTimestamp. A video
 * without one of those is not listed. Suppressed media and the ODS opt-outs
 * are left out.
 *
 * A static route beside the dynamic [cls] child, so /sitemaps/video.xml lands
 * here, not on the class switch. Six-hour window, like the photo parts.
 */
import { getListingVideoSitemapEntries, siteBaseUrl } from '@/lib/sitemap-class-rows'
import { escapeXml } from '@/lib/sitemap-xml'

export const revalidate = 21600
export const maxDuration = 300

/** Google caps video:description at 2,048 characters. */
const DESCRIPTION_MAX = 2048

export async function GET() {
  const baseUrl = siteBaseUrl()
  const entries = await getListingVideoSitemapEntries()

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">',
    ...entries.map((e) => {
      const loc = escapeXml(e.path.startsWith('http') ? e.path : `${baseUrl}${e.path}`)
      const lastmod = e.lastModified ? `<lastmod>${escapeXml(e.lastModified)}</lastmod>` : ''
      const videos = e.videos
        .map(
          (v) =>
            '<video:video>' +
            `<video:thumbnail_loc>${escapeXml(v.thumbnailUrl)}</video:thumbnail_loc>` +
            `<video:title>${escapeXml(v.title)}</video:title>` +
            `<video:description>${escapeXml(v.description.slice(0, DESCRIPTION_MAX))}</video:description>` +
            `<video:player_loc>${escapeXml(v.playerUrl)}</video:player_loc>` +
            `<video:publication_date>${escapeXml(v.publicationDate)}</video:publication_date>` +
            '<video:family_friendly>yes</video:family_friendly>' +
            '</video:video>',
        )
        .join('')
      return `<url><loc>${loc}</loc>${lastmod}${videos}</url>`
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
