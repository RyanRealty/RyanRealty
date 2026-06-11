import fs from 'node:fs/promises'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

const ROOT = '/Users/matthewryan/RyanRealty'
const WORK = `${ROOT}/tmp/huntington-rd-2026-05-28`
const BINS = `${WORK}/binaries`

const OREF_RE = /OREF\s*(\d{3}[A-Z]?)\s*\|\s*Released/i
const OREF_LOOSE = /OREF[\s\-_]*(\d{3}[A-Z]?)/i
const SALE_RE = /Sale\s+Agreement\s+#[\s:]*([A-Za-z0-9\-_\/]+)/i
const ENV_RE = /DigiSign\s+Verified\s*-\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi

const docs = JSON.parse(await fs.readFile(`${WORK}/phase0/documents.json`, 'utf8')).value.documents
const out = []

for (const d of docs) {
  const short = d.id.toLowerCase().substring(0, 8)
  const filename = d.fileName || ''
  const ext = filename.toLowerCase().match(/\.([a-z0-9]{2,4})$/)?.[1] || 'pdf'
  if (ext !== 'pdf') {
    out.push({ docId: d.id, short8: short, filename, type: 'non-pdf', ext, page_count: 0, constituent_forms: [] })
    continue
  }
  try {
    const data = new Uint8Array(await fs.readFile(`${BINS}/${short}.${ext}`))
    const doc = await getDocument({ data, verbosity: 0 }).promise
    const pages = doc.numPages
    // Extract text per page; detect OREF headers
    const pagesByOref = {}
    let saleNumber = null
    const envelopes = new Set()
    const partyText = []
    for (let i = 1; i <= pages; i++) {
      const p = await doc.getPage(i)
      const text = (await p.getTextContent()).items.map((x) => x.str).join(' ')
      const strict = text.match(OREF_RE)
      const loose = !strict && text.match(OREF_LOOSE)
      const oref = strict ? strict[1] : (loose ? loose[1] : null)
      if (oref) {
        if (!pagesByOref[oref]) pagesByOref[oref] = { pages: [], matchType: strict ? 'strict' : 'loose' }
        pagesByOref[oref].pages.push(i)
      }
      const sa = text.match(SALE_RE)
      if (sa && !saleNumber) saleNumber = sa[1]
      let m
      while ((m = ENV_RE.exec(text)) !== null) envelopes.add(m[1].toLowerCase())
      if (i <= 2) partyText.push(text.substring(0, 500))
    }
    const constituents = Object.entries(pagesByOref).map(([oref, info]) => ({ oref, page_range: info.pages, match_type: info.matchType }))
    out.push({
      docId: d.id, short8: short, filename,
      page_count: pages,
      is_bundle: constituents.length > 1,
      constituent_forms: constituents,
      sale_number: saleNumber,
      envelopes: [...envelopes],
      uploadDate: d.uploadDate,
    })
  } catch (e) {
    out.push({ docId: d.id, short8: short, filename, type: 'parse_error', error: e.message })
  }
}

await fs.writeFile(`${WORK}/phase2/classify.json`, JSON.stringify(out, null, 2))
console.log(`Classified ${out.length} docs`)
console.log(`  Bundles: ${out.filter((x) => x.is_bundle).length}`)
console.log(`  Non-OREF (no constituent): ${out.filter((x) => (x.constituent_forms||[]).length === 0).length}`)
console.log(`  Image/non-pdf: ${out.filter((x) => x.type === 'non-pdf').length}`)
console.log(`  Parse errors: ${out.filter((x) => x.type === 'parse_error').length}`)
// Distribution of OREF#s found
const orefCounts = {}
for (const o of out) for (const c of (o.constituent_forms||[])) orefCounts[c.oref] = (orefCounts[c.oref]||0) + 1
console.log(`  OREF distribution:`, JSON.stringify(orefCounts))
// Distribution of sale#s found
const saleCounts = {}
for (const o of out) if (o.sale_number) saleCounts[o.sale_number] = (saleCounts[o.sale_number]||0) + 1
console.log(`  Sale# distribution:`, JSON.stringify(saleCounts))
