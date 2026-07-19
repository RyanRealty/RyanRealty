#!/usr/bin/env node
/**
 * check-cron-auth.mjs (ci:cron-auth) — one fail-closed guard for every cron route.
 *
 * lib/auth/cron-auth.ts exports requireCronAuth(req), a Web-standard Response |
 * null guard built on the unit-tested, fail-CLOSED isValidCronAuth() (an unset
 * CRON_SECRET always returns unauthorized — see lib/auth/cron-auth.test.ts).
 * Before the 2026-07-18 consolidation, ~28 cron routes each carried their own
 * local `function isAuthorized(request)` copy — most of them fail-OPEN in
 * non-production (`if (!secret) return !isProd`), plus 3 routes that compared
 * against a literal `Bearer ${process.env.CRON_SECRET}` template (authenticates
 * a literal "Bearer undefined" when the secret is unset), plus assorted other
 * bespoke checks (lib/marketing-brain/snapshot.ts's isAuthorizedCron, the retired
 * lib/require-secret.ts's requireSecret — also fail-open in non-prod). Every
 * cron route now imports requireCronAuth and calls it first in its handler.
 *
 * This gate is zero-tolerance (no ratchet/baseline): it fails on ANY match of
 * the retired patterns, or any route that reads process.env.CRON_SECRET without
 * importing the canonical guard. Comments are stripped before scanning so a
 * doc header that merely mentions "Bearer ${CRON_SECRET}" in prose can't trip it.
 *
 * Excluded by design (owned by the sync workstream, not this gate):
 *   app/api/cron/sync-delta/route.ts
 *   app/api/cron/sync-full/route.ts
 *
 * CLI: default pass/fail. Prints one line per violation, then an OK summary
 * with the scanned route count on success.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const ROOT = process.cwd()
const CRON_DIR = join(ROOT, 'app/api/cron')

// Owned by another workstream — never touched by the cron-auth consolidation.
const EXCLUDED = new Set([
  'app/api/cron/sync-delta/route.ts',
  'app/api/cron/sync-full/route.ts',
])

const CANONICAL_IMPORT = 'requireCronAuth'
const CANONICAL_IMPORT_PATH = '@/lib/auth/cron-auth'

function normalize(p) {
  return p.split(sep).join('/')
}

/** Recursively find every route.ts under `dir`. */
function* walk(dir) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      yield* walk(full)
    } else if (entry.isFile() && entry.name === 'route.ts') {
      yield full
    }
  }
}

/**
 * Strip `/* ... *\/` block comments and `// ...` line comments from `src`,
 * replacing stripped characters with spaces (never newlines removed) so line
 * numbers in reported violations still line up with the original file.
 * Respects single/double-quoted strings and template literals (including
 * `${...}` interpolations) so a `//` inside a URL string or a `/* ` inside a
 * template literal is never mistaken for a comment. Deliberately does not
 * bother re-entering template interpolation "code mode" for nested
 * comments — cron routes don't nest comments inside `${}`.
 */
function stripComments(src) {
  const out = []
  let i = 0
  const n = src.length
  let inLine = false
  let inBlock = false
  let inS = false
  let inD = false
  let inTmpl = false

  while (i < n) {
    const c = src[i]
    const c2 = i + 1 < n ? src[i + 1] : ''

    if (inLine) {
      if (c === '\n') { inLine = false; out.push(c) } else { out.push(' ') }
      i += 1
      continue
    }
    if (inBlock) {
      if (c === '*' && c2 === '/') { inBlock = false; out.push('  '); i += 2; continue }
      out.push(c === '\n' ? '\n' : ' ')
      i += 1
      continue
    }
    if (inS) {
      out.push(c)
      if (c === '\\') { out.push(c2); i += 2; continue }
      if (c === "'") inS = false
      i += 1
      continue
    }
    if (inD) {
      out.push(c)
      if (c === '\\') { out.push(c2); i += 2; continue }
      if (c === '"') inD = false
      i += 1
      continue
    }
    if (inTmpl) {
      out.push(c)
      if (c === '\\') { out.push(c2); i += 2; continue }
      if (c === '`') inTmpl = false
      i += 1
      continue
    }

    if (c === '/' && c2 === '/') { inLine = true; out.push('  '); i += 2; continue }
    if (c === '/' && c2 === '*') { inBlock = true; out.push('  '); i += 2; continue }
    if (c === "'") { inS = true; out.push(c); i += 1; continue }
    if (c === '"') { inD = true; out.push(c); i += 1; continue }
    if (c === '`') { inTmpl = true; out.push(c); i += 1; continue }

    out.push(c)
    i += 1
  }
  return out.join('')
}

function lineOf(cleaned, index) {
  return cleaned.slice(0, index).split('\n').length
}

