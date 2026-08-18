/**
 * FRED / ALFRED client — the one module in this repo that talks to
 * api.stlouisfed.org. One rate limiter, one retry policy, one error taxonomy,
 * one place that reads FRED_API_KEY.
 *
 * Nothing here throws on a bad response. Every call returns a discriminated
 * `FredResult`, so a caller cannot accidentally read a failure as an empty
 * series — the §0 failure mode this module exists to prevent.
 *
 * ── THE VINTAGE MODEL, MEASURED LIVE ON 2026-08-17, NOT RECALLED ────────────
 *
 * output_type=1 ("observations by real-time period") returns narrow rows
 * `{realtime_start, realtime_end, date, value}`. Over the FULL real-time range
 * the vintage dates are exact and the still-current row carries
 * realtime_end 9999-12-31. Measured, MORTGAGE30US full range: 2,890 rows in
 * 218ms, one open row per observation date, zero duplicates.
 *
 * output_type=1 CLAMPS to the requested window. Measured, CPIAUCSL over
 * realtime 2026-06-01..2026-08-17: the 2026-01-01 observation came back at
 * realtime_start 2026-06-01 — the window start, not the date that value became
 * current. So a narrow request over a NARROW window cannot be stored as-is; it
 * would fabricate vintage dates. `parseNarrowObservations` marks those rows
 * `clampedStart: true` and the reconciler in lib/stats/vintage.ts collapses
 * them against the value already current.
 *
 * output_type=3 ("new and revised only") returns a WIDE shape,
 * `{"date":"2026-05-01","CPIAUCSL_20260610":"333.979"}`, with the TRUE vintage
 * date in the column key and no clamping. It is the right incremental tool and
 * the wrong backfill tool: its server cost scales with the vintages in the
 * window. Measured on DGS10 — 7-day window 1.0s, 30-day 5.3s, 100 vintages
 * 16.5s, 250 vintages 40.9s, 500 vintages HTTP 504.
 *
 * A request may span at most 2000 vintage dates. Measured today: DGS10 has
 * 5,089 vintages and 400s on the full range; MORTGAGE30US 844, CPIAUCSL 668,
 * MSACSR 179, CSUSHPINSA 141 all fit in one request. `/fred/series/vintagedates`
 * returns the exact list, which is what lets the caller cut windows on real
 * vintage boundaries instead of guessing at day counts.
 *
 * A window containing NO vintages is an HTTP 400, not an empty list. Measured:
 * MSACSR over 2026-08-10..2026-08-17 returns "No vintage dates exist for the
 * specified real-time period". For a monthly series polled daily that is the
 * NORMAL answer, so it is classified `no_vintages` and must never be treated
 * as an outage.
 *
 * A missing figure arrives as the literal string "." (measured: DGS10
 * 1962-02-12). It parses to `value: null`.
 */

import { FRED_OPEN_REALTIME_END } from '@/lib/stats/contract'

const FRED_BASE = 'https://api.stlouisfed.org/fred'

/** Default per-request budget for the ingest, which runs on a 300s cron. */
const DEFAULT_TIMEOUT_MS = 20_000
const DEFAULT_MAX_ATTEMPTS = 4
const RETRY_BASE_MS = 1_000

/**
 * FRED allows 120 requests/minute per key. Serializing at 600ms holds us at
 * 100/min with headroom; concurrency is what trips a per-key limit, so the
 * client never issues two requests at once.
 */
const MIN_REQUEST_INTERVAL_MS = 600

/** FRED's own per-request page size ceiling. */
const MAX_PAGE_LIMIT = 100_000
/** Runaway guard on the pagination loop. */
const MAX_PAGES = 20

/**
 * The publisher's ceiling on vintage dates per request, verified in the 400
 * body today. Windows are cut below it so a vintage published between the
 * vintage-list call and the observation call cannot tip a window over.
 */
export const MAX_VINTAGES_PER_REQUEST = 2000
export const VINTAGE_WINDOW_SIZE = 1_500

