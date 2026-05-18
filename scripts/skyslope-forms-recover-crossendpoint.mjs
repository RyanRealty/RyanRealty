#!/usr/bin/env node
/**
 * Recover "Unable to find document with guid" failures by retrying the
 * PATCH against the OPPOSITE folder endpoint (listings → sales or
 * sales → listings).
 *
 * SkySlope's Files API treats a single document as living in EITHER the
 * listings table or the sales table even though the doc appears in both
 * folders' /documents listings. PATCHing via the wrong endpoint returns
 * 422 "Unable to find". This script flips the endpoint and retries.
 *
 *   node scripts/skyslope-forms-recover-crossendpoint.mjs <v3-apply.jsonl>
 */
import fs from 'fs'
import crypto from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'
import { skyslopeFetchWithRetry } from './skyslope-files-api.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const ENV_PATH = path.join(ROOT, '.env.local')
const BASE = 'https://api-latest.skyslope.com'
const CONCURRENCY = 4

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
    headers: {
      'Content-Type': 'application/json',
      Authorization: `ss ${env.SKYSLOPE_ACCESS_KEY.trim()}:${hmac}`,
      Timestamp: ts,
    },
    body: JSON.stringify({
      ClientId: env.SKYSLOPE_CLIENT_ID.trim(),
      ClientSecret: env.SKYSLOPE_CLIENT_SECRET.trim(),
    }),
  })
  return (await r.json()).Session
}

function apiHeaders(session) {
  return {
    'Content-Type': 'application/json',
    Session: session,
    timestamp: new Date().toISOString(),
    Accept: 'application/json',
  }
}

const listingToSaleCache = new Map()
async function findSiblingSaleFolder(session, listingGuid) {
  if (listingToSaleCache.has(listingGuid)) return listingToSaleCache.get(listingGuid)
  const r = await skyslopeFetchWithRetry(`${BASE}/api/files/listings/${listingGuid}`, {
    headers: apiHeaders(session),
  })
  if (!r.ok) {
    listingToSaleCache.set(listingGuid, null)
    return null
  }
  const j = await r.json()
  const sales = j?.value?.listing?.relatedSales || j?.value?.listing?.linkedSales || []
  const guid = (sales[0] && (sales[0].saleGuid || sales[0].guid)) || null
  listingToSaleCache.set(listingGuid, guid)
  return guid
}

