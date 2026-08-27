#!/usr/bin/env node
/**
 * The same stamp, read over the whole document instead of its first two pages.
 *
 * THIS IS NOT A FOURTH SIGNAL. It is the third one — the recorder's book-and-page
 * stamp running across consecutive pages — evaluated over pages the corpus had
 * never been read. `ocr.mjs` reads two pages, because two pages is everything
 * `classify.mjs` needs: the title, the recording stamp, the subdivision name.
 * But a stamp run needs a stamp on page k AND page k+1, and with two OCR'd pages
 * there is exactly one pair to test. Documents whose front page is a return-address
 * cover, an exhibit, or an unreadable scan had their run one page out of reach.
 *
 * Measured over the 195 held book-page documents (governing kind, name_confirmed,
 * pending parent match), 2026-08-26:
 *
 *   OCR depth   documents whose stamp run is found
 *        2 (stored)              40
 *        3                       59
 *        4                       66
 *        6                       75
 *       12                       79   <- plateau; 20 and 40 find nothing more
 *
 * So the depth is 12 pages, and it is a measured number, not a round one.
 *
 * WHAT IT CLEARS. 39 documents gain the run. 4 of them have every link held by
 * the phase guard, so 35 documents publish 86 links across 72 plats, and the
 * review queue drops from 196 groups carrying a governing instrument to 189
 * (278 groups to 274 counting the ones that hold nothing publishable).
 *
 * ADVERSARIAL, run exactly as the book-page signal was:
 *
 *   A — every deep-read document against every OTHER real recording reference in
 *   the corpus. 1,113 real references. At depth 2 the re-read fires 8 times; at
 *   depth 12, 9. Depth adds exactly ONE fire, and it is Justin Glen 430-0052,
 *   whose pages 6 and 7 carry a second stamp sequence — 429-0755 then 429-0756 —
 *   because the instrument was re-recorded and physically bears both. That is the
 *   same category the original test found four times. Of the other eight, six are
 *   the seven "Sunset West" rows that share one storage object (see below), one is
 *   Ponderosa Pines 331-558 whose own first page is stamped 331-556, and one is
 *   Eagle Crest 354-0118T answering to 354-118 — the same reference written two
 *   ways. NOT ONE is a stamp the document does not physically carry, and not one
 *   crosses to another subdivision's chain.
 *
 *   B — every deep-read document against 3,000 synthetic references drawn from
 *   the real book and page distributions. 0 fires, at every depth.
 *
 *   All 39 clearances were read against the OCR by hand. Every matched string is
 *   unmistakably the recorder's header on both pages.
 *
 * WHAT WAS TRIED AND REJECTED.
 *
 *   Extending the YEAR-INSTRUMENT check (two-signal-publish.mjs) over the deeper
 *   text. It gains two documents, and neither is a depth gain: both stamps are on
 *   page 1 and the stored two-page OCR simply misread them (2001-34487 reads
 *   "2001-3487"; 2002-21686's fee line ate the number). Meanwhile the instrument
 *   number is a string a declaration RECITES — measured against every other real
 *   instrument number, the check answers to a number that is not its own 35 times
 *   on the stored text and 34 times on twelve pages. Depth buys nothing there and
 *   the recital exposure is real, so this script does not touch it.
 *
 *   Relaxing the anchor — accepting a run in the right book at any page, to
 *   recover a scan that starts one page late. Measured: of the 155 held documents
 *   with no strict run on the stored text, 6 carry a same-book run at another
 *   page, and the offsets are -2, and five beyond ±5. They are other instruments
 *   in the same volume, which is exactly what the anchor is for. One document
 *   recovered, five wrong ones admitted. Rejected.
 *
 *   Storing the deeper text in `ocr_text`. It would change what `name_confirmed`
 *   and `doc_kind` MEAN, silently, on the next `classify.mjs` run: `nameConfirmed`
 *   scans the whole column, and `classify` falls back to testing every governing
 *   pattern over the whole column. Measured on the 290 held documents, doc_kind
 *   changes on 4 of them from depth alone — and those are documents already
 *   confirmed, so the exposure on the 408 pending links that are NOT name-confirmed
 *   is larger and untested. The deeper read therefore stays inside this script,
 *   where it decides one thing and nothing else reads it.
 *
 *   The clerk's document-type code and the receipt/serial digits in the recording
 *   block. `D-CCR Cnt=1 Stn=23` is already the authority `classify.mjs` uses for
 *   doc_kind, and the long digit run — "00233576200400005840840043" — decodes as
 *   an 8-digit clerk serial, the year, the 7-digit instrument number and a
 *   trailing counter. The instrument number inside it is the stamp we already
 *   check. Nothing else in it can be cross-checked, because the index publishes
 *   name, recording reference and a PDF link and NOTHING ELSE — no date, no
 *   declarant, no receipt number. A serial with nothing to compare it against is
 *   not a confirmation. The same kills "recording date plus declarant name": the
 *   index has neither field.
 *
 *   Chain adjacency — a held document whose index reference is one page after a
 *   confirmed document's last page. It is a statement about two INDEX rows, not
 *   about the PDF we are holding, and identity is a claim about the PDF. Rejected
 *   on principle, before measuring.
 *
 * THE RULE HAS ONE DEFINITION. This script does not copy `stampRun` or the phase
 * guard — it EVALUATES them out of `book-page-stamp-publish.mjs`, which owns them,
 * and refuses to run if it cannot find them. There is no second copy to drift, and
 * no way for this script to be reading a laxer rule than the one that shipped.
 *
 * IT NEVER OVERTURNS A RULING. A demotion script writes its reason onto the link
 * and moves it back to review — `phase-governance.mjs` when a document names a
 * phase the plat contradicts, `foreign-plat` when the instrument turns out to be
 * about somebody else's association. Both run AFTER the publish scripts precisely
 * because those scripts select on `pending_review` + `parent` and would re-publish
 * what was just demoted. Rather than enumerate the demoters — the enumeration is
 * always one script out of date, and it was: the first run of this script
 * re-published Mountain View 327-2533 onto `mountain-view-addition`, which is the
 * bylaws of Mountain View Park Homeowners Association and belongs to neither — this
 * one publishes ONLY a link whose `review_note` is empty. A note of any kind means
 * something already ruled on this row, and a stamp is not an argument against a
 * ruling: the stamp proves the document is the instrument the index filed, and
 * says nothing about whose plat it governs. Measured: all 86 links this script
 * cleared on 2026-08-26 had an empty note, so the rule costs nothing and closes
 * the hazard against every demoter, present and future.
 *
 * A SEPARATE FINDING, not fixed here: seven `place_document` rows for "Sunset
 * West" — and nine rows in all, adding "Forum" and "Sterling Pointe (Phase 2)" —
 * carry an EMPTY storage basename. `ingest.mjs` builds the path as
 * `deschutes/<name>/<recording_ref>.pdf`, and those index rows have a blank
 * recording reference, so every one of them points at the same object,
 * `deschutes/sunset-west/.pdf`. Five of the Sunset West rows have PUBLISHED links.
 * A reader who opens any of them gets one file. `verify.mjs` does not check that a
 * published document's hosted bytes are the instrument its face text names.
 *
 * usage: node --env-file=.env.local scripts/place-documents/deep-stamp-publish.mjs [--apply]
 *        --evidence[=N]  print the OCR either side of both stamps
 *        --depth=N       OCR depth in pages (default 12, the measured plateau)
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFile } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')
const EVIDENCE = (() => {
  const a = process.argv.find((x) => x === '--evidence' || x.startsWith('--evidence='))
  if (!a) return 0
  const n = Number(a.split('=')[1])
  return Number.isFinite(n) && n > 0 ? n : 25
})()
/** 12 pages is where recall plateaus — see the table above. Every extra page is
 *  extra surface for a coincidence, so this is not set higher "to be safe". */
