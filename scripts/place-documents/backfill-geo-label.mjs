#!/usr/bin/env node
/**
 * Stamp `place_document_link.geo_label` from `boundaries.geo_label`.
 *
 * WHY. `listings.boundary_subdivision` holds the plat's label verbatim —
 * refresh_listing_boundary_tags copies `boundaries.geo_label` and discards the
 * slug. The listing page therefore used to re-derive the slug with lib/slug.ts
 * `slugify()`, which is not the function that minted `boundaries.geo_slug` and
 * disagrees with it on 202 of 3,218 plats. Carrying the label on the link row
 * removes the derivation: the listing's string is compared to the link's string.
 *
 * Idempotent and re-runnable — it writes the label a plat currently has, so a
 * later plat rename is picked up by running it again.
 *
 * The publish gate trigger fires on UPDATE as well as INSERT, so a row that
 * would no longer be publishable refuses the write. That is the trigger doing
 * its job, not this script failing: a rejected chunk is retried row by row and
 * the offenders are printed, because a link that cannot pass its own gate is a
 * finding.
 *
 *   node --env-file=.env.local scripts/place-documents/backfill-geo-label.mjs [--dry-run]
 */
import { createClient } from '@supabase/supabase-js'

const DRY = process.argv.includes('--dry-run')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Every plat, slug -> label.
const label = new Map()
for (let from = 0; ; from += 1000) {
  let data, error
  for (let a = 1; a <= 5; a++) {
    ;({ data, error } = await sb
      .from('boundaries')
      .select('id,geo_slug,geo_label')
      .eq('geo_type', 'subdivision')
      .order('id', { ascending: true })
      .range(from, from + 999))
    if (!error) break
    await sleep(a * 1500)
  }
  if (error) throw new Error(`boundaries: ${error.message}`)
  for (const b of data) if (b.geo_label) label.set(b.geo_slug, b.geo_label)
  if (data.length < 1000) break
}
console.error(`plats with a label: ${label.size}`)

// Every subdivision link, whatever its status — a pending row that publishes
// later should already carry its label.
const links = []
for (let last = '00000000-0000-0000-0000-000000000000'; ; ) {
  const { data, error } = await sb
    .from('place_document_link')
    .select('id,geo_slug,geo_label,status')
    .eq('geo_type', 'subdivision')
    .gt('id', last)
    .order('id', { ascending: true })
    .limit(1000)
  if (error) throw new Error(`place_document_link: ${error.message}`)
  if (!data.length) break
  links.push(...data)
  last = data[data.length - 1].id
  if (data.length < 1000) break
}
console.error(`subdivision links: ${links.length}`)

const todo = []
const orphan = []
for (const l of links) {
  const want = label.get(l.geo_slug)
  if (!want) {
    orphan.push(l)
    continue
  }
  if (l.geo_label !== want) todo.push({ id: l.id, geo_label: want, slug: l.geo_slug, status: l.status })
}
console.error(`to stamp: ${todo.length}   already correct: ${links.length - todo.length - orphan.length}`)
console.error(`links whose plat has no boundaries row (left NULL, slug path still answers): ${orphan.length}`)
for (const o of orphan.slice(0, 10)) console.error(`   ${o.geo_slug} (${o.status})`)

if (DRY) {
  const published = todo.filter((t) => t.status === 'published').length
  console.error(`\nDRY RUN — nothing written. ${published} of the ${todo.length} are published links.`)
  for (const t of todo.slice(0, 15)) console.error(`   ${t.slug} -> ${JSON.stringify(t.geo_label)}`)
  process.exit(0)
}

let ok = 0
const refused = []
for (let i = 0; i < todo.length; i += 200) {
  const chunk = todo.slice(i, i + 200)
  // One statement per distinct label — the whole chunk usually shares none, so
  // this is grouped by value rather than issued per row.
  const byLabel = new Map()
  for (const t of chunk) {
    if (!byLabel.has(t.geo_label)) byLabel.set(t.geo_label, [])
    byLabel.get(t.geo_label).push(t.id)
  }
  for (const [value, ids] of byLabel) {
    const { error } = await sb.from('place_document_link').update({ geo_label: value }).in('id', ids)
    if (!error) {
      ok += ids.length
      continue
    }
    // Retry one at a time so a single refused row does not hide the rest.
    for (const id of ids) {
      const { error: e2 } = await sb.from('place_document_link').update({ geo_label: value }).eq('id', id)
      if (e2) refused.push({ id, value, why: e2.message })
      else ok += 1
    }
  }
}
console.error(`\nstamped ${ok}   refused ${refused.length}`)
for (const r of refused.slice(0, 20)) console.error(`   ${r.id} ${JSON.stringify(r.value)}: ${r.why}`)

// Re-read and assert: every published link now carries the label of its plat.
const check = []
for (let last = '00000000-0000-0000-0000-000000000000'; ; ) {
  const { data, error } = await sb
    .from('place_document_link')
    .select('id,geo_slug,geo_label')
    .eq('geo_type', 'subdivision')
    .eq('status', 'published')
    .gt('id', last)
    .order('id', { ascending: true })
    .limit(1000)
  if (error) throw new Error(error.message)
  if (!data.length) break
  check.push(...data)
  last = data[data.length - 1].id
  if (data.length < 1000) break
}
const wrong = check.filter((l) => label.has(l.geo_slug) && l.geo_label !== label.get(l.geo_slug))
const missing = check.filter((l) => !l.geo_label)
console.error('')
console.error('=== POST-BACKFILL STATE ===')
console.error(`published subdivision links: ${check.length}`)
console.error(`distinct labels:             ${new Set(check.map((l) => l.geo_label)).size}`)
console.error(`still NULL:                  ${missing.length}`)
console.error(`MISMATCHED:                  ${wrong.length}`)
for (const w of wrong.slice(0, 10)) console.error(`   ${w.geo_slug}: ${JSON.stringify(w.geo_label)}`)
process.exit(wrong.length ? 1 : 0)
