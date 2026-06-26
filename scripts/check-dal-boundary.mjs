#!/usr/bin/env node
/**
 * check-dal-boundary.mjs
 *
 * Enforces the Data Access Layer boundary: only files inside lib/data/ may call
 * supabase.from('<table>') for the canonical domain tables. Every page,
 * component, action, or script outside lib/data/ must import from @/lib/data/.
 *
 * Modes:
 *   node scripts/check-dal-boundary.mjs                 → check against baseline, exit 1 if violations INCREASED
 *   node scripts/check-dal-boundary.mjs --write-baseline → snapshot current state to scripts/dal-boundary-baseline.json
 *   node scripts/check-dal-boundary.mjs --report         → human-readable report, never exits 1
 *
 * Ratchet behavior: as Wave 1-3 migrates pages to the DAL, the baseline drops.
 * Once it hits 0, eslint.config.mjs flips the rule from `warn` to `error` and
 * this script becomes pure regression insurance.
 *
 * See docs/DATA_ACCESS_LAYER.md for the contract.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, realpathSync } from 'node:fs'
import { join, relative, sep, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')
const BASELINE_PATH = join(ROOT, 'scripts/dal-boundary-baseline.json')

const SCAN_DIRS = ['app', 'components', 'lib']
const ALLOWED_PREFIX = 'lib/data/'
const EXCLUDED_DIRS = new Set(['node_modules', '.next', 'out', 'build', 'dist', '__tests__'])
const FILE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs'])

// Tables that MUST go through lib/data/. Adding a table here requires a matching
// rule in eslint.config.mjs and a doc update in docs/DATA_ACCESS_LAYER.md.
//
// Gate 6 expansion (2026-06-09): blog_posts, guides, and market_reports are now
// fully covered by cached DAL readers. Consumer pages must import from @/lib/data
// — not from app/actions/blog.ts, app/actions/guides.ts, or market-reports.ts.
// Admin/write paths (saveBlogPost, saveGuide, upsertMarketReport…) remain in the
// action files and are allowed because the gate skips app/api/** and app/admin/**.
// reviews is added because getBrokerReviews DAL reader was created to cover the
// per-broker review fetch in the team page; the only remaining raw `.from('reviews')`
// call is in app/actions/agents.ts (getAgentReviews / getReviewStatsForBroker) which
// is a write-adjacent stats composite, not a consumer page direct read.
const BANNED_TABLES = [
  'listings',
  'listing_videos',
  'video_tours_cache',
  'listing_history',
  'market_stats_cache',
  'market_pulse_live',
  'engagement_metrics',
  'properties',
  'neighborhoods',
  'communities',
  'cities',
  'listing_photos',
  'listing_agents',
  'open_houses',
  'boundaries',
  'neighborhood_subdivisions',
  'subdivision_flags',
  'app_config',
  'activity_events',
  'expired_listings',
  'cmas',
  'cma_comps',
  'guest_search_alerts',
  // Wave 3 additions — DAL readers now exist for these; consumer pages must use them.
  'blog_posts',
  'guides',
  'market_reports',
]

// Tables that are BANNED for consumer-page reads but allowed in write-path
// action/API files. These tables have DAL readers for consumer use; writes and
// admin mutations legitimately live in app/actions/* or app/api/*.
//
// A file path matching any of these prefixes is allowed to call .from('<table>')
// for the listed tables. Consumer pages (app/<page>/page.tsx, components/*) that
// call these tables directly are still flagged.
const WRITE_PATH_PREFIXES = [
  // Action files own the write path for all tables (admin + user mutations).
  // Consumer pages that previously imported read functions from actions/* have
  // been repointed to @/lib/data/ as of Wave 3 (2026-06-09).
  'app/actions/',
  // API routes + crons are server-side write/mutation paths — not consumer reads.
  'app/api/',
  // Admin UI has direct table access by design (internal tool, not consumer-facing).
  'app/admin/',
  // The TC domain layer owns tc_* state-machine mutations (e.g. the envelope
  // status compare-and-swap in deal-state.ts). Server-only domain logic, never a
  // consumer page, so consumer-read protection is unaffected. Matches the target
  // architecture in docs/plans/TC_ARCHITECTURE_REVIEW.md §4.1.
  'lib/tc/',
  // The CRM domain layer (lib/crm/) owns sequence-engine runtime state-machine
  // mutations (trigger-dispatch, enrollment side-effects). Server-only, never
  // consumer-facing, same exemption pattern as lib/tc/. Added 2026-06-27 when
  // fireTrigger was extracted as a shared library callable from multiple action paths.
  'lib/crm/',
]

// Default-deny (audit p2.1): flag `.from('<table>')` for ANY lowercase snake_case
// table name outside lib/data/ (+ the write-path prefixes below). Previously this
// matched only the 26-table BANNED_TABLES denylist, so any UNLISTED table could be
// read raw from a page/component without tripping the gate. The BANNED_TABLES list
// is retained above only as the eslint-mirrored reference set. Lookbehind excludes
// `Buffer.from(` / `Array.from(` (not Supabase calls).
const FROM_REGEX = /(?<!Buffer)(?<!Array)\.from\(\s*['"`]([a-z][a-z0-9_]*)['"`]/g

// ── Part A: cached-read write classifier (audit p2.1) ────────────────────────
// A Supabase WRITE must never run on a cached-read path, because unstable_cache
// memoizes/dedupes its callback — a mutation placed there would be silently
// skipped on a cache hit (correctness bug) and is conceptually wrong (a cache is
// for pure reads). This is a ZERO-TOLERANCE invariant, NOT a ratcheted baseline:
// any hit fails the commit outright.
//
// Two statically-detectable rules (the directive's "lib/data/cache OR an
// unstable_cache callback"):
//   Rule 1 — lib/data/cache/** is read-only caching infrastructure. No write
//            call (.insert/.update/.upsert/.delete) may appear there at all.
//   Rule 2 — No write call may appear LEXICALLY inside an inline cache-wrapper
//            callback: unstable_cache(async () => { … }, …) or
//            makeResilientCached(async () => { … }, …).
//   Rule 3 (Part C, audit p2.1) — When the first arg is a NAMED function
//            reference (unstable_cache(fetchFn, …)), resolve fetchFn to its
//            declaration WITHIN THE SAME FILE (`function fetchFn(){…}` or
//            `const fetchFn = (…) => {…}`) and scan that body for writes. This is
//            ONE level of resolution only — it does not chase helper calls inside
//            the resolved body (call-graph closure), which no fetch fn needs
//            today. A reference that can't be resolved in-file (a cross-file /
//            imported fn, a function PARAMETER like makeResilientCached's own
//            `fetchFn`, or an expression-bodied arrow) is UNRESOLVED and never
//            flags — the resolver never guesses, so it can't false-positive.
const WRITE_REGEX = /\.(insert|update|upsert|delete)\s*\(/g
const CACHE_WRAPPER_FNS = ['unstable_cache', 'makeResilientCached']
const CACHE_INFRA_PREFIX = 'lib/data/cache/'

/**
 * Given the index of an opening '(' in `content`, return the index of its
 * matching ')'. Skips parens that live inside line/block comments, single/double
 * quoted strings, and template literals (including `${…}` interpolations, which
 * re-enter code mode). Returns -1 if unbalanced.
 */
