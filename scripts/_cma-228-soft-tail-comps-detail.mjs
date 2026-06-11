#!/usr/bin/env node
/**
 * Pull full record + photos + lat/lng for each Hollow Pine Estate comp.
 * Reads out/cma-228-soft-tail/raw/closed_24mo.json and fetches details.
 */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')

function loadEnvLocal() {
  const path = resolve(REPO_ROOT, '.env.local')
  const raw = readFileSync(path, 'utf8')
  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq <= 0) continue
    const k = t.slice(0, eq).trim()
    let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!process.env[k]) process.env[k] = v
  }
}
loadEnvLocal()

const SPARK_BASE = (process.env.SPARK_API_BASE_URL || 'https://sparkapi.com/v1').replace(/\/+$/, '')
const TOKEN = (process.env.SPARK_API_KEY || '').trim()
const baseHeaders = { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' }

async function sparkGet(path, params) {
  const url = new URL(`${SPARK_BASE}${path}`)
  for (const [k, v] of Object.entries(params || {})) url.searchParams.set(k, String(v))
  const res = await fetch(url.toString(), { headers: baseHeaders })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

const RAW_DIR = resolve(REPO_ROOT, 'out/cma-228-soft-tail/raw')
const closedRaw = JSON.parse(readFileSync(resolve(RAW_DIR, 'closed_24mo.json'), 'utf8'))

const compsDetailed = []
for (const r of closedRaw) {
  const sf = r.StandardFields || r
  const k = r.Id ?? r.ListingKey
  console.log(`\n=== ${k} : ${sf.StreetNumber} ${sf.StreetDirPrefix ?? ''} ${sf.StreetName} ${sf.StreetSuffix ?? ''} ===`)

  const { data: detail } = await sparkGet(`/listings/${k}`, {})
  const dr = detail?.D?.Results?.[0]
  const dsf = dr?.StandardFields ?? {}
  console.log(`  Lat/Lng: ${dsf.Latitude}, ${dsf.Longitude}`)
  console.log(`  PublicRemarks: ${(dsf.PublicRemarks || '').slice(0, 120)}...`)

  const { data: ph } = await sparkGet(`/listings/${k}/photos`, { _limit: 30 })
  const photos = ph?.D?.Results || []
  console.log(`  ${photos.length} photos`)

  compsDetailed.push({
    id: k,
    StandardFields: { ...sf, ...dsf },
    photos: photos.slice(0, 8).map(p => ({ Uri800: p.Uri800, Uri320: p.Uri320, Caption: p.Caption })),
  })
}

writeFileSync(resolve(RAW_DIR, 'comps_detailed.json'), JSON.stringify(compsDetailed, null, 2))
console.log(`\nWrote ${compsDetailed.length} comps to comps_detailed.json`)
