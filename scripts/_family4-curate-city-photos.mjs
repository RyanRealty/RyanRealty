#!/usr/bin/env node
/**
 * _family4-curate-city-photos.mjs — Family 4 (cities) photo curation pass.
 *
 * Applies per-city geo_tags, surface_tags, and approval to VERIFIED assets in
 * the asset library (Supabase `public.asset_library` + the local manifest
 * mirror at data/asset-library/manifest.json). Idempotent — safe to re-run.
 *
 * PROVENANCE DISCIPLINE (the rule this script encodes):
 *   An asset gets a per-city geo tag ONLY when its location is verified by
 *   (a) vision_location set by the vision-grading pass,
 *   (b) source metadata — the snowdriftvisuals "Area Guide - <Area>" Drive
 *       label (professional shoot commissioned per area, license: owned), or
 *   (c) Unsplash photo-detail location metadata naming the city,
 *   AND every hero pick was visually reviewed in the 2026-06-10 session
 *   (640px previews read + judged against known geography).
 *   Never inferred from a search query or a query-derived filename.
 *
 * Notable corrections this pass makes:
 *   - Smith Rock assets lose any 'redmond' tag (Smith Rock is Terrebonne).
 *   - Mt. Bachelor / Three Sisters pure-mountain assets lose 'bend'
 *     (mountain landmarks get landmark tags, not city tags).
 *   - "Area Guide - Pine Meadow Village" is tagged 'sisters' (the captions
 *     show downtown Sisters + Three Sisters peaks; Pine Meadow Village is in
 *     Sisters) — NOT Sunriver, despite the similar name.
 *   - Caldera Springs / Crosswater are tagged 'sunriver' per the canonical
 *     registry (data/resort-communities.json city_slug = sunriver).
 *   - Three Rivers photos get ONLY 'three-rivers' (no city tag — visually
 *     implying a city would stretch provenance).
 *
 * Usage:  node --env-file=.env.local scripts/_family4-curate-city-photos.mjs [--dry-run]
 */

