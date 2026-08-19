#!/usr/bin/env node
/**
 * check-voice-vocab-parity.mjs — ci:voice-vocab-parity (W11.1).
 *
 * scripts/brand-voice-vocabulary.cjs is the ONE canonical banned-vocabulary
 * source. It is mirrored into two in-bundle artifacts by
 * scripts/gen-brand-voice-consumers.mjs:
 *   - lib/brand-voice/generated-vocabulary.ts  (app-bundle TS)
 *   - scripts/_brand_voice_vocab_generated.py  (build_*.py producer fleet)
 *
 * ~13 runtime consumers historically hand-typed their own copy of the banned
 * vocabulary, which drifted from the canonical source (some still hard-banned
 * words the canonical source un-banned 2026-06-02 — "about", "spacious",
 * "turnkey", etc.). W11.1 rewired every consumer to import the generated
 * artifact (or the canonical .cjs directly) instead. This gate keeps it that
 * way. It checks two things:
 *
 *   (a) Generator freshness — shells out to
 *       `node scripts/gen-brand-voice-consumers.mjs --check` and fails if the
 *       generated artifacts are stale vs the canonical .cjs.
 *
 *   (b) Consumer discipline — for every file in CONSUMER_MANIFEST, asserts it
 *       (1) imports/requires the canonical source (generated-vocabulary.ts,
 *           brand-voice-vocabulary.cjs, or _brand_voice_vocab_generated.py),
 *           AND
 *       (2) does NOT declare its own hand-typed banned-word array/set literal
 *           — detected as a literal whose string elements overlap heavily
 *           with the canonical BANNED_WORD_STRINGS (a re-typed CORE copy),
 *           as opposed to a small set of genuinely disjoint LOCAL_EXTRAS.
 *
 * TS/JS files are parsed with the TypeScript compiler AST (repo convention —
 * see scripts/check-bulk-approval-wired.mjs and
 * docs reference_code_inspecting_gates_use_ast) so a comment or string
 * mention can't satisfy the check. Python/.cjs consumers use a
 * comment-stripped source scan (regex-based bracket matching on
 * `*banned* = {...}` / `*banned* = [...]` blocks), which is acceptable per
 * the W11.1 spec since there is no first-party Python AST tool in this repo.
 *
 * Usage:
 *   node scripts/check-voice-vocab-parity.mjs
 *
 * Exit: 0 = pass, 1 = fail (generator drift or a consumer regressed).
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import ts from 'typescript'

const ROOT = process.cwd()
const require = createRequire(import.meta.url)

// Canonical source, loaded directly (not the generated mirror) so the
// overlap check is authoritative even if the generated artifact is stale —
// generator freshness is checked separately in step (a) below.
const VOCAB = require('./brand-voice-vocabulary.cjs')
const CANONICAL_SET = new Set(VOCAB.BANNED_WORD_STRINGS.map((w) => w.toLowerCase()))

// A hand-typed array/set that reproduces this many or more canonical words
// verbatim is a re-typed CORE copy, not a small set of disjoint local extras.
// LOCAL_EXTRAS are by definition DISJOINT from canonical (words beyond the core),
// so a legit addendum overlaps ~0; 3 catches a re-typed core (the stale over-ban
// was 7 words) while tolerating an incidental duplicate or two.
const OVERLAP_THRESHOLD = 3

// Acceptable "imports the canonical source" targets (suffix/substring match
// against the specifier or require() argument).
const CANONICAL_TARGETS = [
  'lib/brand-voice/generated-vocabulary',
  'brand-voice-vocabulary.cjs',
  '_brand_voice_vocab_generated',
]

const CONSUMER_MANIFEST = [
  { path: 'lib/email/voice-precheck.ts', kind: 'ts' },
  { path: 'lib/crm/templateVoiceCheck.ts', kind: 'ts' },
  { path: 'lib/marketing-brain/generate-briefs.ts', kind: 'ts' },
  { path: 'scripts/build-blog-post.mjs', kind: 'js' },
  { path: 'scripts/build-comms-client-update.mjs', kind: 'js' },
  { path: 'scripts/build-agent-coop-eflyer.mjs', kind: 'js' },
  { path: 'app/api/cron/gbp-health-check/route.ts', kind: 'ts' },
  { path: 'scripts/_producer_lib.py', kind: 'py' },
  { path: 'scripts/generate_content_calendar.py', kind: 'py' },
]

const problems = []

// ---------------------------------------------------------------------------
// (a) Generator freshness
// ---------------------------------------------------------------------------

function checkGeneratorFreshness() {
  try {
    execFileSync(process.execPath, [join(ROOT, 'scripts/gen-brand-voice-consumers.mjs'), '--check'], {
      cwd: ROOT,
      stdio: 'pipe',
    })
    return true
  } catch (err) {
    const out = [err.stdout?.toString(), err.stderr?.toString()].filter(Boolean).join('\n')
    problems.push(
      `generator freshness: \`node scripts/gen-brand-voice-consumers.mjs --check\` failed — generated artifacts are stale vs the canonical .cjs. Run \`node scripts/gen-brand-voice-consumers.mjs --write\` and commit.\n${out
        .split('\n')
        .map((l) => `      ${l}`)
        .join('\n')}`,
    )
    return false
  }
}

// ---------------------------------------------------------------------------
// (b) Consumer discipline — TS/JS (AST-based)
// ---------------------------------------------------------------------------

function readSrc(rel) {
  const p = join(ROOT, rel)
  if (!existsSync(p)) return null
  return readFileSync(p, 'utf8')
}

/**
 * True if the file imports/requires the canonical source AND actually REFERENCES
 * the bound name somewhere beyond the import statement itself. An unused import
 * beside a hand-typed list is a drift risk, not a real consumer — so presence of
 * the import alone is not enough; the binding must be used.
 */
