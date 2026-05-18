#!/usr/bin/env node
/**
 * SkySlope Forms — folder-level gap report.
 *
 * Metadata-only audit (no PDF downloads) of every listing + sale file folder.
 * Surfaces things a human has to fix in the SkySlope UI:
 *
 *   - Blank or test addresses
 *   - Address typos (double prefixes like "NW NW")
 *   - Missing MLS numbers
 *   - Empty sellers / empty buyers
 *   - Missing listing or sale agent
 *   - Folders missing OREF 042 (initial agency disclosure pamphlet)
 *   - Sale folders missing OREF 050 / 040 / 041 (buyer representation)
 *   - Duplicate folders (same address + lane, different GUIDs)
 *   - Closed sales missing actual closing date
 *   - Suspiciously thin folders (0-5 docs with no obvious reason)
 *
 * Output: Markdown to stdout, JSON to --json <path>.
 *
 *   npm run skyslope:forms-folder-gaps > tmp/folder-gaps.md
 */
import fs from 'fs'
import crypto from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'

import {
  fetchSkyslopeFileFolderRows,
  skyslopeFetchWithRetry,
} from './skyslope-files-api.mjs'
import { inferKindV2 } from './skyslope-forms-document-taxonomy-v2.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const ENV_PATH = path.join(ROOT, '.env.local')
const BASE = 'https://api-latest.skyslope.com'
const INCLUDE_ARCHIVED = process.env.SKYSLOPE_INCLUDE_ARCHIVED === '1'

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
    if (val.startsWith('"') && val.endsWith('"'))
      val = val.slice(1, -1).replace(/\\n/g, '\n')
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
  const j = await res.json()
  if (!j.Session) throw new Error(`Login failed: ${JSON.stringify(j).slice(0, 400)}`)
  return j.Session
}

function apiHeaders(session) {
  return {
    'Content-Type': 'application/json',
    Session: session,
    timestamp: new Date().toISOString(),
    Accept: 'application/json',
  }
}

