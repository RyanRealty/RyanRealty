#!/usr/bin/env node
/**
 * Phase 10: Build transaction-summary.txt for each Nordic folder
 * using SkySlope detail + dry-run report data.
 *
 * Output: tmp/skyslope-pdfs/<guid>/transaction-summary.txt
 */
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { skyslopeFetchWithRetry } from './skyslope-files-api.mjs'

const BASE = 'https://api-latest.skyslope.com'
const FOLDERS = [
  { guid: 'ce3c30de-1b10-4946-bf06-6dbad8e1d53d', label: 'Closed', reportPath: 'tmp/skyslope-form-compliance-2026-05-23/ce3c30de-report.jsonl' },
  { guid: '6be4810f-eda4-433d-ad6f-f27b80a1c6e0', label: 'Canceled-A', reportPath: 'tmp/skyslope-form-compliance-2026-05-23/6be4810f-report.jsonl' },
  { guid: '0ec95d31-1fed-4519-a114-e967513eac33', label: 'Canceled-B', reportPath: 'tmp/skyslope-form-compliance-2026-05-23/0ec95d31-report.jsonl' },
]

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

for (const folder of FOLDERS) {
  const fr = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${folder.guid}`, { headers: apiHeaders(session) })
  const fbody = await fr.json()
  const sale = fbody.value?.sale || {}
  const checklist = sale.checklist
  const activities = checklist?.activities || []
  const buyers = (sale.buyers || []).map((b) => b.firstName ? `${b.firstName} ${b.middleName || ''} ${b.lastName}`.replace(/\s+/g, ' ').trim() : (b.companyName || b.name)).filter(Boolean)
  const sellers = (sale.sellers || []).map((s) => s.firstName ? `${s.firstName} ${s.middleName || ''} ${s.lastName}`.replace(/\s+/g, ' ').trim() : (s.companyName || s.name)).filter(Boolean)

  const lines = (await fs.readFile(folder.reportPath, 'utf8')).split('\n').filter(Boolean).map((l) => JSON.parse(l))
  const canonical = lines.filter((e) => e.isCanonical)
  const archive = lines.filter((e) => !e.isCanonical)
  const saleNumbers = [...new Set(canonical.map((e) => e.saleNumber).filter(Boolean))]
  const archiveByReason = {}
  for (const a of archive) {
    const r = a.archiveReason || 'unknown'
    archiveByReason[r] = (archiveByReason[r] || 0) + 1
  }
  // Form inventory by formId
  const formCounts = {}
  for (const c of canonical) {
    const fid = c.formId || 'NULL'
    formCounts[fid] = (formCounts[fid] || 0) + 1
  }
  // Required + empty activities
  const requiredEmpty = activities.filter((a) => a.status === 'Required' && !(a.checklistDocs || []).length)
  const reqRows = activities.filter((a) => a.status === 'Required')
  const optRows = activities.filter((a) => a.status !== 'Required')

  const summary = []
  summary.push(`${sale.propertyAddress || '(no address)'}`)
  summary.push(`SkySlope folder: ${folder.guid}`)
  summary.push(`Status: ${sale.status} ${sale.actualClosingDate ? `(recorded ${sale.actualClosingDate.slice(0,10)})` : sale.escrowClosingDate ? `(target close ${sale.escrowClosingDate.slice(0,10)})` : ''}`)
  summary.push(`Folder kind: Sale (${folder.label.toLowerCase()})`)
  summary.push(`Last audit: ${new Date().toISOString().slice(0,10)} (v5 rename + checklist assignment via skyslope-form-compliance skill)`)
  summary.push('')
  summary.push('='.repeat(80))
  summary.push('PROPERTY + ESCROW')
  summary.push('='.repeat(80))
  summary.push('')
  summary.push(`Address:                ${sale.propertyAddress || '(no address)'}`)
  summary.push(`MLS#:                   ${sale.mlsNumber || '(none)'}`)
  summary.push(`Escrow company:         ${sale.titleCompany || sale.escrowCompany || '(unknown)'}`)
  summary.push(`Escrow officer:         ${sale.escrowOfficer || '(unknown)'}`)
  summary.push(`Escrow number:          ${sale.escrowNumber || '(unknown)'}`)
  summary.push(`Settlement date:        ${sale.actualClosingDate?.slice(0,10) || sale.escrowClosingDate?.slice(0,10) || '(not closed)'}`)
  summary.push(`Contract acceptance:    ${sale.contractAcceptanceDate?.slice(0,10) || '(unknown)'}`)
  summary.push(`Sale price:             ${sale.salePrice ? '$' + Number(sale.salePrice).toLocaleString('en-US') : '(unknown)'}`)
  summary.push(`Listing price:          ${sale.listingPrice ? '$' + Number(sale.listingPrice).toLocaleString('en-US') : '(unknown)'}`)
  summary.push(`Deal type:              ${sale.dealType || '(unknown)'}`)
  summary.push(`Office:                 Ryan Realty LLC`)
  summary.push('')
  summary.push('='.repeat(80))
  summary.push('PARTIES')
  summary.push('='.repeat(80))
  summary.push('')
  summary.push(`Sellers (${sellers.length}):`)
  for (const s of sellers) summary.push(`  - ${s}`)
  summary.push('')
  summary.push(`Buyers (${buyers.length}):`)
  for (const b of buyers) summary.push(`  - ${b}`)
  summary.push('')
  summary.push(`Buyer side (Ryan Realty):`)
  summary.push(`  Buyer Agent:          (resolved per agentGuid ${(sale.agentGuid || '').slice(0,8)})`)
  summary.push(`  Buyer Firm:           Ryan Realty LLC`)
  summary.push(`  Office Address:       115 NW Oregon Ave 2, Bend OR 97703`)
  summary.push(`  Contact:              541.213.6706  ·  matt@ryan-realty.com`)
  summary.push('')
  summary.push('='.repeat(80))
  summary.push('SALE AGREEMENT NUMBERS')
  summary.push('='.repeat(80))
  summary.push('')
  if (saleNumbers.length === 0) {
    summary.push('  No sale agreement numbers extracted from PDFs.')
  } else {
    for (const sn of saleNumbers) {
      const docsOnSn = canonical.filter((c) => c.saleNumber === sn).length
      summary.push(`  ${sn}  -  ${docsOnSn} canonical docs`)
    }
  }
  summary.push('')
  summary.push('='.repeat(80))
  summary.push('FORM INVENTORY')
  summary.push('='.repeat(80))
  summary.push('')
  summary.push(`Canonical (main folder): ${canonical.length}`)
  summary.push(`Archive:                 ${archive.length}`)
  summary.push('')
  summary.push(`Archive by reason:`)
  for (const [r, n] of Object.entries(archiveByReason).sort((a,b) => b[1]-a[1])) {
    summary.push(`  ${r.padEnd(20)} ${n}`)
  }
  summary.push('')
  summary.push(`Canonical forms by category:`)
  for (const [fid, n] of Object.entries(formCounts).sort((a,b) => b[1]-a[1])) {
    summary.push(`  ${fid.padEnd(50)} ${n}`)
  }
  summary.push('')
  summary.push('='.repeat(80))
  summary.push('CHECKLIST STATE (post-Phase 8 assignment)')
  summary.push('='.repeat(80))
  summary.push('')
  summary.push(`Checklist type:           ${sale.checklistType}`)
  summary.push(`Required activities:      ${reqRows.length}`)
  summary.push(`Optional activities:      ${optRows.length}`)
  summary.push(`Required + has docs:      ${reqRows.filter(a => (a.checklistDocs || []).length).length}`)
  summary.push(`Required + empty:         ${requiredEmpty.length}`)
  summary.push('')
  if (requiredEmpty.length) {
    summary.push(`Required-and-empty activities (gap-hunt targets):`)
    for (const a of requiredEmpty) {
      summary.push(`  ${(a.activityName || '').trim().padEnd(50)} (${a.typeName})`)
    }
    summary.push('')
  }
  summary.push('='.repeat(80))
  summary.push('COMPLIANCE FLAGS')
  summary.push('='.repeat(80))
  summary.push('')
  const archiveSamples = archive.filter((a) => a.archiveReason === 'not_executed').slice(0, 5)
  if (sale.status === 'Closed') {
    summary.push('Status = Closed. Required disclosures (SPD, IADP delivery) should be in place.')
  } else if (sale.status?.includes('Canceled')) {
    summary.push('Status = Canceled. Terminated transaction. Compliance bar is "what was')
    summary.push('delivered before cancel" not "what was signed at close" — no closing.')
  }
  summary.push('')
  if (archiveSamples.length) {
    summary.push('Top not_executed dispositions (mutual instruments where one side signed):')
    for (const a of archiveSamples) {
      summary.push(`  - ${a.formName || a.formId}`)
      summary.push(`    Missing: ${(a.missing || []).join(', ') || '(see report)'}`)
    }
    summary.push('')
  }
  summary.push('Per the skill "Required ≠ legally required" policy, advisories like FIRPTA')
  summary.push('Advisory and Smoke Alarms Advisory left empty do NOT create license risk for')
  summary.push('US-domestic sellers when the SPD captures the smoke-alarm rule.')
  summary.push('')
  summary.push('='.repeat(80))
  summary.push('NEXT STEPS')
  summary.push('='.repeat(80))
  summary.push('')
  summary.push('1. Phase 9 gap-hunt — run cross-broker Gmail search for any Required-and-empty')
  summary.push('   activities (above). Forward verified hits to the folder mailbox.')
  summary.push(`2. This summary PDF gets uploaded to the Broker Notes activity in this folder.`)
  summary.push('3. After upload, the folder is fully compliant under the skyslope-form-compliance')
  summary.push('   skill (v5 names + correct executed marks + checklist assignments + summary).')
  summary.push('')

  // Write the summary
  const outDir = `tmp/skyslope-pdfs/${folder.guid}`
  await fs.mkdir(outDir, { recursive: true })
  const outPath = path.join(outDir, 'transaction-summary.txt')
  await fs.writeFile(outPath, summary.join('\n'))
  console.log(`Wrote ${outPath} (${summary.length} lines)`)
}
