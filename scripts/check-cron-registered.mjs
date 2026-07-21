#!/usr/bin/env node
/**
 * check-cron-registered.mjs — G53: every cron route must be reachable.
 *
 * The 2026-07-21 platform audit found 23 of 72 app/api/cron/* routes
 * absent from vercel.json — entire pipelines shipped dark and nobody
 * noticed (optimization-loop was a complete prior loop attempt that
 * never ran once). A cron route that runs nowhere is dead code wearing
 * a schedule's clothes. This gate makes the class impossible to grow.
 *
 * A cron route dir is compliant when ONE of these holds:
 *   1. Its path is registered in vercel.json "crons".
 *   2. Its route file carries a trigger marker comment:
 *        // cron: invoked-by <caller>   (fanned out by another route)
 *        // cron: manual-only <reason>  (operator/backfill tool by design)
 *   3. It sits in scripts/cron-registered-baseline.json — the pre-gate
 *      backlog, which may ONLY SHRINK. New violators fail the build.
 *
 * CLI: default pass/fail · --report (human, exit 0) · --write-baseline
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const CRON_DIR = 'app/api/cron'
const VERCEL_JSON = 'vercel.json'
const BASELINE = 'scripts/cron-registered-baseline.json'
const MARKER_RE = /cron:\s*(invoked-by|manual-only)/

const args = new Set(process.argv.slice(2))
const writeBaseline = args.has('--write-baseline')
const report = args.has('--report')

function cronDirs() {
  return readdirSync(CRON_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) =>
      existsSync(join(CRON_DIR, name, 'route.ts')) || existsSync(join(CRON_DIR, name, 'route.tsx'))
    )
    .sort()
}

function registeredPaths() {
  const cfg = JSON.parse(readFileSync(VERCEL_JSON, 'utf8'))
  const set = new Set()
  for (const c of cfg.crons ?? []) {
    const m = String(c.path ?? '').match(/^\/api\/cron\/([^/?]+)/)
    if (m) set.add(m[1])
  }
  return set
}

function hasMarker(name) {
  for (const file of ['route.ts', 'route.tsx']) {
    const p = join(CRON_DIR, name, file)
    if (!existsSync(p)) continue
    if (MARKER_RE.test(readFileSync(p, 'utf8'))) return true
  }
  return false
}

const dirs = cronDirs()
const registered = registeredPaths()
const violators = dirs.filter((d) => !registered.has(d) && !hasMarker(d))

if (writeBaseline) {
  writeFileSync(
    BASELINE,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        reason:
          'Pre-gate backlog of cron routes that are neither registered in vercel.json nor marked ' +
          '(cron: invoked-by / cron: manual-only). This list may only shrink: register the cron, ' +
          'mark its real trigger, or delete the route. New unregistered crons fail the build.',
        count: violators.length,
        names: violators,
      },
      null,
      2
    ) + '\n'
  )
  console.log(`cron-registered baseline written: ${violators.length} backlog routes`)
  process.exit(0)
}

let baseline = { names: [] }
try {
  baseline = JSON.parse(readFileSync(BASELINE, 'utf8'))
} catch {
  console.error(`cron-registered gate FAILED — missing ${BASELINE}. Run: npm run ci:cron-registered:baseline`)
  process.exit(1)
}

const baseSet = new Set(baseline.names ?? [])
const newViolators = violators.filter((v) => !baseSet.has(v))
const cleared = (baseline.names ?? []).filter((n) => !violators.includes(n))

if (newViolators.length > 0) {
  console.error(
    `cron-registered gate FAILED — ${newViolators.length} cron route(s) run nowhere: ${newViolators.join(', ')}\n` +
      'Every app/api/cron/* route must be registered in vercel.json, or carry a trigger marker\n' +
      '(// cron: invoked-by <caller>  or  // cron: manual-only <reason>). A cron that runs nowhere\n' +
      'is dead code — register it, mark it, or delete it.'
  )
  process.exit(report ? 0 : 1)
}

if (cleared.length > 0) {
  console.log(
    `cron-registered: ${cleared.length} baseline route(s) cleared (${cleared.join(', ')}) — ` +
      `shrink the baseline with npm run ci:cron-registered:baseline`
  )
}
console.log(
  `cron-registered gate passed — ${dirs.length} cron routes: ${registered.size} registered, ` +
    `${dirs.filter((d) => !registered.has(d) && hasMarker(d)).length} marked, ${violators.length} in backlog (ratchet: shrink-only).`
)
