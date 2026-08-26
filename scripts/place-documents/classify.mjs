#!/usr/bin/env node
/**
 * Re-classify doc_kind from ocr_text already stored on place_document.
 *
 * Reads nothing from disk. The local scratchpad (PDFs, OCR JSONL, manifest) is
 * ephemeral and was cleaned; the durable copies are the hosted PDFs in storage
 * and the ocr_text column, which is why the text was persisted in the first
 * place. This makes reclassification idempotent and re-runnable forever.
 */
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const KIND_PATTERNS = [
  [/AMENDED\s+AND\s+RESTATED\s+(DECLARATION|COVENANTS|PROTECTIVE)/i, 'ccr'],
  [/RESTATED\s+(DECLARATION|COVENANTS)/i, 'ccr'],
  [/(FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH|ELEVENTH|TWELFTH|\d+(ST|ND|RD|TH))\s+AMENDMENT/i, 'amendment'],
  [/AMENDMENT\s+(TO|OF)\s+(THE\s+)?(DECLARATION|COVENANTS|PROTECTIVE|CC)/i, 'amendment'],
  [/SUPPLEMENTAL\s+DECLARATION/i, 'amendment'],
  [/\bANNEXATION\b/i, 'amendment'],
  [/\bAMENDMENT\b/i, 'amendment'],
  [/BY-?LAWS/i, 'bylaws'],
  [/ARTICLES\s+OF\s+INCORPORATION/i, 'articles'],
  [/(DESIGN|ARCHITECTURAL)\s+(REVIEW\s+)?(GUIDELINES|STANDARDS)/i, 'design_guidelines'],
  [/RULES\s+AND\s+REGULATIONS/i, 'rules'],
  [/RESERVE\s+STUDY/i, 'reserve_study'],
  [/DECLARATION\s+OF\s+(COVENANTS|CONDITIONS|RESTRICTIONS|PROTECTIVE)/i, 'ccr'],
  [/(COVENANTS|CONDITIONS),?\s+(CONDITIONS|COVENANTS)\s+AND\s+RESTRICTIONS/i, 'ccr'],
  [/PROTECTIVE\s+COVENANTS/i, 'ccr'],
  [/\bDECLARATION\b/i, 'ccr'],
  [/(BUILDING\s+AND\s+USE\s+)?RESTRICTIONS/i, 'ccr'],
]

// The clerk's own stamped type code. Authoritative — it is the county's
// classification of the instrument, not an inference from the title.
const COUNTY_CODES = [
  [/\bD-?CC&?RS?\b|\bD-?CCR\b/i, 'ccr'],
  [/\bD-?AMD\b/i, 'amendment'],
  [/\bD-?BYLA?W?S?\b/i, 'bylaws'],
  [/\bD-?ART\b/i, 'articles'],
  [/\bD-?(EASE|ESMT)\w*\b/i, 'easement'],
  [/\bD-?(DEED|WD|BSD|QCD)\b/i, 'deed'],
  [/\bD-?(LIEN|LN)\b/i, 'lien'],
  [/\bD-?(TD|TRD)\b/i, 'trust_deed'],
  [/\bD-?(ASGN|ASSIGN)\w*\b/i, 'assignment'],
]

// Instruments that are NOT governing documents. Tested against front matter
// BEFORE any governing pattern, because the source index is a title-plant
// research bucket: it files a warranty deed, an easement and another
// association's declaration alongside the real CC&Rs. A deed reciting "subject
// to restrictions of record" would otherwise read as a declaration.
const NON_GOVERNING = [
  [/\b(WARRANTY|BARGAIN\s+AND\s+SALE|QUITCLAIM|QUIT\s*CLAIM|STATUTORY\s+WARRANTY)\s+DEED\b/i, 'deed'],
  [/\bTRUST\s+DEED\b|\bDEED\s+OF\s+TRUST\b|\bMORTGAGE\b/i, 'trust_deed'],
  [/\b(GRANT\s+OF\s+)?EASEMENT\b|\bRIGHT[\s-]OF[\s-]WAY\b/i, 'easement'],
  [/\bASSIGNMENT\s+OF\b/i, 'assignment'],
  [/\b(CLAIM\s+OF\s+)?LIEN\b|\bSATISFACTION\s+OF\b/i, 'lien'],
  [/\b(REAL\s+ESTATE|SALE|PURCHASE)\s+(CONTRACT|AGRE+MENT)\b|\bWATER\s+SYSTEM\s+SALE\b/i, 'contract'],
]

function classify(text) {
  if (!text || text.length < 30) return 'other'
  for (const [re, k] of COUNTY_CODES) if (re.test(text)) return k
  const head = text.slice(0, 900)
  for (const [re, k] of NON_GOVERNING) if (re.test(head)) return k
  for (const [re, k] of KIND_PATTERNS) if (re.test(head)) return k
  for (const [re, k] of KIND_PATTERNS) if (re.test(text)) return k
  return 'other'
}


