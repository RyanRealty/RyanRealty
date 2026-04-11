#!/usr/bin/env node
/**
 * SkySlope Forms — multi-sheet Excel workbook for principal broker review.
 *
 * Pulls listing/sale **API** data (parties, property, escrow number, checklist,
 * contacts) plus every **document** row. Optional PDF sampling uses
 * `skyslope-pdf-insight.mjs` (pdf.js text layer plus mandatory OCR per read
 * window). Excerpts are **not** proof of execution; verify originals in SkySlope.
 *
 *   npm run skyslope:forms-workbook
 *   npm run skyslope:forms-workbook -- --out docs/custom.xlsx
 *
 * Env: same SKYSLOPE_* as other scripts; SKYSLOPE_INCLUDE_ARCHIVED=1 optional.
 * PDF sampling: SKYSLOPE_WORKBOOK_PDF_SAMPLE=1 (default 0 = metadata only, fast).
 * Cap: SKYSLOPE_WORKBOOK_MAX_PDFS (default 180), SKYSLOPE_MAX_PDF_BYTES (default 9MB).
 * Read window when sampling: SKYSLOPE_WORKBOOK_PDF_MAX_PAGES (default 8, max 120).
 */
import fs from 'fs'
import crypto from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'
import XLSX from 'xlsx'

import { fetchSkyslopeFileFolderRows, skyslopeFetchWithRetry } from './skyslope-files-api.mjs'
import { inferKind, parseDate } from './skyslope-forms-document-taxonomy.mjs'
import { analyzePdfBuffer, emptyPdfInsight, registerExcerpt } from './skyslope-pdf-insight.mjs'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DEFAULT_OUT = path.join(ROOT, 'docs', 'skyslope-forms-transaction-workbook.xlsx')

const BASE = 'https://api-latest.skyslope.com'
const ENV_PATH = path.join(ROOT, '.env.local')
const INCLUDE_ARCHIVED = process.env.SKYSLOPE_INCLUDE_ARCHIVED === '1'
const PDF_SAMPLE = process.env.SKYSLOPE_WORKBOOK_PDF_SAMPLE === '1'
const MAX_PDFS = Math.min(
  800,
  Math.max(0, Number.parseInt(String(process.env.SKYSLOPE_WORKBOOK_MAX_PDFS || '180'), 10) || 180)
)
const MAX_PDF_BYTES = Number(process.env.SKYSLOPE_MAX_PDF_BYTES || 9_000_000)
const WORKBOOK_PDF_MAX_PAGES = Math.min(
  120,
  Math.max(1, Number.parseInt(String(process.env.SKYSLOPE_WORKBOOK_PDF_MAX_PAGES || '8'), 10) || 8)
)

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

function safeAddress(prop) {
  if (!prop) return ''
  const line = [prop.streetNumber, prop.streetAddress, prop.unit].filter(Boolean).join(' ').trim()
  const tail = [prop.city, prop.state, prop.zip].filter(Boolean).join(' ')
  return [line, tail].filter(Boolean).join(', ')
}

async function fetchListingDetail(session, listingGuid) {
  const r = await skyslopeFetchWithRetry(`${BASE}/api/files/listings/${listingGuid}`, {
    headers: apiHeaders(session),
  })
  if (!r.ok) return null
  return r.json()
}