/** Scan one route.ts's cleaned (comment-stripped) source for violations. */
function scanFile(relPath, cleaned) {
  const violations = []

  // 1. Inline `Bearer ${...CRON_SECRET...}` template compare — the exact bug
  //    class that authenticates a literal "Bearer undefined" when the secret
  //    is unset (performance-pull-30d/7d/48h, pre-fix).
  const bearerRe = /Bearer\s*\$\{[^}]*CRON_SECRET[^}]*\}/g
  for (const m of cleaned.matchAll(bearerRe)) {
    violations.push({
      line: lineOf(cleaned, m.index),
      rule: 'inline-bearer-compare',
      detail: `inline \`${m[0]}\` template — use requireCronAuth(request) instead`,
    })
  }

  // 2. A route-local `function isAuthorized(...)` re-implementation.
  const localFnRe = /function\s+isAuthorized\s*\(/g
  for (const m of cleaned.matchAll(localFnRe)) {
    violations.push({
      line: lineOf(cleaned, m.index),
      rule: 'local-isAuthorized-fn',
      detail: 'local function isAuthorized(...) — delete it and call requireCronAuth(request)',
    })
  }

  // 3. Calls into the two retired shared-but-non-canonical guards. Both are
  //    fail-open in non-production (`if (!secret) return !isProd` /
  //    `if (!secret) { if (isProd) return false; return true }`).
  const isAuthorizedCronRe = /\bisAuthorizedCron\s*\(/g
  for (const m of cleaned.matchAll(isAuthorizedCronRe)) {
    violations.push({
      line: lineOf(cleaned, m.index),
      rule: 'retired-isAuthorizedCron',
      detail: 'isAuthorizedCron(...) (lib/marketing-brain/snapshot.ts) — switch to requireCronAuth(request)',
    })
  }
  const requireSecretRe = /\brequireSecret\s*\(/g
  for (const m of cleaned.matchAll(requireSecretRe)) {
    violations.push({
      line: lineOf(cleaned, m.index),
      rule: 'retired-requireSecret',
      detail: 'requireSecret(...) is fail-open in non-production — switch to requireCronAuth(request)',
    })
  }

  // 4. isValidCronAuth used directly instead of through the requireCronAuth
  //    wrapper. isValidCronAuth itself is fail-closed, but every route should
  //    converge on the ONE guard so the 401 shape and header precedence never
  //    diverge again.
  const directValidRe = /\bisValidCronAuth\s*\(/g
  for (const m of cleaned.matchAll(directValidRe)) {
    violations.push({
      line: lineOf(cleaned, m.index),
      rule: 'direct-isValidCronAuth',
      detail: 'isValidCronAuth(...) called directly — call the requireCronAuth(request) wrapper instead',
    })
  }

  // 5. Catch-all: reads process.env.CRON_SECRET but never imports the
  //    canonical guard — a bespoke check this gate doesn't otherwise
  //    recognize by name.
  const readsSecret = /process\.env\.CRON_SECRET\b/.test(cleaned)
  const importsGuard =
    cleaned.includes(CANONICAL_IMPORT) && cleaned.includes(CANONICAL_IMPORT_PATH)
  if (readsSecret && !importsGuard) {
    violations.push({
      line: lineOf(cleaned, cleaned.indexOf('process.env.CRON_SECRET')),
      rule: 'unguarded-cron-secret-read',
      detail: `reads process.env.CRON_SECRET without importing ${CANONICAL_IMPORT} from '${CANONICAL_IMPORT_PATH}'`,
    })
  }

  return violations
}

function main() {
  const files = [...walk(CRON_DIR)]
    .map((abs) => normalize(relative(ROOT, abs)))
    .filter((rel) => !EXCLUDED.has(rel))
    .sort()

  if (files.length === 0) {
    console.error('✗ cron-auth gate: found zero route.ts files under app/api/cron — scan path likely broken')
    process.exit(1)
  }

  let violationCount = 0
  const byFile = []

  for (const rel of files) {
    const abs = join(ROOT, rel)
    let src
    try {
      src = readFileSync(abs, 'utf8')
    } catch {
      continue
    }
    const cleaned = stripComments(src)
    const violations = scanFile(rel, cleaned)
    if (violations.length > 0) {
      byFile.push({ file: rel, violations })
      violationCount += violations.length
    }
  }

  console.log('cron-auth gate (ci:cron-auth)')
  console.log('==============================')

  if (violationCount > 0) {
    console.error(`✗ ${violationCount} cron-auth violation(s) across ${byFile.length} file(s):\n`)
    for (const { file, violations } of byFile) {
      for (const v of violations) {
        console.error(`  ${file}:${v.line} [${v.rule}] ${v.detail}`)
      }
    }
    console.error('')
    console.error('Every app/api/cron/**/route.ts (except sync-delta and sync-full) must gate')
    console.error('its handler with:')
    console.error("    const denied = requireCronAuth(request)")
    console.error('    if (denied) return denied')
    console.error("  import { requireCronAuth } from '@/lib/auth/cron-auth'")
    process.exit(1)
  }

  console.log(`OK — ${files.length} cron routes all gate through requireCronAuth (lib/auth/cron-auth.ts). 0 violations.`)
  process.exit(0)
}

main()
