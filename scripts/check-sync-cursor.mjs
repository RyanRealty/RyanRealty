#!/usr/bin/env node
/**
 * check-sync-cursor.mjs (ci:sync-cursor) — guards the audit p0.1 fix.
 *
 * The MLS delta-sync cursor (`last_delta_sync_at`) must NOT be advanced blindly
 * to now() at the end of a run (that silently skips overflow pages and rows from
 * failed upserts). Every cursor write must go through computeNextDeltaCursor(),
 * which refuses to advance past a truncated window or a failed upsert.
 */
import { readFileSync } from 'node:fs'

const FILE = 'app/api/cron/sync-delta/route.ts'
const src = readFileSync(FILE, 'utf8')
const fails = []

// 1. The bug pattern: cursor advanced straight to a fresh timestamp.
if (/updateSyncStateLastDelta\(\s*new Date\(\)/.test(src)) {
  fails.push('updateSyncStateLastDelta(new Date()...) — cursor advanced unconditionally to now(); route the write through computeNextDeltaCursor()')
}
// 2. The safe-advance helper must be used.
if (!src.includes('computeNextDeltaCursor')) {
  fails.push('computeNextDeltaCursor() not used — every delta cursor write must go through the safe-advance helper (lib/sync/deltaCursor.ts)')
}

console.log('sync-delta cursor-safety gate (ci:sync-cursor)')
console.log('=============================================')
if (fails.length) {
  for (const f of fails) console.error('  ✗ ' + f)
  console.error('\nFAILED — see lib/sync/deltaCursor.ts and the p0.1 entry in docs/audit/REMEDIATION_PROGRESS.md.')
  process.exit(1)
}
console.log('OK — the delta cursor advances only via computeNextDeltaCursor().')
process.exit(0)