/** The earliest real-time date FRED accepts. */
export const FRED_EPOCH = '1776-07-04'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type FredFailureKind =
  | 'missing_key'
  | 'rate_limited'
  | 'vintage_cap'
  | 'no_vintages'
  | 'http'
  | 'network'
  | 'malformed'

export type FredFailure = {
  kind: FredFailureKind
  message: string
  status?: number
  seriesId?: string
}

export type FredResult<T> = { ok: true; data: T } | { ok: false; error: FredFailure }

/** One observation at one vintage, as the publisher reported it. */
export type FredObservation = {
  /** The period the figure describes (YYYY-MM-DD). */
  observationDate: string
  /** null when the publisher reported "." for this vintage. */
  value: number | null
  /** Vintage start, as reported. See `clampedStart` before trusting it. */
  realtimeStart: string
  /**
   * Vintage end as reported, or null when the shape carries none
   * (output_type=3). FRED's 9999-12-31 is preserved verbatim; translating it
   * to the stored sentinel is lib/stats/contract.ts's job, not this parser's.
   */
  realtimeEnd: string | null
  /**
   * True when `realtimeStart` equals the requested window start, which means
   * FRED clamped it and the real vintage may be older. A clamped row states
   * "this was the current value at the window start", never "this became
   * current on that date".
   */
  clampedStart: boolean
}

export type FetchObservationsParams = {
  seriesId: string
  /** 1 = observations by real-time period. 3 = new and revised only. */
  outputType: 1 | 3
  realtimeStart?: string
  realtimeEnd?: string
}

/**
 * Per-call budget. Callers on a short cron pass a tighter one; the ingest uses
 * the defaults. Retries multiply the timeout, so a caller with a hard deadline
 * sets `maxAttempts: 1` and gets one bounded attempt.
 */
export type FredRequestBudget = {
  maxAttempts?: number
  timeoutMs?: number
}

