#!/usr/bin/env node
/**
 * Phase 8a for 712 SW 1st St (f50fe2a6): unassign every ARCHIVE-prefixed
 * doc from its current checklist activity so the activity rows are clean
 * before the UI Move pass (Phase 8b) shifts them into the Archive folder.
 */
import crypto from 'node:crypto'
import { skyslopeFetchWithRetry } from './skyslope-files-api.mjs'

const BASE = 'https://api-latest.skyslope.com'
const GUID = 'f50fe2a6-226c-4f81-8a59-9fc9a46ea5df'
const APPLY = process.argv.includes('--execute')

async function login() {
  const ts = new Date().toISOString()
  const env = process.env
  const hmac = crypto.createHmac('sha256', env.SKYSLOPE_ACCESS_SECRET.trim())
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

const session = await login()
const fr = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${GUID}`, { headers: apiHeaders(session) })
const activities = (await fr.json()).value?.sale?.checklist?.activities || []
console.log(`Activities: ${activities.length}\n`)

let attempted = 0, ok = 0, fail = 0
for (const a of activities) {
  for (const cd of (a.checklistDocs || [])) {
    const fn = cd.fileName || cd.docName || ''
    if (!fn.startsWith('ARCHIVE')) continue
    const docId = cd.id || cd.docId || cd.documentGuid
    if (!docId) continue
    attempted++
    console.log(`  ${APPLY ? 'UNASSIGN' : 'WOULD-UNASSIGN'} ${docId.slice(0,8)} "${fn.slice(0,60)}" from act ${a.activityId} "${(a.activityName||'').trim()}"`)
    if (!APPLY) continue
    const r = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${GUID}/checklist-items/${a.activityId}/unassign`, {
      method: 'POST',
      headers: apiHeaders(session),
      body: JSON.stringify({ documentGuid: docId }),
    })
    if (r.ok) ok++
    else { fail++; console.log(`    HTTP ${r.status}: ${(await r.text()).slice(0,150)}`) }
  }
}
console.log(`\n${APPLY ? 'Unassigned' : 'Would-unassign'}: ${APPLY ? ok : attempted}  Failed: ${fail}`)
if (!APPLY) console.log(`[DRY] Use --execute to apply.`)
