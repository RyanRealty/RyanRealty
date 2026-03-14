#!/usr/bin/env node
/**
 * Run full sync to completion by calling GET /api/cron/sync-full in a loop.
 * Requires: dev server running (npm run dev) and .env.local with CRON_SECRET.
 * Usage: node scripts/run-full-sync.mjs [baseUrl]
 * Default baseUrl: http://localhost:3000
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
const baseUrl = (process.argv[2] || process.env.SITE_URL || env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')
const secret = process.env.CRON_SECRET || env.CRON_SECRET

if (!secret?.trim()) {
  console.error('CRON_SECRET is not set. Add CRON_SECRET=any-secret to .env.local (use any value for local sync).')
  process.exit(1)
}

const url = `${baseUrl}/api/cron/sync-full?pages=20&history_limit=100`
let run = 0
let lastPhase = null
let totalListingsUpserted = 0
let totalHistoryRows = 0

function statusLine(msg) {
  const ts = new Date().toLocaleTimeString()
  process.stdout.write(`[${ts}] ${msg}\n`)
}

const FETCH_TIMEOUT_MS = 10 * 60 * 1000 // 10 min per request (some chunks can be slow)

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
    statusLine(`Run ${run} HTTP ${res.status}: ${data.error || JSON.stringify(data)}`)
    return { ok: false, done: false }
  }
  const phase = data.phase || lastPhase
  if (phase !== lastPhase) {
    statusLine('----------------------------------------')
    statusLine(`PHASE: ${phase.toUpperCase()}`)
    statusLine('----------------------------------------')
    lastPhase = phase
  }
  if (data.done) {
    statusLine(data.message || 'Done.')
    return { ok: true, done: true }
  }
  if (data.phase === 'listings') {
    const page = data.nextListingPage ?? 0
    const total = data.totalListingPages ?? '?'
    const upserted = data.upserted ?? 0
    totalListingsUpserted += upserted
    statusLine(`Listings  page ${page} / ${total}  |  this run: ${upserted} upserted  |  total so far: ${totalListingsUpserted}`)
  } else if (data.phase === 'history') {
    const offset = data.nextHistoryOffset ?? 0
    const total = data.totalListings ?? '?'
    const rows = data.historyRowsUpserted ?? 0
    totalHistoryRows += rows
    statusLine(`History   offset ${offset}  (${total} need sync)  |  this run: ${rows} rows  |  total rows: ${totalHistoryRows}`)
  }
  return { ok: true, done: false }
}

async function main() {
  console.log('Full sync – status will stream below.')
  console.log('URL:', url)
  console.log('Ensure the dev server is running (npm run dev).\n')
  while (true) {
    const { ok, done } = await oneRun()
    if (!ok) {
      statusLine('Request failed. Retrying in 15s...')
      await new Promise((r) => setTimeout(r, 15000))
      continue
    }
    if (done) {
      console.log('\n==========  Full sync complete  ==========')
      process.exit(0)
    }
    await new Promise((r) => setTimeout(r, 2000))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
