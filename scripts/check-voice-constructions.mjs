#!/usr/bin/env node
/**
 * check-voice-constructions.mjs — the gate for HOW a sentence is built.
 *
 * scripts/check-brand-voice.mjs catches banned WORDS. This catches banned
 * SHAPES: the coined maxim, the sentence that explains the sentence before it,
 * the clause that moralizes a fact. Matt 2026-08-05: "You constantly
 * overeditorialize. You explain things that are obvious to the reader." No
 * word list can catch that. The patterns live in scripts/voice-constructions.cjs,
 * which is the machine-readable form of VOICE.md's "Banned constructions".
 *
 * SCOPE is every surface that produces text the public reads, including the
 * marketing brain (Matt: "the marketing brain is also required to use this
 * voice, every fucking thing"):
 *   - app/ and components/ (site, LPs, error states) minus admin
 *   - lib/cma, lib/bpo, lib/pdf (client documents)
 *   - lib/email, lib/email-templates, lib/newsletter, lib/tc/signing-emails,
 *     lib/crm email + SMS builders
 *   - lib/marketing-brain and the producer build scripts (brain output)
 *   - marketing_brain_skills, social_media_skills, automation_skills — the
 *     SKILL.md recipes and prompts the brain writes FROM
 *   - data/ and lib/ content registries (city, community, events, golf)
 *
 * Modes:
 *   node scripts/check-voice-constructions.mjs                  ratchet against baseline
 *   node scripts/check-voice-constructions.mjs --report         full human report, exit 0
 *   node scripts/check-voice-constructions.mjs --worklist       JSON worklist, ranked
 *   node scripts/check-voice-constructions.mjs --write-baseline snapshot
 *   node scripts/check-voice-constructions.mjs --path <glob>    scope to one path
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const BASELINE_PATH = join(ROOT, 'scripts/voice-constructions-baseline.json')
const STATE_PATH = join(ROOT, 'scripts/voice-canon-state.json')
const require = createRequire(import.meta.url)
const { COMPILED } = require('./voice-constructions.cjs')

// WHOLE REPO (Matt 2026-08-05: "take the entire code base into account").
// Scope is everything except the exclusions below, so a directory that starts
// holding public copy is covered the day it is created, not the day someone
// remembers to add it to a list.

/** Top-level directories that never hold public copy. Each entry narrows
 *  enforcement, so each one needs a reason. */
const SKIP_TOP = new Set([
  'node_modules', '.next', '.git', 'out', 'build', 'dist', 'coverage',
  'tmp', 'scratch', 'test-results', 'playwright-report',
  'public',                 // static assets + the tracker scripts
  'supabase',               // migrations (DB copy is handled by its own pass)
  'design_system',          // mockups + previews, not shipped copy
  'docs',                   // internal documentation
])

const SKIP_DIR = new Set([
  'node_modules', '.next', 'out', 'build', 'dist', 'coverage',
  '__tests__', '__mocks__', 'fixtures',
  'admin',    // staff-only surfaces
  'ui',       // shadcn primitives, no prose
  'console',  // admin console kit
])
const EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.md', '.json'])

/**
 * Never scanned. Each exemption is a rule from the canon or a legal
 * constraint, not a convenience.
 */
const EXEMPT = [
  // The canon's own scope rule: someone else's words are never rewritten.
  'lib/testimonials.ts',
  // Legally locked strings. Changing these needs a carrier re-filing or legal
  // sign-off, not a voice pass.
  'lib/crm/sms-consent-text.ts',
  'lib/crm/email-signature.ts',
  'components/legal/',
  // The rule files themselves. They quote the banned shapes AS THE RULES, so
  // scanning them flags the canon for containing the canon.
  'marketing_brain_skills/brand-voice/VOICE.md',
  'scripts/voice-constructions.cjs',
  'scripts/brand-voice-vocabulary.cjs',
  'lib/brand-voice/constructions.ts',
  'lib/brand-voice/generated-vocabulary.ts',
  'scripts/_brand_voice_vocab_generated.py',
  // Internal documentation. VOICE.md's own scope rule: "Not governed: code,
  // comments, commit messages, admin screens, logs, internal docs." No member
  // of the public reads these, and "the codebase is the source of truth, not
  // the design project" is a precise technical statement in an instruction
  // file, not a marketing maxim. Scope correction, not a silencing: no public
  // copy is hidden by these three.
  'CLAUDE.md',
  'CHANGELOG.md',
  'AGENTS.md',
]

