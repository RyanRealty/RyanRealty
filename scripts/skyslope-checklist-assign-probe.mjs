#!/usr/bin/env node
/**
 * Probe the checklist assignment endpoint on ONE doc-to-activity pair.
 *
 * Pulls the 64350 Old Bend Redmond Hwy LISTING folder, finds the 042
 * pamphlet activity, finds the matching uploaded doc, and POSTs to
 * assign it. Prints status + response.
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
    headers: { 'Content-Type': 'application/json', Authorization: `ss ${env.SKYSLOPE_ACCESS_KEY.trim()}:${hmac}`, Timestamp: ts },
    body: JSON.stringify({ ClientId: env.SKYSLOPE_CLIENT_ID.trim(), ClientSecret: env.SKYSLOPE_CLIENT_SECRET.trim() }),
  })
  return (await r.json()).Session
}

function apiHeaders(session) {
  return { 'Content-Type': 'application/json', Session: session, timestamp: new Date().toISOString(), Accept: 'application/json' }
}

async function main() {
  const env = loadEnv()
  const session = await login(env)
  const LISTING_GUID = 'a28589fc-3915-4a92-86e6-c08355147398' // 64350 Old Bend Redmond Hwy

  // Fetch listing detail.
  const r1 = await skyslopeFetchWithRetry(`${BASE}/api/files/listings/${LISTING_GUID}`, { headers: apiHeaders(session) })
  const listing = (await r1.json())?.value?.listing
  console.log('listing checklist activities:')
  for (const a of listing?.checklist?.activities || []) {
    console.log(`  activityId=${a.activityId}  status=${a.status}  docs=${(a.checklistDocs||[]).length}  ${a.typeName} :: ${a.activityName}`)
  }

  // Find 042 pamphlet activity.
  const pamphlet = (listing?.checklist?.activities || []).find((a) => /Initial Agency Disclosure/i.test(a.activityName || ''))
  console.log('\nfound pamphlet activity:', pamphlet ? { activityId: pamphlet.activityId, name: pamphlet.activityName, currentDocs: (pamphlet.checklistDocs || []).map((d) => d.fileName) } : null)
  if (!pamphlet) return

  // Find doc in this folder's documents.
  const r2 = await skyslopeFetchWithRetry(`${BASE}/api/files/listings/${LISTING_GUID}/documents`, { headers: apiHeaders(session) })
  const docs = (await r2.json())?.value?.documents || []
  const doc042 = docs.find((d) => /Initial Agency Disclosure Pamphlet|042 OREF|042-OREF/i.test(d.fileName || ''))
  console.log('found 042 doc:', doc042 ? { id: doc042.id, fileName: doc042.fileName } : null)
  if (!doc042) return

  // Check if already attached.
  const already = (pamphlet.checklistDocs || []).some((cd) => cd.id === doc042.id)
  console.log('already attached?', already)
  if (already) {
    console.log('Doc already on this activity — skipping POST. Probe inconclusive; try a different pair.')
    return
  }

  // POST to assign.
  console.log('\nPOSTing assignment...')
  const r3 = await skyslopeFetchWithRetry(
    `${BASE}/api/files/listings/${LISTING_GUID}/checklist-items/${pamphlet.activityId}`,
    {
      method: 'POST',
      headers: apiHeaders(session),
      body: JSON.stringify({ documentGuid: doc042.id }),
    }
  )
  const text = await r3.text()
  console.log('status:', r3.status)
  console.log('body:', text.slice(0, 500))

  // Verify.
  const r4 = await skyslopeFetchWithRetry(`${BASE}/api/files/listings/${LISTING_GUID}`, { headers: apiHeaders(session) })
  const listing2 = (await r4.json())?.value?.listing
  const pamphlet2 = (listing2?.checklist?.activities || []).find((a) => a.activityId === pamphlet.activityId)
  console.log('\nafter POST — pamphlet docs:', (pamphlet2?.checklistDocs || []).map((d) => d.fileName))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
