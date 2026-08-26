#!/usr/bin/env node
/**
 * Step 4 — upload the PDFs and write place_document + place_document_link.
 *
 * Idempotent on source_url, so a re-run after new plats appear picks up only
 * what is new. That matters: `boundaries` grows. Five plats were added on
 * 2026-08-26 after the first pass, and Sunrise Village alone had 29 documents
 * waiting in the index that nothing had fetched.
 *
 * doc_kind and name_confirmed are NOT set here — classify.mjs derives both from
 * OCR of the document's own front matter, because a scan has no text layer and
 * the index's filing is not evidence of what a document is.
 *
 * Link status: exact matches enter pending_review like everything else. The
 * database trigger is the authority on what may publish, and classify.mjs plus
 * two-signal-publish.mjs decide what clears it.
 */
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const DIR = 'tmp/place-documents'
const BUCKET = 'place-documents'
const plan = JSON.parse(fs.readFileSync(`${DIR}/ccr-plan.json`, 'utf8'))
const manifest = JSON.parse(fs.readFileSync(`${DIR}/download-manifest.json`, 'utf8'))
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})
const slugify = (s) =>
  String(s).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

const files = (await fsp.readdir(`${DIR}/pdfs`)).filter((f) => f.endsWith('.pdf'))
console.error(`${files.length} PDFs on disk`)

const docIdByUrl = new Map()
let uploaded = 0, inserted = 0, skipped = 0, errors = 0

for (const [i, filename] of files.entries()) {
  const meta = manifest[filename]
  if (!meta || meta.error) { skipped++; continue }

  const { data: existing } = await sb.from('place_document').select('id').eq('source_url', meta.url).maybeSingle()
  if (existing) { docIdByUrl.set(meta.url, existing.id); skipped++; continue }

  const buf = await fsp.readFile(path.join(`${DIR}/pdfs`, filename))
  const storagePath = `deschutes/${slugify(meta.name)}/${meta.recording_ref.replace(/[^\w.-]/g, '_')}.pdf`

  const up = await sb.storage.from(BUCKET).upload(storagePath, buf, {
    contentType: 'application/pdf', upsert: true, cacheControl: '31536000',
  })
  if (up.error) { console.error(`  upload FAIL ${filename}: ${up.error.message}`); errors++; continue }
  uploaded++

  const ins = await sb.from('place_document').insert({
    source: 'deschutes_county_title', source_url: meta.url, county: 'Deschutes',
    published_name: meta.name, recording_type: meta.recording_type, recording_ref: meta.recording_ref,
    book: meta.book, page: meta.page, instrument_number: meta.instrument_number,
    recording_year: meta.recording_year, doc_kind: 'other',
    storage_path: storagePath, file_bytes: meta.bytes, sha256: meta.sha256, fetched_at: meta.fetched_at,
  }).select('id').single()

  if (ins.error) {
    // A single recorded instrument can legitimately serve two plats — the sha
    // is unique, so reuse the existing row rather than dropping the link.
    if (/sha_key/.test(ins.error.message)) {
      const { data: bySha } = await sb.from('place_document').select('id').eq('sha256', meta.sha256).maybeSingle()
      if (bySha) { docIdByUrl.set(meta.url, bySha.id); skipped++; continue }
    }
    console.error(`  insert FAIL ${filename}: ${ins.error.message}`); errors++; continue
  }
  docIdByUrl.set(meta.url, ins.data.id); inserted++
  if ((i + 1) % 100 === 0) console.error(`  ${i + 1}/${files.length} uploaded=${uploaded} inserted=${inserted} skipped=${skipped}`)
}
console.error(`\ndocuments uploaded=${uploaded} inserted=${inserted} skipped=${skipped} errors=${errors}`)

const docsByName = new Map()
for (const d of plan.downloadDocs) {
  const id = docIdByUrl.get(d.pdf_url)
  if (!id) continue
  if (!docsByName.has(d.name)) docsByName.set(d.name, [])
  docsByName.get(d.name).push(id)
}
const rows = []
for (const l of plan.links) {
  for (const id of docsByName.get(l.ccr_name) || []) {
    rows.push({ document_id: id, geo_type: 'subdivision', geo_slug: l.slug, match_method: l.method, status: 'pending_review' })
  }
}
console.error(`links to write: ${rows.length}`)
let linked = 0
for (let i = 0; i < rows.length; i += 500) {
  const chunk = rows.slice(i, i + 500)
  const { error } = await sb.from('place_document_link').upsert(chunk, {
    onConflict: 'document_id,geo_type,geo_slug', ignoreDuplicates: true,
  })
  if (error) { console.error(`  chunk @${i} FAIL: ${error.message}`); errors++ } else linked += chunk.length
}
console.error(`links written: ${linked}\nerrors: ${errors}`)
