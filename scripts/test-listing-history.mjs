#!/usr/bin/env node
/**
 * Test Spark listing history APIs for a few listings from the DB.
 * Reads .env.local; no server required.
 * Usage: node scripts/test-listing-history.mjs [count]
 * Default count: 5
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

function loadEnvLocal() {
  const path = resolve(process.cwd(), '.env.local')
  try {
    const raw = readFileSync(path, 'utf8')
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      let val = trimmed.slice(eq + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1)
      process.env[key] = val
    }
  } catch (e) {
    console.error('Could not read .env.local:', e.message)
  }
}

loadEnvLocal()

const SPARK_BASE = process.env.SPARK_API_BASE_URL || 'https://sparkapi.com/v1'
const SPARK_AUTH = (process.env.SPARK_AUTH_SCHEME || 'Bearer').trim()
const token = (process.env.SPARK_API_KEY || '').trim()
const count = Math.min(parseInt(process.argv[2], 10) || 5, 20)

if (!token) {
  console.error('SPARK_API_KEY is not set in .env.local')
  process.exit(1)
}

function parseResults(data) {
  const d = data?.D
  const raw = d?.Results ?? data?.Results
  if (!Array.isArray(raw)) return []
  return raw
}

async function fetchHistory(listingKey) {
  const url = `${SPARK_BASE}/listings/${encodeURIComponent(listingKey)}/history`
  const res = await fetch(url, {
    headers: { Authorization: `${SPARK_AUTH} ${token}`, Accept: 'application/json' },
  })
  const data = await res.json().catch(() => ({}))
  const items = parseResults(data)
  return { status: res.status, count: items.length }
}

async function fetchPriceHistory(listingKey) {
  const url = `${SPARK_BASE}/listings/${encodeURIComponent(listingKey)}/historical/pricehistory`
  const res = await fetch(url, {
    headers: { Authorization: `${SPARK_AUTH} ${token}`, Accept: 'application/json' },
  })
  const data = await res.json().catch(() => ({}))
  const items = parseResults(data)
  return { status: res.status, count: items.length }
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl?.trim() || !serviceKey?.trim()) {
    console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required in .env.local')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  const { data: rows, error } = await supabase
    .from('listings')
    .select('ListingKey, ListNumber')
    .order('ListNumber', { ascending: true, nullsFirst: false })
    .limit(count)

  if (error) {
    console.error('Supabase error:', error.message)
    process.exit(1)
  }
  const keys = (rows || []).map((r) => r.ListingKey || r.ListNumber).filter(Boolean)
  if (keys.length === 0) {
    console.error('No listings found in DB. Run a listing sync first.')
    process.exit(1)
  }

  console.log(`Testing ${keys.length} listing(s) with Spark history APIs...\n`)

  let anyHistory = 0
  let anyPriceHistory = 0

  for (const key of keys) {
    const [h, p] = await Promise.all([fetchHistory(key), fetchPriceHistory(key)])
    anyHistory += h.count
    anyPriceHistory += p.count
    const status = h.count > 0 || p.count > 0 ? '✓' : (h.status !== 200 || p.status !== 200 ? 'error' : '0')
    console.log(`  ${key}  history: ${h.count} (HTTP ${h.status})  pricehistory: ${p.count} (HTTP ${p.status})  ${status}`)
  }

  console.log('')
  if (anyHistory > 0 || anyPriceHistory > 0) {
    console.log('Result: History is working. At least one endpoint returned events.')
  } else {
    console.log('Result: No history data returned.')
    console.log('  - HTTP 403 = Forbidden: your API key role (IDX/VOW/Portal) is restricted by the MLS.')
    console.log('  - HTTP 400 = Bad request or endpoint not supported for this MLS.')
    console.log('  - HTTP 200 with 0 events = Key allowed but MLS returns no history for this role.')
    console.log('See https://sparkplatform.com/docs/api_services/listings/history — Private role is required for full history.')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
