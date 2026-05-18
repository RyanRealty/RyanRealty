#!/usr/bin/env node
/**
 * Recover renames that failed in the prior apply pass.
 *
 * Reads a v2-apply-from-cache.jsonl `rename_failed` log. For each failure:
 *
 *   - "Unable to find document with guid"  → SkySlope pseudo-row (no real
 *     file). Cannot be renamed via this endpoint. Marked `skipped_pseudo`.
 *
 *   - "File Extension can not be changed"  → source file has a different
 *     extension than .pdf, but the suggested name forced .pdf. Rebuild the
 *     name preserving the source extension and re-PATCH.
 *
 *   - "File Name is invalid"                → typically a double-extension
 *     like ".jpg.pdf". Rebuild preserving source extension and re-PATCH.
 *
 *   - Anything else                         → emit as `skipped_unknown_error`
 *     for human review.
 *
 *   node scripts/skyslope-forms-recover-failed.mjs <v2-apply-from-cache.jsonl>
 *
 * Env:
 *   SKYSLOPE_APPLY_CONCURRENCY (default 4)
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
const CONCURRENCY = Math.min(
  8,
  Math.max(1, Number.parseInt(String(process.env.SKYSLOPE_APPLY_CONCURRENCY || '4'), 10) || 4)
)

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
      await fn(items[idx], idx)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()))
}

function rebuildNameWithExtension(toName, sourceFromName) {
  const ext = fileExtension(sourceFromName)
  // Strip whatever extension the cached .to had (it'll be .pdf from the bug)
  let stem = String(toName || '').replace(/\.[A-Za-z0-9]{1,8}$/, '')
  // The original v2 cached `to` value also contained the source extension as
  // a literal substring (e.g. "img xxx.png.pdf"). After we strip the trailing
  // ".pdf" we still have ".png" hanging on. Strip ANY common file extension
  // appearing right before what we already cut.
  stem = stem.replace(
    /\.(pdf|png|jpe?g|gif|zip|heic|tif{1,2}|bmp|webp|eml|htm|html|docx?|xlsx?|csv|txt|msg|rtf|csv|ppt|pptx|svg)$/i,
    ''
  )
  return ext ? `${stem}.${ext}` : stem
}

async function main() {
  const failLogPath = process.argv[2]
  if (!failLogPath) {
    console.error('usage: node skyslope-forms-recover-failed.mjs <v2-apply-from-cache.jsonl>')
    process.exit(2)
  }

  const env = loadEnvLocal(ENV_PATH)
  const session = await login(env)

  const lines = fs.readFileSync(failLogPath, 'utf8').split('\n').filter(Boolean)
  const failures = []
  for (const line of lines) {
    try {
      const j = JSON.parse(line)
      if (j.action === 'rename_failed') failures.push(j)
    } catch {
      /* skip */
    }
  }

  const recoverable = []
  const pseudo = []
  const unknown = []
  for (const f of failures) {
    const errStr = String((f.error?.errors?.[0]) || f.error || '')
    if (/Unable to find document with guid/i.test(errStr)) pseudo.push(f)
    else if (/File Extension can not be changed/i.test(errStr) || /File Name is invalid/i.test(errStr))
      recoverable.push(f)
    else unknown.push(f)
  }

  console.error(
    JSON.stringify({
      stage: 'classified',
      total: failures.length,
      recoverable: recoverable.length,
      pseudo: pseudo.length,
      unknown: unknown.length,
    })
  )

  // Emit pseudo + unknown to stdout for transparency, no PATCH.
  for (const p of pseudo) {
    console.log(JSON.stringify({ action: 'skipped_pseudo', from: p.from, to: p.to, documentId: p.documentId, folderGuid: p.folderGuid, address: p.address }))
  }
  for (const u of unknown) {
    console.log(JSON.stringify({ action: 'skipped_unknown_error', from: u.from, to: u.to, error: u.error, documentId: u.documentId, folderGuid: u.folderGuid }))
  }

  let ok = 0
  let fail = 0
  await mapPool(recoverable, CONCURRENCY, async (f) => {
    const newName = rebuildNameWithExtension(f.to, f.from)
    if (!newName) {
      fail += 1
      console.log(JSON.stringify({ action: 'recover_failed', reason: 'empty_new_name', from: f.from, to: f.to }))
      return
    }
    try {
      const res = await patch(session, f.folderKind, f.folderGuid, f.documentId, newName)
      if (res.ok) {
        ok += 1
        console.log(
          JSON.stringify({
            action: 'recovered',
            folderKind: f.folderKind,
            folderGuid: f.folderGuid,
            address: f.address,
            documentId: f.documentId,
            from: f.from,
            to: newName,
            httpStatus: res.status,
          })
        )
      } else {
        fail += 1
        console.log(
          JSON.stringify({
            action: 'recover_failed',
            folderKind: f.folderKind,
            folderGuid: f.folderGuid,
            documentId: f.documentId,
            from: f.from,
            to: newName,
            httpStatus: res.status,
            error: res.body,
          })
        )
      }
    } catch (err) {
      fail += 1
      console.log(
        JSON.stringify({
          action: 'recover_failed',
          folderGuid: f.folderGuid,
          documentId: f.documentId,
          from: f.from,
          to: newName,
          error: err?.message || String(err),
        })
      )
    }
  })

  console.error(
    JSON.stringify({
      stage: 'summary',
      pseudo: pseudo.length,
      recovered: ok,
      recover_failed: fail,
      unknown: unknown.length,
    })
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
