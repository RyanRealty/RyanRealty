/**
 * Crawl-surface probe: the I/O half. Fetches what Googlebot fetches, asks
 * Search Console what it holds, and hands every response to the pure
 * evaluators in ./checks. Every dependency is injected (fetch, clock, baseline,
 * Search Console) so the whole run is testable offline.
 *
 * Order of work:
 *   1. Sitemap index, homepage, and the Search Console sitemap list, together.
 *   2. Every child sitemap the index lists plus every class the code expects,
 *      together, each within SITEMAP_BUDGET_MS.
 *   3. A day-rotating sample of every page class at concurrency 8 (Googlebot
 *      UA), alongside URL Inspection for the first few URLs of each class.
 * The page and inspection pools stop launching new work at `deadlineMs` so the
 * cron always finishes inside its 300 s function ceiling and still writes rows.
 */
import { SITEMAP_CLASSES } from '@/lib/data/sitemap/classify'
import { checkInlineScripts } from '@/lib/analytics/inline-script-check.mjs'
import {
  alertBody,
  childCountExpectation,
  childName,
  evaluateGscSitemap,
  evaluateHomepageScripts,
  evaluateInspection,
  evaluatePageFetch,
  evaluateSitemapChild,
  evaluateSitemapIndex,
  parseSitemapLocs,
  pathOf,
  sampleByClass,
  summarizeRun,
  utcDayIndex,
  type CrawlCheck,
  type FetchOutcome,
  type GscSitemapEntry,
  type PageFetchOutcome,
} from './checks'
import type { GscClient } from './gsc'

/** Google's own desktop crawler string (developers.google.com/search/docs/crawling-indexing/google-common-crawlers). */
export const GOOGLEBOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
/** A current desktop Chrome, for the homepage script check (what a visitor's browser parses). */
export const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36'

export type CrawlProbeOptions = {
  /** Canonical site origin, e.g. https://ryan-realty.com (no trailing slash). */
  origin: string
  now?: Date
  fetchImpl?: typeof fetch
  /** Child sitemap path -> yesterday's URL count (readCrawlProbeBaseline). */
  baseline?: ReadonlyMap<string, { count: number; date: string }>
  gsc?: GscClient | null
  gtmContainerId?: string | null
  perClass?: number
  inspectPerClass?: number
  concurrency?: number
  inspectConcurrency?: number
  sitemapAbortMs?: number
  pageAbortMs?: number
  /** Milliseconds after start past which no new page fetch or inspection starts. */
  deadlineMs?: number
}

export type CrawlProbeReport = {
  date: string
  startedAt: string
  durationMs: number
  checks: CrawlCheck[]
  summary: CrawlCheck
  alert: string | null
}

type TimedFetch = FetchOutcome & { ttfbMs: number }

const KEPT_HEADERS = ['x-vercel-cache', 'x-robots-tag', 'location', 'content-type'] as const

function errorText(err: unknown): string {
  if (err instanceof Error) {
    const cause = (err as Error & { cause?: unknown }).cause
    const detail = cause instanceof Error ? cause.message : cause ? String(cause) : ''
    return detail && !err.message.includes(detail) ? `${err.message}: ${detail}` : err.message
  }
  return String(err)
}

/**
 * GET with a user agent, no redirect following (a sitemapped URL that
 * redirects is itself the finding), a hard abort, and one retry on a network
 * error (never on an HTTP status, which is an answer).
 */
async function timedFetch(fetchImpl: typeof fetch, url: string, ua: string, abortMs: number): Promise<TimedFetch> {
  for (let attempt = 0; ; attempt++) {
    const started = Date.now()
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), abortMs)
    try {
      const res = await fetchImpl(url, {
        headers: { 'user-agent': ua, accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
        redirect: 'manual',
        cache: 'no-store',
        signal: ctl.signal,
      })
      const ttfbMs = Date.now() - started
      const body = await res.text()
      const headers: Record<string, string | null> = {}
      for (const h of KEPT_HEADERS) headers[h] = res.headers.get(h)
      return { status: res.status, ms: Date.now() - started, ttfbMs, body, headers }
    } catch (err) {
      const aborted = ctl.signal.aborted
      if (!aborted && attempt === 0) continue
      const ms = Date.now() - started
      return { status: 0, ms, ttfbMs: ms, body: '', error: aborted ? `no answer within ${abortMs} ms` : errorText(err) }
    } finally {
      clearTimeout(timer)
    }
  }
}

