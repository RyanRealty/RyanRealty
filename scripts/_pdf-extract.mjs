import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import fs from 'node:fs'

const path = process.argv[2]
const maxPages = parseInt(process.argv[3] || '50', 10)
if (!path) { console.error('Usage: pdf-extract.mjs <pdf> [maxPages]'); process.exit(1) }

const buf = fs.readFileSync(path)
const data = new Uint8Array(buf)
const doc = await getDocument({ data, verbosity: 0 }).promise
const total = Math.min(doc.numPages, maxPages)
for (let p = 1; p <= total; p++) {
  const page = await doc.getPage(p)
  const txt = await page.getTextContent()
  const str = txt.items.map(i => i.str).join(' ')
  console.log(`===== PAGE ${p} of ${doc.numPages} =====`)
  console.log(str)
  console.log()
}