import { readFile, writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const MANIFEST_PATH = resolve(ROOT, 'data', 'asset-library', 'manifest.json')
const DRY = process.argv.includes('--dry-run')

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (run with --env-file=.env.local)')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Curation tables
// ---------------------------------------------------------------------------

/** Hero picks — one per city, every one visually verified 2026-06-10. */
const HEROES = {
  aa132eaa: 'bend', //           Old Mill District aerial — smokestacks, Deschutes, butte
  d18c0ff9: 'redmond', //        downtown Redmond aerial — brick blocks, Cascades horizon
  '70073a44': 'sisters', //      downtown Sisters aerial — Three Sisters + Black Butte
  '53a6958e': 'sunriver', //     Caldera Springs Lake House aerial (registry city_slug=sunriver)
  '3b5f140c': 'la-pine', //      Little Deschutes meanders, Cascades distant
  c73cff7d: 'terrebonne', //     Smith Rock + Crooked River aerial
  '4522af07': 'tumalo', //       Deschutes at Tumalo State Park aerial
  '2dcf6fef': 'prineville', //   Ochoco viewpoint over town + Crooked River (B-grade, best verified)
  f0ba61e9: 'madras', //         Madras park + street grid aerial
  '63c06a53': 'powell-butte', // irrigated farmland + Cascades (B-grade, best verified)
  cdd3bf60: 'culver', //         Lake Billy Chinook / Cove Palisades aerial
  '965f2175': 'crooked-river-ranch', // CRR golf course in canyon terrain aerial
}

/** Drive "Area Guide" label prefix → verified geo tags. */
const AREA_GUIDE_GEO = {
  'Area Guide - Bend': ['bend'],
  'Area Guide - Old Bend': ['bend'],
  'Area Guide - Redmond': ['redmond'],
  'Area Guide - Sisters': ['sisters'],
  'Area Guide - Pine Meadow Village': ['sisters', 'pine-meadow-village'],
  'Area Guide - La Pine': ['la-pine'],
  'Area Guide - Terrebonne': ['terrebonne'],
  'Area Guide - Tumalo': ['tumalo'],
  'Area Guide - Prineville': ['prineville'],
  'Area Guide - Madras': ['madras'],
  'Area Guide - Powell Butte': ['powell-butte'],
  'Area Guide - Culver': ['culver'],
  'Area Guide - Crooked River Ranch': ['crooked-river-ranch'],
  'Area Guide - Caldera Springs': ['sunriver', 'caldera-springs'],
  'Area Guide - Crosswater': ['sunriver', 'crosswater'],
  'Area Guide - Three Rivers Recreation Sites': ['three-rivers'],
  'Area Guide - Three Rivers South': ['three-rivers'],
}

/** vision_location → geo tags (Bend landmarks ARE in Bend city). */
const VISION_LOCATION_GEO = {
  'Old Mill District': ['bend', 'old-mill-district'],
  'Pilot Butte': ['bend', 'pilot-butte'],
  'Tower Theatre': ['bend', 'downtown-bend'],
  'Drake Park/Mirror Pond': ['bend', 'drake-park'],
  'Drake Park': ['bend', 'drake-park'],
  'Smith Rock': ['terrebonne', 'smith-rock'],
  // Mountain landmarks — landmark tags only, never a city tag.
  'Mt. Bachelor': ['mt-bachelor'],
  'Three Sisters': ['three-sisters'],
  'Deschutes River': ['deschutes-river'],
}

/** Per-asset explicit additions (Unsplash location-metadata verified). */
const EXPLICIT = {
  // Unsplash af8vR4jt1a4 — location metadata "Sunriver, OR, USA" (43.8694,-121.4334)
  '41fbd658': { geo: ['sunriver'], surfaces: ['card'], approve: true },
}

/** City tags that must be REMOVED from mountain/landmark assets. */
const MOUNTAIN_LOCATIONS = new Set(['Mt. Bachelor', 'Three Sisters'])
const SMITH_ROCK_BAD_TAGS = ['redmond']

const MIN_W = 1000
const MIN_H = 700
const NOTE = 'family4 city curation 2026-06-10: geo verified (vision_location / Area Guide source label / Unsplash location metadata) + heroes visually reviewed'

// ---------------------------------------------------------------------------

function uniq(arr) {
  return [...new Set(arr.filter(Boolean))]
}

function isTownAerialOfSisters(a) {
  // Some "Three Sisters" vision_location assets are actually downtown Sisters
  // aerials (commercial district + peaks). Those already get 'sisters' via
  // their Area Guide label, so the rule layer here only adds the landmark tag
  // for pure mountain shots; town shots are detected and skipped.
  const cap = (a.vision_caption || '').toLowerCase()
  return /commercial district|downtown|small.town|storefront/.test(cap)
}

async function patchSupabase(id, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/asset_library?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`PATCH ${id} failed: ${res.status} ${await res.text()}`)
}

const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'))
const assets = manifest.assets || manifest

const plans = new Map() // id -> { addGeo, removeGeo, addSurfaces, approve }

function plan(a) {
  if (!plans.has(a.id)) plans.set(a.id, { addGeo: [], removeGeo: [], addSurfaces: [], approve: false })
  return plans.get(a.id)
}

const eligible = (a) =>
  a.type === 'photo' &&
  a.file_url &&
  a.vision_watermark !== true &&
  (a.width || 0) >= MIN_W &&
  (a.height || 0) >= MIN_H &&
  ['A', 'B'].includes(a.vision_quality || '')

