/**
 * /api/cron/meta-westside-audience -- weekly "RR Westside Bend Homeowners"
 * Meta Custom Audience refresh (audience id 120244510092910698).
 * DRY-RUN by default.
 *
 * Before this route existed the audience only refreshed when an operator ran
 * scripts/meta-refresh-westside-audience.mjs by hand -- the last push was
 * whatever the last manual run was. This cron shares ONE implementation with
 * that CLI (lib/meta-westside-audience.ts):
 *
 *   1. loadWestsideInputs -- westside_parcels + linked crm_people + their
 *      channel='all' crm_suppressions (TCPA hard-stop, litigator, DNC).
 *      Any read failure THROWS (fail closed) -- nothing reaches Meta.
 *   2. buildWestsidePayload (pure, unit-tested) -- exclusions (suppressed,
 *      realtor-tagged, missing owner name) + the 7-key hashed schema
 *      (EMAIL PHONE FN LN CT ST ZIP). Only SHA-256 hex leaves the server.
 *   3. refreshWestsideAudience -- DRY-RUN unless META_AUDIENCE_PUSH_ENABLED
 *      is 'true' (the same double-gate as /api/cron/meta-audience-sync: the
 *      route mirrors the flag into dryRun AND the lib re-checks it, so this
 *      cron can never live-push while the master switch is off).
 *   4. LEDGER: summarizeWestsideRun (pure) -> writeAudienceLedger, one row in
 *      meta_audience_log (audience_id set, so westside rows are queryable
 *      apart from the daily CRM sync's rows in the same table).
 *
 * This route never re-implements hashing and never reads META_* directly --
 * tokens + the push flag come from lib/meta-env.ts (ci:meta-token canon).
 *
 * Auth: Authorization: Bearer ${CRON_SECRET} (requireCronAuth).
 * Schedule: vercel.json -- weekly, Mondays 14:00 UTC.
 */

import { NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { isMetaAudiencePushEnabled } from '@/lib/meta-env'
import { refreshWestsideAudience, summarizeWestsideRun } from '@/lib/meta-westside-audience'
import { META_MIN_AUDIENCE_SIZE } from '@/lib/meta/audienceLedger'
import { writeAudienceLedger } from '@/lib/data/crm/writeAudienceLedger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const startMs = Date.now()
  // The master switch. When false, the refresh is forced dry regardless of
  // anything else (the lib re-checks the flag too -- this is the route-level
  // mirror so the intent is explicit at the call site).
  const live = isMetaAudiencePushEnabled()
  const dryRun = !live

  try {
    // Load -> exclude -> hash -> (dry-log | push). enforcePushFlag stays at its
    // default (true): only the manual CLI ever bypasses the env-flag gate.
    const result = await refreshWestsideAudience({ dryRun })

    // Ledger: pure summary -> persisted row (or console fallback).
    const summary = summarizeWestsideRun(result)

    // <1k-match monitor: a too-small audience is created but never served.
    // Non-fatal -- surfaced in logs + the response so shrinkage is visible.
    if (summary.belowMinimumMatch) {
      console.warn(
        `[meta-westside-audience] WARNING: matchable population ${summary.matchCount} is below ` +
          `Meta's ${META_MIN_AUDIENCE_SIZE} targetable floor -- audience will not be served.`,
      )
    }

    const ledger = await writeAudienceLedger(summary)
    const c = result.counts
    console.log(
      `[meta-westside-audience] ${result.dryRun ? 'DRY' : 'LIVE'} -- ${c.eligible} eligible of ` +
        `${c.totalParcels} parcels (${c.linkedParcels} linked; excluded ${c.excludedSuppressed} ` +
        `suppressed, ${c.excludedRealtors} realtor-tagged, ${c.skippedMissingName} missing-name; ` +
        `${c.withEmail} with email, ${c.withPhone} with phone).`,
    )

    return NextResponse.json({
      ok: true,
      ran_at: new Date().toISOString(),
      dry_run: result.dryRun,
      dry_run_reason: result.dryRunReason ?? null,
      audience_id: result.audienceId,
      audience_name: result.audienceName,
      counts: c,
      num_received: result.numReceived ?? null,
      num_invalid: result.numInvalid ?? null,
      below_minimum_match: summary.belowMinimumMatch,
      match_count: summary.matchCount,
      ledger,
      message: summary.message,
      errors: result.errors,
      duration_ms: Date.now() - startMs,
    })
  } catch (e) {
    // Fail closed made visible: any input-read failure threw BEFORE a Meta
    // call could happen. Return 500 so Vercel cron monitoring flags the run.
    const message = e instanceof Error ? e.message : String(e)
    console.error('[meta-westside-audience] FAILED (no Meta call made):', message)
    return NextResponse.json(
      { ok: false, error: message, duration_ms: Date.now() - startMs },
      { status: 500 },
    )
  }
}
