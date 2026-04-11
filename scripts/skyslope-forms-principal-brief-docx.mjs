#!/usr/bin/env node
/**
 * SkySlope Forms — principal broker **Word** brief (organized by listing docs,
 * buyer-agency docs, then transactions by address and sale agreement number).
 *
 *   npm run skyslope:forms-brief
 *   npm run skyslope:forms-brief -- --out ~/Downloads/brief.docx
 *
 * Document downloads use your SkySlope Session header on each file URL so the
 * response is PDF bytes, not an HTML shell (bare fetch often failed with
 * not_pdf_bytes before this).
 *
 * Omits internal SkySlope document GUIDs. Sale agreement numbers come from PDF
 * text when extractable (verify in forms). Env: SKYSLOPE_*; optional
 * SKYSLOPE_BRIEF_MAX_PDFS (default 320) for how many PDFs get deep read;
 * SKYSLOPE_PDF_MAX_PAGES (default 80) caps pages per file. Every read page
 * gets the dual labeled pipeline (pdf.js text layer plus mandatory OCR).
 * See SKYSLOPE_PDF_OCR_MAX_PAGES to cap OCR engine passes only.
 *
 * Optional multi step advisory agent (observe then curate then one xAI JSON pass):
 * SKYSLOPE_PDF_AGENT=1 and XAI_API_KEY in .env.local. Tune SKYSLOPE_PDF_AGENT_MAX_CALLS
 * (default 48), SKYSLOPE_PDF_AGENT_PACE_MS (default 400), SKYSLOPE_PDF_AGENT_MAX_INPUT_CHARS,
 * SKYSLOPE_PDF_AGENT_MODEL (default grok-2-1212).
 */
import fs from 'fs'
import crypto from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'
import { Document, HeadingLevel, LineRuleType, Packer, PageBreak, Paragraph, TextRun } from 'docx'

import {
  fetchSkyslopeDocumentBinary,
  fetchSkyslopeFileFolderRows,
  skyslopeFetchWithRetry,
} from './skyslope-files-api.mjs'
import { inferKind, parseDate, fmtDate, wordSectionForKind } from './skyslope-forms-document-taxonomy.mjs'
import { runPdfAdvisoryAgent } from './skyslope-pdf-advisory-agent.mjs'
import {
  analyzePdfBuffer,
  buildExecutionAssessment,
  classifyPdfDownload,
  emptyPdfInsight,
  extractSaleAgreementNumber,
  extractSignatoryHints,
  notSampledPdfInsight,
} from './skyslope-pdf-insight.mjs'

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

function sleepMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Half-points: Word `w:sz` (20 = 10 pt). */
const FONT_BODY = 24
const FONT_SMALL = 22
/** Slightly larger body for long notes so Word wraps at full page width. */
const FONT_VALUE_LONG = 26
const FONT_H1 = 36
const FONT_H2 = 30
const FONT_H3 = 26

function trimCell(s, max) {
  const t = String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!t) return '—'
  return t.length > max ? `${t.slice(0, max)}…` : t
}

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

/**
 * @param {{ pdfAgentEnabled?: boolean }} [opts]
 */
function glossaryParagraphs(opts = {}) {
  const agentNote =
    opts.pdfAgentEnabled === true
      ? [
          pBoldLead(
            'Advisory agent (optional).',
            'When SKYSLOPE_PDF_AGENT=1 and XAI_API_KEY are set, a short multi step agent runs after pdf.js plus OCR. It observes file stats, curates a capped text excerpt, asks one structured model pass for triage notes, then validates JSON. It is still not execution proof. You confirm signatures and initials in SkySlope.'
          ),
        ]
      : []
  return [
    h(2, 'How to read this brief'),
    pBoldLead(
      'What is the automated signature check?',
      'Every sampled PDF uses the same dual pipeline. For each page in the read window you get two labeled blocks in order. First block is the machine text layer from pdf.js extractText plus form widget names from annotations. Second block is mandatory rendered page OCR using Poppler pdftoppm plus Tesseract when installed, otherwise pdf.js canvas render plus bundled tesseract.js. If a page exceeds SKYSLOPE_PDF_OCR_MAX_PAGES the OCR block states the cap explicitly. Output is still a filing aid. It is not a determination that a form is fully executed under Oregon practice, and it is not a substitute for you confirming every required signature and initial in SkySlope.'
    ),
    pBoldLead(
      'Why you do not see internal document IDs here.',
      'SkySlope internal IDs are hidden in this Word version on purpose. Use file name and date. Sale agreement numbers come from PDF text or the file name when the script can read them. If a number is blank, open the Residential Sale Agreement in SkySlope and read the number on the top right of the OREF form.'
    ),
    pBoldLead(
      'Document blocks.',
      'Each uploaded file is plain paragraphs only. A small bold field name sits on its own line and the value follows on the next line at the full page width. There are no Word tables in the body of this brief so nothing is trapped in grid cells.'
    ),
    ...agentNote,
    new Paragraph({ spacing: { after: 280 }, children: [] }),
  ]
}