const DEPTH = (() => {
  const a = process.argv.find((x) => x.startsWith('--depth='))
  const n = a ? Number(a.split('=')[1]) : Number(process.env.DEEP_PAGES || 12)
  return Number.isFinite(n) && n >= 2 ? Math.trunc(n) : 12
})()

const OCR_BIN = 'scripts/place-documents/ocr'
const CACHE = 'tmp/place-documents/deep-ocr'
const PDF_CACHE = 'tmp/place-documents/deep-pdfs'
const WORKERS = Number(process.env.OCR_WORKERS || Math.max(2, Math.min(8, os.cpus().length - 2)))
const GOVERNING = new Set(['ccr', 'amendment', 'bylaws', 'articles', 'design_guidelines', 'rules'])

// --- the rule, loaded from the file that owns it ---------------------------
//
// `book-page-stamp-publish.mjs` defines the stamp run and the phase guard. This
// script must apply THE SAME BAR to a longer read, so it takes the definitions
// out of that file rather than restating them. If the anchors below stop
// matching — because that file was edited — this refuses to run instead of
// quietly falling back to a copy that may now be laxer.
const RULE_SOURCE = 'scripts/place-documents/book-page-stamp-publish.mjs'
const ruleText = fs.readFileSync(RULE_SOURCE, 'utf8')
function region(from, to) {
  const a = ruleText.indexOf(from)
  const b = ruleText.indexOf(to)
  if (a < 0 || b < 0 || b <= a) {
    console.error(
      `REFUSING TO RUN — cannot lift the rule out of ${RULE_SOURCE}.\n` +
        `  Expected the source between "${from}" and "${to}".\n` +
        `  That file owns the definition of a stamp run and the phase guard; this\n` +
        `  script must not carry its own copy. Re-point the anchors, do not fork the rule.`,
    )
    process.exit(1)
  }
  return ruleText.slice(a, b)
}
const rule = new Function(
  `${region('const pages = (text) =>', '// --- phase agreement')}\n` +
    `${region('// --- phase agreement', '// --- read')}\n` +
    `return { stampRun, phases, pages, TITLE_CHARS }`,
)()
const { stampRun, phases, TITLE_CHARS } = rule
if (typeof stampRun !== 'function' || typeof phases !== 'function' || !TITLE_CHARS) {
  console.error(`REFUSING TO RUN — ${RULE_SOURCE} did not yield stampRun, phases and TITLE_CHARS.`)
  process.exit(1)
}

