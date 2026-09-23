import platPrerender from '@/data/plat-prerender.json'
import { resolveSubdivisionAreaRedirect } from '@/lib/subdivision-area-redirects'

/**
 * The plats /subdivisions/[slug] prerenders at build (P3, Matt 2026-09-23:
 * "Nothing is permanent… if there's something we're enforcing that's keeping
 * us back, evaluate it and likely change it").
 *
 * ci:ssg-budget held this route at ZERO build-time pages from 2026-08-21, when
 * ~125 subdivision pages took 11.2 of a 14-minute build and baked empty rails
 * into static HTML under build-concurrency timeouts. That budget left every
 * plat cold after every deployment. Evaluated 2026-09-23:
 *   - The 500s crawlers saw were NOT the budget; they were the degraded-render
 *     noStore() (lib/site/degraded-isr.ts). With that fixed a degraded cold
 *     render is a 200, and the fixed page rendered 35 plats in 2.6 to 10.0 s
 *     with no throw (P3 harness, uncached reads, 2026-09-23).
 *   - Plat impressions are long-tail: 436 plat URLs drew 1,417 impressions in
 *     2026-08-23..2026-09-19. The 25 listed in data/plat-prerender.json hold
 *     594 of them (41.9%); the other 2,617 sitemapped plats are warmed after
 *     each deploy by the warm-geo-pages cron's plat tier instead.
 *   - Build cost, measured: the 25 rendered in 2.6 to 4.9 s each plus 1.1 to
 *     1.7 s of head, 124.5 s serial in all with nothing degraded (P3 harness,
 *     uncached, 2026-09-23). Split over the 7 static-generation workers the
 *     2026-08-21 build record names (scripts/check-ssg-budget.mjs), that is
 *     about 18 s of build. The 08-21 failure mode (a thin prerender baked in
 *     for the whole window) is now bounded by the build retry and the 60 s
 *     degraded-copy lifetime.
 * So the budget moves from zero to a cap of PLAT_PRERENDER_CAP, held by
 * ci:ssg-budget, and the list is data, not code.
 */
export const PLAT_PRERENDER_CAP = 25

type PlatPrerenderFile = { plats: Array<{ slug: string }> }

export function platPrerenderSlugs(
  file: PlatPrerenderFile = platPrerender as PlatPrerenderFile,
  isRedirected: (slug: string) => boolean = (slug) => resolveSubdivisionAreaRedirect(slug) != null,
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const { slug } of file.plats) {
    const s = slug.trim().toLowerCase()
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) || seen.has(s) || isRedirected(s)) continue
    seen.add(s)
    out.push(s)
    if (out.length === PLAT_PRERENDER_CAP) break
  }
  return out
}

/** generateStaticParams for /subdivisions/[slug]. Pure, no database read at build. */
export function platPrerenderParams(): Array<{ slug: string }> {
  return platPrerenderSlugs().map((slug) => ({ slug }))
}