/**
 * Label line then value line at full page width (no tables).
 * @param {string} label
 * @param {string} value
 * @param {{ tightTop?: boolean, longValue?: boolean, labelBefore?: number }} [opts]
 * @returns {Paragraph[]}
 */
function fieldStack(label, value, opts = {}) {
  const raw = value === undefined || value === null ? '' : String(value)
  const val = raw.trim() === '' ? '—' : raw
  const valueSize = opts.longValue ? FONT_VALUE_LONG : FONT_BODY
  const labelBefore =
    opts.labelBefore ??
    (opts.tightTop ? 40 : 180)
  return [
    new Paragraph({
      spacing: { before: labelBefore, after: 40 },
      children: [new TextRun({ text: label, bold: true, size: FONT_SMALL })],
    }),
    new Paragraph({
      spacing: { after: 120, line: 320, lineRule: LineRuleType.AUTO },
      children: [new TextRun({ text: val, size: valueSize })],
    }),
  ]
}

/** @param {Record<string, unknown>} meta */
function executiveSummaryParagraphs(meta) {
  const rows = [
    ['Generated (UTC)', meta.generatedUtc],
    ['Buyer representation rows', String(meta.buyerRows)],
    ['Listing and agency rows', String(meta.listingRows)],
    ['Transaction document rows', String(meta.transactionRows)],
    ['Part 3 property groups', String(meta.part3Addresses)],
    ['PDFs in deep read budget', String(meta.pdfSampleBudget)],
    ['Max pages read per sampled PDF', String(meta.pagesPerPdfCap)],
  ]
  if (meta.pdfAgentEnabled) {
    rows.push(['Advisory agent on this run', 'yes · curated excerpt plus one xAI JSON pass per selected PDF'])
    rows.push(['Advisory agent PDF calls', String(meta.pdfAgentCalls ?? 0)])
  }
  /** @type {Paragraph[]} */
  const out = []
  rows.forEach(([k, v], idx) => {
    out.push(...fieldStack(k, v, { tightTop: idx === 0 }))
  })
  return out
}

/** @param {Record<string, unknown>} r enriched row */
function documentDetailParagraphs(r) {
  /** @type {{ label: string, value: string, longValue?: boolean }[]} */
  const pairs = [
    { label: 'File name', value: trimCell(r.fileName, 900), longValue: true },
    { label: 'Upload date', value: fmtDate(r.uploadIso) },
    { label: 'MLS number', value: trimCell(r.mls || '—', 80) },
    { label: 'Folder', value: trimCell(r.folderDisplay || '—', 80) },
    { label: 'Form type', value: kindFriendlyLabel(r.kind) },
    { label: 'Execution guess', value: trimCell(r.execLabel || '—', 200) },
    { label: 'Reviewer notes', value: trimCell(r.execNotes || r.execDetail || '—', 3500), longValue: true },
    { label: 'Signatory hints', value: trimCell(r.signers || '—', 2500), longValue: true },
    { label: 'PDF pipeline', value: trimCell(r.pipelineCell || r.pdfFlags || '—', 4500), longValue: true },
  ]
  const agentRan = r.agentOk === 'yes' || r.agentOk === 'no'
  if (agentRan) {
    pairs.push(
      { label: 'Advisory agent triage notes', value: trimCell(String(r.agentReviewNotes || '—'), 2000), longValue: true },
      { label: 'Advisory agent risk signals', value: trimCell(String(r.agentRiskSignals || '—'), 1200), longValue: true },
      { label: 'Advisory agent suggested focus', value: trimCell(String(r.agentSuggestedFocus || '—'), 400) },
      {
        label: 'Advisory agent confidence 0 to 1',
        value: trimCell(String(r.agentConfidence ?? '—'), 20),
      }
    )
  }
  /** @type {Paragraph[]} */
  const out = []
  pairs.forEach((pair, idx) => {
    out.push(
      ...fieldStack(pair.label, pair.value, {
        longValue: Boolean(pair.longValue),
        tightTop: idx === 0,
      })
    )
  })
  return out
}