for (const a of assets) {
  if (a.type !== 'photo') continue
  const dn = (a.license_metadata && a.license_metadata.drive_name) || ''

  // 1. Area Guide source-label rule
  for (const [prefix, geo] of Object.entries(AREA_GUIDE_GEO)) {
    if (dn.startsWith(prefix + ' -') || dn.startsWith(prefix + '.')) {
      const p = plan(a)
      p.addGeo.push(...geo)
      if (eligible(a) && geo.some((g) => !['three-rivers', 'deschutes-river'].includes(g))) {
        p.addSurfaces.push('card')
        p.approve = true
      }
    }
  }

  // 2. vision_location rule
  const vl = a.vision_location
  if (vl && VISION_LOCATION_GEO[vl]) {
    const p = plan(a)
    if (vl === 'Three Sisters' && isTownAerialOfSisters(a)) {
      // town aerial — Area Guide rule already handles it; no landmark mistag
    } else {
      p.addGeo.push(...VISION_LOCATION_GEO[vl])
    }
    if (MOUNTAIN_LOCATIONS.has(vl)) p.removeGeo.push('bend')
    if (vl === 'Smith Rock') p.removeGeo.push(...SMITH_ROCK_BAD_TAGS)
    if (eligible(a) && !MOUNTAIN_LOCATIONS.has(vl) && vl !== 'Deschutes River') {
      p.addSurfaces.push('card')
      p.approve = true
    }
  }

  // 3. Explicit per-asset additions
  for (const [prefix, spec] of Object.entries(EXPLICIT)) {
    if (a.id.startsWith(prefix)) {
      const p = plan(a)
      p.addGeo.push(...spec.geo)
      p.addSurfaces.push(...spec.surfaces)
      if (spec.approve) p.approve = true
    }
  }

  // 4. Hero picks
  for (const [prefix, city] of Object.entries(HEROES)) {
    if (a.id.startsWith(prefix)) {
      const p = plan(a)
      p.addGeo.push(city)
      p.addSurfaces.push('hero', 'card')
      p.approve = true
    }
  }
}

// Apply
let changed = 0
const summary = {}
for (const a of assets) {
  const p = plans.get(a.id)
  if (!p) continue

  const beforeGeo = a.geo_tags || []
  const geo = uniq([...beforeGeo, ...p.addGeo]).filter((g) => !p.removeGeo.includes(g))
  const surfaces = uniq([...(a.surface_tags || []), ...p.addSurfaces])
  const approval = p.approve ? 'approved' : a.approval

  const geoChanged = JSON.stringify(geo.slice().sort()) !== JSON.stringify(beforeGeo.slice().sort())
  const surfChanged = JSON.stringify(surfaces.slice().sort()) !== JSON.stringify((a.surface_tags || []).slice().sort())
  const apprChanged = approval !== a.approval
  if (!geoChanged && !surfChanged && !apprChanged) continue

  changed++
  const note = (a.notes || '').includes('family4 city curation') ? a.notes : [a.notes, NOTE].filter(Boolean).join(' | ')

  for (const g of geo) {
    if (Object.values(HEROES).includes(g) || ['smith-rock', 'caldera-springs'].includes(g)) {
      summary[g] = summary[g] || { total: 0, heroes: 0 }
      summary[g].total++
      if (surfaces.includes('hero') && p.addSurfaces.includes('hero')) summary[g].heroes++
    }
  }

  if (DRY) {
    console.log(`[dry] ${a.id.slice(0, 8)} geo:[${geo}] surfaces:[${surfaces}] approval:${approval}`)
    continue
  }

  await patchSupabase(a.id, { geo_tags: geo, surface_tags: surfaces, approval, notes: note })
  a.geo_tags = geo
  a.surface_tags = surfaces
  a.approval = approval
  a.notes = note
}

if (!DRY) {
  manifest.updated_at = new Date().toISOString()
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2))
}

console.log(`\n${DRY ? '[dry-run] would change' : 'Changed'} ${changed} assets`)
console.log('\nPer-city coverage after pass:')
const counts = {}
for (const a of assets) {
  for (const g of a.geo_tags || []) {
    if (a.type !== 'photo' || a.approval !== 'approved' || !a.file_url) continue
    counts[g] = counts[g] || { total: 0, hero: 0 }
    counts[g].total++
    if ((a.surface_tags || []).includes('hero')) counts[g].hero++
  }
}
for (const g of Object.keys(counts).sort()) {
  console.log(`  ${g.padEnd(22)} approved:${String(counts[g].total).padStart(3)}  hero:${counts[g].hero}`)
}
