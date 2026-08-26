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

const rows = []
for (let last = '00000000-0000-0000-0000-000000000000'; ; ) {
  const { data, error } = await sb
    .from('place_document')
    .select('id, doc_kind, ocr_text, published_name')
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
for (const r of rows) {
  before[r.doc_kind] = (before[r.doc_kind] || 0) + 1
  const k = classify(r.ocr_text || '')
  after[k] = (after[k] || 0) + 1
  if (k !== r.doc_kind) changes.push({ id: r.id, from: r.doc_kind, to: k, name: r.published_name })
}
console.error('before:', before)
console.error('after :', after)
console.error(`changes: ${changes.length}`)

let n = 0
for (const c of changes) {
  const { error } = await sb.from('place_document').update({ doc_kind: c.to }).eq('id', c.id)
  if (error) console.error('  update fail', c.id, error.message)
  else n++
  if (n % 200 === 0) console.error(`  ${n}/${changes.length}`)
}
console.error(`updated ${n}`)
