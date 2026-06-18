import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * DISABLED 2026-06-18 (Matt directive).
 *
 * This route previously ran on an hourly Vercel cron (`20 * * * *`). With
 * `FOLLOWUPBOSS_EXECUTION_ENABLED=true` it, every hour:
 *   1. Re-wrote the same "Automated outreach packet generated." note to up to
 *      150 "My Leads" contacts (no idempotency guard) — producing dozens of
 *      duplicate notes per contact per day.
 *   2. Re-mutated each person's FUB stage + tags. Its only skip-list was a
 *      hardcoded set of stage strings; it never checked FUB's archived flag, so
 *      it un-archived archived contacts and re-fired their FUB action-plan
 *      emails.
 *
 * The cron entry was removed from vercel.json and the implementation gutted so
 * the route no-ops even if a stale schedule or manual call reaches it.
 *
 * To restore the feature, rebuild it with (a) an idempotency guard so a lead is
 * not re-touched on every run, (b) a real FUB archived/Do-Not-Contact status
 * check (not just stage-string matching), and (c) a sane cadence (weekly, per
 * the original `_weekly` insight type — not hourly).
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    disabled: true,
    reason:
      'fub-outreach-execution permanently disabled 2026-06-18: caused duplicate FUB notes and re-triggered emails to archived contacts. Cron removed from vercel.json.',
  })
}
