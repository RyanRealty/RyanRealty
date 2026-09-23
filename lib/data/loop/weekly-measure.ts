/**
 * The weekly measurer (visibility audit 2026-09-22: PROCESS-1, PROCESS-2,
 * TRACK-5, TRACK-11, gsc-trend-1, gsc-trend-2). One run, every Monday, in the
 * cloud (app/api/cron/loop-weekly-measure), so a ranking loss becomes work
 * without a Mac LaunchAgent or a session remembering to look:
 *
 *   1. store    GSC page x date + query x page x date, every row, into
 *               gsc_page_daily / gsc_query_page_daily (settled days only)
 *   2. learn    close due site_improvement_ledger windows (./learn-close)
 *   3. collect  the scoreboard signals, including the page-class trend
 *   4. seed     GSC-gap SITE nodes (./gsc-ranking-seed) + one node per
 *               degraded money class, deduped against the graph
 *   5. snapshot one loop_scoreboard_snapshots row the boot brief reads
 *
 * Every step is isolated: a missing table (migration not applied) or a GSC
 * error skips that step with a named reason and the rest still run. dryRun
 * reads everything and writes nothing.
 * reachability: entry-point app/api/cron/loop-weekly-measure + scripts/loop-weekly-measure.ts
 */
import type { SupabaseClient } from '@supabase/supabase-js'

import { addDays, daysBetweenInclusive, settledEndDate, type GscQueryFn } from './gsc-api'
import {
  buildClassSlipDrafts,
  buildGscGapDrafts,
  insertGscGapNodes,
  nextSiteNumber,
  pullGscSeedRows,
  readSeedContext,
  seedWindow,
  type GscGapDraft,
} from './gsc-ranking-seed'
import { pullGscStoreRange, readGscStoreCoverage, writeGscStore } from './gsc-store'
import { learnDueWindows, liveGscPageTotals } from './learn-close'
import { writeScoreboardSnapshot } from './scoreboard-snapshot'
import { collectCompanyScoreboardSignals } from './signals'

/** Default store refill: the two 28-day trend windows. */
export const STORE_TREND_DAYS = 56
/** One call never pulls more than this many days (route time budget); the CLI backfill loops. */
export const STORE_MAX_DAYS_PER_RUN = 120
/** Re-pull this many already-stored days, so late GSC processing is corrected in place. */
export const STORE_OVERLAP_DAYS = 7

export type WeeklyMeasureSteps = { store: boolean; learn: boolean; seed: boolean; snapshot: boolean }

export type WeeklyMeasureResult = {
  ok: boolean
  dryRun: boolean
  source: string
  startedAt: string
  finishedAt: string
  store: Record<string, unknown>
  learn: Record<string, unknown>
  trend: Record<string, unknown>
  seed: Record<string, unknown>
  snapshot: Record<string, unknown>
  errors: string[]
}

/**
 * The range the store step pulls. An explicit range wins (capped). Otherwise:
 * the whole 56-day trend span when the store is empty, else from a week before
 * the newest stored day, never earlier than the trend span needs.
 */
export function storePullRange(input: {
  now: Date
  explicit?: { startDate: string; endDate: string } | null
  storedMaxDate: string | null
}): { startDate: string; endDate: string; capped: boolean } {
  const settled = settledEndDate(input.now)
  if (input.explicit) {
    const endDate = input.explicit.endDate < settled ? input.explicit.endDate : settled
    let startDate = input.explicit.startDate
    let capped = false
    if (daysBetweenInclusive(startDate, endDate) > STORE_MAX_DAYS_PER_RUN) {
      startDate = addDays(endDate, -(STORE_MAX_DAYS_PER_RUN - 1))
      capped = true
    }
    return { startDate, endDate, capped }
  }
  const trendStart = addDays(settled, -(STORE_TREND_DAYS - 1))
  if (!input.storedMaxDate) return { startDate: trendStart, endDate: settled, capped: false }
  const fromStored = addDays(input.storedMaxDate, -STORE_OVERLAP_DAYS)
  return { startDate: fromStored > trendStart ? fromStored : trendStart, endDate: settled, capped: false }
}

