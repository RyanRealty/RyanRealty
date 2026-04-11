#!/usr/bin/env node
/**
 * SkySlope Forms — principal broker **Word** brief (organized by listing docs,
 * buyer-agency docs, then transactions by address and sale agreement number).
 *
 *   npm run skyslope:forms-brief
 *   npm run skyslope:forms-brief -- --out ~/Downloads/brief.docx
 *
 * Omits internal SkySlope document GUIDs. Sale agreement numbers come from PDF
 * text when extractable (verify in forms). Env: SKYSLOPE_*; optional
 * SKYSLOPE_BRIEF_MAX_PDFS (default 320) for SA# / execution text sampling.
 */
import fs from 'fs'
import crypto from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import {
  Document,
  HeadingLevel,
  LineRuleType,
  Packer,
  PageBreak,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'

import { fetchSkyslopeFileFolderRows, skyslopeFetchWithRetry } from './skyslope-files-api.mjs'
import { inferKind, parseDate, fmtDate, wordSectionForKind } from './skyslope-forms-document-taxonomy.mjs'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DEFAULT_OUT = path.join(ROOT, 'docs', 'skyslope-forms-principal-brief.docx')

const BASE = 'https://api-latest.skyslope.com'
const ENV_PATH = path.join(ROOT, '.env.local')
const INCLUDE_ARCHIVED = process.env.SKYSLOPE_INCLUDE_ARCHIVED === '1'
const MAX_PDF_BYTES = Number(process.env.SKYSLOPE_MAX_PDF_BYTES || 9_000_000)
const MAX_PDFS = Math.min(
  600,
  Math.max(0, Number.parseInt(String(process.env.SKYSLOPE_BRIEF_MAX_PDFS || '320'), 10) || 320)
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

function redactContacts(s) {
  if (!s || typeof s !== 'string') return s
  return s
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email redacted]')
    .replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[phone redacted]')
}

function extractSignatoryHints(text, max = 8) {
  const t = redactContacts(String(text || '').replace(/\s+/g, ' '))
  const names = new Set()
  const reDigi = /DigiSign Verified[^\n]{0,80}?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g
  let m
  while ((m = reDigi.exec(t)) !== null) {
    const n = m[1]?.trim()
    if (n && n.length < 50 && !/Verified|DigiSign/i.test(n)) names.add(n)
    if (names.size >= max) break
  }
  return [...names].slice(0, max)
}

function executionBrief(kind, text, fileName) {
  const t = `${text || ''} ${fileName || ''}`
  const digi = (t.match(/DigiSign Verified/gi) || []).length
  const hasSigLabels = /Seller Initial|Buyer Initial|Signature|By:/i.test(t)
  const thin = String(text || '').replace(/\s+/g, '').length < 80

  if (kind === 'listing_agreement' || kind === 'agency_disclosure_pamphlet') {
    if (thin)
      return { label: 'Scanned or little text', detail: 'Open the PDF in SkySlope to confirm seller and firm signatures.' }
    if (digi >= 2 || hasSigLabels)
      return {
        label: 'Looks like seller side may be done',
        detail: 'The file text shows signature language or e-sign stamps. You still confirm every line that must be signed.',
      }
    return { label: 'Could not tell from text', detail: 'Open the PDF to confirm seller and firm execution.' }
  }
  if (kind === 'buyer_representation_agreement') {
    if (thin)
      return { label: 'Scanned or little text', detail: 'Open the PDF to confirm buyer and firm signatures.' }
    if (digi >= 1)
      return {
        label: 'Looks like buyer side activity',
        detail: 'E-sign stamps appeared in the text layer. Confirm buyer and firm lines on the form.',
      }
    return { label: 'Could not tell from text', detail: 'Open the PDF to confirm buyer and firm execution.' }
  }
  if (
    kind === 'buyer_offer_or_package' ||
    kind === 'sale_agreement_or_rsa' ||
    kind === 'numbered_counter' ||
    kind === 'counter_or_counteroffer' ||
    kind === 'addendum'
  ) {
    if (thin)
      return {
        label: 'Scanned or image heavy',
        detail: 'Little readable text. Mutual deals need you to open the PDF and check both sides.',
      }
    if (digi >= 4 && hasSigLabels)
      return {
        label: 'Looks like several parties signed',
        detail: 'Many e-sign markers. Map each to buyer, seller, and firm blocks in the PDF.',
      }
    if (digi >= 1)
      return {
        label: 'Some e-sign activity',
        detail: 'Not all initials may be done. Compare to the checklist in SkySlope.',
      }
    return { label: 'Could not tell from text', detail: 'Open the PDF for buyer versus seller obligations.' }
  }
  if (kind === 'lender_financing') {
    return { label: 'Lender or buyer side form', detail: 'Usually buyer or lender signs. Match to the form instructions.' }
  }
  return { label: 'Open in SkySlope', detail: 'Classify by the form title and your office checklist.' }
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
    if (m?.[1]) return m[1].slice(0, 120).trim()
  }
  return ''
}

