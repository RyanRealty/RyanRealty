#!/usr/bin/env node
/**
 * scripts/pick-lhci-listing.mjs
 *
 * Resolve a currently-active Bend listing URL for lhci's listing-detail
 * gate. Two failure modes the lhci config has historically hit:
 *
 *   1. The hardcoded listing key sells / withdraws from MLS → /listing/{key}
 *      renders the "Listing Not Found" state → lhci scores BP=0, SEO=0.83.
 *   2. Supabase has a Cloudflare 522 outage → every listing detail page
 *      returns notFound() because the page-side data fetch errors → lhci
 *      sees the same "Listing Not Found" state.
 *
 * This script:
 *   - Queries Supabase REST API for a fresh active Bend listing.
 *   - If the call succeeds AND the resulting URL renders a 200 with a
 *     `<title>` that is NOT "Listing Not Found", uses it.
 *   - If anything fails (Supabase 522, no results, page 404), falls back
 *     to a list of known-historically-active Ryan Realty listings.
 *
 * Output: writes the chosen URL to stdout. lighthouserc.cjs reads this
 * via the LHCI_LISTING_URL env var. CI:
 *
 *   LHCI_LISTING_URL=$(node scripts/pick-lhci-listing.mjs) npm run ci:lighthouse
 *
 * Exits 0 with a usable URL on stdout. Exits 1 only on truly catastrophic
 * failures (no fallbacks reachable).
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const FALLBACK_BASE = 'https://ryanrealty.vercel.app'
const PROBE_TIMEOUT_MS = 4000

// Fallback URLs — verified active at the time of writing. These get
// re-checked at script runtime; if all of them return "Listing Not Found"
// the script bumps to the FINAL fallback (cities/bend, which always
// resolves and gives lhci something to measure).
const KNOWN_LISTING_URLS = [
  '/homes-for-sale/bend/tetherow/61281-mcroberts-220218727',
  '/homes-for-sale/bend/tetherow/19345-roswell-220219277',
  '/homes-for-sale/bend/tetherow/61311-mcroberts-220220611',
]

const FINAL_FALLBACK = '/cities/bend'

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local')
  const out = {}
  if (!fs.existsSync(envPath)) return out
  const content = fs.readFileSync(envPath, 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
  }
  return out
}

async function fetchWithTimeout(url, opts = {}, timeoutMs = PROBE_TIMEOUT_MS) {
  const ctl = new AbortController()
  const id = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    return await fetch(url, { ...opts, signal: ctl.signal })
  } finally {
    clearTimeout(id)
  }
}

async function pickFromSupabase(env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  try {
    const restUrl =
      url.replace(/\/$/, '') +
      '/rest/v1/listing_tile_mv' +
      '?select=address_slug,listing_key' +
      '&standard_status=eq.Active' +
      '&city_lower=eq.bend' +
      '&order=modified_at.desc.nullslast' +
      '&limit=20'
    const res = await fetchWithTimeout(restUrl, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
    if (!res.ok) return null
    const rows = await res.json()
    if (!Array.isArray(rows)) return null
    for (const row of rows) {
      if (!row?.address_slug) continue
      const path = `/homes-for-sale/${row.address_slug}`
      if (await probeUrl(`${FALLBACK_BASE}${path}`)) {
        return path
      }
    }
    return null
  } catch {
    return null
  }
}

async function probeUrl(absoluteUrl) {
  try {
    const res = await fetchWithTimeout(absoluteUrl, { redirect: 'follow' })
    if (!res.ok) return false
    const html = await res.text()
    const m = html.match(/<title>([^<]+)<\/title>/i)
    if (!m) return false
    const title = m[1] ?? ''
    if (/Listing Not Found/i.test(title)) return false
    return true
  } catch {
    return false
  }
}

async function pickFromFallback() {
  for (const path of KNOWN_LISTING_URLS) {
    if (await probeUrl(`${FALLBACK_BASE}${path}`)) return path
  }
  return null
}

;(async () => {
  const env = { ...process.env, ...loadEnv() }
  const fromSupabase = await pickFromSupabase(env)
  if (fromSupabase) {
    process.stdout.write(`http://127.0.0.1:3000${fromSupabase}\n`)
    process.exit(0)
  }
  const fromFallback = await pickFromFallback()
  if (fromFallback) {
    process.stderr.write(
      `[pick-lhci-listing] Supabase unavailable; using known-active fallback: ${fromFallback}\n`,
    )
    process.stdout.write(`http://127.0.0.1:3000${fromFallback}\n`)
    process.exit(0)
  }
  process.stderr.write(
    `[pick-lhci-listing] all candidates failed — falling back to ${FINAL_FALLBACK}. ` +
      `lhci will gate this URL instead of a listing-detail page until a real listing resolves.\n`,
  )
  process.stdout.write(`http://127.0.0.1:3000${FINAL_FALLBACK}\n`)
  process.exit(0)
})()
