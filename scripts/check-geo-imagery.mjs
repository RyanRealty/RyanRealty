#!/usr/bin/env node
/**
 * G30 — Geo imagery canonical-source gate.
 *
 * Public city / community / neighborhood / homepage tiles pick photos in this
 * order:
 *   1. `hero_image_url` on that place row (via preferPlaceHero)
 *   2. existing hardcoded fallback (communityImage, cityHero, KB, LP, Area Guide)
 *   3. never a wrong-city photo
 *
 * Checks:
 *   1. The canonical modules exist, and preferPlaceHero lives in lib/geo-images.ts.
 *   2. Public geo surfaces that pick a place photo call preferPlaceHero.
 *   3. No geo surface hardcodes a /lp/.../img/*.{jpg,png,webp} image path —
 *      golf-community photos must route through GOLF_COMMUNITY_IMAGES.
 *      (The landing pages under app/lp/** are exempt; they own those images.)
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const errors = []

const CANONICAL = [
  'lib/geo-images.ts',
  'lib/data/media/getGeoTileImages.ts',
]
for (const f of CANONICAL) {
  if (!existsSync(join(ROOT, f))) {
    errors.push(`Missing canonical geo-imagery module: ${f}`)
  }
}

const geoImages = existsSync(join(ROOT, 'lib/geo-images.ts'))
  ? readFileSync(join(ROOT, 'lib/geo-images.ts'), 'utf8')
  : ''
if (geoImages && !/export function preferPlaceHero\(/.test(geoImages)) {
  errors.push('lib/geo-images.ts must export preferPlaceHero so live hero_image_url wins everywhere.')
}

const MUST_PREFER_LIVE = [
  'app/page.tsx',
  'app/cities/page.tsx',
  'app/communities/page.tsx',
  'app/neighborhoods/page.tsx',
  'app/subdivisions/page.tsx',
  'app/communities/[slug]/_v3/community-opening.ts',
  'app/cities/[slug]/page.tsx',
  'lib/kb/place-sections.ts',
  'lib/explore/neighborhood-peers.ts',
]
for (const f of MUST_PREFER_LIVE) {
  const abs = join(ROOT, f)
  if (!existsSync(abs)) {
    errors.push(`Missing required live-hero consumer: ${f}`)
    continue
  }
  const src = readFileSync(abs, 'utf8')
  if (!/\bpreferPlaceHero(?:OrNull)?\b/.test(src)) {
    errors.push(`${f}: must call preferPlaceHero so a loaded place-row hero wins over static fallbacks.`)
  }
}

const SURFACE_DIRS = ['app/cities', 'app/communities', 'components/site']
const EXEMPT = new Set(['lib/geo-images.ts'])

const LP_IMAGE = /['"`]\/lp\/[^'"`]*\.(?:jpg|jpeg|png|webp)['"`]/i

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
}

if (errors.length) {
  console.error('\nG30 geo-imagery gate FAILED:\n')
  for (const e of errors) console.error(`  - ${e}`)
  console.error('\nSee lib/geo-images.ts preferPlaceHero.')
  process.exit(1)
}
console.log(`G30 geo-imagery gate passed (${files.length} geo-surface files scanned).`)
