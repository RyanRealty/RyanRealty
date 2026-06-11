#!/usr/bin/env node
/**
 * Dump the PUT /api/files/sales/{guid} request body schema in full,
 * resolving $refs. Also dump POST /api/files/listings/{guid}/convert-to-sale.
 * Goal: confirm whether `listingGuid` is settable on an existing sale.
 */
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(__dirname, '..')
const BASE = 'https://api-latest.skyslope.com'

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
  const r = await fetch(`${BASE}/auth/login`, {
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

await loadEnvLocal()
const session = await login()
const r = await fetch(`${BASE}/swagger/v1/swagger.json`, {
  headers: { Session: session, timestamp: new Date().toISOString() },
})
const swag = await r.json()

function resolveRef(ref) {
  const name = ref.replace(/^#\/components\/schemas\//, '')
  return swag.components.schemas[name]
}

function dumpSchema(label, schema, depth = 0) {
  if (!schema) return console.log(`${label}: (none)`)
  if (schema.$ref) {
    const name = schema.$ref.replace(/^.*\//, '')
    console.log(`${label}: $ref → ${name}`)
    return dumpSchema(`  ${name}`, resolveRef(schema.$ref), depth + 1)
  }
  console.log(`${label}: ${schema.type ?? 'object'}`)
  for (const [propName, prop] of Object.entries(schema.properties ?? {})) {
    const typ = prop.$ref
      ? `$ref ${prop.$ref.replace(/^.*\//, '')}`
      : prop.type ?? '(?)'
    const desc = prop.description ? ` // ${prop.description.replace(/\n/g, ' ').slice(0, 80)}` : ''
    console.log(`  ${propName.padEnd(28)} ${typ}${desc}`)
  }
}

console.log('=== PUT /api/files/sales/{guid} ===')
const putSale = swag.paths['/api/files/sales/{saleGuid}']?.put
const putSchema = putSale?.requestBody?.content?.['application/json']?.schema
dumpSchema('body', putSchema)

console.log('\n=== POST /api/files/listings/{listingGuid}/convert-to-sale ===')
const conv = swag.paths['/api/files/listings/{listingGuid}/convert-to-sale']?.post
const convSchema = conv?.requestBody?.content?.['application/json']?.schema
dumpSchema('body', convSchema)
console.log('\nresponses:')
for (const [code, def] of Object.entries(conv?.responses ?? {})) {
  console.log(`  ${code}: ${def.description ?? ''}`)
}

console.log('\n=== POST /api/files/sales (Create sale) ===')
const postSale = swag.paths['/api/files/sales']?.post
const postSchema = postSale?.requestBody?.content?.['application/json']?.schema
dumpSchema('body', postSchema)

console.log('\n=== Sale full DTO (response on GET) — looking for listingGuid + how it relates ===')
const getSale = swag.paths['/api/files/sales/{saleGuid}']?.get
const getResp = getSale?.responses?.['200']?.content?.['application/json']?.schema
dumpSchema('response', getResp)