const args = process.argv.slice(2)
const MODE = args.includes('--next')
  ? 'next'
  : args.includes('--report')
  ? 'report'
  : args.includes('--worklist')
    ? 'worklist'
    : args.includes('--write-baseline')
      ? 'baseline'
      : 'ratchet'
const pathIdx = args.indexOf('--path')
const PATH_FILTER = pathIdx >= 0 ? args[pathIdx + 1] : null

const norm = (p) => p.split('\\').join('/')
const isExempt = (rel) => EXEMPT.some((e) => rel === e || rel.startsWith(e))

function walk(dir, out = []) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      if (SKIP_DIR.has(e.name) || e.name.startsWith('.')) continue
      walk(full, out)
    } else if (EXT.has(e.name.slice(e.name.lastIndexOf('.')))) {
      if (e.name.includes('.test.') || e.name.includes('.spec.')) continue
      out.push(full)
    }
  }
  return out
}

/**
 * Prose candidates from a file. For code we take string literals and JSX text;
 * for markdown we take body lines (skipping code fences, tables, and headings,
 * which are labels rather than prose).
 */
function proseFrom(content, isMarkdown, isJsx) {
  const out = []
  if (isMarkdown) {
    let fenced = false
    content.split('\n').forEach((line, i) => {
      if (/^\s*```/.test(line)) { fenced = !fenced; return }
      if (fenced) return
      const t = line.trim()
      if (!t || t.startsWith('#') || t.startsWith('|') || t.startsWith('>')) return
      if (/^[-*]\s*\[/.test(t)) return
      out.push({ text: t, line: i + 1 })
    })
    return out
  }
  const lines = content.split('\n')
  // Line number by binary search over precomputed offsets. Slicing the whole
  // file per match was O(n^2) and made a full scan take minutes.
  const offsets = [0]
  for (let i = 0; i < content.length; i++) if (content.charCodeAt(i) === 10) offsets.push(i + 1)
  const lineAt = (idx) => {
    let lo = 0
    let hi = offsets.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (offsets[mid] <= idx) lo = mid
      else hi = mid - 1
    }
    return lo + 1
  }
  // String literals (single, double, backtick) and JSX text between tags.
  // Linear-time literal matching. The escape-aware alternation this replaced
  // backtracked catastrophically on large template-literal files (a 180s scan).
  const litRe = /'([^'\n]{12,400})'|"([^"\n]{12,400})"|`([^`]{12,2000})`/g
  let m
  while ((m = litRe.exec(content))) {
    const value = m[1] ?? m[2] ?? m[3] ?? ''
    if (value.length < 12) continue
    const line = lineAt(m.index)
    const lineText = lines[line - 1] ?? ''
    if (/^\s*(import|export)\s|require\(|from\s+['"]/.test(lineText)) continue
    // Comments are not public copy.
    if (/^\s*(\/\/|\*|\/\*)/.test(lineText)) continue
    out.push({ text: value, line })
  }
  // JSX text children only in .tsx/.jsx. Running this over plain .ts matched
  // code between a '>' and a '<' (generics, arrows, block comments) and
  // produced false positives.
  if (isJsx) {
    const jsxRe = />([^<>{}\n]{16,})</g
    while ((m = jsxRe.exec(content))) {
      out.push({ text: m[1].trim(), line: lineAt(m.index) })
    }
  }
  return out
}

function scanFile(abs) {
  const rel = norm(relative(ROOT, abs))
  if (isExempt(rel)) return null
  if (PATH_FILTER && !rel.includes(PATH_FILTER)) return null
  let content
  try {
    content = readFileSync(abs, 'utf8')
  } catch {
    return null
  }
  if (/voice-constructions|check-brand-voice/.test(rel)) return null
  const isMd = rel.endsWith('.md')
  const hits = []
  const seen = new Set()
  const isJsx = rel.endsWith('.tsx') || rel.endsWith('.jsx')
  for (const piece of proseFrom(content, isMd, isJsx)) {
    for (const c of COMPILED) {
      if (!c.re.test(piece.text)) continue
      const key = `${c.id}:${piece.line}`
      if (seen.has(key)) continue
      seen.add(key)
      hits.push({
        id: c.id,
        rule: c.rule,
        label: c.label,
        fix: c.fix,
        line: piece.line,
        snippet: piece.text.replace(/\s+/g, ' ').slice(0, 120),
      })
    }
  }
  return hits.length ? { file: rel, hits } : null
}

const files = []
for (const entry of readdirSync(ROOT, { withFileTypes: true })) {
  if (entry.name.startsWith('.') || SKIP_TOP.has(entry.name)) continue
  const abs = join(ROOT, entry.name)
  if (entry.isDirectory()) walk(abs, files)
  else if (EXT.has(entry.name.slice(entry.name.lastIndexOf('.')))) files.push(abs)
}

const results = files.map(scanFile).filter(Boolean).sort((a, b) => b.hits.length - a.hits.length)
const total = results.reduce((n, r) => n + r.hits.length, 0)

// MACHINE STATE (Matt 2026-08-05: "it must persist memory so we never lose
// where we left off in the process. it cannot be prose"). Written on every
// run, by the scanner, from the scan itself. Nothing here is typed by hand, so
// it cannot drift from reality the way a written note does.
try {
  const next = results[0] ?? null
  writeFileSync(
    STATE_PATH,
    `${JSON.stringify(
      {
        _comment: 'GENERATED by scripts/check-voice-constructions.mjs on every run. Do not hand-edit.',
        canon: 'marketing_brain_skills/brand-voice/VOICE.md',
        grinder: '.claude/skills/voice-canon/SKILL.md  (run: /voice-canon)',
        command: 'npm run ci:voice-constructions:next',
        done: total === 0,
        violations_remaining: total,
        files_remaining: results.length,
        next_file: next ? next.file : null,
        next_file_violations: next ? next.hits.length : 0,
        files_scanned: files.length,
        updated_at: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  )
} catch {
  /* state is a convenience, never a reason to fail a scan */
}

if (MODE === 'next') {
  // The grinder's only question: what do I fix now?
  if (results.length === 0) {
    console.log('DONE · 0 violations. Nothing left to grind.')
    process.exit(0)
  }
  const t = results[0]
  console.log(`NEXT: ${t.file}  (${t.hits.length} violation(s) · ${total} left across ${results.length} file(s))`)
  for (const h of t.hits) {
    console.log(`  ${t.file}:${h.line}  [rule ${h.rule}: ${h.label}]`)
    console.log(`    "${h.snippet}"`)
    console.log(`    fix: ${h.fix}`)
  }
  process.exit(0)
}

if (MODE === 'worklist') {
  console.log(
    JSON.stringify(
      {
        generated_for: 'docs/plans/VOICE-CANON-2026-08-05.md Phase 4',
        canon: 'marketing_brain_skills/brand-voice/VOICE.md',
        total_violations: total,
        files_to_fix: results.length,
        files: results.map((r) => ({ file: r.file, count: r.hits.length, hits: r.hits })),
      },
      null,
      2,
    ),
  )
  process.exit(0)
}

if (MODE === 'baseline') {
  const byFile = Object.fromEntries(results.map((r) => [r.file, r.hits.length]))
  writeFileSync(
    BASELINE_PATH,
    `${JSON.stringify({ total, exemptions: EXEMPT.length, skipTop: SKIP_TOP.size, byFile }, null, 2)}\n`,
  )
  console.log(`✓ Baseline written: ${total} construction violation(s) across ${results.length} file(s) → ${relative(ROOT, BASELINE_PATH)}`)
  process.exit(0)
}

console.log('voice constructions (ci:voice-constructions)')
console.log('============================================')
console.log(`Scanned ${files.length} file(s) across the repo · ${total} violation(s) in ${results.length} file(s)\n`)

if (MODE === 'report') {
  for (const r of results) {
    console.log(`${r.file}  (${r.hits.length})`)
    for (const h of r.hits) {
      console.log(`  ${r.file}:${h.line}  [rule ${h.rule}: ${h.label}]`)
      console.log(`    "${h.snippet}"`)
      console.log(`    fix: ${h.fix}`)
    }
    console.log('')
  }
  console.log(`Total: ${total}. Canon: marketing_brain_skills/brand-voice/VOICE.md`)
  process.exit(0)
}

// Ratchet.
if (!existsSync(BASELINE_PATH)) {
  console.error('✗ No baseline. Run with --write-baseline once, then commit it.')
  process.exit(1)
}
const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
const baseTotal = baseline.total ?? 0
const baseByFile = baseline.byFile ?? {}

// ANTI-GAMING. The cheapest way to make this number fall is to stop looking:
// add a path to EXEMPT, or a directory to SKIP_TOP. That is not progress, it
// is hiding. Scope may only widen. Narrowing it requires deleting a rule from
// VOICE.md first, which is a decision, not a convenience.
const baseExempt = baseline.exemptions ?? EXEMPT.length
const baseSkip = baseline.skipTop ?? SKIP_TOP.size
if (EXEMPT.length > baseExempt || SKIP_TOP.size > baseSkip) {
  console.error('✗ Voice scan scope NARROWED:')
  if (EXEMPT.length > baseExempt) console.error(`    exempt paths ${baseExempt} → ${EXEMPT.length}`)
  if (SKIP_TOP.size > baseSkip) console.error(`    skipped roots ${baseSkip} → ${SKIP_TOP.size}`)
  console.error('\n  Fewer files scanned is not fewer violations. If a pattern is genuinely')
  console.error('  wrong, fix the pattern in scripts/voice-constructions.cjs and say so in')
  console.error('  the commit. Do not exempt real copy to make the count drop.')
  process.exit(1)
}

const regressions = []
for (const r of results) {
  const before = baseByFile[r.file] ?? 0
  if (r.hits.length > before) regressions.push({ file: r.file, before, now: r.hits.length, hits: r.hits })
}

if (regressions.length > 0) {
  console.error(`✗ Voice constructions regressed in ${regressions.length} file(s):\n`)
  for (const reg of regressions) {
    console.error(`  ${reg.file}: ${reg.before} → ${reg.now}`)
    for (const h of reg.hits.slice(0, 4)) {
      console.error(`    ${reg.file}:${h.line} [rule ${h.rule}: ${h.label}]`)
      console.error(`      "${h.snippet}"`)
      console.error(`      fix: ${h.fix}`)
    }
  }
  console.error('\nThe canon: marketing_brain_skills/brand-voice/VOICE.md')
  console.error('State the fact, then stop. Never write a sentence that explains the sentence before it.')
  process.exit(1)
}

if (total > baseTotal) {
  console.error(`✗ Total construction violations rose: ${baseTotal} → ${total}`)
  process.exit(1)
}
console.log(
  total < baseTotal
    ? `✓ Improved: ${baseTotal} → ${total}. Re-baseline with --write-baseline to lock it in.`
    : `✓ Stable at ${total} (= baseline). Ratchet only shrinks.`,
)
process.exit(0)
