#!/usr/bin/env node
/**
 * Generate a fresh v3-format rename cache from the existing v2 cache.
 *
 * For every doc in the input cache:
 *   - Fetch the LIVE doc record (the `url` in the old cache may be expired)
 *   - Download + OCR the PDF (up to 50 pages, dual pipeline)
 *   - Extract `Sale Agreement #` value from the OCR text
 *   - Derive OREF# and form name from the cached ORIGINAL filename (so we
 *     don't lose form identity when the doc has already been renamed)
 *   - Run the executed detector against folder parties + signature markers
 *   - Build the v3 filename per `.cursor/skills/skyslope-file-organization/SKILL.md`
 *
 *   node scripts/skyslope-forms-redetect-v3.mjs <input.jsonl> <output.jsonl>
 *
 * Env:
 *   SKYSLOPE_REDETECT_CONCURRENCY (default 8)
 *   SKYSLOPE_REDETECT_PDF_MAX_PAGES (default 50)
 */
import fs from 'fs'
import crypto from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'

import {
  fetchSkyslopeDocumentBinary,
  skyslopeFetchWithRetry,
} from './skyslope-files-api.mjs'
import { analyzePdfBuffer, classifyPdfDownload } from './skyslope-pdf-insight.mjs'
import {
  detectExecuted,
  deriveFormName,
  extractOrefNumber,
  extractSaleAgreementNumber,
  fileExtension,
  inferKindV2,
  isUnpatchablePseudoDoc,
  suggestStandardNameV2,
} from './skyslope-forms-document-taxonomy-v2.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const ENV_PATH = path.join(ROOT, '.env.local')
const BASE = 'https://api-latest.skyslope.com'
const MAX_PDF_BYTES = 9_000_000
const CONCURRENCY = Math.min(
  16,
  Math.max(1, Number.parseInt(String(process.env.SKYSLOPE_REDETECT_CONCURRENCY || '8'), 10) || 8)
)
const PDF_MAX_PAGES = Math.min(
  120,
  Math.max(1, Number.parseInt(String(process.env.SKYSLOPE_REDETECT_PDF_MAX_PAGES || '50'), 10) || 50)
)

