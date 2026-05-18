#!/usr/bin/env node
/**
 * After assignment, walk every folder's checklist and surface:
 *
 *   - Required activities with 0 attached docs (the "missing docs" list)
 *   - Required activities with docs that aren't fully executed (the
 *     "needs the signed copy" list — feed this to Gmail search)
 *   - Optional activities with docs (just informational)
 *
 * Emits a Markdown report + JSON for downstream Gmail search.
 *
 *   node scripts/skyslope-checklist-missing-report.mjs <out-md> [--json out.json]
 */
import fs from 'fs'
import crypto from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  fetchSkyslopeFileFolderRows,
  skyslopeFetchWithRetry,
} from './skyslope-files-api.mjs'

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

function apiHeaders(session) {
  return {
    'Content-Type': 'application/json',
    Session: session,
    timestamp: new Date().toISOString(),
    Accept: 'application/json',
  }
}

async function fetchDetail(session, kind, guid) {
  const pathSeg = kind === 'listing' ? 'listings' : 'sales'
  const r = await skyslopeFetchWithRetry(`${BASE}/api/files/${pathSeg}/${guid}`, {
    headers: apiHeaders(session),
  })
  if (!r.ok) return null
  return (await r.json())?.value?.[kind] || null
}

function safeAddress(prop) {
  if (!prop) return ''
  return [
    [prop.streetNumber, prop.streetAddress, prop.unit].filter(Boolean).join(' ').trim(),
    [prop.city, prop.state, prop.zip].filter(Boolean).join(', '),
  ]
    .filter(Boolean)
    .join(', ')
    .trim()
}

function partyNames(arr) {
  if (!Array.isArray(arr)) return []
  return arr
    .map((p) => [p.firstName, p.lastName].filter(Boolean).join(' ').trim() || p.fullName || p.company || '')
    .filter(Boolean)
}

async function main() {
  const args = process.argv.slice(2)
  const outMd = args[0] || path.join(ROOT, 'tmp/skyslope-2026-05-16/checklist-missing.md')
  const jsonIdx = args.indexOf('--json')
  const outJson = jsonIdx >= 0 ? args[jsonIdx + 1] : ''

  const env = loadEnv()
  const session = await login(env)
  const listings = await fetchSkyslopeFileFolderRows(session, BASE, 'listings', () => apiHeaders(session), false)
  const sales = await fetchSkyslopeFileFolderRows(session, BASE, 'sales', () => apiHeaders(session), false)

  const folders = []
  for (const L of listings) {
    const d = await fetchDetail(session, 'listing', L.listingGuid)
    if (!d) continue
    folders.push({
      kind: 'listing',
      guid: L.listingGuid,
      address: L.propertyAddress || safeAddress(d.property),
      mls: d.mlsNumber || L.mlsNumber || '',
      status: d.status || L.status || '',
      sellers: partyNames(d.sellers),
      buyers: partyNames(d.buyers),
      activities: d.checklist?.activities || [],
    })
  }
  for (const S of sales) {
    const d = await fetchDetail(session, 'sale', S.saleGuid)
    if (!d) continue
    folders.push({
      kind: 'sale',
      guid: S.saleGuid,
      address: S.propertyAddress || safeAddress(d.property),
      mls: d.mlsNumber || S.mlsNumber || '',
      status: d.status || S.status || '',
      sellers: partyNames(d.sellers),
      buyers: partyNames(d.buyers),
      activities: d.checklist?.activities || [],
    })
  }

  const md = []
  const json = { generated_at: new Date().toISOString(), folders: [] }

  md.push('# SkySlope checklist — missing-docs report')
  md.push('')
  md.push(`Generated (UTC): ${new Date().toISOString()}`)
  md.push('')
  md.push(`Inventories every Required checklist activity across **${folders.length}** folders. Activities with 0 attached documents are flagged — those are the docs your TC needs to find (or your Gmail to search).`)
  md.push('')

  let totalRequiredEmpty = 0
  let totalActivities = 0
  const allMissing = []

  for (const f of folders) {
    const required = f.activities.filter((a) => a.status === 'Required')
    const requiredEmpty = required.filter((a) => (a.checklistDocs || []).length === 0)
    const requiredFilled = required.filter((a) => (a.checklistDocs || []).length > 0)
    const optionalFilled = f.activities.filter((a) => a.status !== 'Required' && (a.checklistDocs || []).length > 0)

    totalActivities += f.activities.length
    totalRequiredEmpty += requiredEmpty.length

    const folderJson = {
      kind: f.kind,
      guid: f.guid,
      address: f.address,
      mls: f.mls,
      status: f.status,
      sellers: f.sellers,
      buyers: f.buyers,
      activities_total: f.activities.length,
      required_total: required.length,
      required_filled: requiredFilled.length,
      required_empty: requiredEmpty.length,
      optional_filled: optionalFilled.length,
      missing_activities: requiredEmpty.map((a) => ({ activityId: a.activityId, activityName: a.activityName, typeName: a.typeName, status: a.status })),
    }
    json.folders.push(folderJson)

    if (requiredEmpty.length === 0) continue

    md.push(`## ${f.kind} · ${f.address || '(blank address)'}`)
    md.push('')
    md.push(`- GUID: \`${f.guid}\`  MLS \`${f.mls || '—'}\`  status **${f.status || '—'}**`)
    if (f.sellers.length) md.push(`- Sellers: ${f.sellers.join(', ')}`)
    if (f.buyers.length) md.push(`- Buyers: ${f.buyers.join(', ')}`)
    md.push(`- Activities: ${f.activities.length}  ·  Required filled: ${requiredFilled.length}  ·  **Required empty: ${requiredEmpty.length}**`)
    md.push('')
    md.push('**Missing required activities:**')
    md.push('')
    for (const a of requiredEmpty) {
      md.push(`- \`${a.activityName}\` (${a.typeName})`)
      allMissing.push({
        folderKind: f.kind,
        folderGuid: f.guid,
        address: f.address,
        mls: f.mls,
        sellers: f.sellers,
        buyers: f.buyers,
        activityId: a.activityId,
        activityName: a.activityName,
        typeName: a.typeName,
      })
    }
    md.push('')
  }

  md.unshift('')
  md.unshift(`- **${totalRequiredEmpty}** Required activities with 0 attached docs across all folders`)
  md.unshift(`- **${totalActivities}** total checklist activities`)
  md.unshift(`- **${folders.length}** folders audited`)
  md.unshift('')
  md.unshift('## Summary')
  md.unshift('')

  fs.mkdirSync(path.dirname(outMd), { recursive: true })
  fs.writeFileSync(outMd, md.join('\n') + '\n')
  console.error(JSON.stringify({ stage: 'wrote_md', path: outMd, lines: md.length }))

  if (outJson) {
    json.allMissing = allMissing
    json.totals = { folders: folders.length, totalActivities, totalRequiredEmpty }
    fs.mkdirSync(path.dirname(outJson), { recursive: true })
    fs.writeFileSync(outJson, JSON.stringify(json, null, 2))
    console.error(JSON.stringify({ stage: 'wrote_json', path: outJson, folders: folders.length, missing: allMissing.length }))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
