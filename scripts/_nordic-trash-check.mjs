#!/usr/bin/env node
/**
 * Quick API-only check: across all 3 Nordic transactions, for every doc
 * the API knows about, report which ones are assigned to any checklist
 * activity. Also show all unique docs not assigned anywhere (those are
 * candidates for being in the Trash UI folder).
 */
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import { skyslopeFetchWithRetry } from './skyslope-files-api.mjs'

const BASE = 'https://api-latest.skyslope.com'
const NORDIC = [
  { label: 'Canceled-B (seller)', guid: '0ec95d31-1fed-4519-a114-e967513eac33' },
  { label: 'Canceled-A (buyer)', guid: '6be4810f-eda4-433d-ad6f-f27b80a1c6e0' },
  { label: 'Closed', guid: 'ce3c30de-1b10-4946-bf06-6dbad8e1d53d' },
]

async function loadEnv() {
  const raw = await fs.readFile('.env.local', 'utf8').catch(() => '')
  for (const line of raw.split('\n')) {
    const t = line.trim(); if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('='); if (eq < 0) continue
    const k = t.slice(0, eq).trim()
    let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"'))) v = v.slice(1, -1)
    if (process.env[k] === undefined) process.env[k] = v
  }
}
async function login() {
  const ts = new Date().toISOString()
  const env = process.env
  const hmac = crypto.createHmac('sha256', env.SKYSLOPE_ACCESS_SECRET.trim())
    .update(`${env.SKYSLOPE_CLIENT_ID.trim()}:${env.SKYSLOPE_CLIENT_SECRET.trim()}:${ts}`).digest('base64')
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

await loadEnv()
const session = await login()

for (const txn of NORDIC) {
  console.log(`\n=== ${txn.label} ===`)
  const fr = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${txn.guid}`, { headers: apiHeaders(session) })
  const sale = (await fr.json()).value?.sale
  const activities = sale?.checklist?.activities || []

  // Build docId → activity assignments (CASE-NORMALIZED to lowercase)
  const assigned = new Map()
  for (const a of activities) {
    for (const cd of (a.checklistDocs || [])) {
      const raw = cd.id || cd.docId || cd.documentGuid
      if (!raw) continue
      const docId = raw.toLowerCase()
      if (!assigned.has(docId)) assigned.set(docId, [])
      assigned.get(docId).push({ activityId: a.activityId, activityName: (a.activityName || '').trim(), status: a.status })
    }
  }

  const dr = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${txn.guid}/documents`, { headers: apiHeaders(session) })
  const docs = (await dr.json()).value?.documents || []

  // Categorize
  const assignedDocs = []
  const unassignedDocs = []
  for (const d of docs) {
    const docId = (d.docId || d.id || '').toLowerCase()
    if (assigned.has(docId)) assignedDocs.push({ ...d, _activities: assigned.get(docId) })
    else unassignedDocs.push(d)
  }
  console.log(`  Total docs: ${docs.length}`)
  console.log(`  Assigned to checklist activity: ${assignedDocs.length}`)
  console.log(`  Unassigned: ${unassignedDocs.length}`)

  // For each filename containing "Repair Addendum" or "Contingent Right" (Matt's Trash docs),
  // print the assignment state
  const focusPatterns = [
    /repair addendum/i,
    /contingent right/i,
  ]
  console.log(`\n  Focus (Repair Addendum + Contingent Right matches):`)
  for (const d of docs) {
    const fn = d.fileName || d.name || ''
    if (!focusPatterns.some((p) => p.test(fn))) continue
    const docId = (d.docId || d.id || '').toLowerCase()
    const acts = assigned.get(docId)
    console.log(`    ${docId.slice(0, 8)}  "${fn}"`)
    if (acts) {
      for (const a of acts) console.log(`      → ${a.activityId} "${a.activityName}" (${a.status})`)
    } else {
      console.log(`      (unassigned)`)
    }
  }
}
