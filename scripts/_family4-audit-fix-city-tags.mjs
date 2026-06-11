#!/usr/bin/env node
/**
 * _family4-audit-fix-city-tags.mjs — Family 4 audit pass over the PRE-EXISTING
 * per-city geo tags in Supabase asset_library (the 2026-05-28 bulk SQL pass
 * inferred tags from search queries — exactly the provenance failure that put
 * Tumalo Falls portraits on /cities/bend as the "Bend" hero).
 *
 * Every fix below was decided by visually reviewing the photo (480px preview)
 * in the 2026-06-10 Family 4 session:
 *
 *   - Tumalo Falls portraits tagged 'bend' -> retag 'tumalo-falls' landmark
 *   - NorthWest Crossing roundabout tagged 'sisters' -> 'bend','northwest-crossing'
 *   - Terrebonne town aerial (Smith Rock behind) tagged 'prineville' -> 'terrebonne'
 *   - Unverifiable query-derived city tags stripped (culver x2, bend x2)
 *   - 'hero' surface demoted to 'card' on every per-city row that is NOT one
 *     of the 12 visually-verified Family 4 hero picks, so the per-city hero
 *     bucket contains exactly the verified heroes.
 *
 * Idempotent. Mirrors changes into data/asset-library/manifest.json when the
 * row exists there (3 rows exist only in Supabase).
 *
 * Usage: node --env-file=.env.local scripts/_family4-audit-fix-city-tags.mjs [--dry-run]
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
  console.error('Missing Supabase env (run with --env-file=.env.local)')
  process.exit(1)
}

const CITY_TAGS = [
  'bend', 'redmond', 'sisters', 'sunriver', 'la-pine', 'tumalo', 'prineville',
  'madras', 'terrebonne', 'powell-butte', 'culver', 'crooked-river-ranch',
]

/** The 12 visually-verified Family 4 hero ids (prefixes) — the ONLY per-city rows allowed to keep 'hero'. */
const VERIFIED_HERO_PREFIXES = [
  'aa132eaa', 'd18c0ff9', '70073a44', '53a6958e', '3b5f140c', 'c73cff7d',
  '4522af07', '2dcf6fef', 'f0ba61e9', '63c06a53', 'cdd3bf60', '965f2175',
]

/** Per-asset corrections (id prefix -> ops), each visually verified 2026-06-10. */
const FIXES = {
  // Tumalo Falls portraits mistagged 'bend' (the wrong-hero bug Matt saw).
  // Landmark tag + region tag; hero surface stripped (a waterfall portrait is
  // not a city hero on any surface).
  '1feba5fd': { removeGeo: ['bend'], addGeo: ['tumalo-falls', 'central-oregon'], removeSurfaces: ['hero'] },
  '959b07f5': { removeGeo: ['bend'], addGeo: ['tumalo-falls', 'central-oregon'], removeSurfaces: ['hero'] },
  '9863e327': { removeGeo: ['bend'], addGeo: ['tumalo-falls', 'central-oregon'], removeSurfaces: ['hero'] },
  '549efee8': { removeGeo: ['bend'], addGeo: ['tumalo-falls', 'central-oregon'], removeSurfaces: ['hero'] },
  d43f6926: { removeGeo: ['bend'], addGeo: ['tumalo-falls', 'central-oregon'], removeSurfaces: ['hero'] },
  // NorthWest Crossing roundabout (Bend) was tagged 'sisters'
  '6ae94ec1': { removeGeo: ['sisters'], addGeo: ['bend', 'northwest-crossing'] },
  // Terrebonne town center aerial (Smith Rock + Gray Butte behind) was tagged 'prineville'
  '35e4ce1d': { removeGeo: ['prineville'], addGeo: ['terrebonne'] },
  // Unverifiable query-derived tags — stripped (no city implication allowed)
  '4d8e77d3': { removeGeo: ['culver'], removeSurfaces: ['hero'] }, //  blurry tilt-shift reservoir, query "pilot butte bend oregon"
  '1e400d15': { removeGeo: ['culver'], removeSurfaces: ['hero'] }, //  juniper-hill reservoir, query "prineville" — not Lake Billy Chinook
  c09b12a0: { removeGeo: ['bend'], removeSurfaces: ['hero'] }, //      sunset butte, query "redmond" — unidentifiable
  '2201e1f7': { removeGeo: ['bend'] }, //    "5 Market" tower — not a Bend landmark we can verify
  // Tetherow golf aerial — legitimately Bend; add the community tag
  c5a01c8a: { addGeo: ['tetherow'] },
}

const NOTE = 'family4 tag audit 2026-06-10: visual review of pre-existing per-city tags'

function uniq(a) { return [...new Set(a.filter(Boolean))] }

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
}

const rows = await fetch(
  `${SUPABASE_URL}/rest/v1/asset_library?select=id,geo_tags,surface_tags,approval,notes,file_url&type=eq.photo&limit=2000`,
  { headers },
).then((r) => r.json())

const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'))
const manifestById = new Map((manifest.assets || manifest).map((a) => [a.id, a]))

let changed = 0
for (const row of rows) {
  const fix = Object.entries(FIXES).find(([p]) => row.id.startsWith(p))?.[1]
  let geo = row.geo_tags || []
  let surfaces = row.surface_tags || []

  if (fix) {
    geo = uniq([...geo, ...(fix.addGeo || [])]).filter((g) => !(fix.removeGeo || []).includes(g))
    if (fix.removeSurfaces) {
      surfaces = surfaces.filter((s) => !fix.removeSurfaces.includes(s))
      if (!surfaces.length) surfaces = ['card']
    }
  }

  // Demote 'hero' on any per-city row that is not a verified Family 4 hero
  const hasCityTag = geo.some((g) => CITY_TAGS.includes(g))
  const isVerifiedHero = VERIFIED_HERO_PREFIXES.some((p) => row.id.startsWith(p))
  if (hasCityTag && !isVerifiedHero && surfaces.includes('hero')) {
    surfaces = uniq([...surfaces.filter((s) => s !== 'hero'), 'card'])
  }

  const geoChanged = JSON.stringify(geo.slice().sort()) !== JSON.stringify((row.geo_tags || []).slice().sort())
  const surfChanged = JSON.stringify(surfaces.slice().sort()) !== JSON.stringify((row.surface_tags || []).slice().sort())
  if (!geoChanged && !surfChanged) continue

  changed++
  const note = (row.notes || '').includes('family4 tag audit') ? row.notes : [row.notes, NOTE].filter(Boolean).join(' | ')
  console.log(`${DRY ? '[dry] ' : ''}${row.id.slice(0, 8)} geo:[${geo}] surfaces:[${surfaces}]`)
  if (DRY) continue

  const res = await fetch(`${SUPABASE_URL}/rest/v1/asset_library?id=eq.${row.id}`, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify({ geo_tags: geo, surface_tags: surfaces, notes: note }),
  })
  if (!res.ok) throw new Error(`PATCH ${row.id}: ${res.status} ${await res.text()}`)

  const ma = manifestById.get(row.id)
  if (ma) {
    ma.geo_tags = geo
    ma.surface_tags = surfaces
    ma.notes = note
  }
}

if (!DRY) {
  manifest.updated_at = new Date().toISOString()
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2))
}
console.log(`${DRY ? '[dry-run] would change' : 'Changed'} ${changed} rows`)
