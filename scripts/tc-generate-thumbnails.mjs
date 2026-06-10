#!/usr/bin/env node
/**
 * Generate hover-preview thumbnails for every TC document: FIRST page and
 * LAST page (where signature blocks live on most OREF forms), so Matt can
 * check signature state without opening the PDF.
 *
 * Output (Storage bucket tc-documents):
 *   tc-thumbs/<documentId>__p1.jpg
 *   tc-thumbs/<documentId>__plast.jpg   (skipped for 1-page docs)
 *
 * Resumable: lists existing thumbs once and skips them. Pure Node rendering
 * (pdfjs-dist + @napi-rs/canvas — same stack as _render-pdf-pages.mjs).
 *
 * Usage: node --env-file=.env.local scripts/tc-generate-thumbnails.mjs [--limit=N]
 */
import { createClient } from '@supabase/supabase-js'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createCanvas } from '@napi-rs/canvas'

const LIMIT = Number((process.argv.find((a) => a.startsWith('--limit=')) || '').split('=')[1] || 0)
const SCALE = 1.3 // ~ 940px wide for letter pages — readable signatures in the hover card
const BUCKET = 'tc-documents'
const PREFIX = 'tc-thumbs'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

async function listExistingThumbs() {
  const existing = new Set()
  let offset = 0
  for (;;) {
    const { data, error } = await supabase.storage.from(BUCKET).list(PREFIX, { limit: 1000, offset })
    if (error || !data?.length) break
    for (const f of data) existing.add(f.name)
    if (data.length < 1000) break
    offset += data.length
  }
  return existing
}

async function allDocs() {
  const docs = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('tc_documents')
      .select('id, name, storage_path, page_count, content_type')
      .not('storage_path', 'is', null)
      .order('id')
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    docs.push(...data)
    if (data.length < 1000) break
  }
  return docs
}

async function renderPage(doc, pageNum) {
  const page = await doc.getPage(pageNum)
  const viewport = page.getViewport({ scale: SCALE })
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: ctx, viewport }).promise
  return canvas.toBuffer('image/jpeg', 80)
}

async function main() {
  const existing = await listExistingThumbs()
  const docs = await allDocs()
  console.log(`${docs.length} docs with binaries | ${existing.size} thumbs already present`)

  let done = 0
  let skipped = 0
  let failed = 0
  const work = LIMIT ? docs.slice(0, LIMIT) : docs

  for (const d of work) {
    const p1Key = `${d.id}__p1.jpg`
    const plastKey = `${d.id}__plast.jpg`
    const isPdf = /pdf/i.test(d.content_type || '') || /\.pdf$/i.test(d.name || '')
    if (!isPdf) {
      skipped++
      continue
    }
    if (existing.has(p1Key) && (existing.has(plastKey) || d.page_count === 1)) {
      skipped++
      continue
    }
    try {
      const { data: blob, error } = await supabase.storage.from(BUCKET).download(d.storage_path)
      if (error) throw new Error(`download: ${error.message}`)
      const buf = Buffer.from(await blob.arrayBuffer())
      const pdf = await getDocument({ data: new Uint8Array(buf), verbosity: 0 }).promise

      if (!existing.has(p1Key)) {
        const jpg = await renderPage(pdf, 1)
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(`${PREFIX}/${p1Key}`, jpg, {
          contentType: 'image/jpeg',
          upsert: true,
        })
        if (upErr) throw new Error(`upload p1: ${upErr.message}`)
      }
      if (pdf.numPages > 1 && !existing.has(plastKey)) {
        const jpg = await renderPage(pdf, pdf.numPages)
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(`${PREFIX}/${plastKey}`, jpg, {
          contentType: 'image/jpeg',
          upsert: true,
        })
        if (upErr) throw new Error(`upload plast: ${upErr.message}`)
      }
      await pdf.destroy()
      done++
      if (done % 50 === 0) console.log(`  ${done} rendered…`)
    } catch (e) {
      failed++
      if (failed <= 20) console.error(`fail ${d.name?.slice(0, 50)}: ${e?.message?.slice(0, 120)}`)
    }
  }
  console.log(`rendered ${done}, skipped ${skipped} (existing/non-pdf), failed ${failed}`)
}

main().catch((e) => {
  console.error('Fatal:', e?.message || e)
  process.exit(1)
})
