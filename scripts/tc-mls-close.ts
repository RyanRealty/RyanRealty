/**
 * The MLS close rule, by hand. The daily run is /api/cron/tc-mls-close (and
 * the SkySlope intake on the deals it touches); this is the same pass with a
 * plan mode. Rules: lib/tc/mls-close.ts (decisions) · lib/data/tc/mls-close.ts
 * (I/O) · docs/TC_SYSTEM.md "A sale the MLS shows closed".
 *
 *   npx tsx scripts/tc-mls-close.ts plan [--deal <uuid>] [--json]
 *       DRY RUN. Every deal holding a sale cycle with an MLS number and no close
 *       date: which cycles the MLS shows closed (with the MLS facts), the stage
 *       the deal would take, and every sale cycle left alone with why. Writes
 *       nothing.
 *
 *   npx tsx scripts/tc-mls-close.ts apply [--deal <uuid>] [--json]
 *       Same pass, written: tc_cycle_repair_log first (the whole row before),
 *       then the deal stage, then the cycle, then tc_events (actor 'mls-close').
 */
import 'dotenv/config'
import path from 'node:path'
import Module from 'node:module'

const STUB = path.resolve(__dirname, '../test/server-only-stub.ts')
const CACHE_STUB = path.resolve(__dirname, '../test/next-cache-cli-stub.ts')
const resolveFilename = (Module as unknown as { _resolveFilename: (r: string, ...a: unknown[]) => string })._resolveFilename
;(Module as unknown as { _resolveFilename: unknown })._resolveFilename = function (this: unknown, request: string, ...args: unknown[]) {
  const req = request === 'server-only' || request === 'client-only' ? STUB : request === 'next/cache' ? CACHE_STUB : request
  return resolveFilename.call(this, req, ...args)
}

function arg(name: string): string | null {
  const i = process.argv.indexOf(name)
  return i > 0 ? (process.argv[i + 1] ?? null) : null
}

async function main() {
  const mode = process.argv[2]
  if (mode !== 'plan' && mode !== 'apply') {
    console.error('usage: npx tsx scripts/tc-mls-close.ts plan|apply [--deal <uuid>] [--json]')
    process.exit(2)
  }
  const deal = arg('--deal')
  const { runMlsCloseSweep } = await import('@/lib/data/tc/mls-close')
  const { MLS_CLOSE_VERSION, MLS_CLOSE_WINDOW_DAYS } = await import('@/lib/tc/mls-close')
  const res = await runMlsCloseSweep({ apply: mode === 'apply', dealIds: deal ? [deal] : null })
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(res, null, 2))
    process.exit(res.ok ? 0 : 1)
  }
  console.log(`MLS close rule ${MLS_CLOSE_VERSION} · window ±${MLS_CLOSE_WINDOW_DAYS} days · ${mode === 'plan' ? 'PLAN (dry run, writes nothing)' : 'APPLY'}`)
  if (!res.ok) {
    console.error(`FAILED: ${res.error}`)
    process.exit(1)
  }
  console.log(`deals checked: ${res.dealsChecked}\n`)
  for (const d of res.deals) {
    console.log(`▸ ${d.address ?? '(no address)'}  deal ${d.dealId}`)
    for (const c of d.closes) {
      const e = c.evidence
      console.log(
        `  CLOSE cycle ${c.cycleId}: ${JSON.stringify(c.set)} · MLS ${e.list_number} ${e.mls_status} ${e.mls_close_date} $${e.mls_close_price ?? '?'} · escrow date ${e.escrow_closing_date} (${e.days_from_escrow_date >= 0 ? '+' : ''}${e.days_from_escrow_date}d) · list ${e.mls_list_office ?? '?'} / buyer ${e.mls_buyer_office ?? '?'}`,
      )
      if (c.applied) console.log(`    ${c.applied.outcome}: ${JSON.stringify(c.applied.from)} → ${JSON.stringify(c.applied.to)} · repair log ${c.applied.repairLogId ?? '-'}${c.applied.note ? ` · ${c.applied.note}` : ''}`)
    }
    if (d.stage?.kind === 'update') console.log(`  STAGE ${d.stage.from.stage} / ${d.stage.from.stageDetail} → ${d.stage.to.stage} / ${d.stage.to.stageDetail}${mode === 'apply' ? (d.stageWritten ? ' (written)' : ' (NOT written)') : ''}`)
    else if (d.stage?.kind === 'hold') console.log(`  stage held: the cycles derive ${d.stage.derived?.stage ?? '?'} (something newer is open on the property)`)
    else if (d.stage?.kind === 'same') console.log(`  stage already ${d.stage.stage.stage} / ${d.stage.stage.stageDetail}`)
    for (const s of d.skips) console.log(`  leave cycle ${s.cycleId}: ${s.reason}${s.detail ? ` (${s.detail})` : ''}`)
    for (const e of d.errors) console.log(`  ERROR ${e}`)
  }
  const t = res.totals
  console.log(`\nto close ${t.closes} · closed ${t.closed} · failed ${t.failed} · stages updated ${t.stagesUpdated} · repair log rows ${t.logged} · events ${t.events} · ${res.ms}ms`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
