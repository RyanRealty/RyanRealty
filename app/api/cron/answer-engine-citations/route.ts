/**
 * Monthly answer-engine citation battery (AEO-9, visibility audit 2026-09-22).
 *
 * Runs the target query set (lib/seo/ai-query-map.json plus the non-brand set
 * in lib/seo/answer-engine-battery.ts) through Grok's web_search tool via
 * lib/grok (CLAUDE.md section 4: never call the xAI host anywhere else), and
 * records per query whether ryan-realty.com is cited and which domains are,
 * into marketing_channel_daily with source 'answer_engine_battery' (read as
 * site_signal). lib/data/loop/signals.ts surfaces the newest run.
 *
 * Schedule: vercel.json, 16:00 UTC on the 2nd of each month. It is billed per
 * search call (the one test run on 2026-09-23: 16 queries, $9.20 reported by
 * xAI), so it runs at most once per calendar month: a second call in the same
 * month returns { skipped } unless `?force=1` is passed.
 *
 * Auth: Authorization: Bearer $CRON_SECRET (requireCronAuth, fail closed).
 * No outbound message, no post, no spend beyond the search calls themselves.
 */
import { NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { searchGrok, grokConfigured } from '@/lib/grok'
import { createServiceClient } from '@/lib/supabase/service'
import { upsertMetricRows } from '@/lib/marketing-brain/snapshot'
import {
  batteryQueries,
  batteryRows,
  runAnswerEngineBattery,
} from '@/lib/seo/answer-engine-battery'
import { ranThisMonth, readAnswerEngineCitations } from '@/lib/data/loop/answer-engine-citations'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: Request) {
  const unauthorized = requireCronAuth(request)
  if (unauthorized) return unauthorized

  if (!grokConfigured()) {
    return NextResponse.json({ ok: false, error: 'grok not configured' }, { status: 503 })
  }

  const now = new Date()
  const force = new URL(request.url).searchParams.get('force') === '1'
  const sb = createServiceClient()
  const latest = await readAnswerEngineCitations(sb, now)
  if (!force && latest.status === 'ok' && ranThisMonth(latest.runDate, now)) {
    return NextResponse.json({ ok: true, skipped: `already ran ${latest.runDate}` })
  }

  const queries = batteryQueries()
  const results = await runAnswerEngineBattery((input) => searchGrok(input), queries)
  const date = now.toISOString().slice(0, 10)
  const rows = batteryRows(date, results)
  const written = await upsertMetricRows(rows)

  const cited = results.filter((r) => r.score?.cited).map((r) => r.query.query)
  const errors = results.filter((r) => r.error).map((r) => ({ id: r.query.id, error: r.error }))
  const costUsd = results.reduce((sum, r) => sum + (r.costUsd ?? 0), 0)
  return NextResponse.json({
    ok: errors.length < results.length,
    date,
    queries: results.length,
    answered: results.filter((r) => r.score).length,
    cited,
    errors,
    rowsWritten: written,
    costUsd: Math.round(costUsd * 100) / 100,
  })
}
