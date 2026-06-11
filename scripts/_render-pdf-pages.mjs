#!/usr/bin/env node
/**
 * Render specific pages of a PDF to PNG using pdfjs-dist + @napi-rs/canvas.
 * Works without poppler/imagemagick/ghostscript — pure Node.
 *
 * Usage:
 *   node scripts/_render-pdf-pages.mjs <input.pdf> <outdir> <pageSpec>
 *
 *   pageSpec: comma-separated page numbers or ranges, e.g. "1,13-14,7"
 *   Output:   <outdir>/<basename>_page<N>.png
 *
 * Example:
 *   node scripts/_render-pdf-pages.mjs tmp/.../b9de0736.pdf out/ 13-14
 */
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createCanvas } from '@napi-rs/canvas'
import fs from 'node:fs/promises'
import path from 'node:path'

const [, , inputPdf, outdir, pageSpec] = process.argv
if (!inputPdf || !outdir || !pageSpec) {
  console.error('usage: _render-pdf-pages.mjs <input.pdf> <outdir> <pageSpec>')
  process.exit(1)
}

await fs.mkdir(outdir, { recursive: true })
const data = new Uint8Array(await fs.readFile(inputPdf))
const doc = await getDocument({ data, verbosity: 0 }).promise
const totalPages = doc.numPages
const base = path.basename(inputPdf, '.pdf')

// Parse page spec
const pages = new Set()
for (const part of pageSpec.split(',')) {
  if (part.includes('-')) {
    const [a, b] = part.split('-').map(Number)
    for (let i = a; i <= b; i++) pages.add(i)
  } else {
    pages.add(Number(part))
  }
}

const RENDER_SCALE = 1.5  // ~150 DPI

for (const pageNum of [...pages].sort((a, b) => a - b)) {
  if (pageNum < 1 || pageNum > totalPages) {
    console.warn(`Page ${pageNum} out of range (1-${totalPages})`)
    continue
  }
  const page = await doc.getPage(pageNum)
  const viewport = page.getViewport({ scale: RENDER_SCALE })
  const canvas = createCanvas(viewport.width, viewport.height)
  const ctx = canvas.getContext('2d')
  await page.render({ canvasContext: ctx, viewport }).promise

  const outPath = path.join(outdir, `${base}_page${pageNum}.png`)
  await fs.writeFile(outPath, canvas.toBuffer('image/png'))
  console.log(`Wrote ${outPath} (${viewport.width}x${viewport.height})`)
}
