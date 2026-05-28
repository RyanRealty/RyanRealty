#!/usr/bin/env node
/**
 * check-mockup-parity.mjs — CI gate for "Page rebuild must match the mockup."
 *
 * Per docs/EXECUTION_PLAN.md acceptance criterion §1 / Wave 3 §9:
 *   "Pixel diff between every page section and corresponding mockup in
 *    design_system/ryan-realty/ui_kits/<route>/index.html — human
 *    sign-off per section"
 *
 * The pixel diff is human-judgement. The MECHANICAL precondition is:
 * every route that has a mockup must import the components the mockup
 * declares are required. If the mockup specifies a price + CTA strip,
 * the page must import the corresponding component. Otherwise the
 * page is structurally non-compliant and ships incomplete.
 *
 * This gate exists because prose rules ("read the mockup before
 * rebuilding the page") were not enforced consistently. The brand-voice
 * ESLint rule works because it errors at lint time; this gate works the
 * same way at CI time.
 *
 * Contract (per mockup):
 *
 *   design_system/ryan-realty/ui_kits/<route-slug>/
 *     index.html       — the visual mockup
 *     parity.json      — REQUIRED machine-readable contract:
 *       {
 *         "route": "app/<route>/page.tsx",
 *         "requiredComponents": [
 *           { "name": "ListingHero",          "section": "ld-photo-grid hero" },
 *           { "name": "PriceCtaStrip",        "section": "price + CTA strip" },
 *           { "name": "NeighborhoodMarketContext", "section": "Live market context (THE Zillow beater)" },
 *           ...
 *         ]
 *       }
 *
 * Pass: every required component is imported in the route's page.tsx.
 * Fail: per-missing-component error with the section it represents.
 *
 * Usage:
 *   node scripts/check-mockup-parity.mjs                 # CI mode, fail on missing
 *   node scripts/check-mockup-parity.mjs --report        # human-readable summary
 *   node scripts/check-mockup-parity.mjs --json          # machine-readable JSON
 *
 * Add new gated route:
 *   1. Place the mockup at design_system/ryan-realty/ui_kits/<route>/index.html
 *   2. Create design_system/ryan-realty/ui_kits/<route>/parity.json with the
 *      required-components contract
 *   3. The gate picks it up automatically. Add the page imports to make CI green.
 */

import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from 'node:fs'
import { join, resolve, relative } from 'node:path'

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..')
const UI_KITS = join(ROOT, 'design_system/ryan-realty/ui_kits')
const BASELINE_PATH = join(ROOT, 'scripts/mockup-parity-baseline.json')

const args = new Set(process.argv.slice(2))
const REPORT = args.has('--report')
const JSON_OUT = args.has('--json')
const WRITE_BASELINE = args.has('--write-baseline')

function loadParityContracts() {
  if (!existsSync(UI_KITS)) {
    return []
  }
  const out = []
  for (const name of readdirSync(UI_KITS)) {
    const dir = join(UI_KITS, name)
    if (!statSync(dir).isDirectory()) continue
    const parityPath = join(dir, 'parity.json')
    if (!existsSync(parityPath)) continue
    const raw = JSON.parse(readFileSync(parityPath, 'utf8'))
    if (!raw.route || !Array.isArray(raw.requiredComponents)) {
      throw new Error(`Invalid parity.json at ${parityPath}: missing route or requiredComponents array`)
    }
    out.push({
      mockupDir: name,
      mockupPath: join(dir, 'index.html'),
      parityPath,
      route: raw.route,
      requiredComponents: raw.requiredComponents,
      mockupExists: existsSync(join(dir, 'index.html')),
    })
  }
  return out
}

function checkPage(contract) {
  const pagePath = join(ROOT, contract.route)
  if (!existsSync(pagePath)) {
    return {
      ok: false,
      missing: contract.requiredComponents.map((c) => c.name),
      reason: `Route file does not exist at ${contract.route}`,
    }
  }
  const src = readFileSync(pagePath, 'utf8')
  const missing = []
  for (const comp of contract.requiredComponents) {
    // Match either:  import { ComponentName }   or  import ComponentName
    const pattern = new RegExp(
      `import\\s+(?:\\{[^}]*\\b${escapeRegex(comp.name)}\\b[^}]*\\}|${escapeRegex(comp.name)}(?:\\s*,|\\s+from))`,
    )
    if (!pattern.test(src)) {
      missing.push(comp)
    }
  }
  return { ok: missing.length === 0, missing }
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return new Map()
  const raw = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  const m = new Map()
  for (const entry of raw.routes ?? []) {
    m.set(entry.route, new Set(entry.knownMissing ?? []))
  }
  return m
}

