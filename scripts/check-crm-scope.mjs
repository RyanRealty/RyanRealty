#!/usr/bin/env node
/**
 * check-crm-scope.mjs — CI gate: every person-scoped CRM mutation must carry a
 * broker-ownership scope check, not just a session check.
 *
 * WHY THIS EXISTS
 * ---------------
 * The CRM RBAC policy (lib/crm/scope.ts, Option A) is: Matt (superuser) sees
 * every broker's contacts; Rebecca and Paul are scoped to their own
 * assigned_broker. That policy is only real if EVERY mutation keyed by a
 * caller-supplied person id verifies ownership before writing.
 *
 * On 2026-07-02 the person-detail action file was split into three
 * (crm-person-detail / crm-person-files / crm-person-gaps). The split carried
 * the session check (getCrmAccess) but dropped the ownership guard
 * (requirePersonInScope) their siblings use — opening ~18 IDOR holes where any
 * logged-in broker could read/edit/delete/merge another broker's contacts by
 * guessing a sequential id. Prose ("remember to scope-check") did not catch it.
 * A mechanical gate does.
 *
 * THE RULE
 * --------
 * For each exported async server action in app/actions/crm*.ts: if its body
 * performs a WRITE (.insert/.update/.delete/.upsert) against a person-scoped
 * table, the body must also contain a recognized authorization guard
 * (requirePersonInScope, a superuser-only check, scopeBroker filtering, or one
 * of the per-entity scope guards). A write with only getCrmAccess/
 * requireCrmAccess (session, not ownership) is a violation.
 *
 * Legitimately-exempt actions (e.g. a write whose id is derived from a scoped
 * read the static check can't follow) go in scripts/crm-scope-baseline.json
 * with a reason. The baseline count may only SHRINK — a new unguarded mutation
 * fails the build.
 *
 * Usage:
 *   node scripts/check-crm-scope.mjs            # CI mode (exit 1 on new violations)
 *   node scripts/check-crm-scope.mjs --list     # print every scanned action + verdict
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ACTIONS_DIR = join(ROOT, 'app', 'actions')
const BASELINE_PATH = join(ROOT, 'scripts', 'crm-scope-baseline.json')

/** Tables keyed by a caller-supplied person id — a write here needs ownership. */
const SCOPED_TABLES = [
  'crm_people',
  'crm_timeline',
  'crm_contact_points',
  'crm_person_files',
  'crm_people_collaborators',
  'crm_relationships',
]

/** Write methods on the Supabase builder. */
const WRITE_METHODS = ['.insert(', '.update(', '.delete(', '.upsert(']

/**
 * Tokens that PROVE an ownership/authorization decision happened in the body.
 * NOTE: getCrmAccess / requireCrmAccess are deliberately NOT here — they only
 * authenticate the session; they do not check WHICH contact the caller may touch.
 */
const GUARD_TOKENS = [
  'requirePersonInScope',
  'requireTaskAccess',
  'requireDealInScope',
  'requireMembershipInScope',
  'requirePondInScope',
  'canActOnTask',
  'canEditView',
  'scopeBroker(',
  "!== 'superuser'",
  "=== 'superuser'",
  'requireSuperuser',
  'requireOwner', // crm-suppressions: superuser-only owner gate
]

function listCrmActionFiles() {
  return readdirSync(ACTIONS_DIR)
    .filter((f) => /^crm.*\.ts$/.test(f) && !f.endsWith('.test.ts') && !f.endsWith('.d.ts'))
    .map((f) => join(ACTIONS_DIR, f))
}

