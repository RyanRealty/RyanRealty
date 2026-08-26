#!/usr/bin/env node
/**
 * ci:place-documents — assert that nothing publishable-by-accident is published.
 *
 * The database trigger enforces the rule on every write. This is the standing
 * check that the DATA still satisfies it, which the trigger alone cannot promise:
 * a document reclassified after its link was published (a deed discovered to be a
 * deed, an association discovered to be foreign) leaves a published link behind,
 * because the trigger fires on the link, not on the document.
 *
 * DB-dependent, so it runs locally / nightly, not in the secret-less static
 * chain — same posture as ci:data-access.
 *
 * Exit 1 on any violation.
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('ci:place-documents SKIPPED — no Supabase credentials in env')
  process.exit(0)
}
const sb = createClient(url, key, { auth: { persistSession: false } })

const GOVERNING = new Set(['ccr', 'amendment', 'bylaws', 'articles', 'design_guidelines', 'rules'])

const rows = []
for (let last = '00000000-0000-0000-0000-000000000000'; ; ) {
  const { data, error } = await sb
    .from('place_document_link')
    .select('id, geo_type, geo_slug, reviewed_by, place_document!inner(doc_kind, name_confirmed, published_name, recording_ref)')
    .eq('status', 'published')
    .gt('id', last)
    .order('id', { ascending: true })
    .limit(1000)
  if (error) {
    console.error(`ci:place-documents FAILED to read: ${error.message}`)
    process.exit(1)
  }
  if (!data.length) break
  rows.push(...data)
  last = data[data.length - 1].id
  if (data.length < 1000) break
}

const badKind = []
const badName = []
for (const r of rows) {
  const d = r.place_document
  if (!GOVERNING.has(d.doc_kind)) badKind.push({ r, d })
  else if (d.name_confirmed !== true && !r.reviewed_by) badName.push({ r, d })
}

const plats = new Set(rows.map((r) => r.geo_slug)).size
console.log(`ci:place-documents — ${rows.length} published links across ${plats} places`)

if (!badKind.length && !badName.length) {
  console.log('  ✓ every published document is a governing instrument that names its own place')
  process.exit(0)
}

if (badKind.length) {
  console.error(`\n  ✗ ${badKind.length} published links carry a NON-GOVERNING instrument:`)
  for (const { r, d } of badKind.slice(0, 20)) {
    console.error(`      ${r.geo_slug} <- ${d.recording_ref} [${d.doc_kind}] "${d.published_name}"`)
  }
}
if (badName.length) {
  console.error(`\n  ✗ ${badName.length} published links were never confirmed and never reviewed:`)
  for (const { r, d } of badName.slice(0, 20)) {
    console.error(`      ${r.geo_slug} <- ${d.recording_ref} "${d.published_name}"`)
  }
}
console.error('\n  Fix: node scripts/place-documents/regate.mjs')
process.exit(1)
