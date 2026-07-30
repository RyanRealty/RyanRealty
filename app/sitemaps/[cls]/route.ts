/**
 * Per-class child sitemaps at /sitemaps/{core|geo|listings|matrix|content}.xml
 *
 * WHY (westside backlog #5, 2026-07-28): the monolithic /sitemap.xml carried
 * 10,744 URLs with 60 indexed and no visibility into which URL class Google
 * ignores. Each class is submitted to GSC as its own sitemap so the indexed
 * count is reported per class. Pruning decisions then follow data, not
 * guesses. The monolith stays live and authoritative. These children carry
 * the SAME URLs, just bucketed (Google explicitly permits overlapping
 * sitemaps).
 *
 * CACHE SHAPE (fixed 2026-07-29): the v1 cache stored ALL ~10.7K URLs in ONE
 * entry, 2.4MB, over unstable_cache's 2MB per-entry cap. The cache write
 * failed on every attempt ("items over 2MB can not be cached" x6 per build),
 * so the heavy buildAllUrls ran on EVERY child request, at build time and at
 * runtime, forever. v2 caches PER CLASS (the class arg is part of the cache
 * key) and stores compact [path, lastmodISO] tuples instead of objects with
 * full URLs. The largest class (listings, ~7.6K rows) lands around ~0.7MB,
 * real headroom under the cap. Cold cost is one buildAllUrls run per class
 * per hour instead of one shared run that never actually cached.
 *
 * No XML escaping is needed. Every loc comes from our own slugified path
 * builders (lowercase a-z, digits, hyphens, slashes only) and lastmod is an
 * ISO timestamp. Neither can contain XML-special characters.
 */
import { unstable_cache } from 'next/cache'
import { buildAllUrls } from '@/app/sitemap'
import { classifySitemapUrl, SITEMAP_CLASSES, type SitemapClass } from '@/lib/data/sitemap/classify'
import { getIndexablePresetSlugs } from '@/lib/search-presets'

export const revalidate = 3600

// Prerender all five children at build time, the same treatment /sitemap.xml
// gets via ISR (staticPageGenerationTimeout is already sized for this build).
// Unknown params 404 without invoking the heavy build.
export const dynamicParams = false

export function generateStaticParams() {
  return SITEMAP_CLASSES.map((cls) => ({ cls: `${cls}.xml` }))
}

function siteBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
}

// Rows are [path, lastmodISO] tuples; path is relative to the site base URL
// ('' for the homepage row). unstable_cache includes the cls argument in the
// cache key, so each class caches independently and stays far under 2MB.
const getClassRows = unstable_cache(
  async (cls: SitemapClass): Promise<[string, string][]> => {
    const baseUrl = siteBaseUrl()
    const urls = await buildAllUrls(baseUrl, new Date())
    const presetSlugs = new Set(getIndexablePresetSlugs())
    return urls
      .filter((u) => classifySitemapUrl(u.url, presetSlugs) === cls)
      .map((u) => [
        u.url.startsWith(baseUrl) ? u.url.slice(baseUrl.length) : u.url,
        u.lastModified instanceof Date ? u.lastModified.toISOString() : String(u.lastModified ?? ''),
      ])
  },
  ['sitemap-class-urls-v2'],
  { revalidate: 3600 },
)

export async function GET(_req: Request, ctx: { params: Promise<{ cls: string }> }) {
  const { cls } = await ctx.params
  const clean = cls.replace(/\.xml$/, '') as SitemapClass
  if (!SITEMAP_CLASSES.includes(clean)) {
    return new Response('Not found', { status: 404 })
  }

  const baseUrl = siteBaseUrl()
  const rows = await getClassRows(clean)

  const entries = rows
    .map(([path, lastmodIso]) => {
      const loc = path.startsWith('http') ? path : `${baseUrl}${path}`
      const lastmod = lastmodIso ? `<lastmod>${lastmodIso}</lastmod>` : ''
      return `<url><loc>${loc}</loc>${lastmod}</url>`
    })
    .join('\n')

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entries,
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