function newMissing(routeRel, missing, baseline) {
  const allowed = baseline.get(routeRel) ?? new Set()
  return missing.filter((m) => {
    const name = typeof m === 'string' ? m : m.name
    return !allowed.has(name)
  })
}

function main() {
  const contracts = loadParityContracts()
  const results = contracts.map((c) => ({ ...c, ...checkPage(c) }))
  const baseline = loadBaseline()

  // Compute per-route NEW missing (beyond baseline)
  for (const r of results) {
    r.newMissing = r.ok ? [] : newMissing(r.route, r.missing, baseline)
    r.regressed = r.newMissing.length > 0
    r.baselineFor = (baseline.get(r.route) ?? new Set()).size
  }
  const failed = results.filter((r) => r.regressed)

  if (WRITE_BASELINE) {
    const routes = results
      .filter((r) => r.missing && r.missing.length > 0)
      .map((r) => ({
        route: r.route,
        knownMissing: r.missing.map((m) => (typeof m === 'string' ? m : m.name)),
      }))
    const baselinePayload = {
      generatedAt: new Date().toISOString(),
      reason:
        'Per-route snapshot of components a parity.json contract requires but the route does not yet import. Gate fails only on NEW missing components beyond this baseline. As each rebuild closes its gap, the route disappears here.',
      routes,
    }
    writeFileSync(BASELINE_PATH, JSON.stringify(baselinePayload, null, 2) + '\n')
    console.log(`Wrote baseline: ${routes.length} routes with known gaps recorded at ${relative(ROOT, BASELINE_PATH)}`)
    process.exit(0)
  }

  if (JSON_OUT) {
    console.log(
      JSON.stringify(
        {
          totalRoutes: results.length,
          failedRoutes: failed.length,
          totalMissing: results.reduce((s, r) => s + (r.missing?.length ?? 0), 0),
          newMissing: results.reduce((s, r) => s + r.newMissing.length, 0),
          results,
        },
        null,
        2,
      ),
    )
    process.exit(failed.length === 0 ? 0 : 1)
  }

  if (results.length === 0) {
    console.log('No parity.json contracts found. Add one per gated route under design_system/ryan-realty/ui_kits/<route>/parity.json.')
    process.exit(0)
  }

  const lines = []
  lines.push('Mockup parity check (ratcheted)')
  lines.push('================================')
  lines.push('')
  for (const r of results) {
    const status = r.regressed ? 'FAIL' : r.ok ? 'OK' : 'BASELINE'
    lines.push(`[${status}] ${r.route}`)
    lines.push(`     mockup: ${r.mockupExists ? 'design_system/ryan-realty/ui_kits/' + r.mockupDir + '/index.html' : 'MISSING'}`)
    lines.push(`     contract: design_system/ryan-realty/ui_kits/${r.mockupDir}/parity.json`)
    lines.push(`     required: ${r.requiredComponents.length}  ·  missing: ${r.missing?.length ?? 0}  ·  baselined: ${r.baselineFor}  ·  NEW missing: ${r.newMissing.length}`)
    if (r.reason) lines.push(`     reason: ${r.reason}`)
    if (r.newMissing.length > 0) {
      lines.push('     NEW (these fail CI):')
      for (const m of r.newMissing) {
        const section = typeof m === 'string' ? m : m.section ?? '(unspecified)'
        const name = typeof m === 'string' ? m : m.name
        lines.push(`       <${name}>  (mockup section: ${section})`)
      }
    } else if (r.missing && r.missing.length > 0) {
      lines.push('     baselined gaps (rebuild must close these to drop from baseline):')
      for (const m of r.missing) {
        const name = typeof m === 'string' ? m : m.name
        lines.push(`       <${name}>`)
      }
    }
    lines.push('')
  }
  const passCount = results.filter((r) => !r.regressed).length
  lines.push(`Summary: ${passCount} of ${results.length} routes pass (with baseline).`)
  if (failed.length > 0) {
    lines.push('')
    lines.push('NEW gaps detected (these fail CI):')
    lines.push('  Either add the missing imports to the route file, or accept the gap by re-running')
    lines.push('  `node scripts/check-mockup-parity.mjs --write-baseline` (only when intentional).')
  }

  console.log(lines.join('\n'))

  if (REPORT) {
    process.exit(0)
  }
  process.exit(failed.length === 0 ? 0 : 1)
}

main()
