#!/usr/bin/env node
/**
 * Auto-publish the pending parent matches that carry TWO independent
 * confirmations. Matt's call, 2026-08-26.
 *
 * A parent match is an inference: our plat is `tetherow-phase-5`, the index
 * files the declaration under `Tetherow`, and we infer the phase is governed by
 * the parent chain. R7 wants a human on that inference. This clears the subset
 * where the document itself supplies the evidence a human would look for:
 *
 *   1. the document's own text names the place it is filed under, AND
 *   2. the county's recording stamp carries the same instrument number the
 *      index filed it under — which makes it definitively that instrument,
 *      not a lookalike.
 *
 * Signal 2 only exists for year-instrument recordings; book-page era documents
 * have no stamped equivalent, so they stay in review. That is deliberate — the
 * conservative side of the line is "a human looks at it".
 *
 * usage: node --env-file=.env.local scripts/place-documents/two-signal-publish.mjs [--apply]
 */
import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})
const GOVERNING = new Set(['ccr', 'amendment', 'bylaws', 'articles', 'design_guidelines', 'rules'])

/** Does the recording stamp in the document carry the index's instrument number? */
function stampMatches(recordingRef, recordingType, text) {
  if (!text || text.length < 30 || !recordingRef) return false
  if (recordingType !== 'year-instrument') return false
  const m = recordingRef.match(/^(\d{4})-0*(\d+)$/)
  if (!m) return false
  const [, year, num] = m
  const flat = text.replace(/\s+/g, ' ')
  if (new RegExp(`\\b${year}\\s*-?\\s*0*${num}\\b`).test(flat)) return true
  // The stamp is often OCR'd as one long digit run: "00727225201000189750410416".
  return new RegExp(`${year}0*${num}`).test(text.replace(/[^0-9]/g, ''))
}

const links = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb
    .from('place_document_link')
    .select('id, geo_slug, match_method, place_document!inner(id, published_name, doc_kind, name_confirmed, recording_ref, recording_type, ocr_text)')
    .eq('status', 'pending_review')
    .eq('match_method', 'parent')
    .order('id', { ascending: true })
    .range(from, from + 999)
  if (error) throw new Error(error.message)
  links.push(...data)
  if (data.length < 1000) break
}
console.log(`pending parent-match links: ${links.length}`)

const publish = []
const reasons = { notGoverning: 0, nameUnconfirmed: 0, noStamp: 0 }
for (const l of links) {
  const d = l.place_document
  if (!GOVERNING.has(d.doc_kind)) { reasons.notGoverning++; continue }
  if (d.name_confirmed !== true) { reasons.nameUnconfirmed++; continue }
  if (!stampMatches(d.recording_ref, d.recording_type, d.ocr_text || '')) { reasons.noStamp++; continue }
  publish.push(l)
}

const plats = new Set(publish.map((l) => l.geo_slug))
console.log(`\nboth signals agree:      ${publish.length} links across ${plats.size} plats`)
console.log(`held for human review:`)
console.log(`  non-governing kind:    ${reasons.notGoverning}`)
console.log(`  text does not name it: ${reasons.nameUnconfirmed}`)
console.log(`  no matching stamp:     ${reasons.noStamp}  (includes every book-page recording)`)

if (!APPLY) { console.log('\n(dry run — pass --apply)'); process.exit(0) }

let n = 0
const note = 'auto-published: the document text names this place and its recording stamp matches the index instrument number'
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
