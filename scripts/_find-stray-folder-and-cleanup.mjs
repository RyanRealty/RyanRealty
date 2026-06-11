#!/usr/bin/env node
/**
 * Step 4 + Step 5 of the template cleanup playbook.
 *
 * Step 5: Find the 1 folder using checklistTypeId 1635390 (now "Residential — Standard (LEGACY)")
 *         and reassign it to checklistTypeId 1639421 ("Residential — Standard").
 *
 * Step 4: Cancel/delete the sandbox sale folder f2523076-523b-4f3c-802e-265e4fb5d573
 *
 * Usage: node --env-file=.env.local scripts/_find-stray-folder-and-cleanup.mjs [--execute]
 *        (default: dry-run; explore only)
 */
import crypto from 'node:crypto'
import { skyslopeFetchWithRetry } from './skyslope-files-api.mjs'

const BASE = 'https://api-latest.skyslope.com'
const SANDBOX_GUID = 'f2523076-523b-4f3c-802e-265e4fb5d573'
const OLD_CHECKLIST_ID = 1635390
const LEGACY_CHECKLIST_ID = 1635389 // Rural Residential Sale — renamed to On-Site Utilities, also worth flagging
const NEW_CHECKLIST_ID = 1639421
const DRY = !process.argv.includes('--execute')

async function login() {
  const ts = new Date().toISOString()
  const env = process.env
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
    body: JSON.stringify({ ClientId: env.SKYSLOPE_CLIENT_ID.trim(), ClientSecret: env.SKYSLOPE_CLIENT_SECRET.trim() }),
  })
  return (await r.json()).Session
}

function apiHeaders(session) {
  return { 'Content-Type': 'application/json', Session: session, timestamp: new Date().toISOString(), Accept: 'application/json' }
}

const session = await login()
console.log('Auth ok.\n')

// 1. Get all sales folders
const ts0 = Math.floor(Date.UTC(2020, 0, 1) / 1000)
const ts1 = Math.floor(Date.UTC(2030, 0, 1) / 1000)
const allSales = []
for (let page = 1; page <= 100; page++) {
  const u = `${BASE}/api/files/sales?pageNumber=${page}&earliestDate=${ts0}&latestDate=${ts1}`
  const r = await skyslopeFetchWithRetry(u, { headers: apiHeaders(session) })
  if (!r.ok) {
    console.log(`Page ${page}: HTTP ${r.status} — stopping.`)
    break
  }
  const body = await r.json()
  const rows = body.value?.sales || []
  if (rows.length === 0) break
  allSales.push(...rows)
  if (rows.length < 10) break
}
console.log(`Total sales: ${allSales.length}`)

// 2. For each sale, fetch detail to find checklistType (NAME, since API doesn't expose ID directly)
const LEGACY_NAME = 'Residential — Standard (LEGACY, do not use)'
const strays = []
const sandboxRow = allSales.find((s) => s.saleGuid === SANDBOX_GUID)

console.log(`\nFetching details for ${allSales.length} sales to identify checklist types...`)
let inspected = 0
const checklistCounts = {}
for (const s of allSales) {
  const dr = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${s.saleGuid}`, { headers: apiHeaders(session) })
  if (!dr.ok) continue
  const detail = await dr.json()
  const name = detail.value?.sale?.checklistType
  if (name) {
    checklistCounts[name] = (checklistCounts[name] || 0) + 1
    if (name === LEGACY_NAME) {
      strays.push({ ...s, checklistTypeName: name })
    }
  }
  inspected++
  if (inspected % 10 === 0) process.stderr.write(`.`)
}
console.log(`\nInspected ${inspected} sale details.\n`)

console.log('ChecklistTypeId distribution:')
for (const [k, v] of Object.entries(checklistCounts).sort((a, b) => Number(a[0]) - Number(b[0]))) {
  console.log(`  ${k}: ${v} folder(s)`)
}

console.log(`\nStray folders using OLD_CHECKLIST_ID ${OLD_CHECKLIST_ID}: ${strays.length}`)
for (const s of strays) {
  console.log(`  ${s.saleGuid}  ${s.propertyAddress}  status=${s.status}`)
}

// Also surface ANY folders still showing the pre-rename names — these need investigation
const oldNames = ['Standard Residential Sale', 'Rural Residential Sale']
const mystery = []
for (const s of allSales) {
  const dr = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${s.saleGuid}`, { headers: apiHeaders(session) })
  if (!dr.ok) continue
  const detail = await dr.json()
  const name = detail.value?.sale?.checklistType
  if (oldNames.includes(name)) {
    mystery.push({ ...s, checklistTypeName: name })
  }
}
console.log(`\nFolders still showing PRE-RENAME names (rename didn't propagate): ${mystery.length}`)
for (const s of mystery) {
  console.log(`  ${s.saleGuid}  ${s.propertyAddress}  status=${s.status}  name="${s.checklistTypeName}"`)
}

if (sandboxRow) {
  console.log(`\nSandbox folder confirmed: ${sandboxRow.saleGuid}  ${sandboxRow.propertyAddress}  status=${sandboxRow.status}`)
}

if (DRY) {
  console.log('\n[DRY RUN] No mutations. Use --execute to apply.')
  process.exit(0)
}

console.log('\n=== EXECUTING ===\n')

// Reassign strays
for (const s of strays) {
  console.log(`REASSIGN ${s.saleGuid}: ChecklistTypeId ${OLD_CHECKLIST_ID} -> ${NEW_CHECKLIST_ID}`)
  const r = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${s.saleGuid}/checklistType`, {
    method: 'PUT',
    headers: apiHeaders(session),
    body: JSON.stringify({ checklistTypeId: NEW_CHECKLIST_ID }),
  })
  console.log(`  result: HTTP ${r.status}`)
  if (!r.ok) console.log(`  body: ${(await r.text()).substring(0, 300)}`)
}

// Delete sandbox
if (sandboxRow) {
  console.log(`\nDELETE sandbox folder ${SANDBOX_GUID}`)
  const r = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${SANDBOX_GUID}`, {
    method: 'DELETE',
    headers: apiHeaders(session),
  })
  console.log(`  result: HTTP ${r.status}`)
  if (!r.ok) console.log(`  body: ${(await r.text()).substring(0, 300)}`)
}
