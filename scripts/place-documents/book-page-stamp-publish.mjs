#!/usr/bin/env node
/**
 * The third signal: the book-and-page stamp the RECORDER printed on the
 * document's own pages.
 *
 * two-signal-publish.mjs clears a parent match when the document's text names
 * the place AND the county's recording stamp carries the instrument number the
 * index filed it under. That second signal is identity — this IS that
 * instrument — and it only exists for `recording_type = 'year-instrument'`.
 * The book-page era has no instrument number, so 1,358 governing, name-confirmed
 * parent links sat in review with no second signal available to them. They are
 * most of what the queue is.
 *
 * The book-page era has its own identity mark, and it is stronger than the
 * instrument number: the recorder stamped the volume and page on EVERY page of
 * the instrument, and the page number increments. So:
 *
 *   OCR page k carries "<book> <page + k>", and OCR page k+1 carries
 *   "<book> <page + k + 1>".
 *
 * Read off a real one — 276-28, Chuckanut Estates:
 *
 *   page 0  "VOL 276 PACE 28 CHUCKANUT ESTATES PHASE IT BUILDING AND USE …"
 *   page 1  "VOL 276 PACE: 29 Page 2, CHUCKANUT ESTATES PHASE I! The use …"
 *
 * WHY THE INCREMENT IS THE WHOLE POINT. A recorded declaration is full of book
 * and page references to OTHER instruments — "recorded in Volume 235, Page 835,
 * Deed Records" — and a single reference proves nothing about which document
 * you are holding. Only the recorder's own header sequence walks forward one
 * page at a time across consecutive pages. Nothing a document SAYS can imitate
 * it; it is a property of how the page was stamped, not of what it recites.
 *
 * MEASURED, 2026-08-26, against the 1,159 book-page documents with OCR:
 *
 *   Recall on the target set (pending parent, governing kind, name_confirmed,
 *   book-page): 251 of 406 documents, 812 links. The phase guard below holds
 *   164 of those, so 648 links across 305 plats and 245 documents publish,
 *   taking the review queue from 227 groups to 195.
 *
 *   Adversarial A — every document against every OTHER recording reference in
 *   the corpus, 1,289,967 pairs: 7 fires. All seven are a stamp the document
 *   physically carries: four re-recordings that bear both the old and the new
 *   stamp sequence (353-0570 also carries 352-1521/1522; 448-360 also carries
 *   444-2995/2996), two adjacent-page instruments in the same book, and one
 *   index reference written two ways. ZERO cases of the matcher inventing a
 *   stamp that is not on the page.
 *
 *   Adversarial B — every document against 3,000 synthetic references drawn
 *   from the real book and page distributions, 3,476,975 pairs: 0 fires.
 *
 *   25 clearances were read against their own ocr_text by hand. In all 25 the
 *   matched text is unmistakably the recorder's header on both pages.
 *
 * WHAT WAS TRIED AND REJECTED.
 *
 *   A single stamp on the first page, without the increment. 80% recall, but it
 *   fires on recitals: 224-1594 (Indian Ford Meadows) recites "Volume 235,
 *   Page 835-840" on its first page and "Vol. 235, Page 836" on its second,
 *   which is the one case that also survives a naive increment check. The
 *   recital guard below kills it; the increment plus the guard kills it twice.
 *
 *   A fuzzy book number, to recover OCR manglings like "BOOK 3222 PAGE 190" for
 *   322-190. It recovers 26 documents and produces 38 CROSS-SUBDIVISION false
 *   fires — 233-710 "Meadow Village" answering to 293-710 "West Ridge", and 37
 *   more of exactly that shape. That is the failure this system exists to
 *   prevent, so the book number is matched exactly and the manglings are left
 *   for a human.
 *
 *   The declarant or subdivision named in the title line, and agreement between
 *   several documents in one chain. Both are the name check again — the same
 *   evidence, read twice. Neither is independent of `name_confirmed`, which is
 *   already true for every link this script considers, so neither adds anything.
 *
 * THE PHASE GUARD. The stamp proves identity, not governance. A document whose
 * own front matter says "ROCKWOOD ESTATES PHASE IV" is genuinely the instrument
 * the index filed, and the parent match would still fan it across all four
 * Rockwood phases. So when the document names a phase, an addition or a unit
 * and the plat names a different one, the link is HELD for the human rather than
 * published: 164 of the 812. This is stricter than the year-instrument rule,
 * which does not check it — 99 links already published by that rule sit on a
 * plat whose phase their own document contradicts. Those are not touched here;
 * they are reported to Matt as a separate finding.
 *
 * The database trigger is still the authority. This script only moves links the
 * trigger would already accept — governing kind, name_confirmed — and refuses
 * to move most of them.
 *
 * usage: node --env-file=.env.local scripts/place-documents/book-page-stamp-publish.mjs [--apply]
 */