if (!fs.existsSync(OCR_BIN)) {
  console.error(`missing ${OCR_BIN} — build it:\n  swiftc -O -o ${OCR_BIN} ${OCR_BIN}.swift`)
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('no Supabase credentials in env')
  process.exit(1)
}
const sb = createClient(url, key, { auth: { persistSession: false } })

// --- read ------------------------------------------------------------------
const links = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb
    .from('place_document_link')
    .select(
      'id, geo_slug, geo_label, match_method, review_note, place_document!inner(id, published_name, doc_kind, name_confirmed, recording_ref, recording_type, book, page, storage_path, ocr_text)',
    )
    .eq('status', 'pending_review')
    .eq('match_method', 'parent')
    .order('id', { ascending: true })
    .range(from, from + 999)
  if (error) throw new Error(error.message)
  links.push(...data)
  if (data.length < 1000) break
}
console.log(`pending parent-match links: ${links.length}`)

const platLabel = new Map()
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb
    .from('boundaries')
    .select('id, geo_slug, geo_label')
    .eq('geo_type', 'subdivision')
    .order('id', { ascending: true })
    .range(from, from + 999)
  if (error) throw new Error(error.message)
  for (const b of data) if (b.geo_label) platLabel.set(b.geo_slug, b.geo_label)
  if (data.length < 1000) break
}

