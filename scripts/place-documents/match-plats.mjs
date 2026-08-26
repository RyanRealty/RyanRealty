#!/usr/bin/env node
/**
 * Step 2 — match our recorded plats to the index's published names.
 *
 * Two match methods, and the difference is the whole compliance story:
 *
 *   exact  — the plat's label equals a published name. Safe to publish once the
 *            document also confirms itself (see classify.mjs).
 *   parent — a phase-level plat (`tetherow-phase-5`) resolved to its
 *            declaration-level entry (`Tetherow`). A strong inference, not a
 *            fact, so it waits for review or for two independent confirmations.
 *
 * An ambiguous parent — one resolving to more than one published name — is
 * REJECTED. A guess is not a match.
 *
 * Only ordinal/sequence noise is stripped when deriving a parent. Words that
 * NAME a place (village, park, condominium) must survive: stripping them once
 * collapsed `awbrey-village-*` onto "Awbrey Park" and `sunrise-condominiums`
 * onto "Sunrise Village".
 *
 * Writes tmp/place-documents/ccr-plan.json.
 */
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const DIR = 'tmp/place-documents'
const CCRS = JSON.parse(fs.readFileSync(`${DIR}/ccrs-index.json`, 'utf8'))
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const SEQ = /\b(phase|ph|unit|units|no|number|section|sec|addition|add|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth)\b/g
const ROMAN = /\b(i{1,3}|iv|v|vi{1,3}|ix|x{1,3}|xi{1,3}|xiv|xv)\b/g
const LEAD_THE = /^the\s+|\s+the$/g

const norm = (s) =>
  String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()

// Trailing bare letter is a phase label once "phase" itself is gone
// ("Caldera Springs Phase A" -> "caldera springs").
const parent = (s) =>
  norm(s).replace(LEAD_THE, ' ').replace(SEQ, ' ').replace(ROMAN, ' ')
    .replace(/\b\d+\b/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/\s+[a-z]$/, '').trim()

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const boundaries = []
for (let from = 0; ; from += 1000) {
  let data, error
  for (let a = 1; a <= 5; a++) {
    ;({ data, error } = await sb.from('boundaries')
      .select('id,geo_slug,geo_label').eq('geo_type', 'subdivision')
      .order('id', { ascending: true }).range(from, from + 999))
    if (!error) break
    await sleep(a * 1500)
  }
  if (error) throw new Error(`boundaries: ${error.message}`)
  boundaries.push(...data)
  if (data.length < 1000) break
}

const byName = new Map()
for (const r of CCRS) {
  const n = norm(r.name)
  if (!byName.has(n)) byName.set(n, { name: r.name, norm: n, parent: parent(r.name), docs: [] })
  byName.get(n).docs.push(r)
}
const byParent = new Map()
for (const b of byName.values()) {
  if (!b.parent) continue
  if (!byParent.has(b.parent)) byParent.set(b.parent, [])
  byParent.get(b.parent).push(b)
}

const links = []
const unmatched = []
const tally = { exact: 0, parent: 0, ambiguous: 0 }
for (const b of boundaries) {
  const label = b.geo_label || b.geo_slug.replace(/-/g, ' ')
  const exact = byName.get(norm(label))
  if (exact) {
    links.push({ slug: b.geo_slug, label, ccr_name: exact.name, method: 'exact', doc_count: exact.docs.length })
    tally.exact++
    continue
  }
  const p = parent(label)
  const cands = byParent.get(p) || []
  // When the source publishes an unqualified declaration alongside
  // phase-specific ones, the unqualified entry IS the parent chain.
  const unqualified = cands.filter((c) => c.norm === p)
  const pick = cands.length === 1 ? cands[0] : unqualified.length === 1 ? unqualified[0] : null
  if (pick) {
    links.push({ slug: b.geo_slug, label, ccr_name: pick.name, method: 'parent', doc_count: pick.docs.length })
    tally.parent++
  } else if (cands.length > 1) {
    tally.ambiguous++
  } else {
    unmatched.push({ slug: b.geo_slug, label })
  }
}

const needed = new Set(links.map((l) => norm(l.ccr_name)))
const downloadDocs = []
for (const n of needed) for (const d of byName.get(n).docs) downloadDocs.push(d)

fs.writeFileSync(`${DIR}/ccr-plan.json`, JSON.stringify({ links, unmatched, downloadDocs }, null, 2))
console.log(`plats: ${boundaries.length}   index names: ${byName.size}`)
console.log(`  exact: ${tally.exact}   parent: ${tally.parent}   ambiguous (rejected): ${tally.ambiguous}   no match: ${unmatched.length}`)
console.log(`documents to download: ${downloadDocs.length}`)
console.log(`wrote ${DIR}/ccr-plan.json`)