function extractSaFromFilename(fn) {
  const s = String(fn || '')
  const m =
    s.match(/(?:^|[^A-Z0-9])(?:SA|RSA)\s*[#\s-]*([A-Z0-9][A-Z0-9\-._]*)/i) ||
    s.match(/Sale\s*Agreement\s*#\s*([A-Z0-9\-._]+)/i)
  return m?.[1] ? m[1].slice(0, 80) : ''
}

function normalizeAddrKey(addr) {
  return String(addr || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 96)
}

function folderActivityTs(detail) {
  const candidates = [
    detail?.contractAcceptanceDate,
    detail?.actualClosingDate,
    detail?.createdOn,
    detail?.listingDate,
    detail?.checklistModifiedOn,
  ].filter(Boolean)
  let best = 0
  for (const c of candidates) {
    const t = parseDate(c) || 0
    if (t > best) best = t
  }
  return best || 0
}

function formatPartyNames(arr) {
  if (!Array.isArray(arr) || !arr.length) return ''
  return arr
    .map((p) => {
      const n = [p.firstName, p.lastName].filter(Boolean).join(' ').trim()
      return n || p.company || ''
    })
    .filter(Boolean)
    .join('; ')
}

async function mapPool(items, concurrency, fn) {
  const ret = new Array(items.length)
  let i = 0
  async function worker() {
    while (true) {
      const idx = i++
      if (idx >= items.length) break
      ret[idx] = await fn(items[idx], idx)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()))
  return ret
}

const FONT_BODY = 24
const FONT_SMALL = 22
const FONT_H1 = 36
const FONT_H2 = 30
const FONT_H3 = 26

function kindFriendlyLabel(kind) {
  const m = {
    listing_agreement: 'Listing agreement',
    agency_disclosure_pamphlet: 'Initial agency pamphlet',
    buyer_representation_agreement: 'Buyer representation or buyer agency',
    buyer_offer_or_package: 'Buyer offer or purchase package',
    sale_agreement_or_rsa: 'Residential sale agreement (RSA)',
    counter_or_counteroffer: 'Counteroffer',
    numbered_counter: 'Numbered counteroffer',
    addendum: 'Addendum',
    termination_or_release: 'Termination or release',
    lender_financing: 'Lender or financing',
    title_or_hoa: 'Title or HOA',
    inspection_or_repair: 'Inspection or repair',
    seller_property_disclosure: 'Seller property disclosure',
    earnest_or_wire: 'Earnest money or wire',
    amendment_or_notice: 'Amendment or notice',
    closing_adjacent: 'Closing related',
    other_pdf: 'Other PDF',
    other: 'Other',
  }
  return m[kind] || String(kind || '').replace(/_/g, ' ')
}

function p(text, runOpts = {}) {
  return new Paragraph({
    children: [new TextRun({ text: String(text), size: FONT_BODY, ...runOpts })],
    spacing: { after: 220, line: 300, lineRule: LineRuleType.AUTO },
  })
}

function pBoldLead(lead, rest) {
  return new Paragraph({
    spacing: { after: 200, line: 300, lineRule: LineRuleType.AUTO },
    children: [
      new TextRun({ text: lead, bold: true, size: FONT_BODY }),
      new TextRun({ text: ' ' + rest, size: FONT_BODY }),
    ],
  })
}

function h(level, text) {
  const hl = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3][level - 1]
  const sizes = [FONT_H1, FONT_H2, FONT_H3]
  return new Paragraph({
    heading: hl,
    children: [new TextRun({ text: String(text), bold: true, size: sizes[level - 1] })],
    spacing: { before: level === 1 ? 360 : 280, after: 200 },
  })
}

function h4(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_4,
    children: [new TextRun({ text: String(text), bold: true, size: FONT_BODY })],
    spacing: { before: 200, after: 140 },
  })
}

