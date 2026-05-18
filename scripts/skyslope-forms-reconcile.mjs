#!/usr/bin/env node
/**
 * Reconcile any remaining mismatches: for every cache entry whose current
 * SkySlope fileName doesn't match the expected `.to`, PATCH it to the
 * expected name. Tries the cached folderKind first, then the opposite
 * endpoint via sibling folder lookup.
 *
 *   node scripts/skyslope-forms-reconcile.mjs <cache.jsonl>
 */
import fs from 'fs'
import crypto from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'
import { skyslopeFetchWithRetry } from './skyslope-files-api.mjs'
import { isUnpatchablePseudoDoc } from './skyslope-forms-document-taxonomy-v2.mjs'

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

const folderDocsCache = new Map()
async function getFolderDocs(session, folderKind, folderGuid) {
  const key = `${folderKind}|${folderGuid}`
  if (folderDocsCache.has(key)) return folderDocsCache.get(key)
  const pathSeg = folderKind === 'listing' ? 'listings' : 'sales'
  const r = await skyslopeFetchWithRetry(
    `${BASE}/api/files/${pathSeg}/${folderGuid}/documents`,
    { headers: apiHeaders(session) }
  )
  let docs = []
  if (r.ok) {
    const j = await r.json()
    docs = j?.value?.documents ?? []
  }
  folderDocsCache.set(key, docs)
  return docs
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
  try { body = JSON.parse(text) } catch { body = { raw: text.slice(0, 300) } }
  return { ok: r.ok, status: r.status, body }
}

function normName(s) {
  return String(s || '').trim().replace(/\s+/g, ' ')
}

async function mapPool(items, concurrency, fn) {
  let i = 0
  async function worker() {
    while (true) {
      const idx = i++
      if (idx >= items.length) break
      await fn(items[idx], idx)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()))
}

async function main() {
  const cachePath = process.argv[2]
  if (!cachePath) {
    console.error('usage: node skyslope-forms-reconcile.mjs <cache.jsonl>')
    process.exit(2)
  }
  const env = loadEnv()
  const session = await login(env)

  const cache = []
  for (const line of fs.readFileSync(cachePath, 'utf8').split('\n').filter(Boolean)) {
    try {
      const j = JSON.parse(line)
      if (j.action === 'would_rename' && j.folderKind && j.folderGuid && j.documentId && j.to) {
        cache.push(j)
      }
    } catch {}
  }

  // Identify mismatches by fetching current state.
  const mismatches = []
  const byFolder = new Map()
  for (const c of cache) {
    const k = `${c.folderKind}|${c.folderGuid}`
    if (!byFolder.has(k)) byFolder.set(k, [])
    byFolder.get(k).push(c)
  }

  for (const [key, items] of byFolder) {
    const [fk, fg] = key.split('|')
    const docs = await getFolderDocs(session, fk, fg)
    const byId = new Map(docs.map((d) => [d.id, d]))
    for (const c of items) {
      const live = byId.get(c.documentId)
      if (!live) continue
      if (isUnpatchablePseudoDoc(live)) continue
      if (normName(live.fileName) === normName(c.to)) continue
      mismatches.push({ ...c, currentFileName: live.fileName })
    }
  }

  console.error(JSON.stringify({ stage: 'identified', mismatches: mismatches.length }))

  let ok = 0
  let fail = 0
  await mapPool(mismatches, 4, async (m) => {
    // Try same endpoint first.
    const res = await patch(session, m.folderKind, m.folderGuid, m.documentId, m.to)
    if (res.ok) {
      ok += 1
      console.log(JSON.stringify({ action: 'reconciled', folderKind: m.folderKind, documentId: m.documentId, from: m.currentFileName, to: m.to, httpStatus: res.status }))
      return
    }
    // If "Unable to find", try opposite endpoint.
    const errStr = String(res.body?.errors?.[0] || '')
    if (/Unable to find/i.test(errStr)) {
      const altKind = m.folderKind === 'listing' ? 'sale' : 'listing'
      // Search every folder for this docId. Cheaper: scan ALL folders we've cached.
      let altGuid = null
      for (const [k, docs] of folderDocsCache.entries()) {
        const [kk] = k.split('|')
        if (kk !== altKind) continue
        if (docs.some((d) => d.id === m.documentId)) {
          altGuid = k.split('|')[1]
          break
        }
      }
      if (altGuid) {
        const res2 = await patch(session, altKind, altGuid, m.documentId, m.to)
        if (res2.ok) {
          ok += 1
          console.log(JSON.stringify({ action: 'reconciled_via_alt', altKind, altGuid, documentId: m.documentId, from: m.currentFileName, to: m.to, httpStatus: res2.status }))
          return
        }
      }
    }
    fail += 1
    console.log(JSON.stringify({ action: 'reconcile_failed', folderKind: m.folderKind, documentId: m.documentId, to: m.to, httpStatus: res.status, error: res.body }))
  })

  console.error(JSON.stringify({ stage: 'summary', reconciled: ok, failed: fail }))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
