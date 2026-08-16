#!/usr/bin/env node
/**
 * G12 lock: CAP-017 park-or-rebuild docket stays on the packet with both
 * options costed. Decision stays pending until Matt answers M3.
 *
 *   node scripts/check-video-docket.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const dal = src('lib/data/loop/video-docket.ts')
checks.push({
  label: 'docket DAL exports completeness + both-option cost fields',
  ok:
    /export function videoDocketComplete/.test(dal) &&
    /export function readVideoDecisionDocket/.test(dal) &&
    /incrementalVendorUsd/.test(dal) &&
    /elevenLabsTurboUsdPer1kChars/.test(dal) &&
    /producerCapPerRowUsd/.test(dal),
})

const signals = src('lib/data/loop/signals.ts')
checks.push({
  label: 'scoreboard reads the video docket DAL',
  ok: /readVideoDecisionDocket/.test(signals) && /video:/.test(signals),
})

const packet = src('docs/plans/COMPANY_SCOREBOARD.md')
checks.push({
  label: 'packet cites the video docket file',
  ok: /video-decision-docket\.json/.test(packet),
})
checks.push({
  label: 'packet costs both park and rebuild',
  ok: /park \$0|Park = \$0|incremental vendor \$0/i.test(packet) && /\$5\/row|\$0\.05/.test(packet),
})
checks.push({
  label: 'packet does not write video docket UNKNOWN',
  ok: !/video docket.*UNKNOWN/i.test(packet),
})

const loop = src('app/admin/(protected)/loop/page.tsx')
checks.push({
  label: 'admin loop surfaces the docket',
  ok: /readVideoDecisionDocket/.test(loop) && /Video docket/.test(loop),
})

const docket = src('docs/plans/ENTERPRISE_MAP/video-decision-docket.json')
let parsed
try {
  parsed = JSON.parse(docket)
} catch {
  parsed = null
}
checks.push({
  label: 'docket JSON parses with both options costed',
  ok:
    parsed?.status === 'ok' &&
    parsed?.park?.incrementalVendorUsd === 0 &&
    parsed?.rebuild?.elevenLabsTurboUsdPer1kChars === 0.05 &&
    parsed?.rebuild?.producerCapPerRowUsd === 5 &&
    parsed?.rebuild?.producerCapPerRunUsd === 15 &&
    parsed?.inventory?.deadSafeZoneImports === 11 &&
    parsed?.inventory?.decommissionedProducers === 24 &&
    Array.isArray(parsed?.park?.sources) &&
    parsed.park.sources.length >= 2 &&
    Array.isArray(parsed?.rebuild?.sources) &&
    parsed.rebuild.sources.length >= 2 &&
    parsed?.decision?.status === 'pending',
})

const manifest = src('docs/plans/ENTERPRISE_MAP/VERSION-1.md')
checks.push({
  label: 'VERSION-1 G12 names the docket and both costs',
  ok: /G12/.test(manifest) && /docket/i.test(manifest) && /\$0/.test(manifest) && /\$5\/row|\$0\.05/.test(manifest),
})

const caps = src('docs/plans/ENTERPRISE_MAP/matrix/CAPABILITIES.md')
checks.push({
  label: 'CAP-017 points at the docket, not a silent park',
  ok: /video-decision-docket\.json/.test(caps) || /G12 docket/.test(caps),
})

const req = src('docs/plans/ENTERPRISE_MAP/REQUIREMENTS.md')
checks.push({
  label: 'R-045 stays LOCKED (rebuild is a Matt register change)',
  ok: /R-045/.test(req) && /LOCKED/.test(req) && /REGISTRY/.test(req),
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
