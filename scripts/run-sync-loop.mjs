#!/usr/bin/env node
/**
 * Run full sync by calling GET /api/cron/sync-full in a loop until done.
 * Requires the Next.js app to be running on BASE_URL (default http://localhost:3000).
 * Usage: node scripts/run-sync-loop.mjs [BASE_URL]
 */

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const BASE_URL = process.argv[2] || process.env.SYNC_BASE_URL || 'http://localhost:3000'
const CRON_SECRET = process.env.CRON_SECRET || (() => {
  try {
    const p = resolve(process.cwd(), '.env.local')
    if (existsSync(p)) {
      const s = readFileSync(p, 'utf8')
      for (const line of s.split('\n')) {
        const m = line.match(/^\s*CRON_SECRET\s*=\s*(.+)$/)
        if (m) return m[1].replace(/^["']|["']$/g, '').trim()
      }
    }
  } catch (_) {}
  return ''
})()

const url = `${BASE_URL.replace(/\/$/, '')}/api/cron/sync-full?force=1`
const headers = CRON_SECRET ? { Authorization: `Bearer ${CRON_SECRET}` } : {}

let chunkCount = 0
let lastMessage = ''

async function runChunk() {
  const res = await fetch(url, { headers })
  const data = await res.json().catch(() => ({}))
  chunkCount++
  if (data.message) lastMessage = data.message
  if (!res.ok) {
    console.error(`Chunk ${chunkCount} error:`, res.status, data.error ?? data)
    return { stop: true, done: false }
  }
  if (data.skipped) {
    console.log('Sync skipped:', data.message || 'cron disabled or paused')
    return { stop: true, done: false }
  }
  if (data.stopped) {
    console.log('Sync stopped by user')
    return { stop: true, done: false }
  }
  if (data.paused) {
    console.log('Sync paused')
    return { stop: true, done: false }
  }
  if (chunkCount % 10 === 0 || data.done) {
    console.log(`Chunk ${chunkCount}: ${data.phase || '?'} – ${data.message || ''}`)
  }
  return { stop: !!data.done || !!data.error, done: !!data.done, error: data.error }
}

async function main() {
  console.log('Sync loop starting at', url)
  if (CRON_SECRET) console.log('Using CRON_SECRET from .env.local')
  else console.log('No CRON_SECRET (cron route may allow unauthenticated)')
  console.log('')

  while (true) {
    const out = await runChunk()
    if (out.stop) {
      if (out.error) console.error('Error:', out.error)
      if (out.done) console.log('Sync completed.', lastMessage || '')
      break
    }
    await new Promise((r) => setTimeout(r, 1500))
  }
  console.log('Total chunks:', chunkCount)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
