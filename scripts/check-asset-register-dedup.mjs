#!/usr/bin/env node
/**
 * asset_library register() dedup gate.
 *
 * register() (lib/asset-library.mjs) upserts on (source, source_id) with
 * PostgREST resolution=merge-duplicates, which OVERWRITES approval / geo_tags /
 * surface_tags / notes. So before it upserts, it must find an existing row
 * PRECISELY (exact source + source_id match) and return early — preserving
 * whatever curation a human already did.
 *
 * The original bug: dedup used a capped, recency-ordered search (order=…&limit=100)
 * that MISSED existing rows on a 1000+ asset re-ingest, so the upsert reset 255
 * prior watermark-rejections back to intake. The memory's explicit instruction is
 * "Never 'fix' dedup back to a capped search." This gate enforces that:
 *   1. findBySourceId exists and filters BOTH source AND source_id with eq.
 *      (exact match), with NO recency `order=` clause (a precise lookup, not a
 *      capped search — limit=1 on a unique key is fine, order= is the tell).
 *   2. register() calls findBySourceId and returns the existing row early.
 *
 * Companion memory: ryanrealty-asset-curation-system.md. Invariant as a gate.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const LIB = path.join(ROOT, 'lib/asset-library.mjs')

const fail = (lines) => {
  console.error('asset-register-dedup gate FAILED:')
  for (const l of [].concat(lines)) console.error('  - ' + l)
  process.exit(1)
}

if (!fs.existsSync(LIB)) fail('lib/asset-library.mjs is missing — register() dedup lives there.')
const src = fs.readFileSync(LIB, 'utf8')

// Slice a top-level function body: from its declaration to the next top-level
// `function`/`async function`/`export ` (or EOF).
function bodyOf(declRe) {
  const m = src.match(declRe)
  if (!m) return null
  const start = m.index
  const after = src.slice(start + m[0].length)
  const nextRe = /\n(?:async function |function |export (?:async )?(?:function|const) )/
  const nm = after.match(nextRe)
  return after.slice(0, nm ? nm.index : undefined)
}

// 1. findBySourceId — precise exact-match lookup, no recency ordering.
const fbsi = bodyOf(/async function findBySourceId\s*\(/)
if (!fbsi) {
  fail("findBySourceId is gone — register()'s precise dedup depends on it. Do not replace it with a capped search.")
}
const hasSourceEq = /source['"]\s*,\s*`eq\.|source['"]\s*,\s*['"]eq\.|'source'.*eq\./.test(fbsi)
const hasSourceIdEq = /source_id['"]\s*,\s*`eq\.|source_id['"]\s*,\s*['"]eq\.|'source_id'.*eq\./.test(fbsi)
if (!hasSourceEq || !hasSourceIdEq) {
  fail(
    'findBySourceId must filter BOTH source AND source_id with exact `eq.` matches (precise lookup). ' +
      'A non-exact match reopens the curation-wipe bug.',
  )
}
if (/['"]order['"]/.test(fbsi) || /[?&]order=/.test(fbsi)) {
  fail(
    "findBySourceId uses a recency `order=` clause — that is the capped-search anti-pattern that MISSED rows " +
      'and wiped 255 curation states. Dedup must be a precise (source, source_id) lookup, never recency-ordered.',
  )
}

// 2. register() — must call the precise dedup and return early on a hit.
const reg = bodyOf(/export async function register\s*\(/)
if (!reg) fail('register() is gone or no longer exported from lib/asset-library.mjs.')
if (!/findBySourceId\s*\(/.test(reg)) {
  fail('register() must call findBySourceId() to dedup before upserting, or merge-duplicates wipes curation.')
}
// The dedup hit must short-circuit (return the existing row) BEFORE the upsert.
const dedupReturnsEarly = /findBySourceId\s*\([\s\S]{0,200}?\n[\s\S]{0,200}?return\s+\w/.test(reg)
if (!dedupReturnsEarly) {
  fail(
    'register() must `return` the existing row right after findBySourceId() finds it (preserve curation, ' +
      'do not fall through to the merge-duplicates upsert).',
  )
}

console.log('asset-register-dedup gate passed (precise (source, source_id) lookup, early return preserves curation).')
