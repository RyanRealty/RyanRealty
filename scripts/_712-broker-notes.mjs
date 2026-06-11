#!/usr/bin/env node
/**
 * Phase 10 for 712 SW 1st St (f50fe2a6 / TxnInt 21849771):
 * generate one Broker Notes summary per unique sale agreement number,
 * convert each to a PDF, optionally forward to portalEmail + PATCH +
 * assign to the Broker Notes activity.
 *
 * Two cycles discovered:
 *   - 04022024AB  Caldwell/Mendoza (closing cycle)
 *   - 04042024MBEB  Erik Boynton (failed competing offer, never accepted)
 *
 * Usage:
 *   # Stage 1: build local TXT + PDF (no SkySlope writes)
 *   node --env-file=.env.local scripts/_712-broker-notes.mjs --build
 *
 *   # Stage 2: send the PDFs to portalEmail + PATCH + assign
 *   node --env-file=.env.local scripts/_712-broker-notes.mjs --send
 *
 *   # Both stages back-to-back (after review)
 *   node --env-file=.env.local scripts/_712-broker-notes.mjs --build --send
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'
import { skyslopeFetchWithRetry } from './skyslope-files-api.mjs'

const execFileAsync = promisify(execFile)

const BASE = 'https://api-latest.skyslope.com'
const SALE_GUID = 'f50fe2a6-226c-4f81-8a59-9fc9a46ea5df'
const TXN_INT = '21849771'
const REPORT_PATH = 'tmp/skyslope-form-compliance-2026-05-25/f50fe2a6-report.jsonl'
const OUT_DIR = 'tmp/712-broker-notes'
const TXT_TO_PDF = 'scripts/_txt-to-pdf.py'
const FROM_EMAIL = 'matt@ryan-realty.com'

const BUILD = process.argv.includes('--build')
const SEND = process.argv.includes('--send')

if (!BUILD && !SEND) {
  console.error('Specify --build, --send, or both')
  process.exit(1)
}

await fs.mkdir(OUT_DIR, { recursive: true })

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
function fmt$(n) { return n == null || n === '' ? '(unknown)' : '$' + Number(n).toLocaleString('en-US') }
function fmtDate(d) { return d ? String(d).slice(0, 10) : '(unknown)' }
function fmtParty(p) {
  if (!p) return ''
  if (typeof p === 'string') return p.trim()
  return [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ').trim() || p.companyName || ''
}

// ============ STAGE 1: BUILD ============

async function build() {
  const session = await login()
  const fr = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${SALE_GUID}`, { headers: apiHeaders(session) })
  const sale = (await fr.json()).value?.sale
  const recs = (await fs.readFile(REPORT_PATH, 'utf8')).split('\n').filter(Boolean).map((l) => JSON.parse(l))

  // Group by saleNumber (skip null/empty)
  const groups = new Map()
  for (const r of recs) {
    if (!r.saleNumber) continue
    if (r._sale_number_review_needed) continue // skip Nagorski misread
    if (!groups.has(r.saleNumber)) groups.set(r.saleNumber, [])
    groups.get(r.saleNumber).push(r)
  }
  console.log(`Unique sale#s discovered: ${[...groups.keys()].join(', ')}\n`)

  // ============ GAP-FILL: MLS lookup via Spark REST API (Supabase listings
  // table doesn't cover Jefferson County / Madras) ============
  let mls = null
  if (sale.mlsNumber && process.env.SPARK_API_KEY) {
    try {
      const sparkBase = process.env.SPARK_API_BASE_URL || 'https://sparkapi.com/v1'
      const filter = encodeURIComponent(`ListingId Eq '${sale.mlsNumber}'`)
      const url = `${sparkBase}/listings?_pagination=1&_page=1&_limit=1&_filter=${filter}`
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${process.env.SPARK_API_KEY}`, Accept: 'application/json' },
      })
      const body = await r.json()
      const result = body.D?.Results?.[0]
      if (result) {
        const f = result.StandardFields || {}
        mls = {
          ListNumber: f.ListingId,
          ListingKey: f.ListingKey,
          OriginalListPrice: f.OriginalListPrice,
          ListPrice: f.ListPrice,
          ClosePrice: f.ClosePrice,
          CloseDate: f.CloseDate,
          ListAgentName: f.ListAgentFullName || f.ListAgentName,
          ListOfficeName: f.ListOfficeName,
          buyer_agent_name: f.BuyerAgentFullName || f.BuyerAgentName,
          buyer_office_name: f.BuyerOfficeName,
          SubdivisionName: f.SubdivisionName,
          year_built: f.YearBuilt,
          BedroomsTotal: f.BedroomsTotal,
          BathroomsTotal: f.BathroomsTotalDecimal || f.BathroomsTotal,
          TotalLivingAreaSqFt: f.LivingArea || f.BuildingAreaTotal,
          sale_to_list_ratio: f.ClosePrice && f.ListPrice ? Number(f.ClosePrice) / Number(f.ListPrice) : null,
        }
      }
      console.log(`  Spark MLS lookup for ${sale.mlsNumber}: ${mls ? 'found' : 'NOT FOUND'}`)
    } catch (e) {
      console.log(`  Spark MLS lookup error: ${e.message}`)
    }
  }

  // ============ GAP-FILL: parse PDF reasoning for escrow/EM details ============
  // Prefer EM Receipt as the authoritative source for escrow officer (the
  // person who handled the deal, not the title officer who countersigned the
  // Preliminary Title Report).
  const pdfFacts = {}
  const isEmReceipt = (r) => /earnest money receipt|em receipt|receipt for funds/i.test((r.proposedName || '') + ' ' + (r.formName || ''))
  const isAltaSettlement = (r) => /alta|final settlement|closing disclosure/i.test((r.proposedName || '') + ' ' + (r.formName || ''))
  const sortedForEscrow = [...recs].sort((a, b) => (isEmReceipt(b) - isEmReceipt(a)) || (isAltaSettlement(b) - isAltaSettlement(a)))
  for (const r of sortedForEscrow) {
    const txt = String(r.claudeReasoning || '') + ' ' + String(r.currentName || '')
    if (!pdfFacts.escrowCompany) {
      const m = txt.match(/(Western Title(?: & Escrow Company)?|First American Title[^,.]*|AmeriTitle[^,.]*|FNTG[^,.]*)/i)
      if (m) pdfFacts.escrowCompany = m[1].trim()
    }
    if (!pdfFacts.escrowOfficer) {
      const m = txt.match(/signed by ([A-Z][A-Za-z]+ [A-Z][A-Za-z]+)\s*\((?:escrow|title|settlement) officer\)/i)
      if (m) pdfFacts.escrowOfficer = m[1].trim()
    }
    if (!pdfFacts.earnestMoney) {
      const m = txt.match(/\$([\d,]+(?:\.\d{2})?)\s*earnest money/i)
      if (m) pdfFacts.earnestMoney = parseFloat(m[1].replace(/,/g, ''))
    }
    if (!pdfFacts.emReceiptDate) {
      const m = txt.match(/(?:Earnest Money Receipt|receipt) (?:issued|dated)? ?(?:on |by [^,]+ on )?(\d{2}\/\d{2}\/\d{2,4})/i)
      if (m) pdfFacts.emReceiptDate = m[1]
    }
    if (r.formId === 'oref-001-rsa' && r.signers) {
      if (!pdfFacts.rsaSigners) pdfFacts.rsaSigners = r.signers
    }
  }
  console.log(`  PDF facts extracted: ${JSON.stringify(pdfFacts)}\n`)

  const escrow = sale.escrowContact || {}
  const lender = sale.lenderContact || {}
  const apiBuyers = (sale.buyers || []).map(fmtParty).filter(Boolean)
  const apiSellers = (sale.sellers || []).map(fmtParty).filter(Boolean)
  const cycleList = [...groups.keys()].sort()

  // Ryan Realty broker roster — used to classify signers as agents before falling back to buyer/seller match
  const RYAN_REALTY_BROKERS = [/(matt|matthew)(\s+michael)?\s+ryan/i, /rebecca(\s+ryser)?\s+peterson/i, /paul\s+stevenson/i]
  function isRyanRealtyBroker(name) {
    return RYAN_REALTY_BROKERS.some((re) => re.test(name))
  }

  const outputs = []

  for (const sn of cycleList) {
    const cycleRecs = groups.get(sn)
    const canonical = cycleRecs.filter((r) => r.isCanonical)
    const archive = cycleRecs.filter((r) => !r.isCanonical)

    // Determine disposition from this cycle's canonical + the API-level closing
    const hasRsa = canonical.find((r) => /oref-001-rsa/i.test(r.formId || ''))
    const isClosingCycle = hasRsa && canonical.length >= 3 // heuristic
    const isFailedCycle = canonical.length === 0 && archive.length > 0

    // Sale agreement number = <broker><MMDDYYYY> — decode the date
    const dateMatch = sn.match(/^([A-Z]{1,4})(\d{2})(\d{2})(\d{4})$/)
    const acceptedDate = dateMatch ? `${dateMatch[4]}-${dateMatch[2]}-${dateMatch[3]}` : null
    const signingBroker = dateMatch ? dateMatch[1] : null

    // Collect unique signers (buyers + sellers from this cycle's docs)
    const allSigners = new Set()
    for (const r of cycleRecs) for (const s of (r.signers || [])) allSigners.add(s)
    // Classify signers: agent first (Ryan Realty roster), then surname-only seller match,
    // then surname-only buyer match. First-name only is NOT enough (Matthew Mendoza vs
    // Matthew Michael Ryan bug from prior run).
    const cycleSellers = new Set()
    const cycleBuyers = new Set()
    const cycleAgents = new Set()
    function lastName(s) {
      const parts = String(s).trim().split(/\s+/).filter(Boolean)
      return parts.length ? parts[parts.length - 1].toLowerCase() : ''
    }
    const apiSellerLast = new Set(apiSellers.map(lastName))
    const apiBuyerLast = new Set(apiBuyers.map(lastName))
    for (const s of allSigners) {
      if (isRyanRealtyBroker(s)) {
        cycleAgents.add(s + (/ryan/i.test(s) ? ' (Ryan Realty principal broker)' : ' (Ryan Realty broker)'))
        continue
      }
      const ln = lastName(s)
      if (apiSellerLast.has(ln)) cycleSellers.add(s)
      else if (apiBuyerLast.has(ln)) cycleBuyers.add(s)
      else cycleBuyers.add(s + ' (?)')
    }

    const otherCycles = cycleList.filter((c) => c !== sn)

    // Form inventory for this cycle
    const formCounts = {}
    for (const r of cycleRecs) {
      const f = r.formId || '(unidentified)'
      formCounts[f] = (formCounts[f] || 0) + 1
    }

    const lines = []
    lines.push(`BROKER NOTES — Transaction Summary`)
    lines.push(`Sale Agreement #: ${sn}`)
    lines.push(`Property: ${sale.propertyAddress || '712 SW 1st St, Madras, OR 97741'}`)
    if (mls) {
      const detail = [
        mls.SubdivisionName && `${mls.SubdivisionName} subdivision`,
        mls.year_built && `built ${mls.year_built}`,
        mls.BedroomsTotal && `${mls.BedroomsTotal}bd`,
        mls.BathroomsTotal && `${mls.BathroomsTotal}ba`,
        mls.TotalLivingAreaSqFt && `${Number(mls.TotalLivingAreaSqFt).toLocaleString()} sqft`,
      ].filter(Boolean).join(' · ')
      if (detail) lines.push(`Property detail (MLS): ${detail}`)
    }
    lines.push(`SkySlope folder: ${SALE_GUID}  (TxnInt ${TXN_INT})`)
    lines.push(`Disposition: ${isClosingCycle ? 'Closed (this is the closing cycle for the property)' : isFailedCycle ? 'Failed Cycle (offer received, never fully executed)' : 'Active / partial'}`)
    lines.push(`Audit pass: 2026-05-25 (v5 rename + archive folder + this Broker Notes)`)
    lines.push('')
    lines.push('='.repeat(80))
    lines.push('HEADER')
    lines.push('='.repeat(80))
    lines.push('')
    lines.push(`Sale Agreement #:        ${sn}`)
    if (acceptedDate) lines.push(`Sale Agreement date:     ${acceptedDate}  (decoded from sale#)`)
    if (signingBroker) lines.push(`Signing broker:          ${signingBroker}  ${signingBroker === 'MR' ? '(Matt Ryan)' : signingBroker === 'RP' ? '(Rebecca Peterson)' : signingBroker === 'RRP' ? '(Rebecca Ryser-Peterson)' : ''}`)
    const ryanRealtyAgentInCycle = [...cycleAgents].some((a) => /ryan/i.test(a))
    lines.push(`Listing agent + firm:    Matt Ryan · Ryan Realty LLC${mls?.ListAgentName && !/ryan/i.test(mls.ListAgentName) ? ` (Supabase: ${mls.ListAgentName} / ${mls.ListOfficeName || '?'})` : ''}`)
    if (mls?.buyer_agent_name) {
      lines.push(`Buyer agent + firm:      ${mls.buyer_agent_name} · ${mls.buyer_office_name || '?'}  (from MLS)`)
    } else {
      lines.push(`Buyer agent + firm:      ${ryanRealtyAgentInCycle ? 'Matt Ryan · Ryan Realty LLC (dual agent — verify)' : '(see RSA party block; not surfaced in MLS data)'}`)
    }
    lines.push(`MLS#:                    ${sale.mlsNumber || '(unknown)'}`)
    lines.push(`Escrow company:          ${escrow.company || pdfFacts.escrowCompany || '(unknown)'}`)
    lines.push(`Escrow officer:          ${[escrow.firstName, escrow.lastName].filter(Boolean).join(' ') || pdfFacts.escrowOfficer || '(unknown)'}  ${escrow.email ? `· ${escrow.email}` : ''}`)
    lines.push(`Escrow file #:           ${sale.escrowNumber || '(unknown)'}`)
    if (lender.firstName || lender.lastName || lender.company) {
      lines.push(`Lender:                  ${lender.company || ''}`)
      lines.push(`Loan officer:            ${[lender.firstName, lender.lastName].filter(Boolean).join(' ')}  ${lender.email ? `· ${lender.email}` : ''}`)
    }
    lines.push('')
    lines.push('='.repeat(80))
    lines.push('PARTIES')
    lines.push('='.repeat(80))
    lines.push('')
    const cycleSellersArr = [...cycleSellers]
    const cycleBuyersArr = [...cycleBuyers]
    const cycleAgentsArr = [...cycleAgents]
    lines.push(`Sellers (cross-referenced PDF signers + SkySlope party list):`)
    for (const s of (cycleSellersArr.length ? cycleSellersArr : apiSellers)) lines.push(`  - ${s}`)
    lines.push('')
    lines.push(`Buyers (cross-referenced PDF signers + SkySlope party list):`)
    if (sn === '04022024AB') {
      // Primary buyer was Matthew Mendoza per Matt's 2026-05-25 confirmation.
      // Caldwell appears as a co-signer on some forms (likely co-applicant for
      // pre-approval / financing) but the primary buying party of record is Mendoza.
      lines.push(`  - Matthew Mendoza  (primary buyer of record)`)
      const others = (cycleBuyersArr.length ? cycleBuyersArr : apiBuyers).filter((b) => !/mendoza/i.test(b))
      for (const b of others) lines.push(`  - ${b}  (co-signed on some forms; verify role)`)
    } else {
      for (const b of (cycleBuyersArr.length ? cycleBuyersArr : (isClosingCycle ? apiBuyers : []))) lines.push(`  - ${b}`)
    }
    if (cycleAgentsArr.length) {
      lines.push('')
      lines.push(`Agents who signed PDFs in this cycle:`)
      for (const a of cycleAgentsArr) lines.push(`  - ${a}`)
    }
    lines.push('')
    lines.push('='.repeat(80))
    lines.push('MONEY')
    lines.push('='.repeat(80))
    lines.push('')
    if (isClosingCycle) {
      // Source primacy: PDF > API > Supabase (per skill data primacy rule)
      const apiSale = sale.salePrice
      const mlsClose = mls?.ClosePrice
      const mlsOriginal = mls?.OriginalListPrice
      const mlsList = mls?.ListPrice
      lines.push(`MLS original list:        ${fmt$(mlsOriginal)}  ${mlsOriginal && mlsList && mlsOriginal !== mlsList ? `(reduced to ${fmt$(mlsList)})` : ''}`)
      lines.push(`MLS close price:          ${fmt$(mlsClose)}`)
      lines.push(`SkySlope sale price:      ${fmt$(apiSale)}`)
      if (apiSale && mlsClose && Number(apiSale) !== Number(mlsClose)) {
        const delta = Number(mlsClose) - Number(apiSale)
        lines.push(`  ⚠ Reconciliation delta:  ${fmt$(delta)}  (likely seller credit toward buyer closing costs; cross-check ALTA Settlement)`)
      } else if (apiSale && mlsClose) {
        lines.push(`  ✓ SkySlope and MLS agree.`)
      }
      lines.push(`Sale-to-list ratio:       ${mls?.sale_to_list_ratio != null ? (Number(mls.sale_to_list_ratio) * 100).toFixed(1) + '%' : '(unknown)'}`)
      lines.push(`Earnest money:            ${pdfFacts.earnestMoney ? fmt$(pdfFacts.earnestMoney) : fmt$(sale.earnestMoneyDeposit)}  ${pdfFacts.emReceiptDate ? `(receipt dated ${pdfFacts.emReceiptDate})` : ''}`)
      if (sale.commission) {
        const c = sale.commission
        lines.push(`Commission:               ${c.saleCommissionPercent ? c.saleCommissionPercent + '%' : '(unknown %)'}  ${c.officeGrossCommissionOnSale ? '(office gross: ' + fmt$(c.officeGrossCommissionOnSale) + ')' : ''}`)
      } else {
        lines.push(`Commission:               (API field empty — pull from ALTA Settlement for actual gross)`)
      }
    } else {
      lines.push(`This cycle did not execute. No money fields apply.`)
      lines.push(`Reference: closing cycle was ${otherCycles[0] || '(see other cycle in folder)'} — see that Broker Notes for monetary terms.`)
    }
    lines.push('')
    lines.push('='.repeat(80))
    lines.push('TIMELINE')
    lines.push('='.repeat(80))
    lines.push('')
    if (acceptedDate) lines.push(`Acceptance / sale# date:  ${acceptedDate}  (from sale#)`)
    if (sale.contractAcceptanceDate) lines.push(`Contract acceptance:      ${fmtDate(sale.contractAcceptanceDate)}  (SkySlope API)`)
    if (sale.escrowClosingDate) lines.push(`Target close of escrow:   ${fmtDate(sale.escrowClosingDate)}`)
    if (sale.actualClosingDate && isClosingCycle) lines.push(`Actual close of escrow:   ${fmtDate(sale.actualClosingDate)}`)
    lines.push('')
    lines.push('='.repeat(80))
    lines.push('DISPOSITION')
    lines.push('='.repeat(80))
    lines.push('')
    if (isClosingCycle) {
      lines.push(`Status: CLOSED — escrow recorded ${fmtDate(sale.actualClosingDate)}`)
      lines.push(`Sale price ${fmt$(sale.salePrice)} per SkySlope.`)
    } else if (isFailedCycle) {
      lines.push(`Status: FAILED CYCLE — offer received but not fully executed.`)
      lines.push(`Sellers (${apiSellers.join(', ')}) did not sign the mutual instruments for this cycle.`)
      lines.push(`Property eventually closed under cycle ${otherCycles[0] || '(see other cycle)'}.`)
    } else {
      lines.push(`Status: PARTIAL — ${canonical.length} canonical docs + ${archive.length} archive docs.`)
    }
    lines.push('')
    lines.push('='.repeat(80))
    lines.push('CROSS-CYCLE CONTEXT')
    lines.push('='.repeat(80))
    lines.push('')
    if (otherCycles.length === 0) {
      lines.push(`This folder contains only one sale agreement cycle (${sn}).`)
    } else {
      lines.push(`This SkySlope folder contains documents from multiple sale agreement cycles:`)
      for (const c of cycleList) {
        const rs = groups.get(c)
        const tag = c === sn ? '  ← THIS NOTES'
          : rs.filter((r) => r.isCanonical).length === 0 ? '  (failed cycle, no Broker Notes needed beyond this one)'
          : '  (separate Broker Notes published)'
        lines.push(`  - ${c}: ${rs.length} docs (${rs.filter((r) => r.isCanonical).length} canonical / ${rs.filter((r) => !r.isCanonical).length} archive)${tag}`)
      }
      lines.push('')
      lines.push(`See the other cycle's Broker Notes PDF in this same SkySlope folder for that cycle's full narrative.`)
    }
    lines.push('')
    lines.push('='.repeat(80))
    lines.push(`FORM INVENTORY (this cycle: ${sn})`)
    lines.push('='.repeat(80))
    lines.push('')
    // De-duplicate canonical list by proposedName (process-folder.mjs dedup
    // runs in-memory but isn't reflected in the report.jsonl I read from).
    const canonicalUnique = []
    const seenNames = new Set()
    for (const r of canonical) {
      const k = r.proposedName
      if (seenNames.has(k)) continue
      seenNames.add(k)
      canonicalUnique.push(r)
    }
    lines.push(`Canonical (main folder):  ${canonicalUnique.length} unique  (${canonical.length} total entries — duplicates filtered)`)
    lines.push(`Archive folder:           ${archive.length}`)
    lines.push('')
    lines.push(`Canonical docs (deduped):`)
    for (const r of canonicalUnique) lines.push(`  ${r.proposedName}`)
    lines.push('')
    lines.push(`Archive docs:`)
    for (const r of archive) lines.push(`  ${r.proposedName}  (reason: ${r.archiveReason || '?'})`)
    lines.push('')
    lines.push('='.repeat(80))
    lines.push('FILE GAPS / FLAGS')
    lines.push('='.repeat(80))
    lines.push('')
    const activities = sale.checklist?.activities || []
    const requiredEmpty = activities.filter((a) => a.status === 'Required' && !(a.checklistDocs || []).length)
    if (requiredEmpty.length) {
      lines.push(`Required checklist activities still empty (review against compliance-vs-policy-gaps.md):`)
      for (const a of requiredEmpty) lines.push(`  - ${(a.activityName || '').trim()}  (${a.typeName})`)
    } else {
      lines.push(`All required checklist activities have docs attached.`)
    }
    lines.push('')
    lines.push(`Note from 2026-05-25 audit:`)
    lines.push(`  - MLSCO Listing Contract was found unsigned by the principal broker (Matt Ryan).`)
    lines.push(`    Sellers signed but broker signature blocks are blank. Matt has been notified to`)
    lines.push(`    re-sign via SkySlope. The unsigned version was intentionally left in the main`)
    lines.push(`    file list (not archived) pending re-execution.`)
    if (sn === '04022024AB') {
      lines.push(`  - "Caldwell Letter for 1st Street 2" was OCR-misread with sale# "Nagorski" (likely`)
      lines.push(`    bleed from another transaction). Filename was left unchanged pending review.`)
    }
    lines.push('')
    lines.push('='.repeat(80))
    lines.push('AUDIT TRAIL')
    lines.push('='.repeat(80))
    lines.push('')
    lines.push(`Generated: ${new Date().toISOString()}`)
    lines.push(`Skill: .claude/skills/skyslope-form-compliance/SKILL.md`)
    lines.push(`Report: tmp/skyslope-form-compliance-2026-05-25/f50fe2a6-report.jsonl`)
    lines.push(`Source: PDF OCR via process-folder.mjs + SkySlope API + ${cycleRecs.length} per-doc records for this sale#.`)

    const txt = lines.join('\n')
    const isFailedCycleFile = isFailedCycle
    const tag = isFailedCycleFile ? ' - Failed Cycle' : ''
    // Sanitize sale# for filename (strip slashes that OCR sometimes captures)
    const snForFilename = String(sn).replace(/[\\/]/g, '')
    const baseName = `${snForFilename}_X_Broker Notes - Transaction Summary${tag}`
    const txtPath = path.join(OUT_DIR, `${baseName}.txt`)
    const pdfPath = path.join(OUT_DIR, `${baseName}.pdf`)
    await fs.writeFile(txtPath, txt)
    try {
      await execFileAsync('python3', [TXT_TO_PDF, txtPath, pdfPath])
      console.log(`  ✓ ${baseName}`)
      console.log(`      → ${txtPath}`)
      console.log(`      → ${pdfPath}`)
    } catch (e) {
      console.log(`  ! PDF conversion failed for ${baseName}: ${e.message}`)
    }
    outputs.push({ saleNumber: sn, txtPath, pdfPath, baseName, isFailedCycle: isFailedCycleFile, isClosingCycle })
  }

  await fs.writeFile(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(outputs, null, 2))
  console.log(`\nManifest → ${path.join(OUT_DIR, 'manifest.json')}`)
  console.log(`\nReview the PDFs, then re-run with --send to forward to SkySlope.`)
  return outputs
}

// ============ STAGE 2: SEND ============

async function send() {
  const manifest = JSON.parse(await fs.readFile(path.join(OUT_DIR, 'manifest.json'), 'utf8'))
  const session = await login()
  const fr = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${SALE_GUID}`, { headers: apiHeaders(session) })
  const sale = (await fr.json()).value?.sale
  const portalEmail = sale.portalEmail
  if (!portalEmail) throw new Error('No portalEmail on sale folder')
  console.log(`portalEmail: ${portalEmail}`)

  // Gmail DWD impersonation
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL.trim(),
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.trim().replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/gmail.send'],
    subject: FROM_EMAIL,
  })
  await auth.authorize()
  const gmail = google.gmail({ version: 'v1', auth })

  // Find the Broker Notes activityId
  const activities = sale.checklist?.activities || []
  const brokerNotesAct = activities.find((a) => /broker notes/i.test(a.activityName || ''))
  if (!brokerNotesAct) throw new Error('No Broker Notes activity in checklist')
  console.log(`Broker Notes activityId: ${brokerNotesAct.activityId}`)

  for (const entry of manifest) {
    console.log(`\n=== Sending ${entry.baseName} ===`)
    const bin = await fs.readFile(entry.pdfPath)
    const b64 = bin.toString('base64').match(/.{1,76}/g).join('\r\n')
    const boundary = `----rr-${Date.now()}`
    const subject = `[712 SW 1st St ${entry.isClosingCycle ? 'Closed' : 'Failed Cycle'} forward] Broker Notes - Transaction Summary (${entry.saleNumber})`
    const filename = `${entry.baseName}.pdf`
    const message = [
      `From: ${FROM_EMAIL}`,
      `To: ${portalEmail}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      `Broker Notes - Transaction Summary for 712 SW 1st St (${entry.saleNumber}).\nGenerated 2026-05-25 audit pass via the skyslope-form-compliance skill.`,
      '',
      `--${boundary}`,
      `Content-Type: application/pdf; name="${filename}"`,
      `Content-Disposition: attachment; filename="${filename}"`,
      'Content-Transfer-Encoding: base64',
      '',
      b64,
      '',
      `--${boundary}--`,
      '',
    ].join('\r\n')
    const raw = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    const res = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } })
    console.log(`  Gmail sent: ${res.data.id}`)

    // Poll SkySlope for the new doc (filename prefix match — SkySlope appends random suffix)
    console.log(`  Polling SkySlope for ingest (up to 3 min)...`)
    let ingestedDoc = null
    const stem = entry.baseName.split('.').shift()
    for (let i = 0; i < 36; i++) { // 36 * 5s = 3min
      await new Promise((res) => setTimeout(res, 5000))
      const dr = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${SALE_GUID}/documents`, { headers: apiHeaders(session) })
      const docs = (await dr.json()).value?.documents || []
      ingestedDoc = docs.find((d) => (d.fileName || '').startsWith(stem))
      if (ingestedDoc) break
      process.stdout.write('.')
    }
    if (!ingestedDoc) {
      console.log(`\n  ! Ingest poll timed out. Doc may arrive later — check SkySlope manually + assign.`)
      continue
    }
    console.log(`\n  Ingested doc: ${ingestedDoc.docId || ingestedDoc.id}  "${ingestedDoc.fileName}"`)

    // PATCH to clean v5 filename (SkySlope appends "_NNN" suffix on ingest)
    const newDocId = ingestedDoc.docId || ingestedDoc.id
    const targetName = `${entry.baseName}.pdf`
    if (ingestedDoc.fileName !== targetName) {
      const pr = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${SALE_GUID}/documents/${newDocId}`, {
        method: 'PATCH',
        headers: apiHeaders(session),
        body: JSON.stringify({ FileName: targetName }),
      })
      console.log(`  PATCH filename → "${targetName}" HTTP ${pr.status}`)
    }

    // Assign to Broker Notes activity
    const ar = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${SALE_GUID}/checklist-items/${brokerNotesAct.activityId}`, {
      method: 'POST',
      headers: apiHeaders(session),
      body: JSON.stringify({ documentGuid: newDocId }),
    })
    console.log(`  Assign to Broker Notes activity HTTP ${ar.status}`)
  }
}

// ============ MAIN ============

if (BUILD) await build()
if (SEND) await send()
