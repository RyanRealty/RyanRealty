#!/usr/bin/env node
/**
 * G-SCHEMA — structured-data invariants for the content engine
 * (docs/CONTENT_ENGINE_SPEC.md §8). Deterministic + offline: validates the
 * REGISTRY fields that guarantee the emitted JSON-LD is well-formed, plus that
 * each detail template actually emits schema. Fails the build on a violation.
 *
 * Grounded in the deep-research pass (2026-07-03):
 *  - Event rich result requires name + valid ISO startDate + location.name +
 *    location.address (streetAddress + addressLocality). We hard-require the
 *    fields we always have (name, ISO date, venue→location.name, geoSlug→city);
 *    streetAddress is resolved from the venue registry where the event is held.
 *    (https://developers.google.com/search/docs/appearance/structured-data/event)
 *  - Venue pages emit Place subtypes (MusicVenue/PerformingArtsTheater/EventVenue)
 *    — the policy-safe type for a venue we don't own (NOT LocalBusiness).
 *  - Every detail page emits BreadcrumbList — enforced by the template + ci:breadcrumb.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const fail = []

function objects(file) {
  const src = fs.readFileSync(file, 'utf8')
  const slugs = [...src.matchAll(/\n\s*slug:\s*'([^']+)'/g)]
  return slugs.map((m, i) => {
    const start = m.index
    const end = i + 1 < slugs.length ? slugs[i + 1].index : src.length
    return { slug: m[1], block: src.slice(start, end) }
  })
}
const field = (block, name) => {
  const m = block.match(new RegExp(`\\b${name}:\\s*(?:\\n\\s*)?(['"])((?:\\\\.|(?!\\1)[^\\\\])*)\\1`))
  return m ? m[2] : null
}
const rawField = (block, name) => {
  const m = block.match(new RegExp(`\\b${name}:\\s*([^,\\n]+)`))
  return m ? m[1].trim() : null
}
const ISO = /^\d{4}-\d{2}-\d{2}$/

// ── Events ──
const EVENT_SCHEMA_TYPES = ['Event', 'Festival', 'MusicEvent', 'SportsEvent', 'FoodEvent', 'VisualArtsEvent']
for (const { slug, block } of objects(path.join(ROOT, 'data/co-events.ts'))) {
  const venue = field(block, 'venue')
  const geoSlug = field(block, 'geoSlug')
  const schemaType = field(block, 'schemaType')
  const next = rawField(block, 'nextConfirmedDate')
  if (!venue) fail.push(`event/${slug}: missing venue (Event.location.name)`)
  if (!geoSlug) fail.push(`event/${slug}: missing geoSlug (Event.location.addressLocality)`)
  if (!schemaType || !EVENT_SCHEMA_TYPES.includes(schemaType))
    fail.push(`event/${slug}: schemaType '${schemaType}' not a valid Event subtype`)
  if (next && next !== 'null') {
    const d = field(block, 'nextConfirmedDate')
    if (!d || !ISO.test(d)) fail.push(`event/${slug}: nextConfirmedDate '${d}' is not ISO YYYY-MM-DD`)
  }
}

// ── Venues ──
const VENUE_SCHEMA_KINDS = ['music', 'performing-arts', 'both']
for (const { slug, block } of objects(path.join(ROOT, 'data/co-venues.ts'))) {
  const name = field(block, 'name')
  const geoSlug = field(block, 'geoSlug')
  const kind = field(block, 'kind')
  const official = field(block, 'officialUrl')
  const calendar = field(block, 'calendarUrl')
  if (!name) fail.push(`venue/${slug}: missing name (Place.name)`)
  if (!geoSlug) fail.push(`venue/${slug}: missing geoSlug (Place.address.addressLocality)`)
  if (!kind || !VENUE_SCHEMA_KINDS.includes(kind)) fail.push(`venue/${slug}: kind '${kind}' invalid`)
  if (!/^https:\/\//.test(official ?? '')) fail.push(`venue/${slug}: officialUrl not https`)
  if (!/^https:\/\//.test(calendar ?? '')) fail.push(`venue/${slug}: calendarUrl not https`)
}

// ── Golf ──
const GOLF_ACCESS = ['public', 'resort', 'semi-private', 'private']
for (const { slug, block } of objects(path.join(ROOT, 'data/co-golf.ts'))) {
  const name = field(block, 'name')
  const geoSlug = field(block, 'geoSlug')
  const access = field(block, 'access')
  const holes = rawField(block, 'holes')
  const official = field(block, 'officialUrl')
  if (!name) fail.push(`golf/${slug}: missing name (Place.name)`)
  if (!geoSlug) fail.push(`golf/${slug}: missing geoSlug (Place.address.addressLocality)`)
  if (!access || !GOLF_ACCESS.includes(access)) fail.push(`golf/${slug}: access '${access}' invalid`)
  if (!holes || !/^\d+$/.test(holes)) fail.push(`golf/${slug}: holes '${holes}' not an integer`)
  if (!/^https:\/\//.test(official ?? '')) fail.push(`golf/${slug}: officialUrl not https`)
}

// ── Trails ──
const TRAIL_USES = ['hike', 'mtb', 'both']
for (const { slug, block } of objects(path.join(ROOT, 'data/co-trails.ts'))) {
  const name = field(block, 'name')
  const geoSlug = field(block, 'geoSlug')
  const use = field(block, 'use')
  const landManager = field(block, 'landManager')
  const official = field(block, 'officialUrl')
  if (!name) fail.push(`trail/${slug}: missing name (Place.name)`)
  if (!geoSlug) fail.push(`trail/${slug}: missing geoSlug (Place.address.addressLocality)`)
  if (!use || !TRAIL_USES.includes(use)) fail.push(`trail/${slug}: use '${use}' invalid`)
  if (!landManager) fail.push(`trail/${slug}: missing landManager`)
  if (!/^https:\/\//.test(official ?? '')) fail.push(`trail/${slug}: officialUrl not https`)
}

// ── Templates must emit schema (MetadataBlock) ──
const templates = [
  'app/central-oregon/events/page.tsx',
  'app/central-oregon/events/[slug]/page.tsx',
  'app/central-oregon/venues/page.tsx',
  'app/central-oregon/venues/[slug]/page.tsx',
  'app/central-oregon/golf/page.tsx',
  'app/central-oregon/golf/[slug]/page.tsx',
  'app/central-oregon/trails/page.tsx',
  'app/central-oregon/trails/[slug]/page.tsx',
]
for (const t of templates) {
  const src = fs.readFileSync(path.join(ROOT, t), 'utf8')
  if (!src.includes('MetadataBlock')) fail.push(`${t}: does not render <MetadataBlock> (no JSON-LD)`)
  if (!/type:\s*'breadcrumb'/.test(src)) fail.push(`${t}: emits no BreadcrumbList schema`)
}

console.log('content-schema gate (G-SCHEMA)')
console.log('==============================')
if (fail.length) {
  console.error(`\n✗ ${fail.length} structured-data violation(s):`)
  for (const f of fail) console.error('  ' + f)
  process.exit(1)
}
console.log('✓ All content registries + templates satisfy their JSON-LD invariants.')
