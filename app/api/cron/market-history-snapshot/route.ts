import { NextResponse, type NextRequest } from 'next/server'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { createServiceClient } from '@/lib/data/client'
import { fetchMortgage30yr, fetchTreasury10yr } from '@/lib/market-national-series'
import {
  buildNationalRows,
  buildPulseSnapshotRows,
  PULSE_SELECT_COLUMNS,
  UPSERT_ON_CONFLICT,
  weekStartUtc,
  type PulseSnapshotSource,
} from './build-rows'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * market-history-snapshot — Mondays 13:00 UTC (vercel.json cron).
 *
 * market_pulse_live overwrites itself every 10-15 minutes, so no weekly time
 * series exists for inventory, new listings, pendings, price-cut share, MoS,
 * or median list price — which makes HousingWire-style weekly framing
 * ("inventory rose for the 4th straight week") impossible. This cron freezes
 * one weekly frame per city + region geo into public.market_history_weekly,
 * and captures the national rate context (30yr mortgage via FRED/Freddie
 * PMMS, 10Y treasury via FRED, computed spread) in the same run.
 *
 * Idempotent per week: week_start is the Monday (UTC) of the run's ISO week
 * and the upsert conflicts on the table PK, so retries and manual re-fires
 * overwrite the same week's rows instead of appending.
 *
 * Every row carries three separate facts §0 needs: `source` (where the number
 * came from), `observation_date` (when the SOURCE says it was observed), and
 * `captured_at` (when this cron wrote it). They are not interchangeable —
 * Freddie's 30yr rate is dated to a week-ending Thursday and this cron runs
 * the following Monday.
 *
 * Degrades gracefully:
 *  - table missing (migration 20260722020100 not applied) -> 42P01 is logged
 *    clearly and the run exits ok:false WITHOUT throwing;
 *  - each national series fails independently (missing FRED_API_KEY, network)
 *    with a logged reason — local snapshots still land.
 */
export async function GET(request: NextRequest) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const weekStart = weekStartUtc(new Date())
  const sb = createServiceClient()

  // --- Local series: one frozen frame per city + region geo (SFR only). ---
  const { data: pulseRows, error: pulseError } = await sb
    .from('market_pulse_live')
    .select(PULSE_SELECT_COLUMNS)
    .in('geo_type', ['city', 'region'])
    .eq('property_type', 'A')
  if (pulseError) {
    console.error(`[market-history-snapshot] market_pulse_live read failed: ${pulseError.message}`)
    // Hard failure — 500 so cron monitoring sees it (sibling-cron convention).
    return NextResponse.json({ ok: false, reason: 'pulse_read_failed', detail: pulseError.message }, { status: 500 })
  }

  // PULSE_SELECT_COLUMNS is a computed string, so supabase-js cannot infer the
  // row shape — assert through unknown to the source type the builder expects.
  const localRows = buildPulseSnapshotRows(weekStart, (pulseRows ?? []) as unknown as PulseSnapshotSource[])

  // --- National series: each degrades independently, never throws. ---
  const [mortgage30, treasury10] = await Promise.all([fetchMortgage30yr(), fetchTreasury10yr()])
  const nationalRows = buildNationalRows(weekStart, mortgage30, treasury10)

  const rows = [...localRows, ...nationalRows]
  if (rows.length === 0) {
    console.warn('[market-history-snapshot] nothing to snapshot: pulse returned no city/region rows and all national series degraded')
    return NextResponse.json({ ok: false, reason: 'no_rows', weekStart })
  }

  // captured_at is set explicitly (not left to the column default) so a
  // same-week re-fire that overwrites `value` also refreshes the capture
  // timestamp — §0 provenance: the timestamp always matches the stored value.
  // observation_date rides along on each row: captured_at is when WE wrote it,
  // observation_date is when the SOURCE says it was observed. Both are needed
  // for the §0 trace and they are days apart for the weekly rate series.
  const capturedAt = new Date().toISOString()
  const payload = rows.map((r) => ({ ...r, captured_at: capturedAt }))

  let { error: upsertError } = await sb
    .from('market_history_weekly')
    .upsert(payload, { onConflict: UPSERT_ON_CONFLICT })

  // observation_date ships in migration 20260817120000. Until it is applied,
  // PostgREST rejects the whole batch (PGRST204 unknown column / 42703
  // undefined_column). Retry once without it rather than lose the week's
  // history — the values still land, only the provider vintage is missing,
  // and the log names the remedy. Same fail-soft convention as the
  // table-missing branch below.
  const observationDateColumnMissing =
    upsertError != null &&
    (upsertError.code === 'PGRST204' || upsertError.code === '42703') &&
    upsertError.message.includes('observation_date')
  if (observationDateColumnMissing) {
    console.warn(
      '[market-history-snapshot] public.market_history_weekly.observation_date does not exist yet — apply ' +
        'supabase/migrations/20260817120000_market_history_weekly_observation_date.sql so the provider vintage ' +
        'is preserved (§0). Retrying this week without it; values land, observation dates do not.',
    )
    // Pre-migration column set, written out rather than spread-minus-one so
    // the legacy shape is explicit at the call site.
    const legacyPayload = payload.map((r) => ({
      week_start: r.week_start,
      geo_type: r.geo_type,
      geo_slug: r.geo_slug,
      metric: r.metric,
      value: r.value,
      source: r.source,
      captured_at: r.captured_at,
    }))
    ;({ error: upsertError } = await sb
      .from('market_history_weekly')
      .upsert(legacyPayload, { onConflict: UPSERT_ON_CONFLICT }))
  }

  if (upsertError) {
    // Feature detection: the table ships in migration
    // 20260722020100_market_history_weekly.sql. Until the orchestrator applies
    // it, log the exact remedy and exit soft — never throw. 42P01 = Postgres
    // undefined_table; PGRST205 = PostgREST relation not in schema cache (the
    // code supabase-js actually surfaces pre-migration — same sibling pattern
    // as app/actions/hidden-listings.ts).
    if (upsertError.code === '42P01' || upsertError.code === 'PGRST205') {
      console.error(
        '[market-history-snapshot] public.market_history_weekly does not exist yet — apply ' +
          'supabase/migrations/20260722020100_market_history_weekly.sql, then this cron starts capturing. No rows written.',
      )
      return NextResponse.json({ ok: false, reason: 'table_missing', weekStart })
    }
    console.error(`[market-history-snapshot] upsert failed: ${upsertError.message}`)
    // Hard failure — 500 so cron monitoring sees it (sibling-cron convention).
    return NextResponse.json({ ok: false, reason: 'upsert_failed', detail: upsertError.message, weekStart }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    weekStart,
    geos: new Set(localRows.map((r) => `${r.geo_type}:${r.geo_slug}`)).size,
    rowsUpserted: rows.length,
    // False means the week landed without provider vintages because migration
    // 20260817120000 is not applied yet — visible to cron monitoring.
    observationDatesPersisted: !observationDateColumnMissing,
    national: {
      mortgage30: mortgage30 ? { value: mortgage30.value, source: mortgage30.source, asOf: mortgage30.observationDate } : null,
      treasury10: treasury10 ? { value: treasury10.value, source: treasury10.source, asOf: treasury10.observationDate } : null,
      spreadCaptured: Boolean(mortgage30 && treasury10),
    },
  })
}