function loadEnv() {
  const raw = fs.readFileSync(ENV_PATH, 'utf8')
  const env = {}
  for (const line of raw.split('\n')) {
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
  const res = await skyslopeFetchWithRetry(`${BASE}/auth/login`, {
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
  return (await res.json()).Session
}

function apiHeaders(session) {
  return {
    'Content-Type': 'application/json',
    Session: session,
    timestamp: new Date().toISOString(),
    Accept: 'application/json',
  }
}

const folderDetailCache = new Map()
async function getFolderDetail(session, folderKind, folderGuid) {
  const key = `${folderKind}|${folderGuid}`
  if (folderDetailCache.has(key)) return folderDetailCache.get(key)
  const pathSeg = folderKind === 'listing' ? 'listings' : 'sales'
  const r = await skyslopeFetchWithRetry(`${BASE}/api/files/${pathSeg}/${folderGuid}`, {
    headers: apiHeaders(session),
  })
  let detail = null
  if (r.ok) {
    const j = await r.json()
    detail = j?.value?.[folderKind] || null
  }
  folderDetailCache.set(key, detail)
  return detail
}

const folderDocsCache = new Map()
async function getFolderDocs(session, folderKind, folderGuid) {
  const key = `${folderKind}|${folderGuid}`
  if (folderDocsCache.has(key)) return folderDocsCache.get(key)
  const pathSeg = folderKind === 'listing' ? 'listings' : 'sales'
  const r = await skyslopeFetchWithRetry(
    `${BASE}/api/files/${pathSeg}/${folderGuid}/documents`,
    { headers: apiHeaders(session) }
  )
  let docs = []
  if (r.ok) {
    const j = await r.json()
    docs = j?.value?.documents ?? []
  }
  folderDocsCache.set(key, docs)
  return docs
}

async function fetchPdfText(session, doc) {
  if (!doc?.url) return { text: '', skipped: 'no-download-url' }
  try {
    const dl = await fetchSkyslopeDocumentBinary(doc.url, () => apiHeaders(session))
    const classified = classifyPdfDownload(dl.buf, dl.status, dl.contentType, MAX_PDF_BYTES)
    if (!classified.ok) return { text: '', skipped: classified.reason }
    const ext = String(doc.extension || '').toLowerCase()
    const isPdf = ext === 'pdf' || /\.pdf$/i.test(doc.fileName || '')
    if (!isPdf) return { text: '', skipped: 'not-pdf' }
    const insight = await analyzePdfBuffer(dl.buf, {
      maxPages: PDF_MAX_PAGES,
      ocrMaxPages: PDF_MAX_PAGES,
    })
    if (!insight.ok) return { text: '', skipped: insight.reason || 'insight-fail' }
    return { text: insight.text || '', skipped: '', pages: insight.pageCount }
  } catch (err) {
    return { text: '', skipped: err?.message || 'pdf-fetch-error' }
  }
}

async function mapPool(items, concurrency, fn) {
  let i = 0
  let done = 0
  const start = Date.now()
  async function worker() {
    while (true) {
      const idx = i++
      if (idx >= items.length) break
      try {
        await fn(items[idx], idx)
      } catch (err) {
        process.stderr.write(JSON.stringify({ stage: 'worker_error', idx, err: String(err?.message || err) }) + '\n')
      }
      done += 1
      if (done % 50 === 0 || done === items.length) {
        const dt = (Date.now() - start) / 1000
        const rate = done / dt
        const eta = Math.round((items.length - done) / Math.max(rate, 0.001))
        process.stderr.write(
          JSON.stringify({ stage: 'progress', done, total: items.length, rateDps: Number(rate.toFixed(2)), etaSec: eta }) + '\n'
        )
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()))
}

async function main() {
  const inPath = process.argv[2]
  const outPath = process.argv[3]
  if (!inPath || !outPath) {
    console.error('usage: node skyslope-forms-redetect-v3.mjs <input.jsonl> <output.jsonl>')
    process.exit(2)
  }
  const env = loadEnv()
  const session = await login(env)

  const lines = fs.readFileSync(inPath, 'utf8').split('\n').filter(Boolean)
  const inputs = []
  for (const line of lines) {
    try {
      const j = JSON.parse(line)
      if (j.action === 'would_rename' && j.folderKind && j.folderGuid && j.documentId) {
        inputs.push(j)
      }
    } catch {
      /* skip */
    }
  }

  console.error(
    JSON.stringify({ stage: 'starting', total: inputs.length, concurrency: CONCURRENCY, pdfMaxPages: PDF_MAX_PAGES })
  )

  const outStream = fs.createWriteStream(outPath, { encoding: 'utf8' })

  let execHigh = 0
  let execMed = 0
  let notExec = 0
  let pdfMissing = 0
  let pseudoSkipped = 0
  let saleNumbersFound = 0

  await mapPool(inputs, CONCURRENCY, async (cached) => {
    const folderDetail = await getFolderDetail(session, cached.folderKind, cached.folderGuid)
    const docs = await getFolderDocs(session, cached.folderKind, cached.folderGuid)
    const liveDoc = docs.find((d) => d.id === cached.documentId)
    if (!liveDoc) {
      outStream.write(
        JSON.stringify({
          action: 'skip',
          reason: 'doc_not_found',
          folderKind: cached.folderKind,
          folderGuid: cached.folderGuid,
          documentId: cached.documentId,
          cachedFrom: cached.from,
        }) + '\n'
      )
      return
    }
    if (isUnpatchablePseudoDoc(liveDoc)) {
      pseudoSkipped += 1
      outStream.write(
        JSON.stringify({
          action: 'skip',
          reason: 'pseudo_doc',
          folderKind: cached.folderKind,
          folderGuid: cached.folderGuid,
          documentId: cached.documentId,
          cachedFrom: cached.from,
          currentFileName: liveDoc.fileName,
        }) + '\n'
      )
      return
    }

    // Use the ORIGINAL filename from the cache for OREF# and form name —
    // the current fileName may already be a v2-renamed string and would
    // confuse the derivation.
    const originalFn = cached.from || liveDoc.fileName
    const category = inferKindV2(originalFn, liveDoc.name)

    const pdf = await fetchPdfText(session, liveDoc)
    if (!pdf.text) pdfMissing += 1

    const exec = detectExecuted({
      category,
      folderType: cached.folderKind,
      folderDetail,
      pdfText: pdf.text || null,
    })

    if (exec.executed) {
      if (exec.confidence === 'high') execHigh += 1
      else execMed += 1
    } else {
      notExec += 1
    }

    const saleNumber = extractSaleAgreementNumber(pdf.text || '')
    if (saleNumber) saleNumbersFound += 1

    const orefNumber = extractOrefNumber(originalFn)
    const formName = deriveFormName(originalFn, orefNumber, category)
    const uploadIso = liveDoc.uploadDate || liveDoc.modifiedDate
    const date = (() => {
      const ts = Date.parse(uploadIso)
      return Number.isFinite(ts) ? new Date(ts).toISOString().slice(0, 10) : ''
    })()
    const extension = fileExtension(originalFn) || 'pdf'

    const newName = suggestStandardNameV2({
      date,
      executed: exec.executed,
      saleNumber,
      orefNumber,
      formName,
      extension,
    })

    const currentName = String(liveDoc.fileName || '').trim()
    const action = currentName === newName.trim() ? 'no_change' : 'would_rename'

    outStream.write(
      JSON.stringify({
        action,
        folderKind: cached.folderKind,
        folderGuid: cached.folderGuid,
        address: cached.address,
        documentId: cached.documentId,
        from: currentName,
        to: newName,
        category,
        orefNumber: orefNumber || '',
        saleNumber: saleNumber || '',
        formName,
        date,
        executed: exec.executed,
        execConfidence: exec.confidence,
        execReason: exec.reason,
        execObligated: exec.obligated,
        execMatched: exec.matched,
        execMissing: exec.missing,
        pdfPages: pdf.pages || 0,
        pdfSkipped: pdf.skipped || '',
        originalFileName: cached.from,
      }) + '\n'
    )
  })

  outStream.end()
  await new Promise((resolve) => outStream.on('finish', resolve))

  console.error(
    JSON.stringify({
      stage: 'summary',
      total: inputs.length,
      executed_high: execHigh,
      executed_medium: execMed,
      not_executed: notExec,
      pdf_missing: pdfMissing,
      pseudo_skipped: pseudoSkipped,
      sale_numbers_found: saleNumbersFound,
      output: outPath,
    })
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