function hasCanonicalImportTs(sf) {
  const isCanonicalSpecifier = (text) => CANONICAL_TARGETS.some((t) => text.includes(t))
  /** binding identifier names introduced by a canonical import/require */
  const boundNames = new Set()
  /** the import/require statement nodes, so we can exclude them from usage scan */
  const importNodes = []

  const collect = (node) => {
    // import ... from '<canonical>'
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier) && isCanonicalSpecifier(node.moduleSpecifier.text)) {
      importNodes.push(node)
      const clause = node.importClause
      if (clause?.name) boundNames.add(clause.name.text) // default import
      const named = clause?.namedBindings
      if (named && ts.isNamedImports(named)) for (const el of named.elements) boundNames.add(el.name.text)
      if (named && ts.isNamespaceImport(named)) boundNames.add(named.name.text)
    }
    // const X = require('<canonical>')  /  const {A,B} = require('<canonical>')
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isCallExpression(node.initializer)) {
      const call = node.initializer
      const isReq = ts.isIdentifier(call.expression) && call.expression.text === 'require'
      const a0 = call.arguments[0]
      if (isReq && a0 && ts.isStringLiteralLike(a0) && isCanonicalSpecifier(a0.text)) {
        importNodes.push(node)
        if (ts.isIdentifier(node.name)) boundNames.add(node.name.text)
        if (ts.isObjectBindingPattern(node.name)) for (const el of node.name.elements) if (ts.isIdentifier(el.name)) boundNames.add(el.name.text)
      }
    }
    ts.forEachChild(node, collect)
  }
  collect(sf)
  if (boundNames.size === 0) return false

  // The binding must be referenced outside its own import/require declaration.
  const inImport = (node) => importNodes.some((imp) => node.getStart() >= imp.getStart() && node.getEnd() <= imp.getEnd())
  let used = false
  const scanUse = (node) => {
    if (ts.isIdentifier(node) && boundNames.has(node.text) && !inImport(node)) used = true
    ts.forEachChild(node, scanUse)
  }
  scanUse(sf)
  return used
}

/**
 * Every ArrayLiteralExpression in the file, reduced to its direct
 * StringLiteral element texts (spreads / non-string elements ignored — a
 * spread of an imported list is exactly the accepted pattern, not a
 * violation). Returns [{ line, strings }].
 */
