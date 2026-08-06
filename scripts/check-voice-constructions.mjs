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
const require = createRequire(import.meta.url)
const { COMPILED } = require('./voice-constructions.cjs')

const SCAN_ROOTS = [
  'app',
  'components',
  'lib/cma',
  'lib/bpo',
  'lib/pdf',
  'lib/email',
  'lib/email-templates',
  'lib/newsletter',
  'lib/crm',
  'lib/tc',
  'lib/marketing-brain',
  'lib/agent',
  'marketing_brain_skills',
  'social_media_skills',
  'automation_skills',
  'data',
]
/** Single files outside those roots that still carry public copy. */
const EXTRA_FILES = [
  'lib/lead-landing-content.ts',
  'lib/city-content.ts',
  'lib/community-content.ts',
  'lib/community-seo-content.ts',
  'lib/resort-community-content.ts',
  'lib/share-metadata.ts',
]

const SKIP_DIR = new Set(['node_modules', '.next', 'out', 'build', 'dist', '__tests__', 'admin', 'ui', 'console'])
const EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.md', '.json'])

/**
 * Never scanned. Each exemption is a rule from the canon or a legal
 * constraint, not a convenience.
 */
const EXEMPT = [
  // Someone else's words (VOICE.md scope): verbatim client reviews.
  'lib/testimonials.ts',
  // Carrier-verified A2P wording. ci:sms-consent fails if it changes.
  'lib/crm/sms-consent-text.ts',
  // Legally worded disclosures.
  'lib/crm/email-signature.ts',
  'components/legal/',
  // The canon and its own migration paperwork quote the banned shapes on purpose.
  'marketing_brain_skills/brand-voice/VOICE.md',
  'docs/plans/VOICE-CANON',
  'docs/research/brand-voice-anchors',
  'scripts/voice-constructions.cjs',
]

const args = process.argv.slice(2)
const MODE = args.includes('--report')
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
function proseFrom(content, isMarkdown) {
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
    out.push({ text: value, line })
  }
  const jsxRe = />([^<>{}\n]{16,})</g
  while ((m = jsxRe.exec(content))) {
    out.push({ text: m[1].trim(), line: lineAt(m.index) })
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
  for (const piece of proseFrom(content, isMd)) {
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
for (const root of SCAN_ROOTS) {
  const abs = join(ROOT, root)
  if (existsSync(abs) && statSync(abs).isDirectory()) walk(abs, files)
}
for (const f of EXTRA_FILES) {
  const abs = join(ROOT, f)
  if (existsSync(abs)) files.push(abs)
}

const results = files.map(scanFile).filter(Boolean).sort((a, b) => b.hits.length - a.hits.length)
const total = results.reduce((n, r) => n + r.hits.length, 0)

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
  writeFileSync(BASELINE_PATH, `${JSON.stringify({ total, byFile }, null, 2)}\n`)
  console.log(`✓ Baseline written: ${total} construction violation(s) across ${results.length} file(s) → ${relative(ROOT, BASELINE_PATH)}`)
  process.exit(0)
}

console.log('voice constructions (ci:voice-constructions)')
console.log('============================================')
console.log(`Scanned ${files.length} file(s) across ${SCAN_ROOTS.length} roots · ${total} violation(s) in ${results.length} file(s)\n`)

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
