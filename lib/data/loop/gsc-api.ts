/**
 * Search Console Search Analytics, uncapped (visibility audit 2026-09-22,
 * TRACK-5, gsc-trend-1). The daily snapshot cron keeps the top 25 pages and
 * queries per day, about 5% of impressions; everything the loop measures with
 * goes through this pager instead: rowLimit 25,000 per request and startRow
 * paging until a short page comes back.
 *
 * Auth is the repo's service account, read-only scope, exactly as
 * scripts/_gsc-by-class.mjs and app/actions/search-console-report.ts do it
 * (GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
 * property GOOGLE_SEARCH_CONSOLE_SITE_URL or https://ryan-realty.com/).
 * No server-only import: the weekly cron and the CLIs share it. googleapis
 * loads lazily, so the boot brief (which only needs the date helpers through
 * the trend reader) does not pay for it.
 */

export type GscApiRow = {
  keys: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export type GscDimension = 'date' | 'page' | 'query' | 'country' | 'device' | 'searchAppearance'

export type GscRequest = {
  startDate: string
  endDate: string
  dimensions: GscDimension[]
  searchType?: 'web' | 'image' | 'video' | 'news' | 'discover' | 'googleNews'
  dimensionFilterGroups?: Array<{
    filters: Array<{ dimension: GscDimension; operator: string; expression: string }>
  }>
  rowLimit?: number
  startRow?: number
}

/** One Search Analytics request (a single page of rows). Injected so tests never touch Google. */
export type GscQueryFn = (req: GscRequest) => Promise<GscApiRow[]>

export const GSC_PAGE_SIZE = 25_000

/**
 * GSC keeps processing a day for two to three days; a day inside that lag reads
 * low (gsc-trend-12: 2026-09-20 was 0 in site_signal and 996 impressions in the
 * API). Every reader here treats the last three days as provisional and never
 * ends a window inside them.
 */
export const GSC_SETTLE_DAYS = 3

export function gscSiteUrl(): string {
  return process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL?.trim() || 'https://ryan-realty.com/'
}

/** A live query function, or null when the service-account env is absent (the caller reports that). */
export async function createGscQuery(): Promise<GscQueryFn | null> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL?.trim()
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim()
  if (!email || !key) return null
  const { google } = await import('googleapis')
  const auth = new google.auth.JWT({
    email,
    key: key.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  })
  const sc = google.searchconsole({ version: 'v1', auth })
  const siteUrl = gscSiteUrl()
  return async (req) => {
    const { data } = await sc.searchanalytics.query({ siteUrl, requestBody: req })
    return (data.rows ?? []).map((r) => ({
      keys: (r.keys ?? []).map(String),
      clicks: Number(r.clicks ?? 0),
      impressions: Number(r.impressions ?? 0),
      ctr: Number(r.ctr ?? 0),
      position: Number(r.position ?? 0),
    }))
  }
}

/**
 * Every row for a request, paged with startRow. Stops on a short page, or at
 * maxRows (a runaway guard, reported by the caller through `truncated`).
 */
export async function pullAllGscRows(
  query: GscQueryFn,
  req: Omit<GscRequest, 'rowLimit' | 'startRow'>,
  opts: { pageSize?: number; maxRows?: number } = {},
): Promise<{ rows: GscApiRow[]; requests: number; truncated: boolean }> {
  const pageSize = opts.pageSize ?? GSC_PAGE_SIZE
  const maxRows = opts.maxRows ?? 1_000_000
  const rows: GscApiRow[] = []
  let requests = 0
  for (let startRow = 0; startRow < maxRows; startRow += pageSize) {
    const page = await query({ ...req, rowLimit: pageSize, startRow })
    requests += 1
    rows.push(...page)
    if (page.length < pageSize) return { rows, requests, truncated: false }
  }
  return { rows, requests, truncated: true }
}

const DAY_MS = 24 * 60 * 60 * 1000

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function addDays(iso: string, days: number): string {
  return isoDate(new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS))
}

export function daysBetweenInclusive(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1
}

/** The newest day GSC has finished processing, as of `now` (UTC). */
export function settledEndDate(now: Date = new Date()): string {
  return addDays(isoDate(now), -GSC_SETTLE_DAYS)
}

export function isIsoDate(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
}

/** Split an inclusive date range into chunks of at most `days` days. */
export function chunkDateRange(from: string, to: string, days: number): Array<{ startDate: string; endDate: string }> {
  const out: Array<{ startDate: string; endDate: string }> = []
  if (days < 1 || from > to) return out
  for (let start = from; start <= to; start = addDays(start, days)) {
    const end = addDays(start, days - 1)
    out.push({ startDate: start, endDate: end < to ? end : to })
  }
  return out
}
