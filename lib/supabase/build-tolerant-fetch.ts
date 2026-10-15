/**
 * The fetch the server's Supabase clients use. During `next build` only, a
 * request that lands while PostgREST cannot serve (its schema cache is
 * reloading, or the database is restarting) waits that out instead of failing
 * the prerender, and with it the production deploy. Outside the build it is
 * the plain global fetch, read at call time so Next's patched fetch still
 * applies.
 *
 * WHY (2026-10-14 to 15). Three production builds died on one page each whose
 * read came back from a PostgREST that could not serve for a few seconds:
 *   - 458d4a40a, /sitemaps/video.xml, 23:03:20Z: "[getListingMlsVideos] ...
 *     Could not query the database for the schema cache. Retrying."
 *   - 0a9c47645, /housing-market/sisters, 00:03:31Z: "getMetrics: Could not
 *     query the database for the schema cache. Retrying."
 *   - 4837ad8a8, /housing-market/sisters/black-butte-ranch, 00:08:02Z: same.
 * That is PGRST002, HTTP 503, answered before any query runs. PostgREST's log
 * shows why: a schema change (another session applying a migration at
 * 00:03:20Z) told it to reload its schema cache, the reload's catalog query
 * hit the login role's 8 s statement timeout under the build's load ("Failed
 * to load the schema cache ... 57014"), and every request got PGRST002 until
 * a retry loaded it. Supabase's edge log puts each window at 5 to 20 s of 503s
 * (23:03:15, 23:10:55, 00:03:25, 00:08:00Z). b70e1f9ad (/housing-market/bend,
 * 22:21Z) died the same way on a Cloudflare 520 while the database restarted.
 * Next's own retry (staticGenerationRetryCount) re-renders within a couple of
 * seconds, inside such a window.
 *
 * WHAT IS RETRIED, and only during the build:
 *   - HTTP 503 whose body names PGRST002, for any method: PostgREST answers it
 *     before it runs anything, so a retry cannot apply a write twice;
 *   - for GET and HEAD only, a Cloudflare origin error (520 to 525) or a
 *     transport failure (the fetch threw), the shapes a restart takes.
 * Waits 1, 2, 4, 8 and 15 s (30 s in all), then hands back the last answer or
 * error exactly as before. Nothing else is retried: a pool timeout (PGRST003),
 * a statement timeout or any 4xx is the database answering, and repeating it
 * under load only adds load.
 */

const BUILD_PHASE = 'phase-production-build'

/** Waits between attempts, in ms: 30 s in all. */
export const BUILD_FETCH_RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 15_000] as const

const ORIGIN_ERRORS = new Set([520, 521, 522, 523, 524, 525])

export type BuildTolerantFetchDeps = {
  /** The fetch to call; defaults to the global fetch, read at call time. */
  fetch: typeof fetch
  sleep: (ms: number) => Promise<void>
  inBuild: () => boolean
  log: (line: string) => void
  delaysMs: readonly number[]
}

function requestMethod(input: Parameters<typeof fetch>[0], init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase()
  if (typeof Request !== 'undefined' && input instanceof Request) return input.method.toUpperCase()
  return 'GET'
}

/** The path only: never the query string (filter values) and never a key. */
function requestPath(input: Parameters<typeof fetch>[0]): string {
  try {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    return new URL(raw).pathname
  } catch {
    return '(unparsed url)'
  }
}

function isAbort(err: unknown): boolean {
  return err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')
}

async function schemaCacheUnavailable(res: Response): Promise<boolean> {
  if (res.status !== 503) return false
  try {
    return (await res.clone().text()).includes('PGRST002')
  } catch {
    return false
  }
}

export function createBuildTolerantFetch(deps: Partial<BuildTolerantFetchDeps> = {}): typeof fetch {
  const baseFetch: typeof fetch = deps.fetch ?? ((input, init) => globalThis.fetch(input, init))
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  const inBuild = deps.inBuild ?? (() => process.env.NEXT_PHASE === BUILD_PHASE)
  const log = deps.log ?? ((line: string) => console.warn(line))
  const delays = deps.delaysMs ?? BUILD_FETCH_RETRY_DELAYS_MS

  return (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    if (!inBuild()) return baseFetch(input, init)
    const idempotent = ['GET', 'HEAD'].includes(requestMethod(input, init))
    for (let attempt = 0; ; attempt += 1) {
      const wait = delays[attempt]
      let res: Response
      try {
        res = await baseFetch(input, init)
      } catch (err) {
        if (!idempotent || wait == null || isAbort(err)) throw err
        log(
          `[build-tolerant-fetch] ${requestPath(input)}: request failed (${err instanceof Error ? err.message : String(err)}); ` +
            `retry ${attempt + 1} of ${delays.length} in ${wait} ms`,
        )
        await sleep(wait)
        continue
      }
      const why = (await schemaCacheUnavailable(res))
        ? 'PGRST002, PostgREST schema cache unavailable'
        : idempotent && ORIGIN_ERRORS.has(res.status)
          ? `HTTP ${res.status} from the origin`
          : null
      if (why == null || wait == null) return res
      log(`[build-tolerant-fetch] ${requestPath(input)}: ${why}; retry ${attempt + 1} of ${delays.length} in ${wait} ms`)
      // Release the unread answer without waiting on it: cancelling one side
      // of a teed body (res.clone() above) settles only once the other side
      // is done too.
      void res.body?.cancel().catch(() => {})
      await sleep(wait)
    }
  }) as typeof fetch
}

/** One instance for the server's Supabase clients. */
export const buildTolerantFetch: typeof fetch = createBuildTolerantFetch()