import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')
/** --evidence[=N] prints the OCR either side of both stamps, to read against the PDF. */
const EVIDENCE = (() => {
  const a = process.argv.find((x) => x === '--evidence' || x.startsWith('--evidence='))
  if (!a) return 0
  const n = Number(a.split('=')[1])
  return Number.isFinite(n) && n > 0 ? n : 25
})()
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})
const GOVERNING = new Set(['ccr', 'amendment', 'bylaws', 'articles', 'design_guidelines', 'rules'])

/** ocr.mjs writes one block per page, separated by this marker. */
const pages = (text) => String(text || '').split(/<<<PAGE \d+>>>/)

/**
 * A candidate stamp: a number, up to eight non-digit characters, a number.
 * Wide enough for every stamp shape the microfilm produced — "VOL 276 PACE 28",
 * "425 - 2656", "346 • 2446", "40PAGE 29", "70P/c: 252" — and narrow enough
 * that no digit may hide inside the separator.
 */
const CANDIDATE = /(?<![0-9])(\d{1,5})([^0-9]{1,8})(\d{1,6})(?![0-9])/g

/**
 * A recital, not a stamp: "… and recorded in Volume 235, Page 835". Tested
 * against the 45 characters in front of the match. "VOL" and "BOOK" are NOT
 * cues — they are part of the stamp itself. The verb is the cue.
 */
const RECITAL = /\b(RECORD\w*|FILED|RECEPTION|DATED|AMEND\w*|SUPERSED\w*|REFERENCE)\b[^0-9]{0,40}$/i

function candidates(block) {
  const out = []
  let m
  CANDIDATE.lastIndex = 0
  while ((m = CANDIDATE.exec(block))) {
    out.push({ book: m[1], page: m[3], at: m.index, before: block.slice(Math.max(0, m.index - 45), m.index) })
    // Let the second number of one candidate start the next one: "9 - 425 - 213".
    CANDIDATE.lastIndex = m.index + m[1].length + m[2].length
  }
  return out
}

/**
 * The recorder's header sequence: the index's book and page on one OCR'd page,
 * and the same book with the next page on the page after it.
 *
 * A one-digit book is refused. Book 9 page 425 matched "9 … 213" in an Awbrey
 * Court declaration during testing, which is a two-digit coincidence, not a
 * stamp. Every book in this corpus that carries a governing document is ≥ 10.
 */
function stampRun(ocrText, book, page) {
  if (!Number.isFinite(book) || !Number.isFinite(page)) return null
  if (String(book).length < 2) return null
  const blocks = pages(ocrText)
  if (blocks.length < 2) return null
  const found = blocks.map(candidates)
  const isStamp = (c, want) =>
    c.book === String(book) && c.page.length <= 6 && Number(c.page) === want && !RECITAL.test(c.before)
  for (let k = 0; k + 1 < blocks.length; k++) {
    const first = found[k].find((c) => isStamp(c, page + k))
    if (!first) continue
    const next = found[k + 1].find((c) => isStamp(c, page + k + 1))
    if (!next) continue
    const around = (block, c) =>
      block.slice(Math.max(0, c.at - 55), c.at + 60).replace(/\s+/g, ' ').trim()
    return { page: k, firstText: around(blocks[k], first), nextText: around(blocks[k + 1], next) }
  }
  return null
}

