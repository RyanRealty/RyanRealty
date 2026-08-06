#!/usr/bin/env node
/**
 * report-geo-coverage.mjs — plat coverage for every registry community.
 *
 * GATES C-21. Matt asked for subdivision polygons drawn on the community map,
 * zoomed to contain them, with homes as pins inside. The map component already
 * does all three (KbListingMapImpl accepts N polygons and frames polygon bounds
 * FIRST). The only open question is DATA: how many child plats actually have a
 * boundary row?
 *
 * That answer decides the design, so it is measured before anything is built:
 *  - full coverage  -> draw them all
 *  - partial        -> draw what exists and PRINT AN HONEST COUNT (decision D4)
 *  - none           -> the community is BLOCKED_MATT. Hull-filling is banned
 *                      (CLAUDE.md §7 / C6): a shape drawn around listing points
 *                      is not a boundary, and publishing one as if it were is a
 *                      §0 violation.
 *
 * SLUG SEAM: the community page's chips link to /subdivisions/${slugify(alias)}.
 * Whether each of those slugs resolves to a `boundaries` row is exactly where
 * the polygon fan-out silently returns null, so the report checks the slug the
 * app actually uses, not a hand-written one.
 *
 * Read path is the documented one — the same `boundary_geojson` RPC the DAL
 * calls. No ad-hoc SQL (CLAUDE.md §7 rule 5).
 *
 * Usage: npm run report:geo-coverage [-- --json]
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const JSON_OUT = process.argv.includes('--json')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or a Supabase key in the environment.')
  console.error('This report reads live boundary data; it cannot run in the secret-less CI chain.')
  process.exit(1)
}
const sb = createClient(url, key, { auth: { persistSession: false } })

// Mirror of lib/slug slugify — kept in sync deliberately; the report must ask
// for the SAME slug the community page's chips link to.
const slugify = (s) =>
  String(s).toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

const registry = JSON.parse(readFileSync('data/resort-communities.json', 'utf8')).communities

async function hasPolygon(geoType, geoSlug) {
  const { data, error } = await sb.rpc('boundary_geojson', { p_geo_type: geoType, p_geo_slug: geoSlug })
  if (error) return { ok: false, err: error.message }
  const present = Array.isArray(data) ? data.length > 0 : Boolean(data)
  return { ok: true, present }
}

const rows = []
for (const c of registry) {
  const own = await hasPolygon('neighborhood', c.slug)
  const children = (c.subdivision_aliases ?? []).filter(
    (a) => a.toLowerCase() !== c.label.toLowerCase(),
  )
  const childRows = []
  for (const alias of children) {
    const slug = slugify(alias)
    const r = await hasPolygon('subdivision', slug)
    childRows.push({ alias, slug, polygon: r.ok ? r.present : null, error: r.err ?? null })
  }
  rows.push({
    community: c.label,
    slug: c.slug,
    city: c.city,
    ownPolygon: own.ok ? own.present : null,
    children: childRows,
    childrenTotal: childRows.length,
    childrenWithPolygon: childRows.filter((r) => r.polygon === true).length,
  })
}

if (JSON_OUT) {
  console.log(JSON.stringify(rows, null, 2))
  process.exit(0)
}

console.log('geo coverage report — plat polygons per registry community')
console.log('==========================================================')
console.log(`registry communities: ${rows.length}\n`)
console.log('| community | city | own polygon | child plats | with polygon |')
console.log('|---|---|---|---|---|')
for (const r of rows) {
  console.log(
    `| ${r.community} | ${r.city} | ${r.ownPolygon === null ? '?' : r.ownPolygon ? 'Y' : 'N'} ` +
      `| ${r.childrenTotal} | ${r.childrenWithPolygon} |`,
  )
}
const anyChildren = rows.filter((r) => r.childrenTotal > 0)
console.log(`\ncommunities with child plats: ${anyChildren.length}`)
for (const r of anyChildren) {
  console.log(`\n${r.community} (${r.childrenWithPolygon}/${r.childrenTotal} plats have a boundary row):`)
  for (const c of r.children) {
    console.log(`  ${c.polygon === true ? 'Y' : c.polygon === false ? 'N' : '?'}  ${c.alias}  ->  /subdivisions/${c.slug}${c.error ? `  [${c.error}]` : ''}`)
  }
}
console.log('\nD4: draw what exists, print an honest count. NEVER hull-fill (CLAUDE.md §7 / C6).')