/** Extract exported async functions as { name, body } by brace-matching. */
function extractExportedActions(src) {
  const out = []
  const re = /export\s+async\s+function\s+([A-Za-z0-9_]+)\s*\(/g
  let m
  while ((m = re.exec(src)) !== null) {
    const name = m[1]
    // Walk from the "(" to find the matching ")" then the function body "{...}".
    let i = re.lastIndex - 1
    let depth = 0
    // skip the parameter list
    for (; i < src.length; i++) {
      if (src[i] === '(') depth++
      else if (src[i] === ')') {
        depth--
        if (depth === 0) { i++; break }
      }
    }
    // find the opening brace of the body
    const braceStart = src.indexOf('{', i)
    if (braceStart === -1) continue
    let bd = 0
    let j = braceStart
    for (; j < src.length; j++) {
      if (src[j] === '{') bd++
      else if (src[j] === '}') {
        bd--
        if (bd === 0) { j++; break }
      }
    }
    out.push({ name, body: src.slice(braceStart, j) })
  }
  return out
}

const WRITE_NAMES = new Set(['insert', 'update', 'delete', 'upsert'])

/**
 * Walk the method chain that starts at `.from('<table>')` and return the set of
 * method names called ON THAT chain — precisely, not by a character window. From
 * the ")" that closes `.from(...)`, repeatedly consume `.method( …balanced… )`
 * segments until the chain ends. This is what distinguishes a scoped READ
 * (`.from('crm_people').select(...).eq(...)`) from a scoped WRITE
 * (`.from('crm_people').update(...).eq(...)`) without bleeding into the next
 * statement (the bug a fixed-size window has).
 */
function chainMethodsFrom(body, afterFromIdx) {
  const methods = []
  let i = afterFromIdx // index just AFTER the ")" closing .from(...)
  for (;;) {
    // skip whitespace between chain links
    while (i < body.length && /\s/.test(body[i])) i++
    if (body[i] !== '.') break
    const mm = /^\.([a-zA-Z_]+)\s*\(/.exec(body.slice(i))
    if (!mm) break
    methods.push(mm[1])
    // advance to the "(" and balance parens
    let k = i + mm[0].length - 1 // at "("
    let depth = 0
    for (; k < body.length; k++) {
      if (body[k] === '(') depth++
      else if (body[k] === ')') {
        depth--
        if (depth === 0) { k++; break }
      }
    }
    i = k
  }
  return methods
}

/** True when a WRITE method is called on a person-scoped table's own chain. */
function bodyHasScopedWrite(body) {
  for (const t of SCOPED_TABLES) {
    const re = new RegExp(`\\.from\\(\\s*['"]${t}['"]\\s*\\)`, 'g')
    let m
    while ((m = re.exec(body)) !== null) {
      const methods = chainMethodsFrom(body, re.lastIndex)
      if (methods.some((name) => WRITE_NAMES.has(name))) return true
    }
  }
  return false
}

function bodyHasGuard(body) {
  return GUARD_TOKENS.some((g) => body.includes(g))
}

function main() {
  const list = process.argv.includes('--list')
  const baseline = existsSync(BASELINE_PATH)
    ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
    : { allow: [] }
  const allow = new Set((baseline.allow ?? []).map((e) => e.key))

  const violations = []
  const scanned = []

  for (const file of listCrmActionFiles()) {
    const rel = file.slice(ROOT.length + 1)
    const src = readFileSync(file, 'utf8')
    for (const { name, body } of extractExportedActions(src)) {
      if (!bodyHasScopedWrite(body)) continue
      const key = `${rel}::${name}`
      const guarded = bodyHasGuard(body)
      scanned.push({ key, guarded })
      if (!guarded && !allow.has(key)) violations.push(key)
    }
  }

  if (list) {
    for (const s of scanned.sort((a, b) => a.key.localeCompare(b.key))) {
      console.log(`${s.guarded ? '✓' : '✗'} ${s.key}${allow.has(s.key) ? '  (baselined)' : ''}`)
    }
    console.log(`\n${scanned.length} person-scoped mutations scanned, ${scanned.filter((s) => s.guarded).length} guarded, ${allow.size} baselined.`)
  }

  // Stale-baseline check: an allow entry that no longer needs it should be removed.
  const stale = [...allow].filter((k) => {
    const s = scanned.find((x) => x.key === k)
    return s && s.guarded
  })
  if (stale.length) {
    console.warn(`ℹ crm-scope: ${stale.length} baseline entr${stale.length === 1 ? 'y is' : 'ies are'} now guarded — remove from crm-scope-baseline.json:`)
    for (const k of stale) console.warn(`    ${k}`)
  }

  if (violations.length) {
    console.error(`\n✗ crm-scope: ${violations.length} person-scoped CRM mutation(s) write without a broker-ownership guard.`)
    console.error('  Each writes a person-scoped table but the action body has no requirePersonInScope /')
    console.error('  superuser / scopeBroker check — only a session check. A restricted broker could act')
    console.error('  on another broker\'s contact by id (IDOR). Add the guard, or baseline with a reason.\n')
    for (const v of violations) console.error(`    ${v}`)
    console.error('\n  Fix: `const scope = await requirePersonInScope(personId, access); if (!scope.ok) return scope`')
    console.error('  Baseline (only if genuinely safe): add { "key": "<file>::<fn>", "reason": "..." } to scripts/crm-scope-baseline.json\n')
    process.exit(1)
  }

  console.log(`✓ crm-scope: ${scanned.length} person-scoped CRM mutations all carry an ownership guard (${allow.size} baselined).`)
}

main()
