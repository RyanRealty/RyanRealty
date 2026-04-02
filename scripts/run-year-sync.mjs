#!/usr/bin/env node
/**
 * Run year-by-year sync to completion by calling GET /api/cron/sync-year-by-year in a loop.
 * Uses same logic as cron: if listings match, skips to history only.
 * Requires: dev server running (npm run dev) or pass deployed URL. .env.local with CRON_SECRET.
 *
 * Usage (npm needs -- before script args):
 *   npm run sync:year                         # sync all years (newest first)
 *   npm run sync:year -- 2024                 # sync only 2024
 *   npm run sync:year -- 2024 http://localhost:3000
 *   npm run sync:year -- 2024 https://ryanrealty.vercel.app  # production
 * Or set NEXT_PUBLIC_SITE_URL in .env.local so you can omit the URL argument.
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'

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
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1)
      env[key] = val
    }
    return env
  } catch (e) {
    console.error('Could not read .env.local:', e.message)
    return {}
  }
}

const env = loadEnvLocal()

let targetYear = null
let baseUrlArg = null
for (const arg of process.argv.slice(2)) {
  const num = Number(arg)
  if (Number.isFinite(num) && num >= 1990 && num <= new Date().getUTCFullYear()) {
    targetYear = Math.floor(num)
  } else if (!baseUrlArg) {
    baseUrlArg = arg
  }
}

const baseUrl = (baseUrlArg || process.env.SITE_URL || env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')
const secret = process.env.CRON_SECRET || env.CRON_SECRET

if (!secret?.trim()) {
  console.error('CRON_SECRET is not set. Add CRON_SECRET=any-secret to .env.local (use any value for local sync).')
  process.exit(1)
}

const yearParam = targetYear ? `?year=${targetYear}` : ''
const url = `${baseUrl}/api/cron/sync-year-by-year${yearParam}`
let run = 0
let lastYear = null
let lastPhase = null
let totalListingsUpserted = 0
let totalHistoryRows = 0
let totalFinalized = 0

function statusLine(msg) {
  const ts = new Date().toLocaleTimeString()
  process.stdout.write(`[${ts}] ${msg}\n`)
}

const FETCH_TIMEOUT_MS = 5 * 60 * 1000 // 5 min per request

function fmt(n) {
  return typeof n === 'number' ? n.toLocaleString() : '?'
}

async function oneRun() {
  run++
  let res
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
  } catch (err) {
    statusLine(`Request failed (${err.cause?.code || err.message}). Will retry in 15s.`)
    return { ok: false, done: false }
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401) {
      statusLine(
        'HTTP 401: Server rejected the Bearer token. Use the same CRON_SECRET in .env.local as Next.js loads, then restart npm run dev.',
      )
    } else {
      statusLine(`HTTP ${res.status}: ${data.error || JSON.stringify(data)}`)
    }
    return { ok: false, done: false }
  }

  const year = data.year ?? lastYear
  const phase = data.phase ?? lastPhase
  const phaseChanged = year !== lastYear || phase !== lastPhase

  if (year !== lastYear) {
    console.log('')
    statusLine('========================================')
    statusLine(`  YEAR ${year}`)
    statusLine('========================================')
    lastYear = year
  }

  if (phaseChanged) {
    lastPhase = phase
    if (phase === 'listings') {
      statusLine('Phase: LISTINGS — downloading from Spark')
      if (typeof data.sparkListings === 'number' || typeof data.supabaseListings === 'number') {
        statusLine(`  Spark: ${fmt(data.sparkListings)}  |  Database: ${fmt(data.supabaseListings)}`)
      }
    } else if (phase === 'history') {
      statusLine('Phase: HISTORY — fetching listing history and finalizing')
      if (typeof data.sparkListings === 'number' && typeof data.supabaseListings === 'number') {
        const match = data.sparkListings === data.supabaseListings
        statusLine(`  Spark: ${fmt(data.sparkListings)}  |  Database: ${fmt(data.supabaseListings)}${match ? '  ✓ counts match, skipping listings' : ''}`)
      }
      if (typeof data.totalListings === 'number') {
        statusLine(`  ${fmt(data.totalListings)} listings to process`)
      }
    }
  }

  if (data.done) {
    statusLine(data.message || 'Done.')
    return { ok: true, done: true }
  }

  if (phase === 'listings' && data.listingsUpserted > 0) {
    totalListingsUpserted += data.listingsUpserted
    statusLine(`  +${fmt(data.listingsUpserted)} upserted  |  total: ${fmt(totalListingsUpserted)}`)
  }

  if (phase === 'history') {
    const inserted = data.historyInserted ?? 0
    const finalized = data.listingsFinalized ?? 0
    if (inserted > 0 || finalized > 0) {
      totalHistoryRows += inserted
      totalFinalized += finalized
      const proc = data.processedListings ?? 0
      const total = data.totalListings ?? 0
      const pct = total > 0 ? Math.round((proc / total) * 100) : 0
      statusLine(`  ${fmt(proc)}/${fmt(total)} (${pct}%)  |  +${fmt(inserted)} history rows, +${fmt(finalized)} finalized`)
    } else if (data.message) {
      statusLine(`  ${data.message}`)
    }
  }

  if (phase !== 'listings' && phase !== 'history' && data.message) {
    statusLine(data.message)
  }

  return { ok: true, done: false }
}

async function assertCronRouteReachable() {
  const probe = `${baseUrl}/api/cron/sync-year-by-year`
  try {
    const res = await fetch(probe, {
      method: 'GET',
      signal: AbortSignal.timeout(15000),
    })
    // 401 without Bearer means the app is up and the cron route exists (expected).
    if (res.status === 401) return
    if (res.status === 404) {
      console.error(`Cron route not found at ${probe}. Check NEXT_PUBLIC_SITE_URL / base URL.`)
      process.exit(1)
    }
    if (res.status === 403) {
      console.error(`Blocked (${res.status}) at ${probe}.`)
      process.exit(1)
    }
  } catch (err) {
    const msg = err.cause?.code || err.message
    console.error(
      `Cannot reach ${baseUrl} (${msg}). Start the app first (npm run dev) or pass your site URL as the last argument:\n` +
        `  npm run sync:year -- 2017 https://ryanrealty.vercel.app`,
    )
    process.exit(1)
  }
}

async function main() {
  console.log(targetYear
    ? `Year sync – syncing ${targetYear} until done.`
    : 'Year sync – runs continuously until all years are done.')
  console.log('Skips listings when counts match; syncs history only.')
  console.log('URL:', url)
  if (targetYear == null) {
    console.log('Tip: pass a year after -- so npm forwards it: npm run sync:year -- 2017')
  } else {
    console.log('Args:', process.argv.slice(2).join(' ') || '(none)')
  }
  await assertCronRouteReachable()
  console.log('Open /admin/sync to see progress. Status streams below.\n')
  while (true) {
    const { ok, done } = await oneRun()
    if (!ok) {
      statusLine('Request failed. Retrying in 15s...')
      await new Promise((r) => setTimeout(r, 15000))
      continue
    }
    if (done) {
      console.log('\n==========  Year sync complete  ==========')
      process.exit(0)
    }
    await new Promise((r) => setTimeout(r, 1500))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
