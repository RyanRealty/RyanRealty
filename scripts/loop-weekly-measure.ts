/**
 * loop-weekly-measure — the Monday measurer (app/api/cron/loop-weekly-measure)
 * run from a terminal, and the GSC store backfill.
 *
 *   npx tsx scripts/loop-weekly-measure.ts                       dry run: reads, prints, writes nothing
 *   npx tsx scripts/loop-weekly-measure.ts --apply               the same run the cron does
 *   npx tsx scripts/loop-weekly-measure.ts --apply --steps store --from 2025-06-01 --to 2026-09-19
 *       backfill the full-fidelity GSC store (GSC keeps 16 months); loops in
 *       120-day calls, oldest first
 *
 * Needs migration 20260923150000_gsc_full_store_loop_measurer.sql for the store
 * and snapshot steps; without it they report "missing" and skip.
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { addDays, createGscQuery, daysBetweenInclusive, isIsoDate, settledEndDate } from '../lib/data/loop/gsc-api'
import { runWeeklyMeasure, STORE_MAX_DAYS_PER_RUN, type WeeklyMeasureSteps } from '../lib/data/loop/weekly-measure'

config({ path: '.env.local' })

function arg(name: string): string | null {
  const i = process.argv.indexOf(name)
  const v = i >= 0 ? process.argv[i + 1] : null
  return v && !v.startsWith('--') ? v : null
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('UNREADABLE: Supabase env missing')
    process.exit(2)
  }
  const apply = process.argv.includes('--apply')
  const stepsArg = arg('--steps')
  const steps: Partial<WeeklyMeasureSteps> | undefined = stepsArg
    ? Object.fromEntries(
        (['store', 'learn', 'seed', 'snapshot'] as const).map((s) => [s, stepsArg.split(',').includes(s)]),
      )
    : undefined
  const from = arg('--from')
  const to = arg('--to') ?? settledEndDate()
  if (from && !(isIsoDate(from) && isIsoDate(to) && from <= to)) {
    console.error('--from/--to must be YYYY-MM-DD, from <= to')
    process.exit(2)
  }
  const sb = createClient(url, key)
  const gsc = await createGscQuery()
  if (!gsc) console.error('no GSC service-account env: store and query-gap seeding will skip')

  const ranges: Array<{ startDate: string; endDate: string } | null> = []
  if (from) {
    for (let start = from; start <= to; start = addDays(start, STORE_MAX_DAYS_PER_RUN)) {
      const end = addDays(start, STORE_MAX_DAYS_PER_RUN - 1)
      ranges.push({ startDate: start, endDate: end < to ? end : to })
    }
  } else {
    ranges.push(null)
  }

  let failed = false
  for (const range of ranges) {
    if (range) console.error(`range ${range.startDate}..${range.endDate} (${daysBetweenInclusive(range.startDate, range.endDate)} days)`)
    const result = await runWeeklyMeasure(
      { sb, gsc },
      { dryRun: !apply, steps, storeRange: range, source: apply ? 'cli:loop-weekly-measure' : 'cli:dry-run' },
    )
    console.log(JSON.stringify(result, null, 2))
    if (!result.ok) failed = true
  }
  if (failed) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
