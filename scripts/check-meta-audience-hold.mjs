#!/usr/bin/env node
/**
 * G11 lock: INT-007 Meta audience hold is a named DAL, not a memory of ran_at.
 * Daily heartbeat is 36h (crons are daily). Packet + admin + health-check
 * read computeAudienceHold. KEEP stays off until 7 consecutive UTC days
 * end on or after 2026-08-22.
 *
 *   node scripts/check-meta-audience-hold.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const hold = src('lib/data/loop/meta-audience-hold.ts')
checks.push({
  label: 'hold DAL exports compute + read + 7-day / 2026-08-22 accept',
  ok:
    /export function computeAudienceHold/.test(hold) &&
    /export async function readMetaAudienceHold/.test(hold) &&
    /META_AUDIENCE_HOLD_END = '2026-08-22'/.test(hold) &&
    /META_AUDIENCE_HOLD_DAYS = 7/.test(hold) &&
    /META_AUDIENCE_CURRENT_HOURS = 36/.test(hold),
})

const heartbeat = src('lib/pipeline-heartbeat.ts')
checks.push({
  label: 'westside freshness is 36h (daily cron), not an 8-day weekly hide',
  ok:
    /audienceSyncHours: 36/.test(heartbeat) &&
    !/audienceSyncDays: 8/.test(heartbeat) &&
    /export function evalMetaAudienceHold/.test(heartbeat),
})

const health = src('app/api/cron/loop-health-check/route.ts')
checks.push({
  label: 'loop-health-check grades the hold from the DAL',
  ok: /readMetaAudienceHold/.test(health) && /evalMetaAudienceHold/.test(health),
})

const signals = src('lib/data/loop/signals.ts')
checks.push({
  label: 'scoreboard reads the hold DAL (not limit-1 ran_at alone)',
  ok: /readMetaAudienceHold/.test(signals) && /audienceHold/.test(signals),
})

const audiences = src('app/admin/(protected)/audiences/page.tsx')
checks.push({
  label: 'audiences board surfaces the Meta hold',
  ok: /readMetaAudienceHold/.test(audiences) && /Meta audience/.test(audiences),
})

const metaHealth = src('app/admin/(protected)/analytics/meta-health/page.tsx')
checks.push({
  label: 'meta-health board surfaces the hold',
  ok: /readMetaAudienceHold/.test(metaHealth),
})

const integrations = src('docs/plans/ENTERPRISE_MAP/matrix/INTEGRATIONS.md')
checks.push({
  label: 'INT-007 live signal is not the June 23 stale cell',
  ok: !/last LIVE \*\*2026-06-23\*\*/.test(integrations) && /INT-007/.test(integrations),
})

const packet = src('docs/plans/COMPANY_SCOREBOARD.md')
checks.push({
  label: 'packet cites consecutive-day hold, not only first-green prose',
  ok: /consecutive/i.test(packet) && /readMetaAudienceHold|meta-audience-hold/.test(packet),
})

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\n${failed.length}/${checks.length} failed`)
  process.exit(1)
}
console.log(`\n${checks.length}/${checks.length} passed`)
