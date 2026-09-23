/**
 * Crawl-surface probe: the pure half. Parsers, the daily sampler, and one
 * evaluator per check. No I/O lives here; lib/crawl-probe/run.ts does the
 * fetching and app/api/cron/crawl-probe/route.ts does the writing and alerting.
 *
 * WHY (visibility audit 2026-09-22, gsc-trend-7 / SEO-2 / SEO-9): the one
 * sustained click loss in the Search Console record (-30%, 2026-07-27 to
 * 08-23, average position 13.9 to 17.5) lined up with a run of sitemap and
 * deploy outages (124348def, aa56d308d, 996ece96a, 0dbf2f1cc). Every one was
 * found weeks later by an agent reading GSC, never by a monitor. The sitemaps
 * broke again on 09-09 (geo.xml past the 300 s ceiling) and 09-16 (keyset
 * paging), and the audit reproduced HTTP 500s on 4 of 16 plat pages fetched
 * with a Googlebot UA at concurrency 8. Each check below is a way one of those
 * breaks would have shown up on the first day instead of the fifth week.
 */
import { redirectDestination } from '@/lib/routing/redirect-destination'

export { redirectDestination }

export type CheckMetric =
  | 'run'
  | 'sitemap_index'
  | 'sitemap_child'
  | 'page_fetch'
  | 'homepage_scripts'
  | 'gsc_sitemap'
  | 'gsc_inspection'

export type CrawlCheck = {
  metric: CheckMetric
  /** Path the check is about ('/sitemaps/geo.xml', '/subdivisions/x'); '' for the run summary. */
  surface: string
  status: 'pass' | 'fail'
  /** One plain sentence per failure. Empty when the check passes. */
  failures: string[]
  /** Measurements, stored as metadata on the row. */
  data: Record<string, unknown>
}

/** A sitemap child must answer inside this budget. Healthy children answered in 0.2-0.9 s on 2026-09-23. */
export const SITEMAP_BUDGET_MS = 20_000
/** A sitemapped page slower than this is flagged (P15 spec). */
export const PAGE_SLOW_MS = 5_000
/** A child's URL count may move this far from its expectation before it fails. */
export const COUNT_TOLERANCE = 0.05
/** Google has not re-read a submitted sitemap in this many days: something is wrong with it. */
export const GSC_STALE_DOWNLOAD_DAYS = 14

function check(metric: CheckMetric, surface: string, failures: string[], data: Record<string, unknown>): CrawlCheck {
  return { metric, surface, status: failures.length === 0 ? 'pass' : 'fail', failures, data }
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

function decodeXmlText(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

/** Every <loc> in a sitemap or sitemap index, in document order. */
export function parseSitemapLocs(xml: string): string[] {
  const out: string[] = []
  for (const m of String(xml ?? '').matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)) out.push(decodeXmlText(m[1]))
  return out
}

/** Root element of a sitemap document: 'sitemapindex', 'urlset', or null when it is neither. */
export function sitemapRoot(xml: string): 'sitemapindex' | 'urlset' | null {
  const m = /<(sitemapindex|urlset)\b/.exec(String(xml ?? ''))
  return m ? (m[1] as 'sitemapindex' | 'urlset') : null
}

/** Path of a URL with the trailing slash dropped ('/' stays '/'). Null when unparseable. */
export function pathOf(url: string): string | null {
  try {
    return new URL(url).pathname.replace(/\/+$/, '') || '/'
  } catch {
    return null
  }
}

const ATTR_RE = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g

function attrs(tagInner: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of tagInner.matchAll(ATTR_RE)) {
    const name = m[1].toLowerCase()
    if (!(name in out)) out[name] = m[2] ?? m[3] ?? m[4] ?? ''
  }
  return out
}

/** content="" of every <meta name="robots|googlebot">. */
export function robotsMetaContents(html: string): string[] {
  const out: string[] = []
  for (const m of String(html ?? '').matchAll(/<meta\b([^>]*)>/gi)) {
    const a = attrs(m[1])
    const name = (a.name ?? '').trim().toLowerCase()
    if (name === 'robots' || name === 'googlebot') out.push(a.content ?? '')
  }
  return out
}

/** href of every <link rel="canonical">, in document order. */
export function canonicalHrefs(html: string): string[] {
  const out: string[] = []
  for (const m of String(html ?? '').matchAll(/<link\b([^>]*)>/gi)) {
    const a = attrs(m[1])
    const rel = (a.rel ?? '').toLowerCase().split(/\s+/)
    if (rel.includes('canonical') && a.href) out.push(decodeXmlText(a.href))
  }
  return out
}