// --- which links are this script's business --------------------------------
const reasons = {
  notGoverning: 0,
  nameUnconfirmed: 0,
  notBookPage: 0,
  alreadyReadable: 0,
  alreadyRuled: 0,
}
const considered = []
for (const l of links) {
  const d = l.place_document
  if (!GOVERNING.has(d.doc_kind)) { reasons.notGoverning++; continue }
  if (d.name_confirmed !== true) { reasons.nameUnconfirmed++; continue }
  if (d.recording_type !== 'book-page') { reasons.notBookPage++; continue }
  // book-page-stamp-publish.mjs owns any document whose stored two pages already
  // show the run. If such a link is still pending, something downstream held it
  // deliberately, and re-publishing it here would be the ordering bug the
  // pipeline README warns about.
  if (stampRun(d.ocr_text, d.book, d.page)) { reasons.alreadyReadable++; continue }
  // A ruling already written onto this row is never overturned by a re-read. Any
  // note at all — phase-governance, foreign-plat, a reviewer's own words — means
  // something decided this link on evidence a stamp cannot answer.
  if (String(l.review_note || '').trim()) { reasons.alreadyRuled++; continue }
  considered.push(l)
}
const docs = new Map()
for (const l of considered) docs.set(l.place_document.id, l.place_document)
console.log(`
links this script may rule on:  ${considered.length}  (${docs.size} documents)
  held elsewhere:
    non-governing kind:                 ${reasons.notGoverning}
    text does not name it:              ${reasons.nameUnconfirmed}
    not a book-page record:             ${reasons.notBookPage}
    stored OCR already shows the run:   ${reasons.alreadyReadable}  (book-page-stamp-publish's job)
    a ruling is already on the row:     ${reasons.alreadyRuled}`)
if (!considered.length) process.exit(0)

// --- read the whole document -----------------------------------------------
fs.mkdirSync(CACHE, { recursive: true })
fs.mkdirSync(PDF_CACHE, { recursive: true })
const textPath = (id) => path.join(CACHE, `${id}.${DEPTH}.txt`)

/** Our own bucket, never the title company's host — these are files we already have. */
async function ensurePdf(d) {
  const dest = path.join(PDF_CACHE, `${d.id}.pdf`)
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) return dest
  const res = await fetch(`${url}/storage/v1/object/public/place-documents/${d.storage_path}`)
  if (!res.ok) return null
  const buf = Buffer.from(await res.arrayBuffer())
  // Magic bytes, for the same reason download.mjs checks them.
  if (buf.subarray(0, 5).toString() !== '%PDF-') return null
  fs.writeFileSync(dest, buf)
  return dest
}

function ocr(file) {
  return new Promise((resolve) => {
    execFile(OCR_BIN, [file, String(DEPTH)], { maxBuffer: 64 * 1024 * 1024, timeout: 600_000 }, (err, stdout) =>
      resolve(err ? '' : stdout),
    )
  })
}

const deep = new Map()
{
  const queue = [...docs.values()]
  const total = queue.length
  let done = 0, cached = 0, fetchFailed = 0, unreadable = 0
  async function worker() {
    while (queue.length) {
      const d = queue.shift()
      done++
      const out = textPath(d.id)
      if (fs.existsSync(out)) { deep.set(d.id, fs.readFileSync(out, 'utf8')); cached++; continue }
      const pdf = await ensurePdf(d)
      if (!pdf) { fetchFailed++; continue }
      const text = (await ocr(pdf)).replace(/\s+/g, ' ').trim()
      // The PDF is a cache, not a record — the record is the hosted object. Drop
      // it once read; the corpus is 2.5 GB and this runs on a laptop.
      try { fs.unlinkSync(pdf) } catch { /* leave it */ }
      if (!text) { unreadable++; continue }
      fs.writeFileSync(out, text)
      deep.set(d.id, text)
      if (done % 25 === 0) console.error(`  read ${done}/${total}`)
    }
  }
  console.log(`\nreading ${total} documents to ${DEPTH} pages …`)
  await Promise.all(Array.from({ length: WORKERS }, worker))
  console.log(`  read ${deep.size}   from cache ${cached}   could not fetch ${fetchFailed}   OCR empty ${unreadable}`)
}

