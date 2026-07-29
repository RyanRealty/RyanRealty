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
 * One shared cached build feeds all five children (revalidate 3600), so the
 * heavy generation still runs once an hour, not once per child request.
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

// Prerender all five children at build time — same treatment /sitemap.xml
// gets via ISR (staticPageGenerationTimeout is already sized for this build).
// First child warms the shared URL cache; the rest reuse it. Unknown params
// 404 without invoking the heavy build.
export const dynamicParams = false

export function generateStaticParams() {
  return SITEMAP_CLASSES.map((cls) => ({ cls: `${cls}.xml` }))
}

const getCachedUrls = unstable_cache(
  async () => {
    const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
    const urls = await buildAllUrls(baseUrl, new Date())
    // unstable_cache JSON-serializes: Date lastModified survives as ISO string.
    return urls.map((u) => ({
      url: u.url,
      lastModified:
        u.lastModified instanceof Date ? u.lastModified.toISOString() : String(u.lastModified ?? ''),
    }))
  },
  ['sitemap-class-urls-v1'],
  { revalidate: 3600 },
)

export async function GET(_req: Request, ctx: { params: Promise<{ cls: string }> }) {
  const { cls } = await ctx.params
  const clean = cls.replace(/\.xml$/, '') as SitemapClass
  if (!SITEMAP_CLASSES.includes(clean)) {
    return new Response('Not found', { status: 404 })
  }

  const presetSlugs = new Set(getIndexablePresetSlugs())
  const all = await getCachedUrls()
  const rows = all.filter((u) => classifySitemapUrl(u.url, presetSlugs) === clean)

  const entries = rows
    .map((u) => {
      const lastmod = u.lastModified ? `<lastmod>${u.lastModified}</lastmod>` : ''
      return `<url><loc>${u.url}</loc>${lastmod}</url>`
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