function glossaryParagraphs() {
  return [
    h(2, 'How to read this brief'),
    pBoldLead(
      'What is the automated signature check?',
      'The script reads the text layer inside many PDFs (when it is not a flat scan) and looks for e-sign vendor stamps such as DigiSign and words like Signature or Initial. That produces a plain English guess in the table. It is only a filing aid so you can spot which documents might need review first. It is not a determination that a form is fully executed under Oregon practice, and it is not a substitute for you confirming every required signature and initial on the original in SkySlope.'
    ),
    pBoldLead(
      'Why you do not see internal document IDs here.',
      'SkySlope internal IDs are hidden in this Word version on purpose. Use file name and date. Sale agreement numbers come from PDF text or the file name when the script can read them. If a number is blank, open the Residential Sale Agreement in SkySlope and read the number on the top right of the OREF form.'
    ),
    pBoldLead('Tables.', 'Each property or sale agreement block uses a table with clear columns so you can scan down one row per document.'),
    new Paragraph({ spacing: { after: 280 }, children: [] }),
  ]
}

function tableForDocuments(rows) {
  const pct = (n) => ({ size: n, type: WidthType.PERCENTAGE })
  const headers = ['Date', 'File name', 'Form type', 'Automated signature check', 'Names seen in PDF text']
  const widths = [10, 28, 14, 30, 18]
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map(
      (text, i) =>
        new TableCell({
          width: pct(widths[i]),
          margins: { top: 100, bottom: 100, left: 140, right: 140 },
          shading: { fill: 'EEEEEE', type: ShadingType.CLEAR },
          children: [
            new Paragraph({
              children: [new TextRun({ text, bold: true, size: FONT_SMALL })],
            }),
          ],
        })
    ),
  })
  function cell(text, i) {
    return new TableCell({
      width: pct(widths[i]),
      margins: { top: 90, bottom: 90, left: 140, right: 140 },
      children: [
        new Paragraph({
          children: [new TextRun({ text: String(text).slice(0, 4000), size: FONT_SMALL })],
        }),
      ],
    })
  }
  const dataRows = rows.map(
    (r) =>
      new TableRow({
        children: [
          cell(fmtDate(r.uploadIso), 0),
          cell(r.fileName, 1),
          cell(kindFriendlyLabel(r.kind), 2),
          cell(`${r.execLabel}. ${r.execDetail}`, 3),
          cell(r.signers, 4),
        ],
      })
  )
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  })
}

