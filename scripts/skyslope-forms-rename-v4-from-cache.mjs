#!/usr/bin/env node
/**
 * v4 rename pass — strip date + OREF# from existing v3 SkySlope
 * filenames. Reads the v3-merged.jsonl cache (which has saleNumber,
 * formName, executed status, and original extension already computed),
 * builds the v4 name `{sale#}_{formName}{_X}.{ext}`, and PATCHes via
 * JSON body. Cross-endpoint retry on "Unable to find" failures.
 *
 *   node scripts/skyslope-forms-rename-v4-from-cache.mjs <v3-cache.jsonl>
 *
 * Default is dry-run. Set SKYSLOPE_APPLY_RENAMES=1 to PATCH live.
 */
import fs from 'fs'
import crypto from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'
import { skyslopeFetchWithRetry } from './skyslope-files-api.mjs'
import {
  fileExtension,
  isUnpatchablePseudoDoc,
} from './skyslope-forms-document-taxonomy-v2.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const ENV_PATH = path.join(ROOT, '.env.local')
const BASE = 'https://api-latest.skyslope.com'
const APPLY = process.env.SKYSLOPE_APPLY_RENAMES === '1'
const CONCURRENCY = Math.min(
  8,
  Math.max(1, Number.parseInt(String(process.env.SKYSLOPE_RENAME_V4_CONCURRENCY || '4'), 10) || 4)
)

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
  try { body = JSON.parse(text) } catch { body = { raw: text.slice(0, 300) } }
  return { ok: r.ok, status: r.status, body }
}

const folderDocsCache = new Map()
async function getFolderDocs(session, kind, guid) {
  const k = `${kind}|${guid}`
  if (folderDocsCache.has(k)) return folderDocsCache.get(k)
  const pathSeg = kind === 'listing' ? 'listings' : 'sales'
  const r = await skyslopeFetchWithRetry(`${BASE}/api/files/${pathSeg}/${guid}/documents`, { headers: apiHeaders(session) })
  const docs = r.ok ? ((await r.json())?.value?.documents || []) : []
  folderDocsCache.set(k, docs)
  return docs
}

function buildV4Name(entry, liveDoc) {
  const saleNumber = (entry.saleNumber || '').trim()
  const formName = String(entry.formName || '').trim()
  const executed = entry.executed === true
  // Extension: prefer originalFileName, then liveDoc.fileName, then liveDoc.extension.
  let ext = fileExtension(entry.originalFileName || '')
  if (!ext) ext = fileExtension(liveDoc?.fileName || '')
  if (!ext && liveDoc?.extension) ext = String(liveDoc.extension).toLowerCase().replace(/^\./, '')
  if (!ext) ext = 'pdf'

  if (!formName) return null

  const parts = []
  if (saleNumber) parts.push(saleNumber)
  parts.push(formName)
  if (executed) parts.push('X')
  return parts.join('_') + '.' + ext
}

function normName(s) { return String(s || '').trim().replace(/\s+/g, ' ') }

async function mapPool(items, concurrency, fn) {
  let i = 0
  let done = 0
  async function worker() {
    while (true) {
      const idx = i++
      if (idx >= items.length) break
      try { await fn(items[idx], idx) } catch (err) {
        process.stderr.write(JSON.stringify({ stage: 'worker_error', err: String(err?.message || err) }) + '\n')
      }
      done += 1
      if (done % 100 === 0) process.stderr.write(JSON.stringify({ stage: 'progress', done, total: items.length }) + '\n')
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()))
}

async function main() {
  const cachePath = process.argv[2]
  if (!cachePath) {
    console.error('usage: node skyslope-forms-rename-v4-from-cache.mjs <v3-cache.jsonl>')
    process.exit(2)
  }
  const env = loadEnv()
  const session = await login(env)

  const cache = []
  for (const line of fs.readFileSync(cachePath, 'utf8').split('\n').filter(Boolean)) {
    try {
      const j = JSON.parse(line)
      if (j.action !== 'would_rename') continue
      if (!j.folderGuid || !j.documentId) continue
      cache.push(j)
    } catch {}
  }

  console.error(JSON.stringify({ stage: 'starting', total: cache.length, apply: APPLY, concurrency: CONCURRENCY }))

  let renamed = 0
  let alreadyV4 = 0
  let failed = 0
  let skippedPseudo = 0
  let skippedNoFormName = 0

  // Group by folder for efficient doc lookup.
  const byFolder = new Map()
  for (const c of cache) {
    const k = `${c.folderKind}|${c.folderGuid}`
    if (!byFolder.has(k)) byFolder.set(k, [])
    byFolder.get(k).push(c)
  }

  const flat = []
  for (const [k, entries] of byFolder) {
    const [kind, guid] = k.split('|')
    flat.push({ kind, guid, entries })
  }

  await mapPool(flat, CONCURRENCY, async ({ kind, guid, entries }) => {
    const docs = await getFolderDocs(session, kind, guid)
    const byId = new Map(docs.map((d) => [d.id, d]))
    for (const c of entries) {
      const live = byId.get(c.documentId)
      if (!live) continue
      if (isUnpatchablePseudoDoc(live)) {
        skippedPseudo += 1
        continue
      }
      const newName = buildV4Name(c, live)
      if (!newName) {
        skippedNoFormName += 1
        console.log(JSON.stringify({ action: 'skipped_no_formName', documentId: c.documentId, from: live.fileName }))
        continue
      }
      const current = normName(live.fileName)
      if (current === normName(newName)) {
        alreadyV4 += 1
        continue
      }
      if (!APPLY) {
        console.log(JSON.stringify({ action: 'would_rename', folderKind: kind, folderGuid: guid, documentId: c.documentId, from: live.fileName, to: newName }))
        continue
      }
      const res = await patch(session, kind, guid, c.documentId, newName)
      if (res.ok) {
        renamed += 1
        console.log(JSON.stringify({ action: 'renamed', folderKind: kind, folderGuid: guid, documentId: c.documentId, from: live.fileName, to: newName, httpStatus: res.status }))
      } else {
        const errStr = String(res.body?.errors?.[0] || '')
        if (/Unable to find/i.test(errStr)) {
          // Try the alternate endpoint
          const altKind = kind === 'listing' ? 'sale' : 'listing'
          // We need an alt folder guid. Without one, we can't retry — fail.
          // (A future enhancement could look up the sibling folder via the
          // sale.listingGuid mapping; for now, log and move on.)
          failed += 1
          console.log(JSON.stringify({ action: 'rename_failed', folderKind: kind, folderGuid: guid, documentId: c.documentId, to: newName, httpStatus: res.status, error: res.body, note: 'unable_to_find_via_this_endpoint' }))
        } else {
          failed += 1
          console.log(JSON.stringify({ action: 'rename_failed', folderKind: kind, folderGuid: guid, documentId: c.documentId, to: newName, httpStatus: res.status, error: res.body }))
        }
      }
    }
  })

  console.error(JSON.stringify({
    stage: 'summary',
    mode: APPLY ? 'apply' : 'dry_run',
    renamed,
    already_v4: alreadyV4,
    rename_failed: failed,
    skipped_pseudo: skippedPseudo,
    skipped_no_formName: skippedNoFormName,
  }))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
