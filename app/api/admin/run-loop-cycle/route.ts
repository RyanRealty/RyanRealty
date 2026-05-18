/**
 * /api/admin/run-loop-cycle
 *
 * One-button "run the whole loop end to end" diagnostic. Chains every wire
 * in sequence with structured reporting per stage. Matt clicks this to prove
 * the system is alive without curling 6 different cron endpoints.
 *
 * Stages (each calls the corresponding cron route with the same CRON_SECRET):
 *   1. snapshot-channels      -- refresh platform metrics
 *   2. weekly-cycle           -- brain emits new action_rows
 *   3. producer-dispatcher    -- pending -> in_production
 *   4. producer-runtime       -- in_production -> ready (dry-run by default)
 *   5. publisher-sweep        -- approved -> executed (dry-run by default)
 *   6. performance-pull-48h   -- pull recent metrics
 *   7. marketing-measurement-loop -- compute winners/losers digest
 *   8. loop-health-check      -- final pulse
 *
 * Auth: existing admin Supabase cookie auth.
 * Default mode: dryRun=true (no Anthropic spend, no real publishes).
 * Override: ?dryRun=false&authorized=true to run live (Anthropic credit will burn).
 *
 * Output: { ok, dry_run, stages: [{name, status, duration_ms, body}], total_duration_ms }
 *
 * Locked 2026-05-17.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const STAGES = [
  { name: 'snapshot-channels', path: '/api/cron/snapshot-channels', dryRunAware: false },
  { name: 'weekly-cycle', path: '/api/cron/weekly-cycle', dryRunAware: true },
  { name: 'producer-dispatcher', path: '/api/cron/producer-dispatcher', dryRunAware: true },
  { name: 'producer-runtime', path: '/api/cron/producer-runtime', dryRunAware: true },
  { name: 'publisher-sweep', path: '/api/cron/publisher-sweep', dryRunAware: true },
  { name: 'performance-pull-48h', path: '/api/cron/performance-pull-48h', dryRunAware: false },
  { name: 'measurement-loop', path: '/api/cron/marketing-measurement-loop', dryRunAware: true },
  { name: 'loop-health-check', path: '/api/cron/loop-health-check', dryRunAware: false },
]

export async function GET(req: NextRequest) {
  // Admin auth
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const adminRole = await getAdminRoleForEmail(user.email)
  if (!adminRole) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(req.url)
  const dryRun = url.searchParams.get('dryRun') !== 'false'
  const authorized = url.searchParams.get('authorized') === 'true'
  const stageFilter = url.searchParams.get('stages')?.split(',') || null

  if (!dryRun && !authorized) {
    return NextResponse.json({
      error: 'Live run requires both dryRun=false AND authorized=true. Default dryRun=true protects against accidental burn.',
    }, { status: 400 })
  }

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not set' }, { status: 500 })
  }

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.MARKETING_DASHBOARD_BASE_URL || 'http://localhost:3000'

  const stageReports: any[] = []
  const t0 = Date.now()

  for (const stage of STAGES) {
    if (stageFilter && !stageFilter.includes(stage.name)) continue
    const tStage = Date.now()
    let body: any = null
    let httpStatus = 0
    let error: string | undefined
    try {
      const qs = stage.dryRunAware ? `?dryRun=${dryRun ? 'true' : 'false'}` : ''
      const res = await fetch(`${baseUrl}${stage.path}${qs}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${cronSecret}` },
      })
      httpStatus = res.status
      body = await res.json().catch(() => ({}))
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    }
    stageReports.push({
      name: stage.name,
      path: stage.path,
      status: error ? 'error' : httpStatus >= 200 && httpStatus < 300 ? 'ok' : 'failed',
      http_status: httpStatus,
      duration_ms: Date.now() - tStage,
      error,
      body_summary: typeof body === 'object' && body
        ? Object.keys(body).slice(0, 8).reduce((o: any, k) => {
            o[k] = typeof body[k] === 'object' ? '[object]' : body[k]
            return o
          }, {})
        : body,
    })
  }

  return NextResponse.json({
    ok: stageReports.every((s) => s.status === 'ok'),
    dry_run: dryRun,
    started_at: new Date(t0).toISOString(),
    total_duration_ms: Date.now() - t0,
    stages_run: stageReports.length,
    stages_ok: stageReports.filter((s) => s.status === 'ok').length,
    stages_failed: stageReports.filter((s) => s.status !== 'ok').length,
    stages: stageReports,
    note: dryRun
      ? 'Dry run. Re-fire with ?dryRun=false&authorized=true to execute live (Anthropic credit burn applies on producer-runtime stage).'
      : 'LIVE RUN. Real Anthropic calls, real publishes if approved rows exist.',
  })
}
