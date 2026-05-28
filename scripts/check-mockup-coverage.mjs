#!/usr/bin/env node
/**
 * check-mockup-coverage.mjs — every mockup directory must have a parity.json.
 *
 * Closes the loophole in check-mockup-parity.mjs: that gate only runs
 * on directories that already have a parity.json. If someone adds a
 * new mockup without the contract file, the parity gate is silently
 * skipped. This gate enforces the precondition.
 *
 * Allowlist: directories that intentionally have no parity.json (e.g.
 * the top-level ui_kits/index.html or _shared assets) live in
 * scripts/mockup-coverage-allowlist.json.
 */

import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from 'node:fs'
import { join, resolve, relative } from 'node:path'

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..')
const UI_KITS = join(ROOT, 'design_system/ryan-realty/ui_kits')
const ALLOWLIST_PATH = join(ROOT, 'scripts/mockup-coverage-allowlist.json')

const args = new Set(process.argv.slice(2))
const REPORT = args.has('--report')
const JSON_OUT = args.has('--json')
const WRITE_ALLOWLIST = args.has('--write-allowlist')

function listMockupDirs() {
  if (!existsSync(UI_KITS)) return []
  return readdirSync(UI_KITS)
    .map((name) => ({ name, full: join(UI_KITS, name) }))
    .filter((e) => statSync(e.full).isDirectory())
    .filter((e) => existsSync(join(e.full, 'index.html')))
}

function loadAllowlist() {
  if (!existsSync(ALLOWLIST_PATH)) return new Set()
  const raw = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8'))
  return new Set(raw.allowed ?? [])
}

function main() {
  const dirs = listMockupDirs()
  const missing = dirs.filter((d) => !existsSync(join(d.full, 'parity.json')))

  if (WRITE_ALLOWLIST) {
    const payload = {
      generatedAt: new Date().toISOString(),
      reason:
        'Mockup directories that intentionally lack a parity.json (e.g. legacy mockups not yet ported to the contract format). Each entry should disappear once the parity contract is authored.',
      allowed: missing.map((d) => d.name).sort(),
    }
    writeFileSync(ALLOWLIST_PATH, JSON.stringify(payload, null, 2) + '\n')
    console.log(`Wrote allowlist: ${missing.length} dirs at ${relative(ROOT, ALLOWLIST_PATH)}`)
    process.exit(0)
  }

  const allowed = loadAllowlist()
  const violators = missing.filter((d) => !allowed.has(d.name))

  if (JSON_OUT) {
    console.log(JSON.stringify({
      totalMockupDirs: dirs.length,
      missingParity: missing.length,
      allowed: allowed.size,
      violators: violators.map((d) => d.name),
    }, null, 2))
    process.exit(violators.length === 0 ? 0 : 1)
  }

  console.log('Mockup coverage check')
  console.log('=====================')
  console.log()
  console.log(`Total mockup directories: ${dirs.length}`)
  console.log(`  With parity.json:       ${dirs.length - missing.length}`)
  console.log(`  Without parity.json:    ${missing.length}`)
  console.log(`  Allowlisted:            ${allowed.size}`)
  console.log(`  VIOLATING:              ${violators.length}`)
  console.log()
  if (violators.length > 0) {
    console.log('Violating mockup directories (need a parity.json):')
    for (const d of violators) {
      console.log(`  design_system/ryan-realty/ui_kits/${d.name}/`)
    }
    console.log()
    console.log('Fix: create design_system/ryan-realty/ui_kits/<name>/parity.json')
    console.log('declaring { route, requiredComponents } for that mockup.')
    console.log('Or run `node scripts/check-mockup-coverage.mjs --write-allowlist`')
    console.log('to accept the gap (only when intentional).')
  }

  if (REPORT) process.exit(0)
  process.exit(violators.length === 0 ? 0 : 1)
}

main()