function findMatchingParen(content, openIdx) {
  const n = content.length
  let depth = 0
  let i = openIdx
  // Mode stack so template `${ … }` interpolations re-enter code mode and the
  // closing `}` returns to template mode. Each frame: 'code' | 'tmpl'.
  const stack = ['code']
  // For each 'code' frame entered from a template interp, track brace depth so
  // its matching `}` pops back to 'tmpl'. -1 means "top-level code" (never pops).
  const braceDepth = [-1]
  let inLine = false
  let inBlock = false
  let inS = false
  let inD = false

  while (i < n) {
    const c = content[i]
    const c2 = i + 1 < n ? content[i + 1] : ''
    const mode = stack[stack.length - 1]

    if (inLine) { if (c === '\n') inLine = false; i += 1; continue }
    if (inBlock) { if (c === '*' && c2 === '/') { inBlock = false; i += 2; continue } i += 1; continue }
    if (inS) { if (c === '\\') { i += 2; continue } if (c === "'") inS = false; i += 1; continue }
    if (inD) { if (c === '\\') { i += 2; continue } if (c === '"') inD = false; i += 1; continue }

    if (mode === 'tmpl') {
      if (c === '\\') { i += 2; continue }
      if (c === '`') { stack.pop(); braceDepth.pop(); i += 1; continue }
      if (c === '$' && c2 === '{') { stack.push('code'); braceDepth.push(0); i += 2; continue }
      i += 1
      continue
    }

    // mode === 'code'
    if (c === '/' && c2 === '/') { inLine = true; i += 2; continue }
    if (c === '/' && c2 === '*') { inBlock = true; i += 2; continue }
    if (c === "'") { inS = true; i += 1; continue }
    if (c === '"') { inD = true; i += 1; continue }
    if (c === '`') { stack.push('tmpl'); braceDepth.push(-1); i += 1; continue }
    if (c === '{') { if (braceDepth[braceDepth.length - 1] >= 0) braceDepth[braceDepth.length - 1] += 1; i += 1; continue }
    if (c === '}') {
      const top = braceDepth.length - 1
      if (braceDepth[top] > 0) { braceDepth[top] -= 1; i += 1; continue }
      if (braceDepth[top] === 0) { stack.pop(); braceDepth.pop(); i += 1; continue } // close ${…}
      i += 1
      continue
    }
    if (c === '(') { depth += 1; i += 1; continue }
    if (c === ')') { depth -= 1; if (depth === 0) return i; i += 1; continue }
    i += 1
  }
  return -1
}

