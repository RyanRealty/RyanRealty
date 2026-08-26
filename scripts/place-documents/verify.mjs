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

/** lib/slug.ts, verbatim — the derivation the listing page used to depend on. */
const slugify = (name) =>
  name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '') ||
  'unknown'

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

/**
 * REACHABILITY. A published document a listing page cannot resolve is the same
 * as no document, and 202 of 3,218 plats are in that position whenever the link
 * row has no `geo_label`: `listings.boundary_subdivision` holds the plat LABEL,
 * and slugify() does not reproduce those plats' `geo_slug` from it (it deletes
 * '&' and every other non-alphanumeric that geo_slug hyphenates, and a
 * duplicated label carries a numeric suffix slugify() cannot know about).
 *
 * So: a published link whose plat does NOT round-trip through slugify() must
 * carry geo_label, or nothing on a listing page will ever reach it.
 */
const unreachable = []
let labelled = 0
let labelColumn = true
{
  const linkLabels = new Map()
  for (let last = '00000000-0000-0000-0000-000000000000'; ; ) {
    const { data, error } = await sb
      .from('place_document_link')
      .select('id, geo_slug, geo_label')
      .eq('status', 'published')
      .eq('geo_type', 'subdivision')
      .gt('id', last)
      .order('id', { ascending: true })
      .limit(1000)
    if (error) {
      // 42703 = the column is not there yet. Say so out loud rather than
      // passing quietly: a gate that is green because it checked nothing is
      // worse than a red one.
      if (error.code === '42703') {
        labelColumn = false
        break
      }
      console.error(`ci:place-documents FAILED to read link labels: ${error.message}`)
      process.exit(1)
    }
    if (!data.length) break
    for (const r of data) linkLabels.set(r.id, r)
    last = data[data.length - 1].id
    if (data.length < 1000) break
  }

  if (labelColumn) {
    const platLabel = new Map()
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb
        .from('boundaries')
        .select('id, geo_slug, geo_label')
        .eq('geo_type', 'subdivision')
        .order('id', { ascending: true })
        .range(from, from + 999)
      if (error) {
        console.error(`ci:place-documents FAILED to read boundaries: ${error.message}`)
        process.exit(1)
      }
      for (const b of data) if (b.geo_label) platLabel.set(b.geo_slug, b.geo_label)
      if (data.length < 1000) break
    }
    for (const l of linkLabels.values()) {
      if (l.geo_label) labelled += 1
      const want = platLabel.get(l.geo_slug)
      if (!want) continue
      if (l.geo_label && l.geo_label !== want) unreachable.push({ ...l, want, why: 'stale label' })
      else if (!l.geo_label && slugify(want) !== l.geo_slug) {
        unreachable.push({ ...l, want, why: 'no label, and slugify() cannot reach this plat' })
      }
    }
    console.log(`  geo_label on published subdivision links: ${labelled} / ${linkLabels.size}`)
  } else {
    console.log('  geo_label: column not applied yet — listing pages still resolve plats by slugify()')
  }
}

if (!badKind.length && !badName.length && !unreachable.length) {
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
if (unreachable.length) {
  console.error(`\n  ✗ ${unreachable.length} published links no listing page can resolve:`)
  for (const u of unreachable.slice(0, 20)) {
    console.error(`      ${u.geo_slug} (${u.want}) — ${u.why}`)
  }
  console.error('\n  Fix: node --env-file=.env.local scripts/place-documents/backfill-geo-label.mjs')
}
if (badKind.length || badName.length) {
  console.error('\n  Fix: node scripts/place-documents/regate.mjs')
}
process.exit(1)
