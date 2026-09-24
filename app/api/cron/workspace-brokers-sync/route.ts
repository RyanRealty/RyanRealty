/**
 * /api/cron/workspace-brokers-sync — brokers follow Google Workspace, hourly
 * (Matt 2026-09-24: "as we add a new broker into Google ... automatically pick
 * them up, automatically file them, automatically create a login for them").
 *
 * A new person in the Workspace becomes a broker with a broker login; their
 * mailbox joins the Gmail sync and the Vault mail sweep; someone suspended,
 * archived or deleted loses the login. Shared inboxes are skipped, and an
 * address removed on the team page is never re-added. Matt gets a text for
 * every change. lib/data/brokers/workspace-sync.ts holds the logic.
 *
 * ?dry=1 plans and returns without writing.
 */
import { NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { runWorkspaceBrokerSync } from '@/lib/data/brokers/workspace-sync'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied
  const dryRun = new URL(request.url).searchParams.get('dry') === '1'
  const result = await runWorkspaceBrokerSync({ dryRun })
  return NextResponse.json(result, { status: result.ok ? 200 : 503 })
}
