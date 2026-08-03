/**
 * The per-class sitemap row cache, shared by the public route and the warmer.
 *
 * WHY IT LIVES HERE (2026-08-02, third pass). The warmer used to warm the
 * sitemaps by fetching their public URLs five times:
 *
 *     for (const cls of SITEMAP_CLASSES) await fetch(`${baseUrl}/sitemaps/${cls}.xml`)
 *
 * and its comment claimed "the in-flight dedupe collapses them onto one shared
 * universe build". That is not true over HTTP. Each fetch is a separate lambda
 * invocation with its own module scope, so the module-level memo is never
 * shared, and because the calls are sequential there is no in-flight overlap to
 * dedupe in the first place. Every class paid a full ~10.7K-URL fan-out.
 *
 * Measured in production immediately after deploy, sequential, cold:
 *
 *     core.xml      504  300.6s     <- killed at maxDuration
 *     geo.xml       504  300.6s
 *     content.xml   200  146.7s     <- one build DID fit, on a warm instance
 *     listings.xml  504  300.2s
 *
 * One build takes ~147s. Five of them do not fit in a 300s ceiling; one plus
 * four cheap filters does, with room to spare. So the warmer now imports this
 * module and calls getClassRows() five times inside ONE invocation, where the
 * memo genuinely applies: one universe build, then four in-memory filters, and
 * all five unstable_cache entries written for the hour ahead.
 *
 * Kept out of lib/data/ deliberately — this is a cache/composition helper, not
 * a DAL read, and the DAL index gate AST-walks lib/data/**\/*.ts.
 */
import type { MetadataRoute } from 'next'
import { unstable_cache } from 'next/cache'
import { buildAllUrls } from '@/app/sitemap'
import { classifySitemapUrl, type SitemapClass } from '@/lib/data/sitemap/classify'
import { getIndexablePresetSlugs } from '@/lib/search-presets'
import { createUniverseMemo } from '@/lib/sitemap-universe-memo'

export function siteBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
}

// Freshness is stamped on RESOLVE, so a build slower than its own TTL is still
// reused. 10 minutes covers a sequential sweep of all five classes plus the
// warmer. See lib/sitemap-universe-memo.ts and its tests for the invariant.
const UNIVERSE_TTL_MS = 600_000

const buildUniverseOnce = createUniverseMemo<MetadataRoute.Sitemap>(
  () => buildAllUrls(siteBaseUrl(), new Date()),
  UNIVERSE_TTL_MS,
)

/**
 * Rows are [path, lastmodISO] tuples; path is relative to the site base URL
 * ('' for the homepage row). unstable_cache includes the cls argument in the
 * cache key, so each class caches independently and stays far under the 2MB
 * per-entry cap that broke v1.
 */
export const getClassRows = unstable_cache(
  async (cls: SitemapClass): Promise<[string, string][]> => {
    const baseUrl = siteBaseUrl()
    const urls = await buildUniverseOnce()
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
