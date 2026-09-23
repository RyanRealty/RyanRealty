/**
 * /_next/image — the retired optimizer URL, answered at the edge.
 *
 * WHAT BROKE. Matt's 2026-09-13 lock (next.config.ts `images.unoptimized: true`,
 * commit 9794e028d) switched Vercel Image Optimization off for every image, so
 * next/image now emits the source URL directly and the optimizer route no
 * longer exists. Every /_next/image?url=X URL emitted before that date (indexed
 * listing photos in Google Images, cached HTML, other sites' hotlinks) then fell
 * through to the app's HTML not-found page: 142,610 bytes on 2026-09-22,
 * 143,025 on 09-23 (curl, Chrome UA), and a full root-layout
 * render per request, which also mounted the web-vitals reporter. /_next/image
 * LCP rows were 0 every day 2026-08-23..09-12, then 984 on 09-13 and 4,349 on
 * 09-14 (public.web_vitals, metric LCP, path '/_next/image', by UTC day), and
 * held 17,092 of 41,934 LCP rows 2026-09-08..09-21 (visibility audit
 * 2026-09-22, TRACK-3). The images themselves still existed:
 * /images/communities/broken-top.jpg answered 200 image/jpeg direct while its
 * /_next/image URL answered the 404 page.
 *
 * THE ANSWER. middleware.ts matches /_next/image (its main matcher still skips
 * it) and hands the request here BEFORE anything else runs, so the request never
 * reaches the app:
 *   - `url` is a same-origin path, or an https URL on a host the site already
 *     served through the optimizer (next.config.ts images.remotePatterns,
 *     tightened below) -> 308 to that URL. The photo resolves and search keeps
 *     the image.
 *   - anything else -> a 4-byte 410. Nothing renders.
 *
 * This does NOT re-enable optimization (Matt lock). A redirect costs one edge
 * invocation and no image transformation.
 *
 * WHY THE ALLOWLIST IS TIGHTER THAN remotePatterns. The optimizer PROXIED a
 * remote image; a redirect SENDS the visitor to it. A wildcard host such as
 * `*.supabase.co` or `*.googleusercontent.com` would turn this route into an
 * open redirect onto anyone's storage bucket, so each family is pinned to the
 * hosts this site actually uses:
 *   - Supabase: this project's host only, public-object paths only (the pattern
 *     next.config.ts already required).
 *   - Spark/FlexMLS photo CDNs: `cdn.<name>.sparkplatform.com`
 *     (cdn.photos + cdn.resize today), plus the two Spark API hosts listed in
 *     remotePatterns.
 *   - Google avatars: `lh<n>.googleusercontent.com`.
 *   - images.unsplash.com.
 * `http://localhost` from remotePatterns is a dev-only entry and is excluded.
 *
 * Pure: takes the request URL, returns a decision. The Response lives in
 * middleware.ts.
 */

export const LEGACY_NEXT_IMAGE_PATH = '/_next/image'

/** This project's Supabase host (CLAUDE.md §7, project dwvlophlbvvygjfxcrhm). */
const SUPABASE_PROJECT_HOST = 'dwvlophlbvvygjfxcrhm.supabase.co'
const SUPABASE_PUBLIC_OBJECT_PREFIX = '/storage/v1/object/public/'

const EXACT_REMOTE_HOSTS = new Set([
  'images.unsplash.com',
  'replication.sparkapi.com',
  'sparkapi.com',
  SUPABASE_PROJECT_HOST,
])

const SPARK_CDN_HOST = /^cdn\.[a-z0-9-]+\.sparkplatform\.com$/
const GOOGLE_AVATAR_HOST = /^lh\d+\.googleusercontent\.com$/

export type LegacyNextImageDecision =
  | { kind: 'redirect'; location: string }
  | { kind: 'gone'; reason: string }

function isAllowedRemote(target: URL): boolean {
  if (target.protocol !== 'https:') return false
  if (target.username || target.password || target.port) return false
  const host = target.hostname.toLowerCase()
  if (host === SUPABASE_PROJECT_HOST) {
    return target.pathname.startsWith(SUPABASE_PUBLIC_OBJECT_PREFIX)
  }
  return EXACT_REMOTE_HOSTS.has(host) || SPARK_CDN_HOST.test(host) || GOOGLE_AVATAR_HOST.test(host)
}

/**
 * Map one /_next/image request to where its image lives now.
 *
 * `requestUrl` is the full URL of the incoming request (its origin decides what
 * "same-origin" means, so a preview host redirects to its own files).
 */
export function resolveLegacyNextImage(requestUrl: URL): LegacyNextImageDecision {
  const values = requestUrl.searchParams.getAll('url')
  // The optimizer itself refused a missing or repeated `url` with a 400, so no
  // working image URL ever had either shape.
  if (values.length !== 1) return { kind: 'gone', reason: values.length === 0 ? 'no-url' : 'multiple-url' }
  const raw = values[0].trim()
  if (!raw) return { kind: 'gone', reason: 'empty-url' }
  // Control characters and backslashes have no place in an image URL, and a
  // backslash is the classic way to smuggle `/\evil.com` past a "starts with /"
  // check (WHATWG parsing turns it into `//evil.com`).
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return { kind: 'gone', reason: 'unsafe-characters' }

  if (raw.startsWith('/')) {
    // Protocol-relative (`//host/...`) is a remote URL wearing a local prefix.
    if (raw.startsWith('//')) return { kind: 'gone', reason: 'protocol-relative' }
    let target: URL
    try {
      target = new URL(raw, requestUrl.origin)
    } catch {
      return { kind: 'gone', reason: 'unparseable' }
    }
    if (target.origin !== requestUrl.origin) return { kind: 'gone', reason: 'cross-origin' }
    // A nested optimizer URL would bounce straight back here.
    if (target.pathname === LEGACY_NEXT_IMAGE_PATH || target.pathname.startsWith(`${LEGACY_NEXT_IMAGE_PATH}/`)) {
      return { kind: 'gone', reason: 'nested-optimizer' }
    }
    return { kind: 'redirect', location: target.href }
  }

  let target: URL
  try {
    target = new URL(raw)
  } catch {
    return { kind: 'gone', reason: 'unparseable' }
  }
  if (!isAllowedRemote(target)) return { kind: 'gone', reason: 'host-not-allowed' }
  return { kind: 'redirect', location: target.href }
}

/** The body of the 410. Deliberately tiny: nothing about it should cost a render. */
export const LEGACY_NEXT_IMAGE_GONE_BODY = 'Gone'

/**
 * Cache lifetime for both answers, in seconds (one day). The mapping from a
 * given URL is deterministic, so a browser or CDN may keep it; a day keeps a
 * mistaken allowlist edit from living in caches for long.
 */
export const LEGACY_NEXT_IMAGE_CACHE_SECONDS = 86_400
