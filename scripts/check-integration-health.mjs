#!/usr/bin/env node
/**
 * G13 lock: INT-021…036 unknown-health cells stay probed.
 * Health counts table must show unknown = 0.
 *
 *   node scripts/check-integration-health.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const dal = src('lib/data/loop/integration-health.ts')
checks.push({
  label: 'health DAL exports completeness + the eight G13 ids',
  ok:
    /export function integrationHealthComplete/.test(dal) &&
    /export function readIntegrationHealth/.test(dal) &&
    /INT-021/.test(dal) &&
    /INT-023/.test(dal) &&
    /INT-026/.test(dal) &&
    /INT-029/.test(dal) &&
    /INT-031/.test(dal) &&
    /INT-032/.test(dal) &&
    /INT-033/.test(dal) &&
    /INT-036/.test(dal),
})

const signals = src('lib/data/loop/signals.ts')
checks.push({
  label: 'scoreboard reads the integration-health DAL',
  ok: /readIntegrationHealth/.test(signals) && /integrations:/.test(signals),
})

const packet = src('docs/plans/COMPANY_SCOREBOARD.md')
checks.push({
  label: 'packet cites the integration-health probes file',
  ok: /integration-health-probes\.json/.test(packet),
})
checks.push({
  label: 'packet writes unknown = 0 for integration health',
  ok: /Integration health[\s\S]{0,80}unknown = 0/i.test(packet) && !/Integration health[^\n]*\*\*UNKNOWN\*\*/.test(packet),
})

const loop = src('app/admin/(protected)/loop/page.tsx')
checks.push({
  label: 'admin loop surfaces integration health',
  ok: /readIntegrationHealth/.test(loop) && /Integration health/.test(loop),
})

const probes = src('docs/plans/ENTERPRISE_MAP/integration-health-probes.json')
let parsed
try {
  parsed = JSON.parse(probes)
} catch {
  parsed = null
}
checks.push({
  label: 'probes JSON parses with unknown=0 and 8 rows',
  ok:
    parsed?.status === 'ok' &&
    parsed?.unknownCount === 0 &&
    parsed?.probedCount === 8 &&
    parsed?.greenCount === 5 &&
    parsed?.parkCount === 3 &&
    Array.isArray(parsed?.rows) &&
    parsed.rows.length === 8 &&
    parsed.rows.every((r) => r.health !== 'unknown' && String(r.evidence ?? '').trim()),
})

const matrix = src('docs/plans/ENTERPRISE_MAP/matrix/INTEGRATIONS.md')
const unknownRow = matrix.match(/\|\s*\*\*unknown\*\*\s*\|\s*\*\*(\d+)\*\*/)
checks.push({
  label: 'INTEGRATIONS health counts table shows unknown = 0',
  ok: unknownRow?.[1] === '0',
})
checks.push({
  label: 'INTEGRATIONS no longer lists the eight as unknown',
  ok:
    !/\|\s*\*\*unknown\*\*\s*\|\s*\*\*[1-9]/.test(matrix) &&
    /INT-021/.test(matrix) &&
    /INT-036/.test(matrix),
})

const manifest = src('docs/plans/ENTERPRISE_MAP/VERSION-1.md')
checks.push({
  label: 'VERSION-1 G13 is DONE with a date',
  ok: /G13/.test(manifest) && /DONE 2026-08-16/.test(manifest) && /unknown = 0|unknown=0/.test(manifest),
})

const log = src('docs/plans/ENTERPRISE_MAP/matrix/EVIDENCE-LOG.md')
checks.push({
  label: 'EVIDENCE-LOG has a per-row G13 probe section',
  ok:
    /INT-021/.test(log) &&
    /INT-023/.test(log) &&
    /INT-026/.test(log) &&
    /INT-029/.test(log) &&
    /INT-031/.test(log) &&
    /INT-032/.test(log) &&
    /INT-033/.test(log) &&
    /INT-036/.test(log) &&
    /2026-08-16/.test(log),
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
