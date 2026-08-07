#!/usr/bin/env node
/**
 * merge-axe-seed.mjs — compose e2e/axe-baseline.json from the per-worker seed
 * fragments in e2e/.axe-seed/ (Playwright afterAll runs per worker; a direct
 * write from afterAll loses every other worker's routes). Run after a seeding
 * crawl; deletes the fragments on success.
 */
import { readFileSync, writeFileSync, readdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const FRAG_DIR = 'e2e/.axe-seed'
const OUT = 'e2e/axe-baseline.json'

if (!existsSync(FRAG_DIR)) {
  console.error(`✗ merge-axe-seed: no ${FRAG_DIR}/ — run the axe crawl in seeding mode first (delete ${OUT}).`)
  process.exit(1)
}
const merged = {}
let frags = 0
for (const f of readdirSync(FRAG_DIR).filter((f) => f.endsWith('.json'))) {
  const data = JSON.parse(readFileSync(join(FRAG_DIR, f), 'utf8'))
  for (const [route, ids] of Object.entries(data)) {
    merged[route] = Array.from(new Set([...(merged[route] ?? []), ...ids])).sort()
  }
  frags++
}
const routes = Object.keys(merged).sort()
if (routes.length === 0) {
  console.error('✗ merge-axe-seed: fragments held zero routes.')
  process.exit(1)
}
const out = {}
for (const r of routes) out[r] = merged[r]
writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n')
rmSync(FRAG_DIR, { recursive: true })
const withViolations = routes.filter((r) => out[r].length)
console.log(`✓ merged ${frags} fragment(s) → ${OUT}: ${routes.length} routes, ${withViolations.length} with violations.`)
