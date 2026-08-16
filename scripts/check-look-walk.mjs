#!/usr/bin/env node
/**
 * G9 lock: packet §1b CMA look and public-ux walk cannot go UNKNOWN.
 * A complete look-walk baseline (390+1280 beat_on routes + graded CMA)
 * is the SoR the scoreboard reads.
 *
 *   node scripts/check-look-walk.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const reader = src('lib/data/loop/look-walk.ts')
checks.push({
  label: 'look-walk reader exports completeness + required beat_on routes',
  ok:
    /export function lookWalkBaselineComplete/.test(reader) &&
    /export function readLookWalkBaseline/.test(reader) &&
    reader.includes("'/homes-for-sale'") &&
    reader.includes("'/cities/bend'") &&
    reader.includes("'/communities/tetherow'") &&
    reader.includes("'/sell'") &&
    reader.includes("'/housing-market'") &&
    reader.includes("'/about'"),
})

const signals = src('lib/data/loop/signals.ts')
checks.push({
  label: 'scoreboard reads look-walk baseline (not cmas count alone)',
  ok:
    /readLookWalkBaseline/.test(signals) &&
    /lookWalk:/.test(signals) &&
    /lookVerdict/.test(signals) &&
    /cmaLookOk/.test(signals),
})

const packet = src('docs/plans/COMPANY_SCOREBOARD.md')
checks.push({
  label: 'packet §1b no longer writes CMA look UNKNOWN',
  ok: !/Look\/feel is UNKNOWN/.test(packet) && !/CMA look UNKNOWN/i.test(packet),
})
checks.push({
  label: 'packet §1b no longer writes public-ux walk UNKNOWN',
  ok: !/public-ux walk.*UNKNOWN/i.test(packet) && !/Look still a grind/.test(packet),
})
checks.push({
  label: 'packet cites the look-walk baseline',
  ok: /look-walk-baseline\.json/.test(packet),
})

const baseline = src('docs/plans/ENTERPRISE_MAP/look-walk-baseline.json')
let parsed
try {
  parsed = JSON.parse(baseline)
} catch {
  parsed = null
}
checks.push({
  label: 'look-walk baseline JSON parses',
  ok: Boolean(parsed),
})
const routes = parsed?.public?.routes ?? []
const required = [
  '/',
  '/homes-for-sale',
  '/cities/bend',
  '/communities/tetherow',
  '/homes-for-sale/bend/tetherow/61281-mcroberts-220218727',
  '/sell',
  '/housing-market',
  '/about',
]
const have = new Set(routes.map((r) => r.route))
checks.push({
  label: 'baseline records every beat_on route at 390 and 1280 with HTTP 200',
  ok:
    Array.isArray(parsed?.viewports) &&
    parsed.viewports.includes('390') &&
    parsed.viewports.includes('1280') &&
    required.every((r) => have.has(r)) &&
    routes.every((r) => r.http390 === 200 && r.http1280 === 200 && String(r.jobNoun || '').trim()),
})
checks.push({
  label: 'baseline grades a rendered CMA (slug + verdict + page count)',
  ok:
    parsed?.cma?.status === 'ok' &&
    Boolean(parsed?.cma?.slug) &&
    Boolean(parsed?.cma?.verdict) &&
    Number(parsed?.cma?.pageCount) > 0,
})

const universe = src('docs/plans/PUBLIC_PRODUCT/grade-universe.json')
checks.push({
  label: 'beat_on set matches grade-universe.json',
  ok: required.every((r) => universe.includes(`"${r}"`)),
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
