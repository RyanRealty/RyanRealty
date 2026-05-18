#!/usr/bin/env node
/**
 * SkySlope Forms — v2 document rename (Matt's 2026-05-16 convention).
 *
 * New filename pattern:
 *   {YYYY-MM-DD} {seq3} [X ]{[sale# ]}{[OREF# ]}{Form Name}.pdf
 *
 *   - X prefix: heuristic match of every required obligated signer's name
 *     against signature markers in the merged PDF text (pdf.js + OCR).
 *   - sale#: MLS number for everything except listing agreements and buyer
 *     representation agreements.
 *   - OREF#: extracted from source filename when present.
 *   - Form Name: canonical OREF title (if known) or cleaned from filename.
 *
 * Default = dry run. To apply:
 *   SKYSLOPE_APPLY_RENAMES=1 npm run skyslope:forms-rename-documents-v2
 *
 * Other env:
 *   SKYSLOPE_INCLUDE_ARCHIVED=1            include archived folders
 *   SKYSLOPE_RENAME_V2_CONCURRENCY=4       per-document concurrency
 *   SKYSLOPE_RENAME_V2_PDF_MAX_PAGES=6     pdf.js + OCR page cap per doc
 *   SKYSLOPE_RENAME_V2_PDF_BYTES=9000000   skip PDFs larger than this
 *   SKYSLOPE_RENAME_V2_SKIP_OCR=1          skip every PDF read (executed=false everywhere)
 */
import fs from 'fs'
import crypto from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'

import {
  fetchSkyslopeDocumentBinary,
  fetchSkyslopeFileFolderRows,
  skyslopeFetchWithRetry,
} from './skyslope-files-api.mjs'
import {
  CATEGORIES_WITHOUT_SALE_NUMBER,
  REQUIRED_SIGNERS_BY_CATEGORY,
  detectExecuted,
  deriveFormName,
  extractOrefNumber,
  extractSaleAgreementNumber,
  fileExtension,
  formatPartyName,
  inferKindV2,
  isUnpatchablePseudoDoc,
  parseDate,
  suggestStandardNameV2,
} from './skyslope-forms-document-taxonomy-v2.mjs'
import {
  analyzePdfBuffer,
  classifyPdfDownload,
  emptyPdfInsight,
} from './skyslope-pdf-insight.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const ENV_PATH = path.join(ROOT, '.env.local')
const BASE = 'https://api-latest.skyslope.com'

const APPLY = process.env.SKYSLOPE_APPLY_RENAMES === '1'
const INCLUDE_ARCHIVED = process.env.SKYSLOPE_INCLUDE_ARCHIVED === '1'
const SKIP_OCR = process.env.SKYSLOPE_RENAME_V2_SKIP_OCR === '1'
const CONCURRENCY = Math.min(
  12,
  Math.max(
    1,
    Number.parseInt(String(process.env.SKYSLOPE_RENAME_V2_CONCURRENCY || '4'), 10) || 4
  )
)
const PDF_MAX_PAGES = Math.min(
  120,
  Math.max(
    1,
    Number.parseInt(String(process.env.SKYSLOPE_RENAME_V2_PDF_MAX_PAGES || '50'), 10) || 50
  )
)
const MAX_PDF_BYTES = Number(process.env.SKYSLOPE_RENAME_V2_PDF_BYTES || 9_000_000)

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

function safeAddress(prop) {
  if (!prop) return null
  const n = prop.streetNumber || ''
  const s = prop.streetAddress || ''
  const u = prop.unit || ''
  const c = prop.city || ''
  const st = prop.state || ''
  const z = prop.zip || ''
  const line = [n, s, u].filter(Boolean).join(' ').trim()
  const tail = [c, st, z].filter(Boolean).join(', ')
  return [line, tail].filter(Boolean).join(', ')
}

async function mapPool(items, concurrency, fn) {
  let i = 0
  async function worker() {
    while (true) {
      const idx = i++
      if (idx >= items.length) break
      await fn(items[idx], idx)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()))
}

function normName(s) {
  return String(s || '')
    .trim()
    .replace(/\s+/g, ' ')
}

async function patchDocumentFileName(session, folderKind, folderGuid, documentId, newFileName) {
  // SkySlope's PATCH expects { FileName } in the JSON body, not a query
  // param. Query-param form returns 500 across all encodings (probed
  // 2026-05-16). JSON body returns 200 with the new fileName echoed.
  const pathSeg = folderKind === 'listing' ? 'listings' : 'sales'
  const idParam = encodeURIComponent(documentId)
  const folderParam = encodeURIComponent(folderGuid)
  const url = `${BASE}/api/files/${pathSeg}/${folderParam}/documents/${idParam}`
  const r = await skyslopeFetchWithRetry(url, {
    method: 'PATCH',
    headers: apiHeaders(session),
    body: JSON.stringify({ FileName: newFileName }),
  })
  const text = await r.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    body = { raw: text.slice(0, 500) }
  }
  return { ok: r.ok, status: r.status, body }
}