// --- phase agreement -------------------------------------------------------
const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12 }
const ORDINAL = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6,
  seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12,
}
/**
 * A phase designator resolves to a number, or it is OPAQUE — a garbled roman
 * numeral, a bare letter past F. Opaque is not "no phase": the document names
 * one and we cannot read it, so agreement cannot be shown and the link is held.
 * That is why a letter never resolves to a number here — a letter may only
 * cause a hold, never a match. Anything that is not a designator at all
 * ("PHASE OF THE") is ignored.
 */
const OPAQUE = Symbol('opaque')
function ordinalValue(token) {
  const t = token.toLowerCase()
  if (/^\d+$/.test(t)) return Number(t)
  if (ROMAN[t] != null) return ROMAN[t]
  if (ORDINAL[t] != null) return ORDINAL[t]
  // "PHASE Y" is Vision's reading of "PHASE V"; "ADDITION A" is a real label we
  // cannot line up against "first addition" without guessing.
  if (/^[a-z]$/.test(t)) return OPAQUE
  if (/^[ivxl]{1,6}$/.test(t)) return OPAQUE
  return null
}
const QUALIFIER = /\b(?:PHASE|PH|UNIT|ADDITION|SECTION|AREA)\.?\s+([A-Za-z0-9]{1,8})\b/gi
const WORD_FIRST = /\b(FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH|ELEVENTH|TWELFTH)\s+(?:ADDITION|PHASE|UNIT|SECTION|AREA)\b/gi
/** { nums: every phase number named, opaque: a designator we could not read }. */
function phases(text) {
  const nums = new Set()
  let opaque = false
  const s = String(text || '')
  let m
  QUALIFIER.lastIndex = 0
  while ((m = QUALIFIER.exec(s))) {
    const n = ordinalValue(m[1])
    if (n === OPAQUE) opaque = true
    else if (n != null && n >= 1 && n <= 30) nums.add(n)
  }
  for (const w of s.matchAll(WORD_FIRST)) {
    const n = ordinalValue(w[1])
    if (typeof n === 'number') nums.add(n)
  }
  return { nums, opaque }
}
/** The title region — where a declaration names the phase it declares. */
const TITLE_CHARS = 300

