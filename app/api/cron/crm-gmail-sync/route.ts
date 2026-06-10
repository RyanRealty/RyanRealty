/**
 * CRM Gmail sync — pulls all three broker mailboxes into the unified timeline
 * (blueprint §5.2). Runs every 15 min incrementally; also serves as the
 * backfill engine via ?pages=N (bigger page budget per invocation, driven in a
 * loop until each mailbox reports done).
 *
 * Full email content (subject + body) — the thing FUB's API never exposed.
 */

import { NextResponse } from 'next/server'
import { CRM_MAILBOXES, loadEmailPersonMap, syncMailboxWindow } from '@/lib/crm/gmail'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'
  if (!secret) return !isProd
  const auth = request.headers.get('authorization') ?? ''
  return auth === `Bearer ${secret}`
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const startMs = Date.now()
  const url = new URL(request.url)
  const pageBudget = Math.min(40, Math.max(1, Number(url.searchParams.get('pages') ?? '4')))
  const only = url.searchParams.get('mailbox') // broker slug filter for backfill loops

  const emailMap = await loadEmailPersonMap()
  const results = []
  for (const mb of CRM_MAILBOXES) {
    if (only && mb.slug !== only) continue
    results.push(await syncMailboxWindow({ mailboxEmail: mb.email, brokerSlug: mb.slug, pageBudget, emailMap }))
  }
  const anyError = results.some((r) => r.error)
  return NextResponse.json({
    ok: !anyError,
    results,
    duration_ms: Date.now() - startMs,
  }, { status: anyError ? 500 : 200 })
}
