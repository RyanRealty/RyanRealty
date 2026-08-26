#!/usr/bin/env node
/**
 * Apply the publish policy in BOTH directions.
 *
 * The database trigger enforces the rule on every future write, but 1,314 links
 * were published by the ingest before the title-plant-bucket problem was found.
 * This demotes the ones that would now be refused.
 */
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const GOVERNING = new Set(['ccr', 'amendment', 'bylaws', 'articles', 'design_guidelines', 'rules'])

const links = []
for (let last = '00000000-0000-0000-0000-000000000000'; ; ) {
  const { data, error } = await sb
    .from('place_document_link')
    .select('id, geo_slug, status, match_method, reviewed_by, place_document!inner(doc_kind, name_confirmed, published_name)')
    .gt('id', last).order('id', { ascending: true }).limit(1000)
  if (error) throw new Error(error.message)
  if (!data.length) break
  links.push(...data); last = data[data.length - 1].id
  if (data.length < 1000) break
}
console.error(`${links.length} links`)

const demote = []
const reasons = { kind: 0, name: 0 }
for (const l of links) {
  if (l.status !== 'published') continue
  const d = l.place_document
  const badKind = !GOVERNING.has(d.doc_kind)
  const badName = d.name_confirmed !== true && !l.reviewed_by
  if (badKind || badName) {
    demote.push({ ...l, why: badKind ? `kind=${d.doc_kind}` : 'name-unconfirmed' })
    if (badKind) reasons.kind++; else reasons.name++
  }
}
console.error(`to demote: ${demote.length}  (non-governing kind: ${reasons.kind}, name unconfirmed: ${reasons.name})`)
console.error(`plats affected: ${new Set(demote.map(d => d.geo_slug)).size}`)

let n = 0
for (let i = 0; i < demote.length; i += 100) {
  const chunk = demote.slice(i, i + 100)
  const { error } = await sb.from('place_document_link')
    .update({ status: 'pending_review' })
    .in('id', chunk.map(c => c.id))
  if (error) console.error('  fail', error.message)
  else n += chunk.length
}
console.error(`demoted ${n}`)

// PROMOTE — an exact name match whose document vouches for itself.
//
// ingest.mjs writes every link as pending_review on purpose: the database
// trigger is the authority on what may publish, and at ingest time a document
// has not been OCR'd yet, so nothing is known about it. Once classify.mjs has
// read the front matter, an exact match whose own text names the plat has met
// the same bar the trigger enforces, and holding it back adds no safety — a
// human reviewing it would be reading the same two facts.
//
// Parent matches are NOT promoted here. Those are inferences and go to review,
// or to two-signal-publish.mjs where a second independent confirmation clears
// them.
const promote = links.filter((l) => {
  if (l.status !== 'pending_review') return false
  if (l.match_method !== 'exact') return false
  const d = l.place_document
  return GOVERNING.has(d.doc_kind) && d.name_confirmed === true
})
console.error(`\nto promote (exact match, document names the plat): ${promote.length} links across ${new Set(promote.map((p) => p.geo_slug)).size} plats`)
let up = 0
for (let i = 0; i < promote.length; i += 200) {
  const chunk = promote.slice(i, i + 200)
  const { error } = await sb.from('place_document_link')
    .update({ status: 'published' })
    .in('id', chunk.map((c) => c.id))
  if (error) console.error(`  promote chunk @${i} FAIL: ${error.message}`)
  else up += chunk.length
}
console.error(`promoted ${up}`)

// Re-read and assert the invariant holds.
const check = []
for (let last = '00000000-0000-0000-0000-000000000000'; ; ) {
  const { data, error } = await sb
    .from('place_document_link')
    .select('id, geo_slug, status, reviewed_by, place_document!inner(doc_kind, name_confirmed)')
    .eq('status', 'published')
    .gt('id', last).order('id', { ascending: true }).limit(1000)
  if (error) throw new Error(error.message)
  if (!data.length) break
  check.push(...data); last = data[data.length - 1].id
  if (data.length < 1000) break
}
const violations = check.filter(l => !GOVERNING.has(l.place_document.doc_kind) || (l.place_document.name_confirmed !== true && !l.reviewed_by))
console.error('')
console.error('=== POST-GATE STATE ===')
console.error(`published links:  ${check.length}`)
console.error(`published plats:  ${new Set(check.map(l => l.geo_slug)).size}`)
console.error(`VIOLATIONS:       ${violations.length}`)
if (violations.length) for (const v of violations.slice(0, 10)) console.error('   ', v.geo_slug, v.place_document.doc_kind, v.place_document.name_confirmed)
