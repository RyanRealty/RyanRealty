#!/usr/bin/env node
/**
 * Step 3 — fetch the PDFs we link to.
 *
 * MAGIC BYTES, not Content-Type. The source serves 404s as HTTP 200 with
 * `Content-Type: application/pdf` and a 1,245-byte HTML body reading
 * "404 - File or directory not found." 21 of 2,213 came back that way; a
 * content-type check would have ingested twenty-one HTML error pages as
 * recorded CC&Rs.
 *
 * Polite by construction: this is a small title company's WordPress host, not a
 * CDN. Low concurrency, a delay between requests, an identifying User-Agent,
 * and a hard stop if the origin starts erroring.
 *
 * Resumable — a file already on disk with non-zero size is skipped.
 */
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const DIR = 'tmp/place-documents'
const DEST = `${DIR}/pdfs`
const MANIFEST = `${DIR}/download-manifest.json`
const CONCURRENCY = 3
const DELAY_MS = 250
const UA = 'RyanRealty-Research/1.0 (+https://ryan-realty.com; matt@ryan-realty.com)'

const { downloadDocs } = JSON.parse(fs.readFileSync(`${DIR}/ccr-plan.json`, 'utf8'))
await fsp.mkdir(DEST, { recursive: true })

/**
 * Skip anything already hosted. The plan lists every document our plats link
 * to, but most are already in storage from an earlier pass — re-fetching them
 * would send thousands of requests to a small title company's WordPress host
 * for files we have. Only genuinely new documents are pulled, which is what
 * makes this safe to re-run whenever `boundaries` grows.
 */
const already = new Set()
if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('place_document')
      .select('source_url').order('id', { ascending: true }).range(from, from + 999)
    if (error) { console.error(`(could not read existing documents: ${error.message} — fetching all)`); already.clear(); break }
    for (const r of data) already.add(r.source_url)
    if (data.length < 1000) break
  }
  console.error(`already hosted: ${already.size}`)
}
const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let done = 0, skipped = 0, failed = 0, consecutive = 0

async function one(doc) {
  const dest = path.join(DEST, doc.filename)
  try {
    const st = await fsp.stat(dest)
    if (st.size > 0) { skipped++; return }
  } catch { /* not yet fetched */ }

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(doc.pdf_url, { headers: { 'User-Agent': UA, Accept: 'application/pdf' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.subarray(0, 5).toString() !== '%PDF-') throw new Error('not a PDF')
      await fsp.writeFile(dest, buf)
      manifest[doc.filename] = {
        url: doc.pdf_url, name: doc.name,
        recording_ref: doc.recording_ref, recording_type: doc.recording_type,
        book: doc.book ?? null, page: doc.page ?? null,
        instrument_number: doc.instrument_number ?? null, recording_year: doc.recording_year ?? null,
        bytes: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex'),
        fetched_at: new Date().toISOString(),
      }
      done++; consecutive = 0
      return
    } catch (e) {
      if (attempt === 3) {
        failed++; consecutive++
        manifest[doc.filename] = { url: doc.pdf_url, error: String(e.message).slice(0, 120) }
        return
      }
      await sleep(attempt * 1500)
    }
  }
}

const queue = downloadDocs.filter((d) => !already.has(d.pdf_url))
const total = queue.length
console.error(`downloading ${total} PDFs -> ${DEST}`)

async function worker() {
  while (queue.length) {
    if (consecutive >= 15) {
      console.error('15 consecutive failures — stopping rather than hammering the origin')
      queue.length = 0
      return
    }
    await one(queue.shift())
    const n = done + skipped + failed
    if (n % 50 === 0) {
      console.error(`  ${n}/${total}  new=${done} cached=${skipped} failed=${failed}`)
      await fsp.writeFile(MANIFEST, JSON.stringify(manifest, null, 2))
    }
    await sleep(DELAY_MS)
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker))
await fsp.writeFile(MANIFEST, JSON.stringify(manifest, null, 2))
console.error(`\nDONE new=${done} cached=${skipped} failed=${failed}`)
if (failed) {
  console.error('failures (these are upstream 404s served as 200 unless noted):')
  for (const [f, m] of Object.entries(manifest)) if (m.error) console.error(`  ${f}: ${m.error}`)
}