/** @param {{ label: string, value: string }[]} rows */
function kvDetailParagraphs(rows) {
  /** @type {Paragraph[]} */
  const out = []
  rows.forEach((row, idx) => {
    const long =
      row.label === 'Offer and RSA file context' ||
      row.label === 'Sellers (sale API)' ||
      row.label === 'Buyers (sale API)' ||
      row.label === 'Title company (sale API)' ||
      row.label === 'Escrow contact label (sale API)'
    out.push(
      ...fieldStack(row.label, row.value, {
        longValue: long,
        tightTop: idx === 0,
      })
    )
  })
  return out
}

/**
 * @param {Record<string, unknown>[]} rows
 * @returns {Paragraph[]}
 */
function documentBlocksForRows(rows) {
  /** @type {Paragraph[]} */
  const blocks = []
  for (let i = 0; i < rows.length; i++) {
    blocks.push(
      new Paragraph({
        spacing: { before: i === 0 ? 120 : 280, after: 140 },
        children: [
          new TextRun({ text: `Document ${i + 1} of ${rows.length}`, bold: true, size: FONT_H3 }),
        ],
      })
    )
    blocks.push(...documentDetailParagraphs(rows[i]))
    blocks.push(new Paragraph({ spacing: { after: 240 }, children: [] }))
  }
  return blocks
}

