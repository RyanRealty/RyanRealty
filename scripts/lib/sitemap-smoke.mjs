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
 * therefore 300s per class.
 *
 * TWO WAVES, NOT SIX AT ONCE (2026-10-14). core, geo, content and matrix are
 * four filters of ONE url universe, which an instance builds once and keeps
 * for ten minutes (buildUniverseOnce, lib/sitemap-class-rows.ts). Asked for
 * all four at the same moment right after a deploy, four cold instances each
 * built it, and each build ran the search-matrix inventory read
 * (getSearchMatrixInventory, listing_search_mv, the anon role's 3 s statement
 * timeout): Supabase's edge log shows that read from 4 instances at once at
 * 16:05Z (two of them 500, statement timeout) and from 5 at 16:24Z. The
 * smoke now asks for the index, core and listings first (listings reads its
 * own rows, not the universe), then the other three, by which time the
 * universe core built is in memory to reuse. The whole smoke costs at most two
 * classes' worth of wall clock.
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

/**
 * Asked for first, together: the index, one class that builds the url
 * universe, and listings (its own read). The rest follow once these answer.
 */
export const SITEMAP_SMOKE_FIRST_WAVE = Object.freeze(['/sitemap.xml', '/sitemaps/core.xml', '/sitemaps/listings.xml'])

/** Matches the route's own maxDuration — a shorter budget invents failures. */
export const SITEMAP_SMOKE_TIMEOUT_MS = 300_000

/**
 * One retry, for a TRANSPORT error only (the fetch threw: a dropped tunnel,
 * a reset, a timeout). An HTTP status is the platform's answer and is never
 * retried, so a 504 or a 403 still fails the smoke on the first read. The
 * cloud container's egress relay drops about one of six concurrent tunnels
 * to the same host (2026-10-07, three runs, a different sitemap each time),
 * which read as a dead sitemap while every class answered 200 with entries.
 */
export const SITEMAP_SMOKE_TRANSPORT_RETRIES = 1
const RETRY_DELAY_MS = 1_000

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
 * @param {{ timeoutMs?: number, fetchImpl?: typeof fetch, paths?: readonly string[], transportRetries?: number, retryDelayMs?: number }} [opts]
 * @returns {Promise<{ ok: boolean, results: Array<{ path: string, status: number|null, entries: number, ms: number, error: string|null, retried: number }> }>}
 */
export async function probeSitemapClasses(origin, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? SITEMAP_SMOKE_TIMEOUT_MS
  const doFetch = opts.fetchImpl ?? fetch
  const paths = opts.paths ?? SITEMAP_SMOKE_PATHS
  const retries = opts.transportRetries ?? SITEMAP_SMOKE_TRANSPORT_RETRIES
  const retryDelayMs = opts.retryDelayMs ?? RETRY_DELAY_MS
  const base = String(origin).replace(/\/$/, '')

  const probeOne = async (path) => {
    const startedAt = Date.now()
    let lastError = null
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, retryDelayMs))
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
          retried: attempt,
        }
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e)
      }
    }
    return {
      path,
      status: null,
      entries: 0,
      ms: Date.now() - startedAt,
      error: lastError,
      retried: retries,
    }
  }

  // A caller naming its own paths gets one wave; the default list goes in two.
  const firstWave = opts.paths ? paths : paths.filter((p) => SITEMAP_SMOKE_FIRST_WAVE.includes(p))
  const secondWave = paths.filter((p) => !firstWave.includes(p))
  const byPath = new Map()
  for (const wave of [firstWave, secondWave]) {
    if (wave.length === 0) continue
    for (const r of await Promise.all(wave.map(probeOne))) byPath.set(r.path, r)
  }
  const results = paths.map((p) => byPath.get(p))

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