function lineOf(content, index) {
  return content.slice(0, index).split('\n').length
}

/**
 * Like findMatchingParen but matches the '{' at `openIdx` to its '}'. Handles
 * strings, comments, and template `${…}` interpolations — whose own braces (and
 * closing brace) must not be miscounted as the target block's. The BOTTOM code
 * frame owns the target brace; interpolation frames start at depth 0 and their
 * first depth-0 '}' closes the interp. Returns -1 if unbalanced.
 */
function findMatchingBrace(content, openIdx) {
  const n = content.length
  let i = openIdx
  const stack = [{ type: 'code', depth: 0 }]
  let inLine = false
  let inBlock = false
  let inS = false
  let inD = false

  while (i < n) {
    const c = content[i]
    const c2 = i + 1 < n ? content[i + 1] : ''
    const frame = stack[stack.length - 1]

    if (inLine) { if (c === '\n') inLine = false; i += 1; continue }
    if (inBlock) { if (c === '*' && c2 === '/') { inBlock = false; i += 2; continue } i += 1; continue }
    if (inS) { if (c === '\\') { i += 2; continue } if (c === "'") inS = false; i += 1; continue }
    if (inD) { if (c === '\\') { i += 2; continue } if (c === '"') inD = false; i += 1; continue }

    if (frame.type === 'tmpl') {
      if (c === '\\') { i += 2; continue }
      if (c === '`') { stack.pop(); i += 1; continue }
      if (c === '$' && c2 === '{') { stack.push({ type: 'code', depth: 0 }); i += 2; continue }
      i += 1
      continue
    }

    // code frame
    if (c === '/' && c2 === '/') { inLine = true; i += 2; continue }
    if (c === '/' && c2 === '*') { inBlock = true; i += 2; continue }
    if (c === "'") { inS = true; i += 1; continue }
    if (c === '"') { inD = true; i += 1; continue }
    if (c === '`') { stack.push({ type: 'tmpl' }); i += 1; continue }
    if (c === '{') { frame.depth += 1; i += 1; continue }
    if (c === '}') {
      if (frame.depth === 0) {
        // closes a ${…} interpolation frame (the bottom target always has
        // depth>=1 here, since openIdx's '{' was counted)
        if (stack.length > 1) stack.pop()
        i += 1
        continue
      }
      frame.depth -= 1
      if (frame.depth === 0 && stack.length === 1) return i // target matched
      i += 1
      continue
    }
    i += 1
  }
  return -1
}