/**
 * name_confirmed — does the document itself vouch for the plat it was filed
 * under? Matching a recorded declaration to a subdivision is heuristic (R7),
 * so this is the document's own evidence rather than the index's filing.
 *
 * Two signals, and either alone confirms:
 *
 *   THE STAMP. The county's recording block carries the instrument number. When
 *   it equals the reference the index filed the document under, this IS that
 *   instrument — identity, not inference. Only year-instrument recordings have
 *   one; the book-page era has no stamped equivalent.
 *
 *   THE NAME. Every distinctive word of the plat name appears in the front
 *   matter. Fuzzy to one substitution because OCR of microfilm mangles
 *   characters ("TETHEROW" reads as "TETHERQW").
 *
 * A name made only of common words cannot be tested, and returns null rather
 * than false — unknown is not the same as contradicted.
 */
const NOISE = new Set([
  'the','of','a','an','at','and','to','in','for','on','subdivision','phase','unit',
  'no','number','addition','section','tract','tracts','condominium','condominiums',
  'condo','condos','homesites','homesite','estates','estate','first','second','third',
])

function fuzzyIn(hay, tok) {
  for (let i = 0; i + tok.length <= hay.length; i++) {
    let d = 0
    for (let j = 0; j < tok.length; j++) if (hay[i + j] !== tok[j]) { if (++d > 1) break }
    if (d <= 1) return true
  }
  return false
}

function nameConfirmed(publishedName, text) {
  if (!text || text.length < 30) return null
  const hay = text.toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ')
  const tokens = publishedName.toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').split(/\s+/)
    .filter((t) => t.length >= 4 && !NOISE.has(t.toLowerCase()))
  if (!tokens.length) return null
  return tokens.every((t) => hay.includes(t) || fuzzyIn(hay, t))
}

function stampConfirmed(recordingRef, recordingType, text) {
  if (!text || text.length < 30 || !recordingRef) return null
  if (recordingType !== 'year-instrument') return null
  const m = recordingRef.match(/^(\d{4})-0*(\d+)$/)
  if (!m) return null
  const [, year, num] = m
  const flat = text.replace(/\s+/g, ' ')
  if (new RegExp(`\\b${year}\\s*-?\\s*0*${num}\\b`).test(flat)) return true
  // The stamp often OCRs as one long digit run: "00727225201000189750410416".
  return new RegExp(`${year}0*${num}`).test(text.replace(/[^0-9]/g, ''))
}

const rows = []
for (let last = '00000000-0000-0000-0000-000000000000'; ; ) {
  const { data, error } = await sb
    .from('place_document')
    .select('id, doc_kind, ocr_text, published_name, recording_ref, recording_type, name_confirmed')
    .gt('id', last)
    .order('id', { ascending: true })
    .limit(500)
  if (error) throw new Error(error.message)
  if (!data.length) break
  rows.push(...data)
  last = data[data.length - 1].id
  if (data.length < 500) break
}
console.error(`${rows.length} documents`)

const before = {}
const after = {}
const changes = []
let skippedNoOcr = 0
const confirmTally = { true: 0, false: 0 }
for (const r of rows) {
  before[r.doc_kind] = (before[r.doc_kind] || 0) + 1
  // NO OCR MEANS NO OPINION. An unreadable document is not evidence that the
  // document is 'other' — it is evidence of nothing. Association-published
  // copies carry a real text layer and are classified from their manifest at
  // ingest, so they have no ocr_text and must be left exactly as they are.
  // Defaulting them to 'other' silently unpublished six Caldera Springs
  // governing documents on 2026-08-26; the gate caught it.
  if (!r.ocr_text || r.ocr_text.trim().length < 30) { skippedNoOcr++; continue }
  const k = classify(r.ocr_text)
  after[k] = (after[k] || 0) + 1
  const byName = nameConfirmed(r.published_name, r.ocr_text)
  const byStamp = stampConfirmed(r.recording_ref, r.recording_type, r.ocr_text)
  const confirmed = byStamp === true || byName === true ? true : byStamp === null && byName === null ? null : false
  if (confirmed !== null) confirmTally[String(confirmed)]++
  if (k !== r.doc_kind || confirmed !== r.name_confirmed) {
    changes.push({ id: r.id, from: r.doc_kind, to: k, confirmed, name: r.published_name })
  }
}
console.error('before:', before)
console.error('after :', after)
console.error(`changes: ${changes.length}   skipped (no OCR, left untouched): ${skippedNoOcr}`)

let n = 0
for (const c of changes) {
  const { error } = await sb.from('place_document').update({ doc_kind: c.to, name_confirmed: c.confirmed }).eq('id', c.id)
  if (error) console.error('  update fail', c.id, error.message)
  else n++
  if (n % 200 === 0) console.error(`  ${n}/${changes.length}`)
}
console.error(`updated ${n}`)
console.error('name_confirmed:', confirmTally)
