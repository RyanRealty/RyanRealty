#!/usr/bin/env node
/**
 * G30 — Geo imagery canonical-source gate.
 *
 * Enforces the locked 2026-05-28 rule (DESIGN_DIRECTIVES D86): area-tile and
 * geo imagery on city / community / neighborhood surfaces comes ONLY from the
 * canonical sources, so it propagates to every page and can't regress into
 * fake/repeated stock or scattered hardcoded paths:
 *
 *   - Cities / neighborhoods → asset_library via getGeoTileImages()
 *   - Golf / master communities → GOLF_COMMUNITY_IMAGES (lib/geo-images.ts)
 *
 * Checks:
 *   1. The canonical modules exist (the lowest reusable units).
 *   2. No geo surface hardcodes a /lp/.../img/*.{jpg,png,webp} image path —
 *      golf-community photos must route through GOLF_COMMUNITY_IMAGES.
 *      (The landing pages under app/lp/** are exempt; they own those images.)
 *   3. No geo surface pulls a tile image from the fake neighborhoods/communities
 *      hero_image_url stock columns (repeated Unsplash placeholders).
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const errors = []

// 1 — canonical modules must exist.
const CANONICAL = [
  'lib/geo-images.ts',
  'lib/data/media/getGeoTileImages.ts',
]
for (const f of CANONICAL) {
  if (!existsSync(join(ROOT, f))) {
    errors.push(`Missing canonical geo-imagery module: ${f}`)
  }
}

// Geo surfaces whose tile imagery must use the canonical helpers. The
// landing pages (app/lp/**) and the canonical module itself are exempt.
const SURFACE_DIRS = ['app/cities', 'app/communities', 'components/site']
const EXEMPT = new Set(['lib/geo-images.ts'])

const LP_IMAGE = /['"`]\/lp\/[^'"`]*\.(?:jpg|jpeg|png|webp)['"`]/i
const FAKE_HERO = /\b(?:neighborhoods?|communities)\b[^\n]*\.hero_image_url/i

function walk(dir) {
  const abs = join(ROOT, dir)
  if (!existsSync(abs)) return []
  const out = []
  for (const entry of readdirSync(abs)) {
    const rel = join(dir, entry)
    const st = statSync(join(ROOT, rel))
    if (st.isDirectory()) out.push(...walk(rel))
    else if (/\.(tsx?|jsx?)$/.test(entry)) out.push(rel)
  }
  return out
}

const files = SURFACE_DIRS.flatMap(walk)
for (const file of files) {
  if (EXEMPT.has(file)) continue
  const src = readFileSync(join(ROOT, file), 'utf8')
  if (LP_IMAGE.test(src)) {
    errors.push(
      `${file}: hardcodes a /lp/...image path. Golf/master-community tile imagery must come from GOLF_COMMUNITY_IMAGES in lib/geo-images.ts (D86).`,
    )
  }
  if (FAKE_HERO.test(src)) {
    errors.push(
      `${file}: uses neighborhoods/communities hero_image_url for imagery. Those columns hold fake repeated stock — use getGeoTileImages (asset_library) instead (D86).`,
    )
  }
}

if (errors.length) {
  console.error('\nG30 geo-imagery gate FAILED:\n')
  for (const e of errors) console.error(`  - ${e}`)
  console.error('\nSee DESIGN_DIRECTIVES.md D86 + lib/geo-images.ts.')
  process.exit(1)
}
console.log(`G30 geo-imagery gate passed (${files.length} geo-surface files scanned).`)
