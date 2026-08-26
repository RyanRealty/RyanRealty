#!/usr/bin/env node
/**
 * Link documents at community and neighborhood grain.
 *
 * Deliberately NOT by aggregating whatever the member plats happen to hold.
 * Rolling plat documents up to a community is exactly the inference that put
 * Crooked Horseshoe's declarations on the Indian Ford Meadows page — a document
 * that binds one plat does not bind the community, and a community page that
 * lists every document any of its plats carries is a pile, not an answer.
 *
 * Two safe rules instead:
 *
 *   1. An ASSOCIATION-PUBLISHED document belongs at the grain of the place it
 *      was published for. Caldera Springs Owners' Association published the
 *      Caldera Springs declaration; it belongs on the Caldera Springs community
 *      page by construction, not by inference.
 *
 *   2. A RECORDED document whose published_name equals the community or
 *      neighborhood name belongs there. Same exact-name test the subdivision
 *      linking uses, and the same publish gate applies on top.
 *
 * Anything weaker stays off these pages.
 *
 * usage: node --env-file=.env.local scripts/place-documents/link-place-grains.mjs [--apply]
 */
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})
const GOVERNING = new Set(['ccr', 'amendment', 'bylaws', 'articles', 'design_guidelines', 'rules'])

const norm = (s) =>
  String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()

// --- the places we can link to -------------------------------------------
const registry = JSON.parse(fs.readFileSync('data/resort-communities.json', 'utf8'))
const communities = (Array.isArray(registry) ? registry : registry.communities || Object.values(registry))
  .filter((c) => c && c.slug && c.label)
  .map((c) => ({ geoType: 'community', slug: c.slug, label: c.label }))

const neighborhoods = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb
    .from('boundaries').select('geo_slug,geo_label').eq('geo_type', 'neighborhood')
    .order('id', { ascending: true }).range(from, from + 999)
  if (error) throw new Error(`boundaries: ${error.message}`)
  neighborhoods.push(...data.map((b) => ({ geoType: 'neighborhood', slug: b.geo_slug, label: b.geo_label })))
  if (data.length < 1000) break
}

const places = [...communities, ...neighborhoods]
console.log(`places: ${communities.length} communities + ${neighborhoods.length} neighborhoods`)

// --- the documents --------------------------------------------------------
const docs = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb
    .from('place_document')
    .select('id,published_name,doc_kind,recording_type,name_confirmed,publisher')
    .order('id', { ascending: true }).range(from, from + 999)
  if (error) throw new Error(`place_document: ${error.message}`)
  docs.push(...data)
  if (data.length < 1000) break
}
console.log(`documents: ${docs.length}`)

const byName = new Map()
for (const d of docs) {
  if (!GOVERNING.has(d.doc_kind)) continue
  const k = norm(d.published_name)
  if (!k) continue
  if (!byName.has(k)) byName.set(k, [])
  byName.get(k).push(d)
}

// --- match ----------------------------------------------------------------
const rows = []
const summary = []
for (const p of places) {
  const matched = byName.get(norm(p.label)) || []
  if (!matched.length) continue
  const assoc = matched.filter((d) => d.recording_type === 'association-published')
  const recorded = matched.filter((d) => d.recording_type !== 'association-published')
  summary.push({ ...p, assoc: assoc.length, recorded: recorded.length })
  for (const d of matched) {
    // The publish gate still applies: an unconfirmed document needs a reviewer,
    // so it goes to review here exactly as it would at plat grain.
    const publishable = d.name_confirmed === true
    rows.push({
      document_id: d.id,
      geo_type: p.geoType,
      geo_slug: p.slug,
      match_method: d.recording_type === 'association-published' ? 'manual' : 'exact',
      status: publishable ? 'published' : 'pending_review',
      ...(publishable && d.recording_type === 'association-published'
        ? { reviewed_by: 'ryan-realty:association-source', reviewed_at: new Date().toISOString(),
            review_note: `Published by ${d.publisher ?? 'the association'} for this place` }
        : {}),
    })
  }
}

summary.sort((a, b) => b.assoc + b.recorded - (a.assoc + a.recorded))
console.log(`\nplaces that match a document by exact name: ${summary.length}`)
for (const s of summary.slice(0, 20)) {
  console.log(`  ${s.geoType.padEnd(13)} ${s.slug.padEnd(28)} recorded=${String(s.recorded).padStart(3)} association=${s.assoc}`)
}
console.log(`\nlinks to write: ${rows.length}`)

if (!APPLY) { console.log('(dry run — pass --apply)'); process.exit(0) }

let n = 0
for (let i = 0; i < rows.length; i += 200) {
  const chunk = rows.slice(i, i + 200)
  const { error } = await sb.from('place_document_link').upsert(chunk, {
    onConflict: 'document_id,geo_type,geo_slug', ignoreDuplicates: true,
  })
  if (error) console.error(`  chunk @${i} FAIL: ${error.message}`)
  else n += chunk.length
}
console.log(`written ${n}`)
