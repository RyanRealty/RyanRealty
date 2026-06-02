#!/usr/bin/env node
/** Extract text from PDFs via pdfjs (per-page). Usage: node pdf-text.mjs <file.pdf> [grepRegex] */
import fs from 'node:fs/promises'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
const file = process.argv[2]
const grep = process.argv[3] ? new RegExp(process.argv[3], 'i') : null
const data = new Uint8Array(await fs.readFile(file))
const doc = await getDocument({ data, useSystemFonts: true }).promise
console.log(`# ${file}  (${doc.numPages} pages)`)
for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p)
  const tc = await page.getTextContent()
  // reconstruct lines by y-position
  const rows = {}
  for (const it of tc.items) {
    if (!it.str) continue
    const y = Math.round(it.transform[5])
    ;(rows[y] ||= []).push([it.transform[4], it.str])
  }
  const lines = Object.keys(rows).map(Number).sort((a, b) => b - a)
    .map(y => rows[y].sort((a, b) => a[0] - b[0]).map(x => x[1]).join(' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  console.log(`\n----- page ${p} -----`)
  for (const ln of lines) { if (!grep || grep.test(ln)) console.log(ln) }
}
