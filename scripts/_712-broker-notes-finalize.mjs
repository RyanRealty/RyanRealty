#!/usr/bin/env node
/**
 * Phase 10 finalize for 712: polls for the 2 Broker Notes PDFs to
 * ingest (up to 20 min), then PATCHes filename to v5 + assigns to the
 * Broker Notes activity. Idempotent — safe to re-run if interrupted.
 *
 * The original --send script's polling window (3 min) wasn't long
 * enough; this is the longer-poll completion pass.
 */
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import { skyslopeFetchWithRetry } from './skyslope-files-api.mjs'

const BASE = 'https://api-latest.skyslope.com'
const SALE_GUID = 'f50fe2a6-226c-4f81-8a59-9fc9a46ea5df'
const MANIFEST_PATH = 'tmp/712-broker-notes/manifest.json'
const MAX_POLL_MIN = 5

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

const manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf8'))
const session = await login()
const fr = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${SALE_GUID}`, { headers: apiHeaders(session) })
const sale = (await fr.json()).value?.sale
const brokerNotesAct = (sale.checklist?.activities || []).find((a) => /broker notes/i.test(a.activityName || ''))
if (!brokerNotesAct) throw new Error('No Broker Notes activity')
console.log(`Broker Notes activityId: ${brokerNotesAct.activityId}`)

const remaining = manifest.map((m) => ({ ...m, done: false }))
const startTime = Date.now()

while (remaining.some((r) => !r.done) && Date.now() - startTime < MAX_POLL_MIN * 60_000) {
  const dr = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${SALE_GUID}/documents`, { headers: apiHeaders(session) })
  const docs = (await dr.json()).value?.documents || []
  for (const entry of remaining) {
    if (entry.done) continue
    const stem = entry.baseName
    // SkySlope ingest converts spaces to underscores AND appends a random
    // "_NNN" suffix. So baseName "04022024AB_X_Broker Notes - Transaction Summary"
    // becomes filename "04022024AB_X_Broker_Notes_-_Transaction_Summary_715.pdf".
    // Build regex: split on runs of [space/_/-], escape each word, rejoin with
    // a flexible separator class.
    const stemNorm = stem
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((w) => w.replace(/[[\]{}()*+?.,\\^$|#]/g, '\\$&'))
      .join('[\\s_-]+')
    const matchRe = new RegExp(`^${stemNorm}(_\\d{1,4})?\\.pdf$`, 'i')
    const archiveRe = new RegExp(`^ARCHIVE[\\s_-]+${stemNorm}`, 'i')
    const matches = docs.filter((d) => matchRe.test(d.fileName || '') || archiveRe.test(d.fileName || ''))
      .sort((a, b) => (b.uploadDate || '').localeCompare(a.uploadDate || ''))
    if (!matches.length) continue
    const winner = matches[0] // newest upload wins
    const losers = matches.slice(1)
    const newDocId = winner.docId || winner.id
    console.log(`\n[INGESTED] ${entry.saleNumber}: docId=${newDocId.slice(0,8)} fileName="${winner.fileName}" uploaded=${winner.uploadDate}`)
    if (losers.length) {
      console.log(`  ${losers.length} earlier version(s) found — archiving as superseded:`)
      for (const old of losers) {
        const oldId = old.docId || old.id
        const oldAr = `ARCHIVE - ${entry.baseName} - superseded.pdf`
        const upr = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${SALE_GUID}/documents/${oldId}`, {
          method: 'PATCH', headers: apiHeaders(session),
          body: JSON.stringify({ FileName: oldAr }),
        })
        console.log(`    PATCH ${oldId.slice(0,8)} → "${oldAr}" HTTP ${upr.status}`)
        // Unassign from Broker Notes activity if it was assigned
        const una = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${SALE_GUID}/checklist-items/${brokerNotesAct.activityId}/unassign`, {
          method: 'POST', headers: apiHeaders(session),
          body: JSON.stringify({ documentGuid: oldId }),
        })
        console.log(`    Unassign ${oldId.slice(0,8)} HTTP ${una.status}`)
      }
    }
    const targetName = `${entry.baseName}.pdf`
    if (winner.fileName !== targetName) {
      const pr = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${SALE_GUID}/documents/${newDocId}`, {
        method: 'PATCH',
        headers: apiHeaders(session),
        body: JSON.stringify({ FileName: targetName }),
      })
      console.log(`  PATCH winner → "${targetName}"  HTTP ${pr.status}`)
    }
    const ar = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${SALE_GUID}/checklist-items/${brokerNotesAct.activityId}`, {
      method: 'POST',
      headers: apiHeaders(session),
      body: JSON.stringify({ documentGuid: newDocId }),
    })
    console.log(`  Assign winner to Broker Notes activity  HTTP ${ar.status}`)
    entry.done = true
    entry.finalDocId = newDocId
  }
  const stillWaiting = remaining.filter((r) => !r.done)
  if (stillWaiting.length === 0) break
  process.stdout.write(`\n[${Math.round((Date.now() - startTime)/1000)}s] still waiting on: ${stillWaiting.map((r) => r.saleNumber).join(', ')} — re-poll in 30s`)
  await new Promise((res) => setTimeout(res, 30_000))
}

const undone = remaining.filter((r) => !r.done)
if (undone.length === 0) console.log(`\n\nALL DONE. Both Broker Notes attached.`)
else console.log(`\n\nTIMEOUT after ${MAX_POLL_MIN} min. Still pending: ${undone.map((r) => r.saleNumber).join(', ')}`)
