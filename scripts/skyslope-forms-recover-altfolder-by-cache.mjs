#!/usr/bin/env node
/**
 * For each v4 "Unable to find" failure, look up other cache entries
 * with the same documentId (across all folders), and try PATCHing
 * via each one until one succeeds. Avoids the relatedSales-empty
 * problem.
 *
 *   node skyslope-forms-recover-altfolder-by-cache.mjs <v3-cache.jsonl> <v4-apply.jsonl>
 */
import fs from 'fs'
import crypto from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'
import { skyslopeFetchWithRetry } from './skyslope-files-api.mjs'
import { fileExtension } from './skyslope-forms-document-taxonomy-v2.mjs'

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

async function patch(session, kind, folderGuid, docId, newName) {
  const pathSeg = kind === 'listing' ? 'listings' : 'sales'
  const url = `${BASE}/api/files/${pathSeg}/${encodeURIComponent(folderGuid)}/documents/${encodeURIComponent(docId)}`
  const r = await skyslopeFetchWithRetry(url, {
    method: 'PATCH',
    headers: apiHeaders(session),
    body: JSON.stringify({ FileName: newName }),
  })
  const text = await r.text()
  let body
  try { body = JSON.parse(text) } catch { body = { raw: text.slice(0, 200) } }
  return { ok: r.ok, status: r.status, body }
}

function buildV4FromCacheEntry(c) {
  const saleNumber = (c.saleNumber || '').trim()
  const formName = String(c.formName || '').trim()
  const executed = c.executed === true
  let ext = fileExtension(c.originalFileName || '')
  if (!ext) ext = 'pdf'
  if (!formName) return null
  const parts = []
  if (saleNumber) parts.push(saleNumber)
  parts.push(formName)
  if (executed) parts.push('X')
  return parts.join('_') + '.' + ext
}

async function main() {
  const [cachePath, applyLogPath] = process.argv.slice(2)
  if (!cachePath || !applyLogPath) {
    console.error('usage: node skyslope-forms-recover-altfolder-by-cache.mjs <v3-cache.jsonl> <v4-apply.jsonl>')
    process.exit(2)
  }
  const env = loadEnv()
  const session = await login(env)

  // Index v3 cache by documentId.
  const byDocId = new Map()
  for (const line of fs.readFileSync(cachePath, 'utf8').split('\n').filter(Boolean)) {
    try {
      const j = JSON.parse(line)
      if (j.action !== 'would_rename' || !j.documentId) continue
      if (!byDocId.has(j.documentId)) byDocId.set(j.documentId, [])
      byDocId.get(j.documentId).push(j)
    } catch {}
  }

  // Read v4 failures.
  const failures = []
  for (const line of fs.readFileSync(applyLogPath, 'utf8').split('\n').filter(Boolean)) {
    try {
      const j = JSON.parse(line)
      if (j.action !== 'rename_failed') continue
      const err = String(j.error?.errors?.[0] || '')
      if (!/Unable to find document with guid/i.test(err)) continue
      failures.push(j)
    } catch {}
  }

  console.error(JSON.stringify({ stage: 'starting', failures: failures.length }))

  let recovered = 0
  let stillFailed = 0
  let alreadyRenamed = 0

  for (const f of failures) {
    const cacheEntries = (byDocId.get(f.documentId) || []).filter((c) => !(c.folderKind === f.folderKind && c.folderGuid === f.folderGuid))
    if (cacheEntries.length === 0) {
      stillFailed += 1
      console.log(JSON.stringify({ action: 'no_alt_cache_entry', documentId: f.documentId }))
      continue
    }
    let landed = false
    for (const c of cacheEntries) {
      // Use the cache entry's executed status when computing the target name.
      const targetName = buildV4FromCacheEntry(c)
      if (!targetName) continue
      // First check current state of doc in alt folder.
      const pathSeg = c.folderKind === 'listing' ? 'listings' : 'sales'
      const r = await skyslopeFetchWithRetry(`${BASE}/api/files/${pathSeg}/${c.folderGuid}/documents`, { headers: apiHeaders(session) })
      if (!r.ok) continue
      const docs = (await r.json())?.value?.documents || []
      const altDoc = docs.find((d) => d.id === f.documentId)
      if (!altDoc) continue
      if ((altDoc.fileName || '').trim() === targetName.trim()) {
        alreadyRenamed += 1
        console.log(JSON.stringify({ action: 'already_renamed_via_alt', documentId: f.documentId, fileName: altDoc.fileName, altKind: c.folderKind, altGuid: c.folderGuid }))
        landed = true
        break
      }
      const res = await patch(session, c.folderKind, c.folderGuid, f.documentId, targetName)
      if (res.ok) {
        recovered += 1
        console.log(JSON.stringify({ action: 'recovered_via_alt_cache', documentId: f.documentId, altKind: c.folderKind, altGuid: c.folderGuid, to: targetName, httpStatus: res.status }))
        landed = true
        break
      } else {
        console.log(JSON.stringify({ action: 'alt_patch_failed', documentId: f.documentId, altKind: c.folderKind, altGuid: c.folderGuid, status: res.status, error: res.body }))
      }
    }
    if (!landed) {
      stillFailed += 1
    }
  }

  console.error(JSON.stringify({ stage: 'summary', recovered, alreadyRenamed, stillFailed }))
}

main().catch((e) => { console.error(e); process.exit(1) })
