#!/usr/bin/env node
/**
 * Step 5 — OCR the front matter of any document that has none yet.
 *
 * County CC&R scans are photographs of paper with no text layer. Until this
 * runs they are opaque: we cannot tell a declaration from a deed, cannot check
 * that a document names the plat it was filed under, and no crawler can read a
 * word of them. Apple Vision runs on-device, so the corpus costs nothing but
 * time and no page leaves this machine.
 *
 * Two pages is the right depth. The document's own title, the county's
 * recording stamp and the subdivision name all sit on page 1 or 2, and that is
 * everything classify.mjs needs. Full-text OCR is a separate, deeper pass.
 *
 * Reads the PDF from tmp/place-documents/pdfs, writes ocr_text back to the row.
 * Only touches rows where ocr_text IS NULL, so it is safe to re-run.
 *
 * Build the binary first:
 *   swiftc -O -o scripts/place-documents/ocr scripts/place-documents/ocr.swift
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import os from 'node:os'
import { createClient } from '@supabase/supabase-js'

const DIR = 'tmp/place-documents'
const PDF_DIR = `${DIR}/pdfs`
const OCR_BIN = 'scripts/place-documents/ocr'
const PAGES = Number(process.env.OCR_PAGES || 2)
const WORKERS = Number(process.env.OCR_WORKERS || Math.max(2, Math.min(8, os.cpus().length - 2)))

if (!fs.existsSync(OCR_BIN)) {
  console.error(`missing ${OCR_BIN} — build it:\n  swiftc -O -o ${OCR_BIN} ${OCR_BIN}.swift`)
  process.exit(1)
}

const manifest = JSON.parse(fs.readFileSync(`${DIR}/download-manifest.json`, 'utf8'))
const fileByUrl = new Map()
for (const [f, m] of Object.entries(manifest)) if (m.url && !m.error) fileByUrl.set(m.url, f)

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const pending = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb.from('place_document')
    .select('id,source_url').is('ocr_text', null)
    .order('id', { ascending: true }).range(from, from + 999)
  if (error) throw new Error(error.message)
  pending.push(...data)
  if (data.length < 1000) break
}
console.error(`documents with no OCR yet: ${pending.length}`)

const work = pending
  .map((r) => ({ id: r.id, file: fileByUrl.get(r.source_url) }))
  .filter((w) => w.file && fs.existsSync(path.join(PDF_DIR, w.file)))
console.error(`of those, ${work.length} have their PDF on disk`)
if (!work.length) process.exit(0)

function ocrOne(file) {
  return new Promise((resolve) => {
    execFile(OCR_BIN, [path.join(PDF_DIR, file), String(PAGES)],
      { maxBuffer: 8 * 1024 * 1024, timeout: 120_000 },
      (err, stdout) => resolve(err ? '' : stdout))
  })
}

const queue = [...work]
let done = 0, empty = 0, failed = 0
async function worker() {
  while (queue.length) {
    const w = queue.shift()
    const text = (await ocrOne(w.file)).replace(/\s+/g, ' ').trim()
    if (!text) empty++
    const { error } = await sb.from('place_document')
      .update({ ocr_text: text.slice(0, 6000), ocr_at: new Date().toISOString() })
      .eq('id', w.id)
    if (error) failed++
    done++
    if (done % 50 === 0) console.error(`  ${done}/${work.length} empty=${empty} failed=${failed}`)
  }
}
await Promise.all(Array.from({ length: WORKERS }, worker))
console.error(`\nDONE ocr'd=${done} empty=${empty} write-failed=${failed}`)
