/**
 * Phase 11.5 canonical consolidated snapshot handler.
 *
 * The autonomous pipeline brief calls this handler `snapshot-channels`. The
 * existing infrastructure runs per-platform handlers under marketing-snapshot-*.
 * marketing-snapshot-fub was removed 2026-07-09 (CRM decommissioned 2026-06-24).
 * google-ads was restored to the fan-out list 2026-08-08 (Enterprise Map: route
 * existed with a fan-out header comment but was omitted from PLATFORMS).
 *
 * This handler is the consolidated entry point. It fires every individual
 * snapshot in parallel against the same authenticated CRON_SECRET, collects
 * the per-platform results, and returns a single roll-up status report.
 *
 * Schedule: daily 12:00 UTC (05:00 Mountain), per vercel.json.
 * Auth: Authorization: Bearer $CRON_SECRET.
 * Manual invocation: GET /api/cron/snapshot-channels
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/auth/cron-auth'

export const maxDuration = 300
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PLATFORMS = [
  'ga4',
  'gsc',
  'meta-ads',
  'meta-page',
  'x',
  'linkedin',
  'tiktok',
  'gbp',
  'youtube',
  // Was on disk with a fan-out comment but omitted here — orphan until 2026-08-08 map pass.
  'google-ads',
] as const

export async function GET(request: NextRequest) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not set' }, { status: 500 })
  }

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : (process.env.MARKETING_DASHBOARD_BASE_URL || 'http://localhost:3000')

  const results: Record<string, { ok: boolean; status: number; body?: unknown; error?: string }> = {}

  await Promise.all(
    PLATFORMS.map(async (p) => {
      try {
        const res = await fetch(`${baseUrl}/api/cron/marketing-snapshot-${p}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${cronSecret}` },
        })
        const body = await res.json().catch(() => ({}))
        results[p] = { ok: res.ok, status: res.status, body }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        results[p] = { ok: false, status: 0, error: msg }
      }
    })
  )

  const ok_count = Object.values(results).filter((r) => r.ok).length
  return NextResponse.json({
    invoked_via: 'snapshot-channels (Phase 11.5 consolidated alias)',
    platforms: PLATFORMS.length,
    ok_count,
    failed: PLATFORMS.filter((p) => !results[p]?.ok),
    results,
    invoked_at: new Date().toISOString(),
  })
}
