#!/usr/bin/env node
/**
 * Sync a range of years in descending order, one at a time.
 * Waits for each year to fully complete before starting the next.
 *
 * Usage:
 *   node scripts/run-sync-range.mjs 1990 2014
 *   node scripts/run-sync-range.mjs 1990        # current backlog range down to 1990
 */

import { spawn } from 'child_process'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const args = process.argv.slice(2).map(Number).filter(n => Number.isFinite(n) && n >= 1990)
const currentYear = new Date().getUTCFullYear()
const fromYear = args[0] ?? currentYear
const toYear = args[1] ?? currentYear

function loadEnvLocal() {
  const path = resolve(process.cwd(), '.env.local')
  try {
    const raw = readFileSync(path, 'utf8')
    const env = {}
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      let val = trimmed.slice(eq + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      env[key] = val
    }
    return env
  } catch {
    return {}
  }
}

const envLocal = loadEnvLocal()
const baseUrl = (
  process.env.SYNC_YEAR_BASE_URL ||
  process.env.SITE_URL ||
  envLocal.NEXT_PUBLIC_SITE_URL ||
  'http://localhost:3001'
).replace(/\/$/, '')
const MAX_RESTARTS_PER_YEAR = Math.max(1, Number(process.env.SYNC_YEAR_MAX_RESTARTS ?? 8))

if (fromYear > toYear) {
  console.error(`Start year (${fromYear}) must be <= end year (${toYear})`)
  process.exit(1)
}

function syncYear(year) {
  return new Promise((resolve, reject) => {
    console.log(`\n${'='.repeat(50)}`)
    console.log(`  Starting sync for ${year}`)
    console.log(`${'='.repeat(50)}\n`)

    const child = spawn('node', ['scripts/run-year-sync.mjs', String(year), baseUrl], {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: {
        ...process.env,
        SYNC_YEAR_LANE: 'default',
        SYNC_YEAR_BASE_URL: baseUrl,
      },
    })

    child.on('close', code => {
      if (code === 0) {
        console.log(`\n✓ Year ${year} complete.\n`)
        resolve()
      } else if (code === 3 || code === 75) {
        console.log(`\n↺ Year ${year} helper went stale. Restarting from saved cursor...\n`)
        resolve('restart')
      } else {
        reject(new Error(`sync for ${year} exited with code ${code}`))
      }
    })

    child.on('error', reject)
  })
}

async function main() {
  const years = []
  for (let y = toYear; y >= fromYear; y--) years.push(y)

  console.log(`Syncing years ${toYear} → ${fromYear} (${years.length} year${years.length === 1 ? '' : 's'}) in order.`)
  console.log('Each year must complete before the next starts.\n')

  for (const year of years) {
    let restartCount = 0
    // If the helper exits because it stopped making progress, restart the same year
    // and let the server resume from the last saved cursor/checkpoint.
    while ((await syncYear(year)) === 'restart') {
      restartCount += 1
      if (restartCount >= MAX_RESTARTS_PER_YEAR) {
        throw new Error(`year ${year} exceeded ${MAX_RESTARTS_PER_YEAR} automatic restarts`)
      }
      console.log(`Restart ${restartCount}/${MAX_RESTARTS_PER_YEAR} for year ${year}...\n`)
    }
  }

  console.log(`\n${'='.repeat(50)}`)
  console.log(`  All years ${toYear}–${fromYear} synced.`)
  console.log(`${'='.repeat(50)}\n`)
}

main().catch(err => {
  console.error('Sync range failed:', err.message)
  process.exit(1)
})
