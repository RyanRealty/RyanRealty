#!/usr/bin/env node
import fs from 'fs'
import crypto from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'
import { skyslopeFetchWithRetry } from './skyslope-files-api.mjs'

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

async function main() {
  const env = loadEnvLocal(ENV_PATH)
  const session = await login(env)

  // 20702 Beaumont Drive listing folder — many fails came from here.
  const FOLDER = 'ae17cded-5593-40d2-84b9-2102422fca13'
  const r = await skyslopeFetchWithRetry(
    `${BASE}/api/files/listings/${FOLDER}/documents`,
    { headers: apiHeaders(session) }
  )
  const j = await r.json()
  const docs = j?.value?.documents ?? []
  console.log(`folder ae17cded has ${docs.length} docs`)
  console.log(`first 2 raw docs:`)
  for (const d of docs.slice(0, 2)) {
    console.log(JSON.stringify(d, null, 2).slice(0, 1500))
    console.log('---')
  }
  // Find a failed-pattern doc.
  const failed = docs.find((d) => d.id === 'ed735d32-8dac-ea11-811c-eed541a21c59')
  if (failed) {
    console.log('FOUND the failed-pattern doc — full record:')
    console.log(JSON.stringify(failed, null, 2))
  } else {
    console.log('Did not find docId ed735d32... in current folder listing — but here are all keys present on first doc:')
    if (docs.length) console.log(Object.keys(docs[0]))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