/* ------------------------------------------------------------------ */
/* Pure parsers (unit-tested in lib/stats/fred.test.ts)                */
/* ------------------------------------------------------------------ */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function toFiniteOrNull(raw: unknown): number | null {
  // FRED reports a missing figure as the literal string ".".
  if (typeof raw !== 'string' || raw === '.' || raw.trim() === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

/**
 * Parse the NARROW payload (output_type=1).
 *
 * `requestedRealtimeStart` is what the caller asked for. Rows reported at
 * exactly that date are flagged clamped, because FRED reports both a genuine
 * vintage starting there and an older vintage still running through it with
 * the same realtime_start, and the payload cannot tell them apart.
 */
export function parseNarrowObservations(
  payload: unknown,
  requestedRealtimeStart: string | null,
): FredObservation[] | null {
  if (typeof payload !== 'object' || payload === null) return null
  const observations = (payload as { observations?: unknown }).observations
  if (!Array.isArray(observations)) return null

  const out: FredObservation[] = []
  for (const raw of observations) {
    if (typeof raw !== 'object' || raw === null) continue
    const row = raw as Record<string, unknown>
    const date = row.date
    const realtimeStart = row.realtime_start
    if (typeof date !== 'string' || !ISO_DATE.test(date)) continue
    if (typeof realtimeStart !== 'string' || !ISO_DATE.test(realtimeStart)) continue

    const rawEnd = typeof row.realtime_end === 'string' && ISO_DATE.test(row.realtime_end) ? row.realtime_end : null
    out.push({
      observationDate: date,
      value: toFiniteOrNull(row.value),
      realtimeStart,
      realtimeEnd: rawEnd,
      clampedStart: requestedRealtimeStart !== null && realtimeStart === requestedRealtimeStart,
    })
  }
  return out
}

/**
 * Parse the WIDE new-and-revised payload (output_type=3). Every non-`date` key
 * is `<SERIES_CODE>_<YYYYMMDD>`, where the suffix is the true vintage date.
 * These rows are never clamped and carry no vintage end.
 */
export function parseVintageObservations(payload: unknown, seriesCode: string): FredObservation[] | null {
  if (typeof payload !== 'object' || payload === null) return null
  const observations = (payload as { observations?: unknown }).observations
  if (!Array.isArray(observations)) return null

  const prefix = `${seriesCode}_`
  const out: FredObservation[] = []
  for (const raw of observations) {
    if (typeof raw !== 'object' || raw === null) continue
    const row = raw as Record<string, unknown>
    const date = row.date
    if (typeof date !== 'string' || !ISO_DATE.test(date)) continue

    for (const [key, value] of Object.entries(row)) {
      if (key === 'date' || !key.startsWith(prefix)) continue
      const stamp = key.slice(prefix.length)
      if (!/^\d{8}$/.test(stamp)) continue
      out.push({
        observationDate: date,
        value: toFiniteOrNull(value),
        realtimeStart: `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}`,
        realtimeEnd: null,
        clampedStart: false,
      })
    }
  }
  return out
}

/** Parse the /fred/series/vintagedates payload into an ascending date list. */
export function parseVintageDates(payload: unknown): string[] | null {
  if (typeof payload !== 'object' || payload === null) return null
  const list = (payload as { vintage_dates?: unknown }).vintage_dates
  if (!Array.isArray(list)) return null
  const out = list.filter((d): d is string => typeof d === 'string' && ISO_DATE.test(d))
  out.sort()
  return out
}

/** The publisher's own coverage stamp for one series. */
export type FredSeriesStatus = {
  seriesCode: string
  /** Newest period the publisher has a figure for (YYYY-MM-DD). */
  observationEnd: string | null
  /** The publisher's own last_updated stamp, verbatim. */
  lastUpdated: string | null
}

/** Parse the /fred/series payload down to the two fields freshness needs. */
export function parseSeriesStatus(payload: unknown, seriesCode: string): FredSeriesStatus | null {
  if (typeof payload !== 'object' || payload === null) return null
  const list = (payload as { seriess?: unknown }).seriess
  if (!Array.isArray(list) || list.length === 0) return null
  const row = list[0]
  if (typeof row !== 'object' || row === null) return null
  const r = row as Record<string, unknown>
  const str = (k: string): string | null => (typeof r[k] === 'string' && r[k] !== '' ? (r[k] as string) : null)
  return { seriesCode: str('id') ?? seriesCode, observationEnd: str('observation_end'), lastUpdated: str('last_updated') }
}

/**
 * Cut an ascending vintage list into contiguous real-time windows that each sit
 * under the publisher's per-request ceiling. Windows do not overlap: the
 * reconciler collapses the clamped continuation rows a later window repeats, so
 * an overlap would only duplicate work.
 *
 * The final window ends at FRED's open sentinel so vintages published between
 * the vintage-list call and the observation call are still inside it.
 */
export function planVintageWindows(
  vintageDates: readonly string[],
  windowSize: number = VINTAGE_WINDOW_SIZE,
): { realtimeStart: string; realtimeEnd: string }[] {
  if (vintageDates.length === 0) return []
  const size = Math.max(1, Math.min(windowSize, MAX_VINTAGES_PER_REQUEST - 1))
  const windows: { realtimeStart: string; realtimeEnd: string }[] = []
  for (let i = 0; i < vintageDates.length; i += size) {
    const isLast = i + size >= vintageDates.length
    windows.push({
      realtimeStart: vintageDates[i],
      realtimeEnd: isLast ? FRED_OPEN_REALTIME_END : vintageDates[Math.min(i + size, vintageDates.length) - 1],
    })
  }
  return windows
}

/* ------------------------------------------------------------------ */
/* Failure classification                                              */
/* ------------------------------------------------------------------ */

function classifyErrorBody(status: number, body: string): FredFailureKind {
  if (status === 429) return 'rate_limited'
  if (status === 400 && /vintage dates/i.test(body) && /exceeds the maximum/i.test(body)) return 'vintage_cap'
  if (status === 400 && /no vintage dates exist/i.test(body)) return 'no_vintages'
  return 'http'
}

/** True when the failure is the per-request vintage ceiling, not an outage. */
export function isVintageCapFailure(failure: FredFailure): boolean {
  return failure.kind === 'vintage_cap'
}

/**
 * True when the publisher simply had no vintages in the requested window. For a
 * monthly series polled daily this is the ordinary answer on 29 days out of 30,
 * so the caller reports it as "nothing new", never as a failure.
 */
export function isNoVintagesFailure(failure: FredFailure): boolean {
  return failure.kind === 'no_vintages'
}

/**
 * Strip the API key out of anything headed for a log, a cron response body, or
 * an ops email. The key travels as a query parameter, so a message echoing a
 * URL would otherwise publish it.
 */
export function redactApiKey(text: string): string {
  return text.replace(/api_key=[^&\s"']+/gi, 'api_key=[redacted]')
}

/** Pull FRED's own error_message out of an error body when it is present. */
export function extractFredErrorMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error_message?: unknown }
    if (typeof parsed.error_message === 'string') return redactApiKey(parsed.error_message)
  } catch {
    /* not JSON — fall through to the raw body */
  }
  return redactApiKey(body.slice(0, 300))
}

/* ------------------------------------------------------------------ */
/* Rate-limited transport                                              */
/* ------------------------------------------------------------------ */

let requestChain: Promise<unknown> = Promise.resolve()
let lastRequestAt = 0

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Serialize every FRED request and hold the minimum spacing. */
function schedule<T>(task: () => Promise<T>): Promise<T> {
  const run = requestChain.then(async () => {
    const wait = lastRequestAt + MIN_REQUEST_INTERVAL_MS - Date.now()
    if (wait > 0) await sleep(wait)
    lastRequestAt = Date.now()
    return task()
  })
  // Keep the chain alive even when a link rejects.
  requestChain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

function retryAfterMs(header: string | null, attempt: number): number {
  const seconds = Number(header)
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, 30_000)
  return RETRY_BASE_MS * 2 ** attempt
}

async function fredGet(
  path: string,
  params: Record<string, string>,
  budget: FredRequestBudget = {},
): Promise<FredResult<unknown>> {
  const apiKey = process.env.FRED_API_KEY
  if (!apiKey?.trim()) {
    return {
      ok: false,
      error: {
        kind: 'missing_key',
        message: 'FRED_API_KEY is not set. Set it in the environment before reading a FRED series.',
      },
    }
  }

  const maxAttempts = Math.max(1, budget.maxAttempts ?? DEFAULT_MAX_ATTEMPTS)
  const timeoutMs = budget.timeoutMs ?? DEFAULT_TIMEOUT_MS

  const url = new URL(`${FRED_BASE}/${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('file_type', 'json')

  let lastFailure: FredFailure = { kind: 'network', message: 'no attempt completed' }

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const outcome = await schedule(async () => {
      try {
        const res = await fetch(url, {
          signal: AbortSignal.timeout(timeoutMs),
          cache: 'no-store',
          headers: { 'user-agent': 'ryan-realty-stat-ingest/1.0' },
        })
        if (res.ok) return { kind: 'ok' as const, body: await res.text() }
        return { kind: 'error' as const, status: res.status, body: await res.text(), headers: res.headers }
      } catch (err) {
        return { kind: 'thrown' as const, message: err instanceof Error ? err.message : String(err) }
      }
    })

    if (outcome.kind === 'ok') {
      try {
        return { ok: true, data: JSON.parse(outcome.body) }
      } catch {
        return { ok: false, error: { kind: 'malformed', message: 'FRED returned a body that is not JSON.' } }
      }
    }

    if (outcome.kind === 'thrown') {
      lastFailure = { kind: 'network', message: redactApiKey(outcome.message) }
      if (attempt + 1 >= maxAttempts) break
      await sleep(RETRY_BASE_MS * 2 ** attempt)
      continue
    }

    const kind = classifyErrorBody(outcome.status, outcome.body)
    lastFailure = { kind, status: outcome.status, message: extractFredErrorMessage(outcome.body) }

    // Every deterministic 4xx reproduces on retry and burns quota. Only 429 and
    // 5xx are worth trying again.
    if (kind !== 'rate_limited' && outcome.status < 500) return { ok: false, error: lastFailure }
    if (attempt + 1 >= maxAttempts) break
    await sleep(retryAfterMs(outcome.headers.get('retry-after'), attempt))
  }

  return { ok: false, error: lastFailure }
}

/* ------------------------------------------------------------------ */
/* Public fetchers                                                     */
/* ------------------------------------------------------------------ */

/**
 * Raw FRED request for callers that want the payload rather than parsed vintage
 * rows. Routing through here is what keeps ONE rate limiter, ONE retry policy,
 * and ONE reader of FRED_API_KEY.
 */
export function fredRequest(
  path: string,
  params: Record<string, string>,
  budget?: FredRequestBudget,
): Promise<FredResult<unknown>> {
  return fredGet(path, params, budget)
}

/** The publisher's coverage stamp for one series. */
export async function fetchFredSeriesStatus(seriesCode: string): Promise<FredResult<FredSeriesStatus>> {
  const res = await fredGet('series', { series_id: seriesCode })
  if (!res.ok) return { ok: false, error: { ...res.error, seriesId: seriesCode } }
  const status = parseSeriesStatus(res.data, seriesCode)
  if (!status) {
    return { ok: false, error: { kind: 'malformed', seriesId: seriesCode, message: `FRED returned no series row for ${seriesCode}.` } }
  }
  return { ok: true, data: status }
}

/** Every vintage date the publisher holds for one series, ascending. */
export async function fetchFredVintageDates(seriesCode: string): Promise<FredResult<string[]>> {
  const res = await fredGet('series/vintagedates', {
    series_id: seriesCode,
    sort_order: 'asc',
    limit: '10000',
  })
  if (!res.ok) return { ok: false, error: { ...res.error, seriesId: seriesCode } }
  const dates = parseVintageDates(res.data)
  if (!dates) {
    return { ok: false, error: { kind: 'malformed', seriesId: seriesCode, message: `FRED returned no vintage_dates array for ${seriesCode}.` } }
  }
  return { ok: true, data: dates }
}

/**
 * Observations for one series, paginated through FRED's count/offset.
 *
 * Returns the rows as the publisher shaped them. Deciding which are real
 * vintages and which are clamped continuations belongs to lib/stats/vintage.ts,
 * which is where that decision can be unit-tested against stored state.
 */
export async function fetchFredObservations(params: FetchObservationsParams): Promise<FredResult<FredObservation[]>> {
  const { seriesId, outputType } = params
  const all: FredObservation[] = []
  let offset = 0
  let walkedWholeWindow = false

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const query: Record<string, string> = {
      series_id: seriesId,
      output_type: String(outputType),
      limit: String(MAX_PAGE_LIMIT),
      offset: String(offset),
      sort_order: 'asc',
    }
    if (params.realtimeStart) query.realtime_start = params.realtimeStart
    if (params.realtimeEnd) query.realtime_end = params.realtimeEnd

    const res = await fredGet('series/observations', query)
    if (!res.ok) return { ok: false, error: { ...res.error, seriesId } }

    const parsed =
      outputType === 3
        ? parseVintageObservations(res.data, seriesId)
        : parseNarrowObservations(res.data, params.realtimeStart ?? null)
    if (parsed === null) {
      return {
        ok: false,
        error: { kind: 'malformed', seriesId, message: `FRED observations payload for ${seriesId} had no observations array.` },
      }
    }
    all.push(...parsed)

    const body = res.data as { count?: unknown; observations?: unknown }
    const count = typeof body.count === 'number' ? body.count : null
    const rowsReturned = Array.isArray(body.observations) ? body.observations.length : 0
    offset += rowsReturned
    if (count === null || rowsReturned === 0 || offset >= count) {
      walkedWholeWindow = true
      break
    }
  }

  if (!walkedWholeWindow) {
    // The pages never converged. Returning the partial set would store a
    // truncated series as if it were complete.
    return {
      ok: false,
      error: {
        kind: 'malformed',
        seriesId,
        message: `FRED paging for ${seriesId} did not converge within ${MAX_PAGES} pages; ${all.length} rows discarded rather than stored as a complete series.`,
      },
    }
  }

  return { ok: true, data: all }
}
