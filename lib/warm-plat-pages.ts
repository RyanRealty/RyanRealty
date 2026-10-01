import type { IndexableSubdivision } from '@/lib/data/subdivisions/subdivision-index'
import { resolveSubdivisionAreaRedirect } from '@/lib/subdivision-area-redirects'

/**
 * The plat tier of the warm-geo-pages cron (P3 — SEO-2, DATA-1, 2026-09-23).
 *
 * WHY. /sitemaps/geo.xml submits every indexable plat (2,642 on 2026-09-22),
 * /subdivisions/[slug] prerenders none of them (ci:ssg-budget), and Vercel's
 * ISR cache starts empty on every deployment. So after each deploy the first
 * fetch of every plat is a cold render, measured at 2.4 to 8.6 s, and at
 * crawler concurrency 8 one in four of them used to come back HTTP 500
 * (lib/site/degraded-isr.ts has that story). The tier-1 warmer covers only the
 * ~100 registry alias plats.
 *
 * WHAT. The indexable set, largest closed-sale history first (the plats most
 * searched for; Search Console is not in the database, so this is the proxy),
 * split into fixed slices. The cron claims one slice at a time with a
 * per-deployment lease and fetches its URLs, so the pass is bounded per
 * invocation, resumes where the last invocation stopped, and fetches each URL
 * ONCE per deployment. Re-fetching a warm page is not free: past the page's
 * 900 s ISR window (60 s for a degraded copy) a fetch triggers a background
 * regeneration, and 2,642 of those every ten minutes would be a load the
 * database cannot spare.
 *
 * ONE PASS PER GAP (SITE-212, 2026-10-01). "Once per deployment" assumed ~4
 * deploys a day. 2026-09-30 had 21, and Postgres statement timeouts (2,382
 * that day, 2,379 through PostgREST) rose and fell hour by hour with them:
 * every deploy cleared the ISR cache and this tier re-rendered ~2,750 pages
 * on a 4 GB IO-bound instance. So a deployment may START a plat pass only
 * when no pass began inside PLAT_WARM_PASS_GAP_S. One statement decides it,
 * crm_cron_pass_gate (migration 20261001030900): if this deployment's pass
 * marker (platPassMarkerName) is held, the pass is under way and continues;
 * else if PLAT_WARM_PASS_GAP_LEASE is held, the deployment waits
 * (`throttled`); else it takes both and starts. The marker carries no path
 * count, so a pass whose slice names change mid-way (the indexable set
 * resized) keeps going, and nothing is ever taken and given back, so no
 * failed release can leave a pass running past the gap. A gate that does not
 * answer warms nothing. Tier 1 (~137 registry pages) stays per deployment.
 * Cost of the trade: a plat first fetched between passes pays the cold
 * render it paid before 2026-09-23.
 */

/** URLs per claimed slice. At concurrency 6 and 2.4 to 8.6 s per cold render, one slice fits well inside a 300 s invocation. */
export const PLAT_WARM_SLICE = 150

/** Parallel fetches while warming plats. SEO-2 measured renders degrading at 8. */
export const PLAT_WARM_CONCURRENCY = 6

/** Stop claiming new slices once this much of the invocation is spent (maxDuration 300). */
export const PLAT_WARM_CLAIM_UNTIL_MS = 150_000

/** Never start a fetch batch after this point, so the invocation ends inside maxDuration. */
export const PLAT_WARM_HARD_STOP_MS = 255_000

/** A new plat pass may start only this long after the previous one began: at most four a day, the deploy count the tier was sized for. */
export const PLAT_WARM_PASS_GAP_S = 6 * 3600

/** The crm_cron_leases name held for PLAT_WARM_PASS_GAP_S from the moment any deployment's pass starts. */
export const PLAT_WARM_PASS_GAP_LEASE = 'warm-plats-pass-gap'

/**
 * The crm_cron_leases name that marks this deployment's pass as started. No
 * path count in it (unlike the slice leases), so it survives the indexable
 * set changing size mid-pass.
 */
export function platPassMarkerName(sha: string): string {
  return `warm-plats-pass:${sha}`
}

/**
 * The plat URLs to warm, in priority order: redirect slugs dropped (middleware
 * 308s them to a community page tier 1 already warms), then closed-sale
 * history descending, slug ascending on ties so the order is stable between
 * invocations of one deployment.
 */
export function platWarmPaths(
  plats: readonly Pick<IndexableSubdivision, 'slug' | 'closedCount'>[],
  isRedirected: (slug: string) => boolean = (slug) => resolveSubdivisionAreaRedirect(slug) != null,
): string[] {
  const seen = new Set<string>()
  return plats
    .filter((p) => {
      if (!p.slug || seen.has(p.slug) || isRedirected(p.slug)) return false
      seen.add(p.slug)
      return true
    })
    .slice()
    .sort((a, b) => b.closedCount - a.closedCount || a.slug.localeCompare(b.slug))
    .map((p) => `/subdivisions/${p.slug}`)
}

export function platWarmSlices(paths: readonly string[], size: number = PLAT_WARM_SLICE): string[][] {
  if (size < 1) throw new Error('platWarmSlices: size must be >= 1')
  const out: string[][] = []
  for (let i = 0; i < paths.length; i += size) out.push(paths.slice(i, i + size))
  return out
}

/**
 * The lease that marks slice `index` claimed for this deployment. The path
 * count is in the name: if the indexable set changes size mid-deployment the
 * slice boundaries move, and the pass restarts under fresh names rather than
 * skipping the plats that shifted into an already-claimed slice.
 */
export function platSliceLeaseName(sha: string, pathCount: number, index: number): string {
  return `warm-plats-${sha}-n${pathCount}-s${index}`
}
