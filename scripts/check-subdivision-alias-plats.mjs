#!/usr/bin/env node
/**
 * ci:alias-plats — the MLS alias → county plat evidence map stays reviewable.
 *
 * data/subdivision-alias-plats.json is the committed evidence behind every
 * boundaries union row minted for an MLS SubdivisionName whose recorded plats
 * are phased or worded differently (PLACE_MEMBERSHIP_MISSION W1/W2). The
 * forbidden failure mode is the fuzzy prefix rule (C-21): membership inferred
 * from name shape instead of verified geometry. This gate cannot query the DB
 * (static chain), so it holds the reviewable half of the contract:
 *
 *  1. Schema: every entry carries aliasSlug, mlsName, city, shape, >= 1
 *     memberPlats (each with slug + name + csnum), and evidence.
 *  2. Evidence names a METHOD AND A DATE — "Geometry YYYY-MM-DD" or an
 *     explicit recorded-plat citation. Unverified entries do not ship.
 *  3. shape matches the plat count (1:1 has exactly one member).
 *  4. redirectCountySlugToAlias only on 1:1 entries, and the county slug must
 *     appear in lib/subdivision-area-redirects.ts pointing at the alias page.
 *  5. No duplicate alias slugs; no plat slug claimed by two aliases (a plat
 *     has one home); no alias that is itself a member plat slug.
 *  6. Deferred entries carry a reason.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const fail = []
const root = process.cwd()
const raw = readFileSync(resolve(root, 'data/subdivision-alias-plats.json'), 'utf8')
let doc
try {
  doc = JSON.parse(raw)
} catch (e) {
  console.error(`ci:alias-plats FAIL — data/subdivision-alias-plats.json is not valid JSON: ${e.message}`)
  process.exit(1)
}

const entries = Array.isArray(doc.entries) ? doc.entries : null
if (!entries || entries.length === 0) fail.push('entries[] is missing or empty')

const redirectsSrc = readFileSync(resolve(root, 'lib/subdivision-area-redirects.ts'), 'utf8')

const aliasSeen = new Set()
const platSeen = new Map()
const evidenceRe = /(geometry|recorded plat|plat filed|csnum)\b/i
const dateRe = /20\d\d-\d\d-\d\d/

for (const e of entries ?? []) {
  const at = `entry ${e?.aliasSlug ?? '<missing aliasSlug>'}`
  for (const key of ['aliasSlug', 'mlsName', 'city', 'shape', 'evidence']) {
    if (typeof e?.[key] !== 'string' || !e[key].trim()) fail.push(`${at}: missing ${key}`)
  }
  const plats = Array.isArray(e?.memberPlats) ? e.memberPlats : []
  if (plats.length === 0) fail.push(`${at}: memberPlats is empty`)
  for (const p of plats) {
    for (const key of ['slug', 'name', 'csnum']) {
      if (typeof p?.[key] !== 'string' || !p[key].trim()) fail.push(`${at}: member plat missing ${key}`)
    }
    if (p?.slug) {
      if (platSeen.has(p.slug)) fail.push(`${at}: plat ${p.slug} already claimed by ${platSeen.get(p.slug)} — a plat has one home`)
      platSeen.set(p.slug, e.aliasSlug)
    }
  }
  if (typeof e?.evidence === 'string') {
    if (!evidenceRe.test(e.evidence)) fail.push(`${at}: evidence names no method (geometry / recorded plat citation)`)
    if (!dateRe.test(e.evidence)) fail.push(`${at}: evidence carries no verification date`)
  }
  if (e?.shape === '1:1' && plats.length !== 1) fail.push(`${at}: shape 1:1 but ${plats.length} member plats`)
  if (e?.shape === '1:many' && plats.length < 2) fail.push(`${at}: shape 1:many but ${plats.length} member plat`)
  if (e?.redirectCountySlugToAlias === true) {
    if (e?.shape !== '1:1') fail.push(`${at}: redirectCountySlugToAlias on a non-1:1 entry`)
    const county = plats[0]?.slug
    if (county && !(redirectsSrc.includes(`'${county}'`) && redirectsSrc.includes(`/subdivisions/${e.aliasSlug}`))) {
      fail.push(`${at}: 1:1 redirect declared but lib/subdivision-area-redirects.ts has no ${county} → /subdivisions/${e.aliasSlug} hop`)
    }
  }
  if (e?.aliasSlug) {
    if (aliasSeen.has(e.aliasSlug)) fail.push(`duplicate aliasSlug ${e.aliasSlug}`)
    aliasSeen.add(e.aliasSlug)
  }
}
for (const e of entries ?? []) {
  if (e?.aliasSlug && platSeen.has(e.aliasSlug)) fail.push(`alias ${e.aliasSlug} is also listed as a member plat`)
}
for (const d of Array.isArray(doc.deferred) ? doc.deferred : []) {
  if (typeof d?.aliasSlug !== 'string' || typeof d?.reason !== 'string' || !d.reason.trim()) {
    fail.push(`deferred entry ${d?.aliasSlug ?? '<missing>'} carries no reason`)
  }
}

if (fail.length) {
  console.error(`ci:alias-plats FAIL — ${fail.length} problem(s):`)
  for (const f of fail) console.error(`  ✗ ${f}`)
  process.exit(1)
}
console.log(`ci:alias-plats OK — ${entries.length} verified alias entries, ${platSeen.size} member plats, ${(doc.deferred ?? []).length} deferred with reasons`)