async function main() {
  const argv = process.argv.slice(2)
  let outPath = DEFAULT_OUT
  const oi = argv.indexOf('--out')
  if (oi >= 0 && argv[oi + 1]) outPath = path.resolve(argv[oi + 1])

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
        execNotes: '',
        signers: '',
        saHint: extractSaFromFilename(fn),
        pdfFlags: '',
        folderDisplay: f.kind === 'listing' ? 'Listing' : 'Sale',
        textLayerNote: '',
        pipelineCell: '',
        agentOk: '',
        agentReviewNotes: '',
        agentRiskSignals: '',
        agentSuggestedFocus: '',
        agentConfidence: '',
      })
    }
  }

  const pdfJobs = []
  for (const row of enriched) {
    const doc = folders
      .find((f) => f.guid === row.folderGuid)
      ?.documents?.find((d) => (d.fileName || d.name) === row.fileName)
    if (!doc?.url) continue
    const ext = (doc.extension || '').toLowerCase()
    const isPdf = ext === 'pdf' || row.fileName.toLowerCase().endsWith('.pdf')
    if (!isPdf) continue

    let pr = 8
    if (row.section === 'buyer') pr = 92
    else if (row.section === 'listing') pr = 86
    else if (row.section === 'transaction') {
      pr = 10
      if (row.kind === 'sale_agreement_or_rsa') pr = 100
      else if (row.kind === 'counter_or_counteroffer' || row.kind === 'numbered_counter') pr = 90
      else if (row.kind === 'buyer_offer_or_package') pr = 85
      else if (row.kind === 'addendum') pr = 75
      else if (row.kind === 'title_or_hoa') pr = 50
    }
    pdfJobs.push({ row, doc, pr })
  }
  pdfJobs.sort((a, b) => b.pr - a.pr)

  const insightByKey = new Map()
  const slice = pdfJobs.slice(0, MAX_PDFS)
  await mapPool(slice, 3, async ({ row, doc }) => {
    const key = `${row.folderGuid}::${row.fileName}`
    try {
      const dl = await fetchSkyslopeDocumentBinary(doc.url, () => apiHeaders(session))
      const classified = classifyPdfDownload(dl.buf, dl.status, dl.contentType, MAX_PDF_BYTES)
      if (!classified.ok) {
        insightByKey.set(key, emptyPdfInsight(classified.reason))
        return
      }
      const insight = await analyzePdfBuffer(dl.buf)
      insightByKey.set(key, insight)
    } catch (e) {
      insightByKey.set(key, emptyPdfInsight(e?.message || String(e)))
    }
  })

  const pdfAgentEnabled = env.SKYSLOPE_PDF_AGENT === '1' && Boolean(String(env.XAI_API_KEY || '').trim())
  let pdfAgentCalls = 0
  if (pdfAgentEnabled) {
    const maxAgent = Math.min(
      200,
      Math.max(
        1,
        Number.parseInt(String(env.SKYSLOPE_PDF_AGENT_MAX_CALLS || process.env.SKYSLOPE_PDF_AGENT_MAX_CALLS || '48'), 10) ||
          48
      )
    )
    const paceMs = Math.max(
      0,
      Number.parseInt(
        String(env.SKYSLOPE_PDF_AGENT_PACE_MS || process.env.SKYSLOPE_PDF_AGENT_PACE_MS || '400'),
        10
      ) || 400
    )
    /** @type {{ row: Record<string, unknown>, doc: unknown, pr: number }[]} */
    const agentJobs = []
    for (const job of slice) {
      const key = `${job.row.folderGuid}::${job.row.fileName}`
      const ins = insightByKey.get(key)
      if (ins?.ok && agentJobs.length < maxAgent) agentJobs.push(job)
    }
    await mapPool(agentJobs, 1, async (job) => {
      const key = `${job.row.folderGuid}::${job.row.fileName}`
      const ins = insightByKey.get(key)
      if (!ins?.ok) return
      const out = await runPdfAdvisoryAgent({
        insight: ins,
        kind: String(job.row.kind || ''),
        fileName: String(job.row.fileName || ''),
        section: String(job.row.section || ''),
        kindLabel: kindFriendlyLabel(job.row.kind),
        xaiKey: String(env.XAI_API_KEY || '').trim(),
      })
      job.row.agentOk = out.ok ? 'yes' : 'no'
      job.row.agentReviewNotes = out.ok ? out.review_notes || '—' : trimCell(String(out.error || 'agent failed'), 400)
      job.row.agentRiskSignals = out.ok ? (out.risk_signals || []).join(' · ') || '—' : '—'
      job.row.agentSuggestedFocus = out.ok ? out.suggested_focus || '—' : '—'
      job.row.agentConfidence = out.ok && out.confidence != null ? String(out.confidence) : '—'
      pdfAgentCalls += 1
      if (paceMs > 0) await sleepMs(paceMs)
    })
  }

  for (const row of enriched) {
    const key = `${row.folderGuid}::${row.fileName}`
    const docMeta = folders
      .find((f) => f.guid === row.folderGuid)
      ?.documents?.find((x) => (x.fileName || x.name) === row.fileName)
    const ext = (docMeta?.extension || '').toLowerCase()
    const isPdf = ext === 'pdf' || row.fileName.toLowerCase().endsWith('.pdf')

    if (!isPdf) {
      row.execLabel = 'Not a PDF'
      row.execDetail = 'Open the attachment in SkySlope. Automated read targets PDF text and fields.'
      row.execNotes = row.execDetail
      row.signers = '—'
      row.pdfFlags = 'n/a'
      row.textLayerNote = ''
      row.pipelineCell = 'n/a'
      continue
    }

    const inPdfJobs = pdfJobs.some((j) => `${j.row.folderGuid}::${j.row.fileName}` === key)
    let insight = insightByKey.get(key)
    if (!insight) {
      insight = inPdfJobs ? notSampledPdfInsight() : emptyPdfInsight('no_download_url')
    }

    const ex = buildExecutionAssessment(row.kind, insight, row.fileName)
    row.execLabel = ex.label
    row.execDetail = ex.detail
    row.execNotes = trimCell(ex.detail, 340)
    const hintText = `${insight.text || ''}\n${insight.ocrSnippet || ''}`
    row.signers = extractSignatoryHints(hintText).join(', ') || '—'
    const fromPdf = extractSaleAgreementNumber(insight.combinedForSa || insight.text || '')
    row.saHint = fromPdf || row.saHint || ''
    row.pdfFlags = insight.flagsLine || '—'
    row.textLayerNote = insight.lowTextPageRanges || ''
    row.pipelineCell = trimCell(
      [insight.flagsLine, row.textLayerNote].filter((x) => x && String(x).trim()).join(' · '),
      420
    )
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

  const generatedUtc = new Date().toISOString()
  const pagesPerPdfCap = Math.min(
    120,
    Math.max(1, Number.parseInt(String(process.env.SKYSLOPE_PDF_MAX_PAGES || '80'), 10) || 80)
  )

  const children = []

  children.push(
    h(1, 'SkySlope Forms principal brief'),
    p(
      'This Word file is generated from your SkySlope Forms listing and sale file cabinets. It is not SkySlope Suite. Part 1 groups buyer representation PDFs by property. Part 2 groups listing agreements and agency pamphlets by property. Part 3 groups transaction PDFs by property then by SkySlope folder and sale agreement number. Every sampled PDF uses the dual text layer plus mandatory OCR standard described in How to read this brief. Confirm money, dates, and signatures in SkySlope and with escrow.',
      { italics: true }
    ),
    h(2, 'Run summary'),
    ...executiveSummaryParagraphs({
      generatedUtc,
      buyerRows: buyerRows.length,
      listingRows: listingRows_.length,
      transactionRows: txRows.length,
      part3Addresses: addressKeysSorted.length,
      pdfSampleBudget: MAX_PDFS,
      pagesPerPdfCap,
      pdfAgentEnabled,
      pdfAgentCalls,
    }),
    new Paragraph({ spacing: { after: 320 }, children: [] }),
    ...glossaryParagraphs({ pdfAgentEnabled }),
    new Paragraph({ spacing: { after: 200 }, children: [] })
  )

  children.push(
    new Paragraph({ children: [new PageBreak()] }),
    h(1, 'Part 1. Buyer representation agreements'),
    p(
      'Grouped by property address. Newest upload date first within each address. Each file is stacked paragraphs with a bold field name then the value on the next line at full width.',
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
      children.push(...documentBlocksForRows(buyerByAddr.get(addr) || []))
    }
  }

  children.push(
    new Paragraph({ children: [new PageBreak()] }),
    h(1, 'Part 2. Listing agreements and initial agency disclosures'),
    p(
      'Grouped by property address. Newest upload date first within each address. Each file uses the same stacked paragraph layout as Part 1.',
      { italics: true }
    )
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
      children.push(...documentBlocksForRows(listingByAddr.get(addr) || []))
    }
  }

  children.push(
    new Paragraph({ children: [new PageBreak()] }),
    h(1, 'Part 3. Transactions by property address'),
    p(
      'Addresses are ordered by the most recent contract or file activity on record, newest first. Under each address you will see a short overview in the same stacked paragraph style, then each SkySlope folder, then one stacked block per document grouped by sale agreement number when the script could read a number from the PDF or file name.',
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
      h(3, 'Snapshot for this address'),
      ...kvDetailParagraphs([
        { label: 'Offer and RSA file context', value: offerNarrative.trim() },
        { label: 'Listing price', value: listingPrice || 'n/a' },
        { label: 'Sale price', value: salePrice || 'n/a' },
        { label: 'Contract acceptance', value: accept || 'n/a' },
        { label: 'Closing', value: close || 'n/a' },
        { label: 'Listing expiration', value: exp || 'n/a' },
        { label: 'Escrow number', value: escrowNo || 'n/a' },
        { label: 'Title company (sale API)', value: titleCompany || 'n/a' },
        { label: 'Escrow contact label (sale API)', value: escrowOfficer || 'n/a' },
        { label: 'Sellers (sale API)', value: [...sellers].join('; ') || 'n/a' },
        { label: 'Buyers (sale API)', value: [...buyers].join('; ') || 'n/a' },
      ]),
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
        children.push(...documentBlocksForRows(bySa.get(sa) || []))
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
      pdf_agent_enabled: pdfAgentEnabled,
      pdf_agent_calls: pdfAgentCalls,
    })
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
