/**
 * sitemap-smoke.mjs — after a deploy is READY, does every sitemap Google reads
 * actually answer?
 *
 * WHY (SITE-54, 2026-09-09). On 2026-09-09 GET /sitemaps/geo.xml returned
 * 504 'Task timed out after 300 seconds' twice in a row on production, and
 * core.xml did the same twenty minutes later. Nothing caught it: the deploy was
 * READY, the build telemetry was green, `/` answered 200, and the sitemap index
 * itself answered — only the children were dead, so the entire place tree
 * (cities, communities, neighborhoods, 2,486 indexable plats) was unreadable by
 * Google and no gate in the repo could see it. The failure had been drifting for
 * weeks (106s cold in 2026-08, 235s later) before it crossed the ceiling.
 *
 * WHAT IT ASSERTS, per class: HTTP 200, and a urlset carrying at least one
 * <url> element. Status alone is not enough — the documented failure mode of
 * this exact route family is "served an empty urlset when the universe threw"
 * (lib/sitemap-class-rows.ts), which is a 200 nobody would notice.
 *
 * TIMEOUT. The route's own ceiling is maxDuration 300, so a probe that gives up
 * sooner reports a failure the platform did not have. The default budget is
 * therefore 300s per class, and the classes are fetched CONCURRENTLY so the
 * whole smoke costs one class's worth of wall clock, not six.
 *
 * USER AGENT. CI_PROBE_USER_AGENT, not a hand-typed browser string:
 * middleware.ts 403s automation UAs and `npm run ci:probe-ua` fails any probe
 * that does not use the shared constant. It clears the same bot screen a
 * browser clears, which is what the accept asks for.
 */

import { CI_PROBE_USER_AGENT } from './ci-probe-ua.mjs'

/** Every sitemap a crawler can be told to fetch: the index plus its children. */
export const SITEMAP_SMOKE_PATHS = Object.freeze([
  '/sitemap.xml',
  '/sitemaps/core.xml',
  '/sitemaps/geo.xml',
  '/sitemaps/content.xml',
  '/sitemaps/listings.xml',
  '/sitemaps/matrix.xml',
])

/** Matches the route's own maxDuration — a shorter budget invents failures. */
export const SITEMAP_SMOKE_TIMEOUT_MS = 300_000

/**
 * `<url>` for a urlset, `<sitemap>` for the index. Either proves the document
 * carries entries rather than being a well-formed empty shell.
 */
function countEntries(body) {
  const urls = body.match(/<url>/g)?.length ?? 0
  const children = body.match(/<sitemap>/g)?.length ?? 0
  return urls + children
}

/**
 * Probe every sitemap path against `origin`.
 *
 * @param {string} origin e.g. 'https://ryan-realty.com'
 * @param {{ timeoutMs?: number, fetchImpl?: typeof fetch, paths?: readonly string[] }} [opts]
 * @returns {Promise<{ ok: boolean, results: Array<{ path: string, status: number|null, entries: number, ms: number, error: string|null }> }>}
 */
export async function probeSitemapClasses(origin, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? SITEMAP_SMOKE_TIMEOUT_MS
  const doFetch = opts.fetchImpl ?? fetch
  const paths = opts.paths ?? SITEMAP_SMOKE_PATHS
  const base = String(origin).replace(/\/$/, '')

  const results = await Promise.all(
    paths.map(async (path) => {
      const startedAt = Date.now()
      try {
        const res = await doFetch(`${base}${path}`, {
          method: 'GET',
          redirect: 'follow',
          headers: { 'user-agent': CI_PROBE_USER_AGENT },
          signal: AbortSignal.timeout(timeoutMs),
        })
        const body = res.status === 200 ? await res.text() : ''
        return {
          path,
          status: res.status,
          entries: body ? countEntries(body) : 0,
          ms: Date.now() - startedAt,
          error: null,
        }
      } catch (e) {
        return {
          path,
          status: null,
          entries: 0,
          ms: Date.now() - startedAt,
          error: e instanceof Error ? e.message : String(e),
        }
      }
    }),
  )

  const ok = results.every((r) => r.status === 200 && r.entries > 0)
  return { ok, results }
}

/** One line per class, for a human reading a CI log. */
export function formatSitemapSmoke(results) {
  return results.map(
    (r) =>
      `${r.path} ${r.status ?? 'ERR'}${r.error ? ` (${r.error})` : ''} · ${r.entries} entries · ${(r.ms / 1000).toFixed(1)}s`,
  )
}
