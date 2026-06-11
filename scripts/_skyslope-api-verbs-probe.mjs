#!/usr/bin/env node
/**
 * Probe SkySlope Files API for create/link verbs:
 *  - OPTIONS /api/files/listings
 *  - OPTIONS /api/files/sales/{guid}
 *  - PUT /api/files/sales/{guid} with {listingGuid} (probe-only, read-back; no mutation if pre-condition not met)
 *  - Inspect the swagger for POST /api/files/listings + listingGuid in PUT body
 */
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { skyslopeFetchWithRetry } from './skyslope-files-api.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(__dirname, '..')
const BASE = 'https://api-latest.skyslope.com'
const SALE_GUID = 'f50fe2a6-226c-4f81-8a59-9fc9a46ea5df'

async function loadEnvLocal() {
  const txt = await fs.readFile(path.join(REPO, '.env.local'), 'utf8')
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
  const hmac = crypto
    .createHmac('sha256', e.SKYSLOPE_ACCESS_SECRET.trim())
    .update(`${e.SKYSLOPE_CLIENT_ID.trim()}:${e.SKYSLOPE_CLIENT_SECRET.trim()}:${ts}`)
    .digest('base64')
  const r = await skyslopeFetchWithRetry(`${BASE}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `ss ${e.SKYSLOPE_ACCESS_KEY.trim()}:${hmac}`,
      Timestamp: ts,
    },
    body: JSON.stringify({
      ClientId: e.SKYSLOPE_CLIENT_ID.trim(),
      ClientSecret: e.SKYSLOPE_CLIENT_SECRET.trim(),
    }),
  })
  return (await r.json()).Session
}

function H(session) {
  return {
    'Content-Type': 'application/json',
    Session: session,
    timestamp: new Date().toISOString(),
    Accept: 'application/json',
  }
}

await loadEnvLocal()
const session = await login()
console.log('✓ Auth\n')

async function probe(method, url, headerExtras = {}) {
  const headers = { ...H(session), ...headerExtras }
  console.log(`${method} ${url.replace(BASE, '')}`)
  const r = await fetch(url, { method, headers })
  const allow = r.headers.get('allow')
  console.log(`  HTTP ${r.status}  allow=${allow ?? '(none)'}`)
  return r
}

console.log('--- OPTIONS endpoints ---')
await probe('OPTIONS', `${BASE}/api/files/listings`)
await probe('OPTIONS', `${BASE}/api/files/sales`)
await probe('OPTIONS', `${BASE}/api/files/sales/${SALE_GUID}`)
await probe('OPTIONS', `${BASE}/api/files/sales/${SALE_GUID}/checklistType`)
await probe('OPTIONS', `${BASE}/api/files/listings/00000000-0000-0000-0000-000000000000`)

console.log('\n--- Fetch swagger for POST listings + listingGuid ---')
const swag = await fetch(`${BASE}/swagger/v1/swagger.json`, { headers: H(session) })
const swagBody = await swag.json()
const paths = swagBody.paths ?? {}
const listingPaths = Object.entries(paths).filter(([p]) => /\/api\/files\/listings/.test(p))
for (const [p, ops] of listingPaths) {
  for (const [verb, def] of Object.entries(ops)) {
    if (verb.startsWith('x-')) continue
    console.log(`  ${verb.toUpperCase().padEnd(7)} ${p}  ${def.summary ?? def.operationId ?? ''}`)
  }
}
console.log()
const salePaths = Object.entries(paths).filter(([p]) => /\/api\/files\/sales/.test(p))
for (const [p, ops] of salePaths) {
  for (const [verb, def] of Object.entries(ops)) {
    if (verb.startsWith('x-')) continue
    console.log(`  ${verb.toUpperCase().padEnd(7)} ${p}  ${def.summary ?? def.operationId ?? ''}`)
  }
}

// Inspect the PUT /sales/{guid} body schema
console.log('\n--- PUT /api/files/sales/{guid} body schema ---')
const putSale = paths['/api/files/sales/{guid}']?.put
if (putSale) {
  const req = putSale.requestBody?.content?.['application/json']?.schema
  console.log(JSON.stringify(req, null, 2)?.slice(0, 2000))
  // Resolve $ref if present
  if (req?.$ref) {
    const refName = req.$ref.replace(/^.*\//, '')
    const schema = swagBody.components?.schemas?.[refName]
    console.log(`\nResolved $ref ${refName}:`)
    console.log(JSON.stringify(schema?.properties ?? schema, null, 2)?.slice(0, 3000))
  }
}

// Inspect the POST /listings body schema if it exists
console.log('\n--- POST /api/files/listings body schema (if exists) ---')
const postListings = paths['/api/files/listings']?.post
if (postListings) {
  const req = postListings.requestBody?.content?.['application/json']?.schema
  if (req?.$ref) {
    const refName = req.$ref.replace(/^.*\//, '')
    const schema = swagBody.components?.schemas?.[refName]
    console.log(`$ref ${refName} props:`)
    console.log(JSON.stringify(schema?.properties ?? schema, null, 2)?.slice(0, 3000))
  } else {
    console.log(JSON.stringify(req, null, 2)?.slice(0, 2000))
  }
} else {
  console.log('  (no POST endpoint for /api/files/listings in swagger)')
}
