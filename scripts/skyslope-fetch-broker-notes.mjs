#!/usr/bin/env node
/**
 * Download every live Broker Notes PDF across ALL sale folders (read-only)
 * and extract text per page via pdfjs for the master review.
 *
 * Output: tmp/skyslope-master/broker-notes/<guid8>__<name>.pdf + .txt
 *         tmp/skyslope-master/broker-notes/index.json
 */
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { skyslopeFetchWithRetry, fetchSkyslopeDocumentBinary } from './skyslope-files-api.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ROOT = path.join(REPO, 'tmp/skyslope-master')
const OUT = path.join(ROOT, 'broker-notes')
const BASE = 'https://api-latest.skyslope.com'

async function login() {
  const ts = new Date().toISOString()
  const e = process.env
  const hmac = crypto
    .createHmac('sha256', e.SKYSLOPE_ACCESS_SECRET.trim())
    .update(`${e.SKYSLOPE_CLIENT_ID.trim()}:${e.SKYSLOPE_CLIENT_SECRET.trim()}:${ts}`)
    .digest('base64')
  const r = await skyslopeFetchWithRetry(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `ss ${e.SKYSLOPE_ACCESS_KEY.trim()}:${hmac}`, Timestamp: ts },
    body: JSON.stringify({ ClientId: e.SKYSLOPE_CLIENT_ID.trim(), ClientSecret: e.SKYSLOPE_CLIENT_SECRET.trim() }),
  })
  return (await r.json()).Session
}
const H = (s) => ({ Session: s, timestamp: new Date().toISOString(), Accept: 'application/json' })

async function pdfText(buf) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: true }).promise
  let out = []
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const tc = await page.getTextContent()
    out.push(tc.items.map((i) => i.str).join(' '))
  }
  return out.join('\n\n--- page break ---\n\n')
}

const session = await login()
await fs.mkdir(OUT, { recursive: true })
const analysis = JSON.parse(await fs.readFile(path.join(ROOT, 'analysis.json'), 'utf8'))
const index = []
for (const s of analysis.sales) {
  if (!s.docs.brokerNotesLive.length) continue
  // Re-fetch the documents list LIVE — saved doc.url values are pre-signed S3
  // URLs with a 5-minute expiry and have gone stale since the inventory run.
  const docsRes = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${s.guid}/documents`, { headers: H(session) })
  const docs = (await docsRes.json())?.value?.documents || []
  const seen = new Set()
  const bns = docs.filter((d) => {
    if (!d || d.fileSize === -1) return false
    const id = (d.id || '').toLowerCase()
    if (seen.has(id)) return false
    seen.add(id)
    return /broker.?notes/i.test(d.fileName || d.name || '') && !/^ARCHIVE/i.test(d.fileName || d.name || '')
  })
  for (const d of bns) {
    const name = (d.fileName || d.name || d.id).replace(/[\/\\:*?"<>|]/g, '_')
    const base = `${s.guid.slice(0, 8)}__${name}`
    const pdfPath = path.join(OUT, base.endsWith('.pdf') ? base : base + '.pdf')
    const url = d.url || `${BASE}/api/files/sales/${s.guid}/documents/${d.id}/binary`
    const fetched = await fetchSkyslopeDocumentBinary(url, () => H(session))
    if (!fetched.ok) {
      console.log(`FAIL ${fetched.status}: ${s.fullAddress} :: ${name}`)
      index.push({ guid: s.guid, address: s.fullAddress, status: s.status, doc: name, error: fetched.status })
      continue
    }
    await fs.writeFile(pdfPath, fetched.buf)
    let text = ''
    try {
      text = await pdfText(fetched.buf)
    } catch (e) {
      text = `(pdfjs failed: ${e?.message})`
    }
    await fs.writeFile(pdfPath.replace(/\.pdf$/i, '.txt'), text)
    index.push({ guid: s.guid, address: s.fullAddress, status: s.status, doc: name, pdf: pdfPath, chars: text.length })
    console.log(`ok ${s.fullAddress?.slice(0, 38).padEnd(38)} :: ${name.slice(0, 70)} (${text.length} chars)`)
  }
}
await fs.writeFile(path.join(OUT, 'index.json'), JSON.stringify(index, null, 2))
console.log(`\n${index.length} Broker Notes docs → ${OUT}`)
