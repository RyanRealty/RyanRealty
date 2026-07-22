#!/usr/bin/env node
/**
 * scripts/meta-refresh-westside-audience.mjs -- manual CLI for the
 * "RR Westside Bend Homeowners" Meta Custom Audience refresh
 * (id 120244510092910698).
 *
 * THIN CALLER: the pipeline (load westside_parcels + linked crm_people +
 * suppressions -> exclusions -> 7-key hashing -> push) lives in
 * lib/meta-westside-audience.ts, shared with the weekly cron
 * (app/api/cron/meta-westside-audience) so the two can never drift. This
 * wrapper only:
 *   1. re-execs itself under `npx tsx` when plain Node cannot import the .ts
 *      lib (Node 20 has no TS loader; tsx is the repo-standard runner and
 *      resolves the lib's `@/` tsconfig paths), and
 *   2. calls runWestsideRefreshCli(argv), which preserves the historical CLI
 *      contract exactly: --dry-run for counts-only with zero Meta calls,
 *      otherwise a LIVE push gated on the Meta token alone
 *      (enforcePushFlag:false). The META_AUDIENCE_PUSH_ENABLED double-gate
 *      governs the cron, not this deliberate operator command.
 *
 * Usage:
 *   node scripts/meta-refresh-westside-audience.mjs --dry-run   # counts only
 *   node scripts/meta-refresh-westside-audience.mjs             # push live
 */

import { fileURLToPath } from 'node:url'

let runWestsideRefreshCli
try {
  ;({ runWestsideRefreshCli } = await import('../lib/meta-westside-audience.ts'))
} catch (err) {
  if (process.env.RR_WESTSIDE_TSX_REEXEC === '1') {
    // Already under tsx and the lib STILL failed to load -- a real error.
    console.error('[westside-audience-refresh] FAILED to load lib/meta-westside-audience.ts:', err)
    process.exit(1)
  }
  // Plain Node cannot import .ts -- re-exec this same script under tsx.
  const { spawnSync } = await import('node:child_process')
  const self = fileURLToPath(import.meta.url)
  const result = spawnSync('npx', ['tsx', self, ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: { ...process.env, RR_WESTSIDE_TSX_REEXEC: '1' },
  })
  process.exit(result.status ?? 1)
}

process.exit(await runWestsideRefreshCli(process.argv.slice(2)))
