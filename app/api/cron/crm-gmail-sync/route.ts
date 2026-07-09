/**
 * CRM Gmail sync — pulls all three broker mailboxes into the unified timeline
 * (blueprint §5.2). Runs every 15 min incrementally; also serves as the
 * backfill engine via ?pages=N (bigger page budget per invocation, driven in a
 * loop until each mailbox reports done).
 *
 * Full email content (subject + body) — the thing FUB's API never exposed.
 */

import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { CRM_MAILBOXES, loadEmailPersonMap, syncMailboxWindow } from '@/lib/crm/gmail'
import { syncGmailSignaturesIfStale } from '@/lib/crm/gmail-signature-sync'
import { cacheTag } from '@/lib/data/cache/unstable-cache'
import { createServiceClient } from '@/lib/supabase/service'

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

  // Overlap lease: a slow backfill (?pages=40) can exceed the 15-min interval;
  // skip an overlapping tick rather than rebuild the 18k-contact email map and
  // re-walk the same Gmail pages concurrently. Self-expires after 300s.
  const sb = createServiceClient()
  const { data: gotLease } = await sb.rpc('crm_try_cron_lease', { p_name: 'crm-gmail-sync', p_lease_seconds: 300 })
  if (gotLease === false) {
    return NextResponse.json({ ok: true, skipped: 'previous run still in progress' })
  }

  // Gmail signature sync (Matt directive 2026-07-09: CRM signatures must match
  // Gmail) — staleness-gated to ~every 6h; 3 cheap sendAs.list calls when it
  // runs. Failures never block the mailbox sync below.
  let signatureSync: Awaited<ReturnType<typeof syncGmailSignaturesIfStale>> | { ran: false; error: string }
  try {
    signatureSync = await syncGmailSignaturesIfStale(6)
    if (signatureSync.ran && signatureSync.results?.some((r) => r.ok)) {
      revalidateTag(cacheTag.brokers, 'max')
    }
  } catch (e) {
    signatureSync = { ran: false, error: e instanceof Error ? e.message : String(e) }
  }

  const emailMap = await loadEmailPersonMap()
  const results = []
  for (const mb of CRM_MAILBOXES) {
    if (only && mb.slug !== only) continue
    results.push(await syncMailboxWindow({ mailboxEmail: mb.email, brokerSlug: mb.slug, pageBudget, emailMap }))
  }
  const anyError = results.some((r) => r.error)
  await sb.rpc('crm_release_cron_lease', { p_name: 'crm-gmail-sync' })
  return NextResponse.json({
    ok: !anyError,
    results,
    signatureSync,
    duration_ms: Date.now() - startMs,
  }, { status: anyError ? 500 : 200 })
}
