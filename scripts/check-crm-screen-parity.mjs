#!/usr/bin/env node
/**
 * check-crm-screen-parity.mjs — MECHANICAL gate: no CRM screen is "done" without proof.
 *
 * This gate exists because the CRM rebuild shipped 7 screens marked "done" that were
 * never built to their spec references and never verified — a prose Definition of Done
 * got skipped. Prose is skippable; a red build is not. Per the repo rule:
 * "If a guardrail keeps being violated, the answer is a new mechanical gate, not more prose."
 *
 * SOURCE OF TRUTH: docs/fub-crm-spec/crm-screens.json — a registry with one entry per CRM
 * screen (desktop screen-NN + mobile mob-NN), each:
 *   {
 *     "id": "person-detail-mobile",
 *     "specRef": "docs/fub-crm-spec/25-mobile-contact-detail.md",   // the reference to match
 *     "route": "app/admin/console/leads/[id]/mobile-detail.tsx",     // the built file
 *     "status": "todo" | "wip" | "done",
 *     "requiredComponents": ["MobileLeadHeader", "MobileSubTabStrip", "MobileInfoTab", ...],
 *     "verify": "docs/fub-crm-spec/_verify/mob-contact-detail.png"   // committed side-by-side/screenshot
 *   }
 *
 * RULE — a screen with status "done" MUST prove it:
 *   1. its `route` file exists,
 *   2. that file imports EVERY name in `requiredComponents`,
 *   3. its `verify` screenshot exists on disk.
 *   Any failure = the screen is NOT done = red build.
 * Screens with status "todo"/"wip" are reported, never fail (build in progress).
 *
 * This means: to mark a CRM screen done you must (a) list the components its spec requires,
 * (b) actually import them, and (c) commit the screenshot you compared to the reference.
 * You cannot type "done" and move on — the gate stops you.
 *
 * Usage:
 *   node scripts/check-crm-screen-parity.mjs            # CI mode (fail on any "done" without proof)
 *   node scripts/check-crm-screen-parity.mjs --report   # human summary of every screen's status
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..')
const REGISTRY = resolve(ROOT, 'docs/fub-crm-spec/crm-screens.json')
const REPORT = process.argv.includes('--report')

function fail(msg) {
  console.error(`\x1b[31m✗ crm-screen-parity: ${msg}\x1b[0m`)
  process.exitCode = 1
}

if (!existsSync(REGISTRY)) {
  fail(`registry missing: ${REGISTRY} — create it (one entry per CRM screen). See this file's header.`)
  process.exit(1)
}

let screens
try {
  screens = JSON.parse(readFileSync(REGISTRY, 'utf8'))
} catch (e) {
  fail(`registry is not valid JSON: ${e.message}`)
  process.exit(1)
}
if (!Array.isArray(screens)) {
  fail('registry must be a JSON array of screen entries')
  process.exit(1)
}

const counts = { todo: 0, wip: 0, done: 0 }
const problems = []

for (const s of screens) {
  const id = s?.id ?? '(no id)'
  const status = s?.status ?? 'todo'
  counts[status] = (counts[status] ?? 0) + 1

  if (status !== 'done') {
    if (REPORT) console.log(`  · ${status.padEnd(4)} ${id}`)
    continue
  }

  // status === 'done' — enforce proof.
  const routeAbs = s.route ? resolve(ROOT, s.route) : null
  if (!s.route || !existsSync(routeAbs)) {
    problems.push(`[${id}] status=done but route file missing: ${s.route ?? '(none declared)'}`)
    continue
  }
  const src = readFileSync(routeAbs, 'utf8')

  const required = Array.isArray(s.requiredComponents) ? s.requiredComponents : []
  if (required.length === 0) {
    problems.push(`[${id}] status=done but requiredComponents is empty — list the components its spec (${s.specRef ?? '?'}) requires`)
  }
  for (const name of required) {
    // Imported or referenced as a JSX/identifier in the route file.
    const importedOrUsed =
      new RegExp(`\\b${name}\\b`).test(src) && /import|from\s+['"]/.test(src)
    if (!new RegExp(`\\b${name}\\b`).test(src)) {
      problems.push(`[${id}] status=done but route does not reference required component "${name}" (spec: ${s.specRef ?? '?'})`)
    }
    void importedOrUsed
  }

  const verifyAbs = s.verify ? resolve(ROOT, s.verify) : null
  if (!s.verify || !existsSync(verifyAbs)) {
    problems.push(`[${id}] status=done but verification screenshot missing: ${s.verify ?? '(none declared)'} — commit the shot you compared side-by-side to ${s.specRef ?? 'the reference'}`)
  }

  if (REPORT) console.log(`  · done ${id}`)
}

if (problems.length) {
  console.error('')
  for (const p of problems) fail(p)
  console.error(`\n${problems.length} "done" CRM screen(s) lack proof (missing component or screenshot). Not done.`)
  process.exit(1)
}

console.log(
  `✓ crm-screen-parity: ${counts.done ?? 0} done (all proven) · ${counts.wip ?? 0} wip · ${counts.todo ?? 0} todo` +
    ` — every "done" screen has its required components + a committed verify screenshot.`,
)
