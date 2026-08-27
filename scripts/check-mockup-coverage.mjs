#!/usr/bin/env node
/**
 * check-mockup-coverage.mjs — every parity.json must name a ROUTE THAT EXISTS.
 *
 * RE-POINTED 2026-08-27. It used to assert "every directory holding an
 * index.html also holds a parity.json". That precondition died with the
 * mockups: the eleven KB-era index.html files were deleted, so the gate's scope
 * emptied out and it could only ever report 0 violations. Worse, the city
 * contract recorded the gate BY NAME as the reason a dead file survived --
 * "kept only because ci:mockup-coverage required a parity.json beside any
 * index.html, which is a gate keeping a dead file alive."
 *
 * The real precondition now runs the other way. ci:mockup-parity reads each
 * parity.json's `route` and asserts that file imports the components the
 * contract lists. A contract naming a route that no longer exists is silently
 * skipped there, so a page can lose its whole contract by being renamed and
 * nothing says so. That is what this gate catches.
 */
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from 'node:fs'
import { join, resolve, relative } from 'node:path'

const ROOT = resolve(process.cwd())
const KITS = 'design_system/ryan-realty/ui_kits'

const contracts = []
for (const entry of readdirSync(join(ROOT, KITS), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue
  const rel = `${KITS}/${entry.name}/parity.json`
  if (existsSync(join(ROOT, rel))) contracts.push(rel)
}

const failures = []
for (const rel of contracts) {
  let parsed
  try {
    parsed = JSON.parse(readFileSync(join(ROOT, rel), 'utf8'))
  } catch (err) {
    failures.push(`${rel}: is not valid JSON (${err.message}). ci:mockup-parity cannot read it, so its contract is not enforced.`)
    continue
  }
  const route = typeof parsed.route === 'string' ? parsed.route.trim() : ''
  if (!route) {
    failures.push(`${rel}: names no "route". ci:mockup-parity keys on that field, so this contract enforces nothing.`)
    continue
  }
  if (!existsSync(join(ROOT, route))) {
    failures.push(`${rel}: names route "${route}", which does not exist. The page was renamed or deleted and took its contract's coverage with it, silently.`)
    continue
  }
  const required = Array.isArray(parsed.requiredComponents) ? parsed.requiredComponents : []
  if (required.length === 0) {
    failures.push(`${rel}: has an empty requiredComponents list, so it asserts nothing. Give it the components the route may not lose, or delete the contract.`)
  }
}

console.log('mockup contract coverage (ci:mockup-coverage)')
console.log('=============================================')
console.log(`  parity contracts : ${contracts.length}`)
console.log(`  each must name a route that exists and at least one required component.`)

if (failures.length) {
  console.error(`\nFAIL - ${failures.length} contract problem(s):\n`)
  for (const f of failures) console.error('  ' + f)
  process.exit(1)
}
console.log('\nOK - every contract names a live route and asserts at least one component.')
