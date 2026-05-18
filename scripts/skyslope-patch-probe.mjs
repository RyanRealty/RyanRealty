#!/usr/bin/env node
/**
 * Probe SkySlope PATCH /api/files/listings/{guid}/documents/{docId}?FileName=
 * with a few encoding variants to isolate the 500 cause we saw on the v2
 * apply pass. Targets ONE specific doc that we know exists in the dry-run
 * output. Reverts back to the original filename at the end so SkySlope state
 * matches before/after.
 *
 *   node scripts/skyslope-patch-probe.mjs
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

// Sample known from dry-run: 5663 SW Impala Avenue listing.
const FOLDER_GUID = '369a7b85-365d-4ed8-abdd-45b7a862e5b4'
const DOC_ID = '247f7077-34ba-4771-853b-bc7d199d8010'
const ORIGINAL_NAME = 'ORE Residential Input - ODS.pdf'

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

async function patch(session, fname, encodingMode) {
  // Variants:
  //  A: URLSearchParams (spaces → +)
  //  B: encodeURIComponent (spaces → %20)
  //  C: raw filename in query (no encoding — invalid HTTP, but worth seeing)
  //  D: JSON body { FileName }
  let url
  let init
  if (encodingMode === 'A') {
    const q = new URLSearchParams({ FileName: fname })
    url = `${BASE}/api/files/listings/${FOLDER_GUID}/documents/${DOC_ID}?${q}`
    init = { method: 'PATCH', headers: apiHeaders(session) }
  } else if (encodingMode === 'B') {
    url = `${BASE}/api/files/listings/${FOLDER_GUID}/documents/${DOC_ID}?FileName=${encodeURIComponent(fname)}`
    init = { method: 'PATCH', headers: apiHeaders(session) }
  } else if (encodingMode === 'C') {
    url = `${BASE}/api/files/listings/${FOLDER_GUID}/documents/${DOC_ID}?FileName=${fname}`
    init = { method: 'PATCH', headers: apiHeaders(session) }
  } else if (encodingMode === 'D') {
    url = `${BASE}/api/files/listings/${FOLDER_GUID}/documents/${DOC_ID}`
    init = {
      method: 'PATCH',
      headers: apiHeaders(session),
      body: JSON.stringify({ FileName: fname }),
    }
  } else throw new Error('bad mode')

  const r = await skyslopeFetchWithRetry(url, init)
  const text = await r.text()
  return { mode: encodingMode, name: fname, status: r.status, body: text.slice(0, 200) }
}

async function readDoc(session) {
  const r = await skyslopeFetchWithRetry(
    `${BASE}/api/files/listings/${FOLDER_GUID}/documents`,
    { headers: apiHeaders(session) }
  )
  const j = await r.json()
  const docs = j?.value?.documents ?? []
  return docs.find((d) => d.id === DOC_ID)
}

async function main() {
  const env = loadEnvLocal(ENV_PATH)
  const session = await login(env)
  console.log('--- before ---')
  let cur = await readDoc(session)
  console.log('current fileName:', cur?.fileName)

  // Test sequence: try each encoding with the spaces filename, then with
  // underscores (known to work). End by reverting to original.
  const testNames = [
    { label: 'spaces', name: '2026-05-11 001 220221088 ORE Residential Input - ODS.pdf' },
    { label: 'underscores', name: '2026-05-11_001_220221088_ORE_Residential_Input_-_ODS.pdf' },
    { label: 'dashes', name: '2026-05-11-001-220221088-ORE-Residential-Input-ODS.pdf' },
  ]

  for (const t of testNames) {
    for (const mode of ['A', 'B', 'D']) {
      const r = await patch(session, t.name, mode)
      console.log(JSON.stringify({ label: t.label, ...r }))
      await new Promise((r) => setTimeout(r, 400))
    }
  }

  // Revert.
  console.log('--- reverting to original ---')
  const rev = await patch(session, ORIGINAL_NAME, 'A')
  console.log(JSON.stringify({ label: 'revert', ...rev }))

  console.log('--- after ---')
  cur = await readDoc(session)
  console.log('current fileName:', cur?.fileName)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
