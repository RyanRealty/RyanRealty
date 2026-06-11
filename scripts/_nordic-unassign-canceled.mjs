#!/usr/bin/env node
/**
 * Unassign ARCHIVE-prefixed docs from checklist activities on the 2 Canceled
 * Nordic folders. Same logic as the Closed finalize, without the Broker Notes
 * regeneration step.
 */
import crypto from 'node:crypto'
import { skyslopeFetchWithRetry } from './skyslope-files-api.mjs'

const BASE = 'https://api-latest.skyslope.com'
const FOLDERS = [
  { guid: '6be4810f-eda4-433d-ad6f-f27b80a1c6e0', label: 'Canceled-A' },
  { guid: '0ec95d31-1fed-4519-a114-e967513eac33', label: 'Canceled-B' },
]
const APPLY = process.argv.includes('--execute')

async function login() {
  const ts = new Date().toISOString()
  const env = process.env
  const hmac = crypto.createHmac('sha256', env.SKYSLOPE_ACCESS_SECRET.trim()).update(`${env.SKYSLOPE_CLIENT_ID.trim()}:${env.SKYSLOPE_CLIENT_SECRET.trim()}:${ts}`).digest('base64')
  const r = await skyslopeFetchWithRetry(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `ss ${env.SKYSLOPE_ACCESS_KEY.trim()}:${hmac}`, Timestamp: ts },
    body: JSON.stringify({ ClientId: env.SKYSLOPE_CLIENT_ID.trim(), ClientSecret: env.SKYSLOPE_CLIENT_SECRET.trim() }),
  })
  return (await r.json()).Session
}
function apiHeaders(session) { return { 'Content-Type': 'application/json', Session: session, timestamp: new Date().toISOString(), Accept: 'application/json' } }

const session = await login()
let total = 0, ok = 0, fail = 0

for (const folder of FOLDERS) {
  console.log(`\n=== ${folder.label} (${folder.guid.slice(0,8)}) ===`)
  const fr = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${folder.guid}`, { headers: apiHeaders(session) })
  const activities = (await fr.json()).value?.sale?.checklist?.activities || []
  for (const a of activities) {
    const attached = a.checklistDocs || []
    for (const d of attached) {
      const fn = d.fileName || d.docName || ''
      const docId = d.id || d.docId || d.documentGuid
      if (!docId || !fn.startsWith('ARCHIVE')) continue
      total++
      console.log(`  unassign ${docId.slice(0,8)} "${fn.substring(0,70)}" from "${(a.activityName||'').trim()}"`)
      if (!APPLY) continue
      const r = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${folder.guid}/checklist-items/${a.activityId}/unassign`, {
        method: 'POST', headers: apiHeaders(session), body: JSON.stringify({ documentGuid: docId }),
      })
      if (r.ok) ok++
      else { fail++; console.log(`    HTTP ${r.status}`) }
    }
  }
}

console.log(`\n=== SUMMARY ===`)
console.log(`Attempted: ${total}`)
console.log(`OK: ${ok}`)
console.log(`Failed: ${fail}`)
if (!APPLY) console.log('[DRY RUN] Use --execute to apply.')
