#!/usr/bin/env node
/**
 * Run year-by-year sync to completion by calling GET /api/cron/sync-year-by-year in a loop.
 * Uses same logic as cron: if listings match, skips to history only.
 * Requires: dev server running (npm run dev) or pass deployed URL. .env.local with CRON_SECRET.
 *
 * Usage:
 *   npm run sync:year                           # sync all years (newest first) on default lane
 *   npm run sync:year 2024                      # sync only 2024 on default lane
 *   npm run sync:year 2024 http://localhost:3000 # sync 2024 against a specific URL
 *   SYNC_YEAR_LANE=current-year npm run sync:year 2026 http://localhost:3000
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
const currentYear = new Date().getUTCFullYear()

let targetYear = null
let baseUrlArg = null
let laneArg = null
for (let i = 0; i < process.argv.slice(2).length; i++) {
  const arg = process.argv.slice(2)[i]
  if (arg === '--lane') {
    const next = process.argv.slice(2)[i + 1]
    if (next) {
      laneArg = next
      i += 1
      continue
    }
  }
  if (arg?.startsWith('--lane=')) {
    laneArg = arg.slice('--lane='.length)
    continue
  }
  const num = Number(arg)
  if (Number.isFinite(num) && num >= 1990 && num <= currentYear) {
    targetYear = Math.floor(num)
  } else if (!baseUrlArg && /^https?:\/\//i.test(arg)) {
    baseUrlArg = arg
  }
}

const baseUrl = (
  baseUrlArg ||
  process.env.SYNC_YEAR_BASE_URL ||
  process.env.SITE_URL ||
  env.NEXT_PUBLIC_SITE_URL ||
  'http://localhost:3001'
).replace(/\/$/, '')
const secret = process.env.CRON_SECRET || env.CRON_SECRET

if (!secret?.trim()) {
  console.error('CRON_SECRET is not set. Add CRON_SECRET=any-secret to .env.local (use any value for local sync).')
  process.exit(1)
}

const lane = (laneArg || process.env.SYNC_YEAR_LANE || 'default').trim() || 'default'
const params = new URLSearchParams()
if (targetYear) params.set('year', String(targetYear))
if (lane !== 'default') params.set('lane', lane)
const url = `${baseUrl}/api/cron/sync-year-by-year${params.toString() ? `?${params.toString()}` : ''}`
let lastYear = null
let lastPhase = null
let totalListingsUpserted = 0
let lastProgressSignature = null
let lastProgressAt = Date.now()
let consecutiveFailures = 0
let consecutiveNoProgress = 0

function statusLine(msg) {
  const ts = new Date().toLocaleTimeString()
  process.stdout.write(`[${ts}] ${msg}\n`)
}

function readNumericEnv(name, fallback, min = 0) {
  const value = Number(process.env[name])
  if (!Number.isFinite(value)) return fallback
  return Math.max(min, value)
}

const FETCH_TIMEOUT_MS = readNumericEnv('SYNC_YEAR_FETCH_TIMEOUT_MS', 5 * 60 * 1000, 60_000)
const FAILURE_LIMIT = readNumericEnv('SYNC_YEAR_FAILURE_LIMIT', 8, 1)
const NO_PROGRESS_LIMIT = readNumericEnv('SYNC_YEAR_NO_PROGRESS_LIMIT', 12, 1)
const NO_PROGRESS_STALE_MS = readNumericEnv('SYNC_YEAR_NO_PROGRESS_STALE_MS', 30 * 60 * 1000, 0)

function fmt(n) {
  return typeof n === 'number' ? n.toLocaleString() : '?'
}

async function oneRun() {
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
    statusLine(`HTTP ${res.status}: ${data.error || JSON.stringify(data)}`)
    return { ok: false, done: false }
  }

  const durationMs = typeof data.chunkDurationMs === 'number' ? data.chunkDurationMs : null
  if (durationMs != null) {
    statusLine(`Chunk duration: ${Math.round(durationMs / 1000)}s`)
  }
  if (data.staleLaneRecovered) {
    statusLine('Recovered a stale lane cursor before running this chunk.')
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
    const signature = `${phase}:${data.processedListings ?? 0}:${data.historyInserted ?? 0}:${data.listingsFinalized ?? 0}`
    if (signature !== lastProgressSignature) {
      lastProgressSignature = signature
      lastProgressAt = Date.now()
      consecutiveNoProgress = 0
    } else if ((Date.now() - lastProgressAt) >= NO_PROGRESS_STALE_MS) {
      consecutiveNoProgress += 1
      statusLine(`No new history progress observed for ${Math.round((Date.now() - lastProgressAt) / 60000)}m (${consecutiveNoProgress}/${NO_PROGRESS_LIMIT}).`)
    }
    if (inserted > 0 || finalized > 0) {
      const proc = data.processedListings ?? 0
      const total = data.totalListings ?? 0
      const pct = total > 0 ? Math.round((proc / total) * 100) : 0
      statusLine(`  ${fmt(proc)}/${fmt(total)} (${pct}%)  |  +${fmt(inserted)} history rows, +${fmt(finalized)} finalized`)
    } else if (data.message) {
      statusLine(`  ${data.message}`)
    }
    if (data.yielded) {
      statusLine('  Request budget reached. Progress saved and the next request will resume from this checkpoint.')
    }
  }

  if (phase !== 'listings' && phase !== 'history' && data.message) {
    statusLine(data.message)
  }

  return { ok: true, done: false }
}

async function main() {
  console.log(targetYear
    ? `Year sync – syncing ${targetYear} until done.`
    : 'Year sync – runs continuously until all years are done.')
  console.log('Skips listings when counts match; syncs history only.')
  console.log('URL:', url)
  console.log('Open /admin/sync to see progress. Status streams below.\n')
  while (true) {
    const { ok, done } = await oneRun()
    if (!ok) {
      consecutiveFailures += 1
      if (consecutiveFailures >= FAILURE_LIMIT) {
        statusLine(`Too many consecutive request failures (${consecutiveFailures}). Exiting so the supervisor can restart this year.`)
        process.exit(2)
      }
      statusLine('Request failed. Retrying in 15s...')
      await new Promise((r) => setTimeout(r, 15000))
      continue
    }
    consecutiveFailures = 0
    if (consecutiveNoProgress >= NO_PROGRESS_LIMIT) {
      statusLine(`No history progress after ${consecutiveNoProgress} stale checks. Exiting so the supervisor can restart year ${targetYear ?? lastYear ?? '?'}.`)
      process.exit(3)
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
