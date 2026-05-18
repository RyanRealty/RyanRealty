#!/usr/bin/env node
/**
 * Re-run the X (fully-executed) detection over every doc in an existing
 * dry-run cache, but with a deeper PDF read (50 pages by default) and
 * the upgraded detectExecuted that handles non-OREF receipts and falls
 * back to DigiSign-block evidence when folder party data is thin.
 *
 * Reuses the original cache's date/seq/saleNumber/orefNumber/formName so
 * only the X prefix changes between runs. Emits a fresh JSONL ready for
 * `skyslope-forms-apply-from-cache.mjs`.
 *
 *   node scripts/skyslope-forms-redetect-from-cache.mjs <input.jsonl> [output.jsonl]
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
  CATEGORIES_WITHOUT_SALE_NUMBER,
  detectExecuted,
  fileExtension,
  inferKindV2,
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

async function getPdfText(session, doc) {
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
      await fn(items[idx], idx)
      done += 1
      if (done % 50 === 0) {
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
  const outPath = process.argv[3] || inPath.replace(/\.jsonl$/, '.redetect.jsonl')
  if (!inPath) {
    console.error('usage: node skyslope-forms-redetect-from-cache.mjs <input.jsonl> [output.jsonl]')
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
  let execLow = 0
  let pdfMissing = 0

  await mapPool(inputs, CONCURRENCY, async (cached) => {
    const folderDetail = await getFolderDetail(session, cached.folderKind, cached.folderGuid)
    const docs = await getFolderDocs(session, cached.folderKind, cached.folderGuid)
    const liveDoc = docs.find((d) => d.id === cached.documentId)
    if (!liveDoc) {
      // Doc disappeared. Emit cached entry as-is so it stays in the pipeline.
      outStream.write(JSON.stringify({ ...cached, redetect_status: 'doc_not_found' }) + '\n')
      return
    }

    const category = cached.category || inferKindV2(liveDoc.fileName, liveDoc.name)

    const pdf = await getPdfText(session, liveDoc)
    if (!pdf.text) {
      pdfMissing += 1
    }

    const exec = detectExecuted({
      category,
      folderType: cached.folderKind,
      folderDetail,
      pdfText: pdf.text || null,
    })

    if (exec.executed) {
      if (exec.confidence === 'high') execHigh += 1
      else if (exec.confidence === 'medium') execMed += 1
    } else {
      execLow += 1
    }

    // Recompute `.to` using same date/seq/sale#/oref#/formName but new X.
    // Parse out the existing pieces from cached.to to find them.
    const oldTo = String(cached.to || '')
    // oldTo example: "2025-08-06 029 X 220205567 001 Residential Real Estate Sale Agreement.pdf"
    // We keep date+seq+saleNumber+orefNumber+formName, swap only X.
    const m = oldTo.match(
      /^(\d{4}-\d{2}-\d{2})\s+(\d{3})\s+(?:X\s+)?(.*?)\.([A-Za-z0-9]{1,8})$/
    )
    let date = ''
    let seqStr = '001'
    let middle = ''
    let ext = fileExtension(cached.from) || 'pdf'
    if (m) {
      date = m[1]
      seqStr = m[2]
      middle = m[3]
      ext = m[4]
    } else {
      // Fallback: use derived extension and a placeholder name.
      middle = oldTo.replace(/\.[A-Za-z0-9]{1,8}$/, '')
    }

    // Strip a leading "X " from middle in case the regex caught it (it won't,
    // but defensive).
    middle = middle.replace(/^X\s+/i, '')

    // Build new name: date seq [X] {middle}.ext
    const newTo = exec.executed
      ? `${date} ${seqStr} X ${middle}.${ext}`.replace(/\s+/g, ' ').trim()
      : `${date} ${seqStr} ${middle}.${ext}`.replace(/\s+/g, ' ').trim()

    outStream.write(
      JSON.stringify({
        action: 'would_rename',
        folderKind: cached.folderKind,
        folderGuid: cached.folderGuid,
        address: cached.address,
        documentId: cached.documentId,
        from: liveDoc.fileName, // CURRENT name (post-rename) is the from going forward
        to: newTo,
        category,
        executed: exec.executed,
        execConfidence: exec.confidence,
        execReason: exec.reason,
        execObligated: exec.obligated,
        execMatched: exec.matched,
        execMissing: exec.missing,
        pdfPages: pdf.pages || 0,
        pdfSkipped: pdf.skipped || '',
      }) + '\n'
    )
  })

  outStream.end()

  console.error(
    JSON.stringify({
      stage: 'summary',
      total: inputs.length,
      executed_high: execHigh,
      executed_medium: execMed,
      not_executed: execLow,
      pdf_missing: pdfMissing,
      output: outPath,
    })
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