async function main() {
  const argv = process.argv.slice(2)
  let outPath = DEFAULT_OUT
  const oi = argv.indexOf('--out')
  if (oi >= 0 && argv[oi + 1]) outPath = path.resolve(argv[oi + 1])

  let pdfParse = null
  try {
    pdfParse = require('pdf-parse')
  } catch {
    console.error('Install pdf-parse for SA# and execution sampling: npm i pdf-parse')
    process.exit(1)
  }

  const env = loadEnvLocal(ENV_PATH)
  const session = await login(env)

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
    folders.push({ kind: 'listing', guid, detail: listing, address, documents })
  }
  for (const S of saleRows) {
    const guid = S.saleGuid
    const [detailJson, documents] = await Promise.all([
      fetchSaleDetail(session, guid),
      fetchDocuments(session, 'sales', guid),
    ])
    const sale = detailJson?.value?.sale ?? null
    const address = S.propertyAddress || safeAddress(sale?.property) || ''
    folders.push({ kind: 'sale', guid, detail: sale, address, documents })
  }

  /** @type {{section:string, address:string, folderKind:string, folderGuid:string, mls:string, uploadIso:string, fileName:string, kind:string, execLabel:string, execDetail:string, signers:string, saHint:string}[]} */
  const enriched = []

  for (const f of folders) {
    const d = f.detail
    const mls = d?.mlsNumber || ''
    const sorted = [...f.documents].sort((a, b) => {
      const ta = parseDate(a.uploadDate) ?? parseDate(a.modifiedDate) ?? 0
      const tb = parseDate(b.uploadDate) ?? parseDate(b.modifiedDate) ?? 0
      return ta - tb
    })
    for (const doc of sorted) {
      const fn = doc.fileName || doc.name || ''
      const kind = inferKind(fn, doc.name)
      const sec = wordSectionForKind(kind)
      const uploadIso = doc.uploadDate || doc.modifiedDate || ''
      enriched.push({
        section: sec,
        address: f.address || 'Address unknown',
        folderKind: f.kind,
        folderGuid: f.guid,
        mls,
        uploadIso,
        fileName: fn,
        kind,
        execLabel: '',
        execDetail: '',
        signers: '',
        saHint: extractSaFromFilename(fn),
      })
    }
  }

  const pdfJobs = []
  for (const row of enriched) {
    if (row.section !== 'transaction') continue
    const doc = folders
      .find((f) => f.guid === row.folderGuid)
      ?.documents?.find((d) => (d.fileName || d.name) === row.fileName)
    if (!doc?.url) continue
    const ext = (doc.extension || '').toLowerCase()
    const isPdf = ext === 'pdf' || row.fileName.toLowerCase().endsWith('.pdf')
    if (!isPdf) continue
    let pr = 10
    if (row.kind === 'sale_agreement_or_rsa') pr = 100
    else if (row.kind === 'counter_or_counteroffer' || row.kind === 'numbered_counter') pr = 90
    else if (row.kind === 'buyer_offer_or_package') pr = 85
    else if (row.kind === 'addendum') pr = 75
    else if (row.kind === 'title_or_hoa') pr = 50
    pdfJobs.push({ row, doc, pr })
  }
  pdfJobs.sort((a, b) => b.pr - a.pr)

  const textByKey = new Map()
  const slice = pdfJobs.slice(0, MAX_PDFS)
  await mapPool(slice, 5, async ({ row, doc }) => {
    const key = `${row.folderGuid}::${row.fileName}`
    try {
      const r = await fetch(doc.url)
      const buf = Buffer.from(await r.arrayBuffer())
      if (buf.length > MAX_PDF_BYTES || buf.slice(0, 4).toString() !== '%PDF') {
        textByKey.set(key, '')
        return
      }
      const log = console.log
      const err = console.error
      console.log = () => {}
      console.error = () => {}
      let data
      try {
        data = await pdfParse(buf)
      } finally {
        console.log = log
        console.error = err
      }
      textByKey.set(key, data.text || '')
    } catch {
      textByKey.set(key, '')
    }
  })

  for (const row of enriched) {
    const key = `${row.folderGuid}::${row.fileName}`
    const text = textByKey.get(key) || ''
    const ex = executionBrief(row.kind, text, row.fileName)
    row.execLabel = ex.label
    row.execDetail = ex.detail
    row.signers = extractSignatoryHints(text).join(', ') || '—'
    const fromPdf = extractSaleAgreementNumber(text)
    row.saHint = fromPdf || row.saHint || ''
  }

  const listingRows_ = enriched.filter((r) => r.section === 'listing').sort((a, b) => {
    const ca = a.address.localeCompare(b.address, 'en')
    if (ca !== 0) return ca
    return (parseDate(b.uploadIso) || 0) - (parseDate(a.uploadIso) || 0)
  })
  const buyerRows = enriched.filter((r) => r.section === 'buyer').sort((a, b) => {
    const ca = a.address.localeCompare(b.address, 'en')
    if (ca !== 0) return ca
    return (parseDate(b.uploadIso) || 0) - (parseDate(a.uploadIso) || 0)
  })
  const txRows = enriched.filter((r) => r.section === 'transaction')

  /** Sale and listing folders that carry transaction documents, grouped by address */
  const foldersByAddr = new Map()
  for (const f of folders) {
    const hasTxDoc = f.documents.some((d) => {
      const fn = d.fileName || d.name || ''
      return wordSectionForKind(inferKind(fn, d.name)) === 'transaction'
    })
    if (f.kind === 'sale' || (f.kind === 'listing' && hasTxDoc)) {
      const key = normalizeAddrKey(f.address)
      if (!key) continue
      if (!foldersByAddr.has(key)) foldersByAddr.set(key, [])
      foldersByAddr.get(key).push(f)
    }
  }
  for (const [, arr] of foldersByAddr) {
    arr.sort((a, b) => {
      const sa = a.kind === 'sale' ? 0 : 1
      const sb = b.kind === 'sale' ? 0 : 1
      if (sa !== sb) return sa - sb
      return folderActivityTs(b.detail) - folderActivityTs(a.detail)
    })
  }

  const addressKeysSorted = [...foldersByAddr.keys()].sort((ka, kb) => {
    const maxA = Math.max(...(foldersByAddr.get(ka) || []).map((f) => folderActivityTs(f.detail)), 0)
    const maxB = Math.max(...(foldersByAddr.get(kb) || []).map((f) => folderActivityTs(f.detail)), 0)
    return maxB - maxA
  })

  const children = []

  children.push(
    h(1, 'SkySlope Forms principal brief'),
    p(
      'This Word file is generated from your SkySlope Forms listing and sale file cabinets. It is not SkySlope Suite. Tables use larger type and spacing so you can read it quickly. Always confirm money, dates, and signatures in SkySlope and with escrow.',
      { italics: true }
    ),
    ...glossaryParagraphs(),
    new Paragraph({ children: [new PageBreak()] }),

    h(1, 'Part 1. Buyer representation agreements'),
    p(
      'Grouped by property address. Newest upload date first within each address. One table per address.',
      { italics: true }
    )
  )

  if (!buyerRows.length) {
    children.push(p('No documents matched buyer representation or buyer agency filename patterns.'))
  } else {
    const buyerByAddr = new Map()
    for (const r of buyerRows) {
      const k = r.address || 'Unknown address'
      if (!buyerByAddr.has(k)) buyerByAddr.set(k, [])
      buyerByAddr.get(k).push(r)
    }
    const buyerAddrOrder = [...new Set(buyerRows.map((r) => r.address || 'Unknown address'))]
    for (const addr of buyerAddrOrder) {
      children.push(h(2, addr))
      children.push(tableForDocuments(buyerByAddr.get(addr) || []))
      children.push(new Paragraph({ spacing: { after: 280 }, children: [] }))
    }
  }

  children.push(
    new Paragraph({ children: [new PageBreak()] }),
    h(1, 'Part 2. Listing agreements and initial agency disclosures'),
    p('Grouped by property address. Newest upload date first within each address. One table per address.', {
      italics: true,
    })
  )

  if (!listingRows_.length) {
    children.push(p('No listing agreement or agency pamphlet documents were classified in the file names.'))
  } else {
    const listingByAddr = new Map()
    for (const r of listingRows_) {
      const k = r.address || 'Unknown address'
      if (!listingByAddr.has(k)) listingByAddr.set(k, [])
      listingByAddr.get(k).push(r)
    }
    const listingAddrOrder = [...new Set(listingRows_.map((r) => r.address || 'Unknown address'))]
    for (const addr of listingAddrOrder) {
      children.push(h(2, addr))
      children.push(tableForDocuments(listingByAddr.get(addr) || []))
      children.push(new Paragraph({ spacing: { after: 280 }, children: [] }))
    }
  }

  children.push(
    new Paragraph({ children: [new PageBreak()] }),
    h(1, 'Part 3. Transactions by property address'),
    p(
      'Addresses are ordered by the most recent contract or file activity on record, newest first. Under each address you will see a short overview in plain sentences, then each sale or listing file with transaction documents, then tables grouped by sale agreement number when the script could read a number from the PDF or file name.',
      { italics: true }
    )
  )

  for (const addrKey of addressKeysSorted) {
    const groupFolders = foldersByAddr.get(addrKey) || []
    if (!groupFolders.length) continue
    const displayAddr = groupFolders[0].address || 'Unknown address'
    children.push(h(2, displayAddr))

    const sellers = new Set()
    const buyers = new Set()
    let listingPrice = ''
    let salePrice = ''
    let accept = ''
    let close = ''
    let escrowNo = ''
    let exp = ''
    let offerDocs = 0
    let rsaDocs = 0
    const offerDates = []
    let titleCompany = ''
    let escrowOfficer = ''

    for (const sf of groupFolders) {
      const s = sf.detail
      if (!s) continue
      if (sf.kind === 'sale') {
        formatPartyNames(s.sellers || [])
          .split('; ')
          .forEach((x) => x && sellers.add(x))
        formatPartyNames(s.buyers || [])
          .split('; ')
          .forEach((x) => x && buyers.add(x))
        if (s.listingPrice != null) listingPrice = String(s.listingPrice)
        if (s.salePrice != null) salePrice = String(s.salePrice)
        if (s.contractAcceptanceDate) accept = fmtDate(s.contractAcceptanceDate)
        if (s.actualClosingDate) close = fmtDate(s.actualClosingDate)
        if (s.escrowNumber) escrowNo = String(s.escrowNumber)
        const tc = s.titleContact
        if (tc?.company && !titleCompany) titleCompany = tc.company
        const ec = s.escrowContact
        if (ec && !escrowOfficer) {
          escrowOfficer = [ec.company, ec.firstName, ec.lastName].filter(Boolean).join(' ').trim()
        }
      } else if (sf.kind === 'listing') {
        formatPartyNames(s.sellers || [])
          .split('; ')
          .forEach((x) => x && sellers.add(x))
        if (s.listingPrice != null && !listingPrice) listingPrice = String(s.listingPrice)
        if (s.expirationDate) exp = fmtDate(s.expirationDate)
      }
      const sd = txRows.filter((r) => r.folderGuid === sf.guid)
      offerDocs += sd.filter((r) => r.kind === 'buyer_offer_or_package').length
      rsaDocs += sd.filter((r) => r.kind === 'sale_agreement_or_rsa').length
      sd.filter((r) => r.kind === 'buyer_offer_or_package').forEach((r) => offerDates.push(parseDate(r.uploadIso) || 0))
    }

    const listingMatch = groupFolders.find((f) => f.kind === 'listing')
    if (listingMatch?.detail?.expirationDate && !exp) exp = fmtDate(listingMatch.detail.expirationDate)
    if (listingMatch?.detail?.listingPrice != null && !listingPrice)
      listingPrice = String(listingMatch.detail.listingPrice)

    offerDates.sort((a, b) => a - b)
    let offerNarrative =
      offerDocs > 0
        ? `The file includes at least ${offerDocs} document(s) classified as buyer offer packages by filename (not necessarily distinct rounds). `
        : 'No offer-shaped filenames were counted in the sale file documents. '
    if (rsaDocs > 0) {
      offerNarrative += `There ${rsaDocs === 1 ? 'is' : 'are'} ${rsaDocs} Residential Sale Agreement or RSA-shaped PDF name(s) on file. `
    }
    if (offerDocs > 0 && rsaDocs > 0 && offerDates.length) {
      offerNarrative += `Compare offer upload dates to the RSA upload dates in the subsections below to see which offer round aligns with the contract stack. `
    }

    children.push(
      pBoldLead('Overview', offerNarrative),
      pBoldLead(
        'API snapshot (confirm in SkySlope and escrow)',
        `Listing price ${listingPrice || 'n/a'}. Sale price ${salePrice || 'n/a'}. Contract acceptance ${accept || 'n/a'}. Closing ${close || 'n/a'}. Listing expiration ${exp || 'n/a'}. Escrow number ${escrowNo || 'n/a'}.`
      ),
      pBoldLead(
        'Title and escrow labels from the sale file API',
        `Title company: ${titleCompany || 'n/a'}. Escrow contact label: ${escrowOfficer || 'n/a'}. Confirm with recorded instruments and escrow.`
      ),
      pBoldLead(
        'Parties on the sale file API',
        `Sellers: ${[...sellers].join('; ') || 'n/a'}. Buyers: ${[...buyers].join('; ') || 'n/a'}.`
      ),
      new Paragraph({ spacing: { after: 280 }, children: [] })
    )

    for (const sf of groupFolders) {
      const s = sf.detail
      const title =
        sf.kind === 'sale'
          ? `Sale file · escrow ${s?.escrowNumber || 'n/a'} · MLS ${s?.mlsNumber || 'n/a'} · acceptance ${s?.contractAcceptanceDate ? fmtDate(s.contractAcceptanceDate) : 'n/a'}`
          : `Listing file (transaction documents on file) · MLS ${s?.mlsNumber || 'n/a'} · status ${s?.status || 'n/a'} · expires ${s?.expirationDate ? fmtDate(s.expirationDate) : 'n/a'}`
      children.push(h(3, title))

      const docsHere = txRows
        .filter((r) => r.folderGuid === sf.guid)
        .sort((a, b) => (parseDate(a.uploadIso) || 0) - (parseDate(b.uploadIso) || 0))

      const bySa = new Map()
      for (const r of docsHere) {
        const sa = r.saHint?.trim() || 'Sale agreement number not extracted (see PDF or top right of OREF form)'
        if (!bySa.has(sa)) bySa.set(sa, [])
        bySa.get(sa).push(r)
      }

      const saKeys = [...bySa.keys()].sort((a, b) => {
        if (a.includes('not extracted')) return 1
        if (b.includes('not extracted')) return -1
        return a.localeCompare(b, 'en')
      })

      for (const sa of saKeys) {
        children.push(h4(`Sale agreement number ${sa}`))
        children.push(tableForDocuments(bySa.get(sa) || []))
        children.push(new Paragraph({ spacing: { after: 200 }, children: [] }))
      }
    }
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Calibri',
            size: 24,
          },
          paragraph: {
            spacing: { line: 360, lineRule: LineRuleType.AUTO },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
          },
        },
        children,
      },
    ],
  })

  const buf = await Packer.toBuffer(doc)
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, buf)
  console.error(
    JSON.stringify({
      ok: true,
      outPath,
      buyer_docs: buyerRows.length,
      listing_docs: listingRows_.length,
      transaction_doc_rows: txRows.length,
      addresses_in_part3: addressKeysSorted.length,
    })
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
