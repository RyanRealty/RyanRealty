/**
 * Gmail bounce watch — scan each sending broker mailbox for DSN / undeliverable
 * notices from the last 72h, match them to `sent` email_events, write `bounced`
 * + an `email_bounce` timeline row, suppress on hard bounce, and infer
 * `delivered` (meta.inferred=true) when 24h passed with no bounce or any
 * open/click already landed.
 *
 * Gmail DWD is the CMA send rail; Resend receipts still win when present.
 */

import { NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { runGmailBounceWatch } from '@/lib/crm/gmail-bounce-watch'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied
  const startMs = Date.now()
  try {
    const result = await runGmailBounceWatch()
    return NextResponse.json(
      { ...result, duration_ms: Date.now() - startMs },
      { status: result.ok ? 200 : 500 },
    )
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e), duration_ms: Date.now() - startMs },
      { status: 500 },
    )
  }
}