const saleToListingCache = new Map()
async function findSiblingListingFolder(session, saleGuid) {
  if (saleToListingCache.has(saleGuid)) return saleToListingCache.get(saleGuid)
  const r = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${saleGuid}`, {
    headers: apiHeaders(session),
  })
  if (!r.ok) {
    saleToListingCache.set(saleGuid, null)
    return null
  }
  const j = await r.json()
  const guid = j?.value?.sale?.listingGuid || null
  saleToListingCache.set(saleGuid, guid)
  return guid
}

async function patch(session, folderKind, folderGuid, docId, newName) {
  const pathSeg = folderKind === 'listing' ? 'listings' : 'sales'
  const url = `${BASE}/api/files/${pathSeg}/${encodeURIComponent(folderGuid)}/documents/${encodeURIComponent(docId)}`
  const r = await skyslopeFetchWithRetry(url, {
    method: 'PATCH',
    headers: apiHeaders(session),
    body: JSON.stringify({ FileName: newName }),
  })
  const text = await r.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    body = { raw: text.slice(0, 300) }
  }
  return { ok: r.ok, status: r.status, body }
}

async function docExistsInFolder(session, folderKind, folderGuid, docId) {
  const pathSeg = folderKind === 'listing' ? 'listings' : 'sales'
  const r = await skyslopeFetchWithRetry(
    `${BASE}/api/files/${pathSeg}/${folderGuid}/documents`,
    { headers: apiHeaders(session) }
  )
  if (!r.ok) return false
  const j = await r.json()
  const docs = j?.value?.documents || []
  return docs.some((d) => d.id === docId)
}

async function mapPool(items, concurrency, fn) {
  let i = 0
  let done = 0
  const start = Date.now()
  async function worker() {
    while (true) {
      const idx = i++
      if (idx >= items.length) break
      try {
        await fn(items[idx], idx)
      } catch {}
      done += 1
      if (done % 50 === 0) {
        const dt = (Date.now() - start) / 1000
        process.stderr.write(JSON.stringify({ stage: 'progress', done, total: items.length, rateDps: Number((done / dt).toFixed(2)) }) + '\n')
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()))
}

async function main() {
  const inPath = process.argv[2]
  if (!inPath) {
    console.error('usage: node skyslope-forms-recover-crossendpoint.mjs <apply.jsonl>')
    process.exit(2)
  }
  const env = loadEnv()
  const session = await login(env)

  const failures = []
  for (const line of fs.readFileSync(inPath, 'utf8').split('\n').filter(Boolean)) {
    try {
      const j = JSON.parse(line)
      if (j.action !== 'rename_failed') continue
      const errStr = String(j.error?.errors?.[0] || '')
      if (/Unable to find document with guid/i.test(errStr)) failures.push(j)
    } catch {}
  }

  console.error(JSON.stringify({ stage: 'starting', total: failures.length, concurrency: CONCURRENCY }))

  let alreadyRenamed = 0
  let recovered = 0
  let stillFailed = 0

  await mapPool(failures, CONCURRENCY, async (f) => {
    const altKind = f.folderKind === 'listing' ? 'sale' : 'listing'
    let altGuid = null
    if (altKind === 'sale') {
      altGuid = await findSiblingSaleFolder(session, f.folderGuid)
    } else {
      altGuid = await findSiblingListingFolder(session, f.folderGuid)
    }
    if (!altGuid) {
      stillFailed += 1
      console.log(JSON.stringify({ action: 'no_sibling_folder', from: f.from, to: f.to, folderKind: f.folderKind, folderGuid: f.folderGuid, documentId: f.documentId }))
      return
    }

    // Check if doc actually exists in the alt folder, AND check if it's
    // already at the target name (meaning a sibling PATCH already renamed it).
    const pathSeg = altKind === 'listing' ? 'listings' : 'sales'
    const r = await skyslopeFetchWithRetry(
      `${BASE}/api/files/${pathSeg}/${altGuid}/documents`,
      { headers: apiHeaders(session) }
    )
    if (!r.ok) {
      stillFailed += 1
      console.log(JSON.stringify({ action: 'alt_list_failed', altKind, altGuid, status: r.status, from: f.from, to: f.to }))
      return
    }
    const docs = (await r.json())?.value?.documents || []
    const altDoc = docs.find((d) => d.id === f.documentId)
    if (!altDoc) {
      stillFailed += 1
      console.log(JSON.stringify({ action: 'not_in_alt_folder', altKind, altGuid, from: f.from, to: f.to, documentId: f.documentId }))
      return
    }
    if ((altDoc.fileName || '').trim() === String(f.to).trim()) {
      alreadyRenamed += 1
      console.log(JSON.stringify({ action: 'already_renamed_via_alt', altKind, altGuid, currentFileName: altDoc.fileName, documentId: f.documentId }))
      return
    }

    const res = await patch(session, altKind, altGuid, f.documentId, f.to)
    if (res.ok) {
      recovered += 1
      console.log(
        JSON.stringify({
          action: 'recovered_via_alt',
          altKind,
          altGuid,
          documentId: f.documentId,
          from: f.from,
          to: f.to,
          httpStatus: res.status,
        })
      )
    } else {
      stillFailed += 1
      console.log(
        JSON.stringify({
          action: 'alt_patch_failed',
          altKind,
          altGuid,
          documentId: f.documentId,
          from: f.from,
          to: f.to,
          httpStatus: res.status,
          error: res.body,
        })
      )
    }
  })

  console.error(
    JSON.stringify({
      stage: 'summary',
      total: failures.length,
      already_renamed: alreadyRenamed,
      recovered_via_alt: recovered,
      still_failed: stillFailed,
    })
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