/**
 * Resolve a bare identifier to a function body span { start, end } using a
 * TOP-LEVEL declaration in the SAME file: `function ident(...) {…}`, or
 * `const|let|var ident = (async) function|(…) => {…}`. Returns null (UNRESOLVED)
 * for: no in-file declaration (cross-file/imported ref, or a function PARAMETER —
 * which has no `function`/`const` declaration), an expression-bodied arrow, or a
 * non-function RHS. UNRESOLVED never flags. Fail-safe: it may under-detect on
 * exotic shapes, but it never points at the wrong span.
 */
function resolveNamedFnBody(content, ident) {
  const esc = ident.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const bodyFromParen = (fromIdx) => {
    const parenIdx = content.indexOf('(', fromIdx)
    if (parenIdx < 0) return null
    const parenClose = findMatchingParen(content, parenIdx)
    if (parenClose < 0) return null
    const braceIdx = content.indexOf('{', parenClose)
    if (braceIdx < 0) return null
    const braceClose = findMatchingBrace(content, braceIdx)
    if (braceClose < 0) return null
    return { start: braceIdx, end: braceClose }
  }

  // (a) function declaration: function ident(...) {...}
  const fnDecl = new RegExp(`\\b(?:export\\s+)?(?:async\\s+)?function\\s+${esc}\\b`).exec(content)
  if (fnDecl) return bodyFromParen(fnDecl.index)

  // (b) const/let/var ident = ...
  const varDecl = new RegExp(`\\b(?:export\\s+)?(?:const|let|var)\\s+${esc}\\s*=`).exec(content)
  if (varDecl) {
    const eqIdx = content.indexOf('=', varDecl.index)
    if (eqIdx < 0) return null
    // = (async) function (...) {...}
    if (/^\s*(?:async\s+)?function\b/.test(content.slice(eqIdx + 1))) return bodyFromParen(eqIdx)
    // = (async) (...) => {...}  — block-bodied arrow only
    const arrowIdx = content.indexOf('=>', eqIdx)
    if (arrowIdx >= 0 && arrowIdx - eqIdx < 400) {
      const after = content.slice(arrowIdx + 2).search(/\S/)
      if (after >= 0) {
        const bodyStart = arrowIdx + 2 + after
        if (content[bodyStart] === '{') {
          const braceClose = findMatchingBrace(content, bodyStart)
          if (braceClose >= 0) return { start: bodyStart, end: braceClose }
        }
      }
    }
  }
  return null
}

/**
 * Scan a single lib/data file for cached-read write violations (Rules 1, 2 & 3).
 * Returns an array of { file, line, rule, detail }. Exported for the negative
 * test in scripts/__tests__/check-dal-boundary.test.mjs.
 */