function tally(values: string[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const v of values) out[v] = (out[v] ?? 0) + 1
  return out
}

export async function runWeeklyMeasure(
  deps: { sb: SupabaseClient; gsc: GscQueryFn | null },
  opts: {
    now?: Date
    dryRun?: boolean
    steps?: Partial<WeeklyMeasureSteps>
    storeRange?: { startDate: string; endDate: string } | null
    source?: string
  } = {},
): Promise<WeeklyMeasureResult> {
  const now = opts.now ?? new Date()
  const dryRun = Boolean(opts.dryRun)
  const steps: WeeklyMeasureSteps = { store: true, learn: true, seed: true, snapshot: true, ...opts.steps }
  const source = opts.source ?? 'cron:loop-weekly-measure'
  const errors: string[] = []
  const result: WeeklyMeasureResult = {
    ok: true,
    dryRun,
    source,
    startedAt: new Date().toISOString(),
    finishedAt: '',
    store: { status: 'skipped' },
    learn: { status: 'skipped' },
    trend: { status: 'skipped' },
    seed: { status: 'skipped' },
    snapshot: { status: 'skipped' },
    errors,
  }

  // 1. store
  if (steps.store) {
    try {
      if (!deps.gsc) {
        result.store = { status: 'skipped', reason: 'no GSC service-account credentials' }
      } else {
        const coverage = await readGscStoreCoverage(deps.sb)
        if (coverage.status === 'missing' && !dryRun) {
          result.store = { status: 'missing', reason: coverage.reason }
        } else if (coverage.status === 'error') {
          result.store = { status: 'error', reason: coverage.reason }
          errors.push(`store: ${coverage.reason}`)
        } else {
          const range = storePullRange({
            now,
            explicit: opts.storeRange ?? null,
            storedMaxDate: coverage.status === 'ok' ? coverage.maxDate : null,
          })
          const pull = await pullGscStoreRange(deps.gsc, range)
          const base = {
            startDate: range.startDate,
            endDate: range.endDate,
            capped: range.capped,
            requests: pull.requests,
            truncated: pull.truncated,
            pageRowsPulled: pull.pageRows.length,
            queryPageRowsPulled: pull.queryPageRows.length,
            trackableQueryPageRows: pull.queryPageRows.filter((r) => r.trackable).length,
          }
          if (dryRun) {
            result.store = { status: 'dry-run', ...base, storeCoverage: coverage }
          } else {
            const write = await writeGscStore(deps.sb, pull)
            result.store = { ...base, ...write }
            if (write.status === 'error') errors.push(`store: ${write.reason}`)
          }
        }
      }
    } catch (err) {
      result.store = { status: 'error', reason: (err as Error).message }
      errors.push(`store: ${(err as Error).message}`)
    }
  }

  // 2. learn
  if (steps.learn) {
    try {
      const learned = await learnDueWindows(
        { sb: deps.sb, gscPageTotals: deps.gsc ? liveGscPageTotals(deps.gsc) : null },
        { now, dryRun, label: `weekly measurer${dryRun ? ', dry run' : ''}` },
      )
      if (learned.error) errors.push(`learn: ${learned.error}`)
      const writeErrors = learned.outcomes.filter((o) => o.error).map((o) => `${o.id.slice(0, 8)}: ${o.error}`)
      errors.push(...writeErrors.map((e) => `learn: ${e}`))
      result.learn = {
        status: learned.error ? 'error' : dryRun ? 'dry-run' : 'written',
        due: learned.due,
        verdicts: tally(learned.outcomes.map((o) => o.verdict)),
        outcomes: learned.outcomes.map((o) => ({
          id: o.id,
          changeClass: o.changeClass,
          metric: o.metric,
          window: o.window,
          verdict: o.verdict,
          actualDelta: o.actualDelta,
          written: o.written,
          error: o.error,
        })),
        error: learned.error,
      }
    } catch (err) {
      result.learn = { status: 'error', reason: (err as Error).message }
      errors.push(`learn: ${(err as Error).message}`)
    }
  }

  // 3. collect (always: the seed and snapshot steps read it)
  let signals: Awaited<ReturnType<typeof collectCompanyScoreboardSignals>> | null = null
  try {
    signals = await collectCompanyScoreboardSignals(deps.sb, now)
    const t = signals.gsc.trend
    result.trend = {
      status: t.status,
      note: t.note,
      anchor: t.anchor,
      degraded: t.degraded.map((d) => ({ pageClass: d.pageClass, market: d.market, impressionsPct: d.impressionsPct, positionDelta: d.positionDelta })),
      wow: t.wow.map((d) => ({ pageClass: d.pageClass, market: d.market, impressionsDelta: d.impressionsDelta, clicksDelta: d.clicksDelta })),
    }
  } catch (err) {
    result.trend = { status: 'error', reason: (err as Error).message }
    errors.push(`collect: ${(err as Error).message}`)
  }

  // 4. seed
  if (steps.seed) {
    try {
      const ctx = await readSeedContext(deps.sb)
      if (ctx.error) throw new Error(`SITE gaps unreadable: ${ctx.error}`)
      let drafts: GscGapDraft[] = []
      let firstFree: number | undefined
      let gapNote = 'no GSC service-account credentials: query gaps not diagnosed'
      if (deps.gsc) {
        const window = seedWindow(now)
        const rows = await pullGscSeedRows(deps.gsc, window)
        const gaps = buildGscGapDrafts({
          queries: rows.queries,
          queryPages: rows.queryPages,
          landings: null,
          targetQueries: ctx.targetQueries,
          existing: ctx.existing,
          now,
        })
        drafts = gaps.drafts
        firstFree = gaps.nextSiteNumber
        gapNote = `GSC ${window.startDate}..${window.endDate}: ${rows.queries.length} queries, ${rows.queryPages.length} query x page rows, ${gaps.gaps.length} gaps, ${gaps.drafts.length} new`
      }
      const trend = signals?.gsc.trend
      const slips = buildClassSlipDrafts({
        degraded: trend?.degraded ?? [],
        anchor: trend?.anchor ?? null,
        existing: ctx.existing,
        firstSiteNumber: firstFree ?? nextSiteNumber(ctx.existing.map((r) => String(r.version_gap ?? ''))),
        now,
      })
      const all = [...drafts, ...slips.drafts]
      const insert = dryRun ? { inserted: 0, versionGaps: [] as string[], error: null } : await insertGscGapNodes(deps.sb, all)
      if (insert.error) errors.push(`seed: ${insert.error}`)
      result.seed = {
        status: insert.error ? 'error' : dryRun ? 'dry-run' : 'written',
        note: gapNote,
        drafts: all.length,
        classSlipDrafts: slips.drafts.length,
        titles: all.map((d) => `${d.versionGap} ${d.title}`),
        inserted: insert.inserted,
        versionGaps: insert.versionGaps,
        error: insert.error,
      }
    } catch (err) {
      result.seed = { status: 'error', reason: (err as Error).message }
      errors.push(`seed: ${(err as Error).message}`)
    }
  }

  // 5. snapshot
  if (steps.snapshot) {
    if (!signals) {
      result.snapshot = { status: 'skipped', reason: 'signals unreadable' }
    } else if (dryRun) {
      result.snapshot = { status: 'dry-run' }
    } else {
      try {
        const run = {
          store: result.store,
          learn: { due: result.learn.due, verdicts: result.learn.verdicts, error: result.learn.error ?? null },
          seed: { drafts: result.seed.drafts, inserted: result.seed.inserted, versionGaps: result.seed.versionGaps, error: result.seed.error ?? null },
          errors: [...errors],
        }
        const snap = await writeScoreboardSnapshot(deps.sb, { source, signals, run })
        result.snapshot = snap
        if (snap.status === 'error') errors.push(`snapshot: ${snap.reason}`)
      } catch (err) {
        result.snapshot = { status: 'error', reason: (err as Error).message }
        errors.push(`snapshot: ${(err as Error).message}`)
      }
    }
  }

  result.ok = errors.length === 0
  result.finishedAt = new Date().toISOString()
  return result
}
