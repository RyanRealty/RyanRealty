#!/usr/bin/env node
/**
 * Verify final SkySlope state by fetching current filenames and comparing
 * against the dry-run's expected `to` names. No PDF download, no OCR — fast.
 *
 *   node scripts/skyslope-forms-verify.mjs <dry-run.jsonl>
 *
 * Reports:
 *   - matches (current fileName == expected `to`)
 *   - mismatches (still on old name OR different name than expected)
 *   - skipped pseudo-rows
 *   - not-found docs (in cache but no longer in current SkySlope)
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

function loadEnvLocal(envPath) {
  const raw = fs.readFileSync(envPath, 'utf8')
  const env = {}
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1).replace(/\\n/g, '\n')
    else if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1)
    env[key] = val
  }
  return env
}

async function login(env) {
  const timestamp = new Date().toISOString()
  const hmac = crypto
    .createHmac('sha256', env.SKYSLOPE_ACCESS_SECRET.trim())
    .update(`${env.SKYSLOPE_CLIENT_ID.trim()}:${env.SKYSLOPE_CLIENT_SECRET.trim()}:${timestamp}`)
    .digest('base64')
  const res = await skyslopeFetchWithRetry(`${BASE}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `ss ${env.SKYSLOPE_ACCESS_KEY.trim()}:${hmac}`,
      Timestamp: timestamp,
    },
    body: JSON.stringify({
      ClientId: env.SKYSLOPE_CLIENT_ID.trim(),
      ClientSecret: env.SKYSLOPE_CLIENT_SECRET.trim(),
    }),
  })
  return (await res.json()).Session
}

function apiHeaders(session) {
  return {
    'Content-Type': 'application/json',
    Session: session,
    timestamp: new Date().toISOString(),
    Accept: 'application/json',
  }
}

async function fetchFolderDocs(session, folderKind, folderGuid) {
  const pathSeg = folderKind === 'listing' ? 'listings' : 'sales'
  const r = await skyslopeFetchWithRetry(
    `${BASE}/api/files/${pathSeg}/${folderGuid}/documents`,
    { headers: apiHeaders(session) }
  )
  if (!r.ok) return []
  const j = await r.json()
  return j?.value?.documents ?? []
}

function normName(s) {
  return String(s || '').trim().replace(/\s+/g, ' ')
}

async function main() {
  const cachePath = process.argv[2]
  if (!cachePath) {
    console.error('usage: node skyslope-forms-verify.mjs <dry-run.jsonl>')
    process.exit(2)
  }
  const env = loadEnvLocal(ENV_PATH)
  const session = await login(env)

  const lines = fs.readFileSync(cachePath, 'utf8').split('\n').filter(Boolean)
  const cache = []
  for (const line of lines) {
    try {
      const j = JSON.parse(line)
      if (j.action === 'would_rename' && j.folderKind && j.folderGuid && j.documentId && j.to) {
        cache.push(j)
      }
    } catch {
      /* skip */
    }
  }

  // Group cache by folderKind + folderGuid.
  const byFolder = new Map()
  for (const c of cache) {
    const k = `${c.folderKind}|${c.folderGuid}`
    if (!byFolder.has(k)) byFolder.set(k, [])
    byFolder.get(k).push(c)
  }

  // Fetch current state for each folder (serial — only ~49 folders).
  let matches = 0
  let mismatchOnOldName = 0  // still on the OLD name (.from)
  let mismatchOnOther = 0    // on something else entirely
  let pseudoSkipped = 0
  let notFound = 0

  const mismatches = []
  const pseudoList = []

  for (const [key, items] of byFolder) {
    const [folderKind, folderGuid] = key.split('|')
    const current = await fetchFolderDocs(session, folderKind, folderGuid)
    const byId = new Map()
    for (const d of current) byId.set(d.id, d)

    for (const c of items) {
      const live = byId.get(c.documentId)
      if (!live) {
        notFound += 1
        mismatches.push({ ...c, currentFileName: null, status: 'not_found' })
        continue
      }
      if (isUnpatchablePseudoDoc(live)) {
        pseudoSkipped += 1
        pseudoList.push({
          folderKind,
          folderGuid,
          documentId: c.documentId,
          cachedFrom: c.from,
          currentFileName: live.fileName,
        })
        continue
      }
      const curName = normName(live.fileName)
      const expected = normName(c.to)
      if (curName === expected) {
        matches += 1
      } else if (curName === normName(c.from)) {
        mismatchOnOldName += 1
        mismatches.push({ ...c, currentFileName: curName, status: 'still_old_name' })
      } else {
        mismatchOnOther += 1
        mismatches.push({ ...c, currentFileName: curName, status: 'other_name' })
      }
    }
  }

  console.log(
    JSON.stringify({
      stage: 'summary',
      cached_renames: cache.length,
      matches,
      mismatch_still_old_name: mismatchOnOldName,
      mismatch_other_name: mismatchOnOther,
      pseudo_skipped: pseudoSkipped,
      not_found: notFound,
    })
  )

  for (const m of mismatches.slice(0, 50)) {
    console.log(JSON.stringify({ action: 'mismatch', ...m }))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
