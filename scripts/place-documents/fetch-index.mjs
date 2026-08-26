#!/usr/bin/env node
/**
 * Step 1 — parse the Deschutes County Title CC&R index into structured rows.
 *
 * The recording reference in column two is the thing PLACE_CONTENT_RULES R7
 * requires on the face of a hosted document, and it comes in two forms because
 * the county changed how it records:
 *   "197-242"     -> Book 197, Page 242   (volume/page era)
 *   "2007-36361"  -> year 2007, instrument 36361
 *
 * Writes tmp/place-documents/ccrs-index.json. Idempotent.
 */
import fs from 'node:fs'
import fsp from 'node:fs/promises'

const OUT_DIR = 'tmp/place-documents'
const SRC = 'https://deschutescountytitle.com/ccrs'
const UA = 'RyanRealty-Research/1.0 (+https://ryan-realty.com; matt@ryan-realty.com)'

await fsp.mkdir(OUT_DIR, { recursive: true })

const res = await fetch(SRC, { headers: { 'User-Agent': UA } })
if (!res.ok) throw new Error(`index fetch failed: HTTP ${res.status}`)
const html = await res.text()

const strip = (s) =>
  s.replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&').replace(/&#8217;/g, "'").replace(/&#8211;/g, '-')
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ').trim()

const rows = []
for (const m of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
  const tr = m[1]
  const href = (tr.match(/href="([^"]*des_ccrs[^"]*\.pdf)"/i) || [])[1]
  if (!href) continue
  const cells = [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => c[1])
  if (cells.length < 2) continue
  const name = strip(cells[0])
  const ref = strip(cells[1])
  if (!name) continue

  const row = { name, recording_ref: ref, pdf_url: href.replace(/&amp;/g, '&') }
  let mm
  if ((mm = ref.match(/^(\d{4})-(\d+)$/)) && Number(mm[1]) >= 1960 && Number(mm[1]) <= 2030) {
    row.recording_type = 'year-instrument'
    row.recording_year = Number(mm[1])
    row.instrument_number = ref
  } else if ((mm = ref.match(/^(\d+)-(\d+)$/))) {
    row.recording_type = 'book-page'
    row.book = Number(mm[1])
    row.page = Number(mm[2])
  } else {
    row.recording_type = 'unparsed'
  }
  row.filename = decodeURIComponent(href.split('/').pop())
  rows.push(row)
}

const names = new Set(rows.map((r) => r.name))
fs.writeFileSync(`${OUT_DIR}/ccrs-index.json`, JSON.stringify(rows, null, 2))
console.log(`index rows: ${rows.length} across ${names.size} distinct subdivision names`)
console.log(`wrote ${OUT_DIR}/ccrs-index.json`)