async function fetchListingDetail(session, listingGuid) {
  const r = await skyslopeFetchWithRetry(`${BASE}/api/files/listings/${listingGuid}`, { headers: apiHeaders(session) })
  if (!r.ok) return null
  return r.json()
}
async function fetchSaleDetail(session, saleGuid) {
  const r = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${saleGuid}`, { headers: apiHeaders(session) })
  if (!r.ok) return null
  return r.json()
}
async function fetchDocuments(session, kind, guid) {
  const r = await skyslopeFetchWithRetry(`${BASE}/api/files/${kind}/${guid}/documents`, { headers: apiHeaders(session) })
  if (!r.ok) return []
  const j = await r.json()
  return j?.value?.documents ?? []
}

function safeAddress(prop) {
  if (!prop) return ''
  const line = [prop.streetNumber, prop.streetAddress, prop.unit].filter(Boolean).join(' ').trim()
  const tail = [prop.city, prop.state, prop.zip].filter(Boolean).join(', ')
  return [line, tail].filter(Boolean).join(', ').trim()
}

function partyDisplay(c) {
  if (!c) return ''
  if (typeof c === 'string') return c.trim()
  const fn = [c.firstName, c.lastName].filter(Boolean).join(' ').trim()
  return fn || c.fullName || c.company || ''
}

function partyArrayDisplay(arr) {
  if (!Array.isArray(arr)) return []
  return arr.map(partyDisplay).filter(Boolean)
}

function dupKey(folder) {
  const addr = String(folder.propertyAddress || '').toLowerCase().replace(/\s+/g, ' ').trim()
  return `${folder.kind}|${addr}`
}

function detectAddressTypos(addr) {
  const a = String(addr || '')
  const dups = []
  if (/\bNW\s+NW\b/i.test(a)) dups.push('"NW NW" double-prefix')
  if (/\bNE\s+NE\b/i.test(a)) dups.push('"NE NE" double-prefix')
  if (/\bSW\s+SW\b/i.test(a)) dups.push('"SW SW" double-prefix')
  if (/\bSE\s+SE\b/i.test(a)) dups.push('"SE SE" double-prefix')
  if (/##/.test(a)) dups.push('"##" double-pound (unit prefix glitch)')
  if (/\b(test|sample|example|asdf|fake)\b/i.test(a)) dups.push('contains test keyword')
  if (/, , /.test(a)) dups.push('contains empty address tokens')
  return dups
}

async function main() {
  const argv = process.argv.slice(2)
  let jsonOut = ''
  const ji = argv.indexOf('--json')
  if (ji >= 0 && argv[ji + 1]) jsonOut = argv[ji + 1]

  const env = loadEnvLocal(ENV_PATH)
  const session = await login(env)

  const listingRows = await fetchSkyslopeFileFolderRows(session, BASE, 'listings', () => apiHeaders(session), INCLUDE_ARCHIVED)
  const saleRows = await fetchSkyslopeFileFolderRows(session, BASE, 'sales', () => apiHeaders(session), INCLUDE_ARCHIVED)

  const folders = []

  for (const L of listingRows) {
    const guid = L.listingGuid
    const [detailJson, documents] = await Promise.all([
      fetchListingDetail(session, guid),
      fetchDocuments(session, 'listings', guid),
    ])
    const listing = detailJson?.value?.listing ?? null
    folders.push({
      kind: 'listing',
      guid,
      summaryRow: L,
      detail: listing,
      propertyAddress: L.propertyAddress || safeAddress(listing?.property) || '',
      mls: listing?.mlsNumber || L.mlsNumber || '',
      status: listing?.status || L.status || '',
      documents,
    })
  }

  for (const S of saleRows) {
    const guid = S.saleGuid
    const [detailJson, documents] = await Promise.all([
      fetchSaleDetail(session, guid),
      fetchDocuments(session, 'sales', guid),
    ])
    const sale = detailJson?.value?.sale ?? null
    folders.push({
      kind: 'sale',
      guid,
      summaryRow: S,
      detail: sale,
      propertyAddress: S.propertyAddress || safeAddress(sale?.property) || '',
      mls: sale?.mlsNumber || S.mlsNumber || '',
      status: sale?.status || S.status || '',
      documents,
      linkedListingGuid: sale?.listingGuid || '',
    })
  }

  // Build duplicate-folder map.
  const dupMap = new Map()
  for (const f of folders) {
    const k = dupKey(f)
    if (!dupMap.has(k)) dupMap.set(k, [])
    dupMap.get(k).push(f)
  }

  const dupClusters = [...dupMap.entries()].filter(([, v]) => v.length > 1)

  // Per-folder gap accumulation.
  const reports = []
  for (const f of folders) {
    /** @type {string[]} */
    const issues = []

    if (!f.propertyAddress || !f.propertyAddress.trim() || /^[,\s]+$/.test(f.propertyAddress)) {
      issues.push('CRITICAL: folder has no property address')
    }

    const typos = detectAddressTypos(f.propertyAddress)
    for (const t of typos) issues.push(`address: ${t}`)

    if (!f.mls) issues.push('missing MLS number')

    const d = f.detail || {}
    const sellers = partyArrayDisplay(d.sellers)
    const buyers = partyArrayDisplay(d.buyers)

    if (f.kind === 'listing') {
      if (sellers.length === 0) issues.push('CRITICAL: listing has no sellers')
      if (!d.agentGuid) issues.push('listing has no listing agent assigned')
      if (!d.expirationDate && (f.status === 'Active' || f.status === 'Transaction')) {
        issues.push('listing missing expirationDate while still in pipeline')
      }
    }

    if (f.kind === 'sale') {
      if (sellers.length === 0) issues.push('CRITICAL: sale has no sellers')
      if (buyers.length === 0) issues.push('CRITICAL: sale has no buyers')
      if (!d.agentGuid) issues.push('sale has no agent assigned')
      const isClosed = (f.status || '').toLowerCase().includes('closed')
      if (isClosed && !d.actualClosingDate) issues.push('Closed sale missing actualClosingDate')
      if (isClosed && !d.escrowNumber) issues.push('Closed sale missing escrowNumber')
    }

    // Required OREF docs.
    const docCats = (f.documents || []).map((doc) => inferKindV2(doc.fileName, doc.name))
    const hasPamphlet = docCats.includes('agency_disclosure_pamphlet')
    if (!hasPamphlet) {
      issues.push('missing Initial Agency Disclosure Pamphlet (OREF 042)')
    }
    if (f.kind === 'sale') {
      const hasBBC = docCats.includes('buyer_representation_agreement')
      if (!hasBBC) {
        issues.push('missing Buyer Representation / BBC agreement on sale folder')
      }
    }

    // Sparse folder warning.
    if ((f.documents || []).length === 0) {
      issues.push('folder has zero documents')
    } else if ((f.documents || []).length < 4 && (f.status === 'Closed' || /transaction|pending/i.test(f.status || ''))) {
      issues.push(`only ${f.documents.length} documents on a ${f.status} folder (likely incomplete)`)
    }

    // Duplicate folder check.
    const dupList = dupMap.get(dupKey(f))
    if (dupList && dupList.length > 1) {
      const others = dupList.filter((g) => g.guid !== f.guid)
      issues.push(
        `duplicate folder (${dupList.length}× ${f.kind} for this address; other GUIDs: ${others
          .map((g) => g.guid.slice(0, 8))
          .join(', ')})`
      )
    }

    reports.push({
      kind: f.kind,
      guid: f.guid,
      address: f.propertyAddress || '(blank address)',
      mls: f.mls || '',
      status: f.status || '',
      sellers,
      buyers,
      documentCount: (f.documents || []).length,
      issueCount: issues.length,
      issues,
    })
  }

  // Markdown output.
  const md = []
  md.push(`# SkySlope Forms folder gap report`)
  md.push('')
  md.push(`Generated (UTC): ${new Date().toISOString()}`)
  md.push('')
  md.push(`- **${folders.length}** folders total (${folders.filter((f) => f.kind === 'listing').length} listing, ${folders.filter((f) => f.kind === 'sale').length} sale)`)
  md.push(`- **${reports.filter((r) => r.issueCount > 0).length}** folders flagged with at least one issue`)
  md.push(`- **${reports.filter((r) => r.issues.some((i) => i.startsWith('CRITICAL'))).length}** folders have CRITICAL gaps (missing parties or blank address)`)
  md.push(`- **${dupClusters.length}** duplicate-folder clusters (same address + lane, different GUIDs)`)
  md.push('')

  // Critical first.
  md.push(`## CRITICAL gaps`)
  md.push('')
  const critical = reports.filter((r) => r.issues.some((i) => i.startsWith('CRITICAL')))
  if (critical.length === 0) md.push('_(none)_')
  for (const r of critical) {
    md.push(`### ${r.kind} · ${r.address}`)
    md.push('')
    md.push(`- GUID: \`${r.guid}\``)
    md.push(`- MLS: ${r.mls || '_(missing)_'}`)
    md.push(`- Status: ${r.status || '_(missing)_'}`)
    md.push(`- Documents: ${r.documentCount}`)
    if (r.sellers.length) md.push(`- Sellers: ${r.sellers.join(', ')}`)
    if (r.buyers.length) md.push(`- Buyers: ${r.buyers.join(', ')}`)
    md.push('')
    md.push('Issues:')
    for (const i of r.issues) md.push(`- ${i}`)
    md.push('')
  }

  md.push(`## Duplicate-folder clusters`)
  md.push('')
  if (dupClusters.length === 0) md.push('_(none)_')
  for (const [k, list] of dupClusters.sort((a, b) => b[1].length - a[1].length)) {
    const [kind, addr] = k.split('|', 2)
    md.push(`### ${kind} · ${addr || '(blank)'} (${list.length} folders)`)
    md.push('')
    for (const g of list) {
      const docCount = (g.documents || []).length
      md.push(`- \`${g.guid}\` · MLS ${g.mls || '—'} · status ${g.status || '—'} · ${docCount} docs · sellers [${partyArrayDisplay(g.detail?.sellers).join(', ')}] · buyers [${partyArrayDisplay(g.detail?.buyers).join(', ')}]`)
    }
    md.push('')
    md.push('Recommendation: pick the surviving folder, move docs to it, archive the others in SkySlope. Do not delete.')
    md.push('')
  }

  md.push(`## Per-folder index (all folders, including those with no issues)`)
  md.push('')
  md.push('| # | Type | Address | MLS | Status | Docs | Issues |')
  md.push('|---:|---|---|---|---|---:|---:|')
  reports.forEach((r, i) => {
    md.push(
      `| ${i + 1} | ${r.kind} | ${(r.address || '').replace(/\|/g, '\\|')} | ${r.mls || '—'} | ${r.status || '—'} | ${r.documentCount} | ${r.issueCount} |`
    )
  })
  md.push('')

  md.push(`## Full per-folder issue list`)
  md.push('')
  for (const r of reports.filter((x) => x.issueCount > 0)) {
    md.push(`### ${r.kind} · ${r.address}`)
    md.push(`- GUID: \`${r.guid}\` · MLS ${r.mls || '—'} · ${r.status} · ${r.documentCount} docs`)
    if (r.sellers.length) md.push(`- Sellers: ${r.sellers.join(', ')}`)
    if (r.buyers.length) md.push(`- Buyers: ${r.buyers.join(', ')}`)
    for (const i of r.issues) md.push(`- ⚠ ${i}`)
    md.push('')
  }

  process.stdout.write(md.join('\n') + '\n')

  if (jsonOut) {
    fs.mkdirSync(path.dirname(jsonOut), { recursive: true })
    fs.writeFileSync(
      jsonOut,
      JSON.stringify(
        {
          generated_at: new Date().toISOString(),
          totals: {
            folders: folders.length,
            listing: folders.filter((f) => f.kind === 'listing').length,
            sale: folders.filter((f) => f.kind === 'sale').length,
            flagged: reports.filter((r) => r.issueCount > 0).length,
            critical: reports.filter((r) => r.issues.some((i) => i.startsWith('CRITICAL'))).length,
            duplicate_clusters: dupClusters.length,
          },
          reports,
          duplicate_clusters: dupClusters.map(([k, list]) => ({
            key: k,
            guids: list.map((g) => g.guid),
            mls: list.map((g) => g.mls || ''),
            statuses: list.map((g) => g.status || ''),
            docCounts: list.map((g) => (g.documents || []).length),
          })),
        },
        null,
        2
      )
    )
    console.error(JSON.stringify({ wroteJson: jsonOut }))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
