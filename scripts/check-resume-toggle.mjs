#!/usr/bin/env node
/**
 * check-resume-toggle.mjs — G51: no toggles in resume/replay/retry/deep-link paths.
 *
 * The RC7 bug class: a deferred intent (e.g. "save this listing after sign-in")
 * replayed through a TOGGLE mutation. A toggle reads current state and flips it,
 * so replaying one against stale client state inverts the user's intent — the
 * RC7 founding case UN-saved listings because the resume path called
 * toggleSavedListing with a stale "not saved" card prop. Resume/replay code must
 * use idempotent, direction-explicit mutations (the SAFE exemplar:
 * lib/hooks/useResumePendingSave.ts calling resumeSaveListing — an idempotent
 * add, never a toggle).
 *
 * A file is IN SCOPE (treated as a resume/replay path) when any of:
 *   1. its path matches /(resume|replay|retry|pending-|deep-?link)/i
 *   2. it carries the marker comment `@resume-path` (add `// @resume-path` to
 *      any file implementing re-entry/replay logic that lacks the naming)
 *   3. it consumes a stashed intent (calls consumePending*() — replay by definition)
 *
 * Inside in-scope files these patterns are violations (ratcheted vs baseline):
 *   - a call to a toggle-named mutation:        toggleSavedListing(key)
 *   - a state setter fed a blind negation:      setSaved(!saved) · setSaved(v => !v)
 *   - a self-negating flip assignment:          saved = !saved
 *
 * Manual click handlers in ordinary components (ListingTile etc.) legitimately
 * toggle — they are OUT of scope by design. Escape hatch for a reviewed legit
 * case inside a resume path: `// toggle-ok: <reason>` on the same or previous
 * line. Baseline scripts/resume-toggle-baseline.json may only shrink.
 *
 * CLI: default pass/fail · --report (human, exit 0) · --json · --write-baseline
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const BASELINE = 'scripts/resume-toggle-baseline.json'
const SCAN_DIRS = ['app', 'components', 'hooks', 'lib']
const EXT = /\.(ts|tsx|js|jsx|mjs)$/
const SKIP_DIR = new Set(['node_modules', '.next', '__tests__'])
const IS_TEST = /\.(test|spec)\./

const SCOPE_NAME = /(resume|replay|retry|pending-|deep-?link)/i
const SCOPE_MARKER = /@resume-path\b/
const SCOPE_CONSUMER = /\bconsumePending\w*\s*\(/

const PATTERNS = [
  { name: 'toggle-call', re: /\btoggle[A-Z]\w*\s*\(/, desc: 'call to a toggle* mutation' },
  { name: 'setter-negation', re: /\bset[A-Z]\w*\s*\(\s*(?:!(?!!)|\(?\s*\w+\s*\)?\s*=>\s*!(?!!))/, desc: 'state setter fed a blind negation' },
  { name: 'flip-assign', re: /\b(\w+)\s*=\s*!\s*\1\b/, desc: 'self-negating flip assignment' },
]
// Lines that DECLARE a toggle helper (not a call into one).
const TOGGLE_DECL = /\b(?:function\s+toggle[A-Z]|(?:const|let|var)\s+toggle[A-Z]\w*\s*=)/
const COMMENT_LINE = /^\s*(\/\/|\*|\/\*)/
const OK_PRAGMA = /toggle-ok:/

const args = new Set(process.argv.slice(2))
const writeBaseline = args.has('--write-baseline')
const report = args.has('--report')
const asJson = args.has('--json')

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIR.has(name)) continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) yield* walk(p)
    else if (EXT.test(name) && !IS_TEST.test(name)) yield p
  }
}

function scopeReason(path, src) {
  if (SCOPE_NAME.test(path)) return 'naming'
  if (SCOPE_MARKER.test(src)) return 'marker'
  if (SCOPE_CONSUMER.test(src)) return 'consumes-pending-intent'
  return null
}

const hits = [] // { file, line, pattern, text, scope }
for (const dir of SCAN_DIRS) {
  if (!existsSync(dir)) continue
  for (const file of walk(dir)) {
    const src = readFileSync(file, 'utf8')
    const scope = scopeReason(file, src)
    if (!scope) continue
    const lines = src.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (COMMENT_LINE.test(line)) continue
      if (OK_PRAGMA.test(line) || (i > 0 && OK_PRAGMA.test(lines[i - 1]))) continue
      for (const { name, re } of PATTERNS) {
        if (name === 'toggle-call' && TOGGLE_DECL.test(line)) continue
        const m = line.match(re)
        if (m) hits.push({ file, line: i + 1, pattern: name, text: m[0].trim(), scope })
      }
    }
  }
}

// Ratchet key is line-number-free so unrelated edits don't churn the baseline.
const keyOf = (h) => `${h.file} :: ${h.pattern} :: ${h.text}`
const counts = new Map()
for (const h of hits) counts.set(keyOf(h), (counts.get(keyOf(h)) ?? 0) + 1)

if (writeBaseline) {
  const entries = [...counts.entries()].sort().map(([key, count]) => ({ key, count }))
  writeFileSync(
    BASELINE,
    JSON.stringify(
      {
        note:
          'Baselined toggle-style calls inside resume/replay/retry/deep-link paths — reviewed legit sites only. ' +
          'This list may only SHRINK: new resume-path code must use idempotent direction-explicit mutations ' +
          '(exemplar: lib/hooks/useResumePendingSave.ts -> resumeSaveListing). Regenerate with `npm run ci:resume-toggle:baseline`.',
        generated_by: 'check-resume-toggle.mjs --write-baseline',
        entries,
      },
      null,
      2,
    ) + '\n',
  )
  console.log(`resume-toggle baseline written: ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}`)
  process.exit(0)
}

let baseline
try {
  baseline = JSON.parse(readFileSync(BASELINE, 'utf8'))
} catch {
  console.error(`Resume-toggle gate FAILED — missing/unreadable ${BASELINE}. Run: npm run ci:resume-toggle:baseline`)
  process.exit(1)
}
const baseCounts = new Map((baseline.entries ?? []).map((e) => [e.key, e.count]))
const fresh = hits.filter((h) => {
  const base = baseCounts.get(keyOf(h)) ?? 0
  return counts.get(keyOf(h)) > base
})

if (asJson) {
  console.log(JSON.stringify({ pass: fresh.length === 0, hits, fresh: fresh.map((h) => ({ ...h })) }))
  process.exit(report || fresh.length === 0 ? 0 : 1)
}

if (fresh.length) {
  console.error(`Resume-toggle gate FAILED — ${fresh.length} toggle-style mutation(s) in resume/replay/retry/deep-link paths:\n`)
  for (const h of fresh) {
    const p = PATTERNS.find((x) => x.name === h.pattern)
    console.error(`  ✗ ${h.file}:${h.line} — ${p.desc} (\`${h.text}\`) [in scope via ${h.scope}]`)
  }
  console.error(
    '\nA replayed toggle inverts user intent when client state is stale (the RC7 bug class:\n' +
      'a resume path calling toggleSavedListing un-saved listings). Use an idempotent,\n' +
      'direction-explicit mutation instead — exemplar: lib/hooks/useResumePendingSave.ts\n' +
      'calling resumeSaveListing (an add that no-ops when already saved).\n' +
      'Reviewed legit site? Annotate `// toggle-ok: <reason>` on the line above it.',
  )
  process.exit(report ? 0 : 1)
}

const scoped = new Set(hits.map((h) => h.file)).size
console.log(
  `Resume-toggle gate passed — no new toggle-style mutations in resume/replay/retry/deep-link paths` +
    ` (baseline ${baseCounts.size} entr${baseCounts.size === 1 ? 'y' : 'ies'}${scoped ? `, ${scoped} baselined file(s)` : ''}).`,
)
