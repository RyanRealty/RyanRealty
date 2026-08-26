#!/usr/bin/env node
/**
 * check-reachable-exports.mjs — G55: every components/lib module must be reachable.
 *
 * The 2026-07-21 audit found finished components shipped dark — imported by
 * nothing (SmartSearch, HeroSearchOverlay, SearchSplitView). A module no file
 * imports is dead weight: it rots, drifts from the design system, and gets
 * "fixed" by agents who assume it renders somewhere. This gate makes the
 * orphaned-component class impossible to grow.
 *
 * How it works: builds an import graph over app/**, components/**, lib/**
 * (.ts/.tsx; skips .test./.spec./.d.ts, node_modules, .next, .claude), plus
 * root-level entry files (middleware.ts, instrumentation.ts, *.config.ts)
 * as extra importers. Specifiers resolve by relative path and the "@/" alias
 * (tsconfig: "@/*" -> "./*"). Every file under components/** or lib/** with
 * zero importers is an orphan.
 *
 * Entry-point exemptions (never counted as orphans):
 *   - app/** files (framework-invoked routes — not candidates to begin with)
 *   - middleware.ts, anything matching "instrumentation", *.config.*
 *   - scripts/**, supabase/**
 *   - files whose FIRST 10 lines carry the marker "reachability: entry-point"
 *     (escape hatch — put the reason on the same line)
 *
 * Ratchet semantics (same as check-cron-registered.mjs): the baseline file
 * lists the pre-gate orphan backlog, which may ONLY SHRINK. A NEW orphan
 * fails the build; cleared entries are reported so the baseline can shrink.
 *
 * CLI: default pass/fail · --report (human, exit 0) · --write-baseline ·
 *      --self-test (inject a synthetic orphan, assert the ratchet flags it)
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, dirname, resolve, relative, extname } from 'node:path'

const ROOT = process.cwd()
// scripts/** is scanned for EDGES ONLY — CANDIDATE_DIRS below keeps it out of
// the orphan set, and isExempt() exempts it a second time. Leaving it unscanned
// meant a lib module imported solely by a script had zero in-edges and read as
// dead: lib/data/loop/ship-reconcile.ts was reported an orphan while
// scripts/loop-brief.ts imported it, and loop-brief is the session-boot command
// in CLAUDE.md. A gate that tells you to delete load-bearing code is worse than
// no gate, because someone eventually obeys it.
const SCAN_DIRS = ['app', 'components', 'lib', 'scripts']
const CANDIDATE_DIRS = ['components', 'lib']
const BASELINE = 'scripts/reachable-exports-baseline.json'
const MARKER = 'reachability: entry-point'
const SKIP_DIRS = new Set(['node_modules', '.next', '.claude'])

const args = new Set(process.argv.slice(2))
const writeBaseline = args.has('--write-baseline')
const report = args.has('--report')
const selfTest = args.has('--self-test')

function toPosix(p) {
  return p.split('\\').join('/')
}

function isSourceFile(name) {
  if (!/\.tsx?$/.test(name)) return false
  if (name.endsWith('.d.ts')) return false
  if (/\.(test|spec)\.tsx?$/.test(name)) return false
  return true
}

function walk(dir, acc) {
  let entries
  try {
    entries = readdirSync(join(ROOT, dir), { withFileTypes: true })
  } catch {
    return acc
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name) || e.name.startsWith('.')) continue
      walk(join(dir, e.name), acc)
    } else if (e.isFile() && isSourceFile(e.name)) {
      acc.push(toPosix(join(dir, e.name)))
    }
  }
  return acc
}

// ---- collect files -------------------------------------------------------
const scanned = SCAN_DIRS.flatMap((d) => walk(d, []))
const rootEntries = readdirSync(ROOT, { withFileTypes: true })
  .filter((e) => e.isFile() && isSourceFile(e.name))
  .map((e) => e.name)
const importerFiles = [...scanned, ...rootEntries]
const fileSet = new Set(scanned)

// ---- extract + resolve import specifiers ---------------------------------
const SPEC_PATTERNS = [
  /^[ \t]*import\s+[^;'"]{0,600}?from\s*['"]([^'"]+)['"]/gm, // import x from '...'
  /^[ \t]*import\s*['"]([^'"]+)['"]/gm, // side-effect import '...'
  /^[ \t]*export\s+[^;'"]{0,600}?from\s*['"]([^'"]+)['"]/gm, // export ... from '...'
  /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g, // dynamic import('...')
  /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g, // require('...')
]

function resolveSpec(spec, fromFile) {
  let base
  if (spec.startsWith('@/')) base = join(ROOT, spec.slice(2))
  else if (spec.startsWith('./') || spec.startsWith('../')) base = resolve(ROOT, dirname(fromFile), spec)
  else return null // bare package specifier
  const rel = toPosix(relative(ROOT, base))
  const candidates = [rel, `${rel}.ts`, `${rel}.tsx`, `${rel}/index.ts`, `${rel}/index.tsx`]
  const ext = extname(rel)
  if (ext === '.js') candidates.push(rel.slice(0, -3) + '.ts', rel.slice(0, -3) + '.tsx')
  if (ext === '.jsx') candidates.push(rel.slice(0, -4) + '.tsx')
  for (const c of candidates) if (fileSet.has(c)) return c
  return null
}

const imported = new Set()
let aliasEdges = 0
let relativeEdges = 0
for (const file of importerFiles) {
  let content
  try {
    content = readFileSync(join(ROOT, file), 'utf8')
  } catch {
    continue
  }
  for (const re of SPEC_PATTERNS) {
    re.lastIndex = 0
    for (const m of content.matchAll(re)) {
      const target = resolveSpec(m[1], file)
      if (target && target !== file) {
        imported.add(target)
        if (m[1].startsWith('@/')) aliasEdges++
        else relativeEdges++
      }
    }
  }
}

// ---- orphan determination -------------------------------------------------
function isExempt(file) {
  const basename = file.slice(file.lastIndexOf('/') + 1)
  if (file.startsWith('app/') || file.startsWith('scripts/') || file.startsWith('supabase/')) return true
  if (basename === 'middleware.ts') return true
  if (basename.includes('instrumentation')) return true
  if (/\.config\.[^/]+$/.test(basename)) return true
  const head = readFileSync(join(ROOT, file), 'utf8').split('\n', 10).join('\n')
  return head.includes(MARKER)
}

const candidates = scanned.filter((f) => CANDIDATE_DIRS.some((d) => f.startsWith(`${d}/`)))
const violators = candidates.filter((f) => !imported.has(f) && !isExempt(f)).sort()

if (writeBaseline) {
  writeFileSync(
    BASELINE,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        reason:
          'Pre-gate backlog of components/** and lib/** modules that no file imports. ' +
          'This list may only shrink: wire the module into a surface, mark it ' +
          '"reachability: entry-point <reason>" in its first 10 lines, or delete it. ' +
          'New orphans fail the build.',
        count: violators.length,
        names: violators,
      },
      null,
      2
    ) + '\n'
  )
  console.log(`reachable-exports baseline written: ${violators.length} backlog orphans`)
  process.exit(0)
}

let baseline = { names: [] }
try {
  baseline = JSON.parse(readFileSync(BASELINE, 'utf8'))
} catch {
  console.error(`reachable-exports gate FAILED — missing ${BASELINE}. Run: npm run ci:reachable-exports:baseline`)
  process.exit(1)
}

const baseSet = new Set(baseline.names ?? [])

if (selfTest) {
  // Prove the detection path end-to-end without touching the tree:
  // (1) the graph actually resolved edges through both specifier forms,
  // (2) a synthetic orphan record injected past the graph is flagged as NEW.
  const fake = 'components/__self-test-synthetic-orphan__.tsx'
  const injected = [...violators, fake]
  const flagged = injected.filter((v) => !baseSet.has(v))
  const failures = []
  if (aliasEdges === 0) failures.push('no @/ alias edges resolved — alias resolution broken')
  if (relativeEdges === 0) failures.push('no relative edges resolved — relative resolution broken')
  if (!flagged.includes(fake)) failures.push('synthetic orphan not flagged as NEW violator — ratchet broken')
  if (failures.length > 0) {
    console.error(`reachable-exports self-test FAILED:\n  - ${failures.join('\n  - ')}`)
    process.exit(1)
  }
  console.log(
    `reachable-exports self-test passed — ${aliasEdges} alias edges, ${relativeEdges} relative edges, ` +
      `synthetic orphan ${fake} correctly flagged as NEW violator`
  )
  process.exit(0)
}

const newViolators = violators.filter((v) => !baseSet.has(v))
const cleared = (baseline.names ?? []).filter((n) => !violators.includes(n))

if (report) {
  console.log(`reachable-exports report — ${candidates.length} candidates, ${violators.length} orphans:`)
  for (const v of violators) console.log(`  ${baseSet.has(v) ? 'backlog' : 'NEW    '} ${v}`)
  if (cleared.length > 0) console.log(`cleared since baseline: ${cleared.join(', ')}`)
  process.exit(0)
}

if (newViolators.length > 0) {
  console.error(
    `reachable-exports gate FAILED — ${newViolators.length} NEW orphan module(s) nothing imports:\n` +
      newViolators.map((v) => `  ${v}`).join('\n') +
      '\nEvery components/** and lib/** module must be imported by some file. Wire it into a surface,\n' +
      `mark it "${MARKER} <reason>" in its first 10 lines, or delete it.`
  )
  process.exit(1)
}

if (cleared.length > 0) {
  console.log(
    `reachable-exports: ${cleared.length} baseline orphan(s) cleared — ` +
      `shrink the baseline with npm run ci:reachable-exports:baseline`
  )
}
console.log(
  `reachable-exports gate passed — ${candidates.length} components/lib modules: ` +
    `${candidates.length - violators.length} reachable, ${violators.length} in backlog (ratchet: shrink-only).`
)
