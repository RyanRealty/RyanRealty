/**
 * getLiveMortgageRate — the one read that answers "what is the 30-yr rate right
 * now", with the §0 trace attached.
 *
 * Source: public.market_history_weekly, geo_type 'national' / geo_slug 'us',
 * metric 'mortgage_rate_30yr', written every Monday by
 * /api/cron/market-history-snapshot from Freddie Mac PMMS (source string
 * 'freddie:pmms30'). Values are stored as PERCENT (6.67 = 6.67%).
 *
 * Why it is not built on getMarketHistoryWeekly or supabaseAnon(): both route
 * through lib/data/client.ts, which re-exports createServiceClient from
 * lib/supabase/service.ts — and that module is `import 'server-only'`, which
 * throws outside the Next server bundle. This function has to answer for the
 * delta sync (Next runtime) AND for scripts/backfill-listing-piti.ts (plain
 * node under tsx), so it owns a minimal anon client and one query. Same table,
 * same filter, one implementation — the sync's rate and the backfill's rate
 * cannot disagree.
 *
 * Anon key, public-RLS table, no service role — so ci:service-client does not
 * apply, and no secret reaches a caller that should not hold one.
 *
 * Never throws: returns null on a missing series, an unreachable DB, or a value
 * outside the band a 30-yr rate lives in. Callers fall back to their own
 * documented default rather than failing.
 *
 * Uncached by design — every caller reads it once per run, not per row.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { IsoDate, IsoTimestamp } from '@/lib/data/types/shared'

export type LiveMortgageRate = {
  /** Annual 30-yr fixed rate as a percent, e.g. 6.67 */
  ratePct: number
  /** Same rate as the decimal fraction payment math takes, e.g. 0.0667 */
  rateFraction: number
  /** Monday of the week the rate was published — the vintage of the figure. */
  weekStart: IsoDate
  /** Provenance string from the row, e.g. 'freddie:pmms30'. */
  source: string
  /** When the snapshot cron captured it. */
  capturedAt: IsoTimestamp
}

/** A published 30-yr fixed rate lives inside this band; outside it the row is
 *  not a rate (a stored fraction, a placeholder, a bad ingest) and is dropped
 *  rather than propagated into a payment figure. */
const MIN_RATE_PCT = 2
const MAX_RATE_PCT = 20

/** How far back to look, so one missed Monday snapshot still resolves to the
 *  most recent real print instead of dropping callers to their fallback. */
const LOOKBACK_WEEKS = 12

let _client: SupabaseClient | null = null

function anonClient(): SupabaseClient | null {
  if (_client) return _client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !key?.trim()) return null
  _client = createClient(url, key)
  return _client
}

/** Newest usable 30-yr fixed rate, or null when the series has none. */
export async function getLiveMortgageRate(): Promise<LiveMortgageRate | null> {
  const sb = anonClient()
  if (!sb) return null

  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() - LOOKBACK_WEEKS * 7)

  // Two attempts: a pooler blip should not silently become "no rate", which
  // would quietly price a whole sync window at the fallback.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { data, error } = await sb
      .from('market_history_weekly')
      .select('week_start, value, source, captured_at')
      .eq('geo_type', 'national')
      .eq('geo_slug', 'us')
      .eq('metric', 'mortgage_rate_30yr')
      .gte('week_start', cutoff.toISOString().slice(0, 10))
      .order('week_start', { ascending: false })
      .limit(LOOKBACK_WEEKS)
    if (error) continue

    for (const row of (data ?? []) as Array<Record<string, unknown>>) {
      const value = typeof row.value === 'number' ? row.value : Number(row.value)
      if (!Number.isFinite(value) || value < MIN_RATE_PCT || value > MAX_RATE_PCT) continue
      return {
        ratePct: value,
        rateFraction: value / 100,
        weekStart: String(row.week_start) as IsoDate,
        source: String(row.source ?? 'market_history_weekly'),
        capturedAt: String(row.captured_at ?? '') as IsoTimestamp,
      }
    }
    return null // the query succeeded and held nothing usable — not a blip
  }
  return null
}
