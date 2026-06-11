#!/usr/bin/env node
/**
 * Phase 7: PATCH 42 Bear St doc filenames to v5 canonical names.
 *
 * Body shape (locked 2026-05-24): JSON body `{ FileName: "..." }`.
 * Never use query-param form (HTTP 500).
 *
 * Sanitize on the fly to catch any embedded periods, en-dashes, etc.
 */
import fs from 'node:fs/promises'
import crypto from 'node:crypto'

const ROOT = '/Users/matthewryan/RyanRealty'
const GUID = '2b9046c3-25aa-4efd-b4b1-bd381d6f2a8d'
const BASE = 'https://api-latest.skyslope.com'

async function loadEnvLocal() {
  const txt = await fs.readFile(`${ROOT}/.env.local`, 'utf8')
  for (const raw of txt.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!m) continue
    let val = m[2]
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1)
    if (!(m[1] in process.env)) process.env[m[1]] = val
  }
}

async function login() {
  const ts = new Date().toISOString()
  const e = process.env
  const hmac = crypto.createHmac('sha256', e.SKYSLOPE_ACCESS_SECRET.trim())
    .update(`${e.SKYSLOPE_CLIENT_ID.trim()}:${e.SKYSLOPE_CLIENT_SECRET.trim()}:${ts}`)
    .digest('base64')
  const r = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `ss ${e.SKYSLOPE_ACCESS_KEY.trim()}:${hmac}`, Timestamp: ts },
    body: JSON.stringify({ ClientId: e.SKYSLOPE_CLIENT_ID.trim(), ClientSecret: e.SKYSLOPE_CLIENT_SECRET.trim() }),
  })
  if (!r.ok) throw new Error(`login HTTP ${r.status}`)
  return (await r.json()).Session
}

function sanitizeFilename(s) {
  return s
    .replace(/\./g, (m, i, str) => {
      // Preserve the LAST period (extension boundary)
      const lastDot = str.lastIndexOf('.')
      if (i === lastDot) return '.'
      return '-'
    })
    .replace(/–/g, '-')
    .replace(/—/g, '-')
    .replace(/…/g, ' etc')
    .replace(/&/g, ' and ')
    .replace(/[<>:"|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

await loadEnvLocal()
const session = await login()
console.log('✓ Authenticated\n')

const plan = JSON.parse(await fs.readFile(`${ROOT}/tmp/bear-st-phase0/v6-rename-plan.json`, 'utf8'))
const docsJson = JSON.parse(await fs.readFile(`${ROOT}/tmp/bear-st-phase0/documents.json`, 'utf8'))
const allDocs = docsJson.value?.documents || docsJson.documents || []
const docIdToCurrentFilename = {}
for (const d of allDocs) {
  const id = (d.id || d.docId || '').toLowerCase()
  if (id) docIdToCurrentFilename[id] = d.fileName || d.documentName
}

const log = []
let ok = 0, skipped = 0, failed = 0
for (const row of plan) {
  const docId = row.docId.toLowerCase()
  const currentName = docIdToCurrentFilename[docId] || row.currentName
  const proposed = sanitizeFilename(row.proposedName)

  if (currentName === proposed) {
    skipped++
    log.push({ docId, currentName, proposed, status: 'noop' })
    console.log(`SKIP ${row.shortId} (noop): ${currentName}`)
    continue
  }

  const url = `${BASE}/api/files/sales/${GUID}/documents/${docId}`
  const ts = new Date().toISOString()
  const r = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Session: session, timestamp: ts, Accept: 'application/json' },
    body: JSON.stringify({ FileName: proposed }),
  })
  const body = await r.text()
  if (r.ok) {
    ok++
    log.push({ docId, from: currentName, to: proposed, status: r.status })
    console.log(`✓ ${row.shortId} (${r.status}): ${currentName.substring(0, 40)} → ${proposed.substring(0, 60)}`)
  } else {
    failed++
    log.push({ docId, from: currentName, to: proposed, status: r.status, error: body.substring(0, 300) })
    console.log(`✗ ${row.shortId} (${r.status}): ${currentName.substring(0, 40)} → ${proposed.substring(0, 60)}`)
    console.log(`    Error: ${body.substring(0, 200)}`)
  }
}

await fs.writeFile(`${ROOT}/tmp/bear-st-phase0/patch-log.json`, JSON.stringify(log, null, 2))
console.log(`\nDone. OK=${ok} SKIP=${skipped} FAILED=${failed} (total ${plan.length})`)
if (failed > 0) process.exit(1)
