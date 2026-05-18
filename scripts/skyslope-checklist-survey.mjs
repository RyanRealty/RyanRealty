#!/usr/bin/env node
/**
 * Dump every distinct checklist `typeName` (and a sample activityId)
 * across every listing and sale folder, so the classifier knows what
 * type strings SkySlope actually returns.
 */
import fs from 'fs'
import crypto from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'
import { fetchSkyslopeFileFolderRows, skyslopeFetchWithRetry } from './skyslope-files-api.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const ENV_PATH = path.join(ROOT, '.env.local')
const BASE = 'https://api-latest.skyslope.com'

function loadEnv() {
  const env = {}
  for (const line of fs.readFileSync(ENV_PATH, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq <= 0) continue
    let v = t.slice(eq + 1).trim()
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
    env[t.slice(0, eq).trim()] = v
  }
  return env
}

async function login(env) {
  const ts = new Date().toISOString()
  const hmac = crypto
    .createHmac('sha256', env.SKYSLOPE_ACCESS_SECRET.trim())
    .update(`${env.SKYSLOPE_CLIENT_ID.trim()}:${env.SKYSLOPE_CLIENT_SECRET.trim()}:${ts}`)
    .digest('base64')
  const r = await skyslopeFetchWithRetry(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `ss ${env.SKYSLOPE_ACCESS_KEY.trim()}:${hmac}`, Timestamp: ts },
    body: JSON.stringify({ ClientId: env.SKYSLOPE_CLIENT_ID.trim(), ClientSecret: env.SKYSLOPE_CLIENT_SECRET.trim() }),
  })
  return (await r.json()).Session
}

function apiHeaders(session) {
  return { 'Content-Type': 'application/json', Session: session, timestamp: new Date().toISOString(), Accept: 'application/json' }
}

async function fetchDetail(session, kind, guid) {
  const path_seg = kind === 'listing' ? 'listings' : 'sales'
  const r = await skyslopeFetchWithRetry(`${BASE}/api/files/${path_seg}/${guid}`, { headers: apiHeaders(session) })
  if (!r.ok) return null
  const j = await r.json()
  return j?.value?.[kind] || null
}

async function main() {
  const env = loadEnv()
  const session = await login(env)
  const listings = await fetchSkyslopeFileFolderRows(session, BASE, 'listings', () => apiHeaders(session), false)
  const sales = await fetchSkyslopeFileFolderRows(session, BASE, 'sales', () => apiHeaders(session), false)

  const byKey = new Map() // "typeName||activityName" → { count, kinds, sampleStatus, sampleDocCount }

  function addActivity(kind, a) {
    const tn = a.typeName || '(blank)'
    const an = a.activityName || '(blank)'
    const key = `${tn}||${an}`
    if (!byKey.has(key)) byKey.set(key, { typeName: tn, activityName: an, count: 0, kinds: new Set(), sampleStatus: a.status, sampleDocCount: (a.checklistDocs || []).length, sampleHelp: a.help || '' })
    const cur = byKey.get(key)
    cur.count += 1
    cur.kinds.add(kind)
  }

  for (const L of listings) {
    const d = await fetchDetail(session, 'listing', L.listingGuid)
    for (const a of d?.checklist?.activities || []) addActivity('listing', a)
  }
  for (const S of sales) {
    const d = await fetchDetail(session, 'sale', S.saleGuid)
    for (const a of d?.checklist?.activities || []) addActivity('sale', a)
  }

  const rows = [...byKey.values()]
    .sort((a, b) => b.count - a.count)
    .map((r) => ({ ...r, kinds: [...r.kinds].sort() }))

  console.log(JSON.stringify({ totalDistinctActivities: rows.length, rows }, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