// --- decide ----------------------------------------------------------------
const publish = []
const held = []
let noRun = 0
const evidence = new Map()
for (const l of considered) {
  const d = l.place_document
  const text = deep.get(d.id)
  if (!text) { noRun++; continue }
  const run = stampRun(text, d.book, d.page)
  if (!run) { noRun++; continue }
  // The phase guard, on the SAME input the shipped script gives it: the stored
  // front matter. Feeding it the deeper read would be changing the guard, and
  // the guard is not what this script is about.
  const doc = phases(String(d.ocr_text || '').replace(/\s+/g, ' ').slice(0, TITLE_CHARS))
  const plat = phases(l.geo_label || platLabel.get(l.geo_slug) || l.geo_slug.replace(/-/g, ' '))
  const namesAPhase = doc.nums.size > 0 || doc.opaque
  const agrees = [...doc.nums].some((p) => plat.nums.has(p))
  if (namesAPhase && plat.nums.size && !agrees) {
    held.push({ l, d, doc: doc.opaque ? [...doc.nums, '?'] : [...doc.nums], plat: [...plat.nums] })
    continue
  }
  evidence.set(d.id, run)
  publish.push(l)
}

const plats = new Set(publish.map((l) => l.geo_slug))
const documents = new Set(publish.map((l) => l.place_document.id))
console.log(`\nthe recorder's stamp runs across consecutive pages, deeper in: ${publish.length} links, ${documents.size} documents, ${plats.size} plats`)
console.log(`  no run even at ${DEPTH} pages:                    ${noRun}`)
console.log(`  document names another phase than the plat:  ${held.length}`)
if (held.length) {
  console.log(`\n  a sample of what the phase guard held back:`)
  for (const h of held.slice(0, 8)) {
    console.log(`    ${h.d.recording_ref} "${h.d.published_name}" says phase ${h.doc} -> ${h.l.geo_slug} is phase ${h.plat}`)
  }
}

const byDoc = new Map()
for (const l of publish) {
  const d = l.place_document
  if (!byDoc.has(d.id)) byDoc.set(d.id, { d, plats: [] })
  byDoc.get(d.id).plats.push(l.geo_slug)
}
const showEvidence = (n) => {
  const all = [...byDoc.values()]
  const step = Math.max(1, Math.floor(all.length / n))
  let shown = 0
  console.log(`\n=== evidence, ${Math.min(n, all.length)} of ${all.length} documents ===`)
  for (let i = 0; i < all.length && shown < n; i += step) {
    const { d, plats: ps } = all[i]
    const run = evidence.get(d.id)
    shown += 1
    console.log(`\n[${shown}] index ref ${d.recording_ref} (book ${d.book}, page ${d.page}) — "${d.published_name}" [${d.doc_kind}]`)
    console.log(`    OCR page ${run.page}   expect ${d.book}-${d.page + run.page}   …${run.firstText}…`)
    console.log(`    OCR page ${run.page + 1} expect ${d.book}-${d.page + run.page + 1} …${run.nextText}…`)
    console.log(`    publishes onto: ${ps.join(', ')}`)
  }
}
if (EVIDENCE) showEvidence(EVIDENCE)

if (!APPLY) {
  if (!EVIDENCE) showEvidence(Math.min(10, byDoc.size))
  console.log('\n(dry run — pass --apply)')
  process.exit(0)
}

// --- apply -----------------------------------------------------------------
// One note per document, carrying the two lines that decided it, so the row can
// be audited without re-running anything.
let n = 0
const byNote = new Map()
for (const l of publish) {
  const d = l.place_document
  const run = evidence.get(d.id)
  const note =
    `auto-published: the document text names this place, and the recorder's book-page stamp runs across ` +
    `consecutive pages of the document itself — OCR page ${run.page} carries ${d.book}-${d.page + run.page} ` +
    `("${run.firstText}"), page ${run.page + 1} carries ${d.book}-${d.page + run.page + 1} ("${run.nextText}")`
  const short = note.replace(/\s+/g, ' ').slice(0, 600)
  if (!byNote.has(short)) byNote.set(short, [])
  byNote.get(short).push(l.id)
}
for (const [note, ids] of byNote) {
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200)
    const { error } = await sb.from('place_document_link').update({ status: 'published', review_note: note }).in('id', chunk)
    if (error) console.error(`  chunk FAIL: ${error.message}`)
    else n += chunk.length
  }
}
console.log(`\npublished ${n}`)