/** Run `fn` over `items` with at most `n` in flight; items not started before `canStart()` goes false are left undefined. */
async function pool<T, R>(items: readonly T[], n: number, fn: (item: T) => Promise<R>, canStart: () => boolean): Promise<Array<R | undefined>> {
  const out: Array<R | undefined> = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length && canStart()) {
      const i = next++
      out[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker))
  return out
}

export async function runCrawlProbe(opts: CrawlProbeOptions): Promise<CrawlProbeReport> {
  const now = opts.now ?? new Date()
  const started = Date.now()
  const fetchImpl = opts.fetchImpl ?? fetch
  const origin = opts.origin.replace(/\/+$/, '')
  const perClass = opts.perClass ?? 10
  const inspectPerClass = opts.inspectPerClass ?? 2
  const concurrency = opts.concurrency ?? 8
  const inspectConcurrency = opts.inspectConcurrency ?? 4
  const sitemapAbortMs = opts.sitemapAbortMs ?? 60_000
  const pageAbortMs = opts.pageAbortMs ?? 15_000
  const deadlineMs = opts.deadlineMs ?? 200_000
  const beforeDeadline = () => Date.now() - started < deadlineMs
  const date = now.toISOString().slice(0, 10)
  const checks: CrawlCheck[] = []

  // 1. Index, homepage, and Search Console's sitemap list together.
  const indexUrl = `${origin}/sitemap.xml`
  const [indexRes, homeRes, gscList] = await Promise.all([
    timedFetch(fetchImpl, indexUrl, GOOGLEBOT_UA, sitemapAbortMs),
    timedFetch(fetchImpl, `${origin}/`, BROWSER_UA, sitemapAbortMs),
    opts.gsc
      ? opts.gsc.listSitemaps().then(
          (entries) => ({ entries, error: null as string | null }),
          (err: unknown) => ({ entries: [] as GscSitemapEntry[], error: errorText(err) }),
        )
      : Promise.resolve({ entries: [] as GscSitemapEntry[], error: 'Search Console credentials are not configured' }),
  ])

  // 2. Children: what the index lists plus what the code says must exist.
  const expectedChildUrls = SITEMAP_CLASSES.map((c) => `${origin}/sitemaps/${c}.xml`)
  const listed = indexRes.status === 200 ? parseSitemapLocs(indexRes.body) : []
  const childUrls = [...new Set([...listed, ...expectedChildUrls])]
  const childRes = await Promise.all(childUrls.map((u) => timedFetch(fetchImpl, u, GOOGLEBOT_UA, sitemapAbortMs)))

  const gscByPath = new Map<string, GscSitemapEntry>()
  for (const e of gscList.entries) {
    const p = pathOf(e.path ?? '')
    if (p) gscByPath.set(p, e)
  }

  // A path listed by two children breaks the one-class-per-URL contract.
  const childLocs = childRes.map((r) => (r.status === 200 ? parseSitemapLocs(r.body) : []))
  const ownerCount = new Map<string, number>()
  childLocs.forEach((locs) => {
    for (const p of new Set(locs.map((l) => pathOf(l)).filter((p): p is string => p !== null))) {
      ownerCount.set(p, (ownerCount.get(p) ?? 0) + 1)
    }
  })
  const crossChildDuplicates = [...ownerCount.values()].filter((n) => n > 1).length

  const liveCountByPath = new Map<string, number>()
  const sampleEntries: Array<{ url: string; child: string }> = []
  childUrls.forEach((url, i) => {
    const path = pathOf(url) ?? url
    const expected = childCountExpectation(opts.baseline?.get(path), gscByPath.get(path), now)
    const { locs, ...child } = evaluateSitemapChild({ path, fetch: childRes[i], origin, expected })
    checks.push(child)
    if (childRes[i].status === 200) liveCountByPath.set(path, locs.length)
    const name = childName(url)
    for (const loc of childLocs[i]) sampleEntries.push({ url: loc, child: name })
  })

  checks.unshift(
    evaluateSitemapIndex({ path: '/sitemap.xml', fetch: indexRes, expectedChildUrls, crossChildDuplicates }),
  )

  // Homepage inline scripts (TRACK-2 class), through the one shared parser.
  const report = homeRes.status === 200 ? checkInlineScripts(homeRes.body, { gtmContainerId: opts.gtmContainerId ?? null }) : null
  checks.push(evaluateHomepageScripts(homeRes, report))

  // Search Console sitemaps. The API's "indexed" field is no longer populated
  // (see evaluateGscSitemap); the indexed side comes from URL Inspection below.
  if (gscList.error) {
    checks.push({
      metric: 'gsc_sitemap',
      surface: '',
      status: 'fail',
      failures: [`Search Console sitemap list unreadable: ${gscList.error}`],
      data: {},
    })
  } else {
    for (const entry of gscList.entries) {
      const p = pathOf(entry.path ?? '') ?? ''
      checks.push(evaluateGscSitemap(entry, liveCountByPath.get(p) ?? null, now))
    }
    for (const url of expectedChildUrls) {
      const p = pathOf(url) ?? url
      if (!gscByPath.has(p) && !gscByPath.has('/sitemap.xml')) {
        checks.push({
          metric: 'gsc_sitemap',
          surface: p,
          status: 'fail',
          failures: [`${p} is not submitted to Search Console, directly or through /sitemap.xml`],
          data: { submitted: null, liveCount: liveCountByPath.get(p) ?? null },
        })
      }
    }
  }

  // 3. Pages + inspection, concurrently.
  const sample = sampleByClass(sampleEntries, utcDayIndex(now), perClass)
  const perClassSeen = new Map<string, number>()
  const toInspect = opts.gsc
    ? sample.filter((s) => {
        const n = perClassSeen.get(s.cls) ?? 0
        perClassSeen.set(s.cls, n + 1)
        return n < inspectPerClass
      })
    : []
  const gsc = opts.gsc
  const [pageResults, inspectResults] = await Promise.all([
    pool(
      sample,
      concurrency,
      async (s) => {
        const r = await timedFetch(fetchImpl, s.url, GOOGLEBOT_UA, pageAbortMs)
        const outcome: PageFetchOutcome = { ...r, url: s.url, path: s.path, cls: s.cls }
        return evaluatePageFetch(outcome)
      },
      beforeDeadline,
    ),
    gsc
      ? pool(
          toInspect,
          inspectConcurrency,
          async (s) => {
            try {
              return evaluateInspection(s.path, s.cls, await gsc.inspect(s.url))
            } catch (err) {
              return evaluateInspection(s.path, s.cls, null, errorText(err))
            }
          },
          beforeDeadline,
        )
      : Promise.resolve([] as Array<CrawlCheck | undefined>),
  ])
  const pages = pageResults.filter((c): c is CrawlCheck => c !== undefined)
  const inspections = inspectResults.filter((c): c is CrawlCheck => c !== undefined)
  checks.push(...pages, ...inspections)

  const durationMs = Date.now() - started
  const summary = summarizeRun(checks, {
    startedAt: now.toISOString(),
    durationMs,
    origin,
    perClass,
    sampledPlanned: sample.length,
    sampledFetched: pages.length,
    inspectionsPlanned: toInspect.length,
    inspectionsDone: inspections.length,
    deadlineHit: pages.length < sample.length || inspections.length < toInspect.length,
    gscError: gscList.error,
  })
  return {
    date,
    startedAt: now.toISOString(),
    durationMs,
    checks,
    summary,
    alert: alertBody(summary, checks),
  }
}

/**
 * The report for a run that threw before it could finish: one failed run
 * summary carrying the error, so the row, the loop brief and the owner alert
 * all say the monitor itself broke instead of the day going quietly missing.
 */
export function crashedProbeReport(now: Date, err: unknown): CrawlProbeReport {
  const message = `crawl probe crashed: ${errorText(err)}`.slice(0, 300)
  const summary: CrawlCheck = {
    metric: 'run',
    surface: '',
    status: 'fail',
    failures: [message],
    data: { checks: 1, failed: 1, crashed: true, failures: [message], startedAt: now.toISOString() },
  }
  return {
    date: now.toISOString().slice(0, 10),
    startedAt: now.toISOString(),
    durationMs: Date.now() - now.getTime(),
    checks: [],
    summary,
    alert: `Crawl probe: ${message}`,
  }
}

/** One site_signal row per check plus the run summary (lib/data/crawl-probe/rows). */
export function toCrawlProbeRows(report: CrawlProbeReport) {
  return [report.summary, ...report.checks].map((c) => ({
    date: report.date,
    surface: c.surface,
    metric: c.metric,
    value: (c.status === 'pass' ? 1 : 0) as 0 | 1,
    metadata: { status: c.status, failures: c.failures, ...c.data },
  }))
}
