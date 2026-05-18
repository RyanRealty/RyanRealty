#!/usr/bin/env node
/**
 * Apply SkySlope filename PATCHes from a cached dry-run JSONL. Avoids
 * re-OCR'ing every PDF on the apply pass. Reads the dry-run output and
 * issues one PATCH per `would_rename` action.
 *
 *   node scripts/skyslope-forms-apply-from-cache.mjs <dry-run.jsonl>
 *
 * Env:
 *   SKYSLOPE_APPLY_CONCURRENCY (default 6)
 *   SKYSLOPE_APPLY_PACE_MS (default 80) — small space between starts to
 *     avoid bursting the API
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
const CONCURRENCY = Math.min(
  12,
  Math.max(1, Number.parseInt(String(process.env.SKYSLOPE_APPLY_CONCURRENCY || '6'), 10) || 6)
)
const PACE_MS = Math.max(0, Number.parseInt(String(process.env.SKYSLOPE_APPLY_PACE_MS || '80'), 10) || 80)

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
    if (val.startsWith('"') && val.endsWith('"'))
      val = val.slice(1, -1).replace(/\\n/g, '\n')
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
  const j = await res.json()
  if (!j.Session) throw new Error('Login failed: ' + JSON.stringify(j))
  return j.Session
}

function apiHeaders(session) {
  return {
    'Content-Type': 'application/json',
    Session: session,
    timestamp: new Date().toISOString(),
    Accept: 'application/json',
  }
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

async function mapPool(items, concurrency, fn) {
  let i = 0
  async function worker() {
    while (true) {
      const idx = i++
      if (idx >= items.length) break
      if (PACE_MS > 0) await new Promise((r) => setTimeout(r, PACE_MS))
      await fn(items[idx], idx)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()))
}

async function main() {
  const cachePath = process.argv[2]
  if (!cachePath) {
    console.error('usage: node skyslope-forms-apply-from-cache.mjs <dry-run.jsonl>')
    process.exit(2)
  }
  const env = loadEnvLocal(ENV_PATH)
  const session = await login(env)

  const lines = fs.readFileSync(cachePath, 'utf8').split('\n').filter(Boolean)
  const tasks = []
  for (const line of lines) {
    try {
      const j = JSON.parse(line)
      if (j.action !== 'would_rename') continue
      if (!j.folderKind || !j.folderGuid || !j.documentId || !j.to) continue
      tasks.push(j)
    } catch {
      /* skip */
    }
  }

  console.error(JSON.stringify({ stage: 'starting', tasks: tasks.length, concurrency: CONCURRENCY, paceMs: PACE_MS }))

  let ok = 0
  let fail = 0
  await mapPool(tasks, CONCURRENCY, async (t) => {
    try {
      const res = await patch(session, t.folderKind, t.folderGuid, t.documentId, t.to)
      if (res.ok) {
        ok += 1
        console.log(
          JSON.stringify({
            action: 'renamed',
            folderKind: t.folderKind,
            folderGuid: t.folderGuid,
            address: t.address,
            documentId: t.documentId,
            from: t.from,
            to: t.to,
            category: t.category,
            executed: t.executed === true,
            httpStatus: res.status,
          })
        )
      } else {
        fail += 1
        console.log(
          JSON.stringify({
            action: 'rename_failed',
            folderKind: t.folderKind,
            folderGuid: t.folderGuid,
            address: t.address,
            documentId: t.documentId,
            from: t.from,
            to: t.to,
            category: t.category,
            httpStatus: res.status,
            error: res.body,
          })
        )
      }
    } catch (err) {
      fail += 1
      console.log(
        JSON.stringify({
          action: 'rename_failed',
          folderKind: t.folderKind,
          folderGuid: t.folderGuid,
          documentId: t.documentId,
          from: t.from,
          to: t.to,
          error: err?.message || String(err),
        })
      )
    }
  })

  console.error(JSON.stringify({ stage: 'summary', mode: 'apply_from_cache', total: tasks.length, ok, fail }))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
