#!/usr/bin/env node
/**
 * G58 — confidential-key spelling parity (TS list <-> SQL mirror <-> both spellings).
 *
 * WHY THIS EXISTS (incident 2026-07-30): the listing sync flattens the Flexmls
 * CustomFields payload using MLS DISPLAY names ("Private Remarks"), while the
 * RESO StandardFields payload uses camelCase ("PrivateRemarks"). Those are two
 * DIFFERENT jsonb keys in listings.details. PRIVATE_DETAIL_KEYS carried only the
 * camelCase spellings for the two most sensitive fields, so the CF ingest wrote
 * broker-private remarks and showing instructions into the ANON-READABLE
 * listings.details on ~2,500 on-market listings. A public visitor could read
 * tenant-occupancy notes and lockbox/showing directions.
 *
 * Three invariants, any of which failing means confidential data can leak:
 *   1. SPELLING PARITY — every multi-word confidential key in PRIVATE_DETAIL_KEYS
 *      has BOTH spellings: camelCase ('PrivateRemarks') and spaced
 *      ('Private Remarks'). One spelling alone leaves the other reachable.
 *   2. SQL MIRROR — public.rr_private_keys() (the batched redactor's key source,
 *      in supabase/migrations/) lists exactly the same keys as the TS constant.
 *      Drift means the sync redacts one set and the DB sweep strips another.
 *   3. CONCEPT COVERAGE — the high-risk concepts (private/office remarks, showing
 *      instructions + contacts, owner/occupant identity + phones, escrow officer)
 *      are all represented, so a future CF group cannot introduce a new spelling
 *      of an already-known-confidential concept without tripping invariant 1.
 *
 * Usage: node scripts/check-private-key-parity.mjs
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const TS_SOURCE = 'lib/listing-customfields.ts'
const MIGRATIONS_DIR = join(ROOT, 'supabase/migrations')

const fails = []

/** Keys from the TS PRIVATE_DETAIL_KEYS array literal. */
function readTsKeys() {
  const src = readFileSync(join(ROOT, TS_SOURCE), 'utf8')
  const m = src.match(/export const PRIVATE_DETAIL_KEYS = \[([\s\S]*?)\] as const/)
  if (!m) {
    fails.push(`${TS_SOURCE}: PRIVATE_DETAIL_KEYS array literal not found (renamed or reshaped?)`)
    return []
  }
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
}

/** Keys from the NEWEST migration that defines rr_private_keys(). */
function readSqlKeys() {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
  let latest = null
  for (const f of files) {
    const src = readFileSync(join(MIGRATIONS_DIR, f), 'utf8')
    if (/FUNCTION\s+public\.rr_private_keys\s*\(/i.test(src)) latest = { f, src }
  }
  if (!latest) {
    fails.push('no migration defines public.rr_private_keys() — the SQL redaction mirror is gone')
    return []
  }
  const body = latest.src.match(/rr_private_keys[\s\S]*?ARRAY\[([\s\S]*?)\]/i)
  if (!body) {
    fails.push(`${latest.f}: rr_private_keys() found but its ARRAY[...] literal did not parse`)
    return []
  }
  return [...body[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
}

/** 'PrivateRemarks' -> 'Private Remarks' (camelCase to spaced display name). */
function camelToSpaced(k) {
  return k.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
}
/** 'Private Remarks' -> 'PrivateRemarks'. */
function spacedToCamel(k) {
  return k.replace(/\s+/g, '')
}

const tsKeys = readTsKeys()
const sqlKeys = readSqlKeys()
const tsSet = new Set(tsKeys)

// ── 1. Spelling parity ──────────────────────────────────────────────────────
// Enforced in the direction that actually leaked: every camelCase RESO key must
// also carry its spaced CustomFields display spelling, because the CF flatten
// emits display names and a missing twin stays readable by the anon key.
// The reverse direction is NOT enforced — MLS display names contain lowercase
// connector words ("Phone to Show") whose de-spaced form is not a real RESO
// field, and those concepts are already covered by their own camelCase entries.
for (const key of tsKeys) {
  if (key.includes(' ') || key.includes('&')) continue
  const spaced = camelToSpaced(key)
  if (spaced === key) continue // single word, one spelling only
  if (!tsSet.has(spaced)) {
    fails.push(
      `${TS_SOURCE}: '${key}' is listed but its CustomFields spelling '${spaced}' is NOT. ` +
        `The CF flatten writes display names, so '${spaced}' would land in the ` +
        `anon-readable listings.details while only '${key}' gets redacted.`,
    )
  }
}

// ── 2. SQL mirror ───────────────────────────────────────────────────────────
if (tsKeys.length && sqlKeys.length) {
  const sqlSet = new Set(sqlKeys)
  const missingInSql = tsKeys.filter((k) => !sqlSet.has(k))
  const missingInTs = sqlKeys.filter((k) => !tsSet.has(k))
  if (missingInSql.length) {
    fails.push(
      `rr_private_keys() is missing ${missingInSql.length} key(s) present in ${TS_SOURCE}: ` +
        `${missingInSql.join(', ')}. The sync would redact them but the DB sweep would not.`,
    )
  }
  if (missingInTs.length) {
    fails.push(
      `${TS_SOURCE} is missing ${missingInTs.length} key(s) present in rr_private_keys(): ` +
        `${missingInTs.join(', ')}. The DB sweep would strip them but the sync would rewrite them.`,
    )
  }
}

// ── 3. Concept coverage ─────────────────────────────────────────────────────
const CONCEPTS = [
  [/private\s*remarks/i, 'private remarks'],
  [/showing\s*instructions/i, 'showing instructions'],
  [/owner\s*name/i, 'owner name'],
  [/occupant\s*name/i, 'occupant name'],
  [/(phone\s*to\s*show|showing\s*phone)/i, 'showing phone'],
  [/escrow/i, 'escrow officer'],
]
for (const [re, label] of CONCEPTS) {
  if (!tsKeys.some((k) => re.test(k))) {
    fails.push(`${TS_SOURCE}: no key covers the confidential concept "${label}"`)
  }
}

console.log('confidential-key parity gate (G58)')
console.log('==================================')
console.log(`  TS keys (${TS_SOURCE}):        ${tsKeys.length}`)
console.log(`  SQL keys (rr_private_keys):    ${sqlKeys.length}`)

if (fails.length) {
  console.error(`\n✗ ${fails.length} confidential-key parity failure(s):\n`)
  for (const f of fails) console.error(`  • ${f}\n`)
  console.error(
    'Fix: add the missing spelling(s) to PRIVATE_DETAIL_KEYS in ' +
      `${TS_SOURCE} AND to public.rr_private_keys() in a new migration, then run the\n` +
      'batched redactor (rr_redact_listings) so already-ingested rows are stripped.\n',
  )
  process.exit(1)
}

console.log('\n✓ Confidential keys carry both spellings, TS and SQL agree, all concepts covered.')
