#!/usr/bin/env node
/**
 * Extract page-1 + signature-page text from every PDF in
 * tmp/skyslope-pdfs/<guid>/binaries/ using pdfjs (no API calls).
 *
 * Writes one JSON file per doc to ../texts/ with:
 *   { docId, original, page1, totalPages, lastTwoPages, hasText }
 *
 * Used by the agent (this Claude session) to classify forms and
 * validate execution from local text — no Anthropic API needed.
 */
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import fs from 'node:fs/promises'
import path from 'node:path'

const GUID = '2b9046c3-25aa-4efd-b4b1-bd381d6f2a8d'
const ROOT = `tmp/skyslope-pdfs/${GUID}`
const BIN = `${ROOT}/binaries`
const OUT = `${ROOT}/texts`
await fs.mkdir(OUT, { recursive: true })

const manifest = JSON.parse(await fs.readFile(`${ROOT}/binaries-manifest.json`, 'utf8'))

for (let i = 0; i < manifest.length; i++) {
  const entry = manifest[i]
  const local = entry.localPath
  // Skip non-PDF
  if (!local.toLowerCase().endsWith('.pdf')) {
    await fs.writeFile(`${OUT}/${path.basename(local, path.extname(local))}.json`, JSON.stringify({ ...entry, skipped: 'non-pdf' }, null, 2))
    console.log(`  ${i+1}/${manifest.length} SKIP non-pdf: ${entry.original}`)
    continue
  }
  try {
    const buf = await fs.readFile(local)
    const data = new Uint8Array(buf)
    const doc = await getDocument({ data, verbosity: 0 }).promise
    const total = doc.numPages
    // Per skill: read every page, cap at 50 (skill section "What 'every page' means")
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
      docId: entry.docId,
      original: entry.original,
      totalPages: total,
      readPages: pagesToRead,
      truncated: total > MAX_PAGES,
      hasText: allText.trim().length > 50,
      pages,                                  // every page as { page, text }
      page1: pages[0]?.text?.slice(0, 6000) || '',
      fullText: allText,                       // concatenated end-to-end for grep
    }
    await fs.writeFile(`${OUT}/${path.basename(local, '.pdf')}.json`, JSON.stringify(out, null, 2))
    console.log(`  ${i+1}/${manifest.length}  pages=${total}  ${entry.original.substring(0, 50)}`)
  } catch (e) {
    await fs.writeFile(`${OUT}/${path.basename(local, '.pdf')}.json`, JSON.stringify({ ...entry, error: String(e).substring(0, 300) }, null, 2))
    console.log(`  ${i+1}/${manifest.length} ERROR: ${e.message?.substring(0, 100)}`)
  }
}
console.log('Done.')
