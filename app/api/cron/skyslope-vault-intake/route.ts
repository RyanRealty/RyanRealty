/**
 * /api/cron/skyslope-vault-intake — the daily SkySlope → Vault intake
 * (Matt 2026-09-24: "Until you cut over, the Vault pulls new files and cycles
 * from SkySlope every day — add only, never overwrite Vault work.").
 *
 * Runs at 06:50 UTC, half an hour after /api/cron/skyslope-mirror-refresh.
 * Reads every SkySlope folder (read-only Files API), adds the cycles,
 * documents, checklist items, assignments and contacts the Vault lacks, takes
 * SkySlope field changes only where the Vault still holds what the previous
 * import wrote, and records a tc_events row (actor 'skyslope-intake') for every
 * write. Rules: docs/TC_SYSTEM.md "SkySlope → Vault daily intake".
 *
 * A run stops cleanly at its deadline; what it did not reach (downloads of a
 * big folder, properties late in the order) waits for the next run, and the
 * next run redoes nothing already written. TC_SKYSLOPE_INTAKE_ENABLED=false is
 * the cutover switch: the route answers "skipped" and touches nothing.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}. Lease: 'skyslope-vault-intake'.
 */
import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import {
  releaseSkySlopeIntakeLease,
  runSkySlopeVaultIntake,
  tryTakeSkySlopeIntakeLease,
  writeSkySlopeIntakeRunLog,
} from '@/lib/data/tc/skyslope-intake'
import { skySlopeIntakeEnabled } from '@/lib/tc/skyslope-intake'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Leave a minute of the 300s for the last download, the run log and the lease release. */
const BUDGET_MS = 240_000

export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied
  if (!skySlopeIntakeEnabled()) {
    return NextResponse.json({ ok: true, skipped: 'TC_SKYSLOPE_INTAKE_ENABLED is off: the Vault has cut over from SkySlope.' })
  }
  const start = Date.now()
  if (!(await tryTakeSkySlopeIntakeLease(300))) {
    return NextResponse.json({ ok: true, skipped: 'previous run still in progress' })
  }
  try {
    const res = await runSkySlopeVaultIntake({ apply: true, deadline: start + BUDGET_MS })
    const t = res.totals
    await writeSkySlopeIntakeRunLog({
      ok: res.ok,
      durationMs: Date.now() - start,
      records: t.cyclesAdded + t.cyclesUpdated + t.documentsAdded + t.itemsAdded + t.itemStatusesUpdated + t.assignmentsAdded + t.contactsAdded + t.stagesUpdated,
      error: res.error ?? res.blocker,
      cycleId: randomUUID(),
    })
    const status = res.ok ? 200 : res.blocker ? 503 : 500
    return NextResponse.json(
      {
        ok: res.ok,
        error: res.error,
        blocker: res.blocker,
        complete: res.complete,
        folders: res.folders,
        properties: `${res.propertiesVisited}/${res.propertiesTotal}`,
        totals: t,
        changed: res.properties.map((p) => ({
          address: p.address,
          deal: p.deal,
          cycles: p.cycles.map((c) => c.line),
          stages: p.stages,
          errors: p.errors,
          documentFailures: p.documentFailures,
        })),
        ms: Date.now() - start,
      },
      { status },
    )
  } finally {
    await releaseSkySlopeIntakeLease()
  }
}
