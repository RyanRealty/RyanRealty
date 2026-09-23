/**
 * Weekly scoreboard snapshot rows (visibility audit 2026-09-22, PROCESS-1,
 * TRACK-11). docs/plans/COMPANY_SCOREBOARD.md was last written 2026-08-15 by
 * hand; the weekly measurer (app/api/cron/loop-weekly-measure) now records the
 * collector's full output (collectCompanyScoreboardSignals, the same one
 * scripts/company-scoreboard-probe.ts prints) into public.loop_scoreboard_snapshots
 * every Monday, with what that run did. The boot brief reads the newest row.
 *
 * Table: supabase/migrations/20260923150000_gsc_full_store_loop_measurer.sql.
 * reachability: entry-point scripts/loop-brief.ts + app/api/cron/loop-weekly-measure
 */
import type { SupabaseClient } from '@supabase/supabase-js'

import { formatClassDelta, type GscClassDelta, type GscTrend } from './gsc-trend'
import { GSC_STORE_MIGRATION, isMissingRelationError } from './gsc-store'
import type { CompanyScoreboardSignals } from './signals'

export type ScoreboardSnapshot = {
  id: string
  takenAt: string
  source: string
  gscStatus: string
  gsc: Partial<GscTrend>
  signals: Partial<CompanyScoreboardSignals>
  run: Record<string, unknown>
}

/** A snapshot older than this means the Monday measurer missed a run. */
export const SNAPSHOT_STALE_DAYS = 8

export async function writeScoreboardSnapshot(
  sb: SupabaseClient,
  input: { source: string; signals: CompanyScoreboardSignals; run: Record<string, unknown> },
): Promise<{ status: 'written'; id: string } | { status: 'missing' | 'error'; reason: string }> {
  const { data, error } = await sb
    .from('loop_scoreboard_snapshots')
    .insert({
      taken_at: input.signals.fetchedAt,
      source: input.source,
      gsc_status: input.signals.gsc.status,
      gsc: input.signals.gsc.trend,
      signals: input.signals,
      run: input.run,
    })
    .select('id')
    .single()
  if (error || !data?.id) {
    if (isMissingRelationError(error)) {
      return { status: 'missing', reason: `loop_scoreboard_snapshots missing: apply ${GSC_STORE_MIGRATION}` }
    }
    return { status: 'error', reason: error?.message ?? 'insert returned no id' }
  }
  return { status: 'written', id: String(data.id) }
}

export async function readLatestScoreboardSnapshot(
  sb: SupabaseClient,
): Promise<{ status: 'ok'; row: ScoreboardSnapshot } | { status: 'missing' | 'empty' | 'error'; reason: string }> {
  const { data, error } = await sb
    .from('loop_scoreboard_snapshots')
    .select('id,taken_at,source,gsc_status,gsc,signals,run')
    .order('taken_at', { ascending: false })
    .limit(1)
  if (error) {
    if (isMissingRelationError(error)) {
      return { status: 'missing', reason: `loop_scoreboard_snapshots missing: apply ${GSC_STORE_MIGRATION}` }
    }
    return { status: 'error', reason: String(error.message) }
  }
  const r = (data ?? [])[0] as Record<string, unknown> | undefined
  if (!r) return { status: 'empty', reason: 'no snapshot yet: the Monday measurer has not run' }
  return {
    status: 'ok',
    row: {
      id: String(r.id),
      takenAt: String(r.taken_at),
      source: String(r.source ?? ''),
      gscStatus: String(r.gsc_status ?? ''),
      gsc: (r.gsc ?? {}) as Partial<GscTrend>,
      signals: (r.signals ?? {}) as Partial<CompanyScoreboardSignals>,
      run: (r.run ?? {}) as Record<string, unknown>,
    },
  }
}

function ageDays(iso: string, now: Date): number {
  return Math.floor((now.getTime() - Date.parse(iso)) / (24 * 60 * 60 * 1000))
}

/**
 * The brief's measurer block. Prints the newest snapshot, then the top three
 * week-over-week page-class moves (live trend when readable, else the
 * snapshot's), then the degraded classes.
 */
export function formatMeasurerBrief(input: {
  snapshot: Awaited<ReturnType<typeof readLatestScoreboardSnapshot>>
  live: GscTrend | null
  now?: Date
}): string[] {
  const now = input.now ?? new Date()
  const lines: string[] = []
  const snap = input.snapshot
  if (snap.status !== 'ok') {
    lines.push(`snapshot: none (${snap.reason})`)
  } else {
    const row = snap.row
    const age = ageDays(row.takenAt, now)
    const stale = age > SNAPSHOT_STALE_DAYS ? ` · STALE: older than ${SNAPSHOT_STALE_DAYS} days, the Monday measurer missed a run` : ''
    lines.push(`snapshot: ${row.takenAt} (${age}d ago, ${row.source})${stale}`)
    const s = row.signals
    const ledger = s.ledger
    const crm = s.crm
    lines.push(
      `  gsc ${row.gscStatus}${row.gsc.anchor ? ` · anchor ${row.gsc.anchor}` : ''} · people ${crm?.people ?? 'UNKNOWN'} · ledger open ${ledger?.openWindows ?? 'UNKNOWN'} / stranded ${ledger?.expiredUnlearned ?? 'UNKNOWN'}`,
    )
    const run = row.run as {
      store?: { status?: string; pages?: number; queryPages?: number; startDate?: string; endDate?: string; reason?: string }
      seed?: { inserted?: number; versionGaps?: string[]; drafts?: number; error?: string | null }
      learn?: { due?: number; verdicts?: Record<string, number>; error?: string | null }
    }
    const store = run.store
    const seed = run.seed
    const learn = run.learn
    lines.push(
      `  run: store ${store?.status ?? '-'}${store?.pages != null ? ` ${store.pages} page rows + ${store.queryPages ?? 0} query x page rows ${store.startDate}..${store.endDate}` : ''}${store?.reason ? ` (${store.reason})` : ''} · seeded ${seed?.inserted ?? 0}${seed?.versionGaps?.length ? ` (${seed.versionGaps.join(', ')})` : ''} · learned ${learn?.due ?? 0}${learn?.verdicts ? ` ${JSON.stringify(learn.verdicts)}` : ''}`,
    )
  }
  const trend: Partial<GscTrend> | null =
    input.live && input.live.status !== 'unreadable' ? input.live : snap.status === 'ok' ? snap.row.gsc : null
  const from = trend === input.live ? 'live' : 'snapshot'
  const wow = (trend?.wow ?? []) as GscClassDelta[]
  if (!trend || trend.status === 'unreadable' || !trend.windows) {
    lines.push(`GSC week over week by page class: UNREADABLE (${input.live?.note ?? 'no trend'})`)
  } else {
    lines.push(
      `GSC week over week by page class (${from}; ${trend.windows.cur7.start}..${trend.windows.cur7.end} vs ${trend.windows.prev7.start}..${trend.windows.prev7.end}), top ${wow.length}:`,
    )
    for (const d of wow) lines.push(`  ${formatClassDelta(d)}`)
    const degraded = (trend.degraded ?? []) as GscClassDelta[]
    lines.push(
      degraded.length
        ? `DEGRADED money classes (28d to ${trend.windows.cur28.end} vs prior 28d): ${degraded.map((d) => `${d.pageClass}/${d.market}`).join(', ')}`
        : 'no money class degraded (28d vs prior 28d)',
    )
  }
  return lines
}