/**
 * Pull PDF + OCR for a document so the executed-heuristic has text.
 *
 * Matt's 2026-05-17 directive: every document is OCRed. Categories that
 * previously had no required-signer pattern now route through the
 * `any_party` branch of detectExecuted, which says "any DigiSign block
 * means the doc was executed" — appropriate for receipts, lender, title,
 * closing, and other non-OREF docs that still carry signatures.
 */
async function getPdfTextForExecutionCheck(session, doc, category) {
  if (SKIP_OCR) return { text: '', skipped: 'skip-ocr-env' }
  if (!doc.url) return { text: '', skipped: 'no-download-url' }

  const ext = String(doc.extension || '').toLowerCase()
  const isPdf = ext === 'pdf' || String(doc.fileName || '').toLowerCase().endsWith('.pdf')
  if (!isPdf) return { text: '', skipped: 'not-pdf' }

  try {
    const dl = await fetchSkyslopeDocumentBinary(doc.url, () => apiHeaders(session))
    const classified = classifyPdfDownload(dl.buf, dl.status, dl.contentType, MAX_PDF_BYTES)
    if (!classified.ok) return { text: '', skipped: classified.reason }
    const insight = await analyzePdfBuffer(dl.buf, {
      maxPages: PDF_MAX_PAGES,
      ocrMaxPages: PDF_MAX_PAGES,
    })
    if (!insight.ok) return { text: '', skipped: insight.reason || 'insight-fail' }
    return { text: insight.text || '', skipped: '' }
  } catch (err) {
    return { text: '', skipped: err?.message || 'pdf-fetch-error' }
  }
}

function buildFolderContext(folder) {
  if (folder.kind === 'listing') {
    const d = folder.listing || {}
    return {
      mls: d.mlsNumber || folder.summaryRow?.mlsNumber || '',
      folderType: 'listing',
      folderDetail: d,
    }
  } else {
    const d = folder.sale || {}
    return {
      mls: d.mlsNumber || folder.summaryRow?.mlsNumber || folder.linkedListingMls || '',
      folderType: 'sale',
      folderDetail: d,
    }
  }
}

