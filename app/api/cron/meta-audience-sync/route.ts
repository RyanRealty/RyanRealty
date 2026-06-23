/**
 * /api/cron/meta-audience-sync -- daily Meta CRM Custom Audience sync
 * (CONTACT360 Phase 5.6). DRY-RUN by default.
 *
 * Each run:
 *   1. ADD leg: syncCrmAudience() (lib/meta/audienceUpload.ts) -- the committed
 *      consent-gated uploader. Computes the eligible (non-suppressed) hashed
 *      population and uploads it. DRY-RUN unless META_AUDIENCE_PUSH_ENABLED is
 *      'true' (the uploader enforces the double-gate internally).
 *   2. REMOVE leg: drain the pending removal queue (getPendingAudienceRemovals)
 *      and DELETE those people via removeFromCrmAudience (lib/meta/audienceRemove
 *      .ts). Same DRY-RUN double-gate. Queue rows are marked processed after a
 *      drain (idempotent -- a re-drain is a no-op remove).
 *   3. LEDGER: summarizeAudienceRun (pure) -> writeAudienceLedger, persisting one
 *      row to meta_audience_log (or a console fallback until that table lands).
 *
 * This route imports the COMMITTED uploader + the new remover + the committed
 * env getters -- it never re-implements hashing or reads META_* directly. It is
 * G1-exempt (the DAL-boundary gate skips app/api/**), but it still routes every
 * DB read/write through lib/data readers (the queue drain + ledger write).
 *
 * Auth: Authorization: Bearer ${CRON_SECRET} (isValidCronAuth).
 * Schedule: vercel.json -- daily.
 */

import { NextResponse } from 'next/server'
import { isValidCronAuth } from '@/lib/auth/cron-auth'
import { isMetaAudiencePushEnabled } from '@/lib/meta-env'
import { syncCrmAudience } from '@/lib/meta/audienceUpload'
import { removeFromCrmAudience } from '@/lib/meta/audienceRemove'
import { summarizeAudienceRun } from '@/lib/meta/audienceLedger'
import {
  getPendingAudienceRemovals,
  resolvePeopleForRemoval,
  markAudienceRemovalsProcessed,
} from '@/lib/data/crm/metaAudienceQueue'
import { writeAudienceLedger } from '@/lib/data/crm/writeAudienceLedger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(request: Request) {
  if (!isValidCronAuth(request.headers.get('authorization'), process.env.CRON_SECRET?.trim())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startMs = Date.now()
  // The master switch. When false, BOTH legs are forced dry regardless of any
  // dryRun argument (the uploader + remover each re-check the flag too -- this
  // is the route-level mirror so the intent is explicit at the call site).
  const live = isMetaAudiencePushEnabled()
  const dryRun = !live

  // 1. ADD leg -- the committed consent-gated uploader. dryRun:true unless live.
  const add = await syncCrmAudience({ dryRun })

  // 2. REMOVE leg -- drain the pending removal queue.
  const { queueIds, personIds } = await getPendingAudienceRemovals()
  const remove = await removeFromCrmAudience(personIds, {
    dryRun,
    resolvePeople: resolvePeopleForRemoval,
  })
  // Mark the drained rows processed (idempotent; a failed mark just re-drains).
  if (queueIds.length > 0) {
    await markAudienceRemovalsProcessed(queueIds)
  }

  // 3. LEDGER -- pure summary -> persisted row (or console fallback).
  const summary = summarizeAudienceRun(add, remove)
  const ledger = await writeAudienceLedger(summary)

  return NextResponse.json({
    ok: true,
    ran_at: new Date().toISOString(),
    dry_run: summary.dryRun,
    add: {
      dryRun: add.dryRun,
      dryRunReason: add.dryRunReason,
      wouldUpload: add.wouldUpload,
      excludedSuppressed: add.excludedSuppressed,
      skippedUnhashable: add.skippedUnhashable,
      numReceived: add.numReceived,
      numInvalid: add.numInvalid,
    },
    remove: {
      dryRun: remove.dryRun,
      dryRunReason: remove.dryRunReason,
      queueDrained: queueIds.length,
      requested: remove.requested,
      wouldRemove: remove.wouldRemove,
      numRemoved: remove.numRemoved,
    },
    ledger,
    message: summary.message,
    errors: summary.errors,
    duration_ms: Date.now() - startMs,
  })
}
