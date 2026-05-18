#!/usr/bin/env node
/**
 * Assign every document in every SkySlope listing/sale file folder to
 * the appropriate checklist activity. Reads the v3 redetect cache for
 * per-doc category/OREF#/filename signals, then for each folder:
 *
 *   1. Fetch the live activity list + already-attached docs per activity
 *   2. Classify each cache entry to candidate activity names
 *   3. Resolve the first candidate that exists in this folder
 *   4. POST /api/files/{kind}s/{guid}/checklist-items/{activityId}
 *      with body { documentGuid: ... } when not already attached
 *
 * Output JSONL: one line per attempted assignment with action ∈
 *   { assigned, already_attached, no_activity_match, assign_failed,
 *     skipped_pseudo_doc, skipped_no_folder_doc }
 *
 * Default is dry-run. Set SKYSLOPE_APPLY_ASSIGNMENTS=1 to POST.
 *
 *   node scripts/skyslope-checklist-assign.mjs <cache.jsonl>
 *
 * Env:
 *   SKYSLOPE_APPLY_ASSIGNMENTS=1     POST live (default = dry-run)
 *   SKYSLOPE_ASSIGN_CONCURRENCY=4    Workers
 */
import fs from 'fs'
import crypto from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'
import { skyslopeFetchWithRetry } from './skyslope-files-api.mjs'
import { classifyToActivityCandidates, pickActivity } from './skyslope-checklist-classifier.mjs'
import { isUnpatchablePseudoDoc } from './skyslope-forms-document-taxonomy-v2.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const ENV_PATH = path.join(ROOT, '.env.local')
const BASE = 'https://api-latest.skyslope.com'
const APPLY = process.env.SKYSLOPE_APPLY_ASSIGNMENTS === '1'
const CONCURRENCY = Math.min(
  8,
  Math.max(1, Number.parseInt(String(process.env.SKYSLOPE_ASSIGN_CONCURRENCY || '4'), 10) || 4)
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

async function fetchFolderDetail(session, kind, guid) {
  const pathSeg = kind === 'listing' ? 'listings' : 'sales'
  const r = await skyslopeFetchWithRetry(`${BASE}/api/files/${pathSeg}/${guid}`, {
    headers: apiHeaders(session),
  })
  if (!r.ok) return null
  return (await r.json())?.value?.[kind] || null
}

async function fetchFolderDocs(session, kind, guid) {
  const pathSeg = kind === 'listing' ? 'listings' : 'sales'
  const r = await skyslopeFetchWithRetry(`${BASE}/api/files/${pathSeg}/${guid}/documents`, {
    headers: apiHeaders(session),
  })
  if (!r.ok) return []
  return (await r.json())?.value?.documents || []
}

async function assignDocToActivity(session, kind, folderGuid, activityId, documentGuid) {
  const pathSeg = kind === 'listing' ? 'listings' : 'sales'
  const url = `${BASE}/api/files/${pathSeg}/${folderGuid}/checklist-items/${activityId}`
  const r = await skyslopeFetchWithRetry(url, {
    method: 'POST',
    headers: apiHeaders(session),
    body: JSON.stringify({ documentGuid }),
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

async function mapPool(items, concurrency, fn) {
  let i = 0
  async function worker() {
    while (true) {
      const idx = i++
      if (idx >= items.length) break
      try { await fn(items[idx], idx) } catch (err) {
        process.stderr.write(JSON.stringify({ stage: 'worker_error', err: String(err?.message || err) }) + '\n')
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()))
}

async function main() {
  const cachePath = process.argv[2]
  if (!cachePath) {
    console.error('usage: node skyslope-checklist-assign.mjs <cache.jsonl>')
    process.exit(2)
  }
  const env = loadEnv()
  const session = await login(env)

  // Group cache entries by folder.
  const entriesByFolder = new Map() // "kind|guid" → entries[]
  for (const line of fs.readFileSync(cachePath, 'utf8').split('\n').filter(Boolean)) {
    try {
      const j = JSON.parse(line)
      if (j.action !== 'would_rename') continue
      if (!j.folderGuid || !j.documentId) continue
      const key = `${j.folderKind}|${j.folderGuid}`
      if (!entriesByFolder.has(key)) entriesByFolder.set(key, [])
      entriesByFolder.get(key).push(j)
    } catch {}
  }

  console.error(
    JSON.stringify({
      stage: 'starting',
      folders: entriesByFolder.size,
      apply: APPLY,
      concurrency: CONCURRENCY,
    })
  )

  let assigned = 0
  let alreadyAttached = 0
  let noActivityMatch = 0
  let assignFailed = 0
  let pseudoSkipped = 0
  let noFolderDoc = 0

  const folderKeys = [...entriesByFolder.keys()]

  await mapPool(folderKeys, CONCURRENCY, async (folderKey) => {
    const [kind, guid] = folderKey.split('|')
    const detail = await fetchFolderDetail(session, kind, guid)
    if (!detail) {
      console.error(JSON.stringify({ stage: 'folder_detail_missing', kind, guid }))
      return
    }
    const docs = await fetchFolderDocs(session, kind, guid)
    const byDocId = new Map(docs.map((d) => [d.id, d]))
    const activities = detail.checklist?.activities || []

    // Build a lookup of activityId → set of already-attached docId.
    const attachedByActivity = new Map()
    for (const a of activities) {
      attachedByActivity.set(a.activityId, new Set((a.checklistDocs || []).map((cd) => cd.id)))
    }

    for (const cacheEntry of entriesByFolder.get(folderKey)) {
      const live = byDocId.get(cacheEntry.documentId)
      if (!live) {
        noFolderDoc += 1
        console.log(JSON.stringify({ action: 'skipped_no_folder_doc', folderKind: kind, folderGuid: guid, documentId: cacheEntry.documentId }))
        continue
      }
      if (isUnpatchablePseudoDoc(live)) {
        pseudoSkipped += 1
        console.log(JSON.stringify({ action: 'skipped_pseudo_doc', folderKind: kind, folderGuid: guid, documentId: live.id, fileName: live.fileName }))
        continue
      }

      const candidates = classifyToActivityCandidates(
        {
          category: cacheEntry.category,
          orefNumber: cacheEntry.orefNumber,
          fileName: cacheEntry.originalFileName || cacheEntry.from || live.fileName,
        },
        kind
      )
      const picked = pickActivity(activities, candidates)
      if (!picked) {
        noActivityMatch += 1
        console.log(
          JSON.stringify({
            action: 'no_activity_match',
            folderKind: kind,
            folderGuid: guid,
            address: cacheEntry.address,
            documentId: live.id,
            fileName: live.fileName,
            candidates,
          })
        )
        continue
      }

      const already = attachedByActivity.get(picked.activity.activityId)?.has(live.id)
      if (already) {
        alreadyAttached += 1
        console.log(
          JSON.stringify({
            action: 'already_attached',
            folderKind: kind,
            folderGuid: guid,
            address: cacheEntry.address,
            documentId: live.id,
            fileName: live.fileName,
            activityId: picked.activity.activityId,
            activityName: picked.activity.activityName,
          })
        )
        continue
      }

      if (!APPLY) {
        console.log(
          JSON.stringify({
            action: 'would_assign',
            folderKind: kind,
            folderGuid: guid,
            address: cacheEntry.address,
            documentId: live.id,
            fileName: live.fileName,
            activityId: picked.activity.activityId,
            activityName: picked.activity.activityName,
            activityStatus: picked.activity.status,
          })
        )
        continue
      }

      const res = await assignDocToActivity(session, kind, guid, picked.activity.activityId, live.id)
      if (res.ok) {
        assigned += 1
        attachedByActivity.get(picked.activity.activityId).add(live.id)
        console.log(
          JSON.stringify({
            action: 'assigned',
            folderKind: kind,
            folderGuid: guid,
            address: cacheEntry.address,
            documentId: live.id,
            fileName: live.fileName,
            activityId: picked.activity.activityId,
            activityName: picked.activity.activityName,
            httpStatus: res.status,
          })
        )
      } else {
        assignFailed += 1
        console.log(
          JSON.stringify({
            action: 'assign_failed',
            folderKind: kind,
            folderGuid: guid,
            documentId: live.id,
            fileName: live.fileName,
            activityId: picked.activity.activityId,
            activityName: picked.activity.activityName,
            httpStatus: res.status,
            error: res.body,
          })
        )
      }
    }
  })

  console.error(
    JSON.stringify({
      stage: 'summary',
      mode: APPLY ? 'apply' : 'dry_run',
      assigned,
      already_attached: alreadyAttached,
      no_activity_match: noActivityMatch,
      assign_failed: assignFailed,
      pseudo_skipped: pseudoSkipped,
      no_folder_doc: noFolderDoc,
    })
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
