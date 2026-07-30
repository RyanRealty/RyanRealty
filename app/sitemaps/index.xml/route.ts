/**
 * /sitemaps/index.xml — the SITEMAP INDEX. Crawlers reach it at /sitemap.xml
 * through the beforeFiles rewrite in next.config.ts.
 *
 * WHY (2026-07-30): /sitemap.xml served ONE flat urlset — 10,689 <url> entries,
 * 2,148,231 bytes — built by a Next metadata route whose prerender ran the whole
 * buildAllUrls() fan-out (per-city subdivision RPCs + paginated table scans).
 * That prerender outgrew Vercel's per-route build ceiling: 600s on 2026-07-28
 * (raised to 1800s as an emergency bandage), and the same class of failure then
 * took the per-class children past 1800s on 2026-07-30, pinning production to an
 * older commit. The children were moved off the build path in 124348de. This
 * route finishes the job: /sitemap.xml now points at those children and does no
 * data work at all, so nothing sitemap-shaped prerenders at build time.
 *
 * COVERAGE — no URL is lost. Each child at /sitemaps/{class}.xml is the SAME
 * buildAllUrls() output filtered by classifySitemapUrl(), which is a TOTAL
 * function over SITEMAP_CLASSES (its final branch returns 'core', so every URL
 * lands in exactly one class). This index iterates SITEMAP_CLASSES itself, so it
 * cannot list a subset. Union of children === the old monolith's URL set.
 * Measured 2026-07-30: monolith 10,689 URLs; children summed 10,689.
 * Pinned by lib/data/sitemap/classify.test.ts and ci:sitemap-resolvable.
 *
 * WHY A ROUTE HANDLER. Next's metadata convention owns /sitemap.xml whenever
 * app/sitemap.ts exists, and a MetadataRoute.Sitemap can only emit <urlset> —
 * the <sitemapindex> shape is impossible there. app/sitemap.ts stays as the
 * URL-universe builder the children import (and as a correct runtime fallback),
 * marked force-dynamic so it never prerenders.
 *
 * No XML escaping is needed: every loc is built from SITEMAP_CLASSES (lowercase
 * a-z only) and the site base URL, and lastmod is an ISO timestamp.
 */
import { SITEMAP_CLASSES } from '@/lib/data/sitemap/classify'
import { getCanonicalSiteUrl } from '@/lib/share-metadata'

// Cheap enough to prerender (no database work at all) and refreshed on the same
// hourly window the children use.
export const revalidate = 3600

export async function GET() {
  // Same helper app/robots.ts uses, so the index Google is pointed AT and the
  // children it points TO are always on one host. It also refuses to emit a
  // localhost loc if the env var is unset in a deployed environment.
  const baseUrl = getCanonicalSiteUrl()

  // lastmod is when THIS index was generated. The children regenerate on the
  // same 3600s ISR window, so the index's own generation time is a real
  // timestamp that bounds theirs — not an invented freshness claim (§0).
  const lastmod = new Date().toISOString()

  const entries = SITEMAP_CLASSES.map(
    (cls) => `<sitemap><loc>${baseUrl}/sitemaps/${cls}.xml</loc><lastmod>${lastmod}</lastmod></sitemap>`,
  ).join('\n')

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entries,
    '</sitemapindex>',
    '',
  ].join('\n')

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
