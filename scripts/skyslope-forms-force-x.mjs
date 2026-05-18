#!/usr/bin/env node
/**
 * Force the X (fully-executed) suffix onto every doc whose cache says
 * executed=true but whose current SkySlope filename doesn't end with
 * `_X.{ext}`. Resolves the shared-doc cache conflict by preferring the
 * cache entry with executed=true when the same docId has multiple entries.
 *
 *   node scripts/skyslope-forms-force-x.mjs <cache.jsonl>
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

function endsWithXExt(name) {
  return /_X\.[A-Za-z0-9]{1,8}$/.test(String(name || ''))
}

function addXSuffix(name) {
  // Insert "_X" before the extension.
  const m = String(name || '').match(/^(.*)(\.[A-Za-z0-9]{1,8})$/)
  if (!m) return name + '_X'
  return m[1] + '_X' + m[2]
}

async function main() {
  const cachePath = process.argv[2]
  if (!cachePath) {
    console.error('usage: node skyslope-forms-force-x.mjs <cache.jsonl>')
    process.exit(2)
  }
  const env = loadEnv()
  const session = await login(env)

  // Build per-docId summary: any cache entry saying executed=true means
  // this doc should have X.
  const byDocId = new Map()
  for (const line of fs.readFileSync(cachePath, 'utf8').split('\n').filter(Boolean)) {
    try {
      const j = JSON.parse(line)
      if (j.action !== 'would_rename') continue
      if (!j.documentId) continue
      const cur = byDocId.get(j.documentId) || { executed: false, entries: [] }
      cur.entries.push(j)
      if (j.executed === true) cur.executed = true
      byDocId.set(j.documentId, cur)
    } catch {}
  }

  // For each docId that should be X, find current state and add X if missing.
  const targets = []
  for (const [docId, info] of byDocId) {
    if (!info.executed) continue
    // Use first entry's folder for state lookup
    const sample = info.entries[0]
    targets.push({ docId, sample, info })
  }

  console.error(JSON.stringify({ stage: 'identified', candidates: targets.length }))

  let added = 0
  let alreadyHasX = 0
  let failed = 0
  let i = 0

  for (const t of targets) {
    i += 1
    if (i % 100 === 0) process.stderr.write(JSON.stringify({ stage: 'progress', done: i, total: targets.length }) + '\n')

    // Try each entry's folder to find a place that has the doc.
    let live = null
    let liveFolder = null
    for (const e of t.info.entries) {
      const docs = await getFolderDocs(session, e.folderKind, e.folderGuid)
      const found = docs.find((d) => d.id === t.docId)
      if (found) {
        live = found
        liveFolder = e
        break
      }
    }
    if (!live) {
      failed += 1
      console.log(JSON.stringify({ action: 'force_x_no_live', docId: t.docId }))
      continue
    }

    if (endsWithXExt(live.fileName)) {
      alreadyHasX += 1
      continue
    }

    const newName = addXSuffix(live.fileName)
    const res = await patch(session, liveFolder.folderKind, liveFolder.folderGuid, t.docId, newName)
    if (res.ok) {
      added += 1
      console.log(JSON.stringify({ action: 'x_added', docId: t.docId, from: live.fileName, to: newName }))
    } else {
      // Try alt endpoint
      const altKind = liveFolder.folderKind === 'listing' ? 'sale' : 'listing'
      let altGuid = null
      for (const e of t.info.entries) if (e.folderKind === altKind) altGuid = e.folderGuid
      if (altGuid) {
        const res2 = await patch(session, altKind, altGuid, t.docId, newName)
        if (res2.ok) {
          added += 1
          console.log(JSON.stringify({ action: 'x_added_via_alt', docId: t.docId, from: live.fileName, to: newName }))
          continue
        }
      }
      failed += 1
      console.log(JSON.stringify({ action: 'force_x_failed', docId: t.docId, current: live.fileName, error: res.body }))
    }
  }

  console.error(JSON.stringify({ stage: 'summary', added, alreadyHasX, failed }))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
