/**
 * Edge reader for the set of published blog slugs, for the /blog/<slug> 404
 * guard in middleware.ts (soft-404 found 2026-10-05).
 *
 * WHY THE EDGE HAS TO ANSWER
 * --------------------------
 * app/loading.tsx opens a Suspense boundary on every route, and Next 16 streams
 * metadata (generateMetadata renders inside the body, under that boundary) for
 * every user agent except the HTML-limited bots. Googlebot is not one of them:
 * Next treats it as a JS-running crawler (HEADLESS_BROWSER_BOT_UA_RE in
 * next/dist/shared/lib/router/utils/is-bot.js). So a notFound() thrown from
 * generateMetadata OR the page body lands after the shell has committed
 * HTTP 200, and the on-demand ISR render then caches that 200 "Page not found"
 * document for the route. Measured on ryan-realty.com 2026-10-05: browser UA
 * and Googlebot UA both got 200 + noindex for /blog/zz-<random>. The only way
 * to a real 404 without making the route dynamic or blocking metadata site-wide
 * is to answer before render, which is what /communities already does with its
 * static registry. Blog slugs live in the database, so this reads them.
 *
 * SHAPE: one PostgREST GET of every published slug (93 rows on 2026-10-05,
 * slugs only), anon key, the same role, table and `status = 'published'`
 * filter getBlogPostBySlug uses, so a draft (invisible to anon under RLS and
 * filtered anyway) is a miss here exactly as it is there. The set is held per
 * isolate for 5 minutes and concurrent requests share one fetch. A slug absent
 * from a set older than 30 seconds triggers one refetch before it is called
 * missing, so a post published a moment ago is not 404'd for 5 minutes.
 *
 * FAILURE IS A PASS-THROUGH. Every error, timeout, missing env or suspicious
 * body returns 'unknown' and the request renders exactly as before this guard
 * (the route's own notFound()). The guard can cost latency on a cold isolate;
 * it can never 404 a published post because a read failed.
 */

import { BUYER_CLOSING_COSTS_SLUG } from '@/lib/blog/buyer-closing-costs'

export type BlogSlugLookup = 'published' | 'missing' | 'unknown'

const SET_TTL_MS = 5 * 60_000
const MISS_RECHECK_MS = 30_000
const DEFAULT_TIMEOUT_MS = 1_500
/** Far above the live count; a body this long means pagination cut it, so trust nothing. */
const ROW_CEILING = 5_000

/**
 * Slugs getBlogPostBySlug answers WITHOUT a published row (its seed fallback),
 * so the page renders them even when the table has no such row.
 */
const ALWAYS_PUBLISHED: ReadonlySet<string> = new Set([BUYER_CLOSING_COSTS_SLUG])

type SlugSet = { fetchedAt: number; slugs: ReadonlySet<string> }
let current: SlugSet | null = null
let inflight: Promise<SlugSet | null> | null = null

/** Test seam: drop the memoised set. */
export function resetPublishedBlogSlugsEdgeCache(): void {
  current = null
  inflight = null
}

export type BlogSlugEdgeOptions = {
  fetchImpl?: typeof fetch
  timeoutMs?: number
  now?: () => number
  supabaseUrl?: string | undefined
  anonKey?: string | undefined
}

async function fetchSet(opts: BlogSlugEdgeOptions): Promise<SlugSet | null> {
  const url = (opts.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim().replace(/\/$/, '')
  const key = (opts.anonKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim()
  if (!url || !key) return null
  const fetchImpl = opts.fetchImpl ?? fetch
  const params = new URLSearchParams({ select: 'slug', status: 'eq.published', limit: String(ROW_CEILING) })
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  try {
    const res = await fetchImpl(`${url}/rest/v1/blog_posts?${params.toString()}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
      signal: ctrl.signal,
    })
    if (!res.ok) return null
    const data = (await res.json()) as unknown
    if (!Array.isArray(data) || data.length >= ROW_CEILING) return null
    const slugs = new Set<string>()
    for (const row of data) {
      const slug = row && typeof row === 'object' ? (row as { slug?: unknown }).slug : null
      if (typeof slug === 'string' && slug) slugs.add(slug)
    }
    // An empty published set is not a state this site can be in; treat it as a
    // bad read rather than 404 every post.
    if (slugs.size === 0) return null
    return { fetchedAt: (opts.now ?? Date.now)(), slugs }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function refresh(opts: BlogSlugEdgeOptions): Promise<SlugSet | null> {
  if (inflight) return inflight
  inflight = fetchSet(opts)
    .then((set) => {
      // A failed read never replaces a good set and is never memoised.
      if (set) current = set
      return set
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

/** Is there a published post at /blog/<slug>? 'unknown' means the read failed: pass through. */
export async function lookupPublishedBlogSlugEdge(
  rawSlug: string,
  opts: BlogSlugEdgeOptions = {},
): Promise<BlogSlugLookup> {
  const slug = String(rawSlug ?? '')
  if (!slug) return 'unknown'
  if (ALWAYS_PUBLISHED.has(slug)) return 'published'
  const now = (opts.now ?? Date.now)()
  let set = current && now - current.fetchedAt < SET_TTL_MS ? current : await refresh(opts)
  if (!set) return 'unknown'
  if (set.slugs.has(slug)) return 'published'
  if ((opts.now ?? Date.now)() - set.fetchedAt >= MISS_RECHECK_MS) {
    set = await refresh(opts)
    if (!set) return 'unknown'
    if (set.slugs.has(slug)) return 'published'
  }
  return 'missing'
}