async function main() {
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

  // First pass: gather every folder + its docs + detail JSON.
  const folders = []
  for (const L of listingRows) {
    const guid = L.listingGuid
    const [detailJson, documents] = await Promise.all([
      fetchListingDetail(session, guid),
      fetchDocuments(session, 'listings', guid),
    ])
    const listing = detailJson?.value?.listing ?? null
    const propertyLine =
      L.propertyAddress ||
      safeAddress(listing?.property) ||
      [listing?.property?.streetNumber, listing?.property?.streetAddress].filter(Boolean).join(' ')
    folders.push({ kind: 'listing', guid, listing, propertyLine, summaryRow: L, documents })
  }
  for (const S of saleRows) {
    const guid = S.saleGuid
    const [detailJson, documents] = await Promise.all([
      fetchSaleDetail(session, guid),
      fetchDocuments(session, 'sales', guid),
    ])
    const sale = detailJson?.value?.sale ?? null
    const propertyLine = S.propertyAddress || safeAddress(sale?.property) || null
    folders.push({ kind: 'sale', guid, sale, propertyLine, summaryRow: S, documents })
  }

  // Resolve linked-listing MLS for sale folders that lack one on the sale row.
  // (Helps fill the sale# slot when the sale's own mlsNumber is blank.)
  const listingByGuid = new Map()
  for (const f of folders) {
    if (f.kind === 'listing' && f.guid) listingByGuid.set(f.guid, f.listing)
  }
  for (const f of folders) {
    if (f.kind === 'sale' && !f.sale?.mlsNumber && f.sale?.listingGuid) {
      const linked = listingByGuid.get(f.sale.listingGuid)
      if (linked?.mlsNumber) f.linkedListingMls = linked.mlsNumber
    }
  }

  // Build a flat task list ordered by folder, then by upload date within
  // folder, so seq is stable.
  /** @type {{
   *   folder: object,
   *   ctx: object,
   *   doc: object,
   *   seq: number,
   *   category: string,
   * }[]} */
  const tasks = []
  for (const f of folders) {
    const ctx = buildFolderContext(f)
    const sorted = [...(f.documents || [])].sort((a, b) => {
      const ta = parseDate(a.uploadDate) ?? parseDate(a.modifiedDate) ?? 0
      const tb = parseDate(b.uploadDate) ?? parseDate(b.modifiedDate) ?? 0
      return ta - tb
    })
    let seq = 0
    for (const d of sorted) {
      seq += 1
      if (!d.id) continue
      if (isUnpatchablePseudoDoc(d)) {
        // SkySlope returns checklist placeholders / trash pseudo-rows in the
        // documents listing. They surface as 422 "Unable to find document"
        // on PATCH. Skip them — they aren't real files to rename.
        console.log(
          JSON.stringify({
            action: 'skip_pseudo_doc',
            folderKind: f.kind,
            folderGuid: f.guid,
            address: f.propertyLine,
            documentId: d.id,
            fileName: d.fileName,
            name: d.name,
            reason: 'unpatchable pseudo-row (no file behind id)',
          })
        )
        continue
      }
      const category = inferKindV2(d.fileName, d.name)
      tasks.push({ folder: f, ctx, doc: d, seq, category })
    }
  }

  console.error(
    JSON.stringify({
      stage: 'enumerated',
      folders: folders.length,
      documents: tasks.length,
      apply: APPLY,
      pdfMaxPages: PDF_MAX_PAGES,
      concurrency: CONCURRENCY,
      skipOcr: SKIP_OCR,
    })
  )

  let ok = 0
  let fail = 0
  let renames = 0
  let executed_total = 0
  let executed_high = 0
  let executed_medium = 0
  let nochange = 0

  await mapPool(tasks, CONCURRENCY, async (t) => {
    const fn = t.doc.fileName || t.doc.name || ''
    const category = t.category
    const mls = t.ctx.mls || ''
    const lane = t.folder.kind

    // Get PDF text for execution check (skip for categories with no required signers).
    const pdf = await getPdfTextForExecutionCheck(session, t.doc, category)

    const exec = detectExecuted({
      category,
      folderType: t.ctx.folderType,
      folderDetail: t.ctx.folderDetail,
      pdfText: pdf.text || null,
    })

    if (exec.executed) {
      executed_total += 1
      if (exec.confidence === 'high') executed_high += 1
      else if (exec.confidence === 'medium') executed_medium += 1
    }

    const orefNumber = extractOrefNumber(fn)
    const formName = deriveFormName(fn, orefNumber, category)
    const t_iso = t.doc.uploadDate || t.doc.modifiedDate
    const date = (() => {
      const p = parseDate(t_iso)
      return p ? new Date(p).toISOString().slice(0, 10) : ''
    })()

    // 2026-05-17 SKILL.md: sale agreement number is READ OUT OF THE PDF,
    // NOT inferred from MLS. Pull from the "Sale Agreement #" field at the
    // top of the form. Empty for listing agreements, BBC, pamphlets —
    // they don't pertain to a sale agreement and don't have the field.
    const saleNumber = extractSaleAgreementNumber(pdf.text || '')
    const extension = fileExtension(fn)

    const suggested = suggestStandardNameV2({
      date,
      executed: exec.executed,
      saleNumber,
      orefNumber,
      formName,
      extension,
    })

    const current = normName(fn)
    const next = normName(suggested)

    const line = {
      folderKind: lane,
      folderGuid: t.folder.guid,
      address: t.folder.propertyLine,
      documentId: t.doc.id,
      from: current,
      to: next,
      category,
      orefNumber: orefNumber || null,
      saleNumber: saleNumber || null,
      executed: exec.executed,
      execConfidence: exec.confidence,
      execObligated: exec.obligated,
      execMatched: exec.matched,
      execMissing: exec.missing,
      execReason: exec.reason,
      pdfSkipped: pdf.skipped || null,
    }

    if (current === next) {
      nochange += 1
      console.log(JSON.stringify({ action: 'no_change', ...line }))
      return
    }

    renames += 1

    if (!APPLY) {
      console.log(JSON.stringify({ action: 'would_rename', ...line }))
      return
    }

    const res = await patchDocumentFileName(session, lane, t.folder.guid, t.doc.id, next)
    if (res.ok) {
      ok += 1
      console.log(JSON.stringify({ action: 'renamed', ...line, httpStatus: res.status }))
    } else {
      fail += 1
      console.log(
        JSON.stringify({
          action: 'rename_failed',
          ...line,
          httpStatus: res.status,
          error: res.body,
        })
      )
    }
  })

  console.error(
    JSON.stringify({
      stage: 'summary',
      mode: APPLY ? 'apply' : 'dry_run',
      folders: folders.length,
      documents: tasks.length,
      renames,
      nochange,
      apply_ok: ok,
      apply_failed: fail,
      executed_total,
      executed_high,
      executed_medium,
    })
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
