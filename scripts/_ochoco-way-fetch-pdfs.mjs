#!/usr/bin/env node
/**
 * Fetch every Ochoco Way doc binary + pdfjs-extract text. Modeled on
 * _bear-st-extract-text.mjs but with binary download integrated.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

const ROOT = '/Users/matthewryan/RyanRealty'
const GUID = 'eb9a24d6-f766-4fb7-bfca-a9c7e5b83cf5'
const BIN_DIR = `${ROOT}/tmp/skyslope-pdfs/${GUID}/binaries`
const TEXT_DIR = `${ROOT}/tmp/skyslope-pdfs/${GUID}/texts`
const BASE = 'https://api-latest.skyslope.com'

async function loadEnvLocal() {
  const txt = await fs.readFile(`${ROOT}/.env.local`, 'utf8')
  for (const raw of txt.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!m) continue
    let val = m[2]
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
    if (!(m[1] in process.env)) process.env[m[1]] = val
  }
}

async function login() {
  const ts = new Date().toISOString()
  const e = process.env
  const hmac = crypto.createHmac('sha256', e.SKYSLOPE_ACCESS_SECRET.trim())
    .update(`${e.SKYSLOPE_CLIENT_ID.trim()}:${e.SKYSLOPE_CLIENT_SECRET.trim()}:${ts}`)
    .digest('base64')
  const r = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `ss ${e.SKYSLOPE_ACCESS_KEY.trim()}:${hmac}`, Timestamp: ts },
    body: JSON.stringify({ ClientId: e.SKYSLOPE_CLIENT_ID.trim(), ClientSecret: e.SKYSLOPE_CLIENT_SECRET.trim() }),
  })
  return (await r.json()).Session
}

await loadEnvLocal()
await fs.mkdir(BIN_DIR, { recursive: true })
await fs.mkdir(TEXT_DIR, { recursive: true })
const session = await login()
console.log('✓ Authenticated')

const docsJson = JSON.parse(await fs.readFile(`${ROOT}/tmp/ochoco-way-phase0/documents.json`, 'utf8'))
const docs = docsJson.value?.documents || []
console.log(`Total docs: ${docs.length}`)

const manifest = []
for (let i = 0; i < docs.length; i++) {
  const doc = docs[i]
  const docId = (doc.id || doc.docId || '').toLowerCase()
  const short = docId.substring(0, 8)
  const orig = doc.fileName || doc.documentName || `doc_${i}.pdf`
  const ext = path.extname(orig) || '.pdf'
  const localPath = path.join(BIN_DIR, `${short}${ext}`)

  // Skip if already downloaded
  try {
    const stat = await fs.stat(localPath)
    if (stat.size > 0) {
      manifest.push({ index: i, docId, short, original: orig, localPath, size: stat.size })
      console.log(`  ${i+1}/${docs.length} [cached] ${orig.substring(0, 60)}`)
      continue
    }
  } catch {}

  // Download via pre-signed URL if present
  if (doc.url) {
    try {
      const r = await fetch(doc.url, { method: 'GET' })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const buf = Buffer.from(await r.arrayBuffer())
      await fs.writeFile(localPath, buf)
      manifest.push({ index: i, docId, short, original: orig, localPath, size: buf.length })
      console.log(`  ${i+1}/${docs.length} [fetched ${buf.length}b] ${orig.substring(0, 60)}`)
    } catch (e) {
      console.log(`  ${i+1}/${docs.length} ERROR ${e.message?.substring(0, 80)}: ${orig.substring(0, 60)}`)
      manifest.push({ index: i, docId, short, original: orig, error: String(e).substring(0, 200) })
    }
  } else {
    console.log(`  ${i+1}/${docs.length} NO URL: ${orig.substring(0, 60)}`)
    manifest.push({ index: i, docId, short, original: orig, error: 'no-url' })
  }
}

await fs.writeFile(`${ROOT}/tmp/skyslope-pdfs/${GUID}/binaries-manifest.json`, JSON.stringify(manifest, null, 2))
console.log(`\nBinary fetch done. Wrote ${manifest.length} manifest entries.`)

// OCR each PDF with pdfjs
console.log('\n--- OCR pass (pdfjs) ---')
let ocrOk = 0, ocrSkip = 0
for (const entry of manifest) {
  if (!entry.localPath || entry.error) { ocrSkip++; continue }
  if (!entry.localPath.toLowerCase().endsWith('.pdf')) { ocrSkip++; continue }
  try {
    const buf = await fs.readFile(entry.localPath)
    const data = new Uint8Array(buf)
    const doc = await getDocument({ data, verbosity: 0 }).promise
    const total = doc.numPages
    const MAX_PAGES = 50
    const pagesToRead = Math.min(total, MAX_PAGES)
    const pages = []
    let allText = ''
    for (let p = 1; p <= pagesToRead; p++) {
      const pg = await doc.getPage(p)
      const t = (await pg.getTextContent()).items.map((i) => i.str).join(' ')
      pages.push({ page: p, text: t })
      allText += `\n[p${p}] ${t}`
    }
    const out = {
      docId: entry.docId, original: entry.original, totalPages: total,
      readPages: pagesToRead, truncated: total > MAX_PAGES,
      hasText: allText.trim().length > 50,
      pages, page1: pages[0]?.text?.slice(0, 6000) || '', fullText: allText,
    }
    await fs.writeFile(path.join(TEXT_DIR, `${entry.short}.json`), JSON.stringify(out, null, 2))
    ocrOk++
  } catch (e) {
    ocrSkip++
    console.log(`  OCR ERROR ${entry.short}: ${e.message?.substring(0, 80)}`)
  }
}
console.log(`OCR done. ok=${ocrOk} skip=${ocrSkip}`)