const NOINDEX_RE = /(^|[\s,])(noindex|none)($|[\s,])/i

/** A robots directive string (meta content) that tells Google not to index. */
export function isNoindexDirective(content: string): boolean {
  return NOINDEX_RE.test(String(content ?? ''))
}

const ROBOTS_DIRECTIVE_NAME =
  /^(all|noindex|nofollow|none|noarchive|nosnippet|notranslate|noimageindex|indexifembedded|unavailable_after|max-snippet|max-image-preview|max-video-preview)$/i

/**
 * X-Robots-Tag noindex that applies to Googlebot. A value scoped to another
 * crawler ("bingbot: noindex") does not count.
 */
export function isNoindexHeader(value: string | null): boolean {
  if (!value) return false
  const scoped = /^\s*([a-z0-9_-]+)\s*:\s*(.*)$/i.exec(value)
  // "unavailable_after: <date>" and "max-snippet: 20" are directives, not a
  // crawler prefix, so only a non-directive token before the colon scopes it.
  if (scoped && !ROBOTS_DIRECTIVE_NAME.test(scoped[1])) {
    return scoped[1].toLowerCase() === 'googlebot' && isNoindexDirective(scoped[2])
  }
  return isNoindexDirective(value)
}

/** Scheme + lower-cased host + path without a trailing slash + query. */
export function normalizeUrl(url: string, base?: string): string | null {
  try {
    const u = new URL(url, base)
    const path = u.pathname.replace(/\/+$/, '') || '/'
    return `${u.protocol}//${u.host.toLowerCase()}${path}${u.search}`
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Known redirect sources
// ---------------------------------------------------------------------------

/**
 * Paths in `paths` that middleware redirects, with where each one goes. Judged
 * by middleware's own resolvers (lib/routing/redirect-destination.ts), so this
 * check cannot disagree with what a crawler is actually served.
 */
export function knownRedirectSources(paths: readonly string[]): Array<{ path: string; to: string }> {
  const out: Array<{ path: string; to: string }> = []
  for (const p of paths) {
    const to = redirectDestination(p)
    if (to) out.push({ path: p, to })
  }
  return out
}

// ---------------------------------------------------------------------------
// Sampler
// ---------------------------------------------------------------------------

/** Sitemap child name from its URL: https://x/sitemaps/geo.xml -> 'geo'. */
export function childName(url: string): string {
  const p = pathOf(url) ?? url
  return (p.split('/').pop() ?? p).replace(/\.xml$/, '')
}

/**
 * Page class of a sitemapped path: the child it came from plus its route
 * shape. '/subdivisions/x' in geo.xml is 'geo:/subdivisions/*'; every
 * one-segment page is pooled as '{child}:/*'. Derived from the URL rather than
 * a hand list, so a new route family is sampled the day it enters a sitemap.
 */
export function pageClassOf(child: string, path: string): string {
  const seg = path.split('/').filter(Boolean)
  if (seg.length === 0) return `${child}:/`
  if (seg.length === 1) return `${child}:/*`
  return `${child}:/${seg[0]}${'/*'.repeat(seg.length - 1)}`
}

/** Whole days since the epoch, UTC. The sampler's rotation key. */
export function utcDayIndex(now: Date): number {
  return Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 86_400_000)
}

export type SampledUrl = { url: string; path: string; cls: string }

/**
 * Up to `perClass` URLs from each page class, rotating by day. The class is
 * sorted, split into `perClass` evenly spaced picks, and the day shifts the
 * starting point, so each day's sample spans the whole class and every URL is
 * visited once per floor(size / perClass) days. Deterministic: a re-run on the
 * same day samples the same URLs, so its rows overwrite rather than pile up.
 */
export function sampleByClass(
  entries: ReadonlyArray<{ url: string; child: string }>,
  dayIndex: number,
  perClass: number,
): SampledUrl[] {
  const byClass = new Map<string, Map<string, string>>()
  for (const e of entries) {
    const path = pathOf(e.url)
    if (!path) continue
    const cls = pageClassOf(e.child, path)
    const bucket = byClass.get(cls) ?? new Map<string, string>()
    if (!bucket.has(path)) bucket.set(path, e.url)
    byClass.set(cls, bucket)
  }
  const out: SampledUrl[] = []
  const seen = new Set<string>()
  for (const cls of [...byClass.keys()].sort()) {
    const bucket = byClass.get(cls)!
    const paths = [...bucket.keys()].sort()
    let picks: string[]
    if (paths.length <= perClass) {
      picks = paths
    } else {
      const step = Math.floor(paths.length / perClass)
      const offset = ((dayIndex % step) + step) % step
      picks = Array.from({ length: perClass }, (_, k) => paths[offset + k * step])
    }
    for (const path of picks) {
      if (seen.has(path)) continue
      seen.add(path)
      out.push({ url: bucket.get(path)!, path, cls })
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Evaluators
// ---------------------------------------------------------------------------

export type FetchOutcome = {
  status: number
  ms: number
  body: string
  error?: string
  headers?: Record<string, string | null>
}

function fetchFailure(label: string, r: FetchOutcome, budgetMs: number): string[] {
  const out: string[] = []
  if (r.status === 0) out.push(`${label} did not answer (${r.error ?? 'no response'})`)
  else if (r.status !== 200) out.push(`${label} returned HTTP ${r.status}`)
  if (r.status !== 0 && r.ms > budgetMs) out.push(`${label} took ${r.ms} ms, over the ${budgetMs} ms budget`)
  return out
}

/**
 * The sitemap index: 200 inside the budget, a <sitemapindex>, every expected
 * child listed, and no URL listed by two children (each URL belongs to exactly
 * one class; lib/data/sitemap/classify.ts is total).
 */
export function evaluateSitemapIndex(input: {
  path: string
  fetch: FetchOutcome
  expectedChildUrls: readonly string[]
  crossChildDuplicates: number
  budgetMs?: number
}): CrawlCheck {
  const { fetch: r } = input
  const failures = fetchFailure(input.path, r, input.budgetMs ?? SITEMAP_BUDGET_MS)
  const listed = r.status === 200 ? parseSitemapLocs(r.body) : []
  const missing: string[] = []
  if (r.status === 200) {
    if (sitemapRoot(r.body) !== 'sitemapindex') failures.push(`${input.path} is not a <sitemapindex>`)
    const have = new Set(listed)
    for (const u of input.expectedChildUrls) if (!have.has(u)) missing.push(u)
    if (missing.length) failures.push(`sitemap index is missing ${missing.length} child sitemap(s): ${missing.join(', ')}`)
  }
  if (input.crossChildDuplicates > 0) {
    failures.push(`${input.crossChildDuplicates} URL(s) are listed by more than one child sitemap`)
  }
  return check('sitemap_index', input.path, failures, {
    httpStatus: r.status,
    ms: r.ms,
    cache: r.headers?.['x-vercel-cache'] ?? null,
    children: listed,
    missingChildren: missing,
    crossChildDuplicates: input.crossChildDuplicates,
  })
}

/** Signed fractional change of `actual` from `expected`; null when there is no expectation. */
export function countDelta(actual: number, expected: number | null): number | null {
  if (expected == null || !Number.isFinite(expected) || expected <= 0) return null
  return (actual - expected) / expected
}

export type CountExpectation = { count: number; source: string } | null

/** A Search Console submitted count older than this is no expectation for today's count. */
export const GSC_EXPECTATION_MAX_AGE_DAYS = 2

/**
 * What a child sitemap's URL count is held to. The probe's own count from the
 * most recent earlier day comes first (the P15 spec's "yesterday's probe
 * row"). With no earlier run, Search Console's submitted count stands in, but
 * only when Google downloaded the sitemap within GSC_EXPECTATION_MAX_AGE_DAYS:
 * on 2026-09-23 matrix.xml listed 748 URLs against a 867 Google counted on
 * 09-20, and a three-day-old count is not a basis for a 5% tolerance. Otherwise
 * null: the row records "no baseline" and the count is not judged.
 */
export function childCountExpectation(
  fromProbe: { count: number; date: string } | undefined,
  gscEntry: GscSitemapEntry | undefined,
  now: Date,
): CountExpectation {
  if (fromProbe) return { count: fromProbe.count, source: `crawl probe ${fromProbe.date}` }
  if (!gscEntry) return null
  const submitted = (gscEntry.contents ?? []).reduce((s, c) => s + (Number(c.submitted ?? 0) || 0), 0)
  const downloadedMs = gscEntry.lastDownloaded ? Date.parse(gscEntry.lastDownloaded) : NaN
  if (submitted <= 0 || !Number.isFinite(downloadedMs)) return null
  if ((now.getTime() - downloadedMs) / 86_400_000 > GSC_EXPECTATION_MAX_AGE_DAYS) return null
  return { count: submitted, source: `Search Console submitted count, downloaded ${gscEntry.lastDownloaded!.slice(0, 10)}` }
}

/**
 * One child sitemap: 200 inside the budget, a <urlset> with at least one URL,
 * a URL count within COUNT_TOLERANCE of its expectation, every URL once, every
 * URL on the canonical host, and none a known redirect source.
 */
export function evaluateSitemapChild(input: {
  path: string
  fetch: FetchOutcome
  origin: string
  expected: CountExpectation
  budgetMs?: number
  tolerance?: number
}): CrawlCheck & { locs: string[] } {
  const { fetch: r } = input
  const tolerance = input.tolerance ?? COUNT_TOLERANCE
  const failures = fetchFailure(input.path, r, input.budgetMs ?? SITEMAP_BUDGET_MS)
  const locs = r.status === 200 ? parseSitemapLocs(r.body) : []
  // x-vercel-cache says whether a slow answer was a cold render (MISS) or
  // came from the CDN (HIT / STALE), which points at different fixes.
  const data: Record<string, unknown> = {
    httpStatus: r.status,
    ms: r.ms,
    bytes: r.body.length,
    cache: r.headers?.['x-vercel-cache'] ?? null,
  }
  if (r.status === 200) {
    if (sitemapRoot(r.body) !== 'urlset') failures.push(`${input.path} is not a <urlset>`)
    if (locs.length === 0) failures.push(`${input.path} lists no URLs`)

    const seen = new Set<string>()
    const duplicates: string[] = []
    const offHost: string[] = []
    for (const loc of locs) {
      let u: URL | null = null
      try {
        u = new URL(loc)
      } catch {
        offHost.push(loc)
        continue
      }
      if (u.origin !== input.origin) offHost.push(loc)
      const p = u.pathname.replace(/\/+$/, '') || '/'
      if (seen.has(p)) duplicates.push(p)
      else seen.add(p)
    }
    const redirects = knownRedirectSources([...seen])
    const delta = countDelta(locs.length, input.expected?.count ?? null)

    if (duplicates.length) {
      failures.push(`${duplicates.length} duplicate URL(s) in ${input.path} (first: ${duplicates.slice(0, 3).join(', ')})`)
    }
    if (offHost.length) {
      failures.push(`${offHost.length} URL(s) in ${input.path} are not on ${input.origin} (first: ${offHost.slice(0, 2).join(', ')})`)
    }
    if (redirects.length) {
      const first = redirects.slice(0, 3).map((r) => `${r.path} -> ${r.to}`)
      failures.push(`${redirects.length} redirect source(s) in ${input.path} (first: ${first.join(', ')})`)
    }
    if (delta != null && Math.abs(delta) > tolerance) {
      failures.push(
        `${input.path} lists ${locs.length} URLs, ${delta > 0 ? '+' : ''}${(delta * 100).toFixed(1)}% from the expected ${input.expected!.count} (${input.expected!.source})`,
      )
    }
    Object.assign(data, {
      urlCount: locs.length,
      uniqueCount: seen.size,
      duplicates: duplicates.length,
      duplicateSample: duplicates.slice(0, 5),
      offHost: offHost.length,
      redirectSources: redirects.length,
      redirectSample: redirects.slice(0, 5).map((r) => `${r.path} -> ${r.to}`),
      expectedCount: input.expected?.count ?? null,
      expectedSource: input.expected?.source ?? 'no baseline: no earlier probe count and no Search Console count from the last 2 days',
      deltaPct: delta == null ? null : Math.round(delta * 1000) / 10,
    })
  }
  return { ...check('sitemap_child', input.path, failures, data), locs }
}

export type PageFetchOutcome = FetchOutcome & {
  url: string
  path: string
  cls: string
  ttfbMs: number
}

/**
 * One sampled sitemapped page, fetched as Googlebot. A sitemap promises Google
 * a 200, indexable, self-canonical page, so every deviation fails: 5xx, any
 * redirect or 4xx, noindex (meta or header), a canonical that points elsewhere
 * or disagrees with itself, and a fetch slower than PAGE_SLOW_MS.
 */
export function evaluatePageFetch(r: PageFetchOutcome, slowMs = PAGE_SLOW_MS): CrawlCheck {
  const failures: string[] = []
  const header = (k: string) => r.headers?.[k] ?? null
  const data: Record<string, unknown> = {
    cls: r.cls,
    httpStatus: r.status,
    ttfbMs: r.ttfbMs,
    ms: r.ms,
    cache: header('x-vercel-cache'),
    robots: null,
    xRobotsTag: header('x-robots-tag'),
    canonical: null,
    canonicalMatches: null,
  }
  if (r.status === 0) failures.push(`no response (${r.error ?? 'fetch failed'})`)
  else if (r.status >= 500) failures.push(`HTTP ${r.status}`)
  else if (r.status >= 300 && r.status < 400) failures.push(`redirects (HTTP ${r.status} to ${header('location') ?? 'unknown'})`)
  else if (r.status !== 200) failures.push(`HTTP ${r.status}`)

  if (r.status === 200) {
    const robots = robotsMetaContents(r.body)
    data.robots = robots.length ? robots.join(' | ') : null
    if (robots.some(isNoindexDirective)) failures.push(`noindex on a sitemapped URL (meta robots "${robots.join(' | ')}")`)
    if (isNoindexHeader(header('x-robots-tag'))) failures.push(`noindex on a sitemapped URL (X-Robots-Tag "${header('x-robots-tag')}")`)

    const canonicals = canonicalHrefs(r.body)
    const normalized = [...new Set(canonicals.map((c) => normalizeUrl(c, r.url)).filter((c): c is string => c !== null))]
    data.canonical = canonicals[0] ?? null
    if (normalized.length > 1) {
      failures.push(`conflicting canonicals: ${normalized.join(', ')}`)
      data.canonicalMatches = false
    } else if (normalized.length === 1) {
      const self = normalizeUrl(r.url)
      data.canonicalMatches = normalized[0] === self
      if (normalized[0] !== self) failures.push(`canonical points elsewhere: ${canonicals[0]}`)
    }
  }
  if (r.status !== 0 && r.ms > slowMs) failures.push(`slow: ${r.ms} ms (over ${slowMs} ms)`)
  return check('page_fetch', r.path, failures, data)
}

/** Wrap the shared inline-script report for the homepage row. */
export function evaluateHomepageScripts(
  r: FetchOutcome,
  report: { ok: boolean; failures: string[]; inline: number; js: number; json: number; skipped: number; gtm: unknown } | null,
): CrawlCheck {
  const failures = fetchFailure('homepage', r, SITEMAP_BUDGET_MS)
  if (report) failures.push(...report.failures)
  return check('homepage_scripts', '/', failures, {
    httpStatus: r.status,
    ms: r.ms,
    inline: report?.inline ?? null,
    js: report?.js ?? null,
    json: report?.json ?? null,
    skipped: report?.skipped ?? null,
    gtm: report?.gtm ?? null,
  })
}

export type GscSitemapEntry = {
  path?: string | null
  lastSubmitted?: string | null
  lastDownloaded?: string | null
  isPending?: boolean | null
  isSitemapsIndex?: boolean | null
  errors?: string | number | null
  warnings?: string | number | null
  contents?: Array<{ type?: string | null; submitted?: string | number | null; indexed?: string | number | null }> | null
}

/**
 * One sitemap as Search Console holds it. Fails when Google reports errors on
 * it or has not downloaded it in GSC_STALE_DOWNLOAD_DAYS.
 *
 * `indexed` is NOT read: the Sitemaps API stopped populating it and returns
 * "0" for every sitemap (it read "0" on all six on 2026-09-23, while URL
 * Inspection returned "Submitted and indexed" for URLs in the same sitemaps).
 * Recording that 0 would be a fabricated number (CLAUDE.md §0), so the indexed
 * side comes from the gsc_inspection sample instead.
 */
export function evaluateGscSitemap(entry: GscSitemapEntry, liveCount: number | null, now: Date): CrawlCheck {
  const path = pathOf(entry.path ?? '') ?? String(entry.path ?? '')
  const failures: string[] = []
  const errors = Number(entry.errors ?? 0) || 0
  const warnings = Number(entry.warnings ?? 0) || 0
  const submitted = (entry.contents ?? []).reduce((sum, c) => sum + (Number(c.submitted ?? 0) || 0), 0)
  const downloadedMs = entry.lastDownloaded ? Date.parse(entry.lastDownloaded) : NaN
  const downloadAgeDays = Number.isFinite(downloadedMs) ? (now.getTime() - downloadedMs) / 86_400_000 : null

  if (errors > 0) failures.push(`Search Console reports ${errors} error(s) on ${path}`)
  if (!entry.isPending) {
    if (downloadAgeDays == null) failures.push(`Search Console has never downloaded ${path}`)
    else if (downloadAgeDays > GSC_STALE_DOWNLOAD_DAYS) {
      failures.push(`Google last downloaded ${path} ${Math.floor(downloadAgeDays)} days ago`)
    }
  }
  const delta = liveCount == null ? null : countDelta(liveCount, submitted)
  return check('gsc_sitemap', path, failures, {
    submitted,
    indexed: null,
    indexedNote: 'Sitemaps API no longer populates indexed; see gsc_inspection rows',
    liveCount,
    liveVsSubmittedPct: delta == null ? null : Math.round(delta * 1000) / 10,
    errors,
    warnings,
    isPending: Boolean(entry.isPending),
    isSitemapsIndex: Boolean(entry.isSitemapsIndex),
    lastSubmitted: entry.lastSubmitted ?? null,
    lastDownloaded: entry.lastDownloaded ?? null,
    downloadAgeDays: downloadAgeDays == null ? null : Math.round(downloadAgeDays * 10) / 10,
  })
}

export type GscIndexStatus = {
  verdict?: string | null
  coverageState?: string | null
  robotsTxtState?: string | null
  indexingState?: string | null
  lastCrawlTime?: string | null
  pageFetchState?: string | null
  googleCanonical?: string | null
  userCanonical?: string | null
}

/**
 * One sampled URL as Google last saw it (URL Inspection API). Fails when
 * Google's own last fetch of a sitemapped URL failed (a 5xx, soft 404, or
 * redirect error Google recorded) or robots.txt blocks it.
 *
 * A noindex Google saw is RECORDED (googleSawNoindex), not failed. Google's
 * view can be weeks old: on 2026-09-23 it still held a 2026-09-12 noindex for
 * /homes-for-sale/bend, which served index,follow that same minute. Whether the
 * page is noindex NOW is the page_fetch check's job, measured the same run.
 * Not being indexed yet is likewise an outcome to trend per class, not a
 * crawl-surface break.
 */
export function evaluateInspection(path: string, cls: string, result: GscIndexStatus | null, error?: string): CrawlCheck {
  if (!result) {
    return check('gsc_inspection', path, [`Search Console inspection failed: ${error ?? 'no result'}`], { cls })
  }
  const failures: string[] = []
  const fetchState = result.pageFetchState ?? null
  if (fetchState && fetchState !== 'SUCCESSFUL' && fetchState !== 'PAGE_FETCH_STATE_UNSPECIFIED') {
    failures.push(`Google's last fetch (${result.lastCrawlTime?.slice(0, 10) ?? 'date unknown'}): ${fetchState}`)
  }
  if (result.robotsTxtState === 'DISALLOWED') failures.push('blocked by robots.txt')
  const g = result.googleCanonical ? normalizeUrl(result.googleCanonical) : null
  const u = result.userCanonical ? normalizeUrl(result.userCanonical) : null
  return check('gsc_inspection', path, failures, {
    cls,
    indexed: result.verdict === 'PASS',
    googleSawNoindex: Boolean(result.indexingState && result.indexingState.startsWith('BLOCKED')),
    verdict: result.verdict ?? null,
    coverageState: result.coverageState ?? null,
    pageFetchState: fetchState,
    robotsTxtState: result.robotsTxtState ?? null,
    indexingState: result.indexingState ?? null,
    lastCrawlTime: result.lastCrawlTime ?? null,
    googleCanonical: result.googleCanonical ?? null,
    userCanonical: result.userCanonical ?? null,
    canonicalAgrees: g && u ? g === u : null,
  })
}

// ---------------------------------------------------------------------------
// Summary + alert
// ---------------------------------------------------------------------------

export function summarizeRun(checks: readonly CrawlCheck[], extra: Record<string, unknown>): CrawlCheck {
  const failed = checks.filter((c) => c.status === 'fail')
  const byMetric: Record<string, { total: number; failed: number }> = {}
  for (const c of checks) {
    const m = (byMetric[c.metric] ??= { total: 0, failed: 0 })
    m.total += 1
    if (c.status === 'fail') m.failed += 1
  }
  const pages = checks.filter((c) => c.metric === 'page_fetch')
  const pageStat = (re: RegExp) => pages.filter((c) => c.failures.some((f) => re.test(f))).length
  const inspections = checks.filter((c) => c.metric === 'gsc_inspection' && typeof c.data.indexed === 'boolean')
  const indexedByClass: Record<string, { inspected: number; indexed: number }> = {}
  for (const c of inspections) {
    const k = String(c.data.cls ?? 'unknown')
    const e = (indexedByClass[k] ??= { inspected: 0, indexed: 0 })
    e.inspected += 1
    if (c.data.indexed === true) e.indexed += 1
  }
  const googleHoldsNoindex = inspections.filter((c) => c.data.googleSawNoindex === true).map((c) => c.surface)
  const failures = failed.slice(0, 25).map((c) => `${c.metric} ${c.surface || '(run)'}: ${c.failures[0]}`)
  const summary = check('run', '', failed.length ? [`${failed.length} of ${checks.length} checks failed`] : [], {
    checks: checks.length,
    failed: failed.length,
    byMetric,
    failures,
    pageFetch: {
      sampled: pages.length,
      classes: new Set(pages.map((c) => String(c.data.cls))).size,
      http5xx: pageStat(/^HTTP 5\d\d/),
      redirects: pageStat(/^redirects/),
      http4xx: pageStat(/^HTTP 4\d\d/),
      noResponse: pageStat(/^no response/),
      noindex: pageStat(/^noindex/),
      foreignCanonical: pageStat(/^(canonical points elsewhere|conflicting canonicals)/),
      slow: pageStat(/^slow:/),
    },
    inspection: {
      inspected: inspections.length,
      indexed: inspections.filter((c) => c.data.indexed === true).length,
      // Sitemapped URLs Google last saw as noindex; re-fetching them is the fix.
      googleHoldsNoindex,
    },
    indexedByClass,
    ...extra,
  })
  return summary
}

/**
 * The owner's text. One line of totals, then the worst few failures grouped by
 * check, short enough for one SMS screen. Returns null when nothing failed.
 */
export function alertBody(summary: CrawlCheck, checks: readonly CrawlCheck[]): string | null {
  const failed = checks.filter((c) => c.status === 'fail')
  if (failed.length === 0) return null
  const lines: string[] = [`Crawl probe: ${failed.length} of ${checks.length} checks failed.`]
  const order: CheckMetric[] = ['sitemap_index', 'sitemap_child', 'homepage_scripts', 'page_fetch', 'gsc_sitemap', 'gsc_inspection']
  for (const metric of order) {
    const group = failed.filter((c) => c.metric === metric)
    if (group.length === 0) continue
    if (metric === 'page_fetch') {
      const p = (summary.data.pageFetch ?? {}) as Record<string, number>
      const parts = [
        p.http5xx ? `${p.http5xx} 5xx` : '',
        p.redirects ? `${p.redirects} redirect` : '',
        p.http4xx ? `${p.http4xx} 4xx` : '',
        p.noResponse ? `${p.noResponse} no answer` : '',
        p.noindex ? `${p.noindex} noindex` : '',
        p.foreignCanonical ? `${p.foreignCanonical} foreign canonical` : '',
        p.slow ? `${p.slow} over 5s` : '',
      ].filter(Boolean)
      lines.push(`Pages: ${group.length} of ${p.sampled ?? '?'} sampled failed (${parts.join(', ')}). First: ${group[0].surface}`)
    } else {
      lines.push(`${group[0].failures[0]}${group.length > 1 ? ` (+${group.length - 1} more ${metric})` : ''}`)
    }
  }
  return fitLines(lines, ALERT_MAX_CHARS)
}

/**
 * The alert queue stores 600 characters (lib/data/crm/healthAlertQueue.ts)
 * after a 25-character "[crm-health:crawl-probe] " marker, so the body keeps
 * to 560 and drops whole trailing lines rather than stopping mid-sentence.
 */
export const ALERT_MAX_CHARS = 560

function fitLines(lines: readonly string[], max: number): string {
  let out = lines[0].slice(0, max)
  for (const line of lines.slice(1)) {
    if (out.length + 1 + line.length > max) break
    out += `\n${line}`
  }
  return out
}
