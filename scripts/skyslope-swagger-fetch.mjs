#!/usr/bin/env node
/**
 * Fetch the SkySlope swagger JSON with authenticated HMAC + Session
 * headers and write to tmp/. Browser-style WebFetch returns 403; this
 * script uses the same auth as our other Files API scripts.
 *
 *   node scripts/skyslope-swagger-fetch.mjs <out-path>
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

async function main() {
  const out = process.argv[2] || path.join(ROOT, 'tmp/skyslope-2026-05-16/swagger.json')
  const env = loadEnv()
  const session = await login(env)

  // Try several common swagger paths.
  const candidates = [
    `${BASE}/swagger/v1/swagger.json`,
    `${BASE}/api/docs/swagger/v1/swagger.json`,
    `${BASE}/api/swagger/v1/swagger.json`,
    `${BASE}/api-docs/v1/swagger.json`,
    `${BASE}/swagger.json`,
  ]
  for (const url of candidates) {
    const r = await skyslopeFetchWithRetry(url, {
      headers: {
        Session: session,
        timestamp: new Date().toISOString(),
        Accept: 'application/json',
      },
    })
    if (r.ok) {
      const text = await r.text()
      fs.mkdirSync(path.dirname(out), { recursive: true })
      fs.writeFileSync(out, text)
      console.log(JSON.stringify({ ok: true, source: url, bytes: text.length, written: out }))
      return
    }
    console.log(JSON.stringify({ tried: url, status: r.status }))
  }
  process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