export function scanCachedWrites(relPath, content) {
  const out = []
  const resolvedSeen = new Set()

  // Rule 1: no writes anywhere under lib/data/cache/.
  if (relPath.startsWith(CACHE_INFRA_PREFIX)) {
    for (const m of content.matchAll(WRITE_REGEX)) {
      out.push({
        file: relPath,
        line: lineOf(content, m.index),
        rule: 'cache-infra-write',
        detail: `.${m[1]}( in caching infrastructure (lib/data/cache/ is read-only)`,
      })
    }
    return out
  }

  // Rule 2: no writes lexically inside an inline cache-wrapper callback.
  for (const fn of CACHE_WRAPPER_FNS) {
    const callRe = new RegExp(`\\b${fn}\\s*\\(`, 'g')
    for (const m of content.matchAll(callRe)) {
      const openParen = m.index + m[0].length - 1
      const close = findMatchingParen(content, openParen)
      if (close < 0) continue
      // Only the inline-callback form is in scope: first arg starts with a
      // function literal (`async`, `function`, or `(`/`<` arrow). A bare
      // identifier first arg is a named reference → Part C, not Part A.
      const argStart = content.slice(openParen + 1).search(/\S/)
      if (argStart < 0) continue
      const rest = content.slice(openParen + 1 + argStart)
      const isInlineFn = /^(async\b|function\b|\(|<)/.test(rest.slice(0, 12))

      if (isInlineFn) {
        // Rule 2: write lexically inside the inline callback span.
        const span = content.slice(openParen, close + 1)
        for (const w of span.matchAll(WRITE_REGEX)) {
          out.push({
            file: relPath,
            line: lineOf(content, openParen + w.index),
            rule: 'write-in-cache-callback',
            detail: `.${w[1]}( inside an inline ${fn}() callback`,
          })
        }
        continue
      }

      // Rule 3 (Part C): bare-identifier first arg → resolve the named fetch fn
      // within this file and scan its body. The trailing comma distinguishes a
      // reference `unstable_cache(fetchFn, …)` from a call `someFactory(…)`.
      const idMatch = /^([A-Za-z_$][\w$]*)\s*,/.exec(rest)
      if (!idMatch) continue
      const ident = idMatch[1]
      if (resolvedSeen.has(ident)) continue
      const body = resolveNamedFnBody(content, ident)
      if (!body) continue // UNRESOLVED → never flag
      resolvedSeen.add(ident)
      const bodyText = content.slice(body.start, body.end + 1)
      for (const w of bodyText.matchAll(WRITE_REGEX)) {
        out.push({
          file: relPath,
          line: lineOf(content, body.start + w.index),
          rule: 'write-in-named-cache-fn',
          detail: `.${w[1]}( inside named fetch fn ${ident}() referenced by ${fn}()`,
        })
      }
    }
  }
  return out
}

function scanAllCachedWrites() {
  const out = []
  const absDir = join(ROOT, 'lib/data')
  if (!existsSync(absDir)) return out
  for (const file of walk(absDir)) {
    const relPath = normalize(relative(ROOT, file))
    if (relPath.includes('/__tests__/') || relPath.endsWith('.test.ts') || relPath.endsWith('.test.tsx')) continue
    let content
    try {
      content = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    out.push(...scanCachedWrites(relPath, content))
  }
  return out
}

function normalize(p) {
  return p.split(sep).join('/')
}

function shouldSkip(relPath) {
  const norm = normalize(relPath)
  // Skip files inside lib/data/ — they're allowed.
  if (norm.startsWith(ALLOWED_PREFIX)) return true
  // Skip test files.
  if (norm.includes('/__tests__/') || norm.endsWith('.test.ts') || norm.endsWith('.test.tsx')) return true
  // Skip migration files (they reference table names in SQL strings, not Supabase client calls).
  if (norm.includes('supabase/migrations/')) return true
  // Skip write-path zones (actions, API routes, admin UI).
  for (const prefix of WRITE_PATH_PREFIXES) {
    if (norm.startsWith(prefix)) return true
  }
  return false
}

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
      if (EXCLUDED_DIRS.has(entry.name)) continue
      yield* walk(full)
    } else if (entry.isFile()) {
      const ext = entry.name.slice(entry.name.lastIndexOf('.'))
      if (FILE_EXTS.has(ext)) yield full
    }
  }
}

function scanFile(absPath) {
  const relPath = normalize(relative(ROOT, absPath))
  if (shouldSkip(relPath)) return null

  let content
  try {
    content = readFileSync(absPath, 'utf8')
  } catch {
    return null
  }

  const matches = [...content.matchAll(FROM_REGEX)]
  if (matches.length === 0) return null

  const violations = matches.map((m) => {
    const lineNum = content.slice(0, m.index).split('\n').length
    return { table: m[1], line: lineNum }
  })

  return { file: relPath, count: matches.length, violations }
}

function scanAll() {
  const results = []
  for (const dir of SCAN_DIRS) {
    const absDir = join(ROOT, dir)
    if (!existsSync(absDir)) continue
    for (const file of walk(absDir)) {
      const r = scanFile(file)
      if (r) results.push(r)
    }
  }
  results.sort((a, b) => b.count - a.count)
  return results
}

function summarize(results) {
  const total = results.reduce((s, r) => s + r.count, 0)
  const byFile = Object.fromEntries(results.map((r) => [r.file, r.count]))
  return { total, byFile }
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return null
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  } catch {
    return null
  }
}

