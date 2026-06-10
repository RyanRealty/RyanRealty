#!/usr/bin/env node
/**
 * One-command refresh for the /admin/deals dashboard:
 *   inventory (SkySlope API) -> analyze -> master file -> Supabase sync.
 *
 * Usage: node --env-file=.env.local scripts/skyslope-dashboard-refresh.mjs [--no-sync]
 * Read-only against SkySlope. Writes only tmp/ + the two dashboard tables.
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const noSync = process.argv.includes('--no-sync')

const steps = [
  ['scripts/skyslope-master-inventory.mjs'],
  ['scripts/skyslope-master-analyze.mjs'],
  ['scripts/skyslope-master-file.mjs'],
  ...(noSync ? [] : [['scripts/skyslope-sync-dashboard.mjs']]),
]

for (const [script] of steps) {
  console.log(`\n>>> ${script}`)
  const r = spawnSync('node', [script], { cwd: REPO, stdio: 'inherit', env: process.env })
  if (r.status !== 0) {
    console.error(`FAILED at ${script}`)
    process.exit(r.status ?? 1)
  }
}
console.log('\nDashboard refresh complete.')
