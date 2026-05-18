#!/usr/bin/env node
/**
 * Validate the improved executed-detection on a single document by fetching
 * its PDF, OCRing the full document (up to 50 pages), running detectExecuted,
 * and printing the result.
 *
 *   node scripts/skyslope-execution-probe.mjs <folderKind> <folderGuid> <documentId>
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
  extractOrefNumber,
  extractSaleAgreementNumber,
  deriveFormName,
  fileExtension,
  inferKindV2,
  suggestStandardNameV2,
} from './skyslope-forms-document-taxonomy-v2.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const ENV_PATH = path.join(ROOT, '.env.local')
const BASE = 'https://api-latest.skyslope.com'

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

async function fetchFolderDetail(session, folderKind, folderGuid) {
  const pathSeg = folderKind === 'listing' ? 'listings' : 'sales'
  const r = await skyslopeFetchWithRetry(`${BASE}/api/files/${pathSeg}/${folderGuid}`, {
    headers: apiHeaders(session),
  })
  if (!r.ok) return null
  const j = await r.json()
  return j?.value?.[folderKind] || null
}

async function fetchDoc(session, folderKind, folderGuid, documentId) {
  const pathSeg = folderKind === 'listing' ? 'listings' : 'sales'
  const r = await skyslopeFetchWithRetry(
    `${BASE}/api/files/${pathSeg}/${folderGuid}/documents`,
    { headers: apiHeaders(session) }
  )
  if (!r.ok) return null
  const j = await r.json()
  const docs = j?.value?.documents ?? []
  return docs.find((d) => d.id === documentId) || null
}

async function main() {
  const [folderKind, folderGuid, documentId] = process.argv.slice(2)
  if (!folderKind || !folderGuid || !documentId) {
    console.error('usage: node skyslope-execution-probe.mjs <listing|sale> <folderGuid> <documentId>')
    process.exit(2)
  }
  const env = loadEnv()
  const session = await login(env)

  const [folder, doc] = await Promise.all([
    fetchFolderDetail(session, folderKind, folderGuid),
    fetchDoc(session, folderKind, folderGuid, documentId),
  ])
  if (!doc) {
    console.error('doc not found')
    process.exit(1)
  }
  console.log(`doc: ${doc.fileName}`)
  console.log(`sellers:`, (folder?.sellers || []).map((s) => `${s.firstName || ''} ${s.lastName || ''}`.trim()))
  console.log(`buyers: `, (folder?.buyers || []).map((b) => `${b.firstName || ''} ${b.lastName || ''}`.trim()))
  console.log(`category: ${inferKindV2(doc.fileName, doc.name)}`)

  const dl = await fetchSkyslopeDocumentBinary(doc.url, () => apiHeaders(session))
  const classified = classifyPdfDownload(dl.buf, dl.status, dl.contentType, 9_000_000)
  if (!classified.ok) {
    console.error(`pdf download failed: ${classified.reason}`)
    process.exit(1)
  }
  console.log(`pdf bytes: ${dl.buf.length}`)
  console.log('analyzing pdf with maxPages=50...')
  const insight = await analyzePdfBuffer(dl.buf, { maxPages: 50, ocrMaxPages: 50 })
  console.log(`pdf pages total: ${insight.pageCount}, analyzed: ${insight.pagesAnalyzed}, textLen: ${(insight.text || '').length}`)
  console.log(`flags: ${insight.flagsLine}`)
  console.log(`text snippet (last 800 chars of merged text):`)
  console.log('---')
  console.log((insight.text || '').slice(-800))
  console.log('---')

  const category = inferKindV2(doc.fileName, doc.name)
  const exec = detectExecuted({
    category,
    folderType: folderKind,
    folderDetail: folder,
    pdfText: insight.text || null,
  })
  console.log('\n=== detectExecuted result ===')
  console.log(JSON.stringify(exec, null, 2))

  const sale = extractSaleAgreementNumber(insight.text || '')
  const oref = extractOrefNumber(doc.fileName)
  const formName = deriveFormName(doc.fileName, oref, category)
  const uploadIso = doc.uploadDate || doc.modifiedDate
  const date = uploadIso ? new Date(uploadIso).toISOString().slice(0, 10) : ''
  const ext = fileExtension(doc.fileName)
  const suggested = suggestStandardNameV2({
    date,
    executed: exec.executed,
    saleNumber: sale,
    orefNumber: oref,
    formName,
    extension: ext,
  })
  console.log('\n=== full v3 filename pipeline ===')
  console.log(JSON.stringify({ sale, oref, formName, date, ext, executed: exec.executed, suggested }, null, 2))

  // Look for the sale-agreement-# region of the text for visibility.
  const m = (insight.text || '').match(/sale\s+agreement\s*#[^\n]{0,80}/i)
  console.log('\n=== sale agreement # context in OCR ===')
  console.log(m ? m[0] : '(no match)')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
