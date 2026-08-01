#!/usr/bin/env node
/**
 * G60 — confidential-key parity (TS redaction set <-> SQL mirror <-> both spellings).
 * (Renumbered from G58 per docs/MECHANICAL_GATES.md, which is authoritative.)
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
 *   4. NO PROVENANCE-ONLY REDACTION — every key the SQL side strips
 *      unconditionally must also be stripped unconditionally BY KEY on the TS
 *      side. Added after the 2026-07-31 leak (below); this is invariant 2
 *      widened past PRIVATE_DETAIL_KEYS to the full TS redaction set.
 *   5. DISJOINT CARVE-OUT — PUBLIC_MEMBERS_IN_CONFIDENTIAL_GROUPS may not name
 *      a key that the redaction set strips, or the two rules cancel.
 *
 * WHY 4 AND 5 EXIST (incident 2026-07-31): the fix for the Showing Requirements
 * member leak redacted those members by GROUP at flatten time. Group scoping is
 * PROVENANCE-based and the flattened namespace is not partitioned by
 * provenance, so the same label can arrive a second time from a group that is
 * not confidential — and that copy lands in the public half under the identical
 * key. Live census over 800 on-market listings: 'Call Listing Agent' appears in
 * 'Showing Requirements' (576) AND in 'Existing Lease Type' (1). The lease copy
 * was written to the anon-readable listings.details on ListNumber 220226199 and
 * was readable with the PUBLIC ANON KEY.
 *
 * The old gate could not see it: rr_private_keys() named all 16 member keys
 * while the TS side named none of them, and invariant 2 compared the SQL list
 * against PRIVATE_DETAIL_KEYS alone. A TS constant that only feeds a
 * group-conditional branch is not redaction the gate can verify. Invariant 4
 * makes "SQL strips it unconditionally, TS strips it only sometimes" a build
 * failure.
 *
 * Usage: node scripts/check-private-key-parity.mjs
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const TS_SOURCE = 'lib/listing-customfields.ts'
const MIGRATIONS_DIR = join(ROOT, 'supabase/migrations')

const fails = []

const TS_SRC = readFileSync(join(ROOT, TS_SOURCE), 'utf8')

/** String literals from a `export const <NAME> = [...] as const` array in the TS source. */
function readTsArray(name, { required = true } = {}) {
  const m = TS_SRC.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const`))
  if (!m) {
    if (required) {
      fails.push(`${TS_SOURCE}: ${name} array literal not found (renamed or reshaped?)`)
    }
    return []
  }
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
}

/** Keys from the TS PRIVATE_DETAIL_KEYS array literal. */
function readTsKeys() {
  return readTsArray('PRIVATE_DETAIL_KEYS')
}

/** Members of a `new Set([...])` const in the TS source. */
function readTsSet(name) {
  const m = TS_SRC.match(new RegExp(`export const ${name}[^=]*= new Set\\(\\[([\\s\\S]*?)\\]\\)`))
  if (!m) {
    fails.push(`${TS_SOURCE}: ${name} Set literal not found (renamed or reshaped?)`)
    return []
  }
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
}

/** Keys from a named SQL function's ARRAY[...] literal in the newest migration defining it. */
function readSqlArray(fnName) {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()
  let latest = null
  for (const f of files) {
    const src = readFileSync(join(MIGRATIONS_DIR, f), 'utf8')
    if (new RegExp(`FUNCTION\\s+public\\.${fnName}\\s*\\(`, 'i').test(src)) latest = { f, src }
  }
  if (!latest) {
    fails.push(`no migration defines public.${fnName}() — the SQL redaction mirror is gone`)
    return []
  }
  const body = latest.src.match(new RegExp(`${fnName}[\\s\\S]*?ARRAY\\[([\\s\\S]*?)\\]`, 'i'))
  if (!body) {
    fails.push(`${latest.f}: ${fnName}() found but its ARRAY[...] literal did not parse`)
    return []
  }
  return [...body[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
}

/**
 * Keys from the SQL mirror. rr_private_keys() is COMPOSED
 * (rr_private_keys_base() || rr_showing_member_keys()), so read both parts and
 * concatenate the way the SQL does.
 *
 * The pre-2026-07-31 version of this function matched the first ARRAY[...]
 * after the literal text "rr_private_keys" — which, once the composition
 * landed, silently latched onto rr_private_keys_BASE and compared TS against
 * the 43 base keys only. The 16 member keys were invisible to the gate. Read
 * each function by name so a future composition change fails loudly instead.
 */
function readSqlKeys() {
  return [...readSqlArray('rr_private_keys_base'), ...readSqlArray('rr_showing_member_keys')]
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
const tsMemberKeys = readTsArray('CONFIDENTIAL_CF_MEMBER_KEYS')
const sqlKeys = readSqlKeys()
const sqlMemberKeys = readSqlArray('rr_showing_member_keys')
const publicCarveOuts = readTsSet('PUBLIC_MEMBERS_IN_CONFIDENTIAL_GROUPS')
const tsSet = new Set(tsKeys)
/** Everything the TS side strips UNCONDITIONALLY, by key, whatever the provenance. */
const tsRedacted = [...tsKeys, ...tsMemberKeys]
const tsRedactedSet = new Set(tsRedacted)

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

// ── 2 + 4. SQL mirror, compared against the FULL unconditional TS redaction set ──
// Invariant 4 is this comparison's whole point: the TS side of the equality is
// tsKeys ∪ CONFIDENTIAL_CF_MEMBER_KEYS, i.e. only keys stripped BY KEY with no
// group condition attached. A key that TS redacts merely because of the group
// it arrived in does not count, because a second group can carry the same label.
if (tsRedacted.length && sqlKeys.length) {
  const sqlSet = new Set(sqlKeys)
  const missingInSql = tsRedacted.filter((k) => !sqlSet.has(k))
  const missingInTs = sqlKeys.filter((k) => !tsRedactedSet.has(k))
  if (missingInSql.length) {
    fails.push(
      `rr_private_keys() is missing ${missingInSql.length} key(s) redacted by ${TS_SOURCE}: ` +
        `${missingInSql.join(', ')}. The sync would redact them but the DB sweep would not.`,
    )
  }
  if (missingInTs.length) {
    fails.push(
      `${TS_SOURCE} does not strip ${missingInTs.length} key(s) present in rr_private_keys(): ` +
        `${missingInTs.join(', ')}. The DB sweep strips them but the sync rewrites them on the ` +
        `next ingest. Add them to PRIVATE_DETAIL_KEYS or CONFIDENTIAL_CF_MEMBER_KEYS — a ` +
        `group-conditional branch does NOT satisfy this, because the flattened CustomFields ` +
        `namespace lets the same label arrive from a group that is not confidential ` +
        `(2026-07-31: 'Call Listing Agent' via 'Existing Lease Type' leaked to the anon key).`,
    )
  }
}

// ── 4b. The member list is an exact mirror of rr_showing_member_keys() ───────
if (tsMemberKeys.length && sqlMemberKeys.length) {
  const a = [...tsMemberKeys].sort().join('|')
  const b = [...sqlMemberKeys].sort().join('|')
  if (a !== b) {
    fails.push(
      `CONFIDENTIAL_CF_MEMBER_KEYS and rr_showing_member_keys() have drifted.\n` +
        `      TS  (${tsMemberKeys.length}): ${[...tsMemberKeys].sort().join(', ')}\n` +
        `      SQL (${sqlMemberKeys.length}): ${[...sqlMemberKeys].sort().join(', ')}`,
    )
  }
}

// ── 5. The deliberate-public carve-out must be disjoint from the redaction set ──
// 'To Be Built' / 'Under Construction' are filed inside a confidential group but
// are buyer-facing facts. If one ever appears in the redaction set too, the
// carve-out is dead and we over-redact — also a defect.
for (const k of publicCarveOuts) {
  if (tsRedactedSet.has(k)) {
    fails.push(
      `'${k}' is in PUBLIC_MEMBERS_IN_CONFIDENTIAL_GROUPS AND in the unconditional redaction ` +
        `set. The unconditional strip wins, so the carve-out is dead code and real public data ` +
        `is being destroyed. Pick one.`,
    )
  }
}

// ── 6. partitionCustomFields must consult the label set, not just the group ──
// Guards against a revert to provenance-only redaction, which is what leaked.
if (!/CONFIDENTIAL_CF_MEMBER_SET\.has\(/.test(TS_SRC)) {
  fails.push(
    `${TS_SOURCE}: partitionCustomFields no longer tests the confidential member LABEL set. ` +
      `Group-scoped redaction alone is provenance-based and a second group carrying the same ` +
      `label defeats it (2026-07-31 anon-key leak).`,
  )
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

console.log('confidential-key parity gate (G60)')
console.log('==================================')
console.log(`  TS PRIVATE_DETAIL_KEYS:            ${tsKeys.length}`)
console.log(`  TS CONFIDENTIAL_CF_MEMBER_KEYS:    ${tsMemberKeys.length}`)
console.log(`  TS unconditional redaction set:    ${tsRedactedSet.size} distinct`)
console.log(`  SQL rr_private_keys():             ${new Set(sqlKeys).size} distinct`)
console.log(`  TS public carve-outs (kept):       ${publicCarveOuts.join(', ') || '(none)'}`)

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
