/**
 * Postmaster sync cron (spec §6.7). Pulls Gmail Postmaster Tools daily traffic
 * stats for the three sending identities (ryan-realty.com, mail.ryan-realty.com,
 * news.ryan-realty.com) and upserts them into deliverability_metrics, unique on
 * (domain, metric_date). The newsletter pre-send guard (G-NL-20) reads the
 * latest news.ryan-realty.com row via lib/data/deliverability and blocks a
 * large bulk send on LOW/BAD reputation or spam_ratio > 0.30%.
 *
 * Schedule: daily at 12:30 UTC — registered in vercel.json.
 *
 * Degrades gracefully: if the service-account creds or the postmaster.readonly
 * DWD grant are missing, the route logs the exact one-time setup steps
 * (POSTMASTER_SETUP_HINT) and returns 200 with skipped=true — never a throw,
 * never a 500 retry storm. Per-domain API failures (e.g. a domain dropped from
 * Postmaster registration) are reported per-domain and do not abort the rest.
 * Empty stats are normal early on: Gmail publishes with a 2-3 day lag and only
 * once meaningful volume flows (~hundreds/day to Gmail inboxes).
 *
 * Manual invocation:
 *   GET /api/cron/postmaster-sync?days=30   (backfill window, default 7, max 60)
 *
 * Auth: Authorization: Bearer $CRON_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { createServiceClient } from '@/lib/supabase/service'
import {
  POSTMASTER_DOMAINS,
  POSTMASTER_SETUP_HINT,
  getPostmasterAuth,
  getPostmasterStats,
} from '@/lib/newsletter/postmaster'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type DomainReport = {
  domain: string
  status: 'ok' | 'empty' | 'failed'
  rows: number
  error?: string
}

export async function GET(request: NextRequest) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const url = new URL(request.url)
  const daysParam = url.searchParams.get('days')
  const days = daysParam ? Math.max(1, Math.min(60, parseInt(daysParam, 10) || 7)) : 7

  const auth = await getPostmasterAuth()
  if (!auth.ok || !auth.client) {
    // Setup incomplete is informational, not an error — 200 so cron retries
    // do not pile up. The log names the exact one-time step for ops.
    console.warn(`postmaster-sync: skipped — ${auth.error}. ${auth.hint ?? POSTMASTER_SETUP_HINT}`)
    return NextResponse.json({
      ok: false,
      skipped: true,
      reason: auth.error,
      setup: auth.hint ?? POSTMASTER_SETUP_HINT,
    })
  }

  const sb = createServiceClient()
  const reports: DomainReport[] = []

  for (const domain of POSTMASTER_DOMAINS) {
    try {
      const rows = await getPostmasterStats(auth.client, domain, days)
      if (rows.length === 0) {
        reports.push({ domain, status: 'empty', rows: 0 })
        continue
      }
      const { error } = await sb
        .from('deliverability_metrics')
        .upsert(
          rows.map((r) => ({ ...r, fetched_at: new Date().toISOString() })),
          { onConflict: 'domain,metric_date' },
        )
      if (error) throw new Error(`upsert failed: ${error.message}`)
      reports.push({ domain, status: 'ok', rows: rows.length })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const isPermission = /permission|403|not.*registered|forbidden/i.test(msg)
      console.error(
        `postmaster-sync: ${domain} failed — ${msg}${isPermission ? `. ${POSTMASTER_SETUP_HINT}` : ''}`,
      )
      reports.push({ domain, status: 'failed', rows: 0, error: msg })
    }
  }

  const upserted = reports.reduce((a, r) => a + r.rows, 0)
  const anyFailed = reports.some((r) => r.status === 'failed')
  // 200 even on partial failure — per-domain detail is in the body; a 500
  // would only trigger Vercel retries against the same broken grant.
  return NextResponse.json({ ok: !anyFailed, days, upserted, reports })
}
