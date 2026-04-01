#!/usr/bin/env node
/**
 * Sync a range of years in ascending order, one at a time.
 * Waits for each year to fully complete before starting the next.
 *
 * Usage:
 *   node scripts/run-sync-range.mjs 2016 2025
 *   node scripts/run-sync-range.mjs 2016        # 2016 → current year
 */

import { spawn } from 'child_process'

const args = process.argv.slice(2).map(Number).filter(n => Number.isFinite(n) && n >= 1990)
const currentYear = new Date().getUTCFullYear()
const fromYear = args[0] ?? currentYear
const toYear = args[1] ?? currentYear

if (fromYear > toYear) {
  console.error(`Start year (${fromYear}) must be <= end year (${toYear})`)
  process.exit(1)
}

function syncYear(year) {
  return new Promise((resolve, reject) => {
    console.log(`\n${'='.repeat(50)}`)
    console.log(`  Starting sync for ${year}`)
    console.log(`${'='.repeat(50)}\n`)

    const child = spawn('node', ['scripts/run-year-sync.mjs', String(year), '--lane=historical-backfill'], {
      stdio: 'inherit',
      cwd: process.cwd(),
    })

    child.on('close', code => {
      if (code === 0) {
        console.log(`\n✓ Year ${year} complete.\n`)
        resolve()
      } else {
        reject(new Error(`sync for ${year} exited with code ${code}`))
      }
    })

    child.on('error', reject)
  })
}

async function main() {
  const years = []
  for (let y = fromYear; y <= toYear; y++) years.push(y)

  console.log(`Syncing years ${fromYear} → ${toYear} (${years.length} year${years.length === 1 ? '' : 's'}) in order.`)
  console.log('Each year must complete before the next starts.\n')

  for (const year of years) {
    await syncYear(year)
  }

  console.log(`\n${'='.repeat(50)}`)
  console.log(`  All years ${fromYear}–${toYear} synced.`)
  console.log(`${'='.repeat(50)}\n`)
}

main().catch(err => {
  console.error('Sync range failed:', err.message)
  process.exit(1)
})
