import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import fs from 'node:fs/promises'

const [, , inputPdf] = process.argv
const data = new Uint8Array(await fs.readFile(inputPdf))
const doc = await getDocument({ data, verbosity: 0 }).promise
let allText = ''
for (let i = 1; i <= doc.numPages; i++) {
  const page = await doc.getPage(i)
  const content = await page.getTextContent()
  const text = content.items.map((x) => x.str).join(' ')
  allText += `\n--- PAGE ${i} ---\n${text}\n`
}
console.log(allText)