// --- read ------------------------------------------------------------------
const links = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb
    .from('place_document_link')
    .select(
      'id, geo_slug, geo_label, match_method, place_document!inner(id, published_name, doc_kind, name_confirmed, recording_ref, recording_type, book, page, ocr_text)',
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

// boundaries supply the plat's own label, which is what names its phase.
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

// --- decide ----------------------------------------------------------------
const publish = []
const held = []
const reasons = { notGoverning: 0, nameUnconfirmed: 0, notBookPage: 0, noStampRun: 0, phaseDisagrees: 0 }
const evidence = new Map()
for (const l of links) {
  const d = l.place_document
  if (!GOVERNING.has(d.doc_kind)) { reasons.notGoverning++; continue }
  if (d.name_confirmed !== true) { reasons.nameUnconfirmed++; continue }
  if (d.recording_type !== 'book-page') { reasons.notBookPage++; continue }
  const run = stampRun(d.ocr_text, d.book, d.page)
  if (!run) { reasons.noStampRun++; continue }
  const doc = phases(String(d.ocr_text || '').replace(/\s+/g, ' ').slice(0, TITLE_CHARS))
  const plat = phases(l.geo_label || platLabel.get(l.geo_slug) || l.geo_slug.replace(/-/g, ' '))
  const namesAPhase = doc.nums.size > 0 || doc.opaque
  const agrees = [...doc.nums].some((p) => plat.nums.has(p))
  if (namesAPhase && plat.nums.size && !agrees) {
    reasons.phaseDisagrees++
    held.push({ l, d, doc: doc.opaque ? [...doc.nums, '?'] : [...doc.nums], plat: [...plat.nums] })
    continue
  }
  evidence.set(d.id, run)
  publish.push(l)
}

const plats = new Set(publish.map((l) => l.geo_slug))
const documents = new Set(publish.map((l) => l.place_document.id))
console.log(`\nthe recorder's stamp runs across consecutive pages: ${publish.length} links, ${documents.size} documents, ${plats.size} plats`)
console.log(`held for human review:`)
console.log(`  non-governing kind:      ${reasons.notGoverning}`)
console.log(`  text does not name it:   ${reasons.nameUnconfirmed}`)
console.log(`  not a book-page record:  ${reasons.notBookPage}  (year-instrument is two-signal-publish's job)`)
console.log(`  no stamp run found:      ${reasons.noStampRun}`)
console.log(`  document names another phase than the plat: ${reasons.phaseDisagrees}`)

if (held.length) {
  console.log(`\n  a sample of what the phase guard held back:`)
  for (const h of held.slice(0, 8)) {
    console.log(`    ${h.d.recording_ref} "${h.d.published_name}" says phase ${h.doc} -> ${h.l.geo_slug} is phase ${h.plat}`)
  }
}

if (EVIDENCE) {
  const byDoc = new Map()
  for (const l of publish) {
    const d = l.place_document
    if (!byDoc.has(d.id)) byDoc.set(d.id, { d, plats: [] })
    byDoc.get(d.id).plats.push(l.geo_slug)
  }
  // Deterministic spread across the whole set rather than the first N alphabetically.
  const all = [...byDoc.values()]
  const step = Math.max(1, Math.floor(all.length / EVIDENCE))
  let shown = 0
  console.log(`\n=== evidence, ${Math.min(EVIDENCE, all.length)} of ${all.length} documents ===`)
  for (let i = 0; i < all.length && shown < EVIDENCE; i += step) {
    const { d, plats } = all[i]
    const run = evidence.get(d.id)
    shown += 1
    console.log(`\n[${shown}] index ref ${d.recording_ref} (book ${d.book}, page ${d.page}) — "${d.published_name}" [${d.doc_kind}]`)
    console.log(`    OCR page ${run.page}   expect ${d.book}-${d.page + run.page}   …${run.firstText}…`)
    console.log(`    OCR page ${run.page + 1} expect ${d.book}-${d.page + run.page + 1} …${run.nextText}…`)
    console.log(`    publishes onto: ${plats.join(', ')}`)
  }
}

if (!APPLY) {
  if (!EVIDENCE) {
    console.log(`\n  a sample of the evidence, so it can be read against the PDF:`)
    const seen = new Set()
    for (const l of publish) {
      const d = l.place_document
      if (seen.has(d.id) || seen.size >= 10) continue
      seen.add(d.id)
      const run = evidence.get(d.id)
      console.log(`    ${d.recording_ref} "${d.published_name}" [${d.doc_kind}] — OCR page ${run.page} carries ${d.book}-${d.page + run.page}, page ${run.page + 1} carries ${d.book}-${d.page + run.page + 1}`)
    }
    console.log('  (--evidence[=N] prints the OCR either side of both stamps)')
  }
  console.log('\n(dry run — pass --apply)')
  process.exit(0)
}

let n = 0
const note =
  "auto-published: the document text names this place and the recorder's book-page stamp runs across consecutive pages of the document itself"
for (let i = 0; i < publish.length; i += 200) {
  const chunk = publish.slice(i, i + 200)
  const { error } = await sb
    .from('place_document_link')
    .update({ status: 'published', review_note: note })
    .in('id', chunk.map((c) => c.id))
  if (error) console.error(`  chunk @${i} FAIL: ${error.message}`)
  else n += chunk.length
}
console.log(`\npublished ${n}`)