function arrayLiteralsWithStrings(sf) {
  const out = []
  const visit = (node) => {
    if (ts.isArrayLiteralExpression(node)) {
      const strings = node.elements.filter((e) => ts.isStringLiteralLike(e)).map((e) => e.text)
      if (strings.length > 0) {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart())
        out.push({ line: line + 1, strings })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return out
}

function checkTsConsumer(rel) {
  const src = readSrc(rel)
  if (src == null) {
    problems.push(`${rel}: file not found`)
    return
  }
  const scriptKind = rel.endsWith('.tsx')
    ? ts.ScriptKind.TSX
    : rel.endsWith('.ts')
      ? ts.ScriptKind.TS
      : ts.ScriptKind.JS
  const sf = ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true, scriptKind)

  if (!hasCanonicalImportTs(sf)) {
    problems.push(
      `${rel}: does not import/require AND USE the canonical vocabulary (generated-vocabulary.ts or brand-voice-vocabulary.cjs) — an unused import beside a hand-typed list is a drift risk. Import and reference BANNED_WORD_STRINGS.`,
    )
  }

  for (const { line, strings } of arrayLiteralsWithStrings(sf)) {
    const overlap = strings.filter((s) => CANONICAL_SET.has(s.toLowerCase()))
    if (overlap.length >= OVERLAP_THRESHOLD) {
      problems.push(
        `${rel}:${line}: array literal reproduces ${overlap.length} canonical banned word(s) verbatim (${overlap
          .slice(0, 5)
          .map((w) => `"${w}"`)
          .join(', ')}${overlap.length > 5 ? ', …' : ''}) — looks like a re-typed CORE list, not a small LOCAL_EXTRAS addendum. Import BANNED_WORD_STRINGS instead of hand-typing.`,
      )
    }
  }
}

// ---------------------------------------------------------------------------
// (b) Consumer discipline — Python (comment-stripped source scan)
// ---------------------------------------------------------------------------

function stripPyComments(src) {
  return src
    .split('\n')
    .map((line) => {
      // Naive but sufficient for this fleet: no '#' appears inside a string
      // literal in these files. Strip from the first '#' to end of line.
      const idx = line.indexOf('#')
      return idx === -1 ? line : line.slice(0, idx)
    })
    .join('\n')
}

/**
 * Find every `<name containing "banned"> = ...{` or `...[` block (allowing
 * intervening non-brace tokens like `set(...) | {`), bracket-match to the
 * close (string-literal-aware so braces inside quotes don't confuse depth),
 * and return the quoted string tokens found inside each block.
 */
function extractBannedBlocks(src) {
  const blocks = []
  const headerRe = /(\w*banned\w*)\s*=\s*[^{[\n]*([{[])/gi
  let m
  while ((m = headerRe.exec(src))) {
    const name = m[1]
    const openChar = m[2]
    const closeChar = openChar === '{' ? '}' : ']'
    const openPos = m.index + m[0].length - 1
    let depth = 1
    let i = openPos + 1
    let inStr = null // active quote char, or null
    while (i < src.length && depth > 0) {
      const ch = src[i]
      if (inStr) {
        if (ch === '\\') i++ // skip escaped char
        else if (ch === inStr) inStr = null
      } else if (ch === "'" || ch === '"') {
        inStr = ch
      } else if (ch === openChar) {
        depth++
      } else if (ch === closeChar) {
        depth--
      }
      i++
    }
    const body = src.slice(openPos + 1, i - 1)
    const strings = [...body.matchAll(/'([^'\\]*(?:\\.[^'\\]*)*)'|"([^"\\]*(?:\\.[^"\\]*)*)"/g)].map(
      (mm) => mm[1] ?? mm[2] ?? '',
    )
    blocks.push({ name, strings })
  }
  return blocks
}

function checkPyConsumer(rel) {
  const src = readSrc(rel)
  if (src == null) {
    problems.push(`${rel}: file not found`)
    return
  }
  const stripped = stripPyComments(src)

  const hasImport = CANONICAL_TARGETS.some((t) => stripped.includes(t))
  if (!hasImport) {
    problems.push(
      `${rel}: does not import the canonical vocabulary (from _brand_voice_vocab_generated import ...) — hand-typed drift risk.`,
    )
  }

  for (const { name, strings } of extractBannedBlocks(stripped)) {
    const overlap = strings.filter((s) => CANONICAL_SET.has(s.toLowerCase()))
    if (overlap.length >= OVERLAP_THRESHOLD) {
      problems.push(
        `${rel}: ${name} reproduces ${overlap.length} canonical banned word(s) verbatim (${overlap
          .slice(0, 5)
          .map((w) => `"${w}"`)
          .join(', ')}${overlap.length > 5 ? ', …' : ''}) — looks like a re-typed CORE list, not a small local-extras addendum. Import BANNED_WORD_STRINGS instead of hand-typing.`,
      )
    }
  }
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

console.log('Brand-voice vocabulary consumer parity (ci:voice-vocab-parity)')
console.log('================================================================')

const freshnessOk = checkGeneratorFreshness()
console.log(freshnessOk ? '✓ generated-vocabulary.ts / _brand_voice_vocab_generated.py are fresh vs the canonical .cjs.' : '✗ generated artifacts are stale.')

for (const { path: rel, kind } of CONSUMER_MANIFEST) {
  if (kind === 'ts' || kind === 'js') checkTsConsumer(rel)
  else if (kind === 'py') checkPyConsumer(rel)
}

console.log(
  `✓ checked ${CONSUMER_MANIFEST.length} consumer(s) for canonical import + no hand-typed CORE list.`,
)

if (problems.length) {
  console.error(`\nci:voice-vocab-parity found ${problems.length} problem(s):`)
  for (const p of problems) console.error(`  ✗ ${p}`)
  console.error(`\n\x1b[31m✗ ci:voice-vocab-parity FAILED.\x1b[0m`)
  process.exit(1)
}

console.log('\n✓ Every W11.1 consumer imports the canonical vocabulary and carries no re-typed CORE list.')
process.exit(0)
