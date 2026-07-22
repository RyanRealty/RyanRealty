/**
 * National rate-context series for the weekly market history snapshot.
 *
 * Sources (primary sources per CLAUDE.md §0 — never LLM recall):
 *   - FRED observations API (api.stlouisfed.org) — series MORTGAGE30US
 *     (Freddie Mac 30yr fixed, weekly) and DGS10 (10Y treasury constant
 *     maturity, daily). Requires FRED_API_KEY.
 *   - Freddie Mac PMMS history CSV
 *     (https://www.freddiemac.com/pmms/docs/PMMS_history.csv, verified live
 *     2026-07-21; the /pmms/docs/pmms.json path 404s) — keyless fallback for
 *     the 30yr rate when FRED_API_KEY is absent or FRED fails.
 *
 * Every fetcher degrades gracefully: on a missing key, network failure, or
 * unparseable payload it logs one clear line and returns null. Nothing here
 * throws, so the snapshot cron always finishes the local series even when
 * the national ones are dark.
 *
 * Pure parsers (parseFredObservations, parsePmmsHistoryCsv) are exported for
 * unit tests; the fetch wrappers stay thin.
 */

export type NationalSeriesPoint = {
  /** Observation value (percent, e.g. 6.78). */
  value: number
  /** Observation date as reported by the source (YYYY-MM-DD). */
  observationDate: string
  /** Provenance string stored in market_history_weekly.source. */
  source: string
}

const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations'
const PMMS_HISTORY_CSV_URL = 'https://www.freddiemac.com/pmms/docs/PMMS_history.csv'
const FETCH_TIMEOUT_MS = 15_000

/* ------------------------------------------------------------------ */
/* Pure parsers (unit-tested)                                          */
/* ------------------------------------------------------------------ */

/**
 * Extract the most recent valid observation from a FRED observations
 * response. FRED reports missing values as the string "." — those are
 * skipped. Expects the response fetched with sort_order=desc (newest first),
 * but sorts defensively by date descending anyway.
 */
export function parseFredObservations(payload: unknown): { value: number; date: string } | null {
  if (typeof payload !== 'object' || payload === null) return null
  const observations = (payload as { observations?: unknown }).observations
  if (!Array.isArray(observations)) return null

  const valid = observations
    .filter((o): o is { date: string; value: string } => {
      if (typeof o !== 'object' || o === null) return false
      const row = o as Record<string, unknown>
      return typeof row.date === 'string' && typeof row.value === 'string' && row.value !== '.'
    })
    .map((o) => ({ date: o.date, value: Number(o.value) }))
    .filter((o) => Number.isFinite(o.value))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

  return valid.length > 0 ? valid[0] : null
}

/**
 * Extract the most recent 30yr rate from the Freddie PMMS history CSV.
 * Header (verified 2026-07-21):
 *   date,pmms30,pmms30p,pmms15,pmms15p,pmms51,pmms51p,pmms51m,pmms51spread
 * Dates are M/D/YYYY. Walks from the bottom to find the last row with a
 * parseable pmms30, and returns the date normalized to YYYY-MM-DD.
 */
export function parsePmmsHistoryCsv(csv: string): { value: number; date: string } | null {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) return null

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase())
  const dateIdx = header.indexOf('date')
  const rateIdx = header.indexOf('pmms30')
  if (dateIdx === -1 || rateIdx === -1) return null

  for (let i = lines.length - 1; i >= 1; i -= 1) {
    const cells = lines[i].split(',')
    const rawDate = (cells[dateIdx] ?? '').trim()
    const rawRate = (cells[rateIdx] ?? '').trim()
    if (!rawDate || !rawRate) continue
    const value = Number(rawRate)
    if (!Number.isFinite(value) || value <= 0) continue

    const m = rawDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (!m) continue
    const [, mm, dd, yyyy] = m
    return { value, date: `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}` }
  }
  return null
}

/* ------------------------------------------------------------------ */
/* Fetch wrappers (degrade to null, never throw)                       */
/* ------------------------------------------------------------------ */

async function fetchWithTimeout(url: string): Promise<Response> {
  return fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    // Cron context — always want the live value, never a framework cache.
    cache: 'no-store',
    headers: { 'user-agent': 'ryan-realty-market-history/1.0' },
  })
}

async function fetchFredSeries(seriesId: string): Promise<NationalSeriesPoint | null> {
  const apiKey = process.env.FRED_API_KEY
  if (!apiKey?.trim()) {
    console.warn(
      `[market-national-series] FRED_API_KEY is not set — skipping FRED series ${seriesId}. ` +
        'Add FRED_API_KEY to the environment to capture this series.',
    )
    return null
  }
  const url =
    `${FRED_BASE}?series_id=${encodeURIComponent(seriesId)}` +
    `&api_key=${encodeURIComponent(apiKey)}&file_type=json&sort_order=desc&limit=10`
  try {
    const res = await fetchWithTimeout(url)
    if (!res.ok) {
      console.warn(`[market-national-series] FRED ${seriesId} responded ${res.status} — series skipped this week.`)
      return null
    }
    const parsed = parseFredObservations(await res.json())
    if (!parsed) {
      console.warn(`[market-national-series] FRED ${seriesId} returned no valid observations — series skipped.`)
      return null
    }
    return { value: parsed.value, observationDate: parsed.date, source: `fred:${seriesId}` }
  } catch (err) {
    console.warn(
      `[market-national-series] FRED ${seriesId} fetch failed (${err instanceof Error ? err.message : String(err)}) — series skipped this week.`,
    )
    return null
  }
}

async function fetchFreddiePmms30(): Promise<NationalSeriesPoint | null> {
  try {
    const res = await fetchWithTimeout(PMMS_HISTORY_CSV_URL)
    if (!res.ok) {
      console.warn(`[market-national-series] Freddie PMMS history responded ${res.status} — 30yr fallback unavailable.`)
      return null
    }
    const parsed = parsePmmsHistoryCsv(await res.text())
    if (!parsed) {
      console.warn('[market-national-series] Freddie PMMS history CSV had no parseable pmms30 row — 30yr fallback unavailable.')
      return null
    }
    return { value: parsed.value, observationDate: parsed.date, source: 'freddie:pmms30' }
  } catch (err) {
    console.warn(
      `[market-national-series] Freddie PMMS fetch failed (${err instanceof Error ? err.message : String(err)}) — 30yr fallback unavailable.`,
    )
    return null
  }
}

/**
 * 30yr fixed mortgage rate — FRED MORTGAGE30US first (both FRED series then
 * come from one consistent source), Freddie PMMS history CSV as the keyless
 * fallback. Null when both are unavailable.
 */
export async function fetchMortgage30yr(): Promise<NationalSeriesPoint | null> {
  return (await fetchFredSeries('MORTGAGE30US')) ?? (await fetchFreddiePmms30())
}

/**
 * 10Y treasury constant-maturity yield — FRED DGS10. No keyless fallback
 * exists, so this is null whenever FRED_API_KEY is absent.
 */
export async function fetchTreasury10yr(): Promise<NationalSeriesPoint | null> {
  return fetchFredSeries('DGS10')
}