async function fetchSaleDetail(session, saleGuid) {
  const r = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${saleGuid}`, {
    headers: apiHeaders(session),
  })
  if (!r.ok) return null
  return r.json()
}

async function fetchDocuments(session, kind, guid) {
  const r = await skyslopeFetchWithRetry(`${BASE}/api/files/${kind}/${guid}/documents`, {
    headers: apiHeaders(session),
  })
  if (!r.ok) return []
  const j = await r.json()
  return j?.value?.documents ?? []
}

async function fetchUser(session, userGuid, cache) {
  if (!userGuid) return null
  if (cache.has(userGuid)) return cache.get(userGuid)
  await new Promise((r) => setTimeout(r, 60))
  const r = await skyslopeFetchWithRetry(`${BASE}/api/users/${userGuid}`, {
    headers: apiHeaders(session),
  })
  if (!r.ok) {
    cache.set(userGuid, { _error: `HTTP_${r.status}` })
    return cache.get(userGuid)
  }
  const j = await r.json()
  const u = j?.value?.users?.[0] ?? null
  cache.set(userGuid, u || { _error: 'empty' })
  return cache.get(userGuid)
}

function fmtIsoDate(val) {
  if (!val) return ''
  const t = Date.parse(val)
  if (!Number.isFinite(t)) return String(val)
  return new Date(t).toISOString().slice(0, 10)
}

function oneLine(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4000)
}

/** Flatten any contact-shaped DTO into a row scaffold. */
function contactToPartyRow(ctx, role, indexLabel, obj, sourcePath) {
  if (!obj || typeof obj !== 'object') return null
  const fn = [obj.firstName, obj.lastName].filter(Boolean).join(' ').trim()
  const display = fn || obj.company || obj.fullName || ''
  const line1 = [obj.streetNumber, obj.streetName].filter(Boolean).join(' ').trim()
  return {
    file_folder_type: ctx.folderType,
    file_folder_guid: ctx.folderGuid,
    property_address: ctx.address,
    mls_number: ctx.mls,
    folder_status: ctx.status,
    party_role: role,
    party_index: indexLabel,
    display_name: display,
    first_name: obj.firstName || '',
    last_name: obj.lastName || '',
    company: obj.company || '',
    email: obj.email || '',
    phone: obj.phoneNumber || obj.phone || '',
    alternate_phone: obj.alternatePhone || '',
    fax: obj.fax || '',
    address_line1: line1,
    city: obj.city || '',
    state: obj.state || '',
    zip: obj.zip || obj.zipCode || '',
    contact_guid: obj.contactGuid || obj.userGuid || '',
    notes: oneLine(
      [obj.notes, obj.isCashDeal === true ? 'cash_deal:true' : '', obj.loanType, obj.loanAmount != null ? `loanAmount:${obj.loanAmount}` : '']
        .filter(Boolean)
        .join(' | ')
    ),
    broker_tax_id: obj.brokerTaxId || '',
    data_source: sourcePath,
  }
}

function pushPartyRows(rows, ctx, rolePrefix, arr, sourcePath) {
  if (!Array.isArray(arr)) return
  arr.forEach((item, i) => {
    const r = contactToPartyRow(ctx, `${rolePrefix}`, String(i + 1), item, `${sourcePath}[${i}]`)
    if (r && (r.display_name || r.email || r.phone || r.contact_guid)) rows.push(r)
  })
}

function collectDateLeaves(obj, prefix, out, depth, seen) {
  if (depth > 8 || obj == null) return
  if (typeof obj !== 'object') return
  if (seen.has(obj)) return
  seen.add(obj)
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v == null) continue
    if (typeof v === 'string' && /date|on$/i.test(k) && v.length >= 8 && /\d{4}-\d{2}-\d{2}/.test(v)) {
      out.push({ field: path, raw: v, date_only: fmtIsoDate(v) })
    } else if (typeof v === 'object' && !Array.isArray(v)) {
      collectDateLeaves(v, path, out, depth + 1, seen)
    } else if (Array.isArray(v) && v.length && v.length < 80 && typeof v[0] === 'object') {
      v.forEach((item, idx) => collectDateLeaves(item, `${path}[${idx}]`, out, depth + 1, seen))
    }
  }
}

function extractSaleAgreementNumber(text) {
  const t = String(text || '').replace(/\s+/g, ' ')
  const patterns = [
    /SALE\s+AGREEMENT\s*#\s*([A-Za-z0-9\-._/]+)/i,
    /Sale\s+Agreement\s*#\s*([A-Za-z0-9\-._/]+)/i,
    /RSA\s*#\s*([A-Za-z0-9\-._/]+)/i,
    /Transaction\s*ID\s*[:#]?\s*([A-Za-z0-9\-._]+)/i,
  ]
  for (const re of patterns) {
    const m = t.match(re)
    if (m?.[1]) return m[1].slice(0, 120)
  }
  return ''
}

function extractTitleFileHint(text) {
  const t = String(text || '').replace(/\s+/g, ' ')
  const m =
    t.match(/File\s*No\.?\s*:?\s*([A-Za-z0-9\-._]+)/i) ||
    t.match(/File\s*#\s*([A-Za-z0-9\-._]+)/i) ||
    t.match(/Order\s*Number\s*([A-Za-z0-9\-._]+)/i)
  return m?.[1] ? m[1].slice(0, 120) : ''
}

function extractAppraisalHint(text) {
  const t = String(text || '').slice(0, 8000)
  if (/appraisal/i.test(t) && /(value|market|subject|effective date|USPAP)/i.test(t)) {
    return oneLine(t.slice(0, 900))
  }
  return ''
}

function extractInspectionHint(text) {
  const t = String(text || '').slice(0, 12000)
  if (/inspection|deficien|repair|recommend/i.test(t)) {
    return oneLine(t.slice(0, 900))
  }
  return ''
}

function sheetFromAoA(rows) {
  const ws = XLSX.utils.aoa_to_sheet(rows)
  const colCount = rows[0]?.length || 0
  ws['!cols'] = Array.from({ length: colCount }, () => ({ wch: 18 }))
  return ws
}

function sheetFromJson(objs, headers) {
  if (!headers.length) return XLSX.utils.aoa_to_sheet([['(no rows)']])
  const rows = [headers, ...objs.map((o) => headers.map((h) => o[h] ?? ''))]
  return sheetFromAoA(rows)
}

function appendGuideSheet(wb) {
  const lines = [
    ['SkySlope Forms transaction workbook'],
    [''],
    ['Generated from api-latest.skyslope.com listing/sale Files API + document library.'],
    ['This is NOT SkySlope Suite data. Parties come from API contact blocks; PDF_sample uses pdf.js plus OCR (see skyslope-pdf-insight.mjs), not proof of execution.'],
    [''],
    ['Sheets:'],
    ['  Folders — one row per listing file or sale file (transaction cabinet).'],
    ['  Parties — sellers, buyers, title, escrow, lender, agents (from API + /api/users for agentGuid).'],
    ['  Documents — every uploaded document with dates and inferred category.'],
    ['  Dates_index — flattened date-like fields from listing/sale JSON (cross-check UI).'],
    ['  Checklist — checklist activities when API returns them.'],
    ['  Negotiation_docs — offer, counter, RSA-shaped documents in upload order.'],
    ['  PDF_sample — optional dual pipeline extracts (SKYSLOPE_WORKBOOK_PDF_SAMPLE=1; cap pages with SKYSLOPE_WORKBOOK_PDF_MAX_PAGES).'],
    [''],
    ['Appraiser / inspection outcomes:'],
    ['  Prefer checklist activity names and Documents rows. PDF_sample (optional) adds merged text and pipeline summary only.'],
    [''],
    ['Sale agreement / transaction numbers:'],
    ['  API exposes escrow_number on sales. RSA serial on the form is often only in the PDF; use PDF_sample or open the file.'],
    [''],
    ['Verify execution, IDs, and appraisal/inspection conclusions in the original PDFs and in escrow.'],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(lines), 'Read_me_first')
}

async function main() {
  const argv = process.argv.slice(2)
  let outPath = DEFAULT_OUT
  const oi = argv.indexOf('--out')
  if (oi >= 0 && argv[oi + 1]) outPath = path.resolve(argv[oi + 1])

  const env = loadEnvLocal(ENV_PATH)
  const session = await login(env)
  const userCache = new Map()

  const listingRows = await fetchSkyslopeFileFolderRows(
    session,
    BASE,
    'listings',
    () => apiHeaders(session),
    INCLUDE_ARCHIVED
  )
  const saleRows = await fetchSkyslopeFileFolderRows(
    session,
    BASE,
    'sales',
    () => apiHeaders(session),
    INCLUDE_ARCHIVED
  )

  const folders = []
  for (const L of listingRows) {
    const guid = L.listingGuid
    const [detailJson, documents] = await Promise.all([
      fetchListingDetail(session, guid),
      fetchDocuments(session, 'listings', guid),
    ])
    const listing = detailJson?.value?.listing ?? null
    const address =
      L.propertyAddress ||
      safeAddress(listing?.property) ||
      [listing?.property?.streetNumber, listing?.property?.streetAddress].filter(Boolean).join(' ')
    folders.push({
      folderType: 'listing',
      folderGuid: guid,
      listRow: L,
      detail: listing,
      address,
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
    const address = S.propertyAddress || safeAddress(sale?.property) || ''
    folders.push({
      folderType: 'sale',
      folderGuid: guid,
      listRow: S,
      detail: sale,
      address,
      documents,
    })
  }

  /** @type {object[]} */
  const partyOut = []
  /** @type {object[]} */
  const docOut = []
  /** @type {object[]} */
  const dateOut = []
  /** @type {object[]} */
  const checklistOut = []
  /** @type {object[]} */
  const negotiationOut = []
  /** @type {object[]} */
  const folderOut = []
  /** @type {{folder:object, doc:object, priority:number}[]} */
  const pdfJobs = []

  for (const f of folders) {
    const d = f.detail
    const mls = f.folderType === 'listing' ? d?.mlsNumber || f.listRow?.mlsNumber || '' : d?.mlsNumber || f.listRow?.mlsNumber || ''
    const status = f.folderType === 'listing' ? d?.status || f.listRow?.status || '' : d?.status || f.listRow?.status || ''
    const stage = d?.stage || ''

    const ctx = {
      folderType: f.folderType,
      folderGuid: f.folderGuid,
      address: f.address,
      mls,
      status,
    }

    const dates = []
    collectDateLeaves(d, f.folderType === 'listing' ? 'listing' : 'sale', dates, 0, new WeakSet())
    for (const dt of dates) {
      dateOut.push({
        file_folder_type: f.folderType,
        file_folder_guid: f.folderGuid,
        property_address: f.address,
        mls_number: mls,
        date_field: dt.field,
        date_only: dt.date_only,
        raw_value: dt.raw,
      })
    }

    if (f.folderType === 'listing' && d) {
      pushPartyRows(partyOut, ctx, 'Seller', d.sellers, 'listing.sellers')
      const ag = await fetchUser(session, d.agentGuid, userCache)
      if (ag && !ag._error) {
        partyOut.push({
          ...contactToPartyRow(ctx, 'Listing agent (API user)', '1', ag, 'GET /api/users/{listing.agentGuid}'),
          email: ag.email || '',
          phone: ag.phone || '',
          company: '',
        })
      } else if (d.agentGuid) {
        partyOut.push({
          file_folder_type: f.folderType,
          file_folder_guid: f.folderGuid,
          property_address: f.address,
          mls_number: mls,
          folder_status: status,
          party_role: 'Listing agent (unresolved)',
          party_index: '1',
          display_name: '',
          contact_guid: d.agentGuid,
          data_source: 'listing.agentGuid',
          notes: ag?._error || 'fetch_failed',
        })
      }
      if (d.coListingAgentGuid) {
        const co = await fetchUser(session, d.coListingAgentGuid, userCache)
        const row = contactToPartyRow(ctx, 'Co-listing agent (API user)', '1', co || {}, 'listing.coListingAgentGuid')
        if (row && co && !co._error) partyOut.push({ ...row, email: co.email || '', phone: co.phone || '' })
      }
      if (Array.isArray(d.coAgentGuids)) {
        let i = 0
        for (const gid of d.coAgentGuids) {
          i++
          const u = await fetchUser(session, gid, userCache)
          if (u && !u._error) {
            partyOut.push({
              ...contactToPartyRow(ctx, 'Co-agent (API user)', String(i), u, `listing.coAgentGuids[${i}]`),
              email: u.email || '',
              phone: u.phone || '',
            })
          }
        }
      }
      if (d.referringAgentGuid) {
        const ref = await fetchUser(session, d.referringAgentGuid, userCache)
        if (ref && !ref._error) {
          partyOut.push({
            ...contactToPartyRow(ctx, 'Referring agent (API user)', '1', ref, 'listing.referringAgentGuid'),
            email: ref.email || '',
            phone: ref.phone || '',
          })
        }
      }
      const comm = d.commission
      if (comm?.transactionCoordinatorName) {
        partyOut.push({
          file_folder_type: f.folderType,
          file_folder_guid: f.folderGuid,
          property_address: f.address,
          mls_number: mls,
          folder_status: status,
          party_role: 'Transaction coordinator (commission block)',
          party_index: '1',
          display_name: comm.transactionCoordinatorName,
          notes: oneLine(
            `Fee: ${comm.transactionCoordinatorFee ?? ''}; adminBrokerageComp: ${comm.adminBrokerageComp ?? ''}`
          ),
          data_source: 'listing.commission',
        })
      }
      if (d.miscContact) {
        const r = contactToPartyRow(ctx, 'Misc contact (listing)', '1', d.miscContact, 'listing.miscContact')
        if (r) partyOut.push(r)
      }
      const lch = d.checklist
      const lact = lch?.activities || []
      lact.forEach((act, idx) => {
        checklistOut.push({
          file_folder_type: f.folderType,
          file_folder_guid: f.folderGuid,
          property_address: f.address,
          mls_number: mls,
          activity_order: act.order ?? idx + 1,
          activity_name: act.activityName || '',
          activity_status: act.status || '',
          type_name: act.typeName || '',
          modified_on: act.modifiedOn || '',
          help_text: oneLine(act.help || ''),
          checklist_doc_links: Array.isArray(act.checklistDocs) ? act.checklistDocs.join('; ') : '',
          activity_doc_links: Array.isArray(act.docs) ? act.docs.join('; ') : '',
        })
      })
    }

    if (f.folderType === 'sale' && d) {
      pushPartyRows(partyOut, ctx, 'Seller', d.sellers, 'sale.sellers')
      pushPartyRows(partyOut, ctx, 'Buyer', d.buyers, 'sale.buyers')
      const rTitle = contactToPartyRow(ctx, 'Title (sale)', '1', d.titleContact, 'sale.titleContact')
      if (rTitle) partyOut.push(rTitle)
      const rEsc = contactToPartyRow(ctx, 'Escrow (sale)', '1', d.escrowContact, 'sale.escrowContact')
      if (rEsc) partyOut.push(rEsc)
      const rLen = contactToPartyRow(ctx, 'Lender (sale)', '1', d.lenderContact, 'sale.lenderContact')
      if (rLen) partyOut.push(rLen)
      pushPartyRows(partyOut, ctx, 'Attorney', d.attorneyContact, 'sale.attorneyContact')
      const oth = contactToPartyRow(ctx, 'Other-side agent', '1', d.otherSideAgentContact, 'sale.otherSideAgentContact')
      if (oth) partyOut.push(oth)
      const hw = contactToPartyRow(ctx, 'Home warranty', '1', d.homeWarrantyContact, 'sale.homeWarrantyContact')
      if (hw) partyOut.push(hw)
      const misc = contactToPartyRow(ctx, 'Misc contact (sale)', '1', d.miscContact, 'sale.miscContact')
      if (misc) partyOut.push(misc)

      const ag = await fetchUser(session, d.agentGuid, userCache)
      if (ag && !ag._error) {
        partyOut.push({
          ...contactToPartyRow(ctx, 'Sale-side agent (API user)', '1', ag, 'GET /api/users/{sale.agentGuid}'),
          email: ag.email || '',
          phone: ag.phone || '',
        })
      } else if (d.agentGuid) {
        partyOut.push({
          file_folder_type: f.folderType,
          file_folder_guid: f.folderGuid,
          property_address: f.address,
          mls_number: mls,
          folder_status: status,
          party_role: 'Sale-side agent (unresolved)',
          party_index: '1',
          contact_guid: d.agentGuid,
          data_source: 'sale.agentGuid',
          notes: ag?._error || 'fetch_failed',
        })
      }
      if (Array.isArray(d.coAgentGuids)) {
        let i = 0
        for (const gid of d.coAgentGuids) {
          i++
          const u = await fetchUser(session, gid, userCache)
          if (u && !u._error) {
            partyOut.push({
              ...contactToPartyRow(ctx, 'Co-agent (API user)', String(i), u, `sale.coAgentGuids[${i}]`),
              email: u.email || '',
              phone: u.phone || '',
            })
          }
        }
      }
      if (Array.isArray(d.transactionCoordinators)) {
        d.transactionCoordinators.forEach((tc, i) => {
          const r = contactToPartyRow(
            ctx,
            'Transaction coordinator (sale TC list)',
            String(i + 1),
            tc,
            `sale.transactionCoordinators[${i}]`
          )
          if (r) partyOut.push({ ...r, notes: [r.notes, tc.fee != null ? `fee:${tc.fee}` : ''].filter(Boolean).join(' | ') })
        })
      }
      const comm = d.commission
      if (comm?.transactionCoordinatorName) {
        partyOut.push({
          file_folder_type: f.folderType,
          file_folder_guid: f.folderGuid,
          property_address: f.address,
          mls_number: mls,
          folder_status: status,
          party_role: 'Transaction coordinator (commission block)',
          party_index: '1',
          display_name: comm.transactionCoordinatorName,
          notes: oneLine(`Fee: ${comm.transactionCoordinatorFee ?? ''}`),
          data_source: 'sale.commission',
        })
      }

      const ch = d.checklist
      const acts = ch?.activities || []
      acts.forEach((act, idx) => {
        checklistOut.push({
          file_folder_type: f.folderType,
          file_folder_guid: f.folderGuid,
          property_address: f.address,
          mls_number: mls,
          activity_order: act.order ?? idx + 1,
          activity_name: act.activityName || '',
          activity_status: act.status || '',
          type_name: act.typeName || '',
          modified_on: act.modifiedOn || '',
          help_text: oneLine(act.help || ''),
          checklist_doc_links: Array.isArray(act.checklistDocs) ? act.checklistDocs.join('; ') : '',
          activity_doc_links: Array.isArray(act.docs) ? act.docs.join('; ') : '',
        })
      })
    }

    const sortedDocs = [...f.documents].sort((a, b) => {
      const ta = parseDate(a.uploadDate) ?? parseDate(a.modifiedDate) ?? 0
      const tb = parseDate(b.uploadDate) ?? parseDate(b.modifiedDate) ?? 0
      return ta - tb
    })

    let seq = 0
    let offerish = 0
    let counters = 0
    let rsa = 0
    let insp = 0
    let appr = 0
    let titleish = 0
    /** Most recent RSA-style doc seen earlier in this folder (upload order). */
    let priorRsaFileName = ''
    let priorRsaUploadDate = ''

    for (const doc of sortedDocs) {
      seq += 1
      const fn = doc.fileName || doc.name || ''
      const kind = inferKind(fn, doc.name)
      if (kind === 'buyer_offer_or_package') offerish++
      if (kind === 'counter_or_counteroffer' || kind === 'numbered_counter') counters++
      if (kind === 'sale_agreement_or_rsa') rsa++
      if (kind === 'inspection_or_repair') insp++
      if (/appraisal/i.test(fn)) appr++
      if (kind === 'title_or_hoa') titleish++
      if (kind === 'sale_agreement_or_rsa') {
        priorRsaFileName = fn
        priorRsaUploadDate = doc.uploadDate || doc.modifiedDate || ''
      }

      docOut.push({
        file_folder_type: f.folderType,
        file_folder_guid: f.folderGuid,
        property_address: f.address,
        mls_number: mls,
        folder_status: status,
        doc_sequence: seq,
        document_id: doc.id || doc.documentGuid || '',
        file_name: fn,
        name_field: doc.name || '',
        extension: doc.extension || '',
        upload_date: doc.uploadDate || '',
        modified_date: doc.modifiedDate || '',
        file_size: doc.fileSize ?? '',
        pages_api: doc.pages ?? '',
        has_download_url: doc.url ? 'yes' : 'no',
        inferred_category: kind,
        listing_guid_if_sale: f.folderType === 'sale' ? d?.listingGuid || '' : '',
        escrow_number_api: f.folderType === 'sale' ? d?.escrowNumber || '' : '',
      })

      const isNeg =
        kind === 'buyer_offer_or_package' ||
        kind === 'sale_agreement_or_rsa' ||
        kind === 'counter_or_counteroffer' ||
        kind === 'numbered_counter' ||
        kind === 'addendum'
      if (isNeg) {
        negotiationOut.push({
          file_folder_type: f.folderType,
          file_folder_guid: f.folderGuid,
          property_address: f.address,
          mls_number: mls,
          seq_in_folder: seq,
          upload_date: doc.uploadDate || '',
          file_name: fn,
          inferred_category: kind,
          counter_number_guess: (fn.match(/counter\s*offer\s*no\.?\s*(\d+)/i) || fn.match(/counter\s*(\d+)/i) || [])[1] || '',
          prior_rsa_or_contract_stack_file_name: priorRsaFileName,
          prior_rsa_or_contract_stack_upload_date: priorRsaUploadDate,
          linkage_note:
            'Prior RSA column is the latest RSA-shaped upload before this row in the same folder. If multiple stacks exist, confirm against PDF sale agreement numbers and escrow.',
        })
      }

      if (PDF_SAMPLE && pdfJobs.length < MAX_PDFS) {
        const ext = (doc.extension || '').toLowerCase()
        const isPdf = ext === 'pdf' || fn.toLowerCase().endsWith('.pdf')
        if (!isPdf || !doc.url) continue
        let pr = 5
        if (kind === 'sale_agreement_or_rsa') pr = 100
        else if (kind === 'counter_or_counteroffer' || kind === 'numbered_counter') pr = 90
        else if (kind === 'buyer_offer_or_package') pr = 85
        else if (kind === 'title_or_hoa') pr = 70
        else if (kind === 'inspection_or_repair') pr = 65
        else if (/appraisal/i.test(fn)) pr = 65
        if (pr >= 60) pdfJobs.push({ folder: f, doc, priority: pr, kind, fn })
      }
    }

    pdfJobs.sort((a, b) => b.priority - a.priority)

    folderOut.push({
      file_folder_type: f.folderType,
      file_folder_guid: f.folderGuid,
      property_address: f.address,
      mls_number: mls,
      folder_status: status,
      stage,
      listing_guid_if_sale: f.folderType === 'sale' ? d?.listingGuid || '' : '',
      escrow_number: f.folderType === 'sale' ? d?.escrowNumber || '' : '',
      contract_acceptance_date: f.folderType === 'sale' ? d?.contractAcceptanceDate || '' : '',
      actual_closing_date: f.folderType === 'sale' ? d?.actualClosingDate || '' : '',
      escrow_closing_date: f.folderType === 'sale' ? d?.escrowClosingDate || '' : '',
      created_on: d?.createdOn || '',
      dead_date: d?.deadDate || '',
      portal_email: f.folderType === 'sale' ? d?.portalEmail || '' : d?.listingEmail || '',
      document_count: f.documents.length,
      count_offer_like_docs: offerish,
      count_counter_like_docs: counters,
      count_rsa_like_docs: rsa,
      count_inspection_like_docs: insp,
      count_appraisal_filename: appr,
      count_title_hoa_like_docs: titleish,
      co_broker_company: f.folderType === 'sale' ? d?.coBrokerCompany || '' : '',
      deal_type: f.folderType === 'sale' ? d?.dealType || '' : '',
      custom_fields_json_truncated: d?.customFields
        ? oneLine(JSON.stringify(d.customFields).slice(0, 2000))
        : '',
    })
  }

  /** @type {object[]} */
  const pdfOut = []
  if (PDF_SAMPLE && pdfJobs.length) {
    let done = 0
    for (const job of pdfJobs.slice(0, MAX_PDFS)) {
      const { folder, doc, kind, fn } = job
      const d = folder.detail
      const mls = folder.folderType === 'listing' ? d?.mlsNumber || '' : d?.mlsNumber || ''
      let excerpt = ''
      let saleNo = ''
      let titleHint = ''
      let apprHint = ''
      let inspHint = ''
      let ok = false
      let reason = ''
      let insight = emptyPdfInsight('')
      try {
        const r = await fetch(doc.url)
        const buf = Buffer.from(await r.arrayBuffer())
        if (buf.length > MAX_PDF_BYTES) {
          reason = `oversize_${buf.length}`
          insight = emptyPdfInsight(reason)
        } else if (buf.slice(0, 4).toString() !== '%PDF') {
          reason = 'not_pdf'
          insight = emptyPdfInsight('not_pdf_bytes')
        } else {
          insight = await analyzePdfBuffer(buf, {
            maxPages: WORKBOOK_PDF_MAX_PAGES,
            ocrMaxPages: WORKBOOK_PDF_MAX_PAGES,
          })
          ok = insight.ok
          if (!insight.ok) reason = insight.reason || 'insight_fail'
          const text = insight.text || ''
          excerpt = oneLine(registerExcerpt(insight, 1200))
          saleNo = extractSaleAgreementNumber(text)
          titleHint = extractTitleFileHint(text)
          apprHint = extractAppraisalHint(text)
          inspHint = extractInspectionHint(text)
        }
      } catch (e) {
        reason = e.message || String(e)
        insight = emptyPdfInsight(reason)
      }
      pdfOut.push({
        file_folder_type: folder.folderType,
        file_folder_guid: folder.folderGuid,
        property_address: folder.address,
        mls_number: mls,
        file_name: fn,
        inferred_category: kind,
        pdf_parse_ok: ok ? 'yes' : 'no',
        parse_note: reason,
        pdf_page_count: insight.pageCount || 0,
        pdf_pages_read: insight.pagesAnalyzed || 0,
        pdf_pipeline_summary: insight.flagsLine || '',
        sale_agreement_or_transaction_id_text_guess: saleNo,
        title_file_or_order_number_text_guess: titleHint,
        appraisal_excerpt_hint: apprHint,
        inspection_excerpt_hint: inspHint,
        text_excerpt: excerpt,
      })
      done++
      if (done % 20 === 0) console.error(`[workbook] PDF sample ${done}/${Math.min(MAX_PDFS, pdfJobs.length)}`)
    }
  }

  const wb = XLSX.utils.book_new()
  appendGuideSheet(wb)

  const folderHeaders = Object.keys(folderOut[0] || {})
  if (folderOut.length) XLSX.utils.book_append_sheet(wb, sheetFromJson(folderOut, folderHeaders), 'Folders')

  const partyHeaders = [
    'file_folder_type',
    'file_folder_guid',
    'property_address',
    'mls_number',
    'folder_status',
    'party_role',
    'party_index',
    'display_name',
    'first_name',
    'last_name',
    'company',
    'email',
    'phone',
    'alternate_phone',
    'fax',
    'address_line1',
    'city',
    'state',
    'zip',
    'contact_guid',
    'broker_tax_id',
    'notes',
    'data_source',
  ]
  XLSX.utils.book_append_sheet(wb, sheetFromJson(partyOut, partyHeaders), 'Parties')

  const docHeaders = Object.keys(docOut[0] || {})
  if (docOut.length) XLSX.utils.book_append_sheet(wb, sheetFromJson(docOut, docHeaders), 'Documents')

  const dateHeaders = Object.keys(dateOut[0] || {})
  if (dateOut.length) XLSX.utils.book_append_sheet(wb, sheetFromJson(dateOut, dateHeaders), 'Dates_index')

  const chHeaders = Object.keys(checklistOut[0] || {})
  if (checklistOut.length) XLSX.utils.book_append_sheet(wb, sheetFromJson(checklistOut, chHeaders), 'Checklist')

  const negHeaders = Object.keys(negotiationOut[0] || {})
  if (negotiationOut.length) XLSX.utils.book_append_sheet(wb, sheetFromJson(negotiationOut, negHeaders), 'Negotiation_docs')

  const pdfHeaders = Object.keys(pdfOut[0] || {})
  if (pdfOut.length) XLSX.utils.book_append_sheet(wb, sheetFromJson(pdfOut, pdfHeaders), 'PDF_sample')

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  XLSX.writeFile(wb, outPath)

  console.error(
    JSON.stringify({
      ok: true,
      outPath,
      folders: folders.length,
      party_rows: partyOut.length,
      document_rows: docOut.length,
      date_rows: dateOut.length,
      checklist_rows: checklistOut.length,
      negotiation_rows: negotiationOut.length,
      pdf_sample_rows: pdfOut.length,
      pdf_sample_enabled: PDF_SAMPLE,
    })
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