function main() {
  const args = process.argv.slice(2)
  const writeBaseline = args.includes('--write-baseline')
  const reportOnly = args.includes('--report')

  const results = scanAll()
  const summary = summarize(results)

  // Part A invariant — runs in EVERY mode, never ratcheted. A write on a cached
  // read path is always a bug, so it hard-fails even during --write-baseline /
  // --report (those exit before the ratchet, so we surface it explicitly here).
  const cachedWriteViolations = scanAllCachedWrites()
  const reportCachedWrites = () => {
    if (cachedWriteViolations.length === 0) return
    console.error(`✗ DAL cached-read write violation(s): ${cachedWriteViolations.length}`)
    console.error('  A Supabase write (.insert/.update/.upsert/.delete) must never run on a cached-read path.')
    for (const v of cachedWriteViolations) {
      console.error(`  ${v.file}:${v.line} — ${v.detail}`)
    }
    console.error('  See docs/DATA_ACCESS_LAYER.md. Move the mutation out of the cache wrapper / lib/data/cache/.')
  }

  if (writeBaseline) {
    writeFileSync(
      BASELINE_PATH,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          total: summary.total,
          byFile: summary.byFile,
          note: 'Generated by scripts/check-dal-boundary.mjs --write-baseline. Total must monotonically decrease toward 0 as Wave 1-3 migrates pages to lib/data/.',
        },
        null,
        2
      ) + '\n'
    )
    console.log(`✓ Baseline written: ${summary.total} violations across ${results.length} files.`)
    console.log(`  → ${BASELINE_PATH}`)
    reportCachedWrites() // surface invariant breaches, but baseline write itself is not blocked
    process.exit(0)
  }

  if (reportOnly) {
    console.log(`DAL boundary scan — ${summary.total} violations across ${results.length} files\n`)
    for (const r of results.slice(0, 30)) {
      console.log(`  ${r.count.toString().padStart(4)} ${r.file}`)
    }
    if (results.length > 30) console.log(`  ... and ${results.length - 30} more files`)
    console.log('')
    if (cachedWriteViolations.length === 0) {
      console.log('✓ Cached-read write classifier: 0 violations (no writes on any cached path)')
    } else {
      reportCachedWrites()
    }
    process.exit(0)
  }

  // Part A hard invariant: a write on a cached-read path fails the commit
  // outright (zero-tolerance, ahead of the ratcheted boundary check below).
  if (cachedWriteViolations.length > 0) {
    reportCachedWrites()
    process.exit(1)
  }

  // Default mode: ratchet check against baseline.
  const baseline = loadBaseline()
  if (!baseline) {
    console.error('✗ No baseline found at scripts/dal-boundary-baseline.json')
    console.error('  Run: node scripts/check-dal-boundary.mjs --write-baseline')
    process.exit(2)
  }

  if (summary.total > baseline.total) {
    console.error(`✗ DAL boundary regression: ${summary.total} violations vs baseline ${baseline.total}`)
    console.error('')
    console.error('Files with new violations vs baseline:')
    for (const r of results) {
      const baselineCount = baseline.byFile[r.file] ?? 0
      if (r.count > baselineCount) {
        console.error(`  ${r.file}: ${r.count} (baseline: ${baselineCount}) — +${r.count - baselineCount}`)
        for (const v of r.violations.slice(0, 5)) {
          console.error(`    line ${v.line}: .from('${v.table}')`)
        }
      }
    }
    console.error('')
    console.error('See docs/DATA_ACCESS_LAYER.md. New code must import from @/lib/data/.')
    process.exit(1)
  }

  if (summary.total < baseline.total) {
    console.log(`✓ DAL boundary improved: ${summary.total} violations vs baseline ${baseline.total} (−${baseline.total - summary.total})`)
    console.log('  Consider updating baseline: node scripts/check-dal-boundary.mjs --write-baseline')
  } else {
    console.log(`✓ DAL boundary stable: ${summary.total} violations (= baseline)`)
  }
  process.exit(0)
}

// Run only when invoked directly (`node scripts/check-dal-boundary.mjs`), so the
// negative test can import scanCachedWrites without triggering main()/exit.
const invokedDirectly = (() => {
  try {
    return Boolean(process.argv[1]) && realpathSync(resolve(process.argv[1])) === __filename
  } catch {
    return false
  }
})()
if (invokedDirectly) main()
